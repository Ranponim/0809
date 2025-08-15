# Architecture & Data Flow

## System Architecture
```mermaid
graph LR
  A["User Browser"] --> B["Frontend (React + Vite)"]
  B --> C["API Client (axios)"]
  C --> D["Backend (FastAPI)"]
  D --> E(("MongoDB: Persistence"))
  subgraph Analysis
    F["MCP Server: analysis_llm.py (optional)"]
    G["LLM Endpoints (vLLM)"]
  end
  F -- "HTTP POST (analyze)" --> D
  F -- "Read/Write Files" --> H["HTML Reports"]
  F -- "Call" --> G
```

- Persistence DB: 분석결과/환경설정 영구 저장. `MONGO_URL`, `MONGO_DB_NAME`
- Preference: `user_preferences.database_settings`에 PostgreSQL 설정(host/port/user/password/dbname/table)
- LLM 호출: `MCP_ANALYZER_URL` 설정 시 실제 호출, 미설정/실패 시 Mock 폴백

## KPI Data Flow (Dashboard/Statistics)
```mermaid
sequenceDiagram
  participant U as "User"
  participant FE as "Frontend (React)"
  participant BE as "Backend (FastAPI)"
  participant DB as "Query DB (PostgreSQL via Preference)"

  U->>FE: Select KPIs / Date Range / NE / CellID
  FE->>BE: POST /api/statistics/compare
  BE->>DB: Query by Preference.database_settings
  DB-->>BE: Rows/Aggregations
  BE-->>FE: { data, summary }
  FE->>U: Render comparisons
```

## LLM Analysis Flow (N-1 vs N)
```mermaid
sequenceDiagram
  participant FE as "Frontend"
  participant BE as "FastAPI"
  participant Pref as "Preference.database_settings"
  participant MCP as "MCP Analyzer"
  participant MDB as "MongoDB"

  FE->>BE: POST /api/analysis/trigger-llm-analysis { user_id, n_minus_1, n }
  BE->>Pref: Load DB config by user_id (merge with request if provided)
  alt MCP URL set & reachable
    BE->>MCP: HTTP analyze with effective DB config
    MCP-->>BE: JSON analysis
  else Mock fallback
    BE->>BE: Generate mock result
  end
  BE->>MDB: Save analysis_results
  FE->>BE: GET /api/analysis/llm-analysis/{id}
  BE-->>FE: Analysis result (includes source_metadata)
```

## Key Endpoints (excerpt)
- POST `/api/analysis/trigger-llm-analysis`: Preference 기반 DB 설정 자동 주입, MCP 우선/Mock 폴백
- GET `/api/analysis/llm-analysis/{id}`: 단건 결과 조회
- Preferences: `GET/PUT /api/preference/settings?user_id=...` (databaseSettings 포함)
