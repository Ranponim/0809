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
  "columns": {"time": "datetime", "peg_name": "peg_name", "value": "value"}
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
def _get_default_tzinfo() -> datetime.tzinfo:
    """
    환경 변수 `DEFAULT_TZ_OFFSET`(예: "+09:00")를 읽어 tzinfo를 생성합니다.
    설정이 없거나 형식이 잘못되면 UTC를 반환합니다.
    """
    offset_text = os.getenv("DEFAULT_TZ_OFFSET", "+09:00").strip()
    try:
        sign = 1 if offset_text.startswith("+") else -1
        hh_mm = offset_text[1:].split(":")
        hours = int(hh_mm[0]) if len(hh_mm) > 0 else 0
        minutes = int(hh_mm[1]) if len(hh_mm) > 1 else 0
        delta = datetime.timedelta(hours=hours * sign, minutes=minutes * sign)
        return datetime.timezone(delta)
    except Exception:
        logging.warning("DEFAULT_TZ_OFFSET 파싱 실패, UTC 사용: %s", offset_text)
        return datetime.timezone.utc

def parse_time_range(range_text: str) -> Tuple[datetime.datetime, datetime.datetime]:
    """
    "yyyy-mm-dd_hh:mm~yyyy-mm-dd_hh:mm" 또는 단일 날짜 "yyyy-mm-dd" 를 받아
    (start, end) datetime 튜플을 반환합니다.

    - 범위 형식: 주어진 시각 범위 그대로 사용
    - 단일 날짜: 해당 날짜의 00:00 ~ 23:59:59 로 확장

    Args:
        range_text: 시간 범위 문자열 또는 단일 날짜 문자열

    Returns:
        (start_dt, end_dt)
    """
    # 사람이 읽는 시간 범위를 엄격한 포맷으로 변환해 하위 단계에서 일관되게 사용
    logging.info("parse_time_range() 호출: 입력 문자열 파싱 시작: %s", range_text)
    try:
        tzinfo = _get_default_tzinfo()
        if "~" in range_text:
            start_str, end_str = range_text.split("~")
            start_dt = datetime.datetime.strptime(start_str.strip(), "%Y-%m-%d_%H:%M")
            end_dt = datetime.datetime.strptime(end_str.strip(), "%Y-%m-%d_%H:%M")
            # 타임존 정보 부여
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=tzinfo)
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=tzinfo)
        else:
            day = datetime.datetime.strptime(range_text.strip(), "%Y-%m-%d").date()
            start_dt = datetime.datetime.combine(day, datetime.time(0, 0, 0, tzinfo=tzinfo))
            end_dt = datetime.datetime.combine(day, datetime.time(23, 59, 59, tzinfo=tzinfo))
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
    주어진 기간에 대해 PEG 단위 평균값을 집계합니다.

    반환 컬럼: [peg_name, period, avg_value]
    """
    logging.info("fetch_cell_averages_for_period() 호출: %s ~ %s, period=%s", start_dt, end_dt, period_label)
    time_col = columns.get("time", "datetime")
    # README 스키마 기준: peg_name 컬럼 사용. columns 사전에 'peg' 또는 'peg_name' 키가 있으면 우선 사용
    peg_col = columns.get("peg") or columns.get("peg_name", "peg_name")
    value_col = columns.get("value", "value")

    sql = f"""
        SELECT {peg_col} AS peg_name, AVG({value_col}) AS avg_value
        FROM {table}
        WHERE {time_col} BETWEEN %s AND %s
        GROUP BY {peg_col}
    """
    try:
        # 동적 테이블/컬럼 구성이므로 실행 전에 구성값을 로그로 남겨 디버깅을 돕는다
        logging.info(
            "집계 SQL 실행: table=%s, time_col=%s, peg_col=%s, value_col=%s",
            table, time_col, peg_col, value_col,
        )
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(sql, (start_dt, end_dt))
            rows = cur.fetchall()
        # 조회 결과를 DataFrame으로 변환 (비어있을 수 있음)
        df = pd.DataFrame(rows, columns=["peg_name", "avg_value"]) if rows else pd.DataFrame(columns=["peg_name", "avg_value"]) 
        df["period"] = period_label
        logging.info("fetch_cell_averages_for_period() 건수: %d (period=%s)", len(df), period_label)
        return df
    except Exception as e:
        logging.exception("기간별 평균 집계 쿼리 실패: %s", e)
        raise


# --- 처리: N-1/N 병합 + 변화율/차트 생성 ---
def process_and_visualize(n1_df: pd.DataFrame, n_df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """
    두 기간의 PEG 집계 데이터를 병합해 diff/pct_change 를 계산하고, 비교 차트를 생성합니다.

    반환:
      - processed_df: ['peg_name', 'avg_n_minus_1', 'avg_n', 'diff', 'pct_change']
      - charts: {'overall': base64_png}
    """
    # 핵심 처리 단계: 병합 → 피벗 → 변화율 산출 → 차트 생성(Base64)
    logging.info("process_and_visualize() 호출: 데이터 병합 및 시각화 시작")
    try:
        all_df = pd.concat([n1_df, n_df], ignore_index=True)
        logging.info("병합 데이터프레임 크기: %s행 x %s열", all_df.shape[0], all_df.shape[1])
        pivot = all_df.pivot(index="peg_name", columns="period", values="avg_value").fillna(0)
        logging.info("피벗 결과 컬럼: %s", list(pivot.columns))
        if "N-1" not in pivot.columns or "N" not in pivot.columns:
            raise ValueError("N-1 또는 N 데이터가 부족합니다. 시간 범위 또는 원본 데이터를 확인하세요.")
        # 명세 컬럼 구성
        out = pd.DataFrame({
            "peg_name": pivot.index,
            "avg_n_minus_1": pivot["N-1"],
            "avg_n": pivot["N"],
        })
        out["diff"] = out["avg_n"] - out["avg_n_minus_1"]
        out["pct_change"] = (out["diff"] / out["avg_n_minus_1"].replace(0, float("nan"))) * 100
        processed_df = out.round(2)

        # 차트: 모든 셀에 대해 N-1 vs N 비교 막대그래프 (단일 이미지)
        plt.figure(figsize=(10, 6))
        processed_df.set_index("peg_name")[['avg_n_minus_1', 'avg_n']].plot(kind='bar', ax=plt.gca())
        plt.title("All PEGs: Period N vs N-1", fontsize=12)
        plt.ylabel("Average Value")
        plt.xlabel("PEG Name")
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
    당신은 3GPP 이동통신망 최적화를 전공한 MIT 박사급 전문가입니다. 다음 표는 PEG 단위로 집계한 결과이며, 두 기간은 동일한 시험환경에서 수행되었다고 가정합니다.

[입력 데이터 개요]
- 기간 n-1: {n1_range}
- 기간 n: {n_range}
    - 표 컬럼: peg_name, avg_n_minus_1, avg_n, diff, pct_change
    - 원본 스키마 예시: id(int), datetime(ts), value(double), version(text), family_name(text), cellid(text), peg_name(text), host(text), ne(text)
      (평균은 value 컬럼 기준)

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
                    cleaned_json_str = cleaned_json_str[start_index: end_index + 1]
                    logging.info("응답 문자열에서 JSON 부분 추출 성공")
                else:
                    logging.error("JSON 범위 추출 실패 (%s)", endpoint)
                    continue
            else:
                logging.error("응답에 '{' 없음 (%s)", endpoint)
                continue

            analysis_result = json.loads(cleaned_json_str)
            # 결과 구조를 빠르게 파악할 수 있도록 주요 키를 기록
            logging.info(
                "LLM 분석 결과 수신 성공 (%s): keys=%s",
                endpoint, list(analysis_result.keys()) if isinstance(analysis_result, dict) else type(analysis_result)
            )
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
def generate_multitab_html_report(llm_analysis: dict, charts: Dict[str, str], output_dir: str, processed_df: pd.DataFrame) -> str:
    """통합 분석 리포트를 HTML로 생성합니다."""
    # 3개 탭 구조(요약/상세/차트)로 시각적 가독성을 높인다
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

    # 차트 HTML (PNG 다운로드 버튼 포함)
    charts_html = ''.join([
        (
            f'<div class="chart-item">'
            f'  <div class="chart-img-wrap">'
            f'    <img src="data:image/png;base64,{b64_img}" alt="{label} Chart">'
            f'    <div class="chart-actions">'
            f'      <a class="btn" href="data:image/png;base64,{b64_img}" download="{label}.png">PNG 다운로드</a>'
            f'    </div>'
            f'  </div>'
            f'  <div class="chart-caption">{label}</div>'
            f'</div>'
        )
        for label, b64_img in charts.items()
    ])

    # CSV 데이터 URL 생성
    try:
        csv_text = processed_df.to_csv(index=False)
    except Exception:
        csv_text = ''
    csv_b64 = base64.b64encode(csv_text.encode('utf-8')).decode('utf-8') if csv_text else ''
    csv_data_url = f"data:text/csv;base64,{csv_b64}" if csv_b64 else ''

    # 테이블 헤더/바디 생성
    table_columns = list(processed_df.columns) if not processed_df.empty else []
    table_header_html = ''.join([f'<th data-index="{idx}" data-key="{html.escape(str(col))}">{html.escape(str(col))}</th>' for idx, col in enumerate(table_columns)])
    table_rows_html = ''
    if not processed_df.empty:
        for row in processed_df.itertuples(index=False):
            cells = []
            for value in row:
                cells.append(f"<td>{html.escape(str(value))}</td>")
            table_rows_html += '<tr>' + ''.join(cells) + '</tr>'

    logging.info(
        "리포트 구성요소: findings=%d, actions=%d, detailed_cells=%d, charts=%d",
        len(llm_analysis.get('key_findings', [])),
        len(llm_analysis.get('recommended_actions', [])),
        len(detail_map),
        len(charts),
    )

    html_template = f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Cell 종합 분석 리포트</title>
        <style>
            :root {{
                --bg: #f6f7fb;
                --card: #ffffff;
                --text: #1f2937;
                --muted: #6b7280;
                --border: #e5e7eb;
                --primary: #0ea5e9; /* sky-500 */
                --primary-600: #0284c7;
                --accent: #22c55e;  /* green-500 */
                --warn: #f59e0b;    /* amber-500 */
                --shadow: 0 10px 30px rgba(2, 8, 23, 0.08);
                --radius: 14px;
            }}
            @media (prefers-color-scheme: dark) {{
                :root {{
                    --bg: #0b1220;
                    --card: #0f172a;
                    --text: #e5e7eb;
                    --muted: #94a3b8;
                    --border: #1f2a44;
                    --primary: #38bdf8;
                    --primary-600: #0ea5e9;
                    --accent: #34d399;
                    --warn: #fbbf24;
                    --shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
                }}
            }}

            html, body {{
                margin: 0; padding: 0; background: linear-gradient(180deg, var(--bg), #ffffff00 60%), var(--bg);
                color: var(--text); font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;
            }}

            .shell {{ max-width: 1240px; margin: 28px auto; padding: 0 18px; }}

            .hero {{
                background: radial-gradient(1200px 240px at 20% -20%, rgba(56, 189, 248, 0.25), transparent),
                            radial-gradient(800px 200px at 90% -10%, rgba(34, 197, 94, 0.25), transparent);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                padding: 26px 26px;
                box-shadow: var(--shadow);
                backdrop-filter: saturate(110%) blur(4px);
            }}

            .hero h1 {{
                margin: 0 0 8px 0; font-size: 26px; font-weight: 800; letter-spacing: -0.01em;
                background: linear-gradient(90deg, var(--primary), var(--accent));
                -webkit-background-clip: text; background-clip: text; color: transparent;
            }}

            .hero .meta {{ color: var(--muted); font-size: 13px; }}

            .tabs {{
                margin-top: 16px;
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                box-shadow: var(--shadow);
                overflow: hidden;
            }}

            .tab-nav {{
                display: flex; gap: 6px; padding: 10px; position: sticky; top: 0; background: var(--card);
                border-bottom: 1px solid var(--border); z-index: 2;
            }}

            .tab-nav button {{
                appearance: none; border: 1px solid var(--border); background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
                color: var(--text); padding: 10px 14px; border-radius: 10px; font-size: 14px; cursor: pointer;
                transition: all .18s ease; box-shadow: 0 1px 0 rgba(0,0,0,.04);
            }}
            .tab-nav button:hover {{ transform: translateY(-1px); box-shadow: 0 6px 14px rgba(2,8,23,.08); }}
            .tab-nav button.active {{
                background: linear-gradient(180deg, rgba(14,165,233,.14), rgba(14,165,233,.08));
                color: var(--primary-600); border-color: rgba(14,165,233,.35);
            }}

            .content {{ padding: 18px; }}
            .section {{ margin: 16px 0 22px; }}
            .card {{ background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; box-shadow: var(--shadow); }}
            .card h2 {{ margin: 0 0 12px 0; font-size: 18px; color: var(--primary-600); }}
            .muted {{ color: var(--muted); }}

            .list ul {{ list-style: none; padding-left: 0; margin: 0; }}
            .list li {{
                margin: 8px 0; line-height: 1.6; position: relative; padding-left: 26px;
            }}
            .list li::before {{
                content: '✓'; position: absolute; left: 0; top: 1px; color: var(--accent); font-weight: 700;
            }}

            .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 18px; }}
            .chart-item img {{
                width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow);
            }}
            .chart-img-wrap {{ position: relative; }}
            .chart-actions {{ position: absolute; right: 10px; bottom: 10px; display: flex; gap: 8px; }}
            .chart-caption {{ margin-top: 8px; color: var(--muted); font-size: 12px; text-align: center; }}

            .btn {{
                padding: 8px 12px; border-radius: 10px; text-decoration: none; color: var(--text);
                background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
                border: 1px solid var(--border); box-shadow: 0 1px 0 rgba(0,0,0,.04);
                font-size: 13px; transition: all .18s ease; cursor: pointer;
            }}
            .btn:hover {{ transform: translateY(-1px); box-shadow: 0 6px 14px rgba(2,8,23,.08); }}

            .toolbar {{ display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }}
            .input {{
                padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); color: var(--text);
                min-width: 220px; outline: none;
            }}

            table {{ width: 100%; border-collapse: separate; border-spacing: 0; }}
            thead th {{
                text-align: left; padding: 10px 12px; position: sticky; top: 0; background: var(--card);
                border-bottom: 1px solid var(--border); cursor: pointer;
            }}
            tbody td {{ padding: 10px 12px; border-bottom: 1px solid var(--border); }}
            tbody tr:hover {{ background: rgba(14,165,233,.05); }}

            .tab-content {{ display: none; }}
            .tab-content.active {{ display: block; animation: fadeIn .28s ease; }}
            @keyframes fadeIn {{ from {{ opacity: 0; transform: translateY(6px); }} to {{ opacity: 1; transform: translateY(0); }} }}
        </style>
    </head>
    <body>
        <div class="shell">
            <div class="hero">
                <h1>Cell 종합 분석 리포트</h1>
                <div class="meta">생성 시각: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</div>
            </div>

            <div class="tabs">
                <div class="tab-nav" role="tablist">
                    <button class="active" role="tab" aria-selected="true" onclick="openTab(event, 'summary')">종합 리포트</button>
                    <button role="tab" aria-selected="false" onclick="openTab(event, 'detailed')">셀 상세 분석</button>
                    <button role="tab" aria-selected="false" onclick="openTab(event, 'charts')">비교 차트</button>
                    <button role="tab" aria-selected="false" onclick="openTab(event, 'table')">데이터 테이블</button>
                </div>
                <div class="content">
                    <section id="summary" class="tab-content active" role="tabpanel">
                        <div class="section card">
                            <h2>종합 분석 요약</h2>
                            <div class="muted">{summary_html}</div>
                        </div>
                        <div class="section card list">
                            <h2>핵심 관찰 사항</h2>
                            <ul>{findings_html}</ul>
                        </div>
                        <div class="section card list">
                            <h2>권장 조치</h2>
                            <ul>{actions_html}</ul>
                        </div>
                    </section>

                    <section id="detailed" class="tab-content" role="tabpanel">
                        <div class="section card">{detailed_html}</div>
                    </section>

                    <section id="charts" class="tab-content" role="tabpanel">
                        <div class="section card">
                            <h2>비교 차트</h2>
                            <div class="grid">{charts_html}</div>
                        </div>
                    </section>

                    <section id="table" class="tab-content" role="tabpanel">
                        <div class="section card">
                            <h2>데이터 테이블</h2>
                            <div class="toolbar">
                                <input id="table-search" class="input" placeholder="검색 (셀 이름 등)" />
                                {f'<a class="btn" href="{csv_data_url}" download="cell_stats.csv">CSV 다운로드</a>' if csv_data_url else ''}
                            </div>
                            <div class="table-wrap">
                                <table id="stats-table">
                                    <thead>
                                        <tr>{table_header_html}</tr>
                                    </thead>
                                    <tbody>{table_rows_html}</tbody>
                                </table>
                                {'' if table_rows_html else '<div class="muted">표시할 데이터가 없습니다.</div>'}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>

        <script>
            function openTab(evt, tabName) {{
                var i, tabcontent, tablinks;
                tabcontent = document.getElementsByClassName('tab-content');
                for (i = 0; i < tabcontent.length; i++) {{
                    tabcontent[i].classList.remove('active');
                }}
                var nav = evt.currentTarget.parentElement;
                tablinks = nav.getElementsByTagName('button');
                for (i = 0; i < tablinks.length; i++) {{
                    tablinks[i].classList.remove('active');
                    tablinks[i].setAttribute('aria-selected', 'false');
                }}
                document.getElementById(tabName).classList.add('active');
                evt.currentTarget.classList.add('active');
                evt.currentTarget.setAttribute('aria-selected', 'true');
            }}

            // 간단한 테이블 정렬/검색
            (function() {{
                var table = document.getElementById('stats-table');
                if (!table) return;
                var tbody = table.querySelector('tbody');
                var headers = table.querySelectorAll('thead th');
                var currentSort = {{ key: null, asc: true }};

                function inferType(value) {{
                    var num = parseFloat((value + '').replace(/,/g, ''));
                    return !isNaN(num) && isFinite(num) ? 'number' : 'string';
                }}

                function compareValues(a, b, type, asc) {{
                    if (type === 'number') {{
                        a = parseFloat((a + '').replace(/,/g, ''));
                        b = parseFloat((b + '').replace(/,/g, ''));
                        a = isNaN(a) ? -Infinity : a;
                        b = isNaN(b) ? -Infinity : b;
                    }} else {{
                        a = (a + '').toLowerCase();
                        b = (b + '').toLowerCase();
                    }}
                    if (a < b) return asc ? -1 : 1;
                    if (a > b) return asc ? 1 : -1;
                    return 0;
                }}

                headers.forEach(function(th) {{
                    th.addEventListener('click', function() {{
                        var index = parseInt(th.getAttribute('data-index'));
                        var key = th.getAttribute('data-key');
                        var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
                        var type = 'string';
                        if (rows.length) {{
                            var cellValue = rows[0].children[index].textContent.trim();
                            type = inferType(cellValue);
                        }}
                        var asc = currentSort.key === key ? !currentSort.asc : true;
                        rows.sort(function(r1, r2) {{
                            var a = r1.children[index].textContent.trim();
                            var b = r2.children[index].textContent.trim();
                            return compareValues(a, b, type, asc);
                        }});
                        tbody.innerHTML = '';
                        rows.forEach(function(r) {{ tbody.appendChild(r); }});
                        currentSort = {{ key: key, asc: asc }};
                    }});
                }});

                var search = document.getElementById('table-search');
                if (search) {{
                    search.addEventListener('input', function() {{
                        var keyword = search.value.toLowerCase();
                        var rows = tbody.querySelectorAll('tr');
                        rows.forEach(function(r) {{
                            var text = r.textContent.toLowerCase();
                            r.style.display = text.indexOf(keyword) > -1 ? '' : 'none';
                        }});
                    }});
                }}
            }})();
        </script>
    </body>
    </html>
    """

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(html_template)

    logging.info("HTML 리포트 생성 완료: %s", report_path)
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
      - columns: {time: 'datetime', peg_name: 'peg_name', value: 'value'}
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
        columns = request.get('columns', {"time": "datetime", "peg_name": "peg_name", "value": "value"})

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
            logging.info("백엔드 응답 타입: %s", type(backend_response))

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