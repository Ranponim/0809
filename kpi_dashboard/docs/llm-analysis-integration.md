# LLM 분석 통합 기능 가이드

## 📋 **개요**

KPI Dashboard에 LLM 기반 분석 기능이 통합되었습니다. PostgreSQL 통계 데이터를 LLM으로 분석하고, 결과를 MongoDB에 저장하여 Frontend에서 조회합니다. 이제 서버가 사용자 Preference의 `databaseSettings`를 자동 주입하므로, 프론트는 `user_id`만 넘겨도 됩니다.

## 🏗️ **아키텍처**

```
PostgreSQL (통계 데이터) → MCP (analysis_llm.py) → Backend (FastAPI) → MongoDB → Frontend (React)
```

### **주요 구성요소**

1. **MCP (Model Context Protocol)**: `analysis_llm.py` - 별도 환경에서 실행 (HTTP API로 호출)
2. **Backend**: FastAPI 라우터 - LLM 분석 API 제공, Preference에서 DB 설정 자동 주입
3. **MongoDB**: 분석 결과 저장소 (analysis_results, user_preferences)
4. **Frontend**: React - 분석 트리거/결과 조회 UI

## 🔧 **구현된 기능**

### 1) Backend API 엔드포인트

#### 분석 요청 API
```http
POST /api/analysis/trigger-llm-analysis
Content-Type: application/json

{
  "user_id": "default",                 // 서버가 Preference에서 databaseSettings 자동 주입
  "n_minus_1": "2024-01-01_00:00~2024-01-01_23:59",
  "n": "2024-01-02_00:00~2024-01-02_23:59",
  "enable_mock": false,                  // false면 MCP 실제 호출 시도, 실패 시 Mock 폴백
  // 선택: 요청에서 db_config 제공 시 Preference 값 위에 덮어쓰기(병합)
  "db_config": {
    "host": "127.0.0.1", "port": 5432,
    "user": "postgres", "password": "secret",
    "dbname": "netperf", "table": "summary"
  }
}
```

응답 예시:
```json
{
  "status": "triggered",
  "analysis_id": "ff321396-97eb-4b3d-abd6-d43e7315682f",
  "message": "LLM 분석이 시작되었습니다. 잠시 후 결과를 확인할 수 있습니다."
}
```

#### 결과 조회 API
```http
GET /api/analysis/llm-analysis/{analysis_id}
```

응답 예시:
```json
{
  "analysis_id": "ff321396-97eb-4b3d-abd6-d43e7315682f",
  "analysis_type": "llm_analysis",
  "status": "completed",
  "analysisDate": "2025-08-15T04:45:49.290000",
  "neId": "MOCK_NE_001",
  "cellId": "MOCK_CELL_001",
  "results": [ ... ],
  "request_params": {
    "user_id": "default",
    "db_config": {"host":"127.0.0.1", "port":5432, ...},
    "n_minus_1": "2024-01-01_00:00~2024-01-01_23:59",
    "n": "2024-01-02_00:00~2024-01-02_23:59",
    "enable_mock": false
  },
  "completed_at": "2025-08-15T04:45:49.291000",
  "source_metadata": {
    "db_config": {"host":"127.0.0.1", ...},
    "time_ranges": {"n_minus_1": "...", "n": "..."}
  }
}
```

### 2) MongoDB 데이터 구조 (요약)

```js
// collection: analysis_results
{
  _id: ObjectId,
  analysis_id: string,
  analysis_type: "llm_analysis",
  status: "completed" | "error" | "processing",
  analysis_date: ISODate,
  request_params: {
    user_id: string,
    db_config: {...},
    n_minus_1: string,
    n: string,
    enable_mock: boolean
  },
  results: [ {...} ],
  completed_at: ISODate,
  ne_id: string,
  cell_id: string,
  source_metadata: {...}
}
```

### 3) Frontend 통합

- “분석 결과” 화면: LLM/일반 결과 통합 조회(정렬/필터/선택/상세)
- “LLM 분석” 화면: `user_id` 기반 트리거(Preference DB 설정 자동 주입), 폴링으로 완료 감지
- 상세 모달: 개요(analysis_date/host/version/ne/cellid/평균점수 등) + KPI(가중치 정렬, N-1/N 비교, 필터/페이지)

## ⚙️ **설정 및 배포**

### 필수 의존성

Backend (`requirements.txt` 일부):
```txt
pymongo
motor
psycopg2-binary  # PostgreSQL 연결
pandas
numpy
scipy
matplotlib
requests         # MCP HTTP 호출
```

Frontend: 기존 React 의존성 유지(추가 없음)

### Docker/환경 변수

Backend 컨테이너 환경 변수 예:
```bash
MONGO_URL=mongodb://mongo:27017/analysis_db
MCP_ANALYZER_URL=http://mcp-host:8001/analyze   # 실제 MCP 서버 엔드포인트
MCP_API_KEY=xxx                                  # 필요시
```

## 🧪 **테스트 방법**

### 1) Backend API 테스트 (PowerShell)
```powershell
# LLM 분석 요청 (Preference 기반)
$body = '{"user_id":"default", "n_minus_1":"2024-01-01_00:00~2024-01-01_23:59", "n":"2024-01-02_00:00~2024-01-02_23:59", "enable_mock": false}'
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/analysis/trigger-llm-analysis" -Method POST -Body $body -ContentType "application/json"

# 결과 조회
$result = Invoke-RestMethod -Uri "http://localhost:8000/api/analysis/llm-analysis/$($response.analysis_id)" -Method GET
```

### 2) Frontend 테스트
1. 브라우저에서 `http://localhost:5173` 접속
2. “분석 결과” → 결과 목록 확인 및 더블클릭 상세
3. “LLM 분석” → 기간 설정 후 분석 시작, 완료 시 상세 검증

## 🔍 **데이터 흐름**

1. Frontend → Backend: `user_id`와 기간 전달 (DB 설정은 서버가 Preference에서 주입)
2. Backend → MCP: `MCP_ANALYZER_URL` 설정 시 실제 호출, 실패/미설정 시 Mock 폴백
3. Backend → MongoDB: 결과 저장
4. Frontend ← Backend: 결과 조회 및 시각화

## ⚠️ **현재 제한사항**
- MCP 미설정/오류 시 Mock 폴백(자동)
- 실시간 상태는 폴링 기반(추후 SSE/WebSocket 가능)

## 🔄 **향후 개선**
- 실시간 스트리밍 업데이트(SSE/WebSocket)
- 권장사항/원인분석 자동 생성 강화
- 대량 KPI 성능 튜닝(서버/클라이언트)

*문서 업데이트: 2025-08-15*
