"""
=====================================================================================
Cell 성능 LLM 분석기 (시간범위 입력 + PostgreSQL 집계 + 통합 분석 + HTML/백엔드 POST)
=====================================================================================

변경 사항 요약:
- 입력 형식 변경: LLM/사용자가 제공하는 시간 범위(n-1, n)를 받아 PostgreSQL에서 평균 집계
- 분석 관점 변경: PEG 단위가 아닌, 셀 단위 전체 PEG 데이터를 통합하여 종합 성능 평가
- 가정 반영: n-1과 n은 동일한 시험환경에서 수행되었다는 가정 하에 분석
- 결과 출력 확장: HTML 리포트 생성 + FastAPI 백엔드로 JSON POST 전송
- 특정 PEG 분석: preference(정확한 peg_name 목록)나 selected_pegs로 지정된 PEG만 묶어 별도 LLM 분석
- 파생 PEG 수식 지원: peg_definitions로 (pegA/pegB)*100 같은 수식을 정의해 파생 PEG를 계산/포함

사용 예시 (MCP tool 호출 request 예):
{
  "n_minus_1": "2025-07-01_00:00~2025-07-01_23:59",
  "n": "2025-07-02_00:00~2025-07-02_23:59",
  "output_dir": "./analysis_output",
  "backend_url": "http://localhost:8000/api/analysis-result",
  "db": {"host": "127.0.0.1", "port": 5432, "user": "postgres", "password": "pass", "dbname": "netperf"},
  "table": "summary",
  "columns": {"time": "datetime", "peg_name": "peg_name", "value": "value"},
  "preference": "Random_access_preamble_count,Random_access_response",
  "peg_definitions": {
    "telus_RACH_Success": "Random_access_preamble_count/Random_access_response*100"
  }
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
import ast
import math

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
    ne_filters: Optional[list] = None,
    cellid_filters: Optional[list] = None,
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
    ne_col = columns.get("ne", "ne")
    cell_col = columns.get("cell") or columns.get("cellid", "cellid")

    sql = f"SELECT {peg_col} AS peg_name, AVG({value_col}) AS avg_value FROM {table} WHERE {time_col} BETWEEN %s AND %s"
    params = [start_dt, end_dt]

    # 선택적 필터: ne, cellid
    if ne_filters:
        ne_vals = [str(x).strip() for x in (ne_filters or []) if str(x).strip()]
        if len(ne_vals) == 1:
            sql += f" AND {ne_col} = %s"
            params.append(ne_vals[0])
        elif len(ne_vals) > 1:
            placeholders = ",".join(["%s"] * len(ne_vals))
            sql += f" AND {ne_col} IN ({placeholders})"
            params.extend(ne_vals)

    if cellid_filters:
        cid_vals = [str(x).strip() for x in (cellid_filters or []) if str(x).strip()]
        if len(cid_vals) == 1:
            sql += f" AND {cell_col} = %s"
            params.append(cid_vals[0])
        elif len(cid_vals) > 1:
            placeholders = ",".join(["%s"] * len(cid_vals))
            sql += f" AND {cell_col} IN ({placeholders})"
            params.extend(cid_vals)

    sql += f" GROUP BY {peg_col}"
    try:
        # 동적 테이블/컬럼 구성이므로 실행 전에 구성값을 로그로 남겨 디버깅을 돕는다
        logging.info(
            "집계 SQL 실행: table=%s, time_col=%s, peg_col=%s, value_col=%s, ne_col=%s, cell_col=%s",
            table, time_col, peg_col, value_col, ne_col, cell_col,
        )
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()
        # 조회 결과를 DataFrame으로 변환 (비어있을 수 있음)
        df = pd.DataFrame(rows, columns=["peg_name", "avg_value"]) if rows else pd.DataFrame(columns=["peg_name", "avg_value"]) 
        df["period"] = period_label
        logging.info("fetch_cell_averages_for_period() 건수: %d (period=%s)", len(df), period_label)
        return df
    except Exception as e:
        logging.exception("기간별 평균 집계 쿼리 실패: %s", e)
        raise


# --- 파생 PEG 계산: 수식 정의를 안전하게 평가하여 새로운 PEG 생성 ---
def _safe_eval_expr(expr_text: str, variables: Dict[str, float]) -> float:
    """
    간단한 산술 수식(expr_text)을 안전하게 평가합니다.
    허용 토큰: 숫자, 변수명(peg_name), +, -, *, /, (, )
    변수값은 variables 딕셔너리에서 가져옵니다.
    """
    logging.info("_safe_eval_expr() 호출: expr=%s", expr_text)
    try:
        node = ast.parse(expr_text, mode='eval')

        def _eval(node):
            if isinstance(node, ast.Expression):
                return _eval(node.body)
            if isinstance(node, ast.BinOp):
                left = _eval(node.left)
                right = _eval(node.right)
                if isinstance(node.op, ast.Add):
                    return float(left) + float(right)
                if isinstance(node.op, ast.Sub):
                    return float(left) - float(right)
                if isinstance(node.op, ast.Mult):
                    return float(left) * float(right)
                if isinstance(node.op, ast.Div):
                    return float(left) / float(right)
                raise ValueError("허용되지 않은 연산자")
            if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
                operand = _eval(node.operand)
                return +float(operand) if isinstance(node.op, ast.UAdd) else -float(operand)
            if isinstance(node, ast.Num):
                return float(node.n)
            if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
                return float(node.value)
            if isinstance(node, ast.Name):
                name = node.id
                if name not in variables:
                    raise KeyError(f"정의되지 않은 변수: {name}")
                return float(variables[name])
            if isinstance(node, ast.Call):
                raise ValueError("함수 호출은 허용되지 않습니다")
            if isinstance(node, (ast.Attribute, ast.Subscript, ast.List, ast.Dict, ast.Tuple)):
                raise ValueError("허용되지 않은 표현식 형식")
            raise ValueError("지원되지 않는 AST 노드")

        return float(_eval(node))
    except ZeroDivisionError:
        logging.warning("수식 평가 중 0으로 나눔 발생: %s", expr_text)
        return float('nan')
    except Exception as e:
        logging.error("수식 평가 실패: %s (expr=%s)", e, expr_text)
        return float('nan')


def compute_derived_pegs_for_period(period_df: pd.DataFrame, definitions: Dict[str, str], period_label: str) -> pd.DataFrame:
    """
    period_df: [peg_name, avg_value] 형태의 단일 기간 집계 데이터
    definitions: {derived_name: expr_text} 형태의 파생 PEG 수식 정의
    반환: 동일 컬럼을 갖는 파생 PEG 데이터프레임
    """
    logging.info("compute_derived_pegs_for_period() 호출: period=%s, defs=%d", period_label, len(definitions or {}))
    if not isinstance(definitions, dict) or not definitions:
        return pd.DataFrame(columns=["peg_name", "avg_value", "period"])  # 빈 DF

    # 변수 사전 구성 (peg_name -> avg_value)
    base_map: Dict[str, float] = {}
    try:
        for row in period_df.itertuples(index=False):
            base_map[str(row.peg_name)] = float(row.avg_value)
    except Exception:
        # 컬럼명이 다를 가능성 최소화를 위해 보호
        ser = period_df.set_index('peg_name')['avg_value'] if 'peg_name' in period_df and 'avg_value' in period_df else None
        if ser is not None:
            base_map = {str(k): float(v) for k, v in ser.items()}

    rows = []
    for new_name, expr in definitions.items():
        try:
            value = _safe_eval_expr(str(expr), base_map)
            rows.append({"peg_name": str(new_name), "avg_value": float(value), "period": period_label})
            logging.info("파생 PEG 계산: %s = %s (period=%s)", new_name, value, period_label)
        except Exception as e:
            logging.error("파생 PEG 계산 실패: %s (name=%s, period=%s)", e, new_name, period_label)
            continue
    return pd.DataFrame(rows, columns=["peg_name", "avg_value", "period"]) if rows else pd.DataFrame(columns=["peg_name", "avg_value", "period"]) 

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


# --- LLM 프롬프트 생성 (통합 분석) [구버전: 호환성 유지 목적, 미사용 예정] ---
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


# --- LLM 프롬프트 생성 (고도화된 종합 분석) ---
def create_llm_analysis_prompt_enhanced(processed_df: pd.DataFrame, n1_range: str, n_range: str) -> str:
    """
    PEG 집계 데이터를 기반으로, 연쇄적 사고 진단 워크플로우를 적용한
    전문가 수준의 종합 분석 프롬프트를 생성합니다.

    가정:
    - n-1과 n 기간은 동일한 시험환경에서 수행됨.
    - 입력 데이터(processed_df)는 PEG 단위로 집계된 상태임 (셀 단위 데이터 아님).

    기대 출력 (JSON):
    - executive_summary: 최상위 요약
    - diagnostic_findings: 구조화된 진단 결과 목록
    - recommended_actions: 우선순위가 부여된 구체적인 실행 계획 목록
    """
    logging.info("create_llm_analysis_prompt_enhanced() 호출: 고도화된 프롬프트 생성 시작")
    data_preview = processed_df.to_string(index=False)

    prompt = f"""
[페르소나 및 임무]
당신은 Tier-1 이동통신사에서 20년 경력을 가진 수석 네트워크 진단 및 최적화 전략가입니다. 당신의 임무는 신속한 근본 원인 분석(RCA)을 수행하고, 고객 영향도에 따라 문제의 우선순위를 정하며, 현장 엔지니어링 팀을 위한 명확하고 실행 가능한 계획을 제공하는 것입니다. 당신의 분석은 3GPP 표준(TS 36/38.xxx 시리즈)과 운영 모범 사례에 부합해야 하며, 엄격하고 증거에 기반해야 합니다.

[컨텍스트 및 가정]
- 분석 대상은 두 기간 동안의 PEG(Performance Event Group) 카운터 변화입니다.
- 기간 n-1: {n1_range}
- 기간 n: {n_range}
- 핵심 가정: 두 기간은 동일한 시험환경(동일 하드웨어, 기본 파라미터, 트래픽 모델)에서 수행되었습니다.
- 입력 데이터는 PEG 단위로 집계된 평균값이며, 개별 셀(cell) 데이터는 포함되어 있지 않습니다. 따라서 셀 단위의 특정 문제 식별은 불가능하며, 집계 데이터 기반의 거시적 분석을 수행해야 합니다.

[입력 데이터]
- 컬럼 설명: peg_name(PEG 이름), avg_n_minus_1(기간 n-1 평균), avg_n(기간 n 평균), diff(변화량), pct_change(변화율)
- 데이터 테이블:
{data_preview}

[분석 워크플로우 지침]
아래의 4단계 연쇄적 사고(Chain-of-Thought) 진단 워크플로우를 엄격히 따라서 분석을 수행하십시오.

# 1단계: 문제 분류 및 중요도 평가 (Triage and Significance Assessment)
먼저, 입력 테이블의 모든 PEG를 검토하여 가장 심각한 '부정적' 변화를 보인 상위 3~5개의 PEG를 식별하십시오. '중요도'는 'pct_change'의 절대값 크기와 해당 PEG의 운영상 '고객 영향도'를 종합하여 판단합니다. 각 PEG가 영향을 미치는 3GPP 서비스 범주(Accessibility, Retainability, Mobility, Integrity, Latency)에 따라 영향도를 분류하고, 가장 시급하게 다루어야 할 문제를 선정하십시오.

# 2단계: 주제별 그룹화 및 핵심 가설 생성 (Thematic Grouping and Primary Hypothesis Generation)
1단계에서 식별된 우선순위가 높은 문제들에 대해, 연관된 PEG들을 논리적으로 그룹화하여 '진단 주제(Diagnostic Theme)'를 정의하십시오. (예: 다수의 접속 관련 PEG 악화 -> 'Accessibility Degradation' 주제). 각 주제에 대해, 3GPP 호 처리 절차(Call Flow) 및 운영 경험에 기반하여 가장 개연성 높은 단일 '핵심 가설(Primary Hypothesis)'을 수립하십시오. 이 가설은 구체적이고 검증 가능해야 합니다.

# 3단계: 시스템적 요인 분석 및 교란 변수 고려 (Systemic Factor Analysis & Confounding Variable Assessment)
수립한 핵심 가설을 검증하기 위해, 전체 데이터 테이블에서 가설을 뒷받침하거나(supporting evidence) 반박하는(contradictory evidence) 다른 PEG 변화를 분석하십시오. 또한, '동일 환경' 가정이 깨질 수 있는 잠재적 교란 요인(예: 라우팅 정책 변경, 소프트웨어 마이너 패치, 특정 파라미터 롤백, 단말기 믹스 변화)을 명시적으로 고려하고, 이러한 요인들이 현재 문제의 원인일 가능성이 높은지 낮은지, 그리고 그 판단의 근거는 무엇인지 논리적으로 기술하십시오.

# 4단계: 증거 기반의 검증 계획 수립 (Formulation of an Evidence-Based Verification Plan)
각 핵심 가설에 대해, 현장 엔지니어가 즉시 수행할 수 있는 구체적이고 우선순위가 부여된 '검증 계획'을 수립하십시오. 조치는 반드시 구체적이어야 합니다. (예: '로그 확인' 대신 '특정 카운터(pmRachAtt) 추이 분석'). 조치별로 P1(즉시 조치), P2(심층 조사), P3(정기 감사)와 같은 우선순위를 부여하고, 필요한 데이터(카운터, 파라미터 등)나 도구를 명시하십시오.

[출력 형식 제약]
- 분석 결과는 반드시 아래의 JSON 스키마를 정확히 준수하여 생성해야 합니다.
- 모든 문자열 값은 한국어로 작성하십시오.
- 각 필드에 대한 설명과 열거형(Enum) 값을 반드시 따르십시오.


{{
  "executive_summary": "네트워크 상태 변화와 식별된 가장 치명적인 문제에 대한 1-2 문장의 최상위 요약.",
  "diagnostic_findings": [
    {{
      "primary_hypothesis": "가장 가능성 높은 단일 근본 원인 가설.",
      "supporting_evidence": "데이터 테이블 내에서 가설을 뒷받침하는 다른 PEG 변화나 논리적 근거.",
      "confounding_factors_assessment": "교란 변수들의 가능성에 대한 평가 및 그 근거."
    }}
  ],
  "recommended_actions": [
    {{
      "priority": "P1|P2|P3",
      "action": "구체적 실행 항목",
      "details": "필요 데이터/도구 및 수행 방법"
    }}
  ]
}}
"""
    logging.info("create_llm_analysis_prompt_enhanced() 완료")
    return prompt


# --- LLM 프롬프트 생성 (특정 PEG 전용 분석) ---
def create_llm_analysis_prompt_specific_pegs(processed_df_subset: pd.DataFrame, selected_pegs: list[str], n1_range: str, n_range: str) -> str:
    """
    선택된 PEG 집합에 한정된 분석 프롬프트를 생성합니다.

    기대 출력(JSON):
    {
      "summary": "특정 PEG 집합에 대한 최상위 요약",
      "peg_insights": {"PEG_A": "설명", ...},
      "prioritized_actions": [{"priority": "P1|P2|P3", "action": "...", "details": "..."}]
    }
    """
    logging.info("create_llm_analysis_prompt_specific_pegs() 호출: 선택 PEG=%s, 행수=%d", selected_pegs, len(processed_df_subset))
    data_preview = processed_df_subset.to_string(index=False)

    prompt = f"""
[페르소나 및 임무]
당신은 Tier-1 이동통신사의 수석 네트워크 최적화 전문가입니다. 아래 표는 지정된 PEG 집합에 대해서만, 두 기간(n-1, n)의 평균값/변화량/변화율을 정리한 것입니다. 지정된 PEG에 '한정하여' 분석하십시오.

[컨텍스트]
- 대상 PEG: {', '.join(selected_pegs)}
- 기간 n-1: {n1_range}
- 기간 n: {n_range}
- 표 컬럼: peg_name, avg_n_minus_1, avg_n, diff, pct_change

[데이터 표]
{data_preview}

[분석 지침]
- 각 PEG 별 핵심 관찰/의미/가능한 원인 가설을 간결히 기술하십시오.
- 변화율의 방향/크기를 근거로 운영 영향도와 위험도를 평가하십시오.
- 즉시 실행 가능한 조치 항목을 우선순위(P1/P2/P3)로 제시하십시오.

[출력 형식(JSON)]
{{
  "summary": "특정 PEG 집합에 대한 최상위 요약 (한국어)",
  "peg_insights": {{"PEG_NAME": "해당 PEG에 대한 한국어 통찰/설명"}},
  "prioritized_actions": [
    {{"priority": "P1|P2|P3", "action": "구체 조치", "details": "필요 데이터/도구/수행 방법"}}
  ]
}}
"""
    logging.info("create_llm_analysis_prompt_specific_pegs() 완료")
    return prompt

# --- 테스트용 가상 LLM 응답 생성 ---
def generate_mock_llm_response(processed_df: pd.DataFrame, is_test_mode: bool = False) -> dict:
    """
    테스트 모드에서 사용할 가상 LLM 응답을 생성합니다.
    실제 LLM 서버가 없을 때 사용됩니다.
    """
    logging.info("generate_mock_llm_response() 호출: 가상 LLM 응답 생성 (test_mode=%s)", is_test_mode)
    
    # 가장 변화율이 큰 PEG 찾기
    if not processed_df.empty and 'pct_change' in processed_df.columns:
        top_changes = processed_df.nlargest(3, 'pct_change', keep='all')
        top_peg = top_changes.iloc[0] if len(top_changes) > 0 else None
    else:
        top_peg = None
    
    mock_response = {
        "executive_summary": f"테스트 분석 결과: {len(processed_df)}개의 PEG 분석 완료. " + 
                           (f"주요 변화는 {top_peg['peg_name']} ({top_peg['pct_change']:.1f}% 변화)입니다." if top_peg is not None else "데이터가 부족합니다."),
        "diagnostic_findings": [
            {
                "primary_hypothesis": "테스트 모드에서 생성된 가상 가설입니다. 실제 분석에서는 실제 네트워크 상황에 맞는 가설이 제시됩니다.",
                "supporting_evidence": f"분석된 {len(processed_df)}개 PEG 중 일부에서 변화가 관찰되었습니다.",
                "confounding_factors_assessment": "테스트 환경에서는 실제 교란 요인 분석이 제한적입니다."
            }
        ],
        "recommended_actions": [
            {
                "priority": "P1",
                "action": "테스트 데이터 검증",
                "details": "실제 운영 환경에서 분석을 재실행하여 결과를 검증해주세요."
            },
            {
                "priority": "P2", 
                "action": "LLM 서버 연결 확인",
                "details": "실제 LLM 분석을 위해 LLM 서버 연결 상태를 확인해주세요."
            }
        ]
    }
    
    logging.info("가상 LLM 응답 생성 완료: findings=%d, actions=%d", 
                len(mock_response['diagnostic_findings']), 
                len(mock_response['recommended_actions']))
    
    return mock_response


# --- LLM API 호출 함수 (subprocess + curl) ---
def query_llm(prompt: str, enable_mock: bool = False) -> dict:
    """내부 vLLM 서버로 분석 요청. 응답 본문에서 JSON만 추출.
    실패 시 다음 엔드포인트로 페일오버.
    
    Args:
        prompt: LLM에게 보낼 프롬프트
        enable_mock: True면 LLM 서버 연결 실패 시 가상 응답 반환
    """
    # 장애 대비를 위해 복수 엔드포인트로 페일오버. 응답에서 JSON 블록만 추출
    logging.info("query_llm() 호출: vLLM 분석 요청 시작 (enable_mock=%s)", enable_mock)

    # 환경 변수에서 LLM 엔드포인트 목록을 읽어옴 (쉼표로 구분)
    llm_endpoints_str = os.getenv('LLM_ENDPOINTS', 'http://10.251.204.93:10000,http://100.105.188.117:8888')
    endpoints = [endpoint.strip() for endpoint in llm_endpoints_str.split(',') if endpoint.strip()]

    if not endpoints:
        raise ValueError("LLM_ENDPOINTS 환경 변수가 설정되지 않았거나 비어있습니다.")

    # 환경 변수에서 모델명 읽기 (기본값: Gemma-3-27B)
    llm_model = os.getenv('LLM_MODEL', 'Gemma-3-27B')

    payload = {
        "model": llm_model,
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
    
    # 모든 엔드포인트 실패 시 mock 모드 처리
    if enable_mock:
        logging.warning("모든 LLM API 엔드포인트 연결 실패. Mock 모드로 가상 응답 생성합니다.")
        # processed_df는 없으므로 기본적인 mock 응답 생성
        return {
            "executive_summary": "LLM 서버 연결 실패로 인한 테스트 응답입니다.",
            "diagnostic_findings": [
                {
                    "primary_hypothesis": "LLM 서버에 연결할 수 없어 가상 분석을 제공합니다.",
                    "supporting_evidence": "네트워크 연결 또는 LLM 서버 상태를 확인해주세요.",
                    "confounding_factors_assessment": "실제 분석을 위해서는 LLM 서버 연결이 필요합니다."
                }
            ],
            "recommended_actions": [
                {
                    "priority": "P1",
                    "action": "LLM 서버 연결 상태 점검",
                    "details": "vLLM 서버가 정상 동작하는지 확인하고 네트워크 연결을 점검해주세요."
                }
            ]
        }
    else:
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

    # 요약: 새 스키마(executive_summary) 우선, 구 스키마(overall_summary, comprehensive_summary) 폴백
    summary_text = (
        llm_analysis.get('executive_summary')
        or llm_analysis.get('overall_summary')
        or llm_analysis.get('comprehensive_summary', 'N/A')
    )
    summary_html = str(summary_text).replace('\n', '<br>')

    # 진단 결과: 새 스키마(diagnostic_findings: list[dict]) 우선, 구 스키마(key_findings: list[str]) 폴백
    findings_html = ''
    diagnostic_findings = llm_analysis.get('diagnostic_findings')
    if isinstance(diagnostic_findings, list) and diagnostic_findings and isinstance(diagnostic_findings[0], dict):
        items = []
        for i, d in enumerate(diagnostic_findings, 1):
            ph = d.get('primary_hypothesis', '').strip()
            se = d.get('supporting_evidence', '').strip()
            cf = d.get('confounding_factors_assessment', '').strip()
            item_html = (
                f"<li><div><strong>가설 {i}:</strong> {html.escape(ph)}</div>"
                f"<div class='muted'>증거: {html.escape(se)}</div>"
                f"<div class='muted'>교란 변수 평가: {html.escape(cf)}</div></li>"
            )
            items.append(item_html)
        findings_html = ''.join(items)
    else:
        findings_html = ''.join([f'<li>{html.escape(str(item))}</li>' for item in llm_analysis.get('key_findings', [])])

    # 권장 조치: 새 스키마(recommended_actions: list[dict])와 구 스키마(list[str]) 지원
    actions_html = ''
    rec_actions = llm_analysis.get('recommended_actions', [])
    if isinstance(rec_actions, list) and rec_actions and isinstance(rec_actions[0], dict):
        parts = []
        for a in rec_actions:
            pr = a.get('priority', '').strip()
            ac = a.get('action', '').strip()
            dt = a.get('details', '').strip()
            parts.append(
                f"<li><div><strong>{html.escape(pr or 'P?')}</strong> - {html.escape(ac)}</div>"
                f"<div class='muted'>{html.escape(dt)}</div></li>"
            )
        actions_html = ''.join(parts)
    else:
        actions_html = ''.join([f'<li>{html.escape(str(item))}</li>' for item in rec_actions])

    # 특정 PEG 분석(신규) 우선 표시, 없으면 구 스키마로 폴백
    detailed_html = ''
    spec = llm_analysis.get('specific_peg_analysis') if isinstance(llm_analysis, dict) else None
    if isinstance(spec, dict) and (spec.get('summary') or spec.get('peg_insights') or spec.get('prioritized_actions')):
        sel_list = spec.get('selected_pegs') or []
        sel_html = ', '.join([html.escape(str(x)) for x in sel_list]) if sel_list else ''
        summary_text = str(spec.get('summary', '')).replace('\n', '<br>')

        peg_insights = spec.get('peg_insights') or {}
        peg_parts = []
        for peg, insight in peg_insights.items():
            peg_parts.append(
                f"<div class='peg-analysis-box'><h3>{html.escape(str(peg))}</h3><div class='muted'>{html.escape(str(insight))}</div></div>"
            )
        peg_html = ''.join(peg_parts)

        pr_actions = spec.get('prioritized_actions') or []
        pr_list_html = ''
        if isinstance(pr_actions, list):
            items = []
            for a in pr_actions:
                pr = html.escape(str(a.get('priority', 'P?')))
                ac = html.escape(str(a.get('action', '')))
                dt = html.escape(str(a.get('details', '')))
                items.append(f"<li><strong>{pr}</strong> - {ac}<div class='muted'>{dt}</div></li>")
            pr_list_html = '<ul>' + ''.join(items) + '</ul>' if items else ''

        detailed_html = (
            (f"<div class='section card'><h2>선택 PEG</h2><div class='muted'>{sel_html or 'N/A'}</div></div>" if sel_html else '') +
            f"<div class='section card'><h2>요약</h2><div class='muted'>{summary_text or 'N/A'}</div></div>" +
            (f"<div class='section card'><h2>PEG별 인사이트</h2>{peg_html}</div>" if peg_html else '') +
            (f"<div class='section card list'><h2>우선순위 조치</h2>{pr_list_html}</div>" if pr_list_html else '')
        )
    else:
        # 구 스키마 호환: 셀 상세 분석 맵 표시
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

    # 로깅: 상세 섹션 건수를 안전하게 계산
    detailed_cells_count = 0
    try:
        # specific 우선
        spec = llm_analysis.get('specific_peg_analysis') if isinstance(llm_analysis, dict) else None
        if isinstance(spec, dict) and spec.get('peg_insights'):
            detailed_cells_count = len(spec.get('peg_insights') or {})
        else:
            legacy_map = llm_analysis.get('cells_with_significant_change') or llm_analysis.get('detailed_cell_analysis') or {}
            if isinstance(legacy_map, dict):
                detailed_cells_count = len(legacy_map)
    except Exception:
        detailed_cells_count = 0

    logging.info(
        "리포트 구성요소: findings=%d, actions=%d, detailed_cells=%d, charts=%d",
        len(llm_analysis.get('key_findings', [])),
        len(llm_analysis.get('recommended_actions', [])),
        detailed_cells_count,
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
                    <button role="tab" aria-selected="false" onclick="openTab(event, 'detailed')">특정 peg 분석</button>
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
    
    def _sanitize_for_json(value):
        """NaN/Infinity 및 넘파이 수치를 JSON 호환으로 정규화한다."""
        try:
            # dict/list 재귀 처리
            if isinstance(value, dict):
                return {k: _sanitize_for_json(v) for k, v in value.items()}
            if isinstance(value, list):
                return [_sanitize_for_json(v) for v in value]
            # 수치형: 넘파이 포함을 float()로 흡수
            if isinstance(value, (int, float)):
                return value if math.isfinite(float(value)) else None
            # 기타 타입: 넘파이 스칼라 등은 float() 시도
            try:
                f = float(value)  # numpy.float64 등
                return f if math.isfinite(f) else None
            except Exception:
                return value
        except Exception:
            return value
    
    safe_payload = _sanitize_for_json(payload)
    
    try:
        # allow_nan=False 보장 직렬화 후 전송 (서버와 규격 일치)
        json_text = json.dumps(safe_payload, ensure_ascii=False, allow_nan=False)
        try:
            parsed_preview = json.loads(json_text)
        except Exception:
            parsed_preview = safe_payload
        logging.info("PAYLOAD %s", json.dumps({
            "url": url,
            "method": "POST",
            "payload": parsed_preview,
        }, ensure_ascii=False, indent=2))
        resp = requests.post(url, data=json_text.encode('utf-8'), headers={'Content-Type': 'application/json; charset=utf-8'}, timeout=timeout)
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
      - ne: 문자열 또는 배열. 예: "nvgnb#10000" 또는 ["nvgnb#10000","nvgnb#20000"]
      - cellid|cell: 문자열(쉼표 구분) 또는 배열. 예: "2010,2011" 또는 [2010,2011]
        → 제공 시 DB 집계에서 해당 조건으로 필터링하여 PEG 평균을 계산
      - preference: 쉼표 구분 문자열 또는 배열. 정확한 peg_name만 인식하여 '특정 peg 분석' 대상 선정
      - selected_pegs: 배열. 명시적 선택 목록이 있으면 우선 사용
      - peg_definitions: {파생PEG이름: 수식 문자열}. 예: {"telus_RACH_Success": "A/B*100"}
        수식 지원: 숫자, 변수(peg_name), +, -, *, /, (), 단항 +/-. 0 나눗셈은 NaN 처리
        적용 시점: N-1, N 각각의 집계 결과에 대해 계산 후 원본과 병합 → 전체 처리/분석에 포함
    """
    logging.info("=" * 20 + " Cell 성능 분석 로직 실행 시작 " + "=" * 20)
    try:
        # 파라미터 파싱
        n1_text = request.get('n_minus_1') or request.get('n1')
        n_text = request.get('n')
        if not n1_text or not n_text:
            raise ValueError("'n_minus_1'와 'n' 시간 범위를 모두 제공해야 합니다.")

        output_dir = request.get('output_dir', os.path.abspath('./analysis_output'))
        # 기본 백엔드 업로드 URL: 요청값 > 환경변수 > 로컬 기본값
        backend_url = request.get('backend_url') or os.getenv('BACKEND_ANALYSIS_URL') or 'http://localhost:8000/api/analysis-result'

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
            # 선택적 입력 필터 수집: ne, cellid
            # request 예시: { "ne": "nvgnb#10000" } 또는 { "ne": ["nvgnb#10000","nvgnb#20000"], "cellid": "2010,2011" }
            ne_raw = request.get('ne')
            cell_raw = request.get('cellid') or request.get('cell')

            def to_list(raw):
                if raw is None:
                    return []
                if isinstance(raw, str):
                    return [t.strip() for t in raw.split(',') if t.strip()]
                if isinstance(raw, list):
                    return [str(t).strip() for t in raw if str(t).strip()]
                return [str(raw).strip()]

            ne_filters = to_list(ne_raw)
            cellid_filters = to_list(cell_raw)

            logging.info("입력 필터: ne=%s, cellid=%s", ne_filters, cellid_filters)

            n1_df = fetch_cell_averages_for_period(conn, table, columns, n1_start, n1_end, "N-1", ne_filters=ne_filters, cellid_filters=cellid_filters)
            n_df = fetch_cell_averages_for_period(conn, table, columns, n_start, n_end, "N", ne_filters=ne_filters, cellid_filters=cellid_filters)
        finally:
            conn.close()
            logging.info("DB 연결 종료")

        logging.info("집계 결과 크기: n-1=%d행, n=%d행", len(n1_df), len(n_df))
        if len(n1_df) == 0 or len(n_df) == 0:
            logging.warning("한쪽 기간 데이터가 비어있음: 분석 신뢰도가 낮아질 수 있음")

        # 파생 PEG 정의 처리 (사용자 정의 수식)
        # 입력 예: "peg_definitions": {"telus_RACH_Success": "Random_access_preamble_count/Random_access_response*100"}
        derived_defs = request.get('peg_definitions') or {}
        derived_n1 = compute_derived_pegs_for_period(n1_df, derived_defs, "N-1") if derived_defs else pd.DataFrame(columns=["peg_name","avg_value","period"])
        derived_n  = compute_derived_pegs_for_period(n_df, derived_defs, "N") if derived_defs else pd.DataFrame(columns=["peg_name","avg_value","period"])

        if not derived_n1.empty or not derived_n.empty:
            n1_df = pd.concat([n1_df, derived_n1], ignore_index=True)
            n_df = pd.concat([n_df, derived_n], ignore_index=True)
            logging.info("파생 PEG 병합 완료: n-1=%d행, n=%d행", len(n1_df), len(n_df))

        # 처리 & 시각화 (파생 포함)
        processed_df, charts_base64 = process_and_visualize(n1_df, n_df)
        logging.info("처리 완료: processed_df=%d행, charts=%d", len(processed_df), len(charts_base64))

        # LLM 프롬프트 & 분석 (테스트 모드 감지)
        test_mode = request.get('test_mode', False) or request.get('enable_mock', False)
        prompt = create_llm_analysis_prompt_enhanced(processed_df, n1_text, n_text)
        logging.info("프롬프트 길이: %d자, test_mode=%s", len(prompt), test_mode)
        
        try:
            llm_analysis = query_llm(prompt, enable_mock=test_mode)
            logging.info("LLM 결과 키: %s", list(llm_analysis.keys()) if isinstance(llm_analysis, dict) else type(llm_analysis))
        except ConnectionError as e:
            if test_mode:
                logging.warning("LLM 연결 실패하지만 test_mode이므로 가상 응답 생성: %s", e)
                llm_analysis = generate_mock_llm_response(processed_df, is_test_mode=True)
            else:
                raise

        # '특정 peg 분석' 처리: preference / peg_definitions / selected_pegs
        try:
            selected_pegs: list[str] = []
            # 1) 명시적 선택 목록
            explicit_list = request.get('selected_pegs')
            if isinstance(explicit_list, list):
                selected_pegs.extend([str(x) for x in explicit_list])

            # 2) preference 기반 선택 (정확한 peg_name로만 해석)
            pref = request.get('preference')
            if isinstance(pref, str):
                pref_tokens = [t.strip() for t in pref.split(',') if t.strip()]
            elif isinstance(pref, list):
                pref_tokens = [str(t).strip() for t in pref if str(t).strip()]
            else:
                pref_tokens = []

            if pref_tokens:
                valid_names_set = set(processed_df['peg_name'].astype(str).tolist())
                for token in pref_tokens:
                    if token in valid_names_set:
                        selected_pegs.append(token)

            # 유니크 + 순서 유지 + 실데이터 존재 필터링
            unique_selected = []
            seen = set()
            valid_names = set(processed_df['peg_name'].astype(str).tolist())
            for name in selected_pegs:
                if name in valid_names and name not in seen:
                    unique_selected.append(name)
                    seen.add(name)

            logging.info("특정 PEG 선택 결과: %d개", len(unique_selected))

            if unique_selected:
                subset_df = processed_df[processed_df['peg_name'].isin(unique_selected)].copy()
                # LLM에 보낼 수 있는 행수/토큰 보호를 위해 상한을 둘 수 있음(예: 500행). 필요 시 조정
                max_rows = int(request.get('specific_max_rows', 500))
                if len(subset_df) > max_rows:
                    logging.warning("선택 PEG 서브셋이 %d행으로 큼. 상한 %d행으로 절단", len(subset_df), max_rows)
                    subset_df = subset_df.head(max_rows)

                sp_prompt = create_llm_analysis_prompt_specific_pegs(subset_df, unique_selected, n1_text, n_text)
                logging.info("특정 PEG 프롬프트 길이: %d자, 선택 PEG=%d개", len(sp_prompt), len(unique_selected))
                
                try:
                    sp_result = query_llm(sp_prompt, enable_mock=test_mode)
                except ConnectionError as e:
                    if test_mode:
                        logging.warning("특정 PEG LLM 연결 실패하지만 test_mode이므로 가상 응답 생성: %s", e)
                        sp_result = {
                            "summary": f"테스트 모드: {len(unique_selected)}개 선택 PEG에 대한 가상 분석 결과입니다.",
                            "peg_insights": {peg: f"{peg}에 대한 테스트 분석 결과" for peg in unique_selected[:5]},  # 최대 5개만
                            "prioritized_actions": [
                                {
                                    "priority": "P1",
                                    "action": f"선택된 PEG {len(unique_selected)}개에 대한 상세 검토",
                                    "details": "실제 운영 환경에서 재분석 필요"
                                }
                            ]
                        }
                    else:
                        raise
                
                if isinstance(llm_analysis, dict):
                    llm_analysis['specific_peg_analysis'] = {
                        "selected_pegs": unique_selected,
                        **(sp_result if isinstance(sp_result, dict) else {"summary": str(sp_result)})
                    }
                logging.info("특정 PEG 분석 완료: keys=%s", list((llm_analysis.get('specific_peg_analysis') or {}).keys()))
        except Exception as e:
            logging.exception("특정 PEG 분석 처리 중 오류: %s", e)

        # HTML 리포트 작성
        report_path = generate_multitab_html_report(llm_analysis, charts_base64, output_dir, processed_df)
        logging.info("리포트 경로: %s", report_path)

        # 백엔드 POST payload 구성 - 원본 PostgreSQL 스키마 정보 포함
        # 원본 스키마: id(int), datetime(ts), value(double), version(text), 
        # family_name(text), cellid(text), peg_name(text), host(text), ne(text)
        result_payload = {
            "status": "success",
            "n_minus_1": n1_text,
            "n": n_text,
            "analysis": llm_analysis,
            "stats": processed_df.to_dict(orient='records'),
            "chart_overall_base64": charts_base64.get("overall"),
            "report_path": report_path,
            "assumption_same_environment": True,
            # 원본 스키마 정보 추가 - Frontend validation 오류 해결
            "source_metadata": {
                "db_config": db,
                "table": table,
                "columns": columns,
                "time_ranges": {
                    "n_minus_1": {"start": n1_start.isoformat(), "end": n1_end.isoformat()},
                    "n": {"start": n_start.isoformat(), "end": n_end.isoformat()}
                },
                "filters": {
                    "ne_filters": ne_filters,
                    "cellid_filters": cellid_filters
                },
                # 대표 ne_id, cell_id - 필터링된 첫 번째 값 또는 "ALL"
                "ne_id": ne_filters[0] if ne_filters else "ALL",
                "cell_id": cellid_filters[0] if cellid_filters else "ALL",
                # 원본 스키마 정보 명시
                "schema_info": {
                    "id": "auto_increment_integer",
                    "datetime": "timestamp",
                    "value": "double_precision",
                    "version": "text",
                    "family_name": "text", 
                    "cellid": "text",
                    "peg_name": "text",
                    "host": "text",
                    "ne": "text"
                }
            }
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
    import sys
    
    # CLI 모드 지원: Backend에서 subprocess로 호출 시 사용
    if len(sys.argv) > 2 and sys.argv[1] == "--request":
        try:
            request_json = sys.argv[2]
            request_data = json.loads(request_json)
            
            logging.info("CLI 모드로 LLM 분석을 실행합니다.")
            logging.info("요청 데이터: %s", json.dumps(request_data, ensure_ascii=False, indent=2))
            
            # 분석 실행
            result = _analyze_cell_performance_logic(request_data)
            
            # JSON 결과 출력 (Backend에서 capture)
            print(json.dumps(result, ensure_ascii=False))
            
            # 성공 종료
            sys.exit(0)
            
        except Exception as e:
            logging.exception("CLI 모드 실행 중 오류 발생: %s", e)
            error_result = {
                "status": "error",
                "message": f"CLI 모드 실행 오류: {str(e)}"
            }
            print(json.dumps(error_result, ensure_ascii=False))
            sys.exit(1)
    else:
        logging.info("stdio 모드로 MCP를 실행합니다.")
        mcp.run(transport="stdio")