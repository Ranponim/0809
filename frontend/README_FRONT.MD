## LLM Analysis Frontend

React + TypeScript 기반의 LLM 분석 결과/통계 대시보드입니다. FastAPI 백엔드의 결과와 통계를 조회하고, 사용자별 설정을 통해 원하는 메트릭 및 파생 통계를 그래프로 시각화합니다.

### 주요 기능
- 분석 결과 목록 조회: FastAPI `/results`와 연동하여 시험/분석 결과 표시
- 통계 탐색: `/stats/metrics`, `/stats/query`로 메트릭 목록 및 시계열 쿼리
- 그래프 시각화: ECharts 기반 다중 시리즈 오버레이, 줌/팬, 범례 토글, 데이터 줌 슬라이더
- 사용자별 설정: 기본 메트릭, 파생(2차) 통계 식, 차트 레이아웃 및 범위 설정 저장/불러오기
- 파생 통계(수식): `expr-eval`로 메트릭 조합 식을 계산하여 시계열 생성 (예: (precision*2*recall)/(precision+recall))

### 기술 스택
- UI: Mantine (AppShell, 컴포넌트, Notifications)
- 차트: ECharts
- 상태/데이터: React Query, Zustand
- 폼/검증: React Hook Form, Zod
- 번들러: Vite (React + TS)

## 요구 사항
- Node.js 18+ (권장: 20+)
- FastAPI 백엔드 엔드포인트 (CORS 허용 필요)

## 빠른 시작
```bash
# 의존성 설치
cd frontend
npm install

# 개발 서버 실행
# Vite dev server: http://localhost:5173
# 환경변수 VITE_API_URL이 없으면 동일 오리진으로 요청합니다.
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기 (로컬 정적 서버)
npm run preview
```

### 환경 변수
- VITE_API_URL: 백엔드(FastAPI) 베이스 URL. 예: `http://localhost:8000`
- 인증 토큰(옵션): `localStorage.setItem('authToken', '...')`로 설정 시 Authorization 헤더로 전송

`.env` 예시:
```bash
VITE_API_URL=http://localhost:8000
```

## 디렉터리 구조
```text
frontend/
  src/
    api/
      client.ts         # Axios 클라이언트 및 API 함수
      types.ts          # Zod 스키마와 타입 정의
    components/
      charts/
        EChartBase.tsx
        TimeSeriesChart.tsx
      common/
        DateRangePicker.tsx
    pages/
      Dashboard.tsx
      Results.tsx
      StatsExplorer.tsx
      Preferences.tsx
    stores/
      preferences.ts    # 사용자 설정(Zustand)
    utils/
      dates.ts          # 날짜 유틸 (범위, 포맷)
      derived.ts        # 파생 통계 계산 유틸(expr-eval)
    App.tsx             # AppShell 및 라우팅
    main.tsx            # Providers (Mantine, Router, Query)
```

## API 계약 (FastAPI)
프론트는 아래 엔드포인트를 호출합니다. 실제 스키마/쿼리는 백엔드 구현에 맞춰 확장 가능합니다.

- GET `/results`
  - Query: `userId?`, `from?`, `to?`, `limit?`, `offset?`
  - Response: `LLMAnalysisResult[]`

- GET `/stats/metrics`
  - Response: `{ metrics: string[] }`

- POST `/stats/query`
  - Body: `StatsQueryRequest`
  - Response: `StatsQueryResponse`

- GET `/users/me/preferences`
  - Response: `UserPreferences`

- PUT `/users/me/preferences`
  - Body: `UserPreferences`
  - Response: `UserPreferences`

### cURL 예시
```bash
# 메트릭 목록
curl "$VITE_API_URL/stats/metrics"

# 통계 쿼리
curl -X POST "$VITE_API_URL/stats/query" \
  -H 'Content-Type: application/json' \
  -d '{
    "metrics": ["latency_ms", "accuracy"],
    "from": "2025-01-01T00:00:00Z",
    "to": "2025-01-02T00:00:00Z",
    "interval": "1h",
    "aggregator": "avg"
  }'
```

## 데이터 모델 (발췌)
```ts
// src/api/types.ts
export type StatsPoint = {
  timestamp: string | number
  value: number | null
}

export type TimeSeries = {
  name: string
  points: StatsPoint[]
}

export type StatsQueryRequest = {
  metrics: string[]
  from: string | number
  to: string | number
  interval?: string // e.g. '1h'
  aggregator?: 'avg' | 'sum' | 'min' | 'max'
  userId?: string
  filters?: Record<string, unknown>
}

export type StatsQueryResponse = {
  series: TimeSeries[]
}

export type LLMAnalysisResult = {
  id: string
  userId: string
  createdAt: string | number
  model?: string
  prompt?: string
  response?: string
  score?: number
  metrics?: Record<string, number>
}

export type DerivedFormula = {
  id: string
  name: string
  expression: string
  variables: string[]
  color?: string
}

export type ChartSeriesConfig = {
  id: string
  label: string
  kind: 'metric' | 'formula'
  key: string
  color?: string
  yAxisIndex?: number
  smoothing?: boolean
}

export type ChartConfig = {
  id: string
  title: string
  series: ChartSeriesConfig[]
}

export type UserPreferences = {
  defaultMetrics: string[]
  derivedFormulas: DerivedFormula[]
  charts: ChartConfig[]
  dateRangeDays: number
}
```

## 사용법
### Results 페이지
- 최신 분석 결과 테이블 조회
- 컬럼: ID, User, Created, Model, Score

### Stats Explorer 페이지
- 메트릭 선택(MultiSelect), 집계간격/집계자 선택, 기간 선택 후 Query
- 그래프 상호작용: 마우스 휠/드래그 줌, 하단 슬라이더, 범례 클릭 토글, 크로스헤어 툴팁
- 여러 메트릭을 동시에 오버레이하여 비교 가능

### Preferences 페이지 (사용자별 설정)
- `dateRangeDays`, 기본 메트릭, 파생 식, 차트 구성을 JSON으로 수정/저장
- 예시 파생 식: `f1 = (2 * precision * recall) / (precision + recall)`
  - `derived.ts`의 `computeDerivedSeries(name, expression, inputSeries)`로 계산
  - UI 상에서는 Preferences JSON에 파생 식을 등록하여 저장 후, Stats Explorer 확장으로 활용 가능

## 배포
- `npm run build` 결과물은 `dist/`에 생성됩니다.
- 정적 호스팅(Nginx, S3/CloudFront 등)에 업로드하거나, FastAPI의 정적 파일 서빙으로 제공
- 환경 변수는 빌드 시점에 주입되므로, 런타임 변경이 필요하면 프록시/리라이트를 고려하세요

### Nginx 예시 스니펫
```nginx
location / {
  root /var/www/llm-frontend/dist;
  try_files $uri /index.html;
}
```

## 트러블슈팅
- CORS 에러: FastAPI에서 프론트 오리진을 허용하도록 설정 필요
- 401/403: `localStorage.authToken` 설정 확인, 백엔드 인증 미들웨어 점검
- 빈 차트/데이터 없음: 선택한 메트릭/기간에 데이터가 없거나, 백엔드 쿼리 파라미터 불일치
- 시간대 차이: 백엔드는 UTC ISO 문자열 권장 (`YYYY-MM-DDTHH:mm:ssZ`)
- 번들 크기 경고: ECharts/ Mantine 포함으로 큼. 라우트 단위 코드 스플릿을 고려
- TypeScript import 오류: verbatimModuleSyntax 활성화로 타입 전용 임포트(`import type`) 필요

## 스크립트
```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 미리보기
npm run lint     # 린트
```

## 보안/구성 참고
- Axios는 `withCredentials` 활성화. 쿠키 기반 인증 시 도메인/SameSite 설정 확인
- 로컬 토큰 사용 시: `localStorage.setItem('authToken', '...')`

---
필요한 기능이나 화면이 더 있다면 이 README를 기준으로 확장합니다. 백엔드 스키마 변경 시 `src/api/types.ts`와 `src/api/client.ts`를 함께 수정하세요.