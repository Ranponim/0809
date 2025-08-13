"""
PEG 평균 비교 스크립트

- 목적: 두 날짜(n-1, n)를 입력받아 데이터베이스 테이블에서 `peg_name`별 `value`의 일자 평균을 계산하고,
        n-1과 n의 평균을 비교(diff, pct_change)하여 CSV/HTML로 저장합니다.
- 입력: 커맨드라인 인자 2개 (YYYY-MM-DD YYYY-MM-DD) → 순서대로 n-1, n
- 하드코딩 설정: 출력 경로, DB 접속 정보, 테이블/컬럼 스키마, 리포트 임계값 등
- 로깅: 모든 주요 함수에서 INFO/ERROR 로그를 상세히 남겨 디버깅을 지원합니다.
- 출력: CSV(`comparison_...csv`), HTML(`peg_avg_report_...html`)

데이터 스키마(테이블 열)
- id: integer
- host: character varying
- ne: character varying
- version: character varying
- family_name: character varying
- cellid: character varying
- peg_name: character varying
- datetime: timestamp without time zone
- value: double precision
"""

import os
import sys
import logging
import datetime
from typing import Tuple, Optional

import pandas as pd
import psycopg2
import psycopg2.extras


# --------------------------------------------------------------------------------------
# 하드코딩 설정 (PRD 명세)
# --------------------------------------------------------------------------------------
OUTPUT_DIR = os.path.abspath("./analysis_output")
BACKEND_URL = None  # 현재 버전에서는 미사용 (연동 필요 시 확장)

DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 5432,
    "user": "postgres",
    "password": "",
    "dbname": "postgres",
}

TABLE_NAME = "measurements"  # 조회 대상 테이블명 (하드코딩)

# 컬럼 스키마 (PRD):
# id / host / ne / version / family_name / cellid / peg_name / datetime / value
COLUMNS = {
    "id": "id",
    "host": "host",
    "ne": "ne",
    "version": "version",
    "family_name": "family_name",
    "cellid": "cellid",
    "peg_name": "peg_name",
    "datetime": "datetime",
    "value": "value",
}

# 리포트 임계값 (하드코딩 가능)
THRESHOLD_DIFF = 0.0  # 절대 diff 임계값 (기본 0: 모든 변화 표시)
THRESHOLD_PCT = 0.0   # 절대 pct_change 임계값 (기본 0: 모든 변화 표시)
TOP_N = 10


# --------------------------------------------------------------------------------------
# 로깅 설정: "YYYY-MM-DD HH:MM:SS - LEVEL - [function] message"
# --------------------------------------------------------------------------------------
class FunctionNameFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "funcName"):
            record.funcName = "-"
        return True


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - [%(funcName)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
for _handler in logging.getLogger().handlers:
    _handler.addFilter(FunctionNameFilter())


# --------------------------------------------------------------------------------------
# 유틸리티
# --------------------------------------------------------------------------------------

def parse_yyyy_mm_dd(date_text: str) -> datetime.date:
    """YYYY-MM-DD 형식의 문자열을 `datetime.date`로 변환합니다.

    Args:
        date_text: "YYYY-MM-DD" 형식의 날짜 문자열 (공백 포함 시 strip 처리)

    Returns:
        datetime.date: 파싱된 날짜 객체

    Raises:
        Exception: 형식이 잘못되었거나 파싱에 실패한 경우 예외를 발생시킵니다.

    Logging:
        - 입력 문자열, 성공/실패 여부를 INFO/ERROR로 상세 출력합니다.
    """
    logging.info("입력 날짜 파싱 시작: %s", date_text)
    try:
        return datetime.datetime.strptime(date_text.strip(), "%Y-%m-%d").date()
    except Exception as e:
        logging.exception("날짜 파싱 실패: %s", e)
        raise


def get_db_connection():
    """하드코딩된 DB 설정으로 PostgreSQL 연결(psycopg2)을 생성합니다.

    Returns:
        psycopg2.extensions.connection: 열린 데이터베이스 연결 객체

    Raises:
        Exception: 연결 실패 시 예외를 발생시킵니다.

    Notes:
        - 비밀번호 등 민감정보는 로그에 남기지 않습니다.
        - 연결 파라미터(host/port/db/user)를 로그로 남겨 디버깅을 돕습니다.
    """
    logging.info(
        "DB 연결 시도 (host=%s, port=%s, db=%s, user=%s)",
        DB_CONFIG.get("host"), DB_CONFIG.get("port"), DB_CONFIG.get("dbname"), DB_CONFIG.get("user")
    )
    try:
        conn = psycopg2.connect(
            host=DB_CONFIG["host"],
            port=DB_CONFIG["port"],
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
            dbname=DB_CONFIG["dbname"],
        )
        logging.info("DB 연결 성공")
        return conn
    except Exception as e:
        logging.exception("DB 연결 실패: %s", e)
        raise


def fetch_avg_by_peg_for_date(conn, target_date: datetime.date) -> pd.DataFrame:
    """특정 일자에 대해 `peg_name`별 `value` 평균을 조회합니다.

    쿼리 조건:
        - DATE(datetime) = target_date

    Args:
        conn: psycopg2 DB 연결 객체
        target_date: 대상 일자 (`datetime.date`)

    Returns:
        pandas.DataFrame: 컬럼 [`peg_name`, `avg_value`]

    Raises:
        Exception: 쿼리 실패 시 예외를 발생시킵니다.

    Logging:
        - 쿼리 시작/완료, 결과 행 수를 INFO로 출력합니다.
    """
    logging.info("평균 조회 시작 (DATE=%s)", target_date)
    peg_col = COLUMNS["peg_name"]
    val_col = COLUMNS["value"]
    dt_col = COLUMNS["datetime"]

    sql = f"""
        SELECT {peg_col} AS peg_name, AVG({val_col}) AS avg_value
        FROM {TABLE_NAME}
        WHERE DATE({dt_col}) = %s
        GROUP BY {peg_col}
    """
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(sql, (target_date,))
            rows = cur.fetchall()
        df = pd.DataFrame(rows, columns=["peg_name", "avg_value"]) if rows else pd.DataFrame(columns=["peg_name", "avg_value"])
        logging.info("평균 조회 완료: %d행", len(df))
        return df
    except Exception as e:
        logging.exception("평균 조회 실패: %s", e)
        raise


def compare_two_days(df_n1: pd.DataFrame, df_n: pd.DataFrame) -> pd.DataFrame:
    """두 일자의 `peg_name`별 평균을 비교합니다.

    처리 단계:
        1) `peg_name` 기준 outer join 병합
        2) diff = avg_n - avg_n_minus_1 계산
        3) pct_change = (diff / avg_n_minus_1) * 100 (분모 0/결측은 NaN 처리)

    Args:
        df_n1: n-1일 평균 결과 (컬럼: peg_name, avg_value)
        df_n: n일 평균 결과 (컬럼: peg_name, avg_value)

    Returns:
        pandas.DataFrame: [peg_name, avg_n_minus_1, avg_n, diff, pct_change]
    """
    logging.info("두 일자 비교 시작: n-1(%d행) vs n(%d행)", len(df_n1), len(df_n))
    left = df_n1.rename(columns={"avg_value": "avg_n_minus_1"})
    right = df_n.rename(columns={"avg_value": "avg_n"})
    merged = pd.merge(left, right, on="peg_name", how="outer")

    # diff 및 변화율 계산 (분모가 0 또는 결측인 경우 변화율은 NaN 유지)
    merged["diff"] = merged["avg_n"] - merged["avg_n_minus_1"]
    merged["pct_change"] = (merged["diff"] / merged["avg_n_minus_1"]).where(merged["avg_n_minus_1"].notna() & (merged["avg_n_minus_1"] != 0)) * 100

    # 가독성을 위한 컬럼 정렬 및 정렬 기준(peg_name) 적용
    merged = merged[["peg_name", "avg_n_minus_1", "avg_n", "diff", "pct_change"]]
    merged = merged.sort_values(by=["peg_name"]).reset_index(drop=True)
    logging.info("두 일자 비교 완료: %d행", len(merged))
    return merged


def ensure_output_dir(path: str) -> None:
    """출력 디렉터리가 없으면 생성합니다.

    Args:
        path: 생성할 경로
    """
    if not os.path.isdir(path):
        logging.info("출력 디렉토리 생성: %s", path)
        os.makedirs(path, exist_ok=True)


def save_csv(df: pd.DataFrame, n1: datetime.date, n: datetime.date) -> str:
    """비교 결과를 CSV로 저장합니다.

    파일명 형식:
        comparison_{YYYY-MM-DD}_{YYYY-MM-DD}.csv

    Args:
        df: 비교 결과 데이터프레임
        n1: 기준일
        n: 대상일

    Returns:
        str: 저장된 CSV 파일 경로
    """
    ensure_output_dir(OUTPUT_DIR)
    filename = f"comparison_{n1.isoformat()}_{n.isoformat()}.csv"
    file_path = os.path.join(OUTPUT_DIR, filename)
    logging.info("CSV 저장 시작: %s", file_path)
    df.to_csv(file_path, index=False)
    logging.info("CSV 저장 완료: %s", file_path)
    return file_path


def generate_html_report(df: pd.DataFrame, n1: datetime.date, n: datetime.date) -> str:
    """간단한 HTML 요약 리포트를 생성합니다.

    포함 내용:
        - 전체 peg_name 개수, 평균 증감 요약
        - 절대 diff 상위 N, 절대 pct_change 상위 N
        - 임계값(|diff|, |pct_change|) 초과 항목 테이블

    Args:
        df: 비교 결과 데이터프레임
        n1: 기준일
        n: 대상일

    Returns:
        str: 저장된 HTML 파일 경로
    """
    ensure_output_dir(OUTPUT_DIR)
    filename = f"peg_avg_report_{n1.isoformat()}_{n.isoformat()}.html"
    file_path = os.path.join(OUTPUT_DIR, filename)

    total_rows = len(df)
    nonnull_diff = df["diff"].dropna()
    mean_diff = float(nonnull_diff.mean()) if not nonnull_diff.empty else 0.0

    def top_abs(series: pd.Series, k: int) -> pd.DataFrame:
        # 절대값 기준 상위 k개 인덱스를 추출해 원본 df에서 행을 가져옵니다.
        idx = series.abs().nlargest(k).index
        return df.loc[idx, ["peg_name", "avg_n_minus_1", "avg_n", "diff", "pct_change"]]

    top_diff = top_abs(df["diff"].fillna(0), TOP_N)
    top_pct = top_abs(df["pct_change"].fillna(0), TOP_N)

    # 임계값 초과 항목: diff 또는 pct_change가 임계값 이상인 행들
    threshold_mask = (df["diff"].abs() >= THRESHOLD_DIFF) | (df["pct_change"].abs() >= THRESHOLD_PCT)
    exceeded = df.loc[threshold_mask]

    def table_html(data: pd.DataFrame) -> str:
        # 간단한 HTML 테이블 생성기 (float는 4자리로 표시)
        if data.empty:
            return "<div class='muted'>데이터가 없습니다.</div>"
        cols = list(data.columns)
        thead = "".join([f"<th>{c}</th>" for c in cols])
        body_rows = []
        for row in data.itertuples(index=False):
            tds = "".join([f"<td>{'' if pd.isna(v) else v:.4f}" if isinstance(v, float) else f"<td>{'' if pd.isna(v) else v}</td>" for v in row])
            body_rows.append(f"<tr>{tds}</tr>")
        tbody = "".join(body_rows)
        return f"<table><thead><tr>{thead}</tr></thead><tbody>{tbody}</tbody></table>"

    html_text = f"""
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="utf-8" />
    <title>PEG 평균 비교 리포트 ({n1} vs {n})</title>
    <style>
        body {{ font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 24px; }}
        h1 {{ font-size: 20px; margin: 0 0 12px; }}
        h2 {{ font-size: 16px; margin: 18px 0 8px; color: #0ea5e9; }}
        .muted {{ color: #6b7280; }}
        table {{ border-collapse: collapse; width: 100%; }}
        th, td {{ border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 13px; }}
        th {{ background: #f8fafc; text-align: left; }}
        .card {{ border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin: 12px 0; background: #ffffff; }}
    </style>
</head>
<body>
    <h1>PEG 평균 비교 리포트</h1>
    <div class="card">
        <div>기준일(n-1): <strong>{n1}</strong> / 대상일(n): <strong>{n}</strong></div>
        <div class="muted">peg_name별 value 평균 비교</div>
    </div>

    <div class="card">
        <h2>요약</h2>
        <div>전체 peg_name 개수: <strong>{total_rows}</strong></div>
        <div>평균 증감(diff) 평균: <strong>{mean_diff:.4f}</strong></div>
    </div>

    <div class="card">
        <h2>절대 diff 상위 {TOP_N}</h2>
        {table_html(top_diff)}
    </div>

    <div class="card">
        <h2>절대 pct_change 상위 {TOP_N}</h2>
        {table_html(top_pct)}
    </div>

    <div class="card">
        <h2>임계값 초과 항목 (|diff| ≥ {THRESHOLD_DIFF}, |pct_change| ≥ {THRESHOLD_PCT})</h2>
        {table_html(exceeded)}
    </div>
</body>
</html>
"""
    logging.info("HTML 리포트 저장 시작: %s", file_path)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(html_text)
    logging.info("HTML 리포트 저장 완료: %s", file_path)
    return file_path


# --------------------------------------------------------------------------------------
# 메인 실행
# --------------------------------------------------------------------------------------

def run(n_minus_1_text: str, n_text: str) -> Tuple[str, str]:
    """엔드투엔드 실행: DB 조회 → 비교 → CSV/HTML 저장을 순차 수행합니다.

    Args:
        n_minus_1_text: 기준일(YYYY-MM-DD)
        n_text: 대상일(YYYY-MM-DD)

    Returns:
        Tuple[str, str]: (csv_path, html_path)

    Logging:
        - 시작/종료, 각 단계의 핵심 지표(행 수, 파일 경로 등)를 INFO로 남깁니다.
    """
    logging.info("실행 시작: n-1=%s, n=%s", n_minus_1_text, n_text)
    n1 = parse_yyyy_mm_dd(n_minus_1_text)
    n = parse_yyyy_mm_dd(n_text)

    conn = get_db_connection()
    try:
        df_n1 = fetch_avg_by_peg_for_date(conn, n1)
        df_n = fetch_avg_by_peg_for_date(conn, n)
    finally:
        conn.close()
        logging.info("DB 연결 종료")

    result_df = compare_two_days(df_n1, df_n)
    csv_path = save_csv(result_df, n1, n)
    html_path = generate_html_report(result_df, n1, n)

    logging.info("실행 완료: CSV=%s, HTML=%s", csv_path, html_path)
    return csv_path, html_path


if __name__ == "__main__":
    try:
        if len(sys.argv) != 3:
            logging.error("사용법: python peg_name_avg_compare.py YYYY-MM-DD YYYY-MM-DD  # n-1, n")
            sys.exit(2)
        csv_path, html_path = run(sys.argv[1], sys.argv[2])
        print(csv_path)
        print(html_path)
        sys.exit(0)
    except Exception as e:
        logging.exception("프로그램 실패: %s", e)
        sys.exit(1)
