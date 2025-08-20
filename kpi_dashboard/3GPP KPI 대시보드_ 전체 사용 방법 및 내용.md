# 3GPP KPI 대시보드: 전체 사용 방법 및 내용

## 1. 소개

이 문서는 React 기반의 프론트엔드와 FastAPI 기반의 백엔드로 구성된 3GPP KPI 대시보드 웹 애플리케이션의 설정, 사용 방법 및 주요 기능에 대해 설명합니다. 이 대시보드는 3GPP KPI 데이터를 시각화하고 관리하며, 종합 분석 리포트 조회 및 사용자 정의 설정 기능을 제공합니다.

## 2. 프로젝트 구조

프로젝트는 `kpi_dashboard` 디렉토리 아래에 `frontend`와 `backend` 두 개의 주요 디렉토리로 구성됩니다.

```
kpi_dashboard/
├── backend/                  # FastAPI 백엔드 애플리케이션
│   ├── main.py               # FastAPI 애플리케이션 메인 파일
│   └── requirements.txt      # Python 종속성 목록
├── frontend/                 # React 프론트엔드 애플리케이션
│   ├── public/               # 정적 파일 (예: favicon.ico)
│   ├── src/                  # React 소스 코드
│   │   ├── App.jsx           # 메인 애플리케이션 컴포넌트
│   │   ├── main.jsx          # React 앱 엔트리 포인트
│   │   ├── index.css         # 전역 CSS
│   │   ├── components/       # 재사용 가능한 UI 컴포넌트
│   │   │   ├── Layout.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── SummaryReport.jsx
│   │   │   ├── Statistics.jsx
│   │   │   ├── Preference.jsx
│   │   │   └── AdvancedChart.jsx
│   │   ├── lib/              # API 클라이언트 및 유틸
│   │   │   └── apiClient.js
│   │   └── hooks/            # React Hooks
│   ├── package.json          # Node.js/pnpm 종속성 및 스크립트
│   ├── pnpm-lock.yaml        # pnpm 잠금 파일
│   └── vite.config.js        # Vite 설정 파일
└── 백엔드-프론트엔드 데이터 구조 양식.md  # API/데이터 규격 문서
```

> 참고: 모든 API 호출은 공용 `apiClient`(`src/lib/apiClient.js`)를 사용합니다. 프로덕션/테스트 환경에서는 프론트엔드 환경변수(`VITE_API_BASE_URL`) 설정을 통해 백엔드 주소를 제어하세요.

## 3. 백엔드 설정 및 실행 (FastAPI)

백엔드는 KPI 데이터, 리포트, 환경설정 및 마스터 데이터를 제공하는 RESTful API입니다. 분석 결과/환경설정/마스터 데이터의 영구 저장소는 MongoDB 입니다(`MONGO_URL`, `MONGO_DB_NAME`). 통계/비교 조회는 프런트에서 입력하거나 Preference에서 주입되는 Query DB(PostgreSQL)에 프록시로 접속합니다. 프록시 실패 시 자동으로 mock 데이터로 폴백하여 프론트 사용성을 보장합니다.

### 3.1. 종속성 설치

`kpi_dashboard/backend` 디렉토리로 이동하여 필요한 Python 패키지를 설치합니다.

```bash
cd kpi_dashboard/backend
pip install -r requirements.txt
```

### 3.2. 환경 변수 설정 (.env)

`kpi_dashboard/backend/.env` 파일을 생성하고 아래와 같이 설정하세요.

```bash
# MongoDB (필수)
MONGO_URL=mongodb://mongo:27017
MONGO_DB_NAME=kpi

# KPI 조회용 PostgreSQL 프록시(옵션)
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=pass
DB_NAME=netperf

# MCP 분석기(옵션)
MCP_ANALYZER_URL=http://mcp-host:8001/analyze
MCP_API_KEY=optional
```

### 3.3. 백엔드 서버 실행

다음 명령어를 사용하여 백엔드 서버를 실행합니다. 서버는 기본적으로 `http://0.0.0.0:8000`에서 실행됩니다.

```bash
cd kpi_dashboard/backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

또는 개발 환경에서 백그라운드로 실행하려면:

```bash
cd kpi_dashboard/backend
python3 main.py &
```

## 4. 프론트엔드 설정 및 실행 (React)

프론트엔드는 백엔드 API와 통신하여 데이터를 시각화하고 사용자 인터페이스를 제공합니다.

### 4.1. 종속성 설치

`kpi_dashboard/frontend` 디렉토리로 이동하여 필요한 Node.js 패키지를 설치합니다. `pnpm`을 사용합니다.

```bash
cd kpi_dashboard/frontend
pnpm install
```

### 4.2. 프론트엔드 개발 서버 실행

다음 명령어를 사용하여 개발 서버를 실행합니다. 서버는 기본적으로 `http://localhost:5173`에서 실행됩니다.

```bash
cd kpi_dashboard/frontend
pnpm run dev --host
```

웹 브라우저에서 `http://localhost:5173`에 접속하여 애플리케이션을 확인할 수 있습니다.

### 4.3. 프론트엔드 환경 변수 설정 (.env)

프론트엔드가 백엔드 API 주소를 인지할 수 있도록 다음과 같이 설정합니다.

```bash
# kpi_dashboard/frontend/.env.local
VITE_API_BASE_URL=http://localhost:8000
```

모든 API 호출은 공용 `apiClient`(`src/lib/apiClient.js`)를 통해 이루어지며, `VITE_API_BASE_URL`이 없으면 자동으로 `http://localhost:8000`으로 폴백합니다.

### 4.4. 프로덕션 빌드

배포를 위해 프로덕션 빌드를 생성하려면 다음 명령어를 사용합니다. 빌드된 파일은 `kpi_dashboard/frontend/dist` 디렉토리에 생성됩니다.

```bash
cd kpi_dashboard/frontend
pnpm run build
```

## 5. 주요 기능

### 5.1. 대시보드 (Dashboard)

Preference의 `config.defaultKPIs`를 읽어 KPI 카드 구성을 결정합니다. 각 KPI는 `/api/kpi/query` 또는 배치 API(`/api/kpi/statistics/batch`)로 조회하며, Preference의 `config.defaultNEs`/`config.defaultCellIDs`가 있으면 `ne`/`cellid` 필터로 전달합니다. KPI별 peg 매핑이 필요할 경우 `config.kpiMappings`의 `peg_names`/`peg_like`를 사용하세요(백엔드가 동일 키를 지원).

### 5.2. 종합 분석 리포트 (Summary Report)

백엔드의 최신 분석 결과(`/api/analysis-result/latest`)를 우선 사용하여 요약 리포트를 표시하고, 없을 경우 기존 mock 리포트(`/api/reports/summary`)로 폴백합니다. 리포트는 마크다운 형식으로 렌더링됩니다.

### 5.3. 통계 (Statistics)

KPI 데이터를 조회하고 분석하는 두 가지 모드를 제공합니다.

-   **기본 분석 (Basic Analysis)**:
    -   기간, KPI 타입, NE, CellID를 기준으로 데이터를 조회합니다.
    -   `kpi_peg_names`(정확 매칭) 또는 `kpi_peg_like`(ILIKE 패턴)를 전달하여 KPI→peg 매핑이 가능합니다.
    -   매핑이 없는 KPI는 기본집계(필터만 적용)로 표시합니다.
    -   NE/CellID 입력에는 자동완성(datalist)이 제공되며, `/api/master/ne-list`, `/api/master/cellid-list`를 사용합니다.

-   **고급 분석 (Advanced Analysis)**:
    -   **기간 비교**: 두 개의 다른 기간에 대한 KPI 데이터를 비교하여 추이 변화를 쉽게 파악할 수 있습니다.
    -   **이중 Y축**: 서로 다른 스케일을 가진 두 가지 KPI(예: Availability와 SAR)를 하나의 차트에 동시에 표시하여 상관관계를 분석할 수 있습니다.
    -   **임계값 라인**: 설정된 임계값을 차트에 표시하여 KPI가 목표치를 달성하고 있는지 시각적으로 확인할 수 있습니다.
    -   **엔티티 입력**: 엔티티 입력칸에서 쉼표로 구분해 지정하거나, “Use Preference”로 `config.defaultEntities`를 적용할 수 있습니다.
    -   **PEG 겹쳐 그리기**: 여러 엔티티의 데이터를 하나의 차트에 겹쳐 그려 비교 분석을 용이하게 합니다.

### 5.4. 환경설정 (Preference)

대시보드에 표시되는 내용(예: 기본 KPI, 차트 설정)을 사용자 정의하고 저장할 수 있는 페이지입니다. 저장된 환경설정은 로드하거나 파일로 내보내고 가져올 수 있어 다른 사용자와 공유하거나 백업할 수 있습니다.

## 6. 데이터 구조 양식

백엔드와 프론트엔드 간의 데이터 통신에 사용되는 주요 JSON 구조는 다음과 같습니다. 자세한 내용은 `백엔드-프론트엔드 데이터 구조 양식.md` 파일을 참조하십시오.

-   **KPI 데이터**: `timestamp`, `entity_id`, `kpi_type`, `value`를 포함합니다. 샘플링 간격은 `interval_minutes`(기본 60, 5/15 지원)를 통해 제어할 수 있습니다.
-   **환경설정 데이터**: `id`, `name`, `description`, `config` (JSON 객체)를 포함합니다.
-   **종합 분석 리포트**: `id`, `title`, `content` (마크다운), `generated_at`를 포함합니다.
-   **마스터 데이터 (PEG/Cell)**: `id`, `name`을 포함하는 객체 배열입니다.

## 7. 배포 정보

배포 환경과 도메인은 인프라 구성에 따라 달라집니다. 프론트엔드의 `VITE_API_BASE_URL`과 백엔드의 데이터베이스 DSN을 환경에 맞게 설정하세요. 백엔드는 INFO 로그로 주요 함수/엔드포인트 진입/성공/실패, DB 프록시 시도/폴백 여부를 기록합니다.

## 8. 향후 개선 사항

-   **실제 데이터베이스 연동**: 현재는 가상 데이터를 사용하지만, 실제 데이터베이스(예: PostgreSQL, MongoDB)와 연동하여 영구적인 데이터 저장을 구현할 수 있습니다.
-   **사용자 인증 및 권한 관리**: 사용자 로그인, 역할 기반 접근 제어 기능을 추가하여 보안을 강화할 수 있습니다.
-   **실시간 데이터 업데이트**: WebSocket 등을 활용하여 KPI 데이터를 실시간으로 업데이트하는 기능을 구현할 수 있습니다.
-   **더 많은 KPI 타입 지원**: 다양한 3GPP KPI를 추가하고 시각화할 수 있도록 확장할 수 있습니다.
-   **고급 필터링 및 검색**: 더 복잡한 조건으로 데이터를 필터링하고 검색하는 기능을 제공할 수 있습니다.
-   **데이터 내보내기**: 차트 데이터나 리포트를 CSV, Excel, PDF 등 다양한 형식으로 내보내는 기능을 추가할 수 있습니다.
-   **알림 및 임계값 경고 시스템**: KPI가 특정 임계값을 벗어날 경우 사용자에게 알림을 보내는 시스템을 구축할 수 있습니다.

이 문서는 3GPP KPI 대시보드 웹 애플리케이션을 이해하고 활용하는 데 도움이 되기를 바랍니다. 백엔드는 INFO 수준 로깅을 사용하며, API 호출/DB 프록시 시도 및 오류가 로그로 남습니다.

