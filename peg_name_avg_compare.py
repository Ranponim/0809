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
    """YYYY-MM-DD 형식의 문자열을 datetime.date로 변환.
    - 형식 오류 시 상세 로그를 남기고 예외 발생.
    """
    logging.info("입력 날짜 파싱 시작: %s", date_text)
    try:
        return datetime.datetime.strptime(date_text.strip(), "%Y-%m-%d").date()
    except Exception as e:
        logging.exception("날짜 파싱 실패: %s", e)
        raise


def get_db_connection():
    """하드코딩된 DB 설정으로 psycopg2 연결을 생성.
    - 비밀번호 등 민감정보는 로그에 남기지 않음.
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
    """특정 일자(target_date)에 대해 peg_name별 value 평균을 조회.
    - DATE(datetime) = %s 조건으로 필터링
    - 반환 컬럼: [peg_name, avg_value]
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
    """두 일자의 peg_name별 평균을 비교.
    - outer join으로 peg_name 기준 병합
    - 컬럼: [peg_name, avg_n_minus_1, avg_n, diff, pct_change]
    - pct_change: 분모(avg_n_minus_1)가 0이면 NaN 처리
    """
    logging.info("두 일자 비교 시작: n-1(%d행) vs n(%d행)", len(df_n1), len(df_n))
    left = df_n1.rename(columns={"avg_value": "avg_n_minus_1"})
    right = df_n.rename(columns={"avg_value": "avg_n"})
    merged = pd.merge(left, right, on="peg_name", how="outer")

    merged["diff"] = merged["avg_n"] - merged["avg_n_minus_1"]
    # 분모 0/결측 처리: 변화율은 (diff / avg_n_minus_1) * 100, 0 또는 NaN이면 NaN 유지
    merged["pct_change"] = (merged["diff"] / merged["avg_n_minus_1"]).where(merged["avg_n_minus_1"].notna() & (merged["avg_n_minus_1"] != 0)) * 100

    # 보기 좋게 정렬 및 반올림
    merged = merged[["peg_name", "avg_n_minus_1", "avg_n", "diff", "pct_change"]]
    merged = merged.sort_values(by=["peg_name"]).reset_index(drop=True)
    logging.info("두 일자 비교 완료: %d행", len(merged))
    return merged


def ensure_output_dir(path: str) -> None:
    if not os.path.isdir(path):
        logging.info("출력 디렉토리 생성: %s", path)
        os.makedirs(path, exist_ok=True)


def save_csv(df: pd.DataFrame, n1: datetime.date, n: datetime.date) -> str:
    ensure_output_dir(OUTPUT_DIR)
    filename = f"comparison_{n1.isoformat()}_{n.isoformat()}.csv"
    file_path = os.path.join(OUTPUT_DIR, filename)
    logging.info("CSV 저장 시작: %s", file_path)
    df.to_csv(file_path, index=False)
    logging.info("CSV 저장 완료: %s", file_path)
    return file_path


def generate_html_report(df: pd.DataFrame, n1: datetime.date, n: datetime.date) -> str:
    """간단한 HTML 요약 리포트 생성.
    - 전체 peg_name 수, 평균 증감 요약
    - 절대 diff 상위 N, 절대 pct_change 상위 N
    - 임계값 초과 항목 섹션
    """
    ensure_output_dir(OUTPUT_DIR)
    filename = f"peg_avg_report_{n1.isoformat()}_{n.isoformat()}.html"
    file_path = os.path.join(OUTPUT_DIR, filename)

    total_rows = len(df)
    nonnull_diff = df["diff"].dropna()
    mean_diff = float(nonnull_diff.mean()) if not nonnull_diff.empty else 0.0

    def top_abs(series: pd.Series, k: int) -> pd.DataFrame:
        idx = series.abs().nlargest(k).index
        return df.loc[idx, ["peg_name", "avg_n_minus_1", "avg_n", "diff", "pct_change"]]

    top_diff = top_abs(df["diff"].fillna(0), TOP_N)
    top_pct = top_abs(df["pct_change"].fillna(0), TOP_N)

    threshold_mask = (df["diff"].abs() >= THRESHOLD_DIFF) | (df["pct_change"].abs() >= THRESHOLD_PCT)
    exceeded = df.loc[threshold_mask]

    def table_html(data: pd.DataFrame) -> str:
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
    """엔드투엔드 실행: DB 조회 → 비교 → CSV 저장 → HTML 리포트 저장.
    반환: (csv_path, html_path)
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
