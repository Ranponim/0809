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

2) 빠른 실행용 SQLite 설정(권장) 또는 PostgreSQL DSN 설정
```powershell
# SQLite (가장 간단)
$env:ANALYSIS_DB_URL = 'sqlite:///analysis.db'

# 또는 PostgreSQL (예시)
# $env:ANALYSIS_DB_URL = 'postgresql+psycopg2://postgres:postgres@localhost:5432/postgres'
```

3) 서버 기동
```powershell
.\.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000
```
- 헬스체크: http://localhost:8000/ → {"message":"3GPP KPI Management API"}

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
