"""
=====================================================================================
Cell 성능 LLM 분석기 (시간범위 입력 + PostgreSQL 집계 + 통합 분석 + HTML/백엔드 POST)
=====================================================================================

변경 사항 요약:
- 입력 형식 변경: LLM/사용자가 제공하는 시간 범위(n-1, n)를 받아 PostgreSQL에서 평균 집계
- 분석 관점 변경: PEG 단위가 아닌, 셀 단위 전체 PEG 데이터를 통합하여 종합 성능 평가
- 가정 반영: n-1과 n은 동일한 시험환경에서 수행되었다는 가정 하에 분석
- 결과 출력 확장: HTML 리포트 생성 + FastAPI 백엔드로 JSON POST 전송

사용 예시 (MCP tool 호출 request 예):
{
  "n_minus_1": "2025-07-01_00:00~2025-07-01_23:59",
  "n": "2025-07-02_00:00~2025-07-02_23:59",
  "output_dir": "./analysis_output",
  "backend_url": "http://localhost:8000/api/analysis-result",
  "db": {"host": "127.0.0.1", "port": 5432, "user": "postgres", "password": "pass", "dbname": "netperf"},
  "table": "summary",
  "columns": {"time": "datetime", "cell": "cellid", "value": "value"}
}
"""

import os
import io
import json
import base64
import html
import datetime
import logging
import subprocess
from typing import Dict, Tuple, Optional

import pandas as pd
import matplotlib
matplotlib.use("Agg")  # Headless 환경 렌더링
import matplotlib.pyplot as plt

import psycopg2
import psycopg2.extras
import requests
from fastmcp import FastMCP


# --- 로깅 기본 설정 ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


# --- FastMCP 서버 인스턴스 생성 ---
mcp = FastMCP(name="Cell LLM 종합 분석기")


# --- 유틸: 시간 범위 파서 ---
def parse_time_range(range_text: str) -> Tuple[datetime.datetime, datetime.datetime]:
    """
    "yyyy-mm-dd_hh:mm~yyyy-mm-dd_hh:mm" 문자열을 파싱하여 (start, end) datetime 튜플을 반환합니다.

    Args:
        range_text: 시간 범위 문자열

    Returns:
        (start_dt, end_dt)
    """
    # 사람이 읽는 시간 범위를 엄격한 포맷으로 변환해 하위 단계에서 일관되게 사용
    logging.info("parse_time_range() 호출: 입력 문자열 파싱 시작")
    try:
        start_str, end_str = range_text.split("~")
        start_dt = datetime.datetime.strptime(start_str.strip(), "%Y-%m-%d_%H:%M")
        end_dt = datetime.datetime.strptime(end_str.strip(), "%Y-%m-%d_%H:%M")
        logging.info("parse_time_range() 성공: %s ~ %s", start_dt, end_dt)
        return start_dt, end_dt
    except Exception as e:
        logging.exception("parse_time_range() 실패: %s", e)
        raise


# --- DB 연결 ---
def get_db_connection(db: Dict[str, str]):
    """
    PostgreSQL 연결을 반환합니다. (psycopg2)

    db: {host, port, user, password, dbname}
    """
    # 외부 DB 연결: 네트워크/권한/환경 변수 문제로 실패 가능성이 높으므로 상세 로그를 남긴다
    logging.info("get_db_connection() 호출: DB 연결 시도")
    try:
        conn = psycopg2.connect(
            host=db.get("host", os.getenv("DB_HOST", "127.0.0.1")),
            port=db.get("port", os.getenv("DB_PORT", 5432)),
            user=db.get("user", os.getenv("DB_USER", "postgres")),
            password=db.get("password", os.getenv("DB_PASSWORD", "")),
            dbname=db.get("dbname", os.getenv("DB_NAME", "postgres")),
        )
        # 민감정보(password)는 로그에 남기지 않는다
        logging.info("DB 연결 성공 (host=%s, dbname=%s)", db.get("host", "127.0.0.1"), db.get("dbname", "postgres"))
        return conn
    except Exception as e:
        logging.exception("DB 연결 실패: %s", e)
        raise


# --- DB 조회: 기간별 셀 평균 집계 ---
def fetch_cell_averages_for_period(
    conn,
    table: str,
    columns: Dict[str, str],
    start_dt: datetime.datetime,
    end_dt: datetime.datetime,
    period_label: str,
) -> pd.DataFrame:
    """
    주어진 기간에 대해 셀 단위 평균값을 집계합니다. PEG는 구분하지 않고 전체 데이터를 통합합니다.

    반환 컬럼: [cellid, period, avg_value]
    """
    logging.info("fetch_cell_averages_for_period() 호출: %s ~ %s, period=%s", start_dt, end_dt, period_label)
    time_col = columns.get("time", "datetime")
    cell_col = columns.get("cell", "cellid")
    value_col = columns.get("value", "value")

    sql = f"""
        SELECT {cell_col} AS cellid, AVG({value_col}) AS avg_value
        FROM {table}
        WHERE {time_col} BETWEEN %s AND %s
        GROUP BY {cell_col}
    """
    try:
        # 동적 테이블/컬럼 구성이므로 실행 전에 구성값을 로그로 남겨 디버깅을 돕는다
        logging.info(
            "집계 SQL 실행: table=%s, time_col=%s, cell_col=%s, value_col=%s",
            table, time_col, cell_col, value_col,
        )
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(sql, (start_dt, end_dt))
            rows = cur.fetchall()
        # 조회 결과를 DataFrame으로 변환 (비어있을 수 있음)
        df = pd.DataFrame(rows, columns=["cellid", "avg_value"]) if rows else pd.DataFrame(columns=["cellid", "avg_value"])
        df["period"] = period_label
        logging.info("fetch_cell_averages_for_period() 건수: %d (period=%s)", len(df), period_label)
        return df
    except Exception as e:
        logging.exception("기간별 평균 집계 쿼리 실패: %s", e)
        raise


# --- 처리: N-1/N 병합 + 변화율/차트 생성 ---
def process_and_visualize(n1_df: pd.DataFrame, n_df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """
    두 기간의 집계 데이터를 병합해 변화율을 계산하고, 종합 비교 차트를 생성합니다.

    반환:
      - processed_df: [cellid, 'N-1', 'N', 'rate(%)']
      - charts: {'overall': base64_png}
    """
    # 핵심 처리 단계: 병합 → 피벗 → 변화율 산출 → 차트 생성(Base64)
    logging.info("process_and_visualize() 호출: 데이터 병합 및 시각화 시작")
    try:
        all_df = pd.concat([n1_df, n_df], ignore_index=True)
        logging.info("병합 데이터프레임 크기: %s행 x %s열", all_df.shape[0], all_df.shape[1])
        pivot = all_df.pivot(index="cellid", columns="period", values="avg_value").fillna(0)
        logging.info("피벗 결과 컬럼: %s", list(pivot.columns))
        if "N-1" not in pivot.columns or "N" not in pivot.columns:
            raise ValueError("N-1 또는 N 데이터가 부족합니다. 시간 범위 또는 원본 데이터를 확인하세요.")
        pivot["rate(%)"] = ((pivot["N"] - pivot["N-1"]) / pivot["N-1"].replace(0, float("nan"))) * 100
        processed_df = pivot.reset_index().round(2)

        # 차트: 모든 셀에 대해 N-1 vs N 비교 막대그래프 (단일 이미지)
        plt.figure(figsize=(10, 6))
        processed_df.set_index("cellid")[['N-1', 'N']].plot(kind='bar', ax=plt.gca())
        plt.title("All Cells: Period N vs N-1", fontsize=12)
        plt.ylabel("Average Value")
        plt.xlabel("Cell ID")
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        png_bytes = buf.read()
        overall_b64 = base64.b64encode(png_bytes).decode('utf-8')
        plt.close()
        charts = {"overall": overall_b64}

        logging.info(
            "process_and_visualize() 완료: processed_df=%d행, 차트 1개 (PNG %d bytes)",
            len(processed_df), len(png_bytes)
        )
        return processed_df, charts
    except Exception as e:
        logging.exception("process_and_visualize() 실패: %s", e)
        raise


# --- LLM 프롬프트 생성 (통합 분석) ---
def create_llm_analysis_prompt_overall(processed_df: pd.DataFrame, n1_range: str, n_range: str) -> str:
    """
    전체 PEG를 통합한 셀 단위 종합 분석 프롬프트를 생성합니다.

    가정: n-1과 n은 동일한 시험환경에서 수행됨.
    기대 출력(JSON):
      {
        "overall_summary": "...",
        "key_findings": ["..."],
        "recommended_actions": ["..."],
        "cells_with_significant_change": {"CELL_A": "설명", ...}
      }
    """
    # LLM 입력은 맥락/가정/출력 요구사항을 명확히 포함해야 일관된 답변을 유도할 수 있다
    logging.info("create_llm_analysis_prompt_overall() 호출: 프롬프트 생성 시작")
    data_preview = processed_df.to_string(index=False)
    prompt = f"""
당신은 3GPP 이동통신망 최적화를 전공한 MIT 박사급 전문가입니다. 다음 표는 전체 PEG 데이터를 통합하여 셀 단위로 집계한 결과이며, 두 기간은 동일한 시험환경에서 수행되었다고 가정합니다.

[입력 데이터 개요]
- 기간 n-1: {n1_range}
- 기간 n: {n_range}
- 표 컬럼: cellid, N-1(평균 value), N(평균 value), rate(%)
- 요약 테이블의 원본 스키마 예시: id(int), datetime(ts), value(double), version(text), family_name(text), cellid(text), peg_name(text), host(text), ne(text)
  (평균은 value에 대해서만 산출됨)

[데이터 표]
{data_preview}

[분석 지침]
- 3GPP TS/TR 권고와 운용 관행에 근거하여 전문적으로 해석하세요. (예: TS 36.300/38.300, TR 36.902 등)
- 변화율의 크기와 방향을 정량적으로 해석하고, 셀/PEG 특성, 주파수/대역폭, 스케줄링, 간섭, 핸드오버, 로드, 백홀 등 잠재 요인을 체계적으로 가정-검증 형태로 제시하세요.
- 동일 환경 가정에서 성립하지 않을 수 있는 교란 요인(라우팅 변경, 소프트웨어 버전, 파라미터 롤백, 단말 믹스 변화 등)을 명시하세요.
- 원인-영향 사슬을 간결하게 제시하고, 관찰 가능한 검증 로그/지표를 함께 제안하세요.

[출력 요구]
- 간결하지만 고신뢰 요약을 제공하고, 핵심 관찰과 즉시 실행 가능한 개선/추가 검증 액션을 분리해 주세요.
- 출력은 반드시 아래 JSON 스키마를 정확히 따르세요.

[출력 형식(JSON)]
{{
  "overall_summary": "...",
  "key_findings": ["..."],
  "recommended_actions": ["..."],
  "cells_with_significant_change": {{"CELL_NAME": "설명"}}
}}
"""
    logging.info("create_llm_analysis_prompt_overall() 완료")
    return prompt


# --- LLM API 호출 함수 (subprocess + curl) ---
def query_llm(prompt: str) -> dict:
    """내부 vLLM 서버로 분석 요청. 응답 본문에서 JSON만 추출.
    실패 시 다음 엔드포인트로 페일오버.
    """
    # 장애 대비를 위해 복수 엔드포인트로 페일오버. 응답에서 JSON 블록만 추출
    logging.info("query_llm() 호출: vLLM 분석 요청 시작")
    endpoints = [
        'http://10.251.204.93:10000',
        'http://100.105.188.117:8888',
    ]
    payload = {
        "model": "Gemma-3-27B",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 4096,
    }
    json_payload = json.dumps(payload)
    logging.info("LLM 요청 준비: endpoints=%d, prompt_length=%d", len(endpoints), len(prompt))

    for endpoint in endpoints:
        try:
            logging.info("엔드포인트 접속 시도: %s", endpoint)
            command = [
                'curl', f'{endpoint}/v1/chat/completions',
                '-H', 'Content-Type: application/json',
                '-d', json_payload,
                '--max-time', '180'
            ]
            process = subprocess.run(command, capture_output=True, check=False, encoding='utf-8', errors='ignore')
            if process.returncode != 0:
                logging.error("curl 실패 (%s): %s", endpoint, process.stderr.strip())
                continue
            if not process.stdout:
                logging.error("응답(stdout)이 비어있습니다 (%s)", endpoint)
                continue
            response_json = json.loads(process.stdout)
            if 'error' in response_json:
                logging.error("API 에러 응답 수신 (%s): %s", endpoint, response_json['error'])
                continue
            if 'choices' not in response_json or not response_json['choices']:
                logging.error("'choices' 없음 또는 비어있음 (%s): %s", endpoint, response_json)
                continue
            analysis_content = response_json['choices'][0]['message']['content']
            if not analysis_content or not analysis_content.strip():
                logging.error("'content' 비어있음 (%s)", endpoint)
                continue

            cleaned_json_str = analysis_content
            if '{' in cleaned_json_str:
                start_index, end_index = cleaned_json_str.find('{'), cleaned_json_str.rfind('}')
                if start_index != -1 and end_index != -1:
                    cleaned_json_str = cleaned_json_str[start_index:end_index+1]
            try:
                return json.loads(cleaned_json_str)
            except Exception:
                logging.warning("JSON 파싱 실패, 원문 반환")
                return {"raw": analysis_content}
        except Exception as e:
            logging.exception("엔드포인트 실패(%s), 다음으로 페일오버", endpoint)
            continue

    logging.error("모든 엔드포인트 실패")
    return {"error": "All endpoints failed"}


# --- HTML 리포트 생성 ---
def generate_multitab_html_report(analysis: dict, charts: Dict[str, str], output_dir: str, processed_df: pd.DataFrame) -> str:
    """멀티탭 HTML 리포트를 생성합니다. 분석 JSON, 전체 비교 차트, 표를 포함합니다."""
    os.makedirs(output_dir, exist_ok=True)
    report_path = os.path.join(output_dir, f"Cell_Analysis_Report_{datetime.datetime.now().strftime('%Y-%m-%d_%H-%M')}.html")

    overall_chart_img = charts.get("overall")

    # HTML 문자열 구성 (간단한 스타일 포함)
    html_parts = [
        "<html><head><meta charset='utf-8'><title>Cell Analysis Report</title>",
        "<style>body{font-family:Arial,sans-serif;margin:20px;} .tab{margin-bottom:20px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ccc;padding:6px;text-align:left;} th{background:#f4f4f4;} .chart{max-width:100%;height:auto;}</style>",
        "</head><body>",
        "<h2>Cell Performance Analysis Report</h2>",
    ]

    # 탭 1: 종합 요약/권고
    if isinstance(analysis, dict):
        html_parts.append("<div class='tab'><h3>Overall Summary</h3>")
        html_parts.append(f"<pre>{html.escape(json.dumps(analysis, ensure_ascii=False, indent=2))}</pre>")
        html_parts.append("</div>")

    # 탭 2: 전체 비교 차트
    if overall_chart_img:
        html_parts.append("<div class='tab'><h3>All Cells: N vs N-1</h3>")
        html_parts.append(f"<img class='chart' src='data:image/png;base64,{overall_chart_img}' alt='Overall Chart' />")
        html_parts.append("</div>")

    # 탭 3: 통계 테이블
    if not processed_df.empty:
        html_parts.append("<div class='tab'><h3>Statistics</h3>")
        html_parts.append(processed_df.to_html(index=False))
        html_parts.append("</div>")

    html_parts.append("</body></html>")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(html_parts))

    return report_path


# --- 백엔드 POST ---
def post_results_to_backend(url: str, payload: dict, timeout: int = 15) -> Optional[dict]:
    """분석 JSON 결과를 FastAPI 백엔드로 POST 전송합니다."""
    # 네트워크 오류/타임아웃 대비. 상태코드/본문 파싱 결과를 기록해 원인 추적을 용이하게 함
    logging.info("post_results_to_backend() 호출: %s", url)
    try:
        resp = requests.post(url, json=payload, timeout=timeout)
        resp.raise_for_status()
        logging.info("백엔드 POST 성공: status=%s", resp.status_code)
        try:
            return resp.json()
        except Exception:
            logging.warning("백엔드 응답 본문 JSON 파싱 실패, text 반환")
            return {"status_code": resp.status_code, "text": resp.text}
    except Exception as e:
        logging.exception("백엔드 POST 실패: %s", e)
        return None


# --- MCP 도구 로직 ---
def _analyze_cell_performance_logic(request: dict) -> dict:
    """
    요청 파라미터:
      - n_minus_1: "yyyy-mm-dd_hh:mm~yyyy-mm-dd_hh:mm"
      - n: "yyyy-mm-dd_hh:mm~yyyy-mm-dd_hh:mm"
      - output_dir: str (기본 ./analysis_output)
      - backend_url: str (선택)
      - db: {host, port, user, password, dbname}
      - table: str (기본 'summary')
      - columns: {time: 'datetime', cell: 'cellid', value: 'value'}
    """
    logging.info("=" * 20 + " Cell 성능 분석 로직 실행 시작 " + "=" * 20)
    try:
        # 파라미터 파싱
        n1_text = request.get('n_minus_1') or request.get('n1')
        n_text = request.get('n')
        if not n1_text or not n_text:
            raise ValueError("'n_minus_1'와 'n' 시간 범위를 모두 제공해야 합니다.")

        output_dir = request.get('output_dir', os.path.abspath('./analysis_output'))
        backend_url = request.get('backend_url')

        db = request.get('db', {})
        table = request.get('table', 'summary')
        columns = request.get('columns', {"time": "datetime", "cell": "cellid", "value": "value"})

        # 파라미터 요약 로그: 민감정보는 기록하지 않음
        logging.info(
            "요청 요약: output_dir=%s, backend_url=%s, table=%s, columns=%s",
            output_dir, bool(backend_url), table, columns
        )

        # 시간 범위 파싱
        n1_start, n1_end = parse_time_range(n1_text)
        n_start, n_end = parse_time_range(n_text)
        logging.info("시간 범위: N-1(%s~%s), N(%s~%s)", n1_start, n1_end, n_start, n_end)

        # DB 조회
        conn = get_db_connection(db)
        try:
            n1_df = fetch_cell_averages_for_period(conn, table, columns, n1_start, n1_end, "N-1")
            n_df = fetch_cell_averages_for_period(conn, table, columns, n_start, n_end, "N")
        finally:
            conn.close()
            logging.info("DB 연결 종료")

        logging.info("집계 결과 크기: n-1=%d행, n=%d행", len(n1_df), len(n_df))
        if len(n1_df) == 0 or len(n_df) == 0:
            logging.warning("한쪽 기간 데이터가 비어있음: 분석 신뢰도가 낮아질 수 있음")

        # 처리 & 시각화
        processed_df, charts_base64 = process_and_visualize(n1_df, n_df)
        logging.info("처리 완료: processed_df=%d행, charts=%d", len(processed_df), len(charts_base64))

        # LLM 프롬프트 & 분석
        prompt = create_llm_analysis_prompt_overall(processed_df, n1_text, n_text)
        logging.info("프롬프트 길이: %d자", len(prompt))
        llm_analysis = query_llm(prompt)
        logging.info("LLM 결과 키: %s", list(llm_analysis.keys()) if isinstance(llm_analysis, dict) else type(llm_analysis))

        # HTML 리포트 작성
        report_path = generate_multitab_html_report(llm_analysis, charts_base64, output_dir, processed_df)
        logging.info("리포트 경로: %s", report_path)

        # 백엔드 POST payload 구성
        result_payload = {
            "status": "success",
            "n_minus_1": n1_text,
            "n": n_text,
            "analysis": llm_analysis,
            "stats": processed_df.to_dict(orient='records'),
            "chart_overall_base64": charts_base64.get("overall"),
            "report_path": report_path,
            "assumption_same_environment": True,
        }
        logging.info("payload 준비 완료: stats_rows=%d", len(result_payload.get("stats", [])))

        backend_response = None
        if backend_url:
            backend_response = post_results_to_backend(backend_url, result_payload)
            result_payload["backend_response"] = backend_response

        logging.info("전체 로직 완료")
        return result_payload

    except Exception as e:
        logging.exception("분석 실패: %s", e)
        return {"status": "error", "message": str(e)}


# --- MCP 도구 등록 ---
@mcp.tool()
def analyze_cell_performance_with_llm(request: dict) -> dict:
    """두 기간의 셀 성능을 집계/비교하고, LLM으로 통합 분석합니다."""
    return _analyze_cell_performance_logic(request)


if __name__ == '__main__':
    logging.info("stdio 모드로 MCP를 실행합니다.")
    mcp.run(transport="stdio")