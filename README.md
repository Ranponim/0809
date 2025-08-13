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
  
> 컨테이너 환경(권장 실행): Ubuntu 22.04, Python 3.12.4, uv 사전 설치, MCPO(dev deps) 사전 설치

## Docker 환경 (Ubuntu 22.04 + Python 3.12.4)

### 이미지 빌드
```bash
docker build -t mcpo-backend:py312-ubuntu22.04 .
```

### 실행 및 기본 검증
```bash
# 컨테이너 진입
docker run --rm -it mcpo-backend:py312-ubuntu22.04 bash

# Python/uv 확인
python --version        # 3.12.4
uv --version

# 앱 경로 및 파일 확인
ls -la /app/backend

# MCPO(dev deps) 설치 확인
cd /opt/mcpo
uv run python -c "import sys; print(sys.version)"
```

### 컨테이너 내 주요 경로
- 앱 소스: `/app/backend`
- MCPO 리포지토리: `/opt/mcpo` (빌드 시 `uv sync --dev` 완료)

### 프로젝트 의존성
- 루트의 `requirements.txt`가 존재하면 빌드 과정에서 자동 설치됩니다.

### (선택) 개발용 볼륨 마운트 실행
코드 변경을 즉시 반영하려면(재빌드 없이) 현재 디렉토리를 마운트하여 실행하세요.

```powershell
docker run --rm -it -v ${PWD}:/app/backend mcpo-backend:py312-ubuntu22.04 bash
```

### Compose 사용
```bash
# 빌드 + 실행
docker compose up -d --build

# 셸 진입
docker compose exec backend bash

# 종료 및 정리
docker compose down
```

### 이미지 이름
- `mcpo-backend:py312-ubuntu22.04`

### 문제 해결
- Docker Desktop이 실행 중인지 확인하세요. 미실행 시 PowerShell에서 다음을 실행:
  - `Start-Process -FilePath "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"`
- Windows에서 이미지 확인: `docker images | findstr mcpo-backend`
- Compose 경고(`version is obsolete`)는 `docker-compose.yml`에서 `version` 키 제거로 해소했습니다.


## 구성
### 데이터베이스 설정
- 기본 테이블: `measurements`
- 기본 컬럼 매핑: `time`→`datetime`, `cell`→`cellid`, `value`→`value`
- 환경변수 폴백: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

## 사용 방법 (MCP 툴)
MCP 서버로 실행되며, MCP 클라이언트(예: Cursor)에서 툴 `analyze_cell_performance_with_llm`를 호출합니다.

### 요청 JSON 스키마
```json
{
  "n_minus_1": "yyyy-mm-dd_hh:mm~yyyy-mm-dd_hh:mm",
  "n": "yyyy-mm-dd_hh:mm~yyyy-mm-dd_hh:mm",
  "output_dir": "./analysis_output",
  "backend_url": "http://your-backend/api/analysis-result",
  "db": {"host": "127.0.0.1", "port": 5432, "user": "postgres", "password": "pass", "dbname": "netperf"},
  "table": "measurements",
  "columns": {"time": "datetime", "cell": "cellid", "value": "value"}
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
    {"cell_name": "...", "N-1": 0.0, "N": 0.0, "rate(%)": 0.0}
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


## PEG 평균 비교 스크립트 (신규)

PRD 변경에 따라 `peg_name`별로 두 날짜(n-1, n)의 `value` 평균을 비교하는 단일 실행 스크립트를 추가했습니다.

- 입력: `YYYY-MM-DD YYYY-MM-DD` (순서대로 n-1, n)
- 설정: `output_dir / backend_url / db / table / columns`는 코드에 하드코딩됨
- DB 스키마(열): `id / host / ne / version / family_name / cellid / peg_name / datetime / value`
- 결과: peg_name별 평균 비교 CSV 및 간단 HTML 리포트 생성

### 실행 방법
```bash
python peg_name_avg_compare.py 2025-08-12 2025-08-13
```

### 출력
- CSV: `analysis_output/comparison_YYYY-MM-DD_YYYY-MM-DD.csv`
- HTML: `analysis_output/peg_avg_report_YYYY-MM-DD_YYYY-MM-DD.html`

> 변화 지표: `diff = avg_n - avg_n_minus_1`, `pct_change = diff / avg_n_minus_1 * 100` (분모 0/결측은 NaN 처리)


## 중요 변경점 (2025-08-13)

- 사용 방식 단순화: 설정값은 코드에 하드코딩하고, 입력은 오직 두 날짜(`n-1`, `n`)만 받습니다.
- 신규 스크립트 추가: `peg_name_avg_compare.py`
  - `peg_name`별 `value`의 일자 평균을 계산하여 n-1과 n을 비교(diff, pct_change)합니다.
  - 결과는 CSV/HTML로 저장됩니다.
- 기존 MCP 기반 통합 분석(`analysis_llm.py`)은 레거시로 유지되며, 이번 변경 사항의 기본 플로우는 `peg_name_avg_compare.py`를 사용합니다.

### 요청 스키마(입력)
- CLI 인자(2개, 순서 고정):
  1) `n-1` 날짜: `YYYY-MM-DD`
  2) `n` 날짜: `YYYY-MM-DD`

예)
```bash
python peg_name_avg_compare.py 2025-08-12 2025-08-13
```

### 하드코딩 설정(코드 내 고정)
- `output_dir`: 결과 파일 저장 경로 (기본 `./analysis_output`)
- `backend_url`: 현재 버전 미사용(향후 확장용)
- `db`: DB 접속 정보 `{host, port, user, password, dbname}`
- `table`: 조회 테이블명 (기본 `measurements`)
- `columns`: 
  - 스키마: `id / host / ne / version / family_name / cellid / peg_name / datetime / value`

### 데이터베이스 스키마(열/타입)
- `id`: integer
- `host`: character varying
- `ne`: character varying
- `version`: character varying
- `family_name`: character varying
- `cellid`: character varying
- `peg_name`: character varying
- `datetime`: timestamp without time zone
- `value`: double precision

### 처리/출력 스키마
- 처리 로직: 
  - 각 날짜에 대해 `DATE(datetime) = <날짜>` 조건으로 필터링
  - `peg_name` 그룹으로 `AVG(value)` 계산
  - 조인 후 지표 산출: 
    - `avg_n_minus_1`, `avg_n`, `diff = avg_n - avg_n_minus_1`,
    - `pct_change = (diff / avg_n_minus_1) * 100` (분모 0/결측은 NaN)
- CSV 컬럼: `peg_name, avg_n_minus_1, avg_n, diff, pct_change`
- HTML 리포트: 요약, 절대 diff 상위 N, 절대 pct_change 상위 N, 임계값 초과 항목 테이블

### 결과 파일
- CSV: `analysis_output/comparison_YYYY-MM-DD_YYYY-MM-DD.csv`
- HTML: `analysis_output/peg_avg_report_YYYY-MM-DD_YYYY-MM-DD.html`

### 로깅/오류 처리
- 함수별 INFO/ERROR 로그를 상세 출력(형식: `YYYY-MM-DD HH:MM:SS - LEVEL - [function] message`)
- 날짜 형식 오류, DB 연결/쿼리 실패, 데이터 없음, 분모 0 처리 등 상황별 메시지 기록

### 레거시/호환성 안내
- 이전 문서/예시(`examples/request.sample.json`, MCP `analyze_cell_performance_with_llm`)는 **레거시** 흐름입니다.
  - 레거시 경로는 시간 범위(`yyyy-mm-dd_hh:mm~yyyy-mm-dd_hh:mm`)와 외부 설정을 입력으로 받는 통합 분석용입니다.
  - 이번 변경(PRD)으로 기본 사용 경로는 단순화된 `peg_name_avg_compare.py` 입니다.

---


