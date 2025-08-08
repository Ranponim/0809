## Cell 성능 LLM 분석기

### 개요
두 기간(n-1, n)의 시간 범위를 입력받아 PostgreSQL에서 셀 단위 평균을 집계하고, 전체 PEG 데이터를 통합하여 LLM으로 종합 분석합니다. 결과는 HTML 리포트로 생성되며, 옵션으로 백엔드(FastAPI 등)로 JSON을 POST 전송합니다.

### 주요 기능
- 시간 범위 입력: `yyyy-mm-dd_hh:mm~yyyy-mm-dd_hh:mm`
- PostgreSQL 집계: 기간별 `AVG(value)`를 `cell_name`으로 그룹화
- 통합 분석: PEG별이 아닌 전체 PEG 데이터를 통합한 셀 기준 종합 분석
- 동일 시험환경 가정: n-1과 n은 동일 환경에서 수행되었다고 가정
- 리포트/전송: HTML 생성 및 JSON 결과를 백엔드로 POST

## 설치
```bash
python -m pip install -r requirements.txt
```

### 요구 사항
- Python 3.10+
- PostgreSQL 접근 권한 (읽기)

## 구성
### 데이터베이스 설정
- 기본 테이블: `measurements`
- 기본 컬럼 매핑: `time`→`ts`, `cell`→`cell_name`, `value`→`kpi_value`
- 환경변수 폴백: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

## 사용 방법 (MCP 툴)
MCP 서버로 실행되며, MCP 클라이언트(예: Cursor)에서 툴 `analyze_cell_performance_with_llm`를 호출합니다.

### 요청 JSON 스키마
```json
{
  "n_minus_1": "yyyy-mm-dd_hh:mm~yyyy-mm-dd_hh:mm",
  "n": "yyyy-mm-dd_hh:mm~yyyy-mm-dd_hh:mm",
  "threshold": 30.0,
  "output_dir": "./analysis_output",
  "backend_url": "http://your-backend/api/analysis-result",
  "db": {"host": "127.0.0.1", "port": 5432, "user": "postgres", "password": "pass", "dbname": "netperf"},
  "table": "measurements",
  "columns": {"time": "ts", "cell": "cell_name", "value": "kpi_value"}
}
```

### 응답 JSON 스키마(요약)
```json
{
  "status": "success | error",
  "message": "...",
  "report_path": "./analysis_output/Cell_Analysis_Report_YYYY-MM-DD_HH-MM.html",
  "backend_response": {"...": "..."},
  "analysis": {
    "overall_summary": "...",
    "key_findings": ["..."],
    "recommended_actions": ["..."],
    "cells_with_significant_change": {"CELL_NAME": "..."}
  },
  "stats": [
    {"cell_name": "...", "N-1": 0.0, "N": 0.0, "rate(%)": 0.0, "anomaly": false}
  ]
}
```

### 예시 요청 파일
`examples/request.sample.json` 참고.

## 백엔드 POST 사양
분석 결과를 `backend_url`로 POST합니다(옵션). 페이로드는 위 응답 JSON의 핵심 필드를 포함합니다.

### 예시 FastAPI 엔드포인트
```python
from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/api/analysis-result")
async def receive(req: Request):
    data = await req.json()
    # TODO: 저장/알림/대시보드 반영 등
    return {"ok": True, "keys": list(data.keys())}
```

## HTML 리포트
- 섹션: 종합 요약, 핵심 관찰, 권장 조치, 셀 상세(가능 시), 전체 비교 차트(N-1 vs N)
- 출력 경로: `output_dir/Cell_Analysis_Report_YYYY-MM-DD_HH-MM.html`

## 로깅/오류 처리
- 함수별 INFO/ERROR 로그 출력
- DB/LLM/백엔드 실패 시 예외를 캐치하고 의미 있는 메시지로 반환
- 민감정보(패스워드)는 로그에 남기지 않음

## PRD
- 자세한 요구사항은 `./.taskmaster/docs/prd.txt` 참고


