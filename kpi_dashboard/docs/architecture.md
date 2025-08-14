# Architecture & Data Flow

## System Architecture
```mermaid
graph LR
  A["User Browser"] --> B["Frontend (React + Vite)"]
  B --> C["API Client (axios)"]
  C --> D["Backend (FastAPI)"]
  D --> E[("DB (Persistence): MongoDB")]
  subgraph Analysis
    F["MCP Server: analysis_llm.py"]
    G["LLM Endpoints (vLLM)"]
  end
  F -- "POST /api/analysis-result" --> D
  F -- "Read/Write Files" --> H["HTML Reports"]
  F -- "Call" --> G
```

- Persistence DB: 분석결과/환경설정 영구 저장(필수). 환경변수 `MONGO_URL`, `MONGO_DB_NAME`
- Query DB: 통계 조회 대상(선택). 현 버전에서는 `/api/kpi/query`가 mock 생성기를 사용하며, 추후 실제 프록시 통합 가능

## KPI Data Flow (Dashboard/Statistics)
```mermaid
sequenceDiagram
  participant U as "User"
  participant FE as "Frontend (React)"
  participant BE as "Backend (FastAPI)"
  participant DB as "Query DB (PostgreSQL)"

  U->>FE: Select KPIs / Date Range / NE / CellID
  FE->>BE: POST /api/kpi/query (per KPI, with kpi_peg_names/like, ne/cellid)
  BE->>DB: Aggregate by hour (or generate mock on failure)
  DB-->>BE: Rows
  BE-->>FE: { data: KPIData[], source }
  FE->>U: Render per-KPI averaged time-series
```

## Analysis Flow (N-1 vs N)
```mermaid
sequenceDiagram
  participant Tool as "MCP Tool (analysis_llm.py)"
  participant DB as "Query DB (PostgreSQL)"
  participant LLM as "vLLM API"
  participant HTML as "HTML Reports"
  participant BE as "FastAPI"

  Tool->>DB: Fetch averages (N-1 / N)
  Tool->>Tool: Merge + diff/pct_change + charts
  Tool->>LLM: Prompt with processed table
  LLM-->>Tool: JSON analysis
  Tool->>HTML: Generate multi-tab report
  Tool->>BE: POST /api/analysis-result (JSON)
```

## Key Endpoints
- POST `/api/kpi/query`: 시간 단위 평균(mock). 필터 파라미터 수집만 수행
- POST `/api/kpi/statistics/batch`: 다중 KPI mock
- POST `/api/db/ping`: DB 연결 테스트
- POST `/api/master/ne-list`, `/api/master/cellid-list`: 자동완성용 DISTINCT 조회
- Preferences: `GET/POST/PUT/DELETE /api/preferences`, `GET/PUT /api/preferences/{id}/derived-pegs`
