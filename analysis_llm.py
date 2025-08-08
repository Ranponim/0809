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
  "threshold": 30.0,
  "output_dir": "./analysis_output",
  "backend_url": "http://localhost:8000/api/analysis-result",
  "db": {"host": "127.0.0.1", "port": 5432, "user": "postgres", "password": "pass", "dbname": "netperf"},
  "table": "measurements",
  "columns": {"time": "ts", "cell": "cell_name", "value": "kpi_value"}
}
"""

import os
import io
import json
import base64
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
    logging.info("get_db_connection() 호출: DB 연결 시도")
    try:
        conn = psycopg2.connect(
            host=db.get("host", os.getenv("DB_HOST", "127.0.0.1")),
            port=db.get("port", os.getenv("DB_PORT", 5432)),
            user=db.get("user", os.getenv("DB_USER", "postgres")),
            password=db.get("password", os.getenv("DB_PASSWORD", "")),
            dbname=db.get("dbname", os.getenv("DB_NAME", "postgres")),
        )
        logging.info("DB 연결 성공")
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

    반환 컬럼: [cell_name, period, avg_value]
    """
    logging.info("fetch_cell_averages_for_period() 호출: %s ~ %s, period=%s", start_dt, end_dt, period_label)
    time_col = columns.get("time", "ts")
    cell_col = columns.get("cell", "cell_name")
    value_col = columns.get("value", "kpi_value")

    sql = f"""
        SELECT {cell_col} AS cell_name, AVG({value_col}) AS avg_value
        FROM {table}
        WHERE {time_col} BETWEEN %s AND %s
        GROUP BY {cell_col}
    """
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(sql, (start_dt, end_dt))
            rows = cur.fetchall()
        df = pd.DataFrame(rows, columns=["cell_name", "avg_value"]) if rows else pd.DataFrame(columns=["cell_name", "avg_value"]) 
        df["period"] = period_label
        logging.info("fetch_cell_averages_for_period() 건수: %d", len(df))
        return df
    except Exception as e:
        logging.exception("기간별 평균 집계 쿼리 실패: %s", e)
        raise


# --- 처리: N-1/N 병합 + 변화율/이상치 산출 + 차트 생성 ---
def process_and_visualize(n1_df: pd.DataFrame, n_df: pd.DataFrame, threshold: float) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """
    두 기간의 집계 데이터를 병합해 변화율/이상치를 계산하고, 종합 비교 차트를 생성합니다.

    반환:
      - processed_df: [cell_name, 'N-1', 'N', 'rate(%)', 'anomaly']
      - charts: {'overall': base64_png}
    """
    logging.info("process_and_visualize() 호출: 데이터 병합 및 시각화 시작")
    try:
        all_df = pd.concat([n1_df, n_df], ignore_index=True)
        pivot = all_df.pivot(index="cell_name", columns="period", values="avg_value").fillna(0)
        if "N-1" not in pivot.columns or "N" not in pivot.columns:
            raise ValueError("N-1 또는 N 데이터가 부족합니다. 시간 범위 또는 원본 데이터를 확인하세요.")
        pivot["rate(%)"] = ((pivot["N"] - pivot["N-1"]) / pivot["N-1"].replace(0, float("nan"))) * 100
        pivot["anomaly"] = pivot["rate(%)"].abs() >= threshold
        processed_df = pivot.reset_index().round(2)

        # 차트: 모든 셀에 대해 N-1 vs N 비교 막대그래프 (단일 이미지)
        plt.figure(figsize=(10, 6))
        processed_df.set_index("cell_name")[['N-1', 'N']].plot(kind='bar', ax=plt.gca())
        plt.title("All Cells: Period N vs N-1", fontsize=12)
        plt.ylabel("Average Value")
        plt.xlabel("Cell Name")
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        overall_b64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()
        charts = {"overall": overall_b64}

        logging.info("process_and_visualize() 완료: processed_df=%d행, 차트 1개", len(processed_df))
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
    logging.info("create_llm_analysis_prompt_overall() 호출: 프롬프트 생성 시작")
    data_preview = processed_df.to_string(index=False)
    prompt = f"""
당신은 3GPP 이동통신망 최적화 분야의 최고 전문가입니다. 다음 표는 전체 PEG 데이터를 통합하여 셀 단위로 집계한 결과이며, 두 기간은 동일한 시험환경에서 수행되었다고 가정합니다.

[입력 데이터 개요]
- 기간 n-1: {n1_range}
- 기간 n: {n_range}
- 컬럼 의미: cell_name, N-1, N, rate(%), anomaly(True=유의미 변화)

[데이터 표]
{data_preview}

[분석 요청]
- 전체적인 네트워크 성능 경향을 요약하세요.
- 유의미한 변화가 있는 셀을 중심으로, 변화의 방향과 잠재 원인을 설명하세요.
- 동일 시험환경 가정 하에서 해석 시 주의사항을 언급하세요.
- 즉시 수행 가능한 개선 조치와 추가 검증 제안을 제시하세요.

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
                    cleaned_json_str = cleaned_json_str[start_index: end_index + 1]
                    logging.info("응답 문자열에서 JSON 부분 추출 성공")
                else:
                    logging.error("JSON 범위 추출 실패 (%s)", endpoint)
                    continue
            else:
                logging.error("응답에 '{' 없음 (%s)", endpoint)
                continue

            analysis_result = json.loads(cleaned_json_str)
            logging.info("LLM 분석 결과 수신 성공 (%s)", endpoint)
            return analysis_result
        except json.JSONDecodeError as e:
            logging.error("JSON 파싱 실패: %s", e)
            logging.error("파싱 시도 내용(1000자): %s...", cleaned_json_str[:1000])
            continue
        except Exception as e:
            logging.error("예기치 못한 오류 (%s): %s", type(e).__name__, e, exc_info=True)
            continue
    raise ConnectionError("모든 LLM API 엔드포인트에 연결하지 못했습니다.")


# --- HTML 리포트 생성 (통합 분석 전용) ---
def generate_multitab_html_report(llm_analysis: dict, charts: Dict[str, str], output_dir: str) -> str:
    """통합 분석 리포트를 HTML로 생성합니다."""
    logging.info("generate_multitab_html_report() 호출: HTML 생성 시작")
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M")
    report_filename = f"Cell_Analysis_Report_{timestamp}.html"
    report_path = os.path.join(output_dir, report_filename)

    summary_html = (llm_analysis.get('overall_summary') or llm_analysis.get('comprehensive_summary', 'N/A')).replace('\n', '<br>')
    findings_html = ''.join([f'<li>{item}</li>' for item in llm_analysis.get('key_findings', [])])
    actions_html = ''.join([f'<li>{item}</li>' for item in llm_analysis.get('recommended_actions', [])])

    # 셀 상세 분석 (있을 경우)
    detail_map = llm_analysis.get('cells_with_significant_change') or llm_analysis.get('detailed_cell_analysis') or {}
    detailed_parts = []
    for cell, analysis in detail_map.items():
        analysis_html = str(analysis).replace('\n', '<br>')
        detailed_parts.append(f"<h2>{cell}</h2><div class='peg-analysis-box'><p>{analysis_html}</p></div>")
    detailed_html = "".join(detailed_parts)

    charts_html = ''.join([f'<div class="chart-item"><img src="data:image/png;base64,{b64_img}" alt="{label} Chart"></div>' for label, b64_img in charts.items()])

    html_template = f"""
    <!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>Cell 종합 분석 리포트</title>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; background-color: #f4f7f6; color: #333; }}
        .container {{ max-width: 1200px; margin: 20px auto; padding: 20px; background-color: #fff; box-shadow: 0 0 15px rgba(0,0,0,0.1); border-radius: 8px; }}
        h1 {{ color: #005f73; border-bottom: 3px solid #005f73; padding-bottom: 10px; }} 
        h2 {{ color: #0a9396; border-bottom: 2px solid #e9d8a6; padding-bottom: 5px; margin-top: 30px;}}
        .tab-container {{ width: 100%; }} 
        .tab-nav {{ display: flex; border-bottom: 2px solid #dee2e6; }}
        .tab-nav-link {{ padding: 10px 20px; cursor: pointer; border: none; background: none; font-size: 16px; border-bottom: 3px solid transparent; }}
        .tab-nav-link.active {{ border-bottom-color: #005f73; color: #005f73; font-weight: bold; }}
        .tab-content {{ display: none; padding: 20px 5px; animation: fadeIn 0.5s; }} 
        .tab-content.active {{ display: block; }}
        @keyframes fadeIn {{ from {{ opacity: 0; }} to {{ opacity: 1; }} }}
        ul {{ list-style-type: '✓ '; padding-left: 20px; }} 
        li {{ margin-bottom: 10px; line-height: 1.6; }}
        .summary-box, .peg-analysis-box {{ background-color: #e9f5f9; border-left: 5px solid #0a9396; padding: 15px; margin: 15px 0; border-radius: 5px; }}
        .chart-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }}
        .chart-item {{ text-align: center; }} 
        img {{ max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 5px; }}
    </style></head><body>
    <div class="container"><h1>Cell 종합 분석 리포트</h1><p><strong>생성 시각:</strong> {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
    <div class="tab-container"><div class="tab-nav">
        <button class="tab-nav-link active" onclick="openTab(event, 'summary')">종합 리포트</button>
        <button class="tab-nav-link" onclick="openTab(event, 'detailed')">셀 상세 분석</button>
        <button class="tab-nav-link" onclick="openTab(event, 'charts')">비교 차트</button>
    </div>
    <div id="summary" class="tab-content active">
        <h2>종합 분석 요약</h2><div class="summary-box"><p>{summary_html}</p></div>
        <h2>핵심 관찰 사항</h2><div class="summary-box"><ul>{findings_html}</ul></div>
        <h2>권장 조치</h2><div class="summary-box"><ul>{actions_html}</ul></div>
    </div>
    <div id="detailed" class="tab-content">{detailed_html}</div>
    <div id="charts" class="tab-content"><div class="chart-grid">{charts_html}</div></div></div></div>
    <script>
        function openTab(evt, tabName) {{{{
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tab-content");
            for (i = 0; i < tabcontent.length; i++) {{{{
                tabcontent[i].style.display = "none";
            }}}}
            tablinks = document.getElementsByClassName("tab-nav-link");
            for (i = 0; i < tablinks.length; i++) {{{{
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }}}}
            document.getElementById(tabName).style.display = "block";
            evt.currentTarget.className += " active";
        }}}}
    </script></body></html>
    """

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(html_template)

    logging.info("HTML 리포트 생성 완료: %s", report_path)
    return report_path


# --- 백엔드 POST ---
def post_results_to_backend(url: str, payload: dict, timeout: int = 15) -> Optional[dict]:
    """분석 JSON 결과를 FastAPI 백엔드로 POST 전송합니다."""
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
      - threshold: float (기본 30.0)
      - output_dir: str (기본 ./analysis_output)
      - backend_url: str (선택)
      - db: {host, port, user, password, dbname}
      - table: str (기본 'measurements')
      - columns: {time: 'ts', cell: 'cell_name', value: 'kpi_value'}
    """
    logging.info("=" * 20 + " Cell 성능 분석 로직 실행 시작 " + "=" * 20)
    try:
        # 파라미터 파싱
        n1_text = request.get('n_minus_1') or request.get('n1')
        n_text = request.get('n')
        if not n1_text or not n_text:
            raise ValueError("'n_minus_1'와 'n' 시간 범위를 모두 제공해야 합니다.")

        threshold = float(request.get('threshold', 30.0))
        output_dir = request.get('output_dir', os.path.abspath('./analysis_output'))
        backend_url = request.get('backend_url')

        db = request.get('db', {})
        table = request.get('table', 'measurements')
        columns = request.get('columns', {"time": "ts", "cell": "cell_name", "value": "kpi_value"})

        # 시간 범위 파싱
        n1_start, n1_end = parse_time_range(n1_text)
        n_start, n_end = parse_time_range(n_text)

        # DB 조회
        conn = get_db_connection(db)
        try:
            n1_df = fetch_cell_averages_for_period(conn, table, columns, n1_start, n1_end, "N-1")
            n_df = fetch_cell_averages_for_period(conn, table, columns, n_start, n_end, "N")
        finally:
            conn.close()
            logging.info("DB 연결 종료")

        # 처리 & 시각화
        processed_df, charts_base64 = process_and_visualize(n1_df, n_df, threshold)

        # LLM 프롬프트 & 분석
        prompt = create_llm_analysis_prompt_overall(processed_df, n1_text, n_text)
        llm_analysis = query_llm(prompt)

        # HTML 리포트 작성
        report_path = generate_multitab_html_report(llm_analysis, charts_base64, output_dir)

        # 백엔드 POST payload 구성
        result_payload = {
            "status": "success",
            "n_minus_1": n1_text,
            "n": n_text,
            "threshold": threshold,
            "analysis": llm_analysis,
            "stats": processed_df.to_dict(orient='records'),
            "chart_overall_base64": charts_base64.get("overall"),
            "report_path": report_path,
            "assumption_same_environment": True,
        }

        backend_response = None
        if backend_url:
            backend_response = post_results_to_backend(backend_url, result_payload)

        logging.info("=" * 20 + " Cell 성능 분석 로직 실행 종료 (성공) " + "=" * 20)
        return {
            "status": "success",
            "message": f"분석 완료. 리포트: {report_path}",
            "report_path": report_path,
            "backend_response": backend_response,
            "analysis": llm_analysis,
            "stats": processed_df.to_dict(orient='records'),
        }
    except ValueError as e:
        logging.error("입력/처리 오류: %s", e)
        return {"status": "error", "message": f"입력/처리 오류: {str(e)}"}
    except ConnectionError as e:
        logging.error("연결 오류: %s", e)
        return {"status": "error", "message": f"연결 오류: {str(e)}"}
    except Exception as e:
        logging.exception("예상치 못한 오류 발생")
        return {"status": "error", "message": f"예상치 못한 오류: {str(e)}"}


@mcp.tool
def analyze_cell_performance_with_llm(request: dict) -> dict:
    """MCP 엔드포인트: 시간 범위 기반 통합 셀 성능 분석 실행"""
    return _analyze_cell_performance_logic(request)


if __name__ == '__main__':
    logging.info("stdio 모드로 MCP를 실행합니다.")
    mcp.run(transport="stdio")