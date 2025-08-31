# Architecture & Data Flow

## System Architecture
```mermaid
graph LR
  A["User Browser"] --> B["Frontend (React + Vite)"]
  B --> C["API Client (axios)"]
  C --> D["Backend (FastAPI)"]
  D --> E(("PostgreSQL: Raw KPI Data"))
  D --> F(("MongoDB: Backend Storage"))
  subgraph Analysis
    G["MCP Server: analysis_llm.py (optional)"]
    H["LLM Endpoints (vLLM)"]
  end
  G -- "HTTP POST (analyze)" --> D
  G -- "Read/Write Files" --> I["HTML Reports"]
  G -- "Call" --> H
```

- **PostgreSQL (Raw KPI Data)**: 실시간 KPI/PEG 데이터 저장 및 조회. 환경변수: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **MongoDB (Backend Storage)**: 분석결과/사용자설정/통계결과 영구 저장. 환경변수: `MONGO_URL`, `MONGO_DB_NAME`
- **Preference**: `user_preferences.database_settings`에 PostgreSQL 연결 설정 저장
- **LLM 호출**: `MCP_ANALYZER_URL` 설정 시 실제 호출, 미설정/실패 시 Mock 폴백

## KPI Data Flow (Dashboard/Statistics)
```mermaid
sequenceDiagram
  participant U as "User"
  participant FE as "Frontend (React)"
  participant BE as "Backend (FastAPI)"
  participant PG as "PostgreSQL (Raw KPI Data)"
  participant MG as "MongoDB (Backend Storage)"

  U->>FE: Select KPIs / Date Range / NE / CellID
  FE->>BE: POST /api/statistics/compare
  BE->>MG: Load DB config from user_preferences
  BE->>PG: Query KPI data by loaded config
  PG-->>BE: KPI Data Rows
  BE->>MG: Save analysis results
  BE-->>FE: { data, summary }
  FE->>U: Render comparisons
```

## LLM Analysis Flow (N-1 vs N)
```mermaid
sequenceDiagram
  participant FE as "Frontend"
  participant BE as "FastAPI"
  participant MG as "MongoDB (Backend Storage)"
  participant PG as "PostgreSQL (Raw KPI Data)"
  participant MCP as "MCP Analyzer"

  FE->>BE: POST /api/analysis/trigger-llm-analysis { user_id, n_minus_1, n }
  BE->>MG: Load DB config from user_preferences
  BE->>PG: Query KPI data using loaded config
  alt MCP URL set & reachable
    BE->>MCP: HTTP analyze with KPI data
    MCP-->>BE: JSON analysis result
  else Mock fallback
    BE->>BE: Generate mock result
  end
  BE->>MG: Save analysis_results & metadata
  FE->>BE: GET /api/analysis/llm-analysis/{id}
  BE->>MG: Retrieve analysis result
  BE-->>FE: Analysis result with source_metadata
```

## Key Endpoints (excerpt)
- **POST `/api/analysis/trigger-llm-analysis`**: MongoDB에서 사용자 설정 로드 → PostgreSQL에서 KPI 데이터 조회 → MCP 분석 실행 → MongoDB에 결과 저장
- **GET `/api/analysis/llm-analysis/{id}`**: MongoDB에서 분석 결과 조회 (KPI 데이터는 PostgreSQL에서 실시간 조회)
- **GET `/api/analysis/results`**: 분석 결과 목록 조회 (페이지네이션, 필터링 지원)
- **DELETE `/api/analysis/results/{id}`**: 분석 결과 삭제
- **POST `/api/statistics/compare`**: MongoDB에서 설정 로드 → PostgreSQL에서 KPI 비교 분석 → MongoDB에 결과 저장
- **Preferences**: `GET/PUT /api/preference/settings?user_id=...` (PostgreSQL 연결 설정을 MongoDB에 저장)

## Frontend Component Architecture

#### 분석결과 메뉴 컴포넌트 구조
```
ResultsList (메인 목록)
├── useAnalysisResults (커스텀 훅)
├── ResultFilter (필터링)
├── ResultDetail (상세보기 모달)
│   ├── 마할라노비스 거리 분석
│   ├── PEG 비교 분석
│   ├── Mann-Whitney U Test
│   ├── Kolmogorov-Smirnov Test
│   └── Choi 알고리즘 판정
└── AnalysisResultsViewer (범용 뷰어)
```

#### 주요 컴포넌트 특징
- **ResultsList.jsx**: 목록 표시, 정렬, 선택, 삭제 기능
- **ResultDetail.jsx**: 고급 알고리즘 분석 결과 표시, 메모리 최적화
- **ResultFilter.jsx**: 다중 필터링, 빠른 날짜 선택
- **AnalysisResultsViewer.jsx**: 범용 결과 표시 (statistics/llm/trend)

## Database Architecture
```mermaid
graph TD
  A["PostgreSQL (Raw KPI Data)"] --> B["Real-time KPI Queries"]
  A --> C["Statistics Analysis"]
  A --> D["LLM Analysis Input"]

  E["MongoDB (Backend Storage)"] --> F["Analysis Results"]
  E --> G["User Preferences"]
  E --> H["Statistics Results"]
  E --> I["System Metadata"]
```

*문서 업데이트: 2025-01-14 (PostgreSQL+KPI + MongoDB+Storage 구조 반영)*
