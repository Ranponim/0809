## Cell 성능 LLM 분석기 (MCP 기반)

### 개요
`analysis_llm.py`는 두 기간(n-1, n)의 시간 범위를 입력받아 PostgreSQL에서 PEG 단위 평균을 집계하고, 결과를 병합·시각화한 뒤 LLM으로 종합 분석하는 MCP 서버입니다. 분석 결과는 멀티 탭 HTML 리포트로 저장되며, 필요 시 FastAPI 등 백엔드로 JSON을 POST 전송합니다.

### 주요 기능
- **시간 범위 입력**: `yyyy-mm-dd_hh:mm~yyyy-mm-dd_hh:mm` 또는 단일 날짜 `yyyy-mm-dd` 지원
- **시간대 처리**: 기본 `+09:00`(KST), 환경변수 `DEFAULT_TZ_OFFSET`로 오버라이드 가능(예: `+00:00`)
- **PostgreSQL 집계**: 기간별 `AVG(value)`를 `peg_name`으로 그룹화
- **비교/지표 산출**: `diff`, `pct_change` 산출 및 막대 그래프 이미지 생성(Base64)
- **LLM 분석**: 내부 vLLM 엔드포인트 페일오버 호출 → JSON 요약/핵심 관찰/권장 조치/주요 셀 분석 생성
- **HTML 리포트**: 요약/상세/차트/테이블 탭 UI, PNG 다운로드, CSV 내보내기
- **백엔드 전송(옵션)**: 분석 JSON을 지정 URL로 POST

---

## 설치
```bash
python -m pip install -r requirements.txt
```

### 요구 사항
- Python 3.10+
- PostgreSQL 접근 권한(읽기)

### 의존 패키지
- `pandas`, `matplotlib`, `psycopg2-binary`, `requests`, `fastmcp`

---

## 환경 변수
- `DEFAULT_TZ_OFFSET`: 기본 시간대 오프셋(예: `+09:00`). 잘못되면 UTC로 폴백
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: DB 접속 정보의 폴백 값

LLM 엔드포인트/모델은 코드 내부 `query_llm()`에 하드코딩되어 있습니다. 필요 시 해당 함수의 `endpoints`/`payload["model"]`를 수정하세요.

---

## 실행 방법
### 1) MCP 서버 실행
```bash
python analysis_llm.py
```
표준 입출력(stdio) 기반 MCP 서버가 시작됩니다.

### 2) MCP 클라이언트에서 툴 호출
툴 이름: `analyze_cell_performance_with_llm`

요청 예시(JSON):
```json
{
  "n_minus_1": "2025-07-01_00:00~2025-07-01_23:59",
  "n": "2025-07-02_00:00~2025-07-02_23:59",
  "output_dir": "./analysis_output",
  "backend_url": "http://localhost:8000/api/analysis-result",
  "db": {"host": "127.0.0.1", "port": 5432, "user": "postgres", "password": "pass", "dbname": "netperf"},
  "table": "summary",
  "columns": {"time": "datetime", "peg_name": "peg_name", "value": "value", "ne": "ne", "cellid": "cellid"},
  "preference": "Random_access_preamble_count,Random_access_response",
  "peg_definitions": {
    "telus_RACH_Success": "Random_access_preamble_count/Random_access_response*100"
  }
}
```
- `columns`에서 `peg_name` 대신 `peg` 키를 제공해도 됩니다. 내부에서는 `peg` → `peg_name` 우선순위로 해석합니다.
 - `ne`/`cellid` 컬럼 이름을 `columns`에 지정할 수 있습니다(기본값: `ne`, `cellid`).
 - `preference`: 쉼표 구분 목록 또는 배열. 정확히 일치하는 `peg_name`만 특정 분석 대상에 포함됩니다.
 - `peg_definitions`(옵션): `{파생PEG이름: 수식}` 형식으로 파생 PEG를 정의합니다. 예: `{ "telus_RACH_Success": "A/B*100" }`
   - 지원 수식: 숫자, 변수(peg_name), +, -, *, /, (), 단항 +/-. 함수/제곱(**)은 미지원
   - 0으로 나누면 NaN 처리됩니다.
 - `selected_pegs`(옵션): 특정 분석 대상 PEG를 직접 배열로 지정할 수 있습니다.

응답 예시(요약):
```json
{
  "status": "success",
  "message": "분석 완료. 리포트: ./analysis_output/Cell_Analysis_Report_YYYY-MM-DD_HH-MM.html",
  "report_path": "./analysis_output/Cell_Analysis_Report_YYYY-MM-DD_HH-MM.html",
  "backend_response": null,
  "analysis": {
    "overall_summary": "...",
    "key_findings": ["..."],
    "recommended_actions": ["..."],
    "cells_with_significant_change": {"CELL_A": "..."},
    "specific_peg_analysis": {
      "selected_pegs": ["Random_access_preamble_count", "telus_RACH_Success"],
      "summary": "...",
      "peg_insights": {"telus_RACH_Success": "..."},
      "prioritized_actions": [{"priority": "P1", "action": "...", "details": "..."}]
    }
  },
  "stats": [
    {"peg_name": "...", "avg_n_minus_1": 0.0, "avg_n": 0.0, "diff": 0.0, "pct_change": 0.0}
  ]
}
```

예시 요청 파일: `examples/request.sample.json`

---

## 처리 파이프라인 개요
1. 시간 범위 파싱: `parse_time_range()` — 단일 날짜 입력 시 00:00~23:59:59로 확장, TZ 적용
2. DB 연결: `get_db_connection()` — 환경 변수 폴백 사용, 민감정보 로그 미기록
3. 기간별 집계: `fetch_cell_averages_for_period()` — `AVG(value)` by `peg_name`
4. 병합/지표/차트: `process_and_visualize()` — `diff`, `pct_change`, 전체 비교 막대그래프(Base64)
5. LLM 분석: `create_llm_analysis_prompt_overall()` → `query_llm()` — JSON 형식 분석 산출
6. HTML 출력: `generate_multitab_html_report()` — 요약/상세/차트/테이블 탭 UI, PNG/CSV 다운로드 제공
7. 백엔드 전송(옵션): `post_results_to_backend()` — 응답 JSON 파싱 시도, 실패 시 텍스트 반환

### 특정 PEG 분석 동작
- 입력에 `preference` 또는 `selected_pegs`가 제공되면, 해당 PEG들만 모아 별도의 LLM 분석을 수행하고 결과를 `analysis.specific_peg_analysis`에 포함합니다.
- HTML 리포트의 두 번째 탭 라벨이 "특정 peg 분석"으로 표시되며, 여기에 이 결과가 렌더링됩니다. 폴백으로 과거 스키마(`cells_with_significant_change`)도 지원합니다.

### NE/Cell 필터링
- 입력에 `ne`와 `cellid`를 제공하면, DB 집계 시 해당 조건으로 필터링합니다.
  - 예1) `{ "ne": "nvgnb#10000" }` → 해당 NE의 모든 셀에 대한 PEG 평균
  - 예2) `{ "ne": "nvgnb#10000", "cellid": "2010,2011" }` → 해당 NE의 셀 2010/2011에 대한 PEG 평균
  - 배열도 지원: `{ "ne": ["nvgnb#10000","nvgnb#20000"], "cellid": [2010,2011] }`

HTML 리포트 경로: `output_dir/Cell_Analysis_Report_YYYY-MM-DD_HH-MM.html`

---

## 백엔드 POST 사양(옵션)
- 전송 함수: `post_results_to_backend(url, payload)`
- 페이로드 주요 필드: `analysis`(LLM 결과), `stats`(표 처리 결과), `chart_overall_base64`(PNG), `report_path` 등

FastAPI 예시:
```python
from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/api/analysis-result")
async def receive(req: Request):
    data = await req.json()
    return {"ok": True, "keys": list(data.keys())}
```

---

## 로깅/오류 처리 정책
- 모든 주요 함수 진입/성공/실패를 `logging`으로 기록합니다.
- 네트워크/DB/LLM 오류는 세부 원인과 함께 로깅하며, 사용자 응답에는 안전한 메시지를 반환합니다.
- 비밀번호 등 민감정보는 로그에 남기지 않습니다.
- 예외 유형별로 `error` 응답을 구분하여 반환합니다.

로그 형식: `YYYY-MM-DD HH:MM:SS - LEVEL - message`

---

## 스키마/설정 참고
- 기본 테이블: `summary` (요청에서 `table`로 변경 가능)
- 기본 컬럼 매핑: `time`→`datetime`, `peg_name`→`peg_name`(또는 `peg`), `value`→`value`
- 원본 스키마 예시: `id, datetime, value, version, family_name, cellid, peg_name, host, ne`

---

## LLM 엔드포인트/모델 변경
`analysis_llm.py`의 `query_llm()`에서 다음을 수정하세요.
- `endpoints`: vLLM 서버 리스트
- `payload["model"]`: 사용 모델 ID (기본: `Gemma-3-27B`)

엔드포인트 다중 지정으로 자동 페일오버가 동작합니다. 응답 본문에서 JSON 영역만 추출하여 사용합니다.

---

## 라이선스/고지
본 프로젝트는 내부 네트워크 성능 분석 자동화를 위한 예시 구현입니다. 데이터/LLM 응답의 정확도는 입력 데이터 품질과 운영 환경에 따라 달라질 수 있습니다.



