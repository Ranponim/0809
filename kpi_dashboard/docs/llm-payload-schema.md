## LLM Payload Strategy (Final)

- Strategy: Hybrid
  - Store compact raw analysis in `analysis_raw_compact`
  - Store operational summary in `results_overview`
  - Keep query-friendly `stats` for KPIs and keep `analysis` for backward compatibility

### MongoDB Document Shape (AnalysisResult)

```json
{
  "analysis_date": "2025-08-14T10:00:00Z",
  "ne_id": "eNB001",
  "cell_id": "CELL001",
  "status": "success",
  "report_path": "/reports/Cell_Analysis_Report_2025-08-14.html",
  "stats": [
    {"period": "N-1", "kpi_name": "RACH Success Rate", "avg": 97.8},
    {"period": "N",   "kpi_name": "RACH Success Rate", "avg": 98.5}
  ],
  "results_overview": {
    "summary": "Top issues and recommendations...",
    "key_findings": ["..."],
    "recommended_actions": ["..."]
  },
  "analysis_raw_compact": {
    "top_k_segments": ["..."],
    "percentiles": {"p50": 98.1, "p90": 99.2},
    "notes": "truncated..."
  },
  "analysis": {"summary": "legacy-compatible payload"},
  "request_params": {"db": {"host": "..."}, "filters": {"ne": ["..."], "cellid": ["..."]}},
  "metadata": {"version": "1.1", "processing_time": 3.21}
}
```

Notes:
- API accepts camelCase via alias (e.g., `analysisDate`, `neId`, `cellId`), stored as snake_case.
- `analysis_raw_compact` is optional and excluded from detail by default; include with `?includeRaw=true`.
- `results_overview` is small, intended for list/detail default views.

### FastAPI Models
- `AnalysisResultCreate`, `AnalysisResultModel` include:
  - `results_overview: Optional[Dict[str, Any]]` (alias: `resultsOverview`)
  - `analysis_raw_compact: Optional[Dict[str, Any]]` (alias: `analysisRawCompact`)

### Endpoints
- POST `/api/analysis/results`: accepts above schema (camelCase or snake_case).
- GET  `/api/analysis/results`: list view includes summary fields; raw compact excluded.
- GET  `/api/analysis/results/{id}`: add `?includeRaw=true` to include `analysis_raw_compact`.


