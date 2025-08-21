---
title: LLM Max Token 이슈 해결 및 Payload 전략 PRD
owner: network-intelligence
createdAt: 2025-08-14
status: draft
tags: [llm, token, backend, payload, mongodb, fastapi]
---

## 1) 배경/문제 정의
- 현재 `analysis_llm.py` 실행 시 LLM에 전달되는 프롬프트가 커져서 "max token exceed" 오류가 발생한다.
- `analysis_llm_old.py`는 상대적으로 토큰 초과 이슈가 적었고, 이후 백엔드 POST payload 구조와 `_to_stats()` 변환 로직을 추가/변경한 버전이 `analysis_llm.py`이다.
- 의심 지점
  - LLM 입력 데이터(시계열/표)의 과다 포함 및 중복 정보, 선택 PEG 확장 시 행 수 증가
  - `_to_stats()`가 직접 토큰에 영향은 주지 않으나, 전체 데이터 파이프라인이 커지면서(프롬프트 구성/검증/로그 출력 등) 간접적 영향을 줄 가능성
  - 백엔드로 전송되는 payload 크기가 불필요하게 커져 네트워크/저장소/후처리에 부담

## 2) 목표
1. `analysis_llm.py`의 LLM 호출 경로 전반에서 토큰 초과가 발생하지 않도록 안정화
2. payload 전략(구버전 vs 신버전)을 백엔드 관점에서 성능/운영 효율 측면으로 비교하여 채택안 결정
3. 선택된 전략에 맞춰 `/api/analysis/results`(FastAPI/MongoDB) 스키마/라우팅 영향 최소화 계획 수립

## 3) 현행 흐름 요약 (AS-IS)
### 3.1 LLM 사이드 (`analysis_llm.py`)
- PostgreSQL에서 KPI 시계열/요약을 조회 → 전처리/필터링 → 차트 생성(Base64) → 프롬프트 구성 → LLM 호출
- LLM 결과, 차트, 요청 파라미터 등을 묶어 `result_payload`를 생성
- `result_payload` 예시 (요지)
  - camelCase alias 사용: `analysisType`, `analysisDate`, `neId`, `cellId`
  - `analysis`(LLM 결과/메타), `stats`(요약 목록), `request_params`(입력 컨텍스트), `report_path`
- `_to_stats(df, period)`는 컬럼(`peg_name`, `avg_value`) 기반으로 `{ period, kpi_name, avg }`만 추출하여 경량화된 통계 리스트를 생성

### 3.2 백엔드 사이드 (FastAPI + MongoDB)
- 라우터: `kpi_dashboard/backend/app/routers/analysis.py` (prefix: `/api/analysis/results`)
- 모델: `AnalysisResultCreate`, `AnalysisResultModel` 등. snake_case 저장을 기준으로 하되 Pydantic alias로 camelCase 입력 허용
- 현재도 레거시 호환 위해 `analysisDate/analysis_date`, `neId/ne_id` 등 양쪽 키를 조회/정규화

## 4) 문제 원인 분석 (Hypothesis)
- LLM 프롬프트 생성 단계에서 불필요한 컬럼/행/섹션이 포함되어 토큰 사용량 급증
- 선택 PEG 분석 시 상한(`specific_max_rows`)이 있으나 전체 프롬프트에 차트/메타/중복 텍스트가 누적
- `_to_stats()` 자체는 LLM 입력이 아니라 백엔드 payload 경량화를 위한 단계이나, 변환 과정 로깅/추가 계산이 간접 영향을 줄 수 있음

## 5) 제약/환경
- 모델/프로바이더: Google `gemini-2.5-flash` (provider: gemini-cli)
- 백엔드 저장소: MongoDB (문서 크기 16MB 제한 고려)
- API: FastAPI `/api/analysis/results` 및 LLM 트리거 `/api/analysis/trigger-llm-analysis`

## 6) 해결 전략 제안 (TO-BE)
### 6.1 LLM 토큰 안정화 전략
- Token-Aware Chunking
  - 프롬프트 빌드 전 단계에서 추정 토큰 수 계산(문자길이 기반 휴리스틱) → 임계 초과 시 자동 샘플링/축약
  - 시간축 리샘플링(예: 5분→30분), 상·하위 N% 제거, Top-K KPI/PEG만 선택
- 구조화 압축
  - 표 데이터를 “요약 통계 + 대표 구간(최댓/최솟/이상치 근처) 샘플”만 포함
  - 차트 Base64는 기본 1장(Overall)만 포함하고, 상세는 필요 시 링크/경로 제공
- 지시문/반복 텍스트 중복 제거 및 섹션 가중치 낮춤
  - 프롬프트 템플릿에서 고정 설명문 축약, 동일 메타 중복 제거
- 하드 가드레일
  - `max_rows_global`, `max_chars_prompt`, `max_selected_pegs` 등 전역 상한 설정
  - 초과 시 경고 로그 + 자동 축약 적용 후 호출

### 6.2 Payload 전략 대안 비교 (백엔드 관점)
| 대안 | 설명 | 장점 | 단점 | 적합 상황 |
|---|---|---|---|---|
| A. Passthrough Raw (구버전 스타일) | LLM/전처리 산출물을 거의 그대로 MongoDB에 저장 (`analysis_raw` 등) | 구현 단순, 디버깅 용이, 재처리/리플레이 쉬움 | 문서 비대화(16MB 위험), 인덱싱/쿼리 비용↑, 프론트에서 후처리 부담 | 실험/초기 탐색, 포렌식 선호 |
| B. Normalized Minimal (현행 `_to_stats` 중심) | `stats`/핵심 메타만 저장, LLM 원문은 축약본 | 저장/전송/조회 효율↑, 쿼리/지표용 적합 | 원문 손실 시 재현성↓, 추가 디버깅 정보 부족 | 운영/대시보드 지표 위주 |
| C. Hybrid (권장) | Raw는 축약/압축으로 보조 필드에 저장(`analysis_raw_compact`), 질의용 `stats_summary` 병행 | 운영 효율과 재현성 균형, 쿼리 성능 유지 | 스키마 약간 복잡 | 운영 + 포렌식 병행 |

권장: C. Hybrid
- MongoDB 문서 구조(권장):
  ```json
  {
    "analysis_date": ISODate,
    "ne_id": "...", "cell_id": "...",
    "status": "success|warning|error",
    "stats": [ {"period":"N-1","kpi_name":"...","avg":...}, ... ],
    "results_overview": { "summary": "...", "key_findings": [ ... ] },
    "analysis_raw_compact": { "top_k_segments": [...], "percentiles": {...}, "notes": "..." },
    "report_path": "...",
    "request_params": { ... },
    "metadata": { "version": "1.1", "processing_time": 3.21 }
  }
  ```
- 조회 API는 `stats`/`results_overview` 중심으로 경량 응답, 상세 Raw는 필요 시 별도 필드 선택/서브 경로로 제공

### 6.3 `/api/analysis/results` 영향
- 입력(`POST /api/analysis/results`)
  - `AnalysisResultCreate`는 그대로 사용하되, 선택 필드에 `results_overview`, `analysis_raw_compact` 추가(옵셔널)
  - Pydantic alias 유지(camelCase 입력 허용), 저장은 snake_case
- 목록(`GET /api/analysis/results`)
  - projection에 `results_overview` 포함, Raw 필드는 기본 제외
- 상세(`GET /api/analysis/results/{id}`)
  - 기본 응답은 개요 중심, 쿼리 파라미터 `?includeRaw=true`로 `analysis_raw_compact` 포함 옵션

## 7) 수락 기준 (Acceptance Criteria)
1. `analysis_llm.py`에서 동일 입력으로도 LLM 호출 시 토큰 초과가 재현되지 않는다.
2. 프롬프트 길이/추정 토큰/샘플링 적용 여부가 함수별 상세 로그로 남는다.
3. POST payload 크기가 1MB 이내(기본), 필요 시 4MB 이내 상한에서 경고 로그 출력.
4. `/api/analysis/results` 목록/상세 조회 성능: p95 응답 300ms 이내(로컬 Mongo, 10k 문서 기준).
5. 레거시 문서(camelCase 저장 포함)와의 호환성 유지.

## 8) 구현 계획 (High-level Tasks)
1) LLM 토큰 가드 추가 (analysis_llm.py)
   - 토큰/문자 수 추정 유틸 `estimate_prompt_tokens(text)`
   - `max_rows_global`, `max_chars_prompt`, `max_selected_pegs` 환경/설정 값 도입
   - 표/차트/설명 섹션별 축약기: Top-K, 리샘플링, 대표 구간 샘플러
   - 함수별 INFO/WARN 로그 추가(입력 행수, 축약 결과, 최종 길이)

2) Payload 하이브리드 스키마 반영
   - `AnalysisResultCreate`에 `results_overview`, `analysis_raw_compact`(Optional) 필드 추가
   - 라우터 목록 projection에 `results_overview` 포함, 상세는 `includeRaw` 처리
   - 저장 전 by_alias=False로 snake_case 일관성 유지

3) LLM 결과 매핑 정리
   - `_to_stats()`는 유지하되 평균 외 `count/std/min/max` 선택적 보강(가능 시)
   - `analysis` → `results_overview` 요약 생성기 추가(핵심 소견/경보만 발췌)
   - 원본은 압축본으로 `analysis_raw_compact`에 저장(상한 초과 시 부분 저장)

4) 회귀/성능 테스트
   - 동일 입력으로 old/new 경로 A/B 실행 → 토큰/시간/응답크기 비교 리포트
   - E2E: `/api/analysis/trigger-llm-analysis` → Mongo 저장 → 목록/상세 조회

## 9) 리스크/완화
- 과도한 축약으로 분석 품질 저하 → 상한 내 보존 우선순위 규칙(이상/경보 구간 먼저)
- Mongo 16MB 제한 → 문서 크기 체크 + 압축 저장 + 분할 저장(필요 시 별도 컬렉션)
- 레거시 문서 혼재 → 이중 키 조회 유지 기간 설정 후 마이그레이션 스크립트 준비

## 10) 모니터링/로그
- 함수 단위 로깅(입력 크기, 축약 규칙 적용 여부, 최종 프롬프트 길이/토큰 추정치)
- 백엔드 응답 크기/저장 문서 크기 측정 및 WARN 한계치 도입
- 오류 시 단계별 컨텍스트 로깅(프롬프트 일부, 상한 설정값, 샘플링 결과 요약)

## 11) 결정 포인트(선택 필요)
- Payload 전략: A(원본 위주) vs B(정규화) vs C(하이브리드)
- 기본 상한 값: `max_rows_global`, `max_chars_prompt`, `max_selected_pegs`, `max_raw_bytes`
- `analysis_raw_compact` 보관 기간/크기 제한 정책


