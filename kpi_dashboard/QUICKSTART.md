# 3GPP KPI Dashboard Quick Start

## 1. Prerequisites
- Python 3.11+
- Node.js 18+ (npm 포함) 또는 pnpm
- Windows PowerShell 기준 명령 예시 (macOS/Linux는 해당 쉘 명령으로 치환)

## 2. Backend (FastAPI)
1) 의존성 설치 및 가상환경 권장
```powershell
cd kpi_dashboard/backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -U pip
.\.venv\Scripts\pip install -r requirements.txt
```

2) 환경 변수 설정 (.env 사용 권장)
```powershell
# .env 파일 사용 (권장) — kpi_dashboard/backend/.env 생성
# 저장용 DB (필수): MongoDB 연결 정보
MONGO_URL=mongodb://mongo:27017
MONGO_DB_NAME=kpi

# (선택) 분석기/프록시용 Postgres 접속 정보는 analysis_llm.py 사용 시에만 필요
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=postgres
# DB_PASSWORD=postgres
# DB_NAME=postgres
```

- 백엔드는 `.env`를 자동 로드합니다(`python-dotenv`).
- 현재 백엔드는 MongoDB를 사용합니다(`MONGO_URL`, `MONGO_DB_NAME`). `/api/kpi/*`는 기본 mock 데이터 생성기로 동작합니다.

3) 서버 기동
```powershell
.\.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000
```
- 헬스체크: http://localhost:8000/ → {"message":"3GPP KPI Management API"}

4) (선택) DB 연결 테스트 (MongoDB)
```powershell
curl -X POST "http://localhost:8000/api/db/ping" -H "Content-Type: application/json" -d '{"mongo_url": "mongodb://localhost:27017"}'
```

## 2-1. Docker Compose로 빠르게 실행하기
```powershell
cd D:\Coding\0809
# (선택) .env 작성: MONGO_URL, MONGO_DB_NAME, VITE_API_BASE_URL
docker compose up -d --build
```
- 백엔드: http://localhost:8000
- 프론트엔드: http://localhost:5173

## 3. Frontend (React + Vite)
1) 의존성 설치 (npm 또는 pnpm 중 택1)
```powershell
cd kpi_dashboard/frontend
# npm 사용
npm install --no-fund --no-audit

# (선택) pnpm 사용 시
# pnpm install
```

2) API 베이스 URL 설정(필요 시)
```powershell
# kpi_dashboard/frontend/.env.local
VITE_API_BASE_URL=http://localhost:8000
```

3) 개발 서버 실행
```powershell
npm run dev -- --host
# 또는 pnpm run dev --host
```
- 접속: http://localhost:5173

## 4. 기본 사용 흐름
- Dashboard: Preference의 defaultKPIs/defaultNEs/defaultCellIDs를 사용해 KPI 카드/필터가 동적으로 반영됩니다.
- Summary Report: 최근 분석결과가 있으면 우선 표시, 없으면 mock.
- Statistics: 기간/KPI/NE/CellID 입력 후 Search → 시간축 기준 KPI 평균 시계열.
- Advanced Chart: 기간1/기간2, 듀얼축, 임계값, 엔티티 입력 후 Generate → 비교/이중축 차트.

## 5. 빠른 API 테스트 예시
- 시간 통계 (mock)
```powershell
curl "http://localhost:8000/api/kpi/statistics?start_date=2025-08-06&end_date=2025-08-07&kpi_type=availability&entity_ids=LHK078ML1,LHK078MR1&interval_minutes=60"
```
- 배치 통계 (mock)
```powershell
curl -X POST "http://localhost:8000/api/kpi/statistics/batch" -H "Content-Type: application/json" -d "{
  \"start_date\": \"2025-08-06\",
  \"end_date\": \"2025-08-07\",
  \"kpi_types\": [\"availability\", \"rrc\"],
  \"entity_ids\": \"LHK078ML1,LHK078MR1\",
  \"interval_minutes\": 60
}"
```
- 자동완성 (NE/cellid)
```powershell
curl -X POST "http://localhost:8000/api/master/ne-list" -H "Content-Type: application/json" -d "{\"db\":{\"host\":\"localhost\",\"port\":5432,\"user\":\"postgres\",\"password\":\"postgres\",\"dbname\":\"postgres\"},\"table\":\"summary\",\"columns\":{\"ne\":\"ne\",\"time\":\"datetime\"},\"q\":\"nvgnb#\",\"limit\":20}"
```

## 6. Preference 예시 (UI에서 생성 후 "Set as Active Preference")
```json
{
  "defaultKPIs": ["availability", "rrc", "erab"],
  "defaultNEs": ["nvgnb#10000", "nvgnb#20000"],
  "defaultCellIDs": ["2010", "2011"],
  "availableKPIs": [
    { "value": "availability", "label": "Availability (%)", "threshold": 99.0 },
    { "value": "rrc", "label": "RRC Success Rate (%)", "threshold": 98.5 },
    { "value": "erab", "label": "ERAB Success Rate (%)", "threshold": 99.0 }
  ]
}
```

## 7. End-to-End 테스트 (백엔드 서버 기동 상태 필요)
```powershell
cd kpi_dashboard/backend
.\.venv\Scripts\python -m kpi_dashboard.backend.test_end_to_end
```
- 모든 테스트가 통과하면 콘솔에 [TEST] ALL PASSED 출력

## 8. 문제 해결 팁
- 포트 충돌: 백엔드(8000)/프론트(5173) 사용 포트가 점유된 경우 포트 변경 실행
- 프론트 설치 실패: npm 사용 시 --legacy-peer-deps로 재시도
- 로그 확인: 백엔드(INFO)와 프론트 콘솔 로그로 요청/응답 및 건수 확인
- 백엔드 기동 실패: `.env`의 DB 설정 누락 여부 확인. 최소 `MONGO_URL`, `MONGO_DB_NAME`이 필요합니다. (KPI 조회용 Postgres는 선택 사항)
