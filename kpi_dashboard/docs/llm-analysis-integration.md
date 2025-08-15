# LLM 분석 통합 기능 가이드

## 📋 **개요**

KPI Dashboard에 LLM 기반 분석 기능이 통합되었습니다. 이 기능을 통해 PostgreSQL의 통계 데이터를 LLM으로 분석하고, 결과를 MongoDB에 저장하여 Frontend에서 조회할 수 있습니다.

## 🏗️ **아키텍처**

```
PostgreSQL (통계 데이터) → MCP (analysis_llm.py) → Backend (FastAPI) → MongoDB → Frontend (React)
```

### **주요 구성요소**

1. **MCP (Model Context Protocol)**: `analysis_llm.py` - 별도 환경에서 실행
2. **Backend**: FastAPI 라우터 - LLM 분석 API 제공
3. **MongoDB**: 분석 결과 저장소
4. **Frontend**: React 컴포넌트 - 결과 조회 및 관리

## 🔧 **구현된 기능**

### **1. Backend API 엔드포인트**

#### **분석 요청 API**
```http
POST /api/analysis/trigger-llm-analysis
Content-Type: application/json

{
    "db_config": {
        "host": "postgresql.example.com",
        "port": 5432,
        "database": "kpi_database",
        "username": "admin",
        "password": "password123"
    },
    "n_minus_1": "2024-01-01",
    "n": "2024-01-31",
    "enable_mock": true
}
```

**응답:**
```json
{
    "status": "triggered",
    "analysis_id": "ff321396-97eb-4b3d-abd6-d43e7315682f",
    "message": "LLM 분석이 시작되었습니다. 잠시 후 결과를 확인할 수 있습니다."
}
```

#### **결과 조회 API**
```http
GET /api/analysis/llm-analysis/{analysis_id}
```

**응답:**
```json
{
    "analysis_id": "ff321396-97eb-4b3d-abd6-d43e7315682f",
    "analysis_type": "llm_analysis",
    "status": "completed",
    "analysisDate": "2025-08-15T04:45:49.290000",
    "neId": "MOCK_NE_001",
    "cellId": "MOCK_CELL_001",
    "results": [...],
    "request_params": {...},
    "completed_at": "2025-08-15T04:45:49.291000"
}
```

### **2. MongoDB 데이터 구조**

```javascript
// collection: analysis_results
{
    "_id": ObjectId,
    "analysis_id": "uuid-string",
    "analysis_type": "llm_analysis",
    "status": "completed",
    "analysis_date": "2025-08-15T...",
    "request_params": {
        "db_config": {...},
        "n_minus_1": "2024-01-01",
        "n": "2024-01-31",
        "enable_mock": true
    },
    "results": [{
        "status": "success",
        "message": "Mock LLM 분석 결과",
        "analysis_date": "...",
        "mock_data": true
    }],
    "completed_at": "2025-08-15T...",
    "ne_id": "MOCK_NE_001",      // 원본 PostgreSQL 스키마 정보
    "cell_id": "MOCK_CELL_001",  // 원본 PostgreSQL 스키마 정보
    "source_metadata": {
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
```

### **3. Frontend 통합**

#### **"분석 결과" 메뉴**
- 기존 KPI 분석과 LLM 분석을 통합 조회
- `analysis_type` 필터로 구분 가능
- 원본 스키마 정보(`ne_id`, `cell_id`) 표시

#### **"LLM 분석" 메뉴**
- LLM 분석 전용 인터페이스
- 분석 요청 및 상태 확인
- 상세 결과 조회

## ⚙️ **설정 및 배포**

### **필수 의존성**

**Backend (`requirements.txt`):**
```txt
psycopg2-binary  # PostgreSQL 연결
matplotlib       # 차트 생성
```

**Frontend (`package.json`):**
- 기존 React 의존성 유지
- 새로운 의존성 없음

### **Docker 설정**

```bash
# Backend 빌드
docker-compose build backend --no-cache

# 전체 서비스 시작
docker-compose up -d

# 서비스 상태 확인
docker-compose ps
```

### **환경 변수**

Backend 컨테이너에서 MongoDB 연결 설정:
```bash
MONGO_URL=mongodb://mongo:27017/analysis_db
```

## 🧪 **테스트 방법**

### **1. Backend API 테스트**

```powershell
# LLM 분석 요청
$body = '{"db_config": {"host": "postgresql.example.com", "port": 5432, "database": "kpi_database", "username": "admin", "password": "password123"}, "n_minus_1": "2024-01-01", "n": "2024-01-31", "enable_mock": true}'

$response = Invoke-RestMethod -Uri "http://localhost:8000/api/analysis/trigger-llm-analysis" -Method POST -Body $body -ContentType "application/json"

# 결과 조회
$result = Invoke-RestMethod -Uri "http://localhost:8000/api/analysis/llm-analysis/$($response.analysis_id)" -Method GET
```

### **2. Frontend 테스트**

1. 브라우저에서 `http://localhost:5173` 접속
2. "분석 결과" 메뉴에서 LLM 분석 결과 확인
3. "LLM 분석" 메뉴에서 새로운 분석 요청

## 🔍 **데이터 흐름**

### **전체 프로세스**

1. **사용자 요청**: Frontend → Backend API
2. **분석 처리**: Backend → (향후) MCP analysis_llm.py 호출
3. **결과 저장**: Backend → MongoDB
4. **결과 조회**: Frontend ← Backend ← MongoDB

### **원본 스키마 정보 포함**

PostgreSQL 원본 스키마의 모든 컬럼 정보가 분석 결과와 함께 저장됩니다:

- `id(int)`: 자동 증가 정수
- `datetime(ts)`: 타임스탬프  
- `value(double)`: 실수값
- `version(text)`: 버전 정보
- `family_name(text)`: 패밀리명
- `cellid(text)`: 셀 ID
- `peg_name(text)`: PEG 이름
- `host(text)`: 호스트 정보
- `ne(text)`: NE 정보

## ⚠️ **현재 제한사항**

1. **Mock 데이터**: 현재 실제 MCP 연동 대신 Mock 데이터 반환
2. **MCP 통신**: HTTP API 방식으로 MCP와 통신하는 구조 필요
3. **실시간 분석**: 현재는 백그라운드 처리 후 조회 방식

## 🔄 **향후 개선 사항**

1. **실제 MCP 연동**: HTTP API 또는 Message Queue 방식
2. **실시간 상태 업데이트**: WebSocket 또는 Server-Sent Events
3. **분석 결과 시각화**: 차트 및 대시보드 강화
4. **알림 시스템**: 분석 완료 알림 기능

## 📞 **문의 및 지원**

구현 관련 문의사항이나 개선 제안이 있으시면 개발팀에 연락해주세요.

---

*문서 작성일: 2025-08-15*  
*최종 업데이트: 2025-08-15*

