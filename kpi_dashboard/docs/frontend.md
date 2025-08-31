# 프론트엔드 개발 가이드

KPI 대시보드 프론트엔드의 전체적인 구조, 컴포넌트, 개발 워크플로우를 설명하는 종합 가이드입니다.

## 📁 프로젝트 구조

```
frontend/
├── public/                     # 정적 파일
│   └── favicon.ico
├── src/
│   ├── components/            # React 컴포넌트
│   │   ├── ui/               # 재사용 가능한 UI 컴포넌트 (Radix UI)
│   │   ├── chart/            # 차트 관련 컴포넌트
│   │   ├── Dashboard.jsx     # 메인 대시보드
│   │   ├── LLMAnalysisManager.jsx  # LLM 분석 관리
│   │   ├── ResultsList.jsx   # 분석 결과 목록
│   │   ├── ResultDetail.jsx  # 분석 결과 상세
│   │   ├── Statistics.jsx    # 통계 분석
│   │   └── ...
│   ├── contexts/             # React Context
│   │   └── PreferenceContext.jsx
│   ├── hooks/                # 커스텀 훅
│   │   ├── useAnalysisResults.js
│   │   ├── usePreference.js
│   │   └── use-mobile.js
│   ├── lib/                  # 유틸리티 라이브러리
│   │   ├── apiClient.js      # API 클라이언트
│   │   ├── derivedPegUtils.js
│   │   └── utils.js
│   ├── utils/                # 기타 유틸리티
│   │   ├── performance.js
│   │   └── webVitals.js
│   ├── App.jsx              # 메인 앱 컴포넌트
│   ├── main.jsx             # 앱 진입점
│   ├── index.css            # 전역 스타일
│   └── App.css              # 앱별 스타일
├── tests/                   # Playwright E2E 테스트
├── nginx.conf              # Nginx 설정
├── Dockerfile              # Docker 설정
├── package.json            # 의존성 관리
├── vite.config.js          # Vite 빌드 설정
└── README.md
```

## 🛠 기술 스택

### 핵심 기술
- **React 18**: 컴포넌트 기반 UI 프레임워크
- **Vite**: 빠른 개발 서버 및 빌드 도구
- **JavaScript (ES6+)**: 최신 자바스크립트 문법 사용

### 스타일링
- **Tailwind CSS**: 유틸리티 우선 CSS 프레임워크
- **CSS Modules**: 컴포넌트별 스타일 스코핑

### UI 컴포넌트
- **Radix UI**: 접근성 우선 헤드리스 UI 컴포넌트
  - Dialog, Select, Button, Card, Table 등
- **Lucide React**: 아이콘 라이브러리
- **Recharts**: React용 차트 라이브러리

### 상태 관리
- **React Context**: 전역 상태 관리 (사용자 설정 등)
- **useState/useEffect**: 로컬 상태 관리
- **Custom Hooks**: 로직 재사용성

### HTTP 클라이언트
- **Axios**: API 통신
- **React Query (TanStack Query)**: 서버 상태 관리 (일부 기능)

### 개발 도구
- **ESLint**: 코드 품질 관리
- **Playwright**: E2E 테스트
- **Docker**: 컨테이너화 배포

## 🧩 주요 컴포넌트

### 1. Dashboard.jsx
메인 대시보드 컴포넌트로, 전체 애플리케이션의 레이아웃과 네비게이션을 담당합니다.

```javascript
// 주요 기능
- 탭 기반 네비게이션 (기본 비교, 고급 차트, LLM 분석, 설정)
- 반응형 레이아웃
- 전역 상태 관리 연동
```

### 2. LLMAnalysisManager.jsx
LLM 분석 결과 관리의 최상위 컴포넌트입니다.

```javascript
// 주요 기능
- 분석 결과 목록 조회
- 필터링 및 검색
- 결과 상세 모달 관리
- 새로고침 및 페이지네이션
```

### 3. ResultsList.jsx
분석 결과 목록을 표시하는 컴포넌트입니다.

```javascript
// 주요 기능
- 무한 스크롤 (Load More)
- 실시간 필터링
- 상태별 색상 구분
- 정렬 및 검색
- 로딩 상태 관리
```

**핵심 특징:**
- **반응형 그리드**: 화면 크기에 따른 자동 조정
- **성능 최적화**: 가상화된 목록 렌더링
- **접근성**: 키보드 네비게이션 지원

### 4. ResultDetail.jsx
분석 결과 상세 정보를 표시하는 모달 컴포넌트입니다.

```javascript
// 주요 기능
- 분석 개요 (분석일시, NE ID, Cell ID, 상태, Host, Version)
- 분석 요약 (PEG 개수, 권장사항 개수, 진단 결과 개수)
- PEG 비교 결과 차트 (N-1 vs N 성능 비교)
- 확대/축소 (F11 단축키 지원)
- 트렌드 필터링 (개선/악화/안정)
```

**PRD 요구사항 구현:**
- ✅ 평균점수 삭제 완료
- ✅ 실제 데이터베이스 값 표시 (PostgreSQL + MongoDB)
- ✅ KPI → PEG 비교 결과로 명칭 변경
- ✅ 가중치 기반 정렬
- ✅ 해상도 적응형 확대/축소
- ✅ 키보드 단축키 (F11, Escape)

### 5. Statistics.jsx
통계 분석 기능을 제공하는 컴포넌트입니다.

```javascript
// 주요 기능
- A/B 비교 분석
- 시계열 데이터 시각화
- 통계적 유의성 검정
- 다양한 차트 유형 지원
```

### 6. UI 컴포넌트 (src/components/ui/)
Radix UI 기반의 재사용 가능한 컴포넌트들입니다.

```javascript
// 포함된 컴포넌트들
- Button: 다양한 스타일의 버튼
- Card: 카드 레이아웃
- Dialog: 모달 다이얼로그
- Select: 드롭다운 선택
- Table: 데이터 테이블
- Input: 입력 필드
- Badge: 상태 배지
- Alert: 알림 메시지
// ... 총 40+ 개 컴포넌트
```

## 🔗 API 통신

### apiClient.js
중앙화된 API 클라이언트로 모든 백엔드 통신을 관리합니다.

```javascript
// 주요 기능
- Axios 기반 HTTP 클라이언트
- 요청/응답 인터셉터
- 에러 처리 및 토스트 알림
- 로딩 상태 자동 관리
- 재시도 로직
```

**API 엔드포인트:**
```javascript
// 분석 결과 API
GET    /api/analysis/results        // 목록 조회
GET    /api/analysis/results/{id}   // 상세 조회
POST   /api/analysis/results        // 생성
DELETE /api/analysis/results/{id}   // 삭제

// 통계 API
GET    /api/statistics/compare      // A/B 비교
GET    /api/kpi                     // KPI 데이터

// 모니터링 API
GET    /api/monitoring/health/comprehensive  // 종합 건강 상태
GET    /api/monitoring/metrics/api          // API 메트릭
```

### 에러 처리
```javascript
// 자동 에러 처리
- 네트워크 에러: 연결 실패 알림
- 4xx 에러: 사용자 입력 오류 메시지
- 5xx 에러: 서버 오류 알림
- 타임아웃: 재시도 옵션 제공
```

## 🎨 스타일링 가이드

### Tailwind CSS 사용법
```javascript
// 반응형 디자인
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// 다크모드 지원
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">

// 상태별 스타일
<div className={`badge ${
  status === 'success' ? 'bg-green-100 text-green-800' :
  status === 'error' ? 'bg-red-100 text-red-800' :
  'bg-yellow-100 text-yellow-800'
}`}>
```

### 색상 시스템
```css
/* 브랜드 색상 */
--primary: 210 40% 98%;      /* 주요 색상 */
--secondary: 210 40% 96%;    /* 보조 색상 */
--accent: 210 40% 94%;       /* 강조 색상 */
--destructive: 0 84% 60%;    /* 경고/삭제 */

/* 의미별 색상 */
--success: 142 76% 36%;      /* 성공 (녹색) */
--warning: 48 96% 53%;       /* 경고 (황색) */
--error: 0 84% 60%;          /* 오류 (적색) */

/* 상태별 색상 */
.status-success { @apply bg-green-100 text-green-800; }
.status-warning { @apply bg-yellow-100 text-yellow-800; }
.status-error { @apply bg-red-100 text-red-800; }
```

## 🔄 상태 관리

### 1. 전역 상태 (Context)
```javascript
// PreferenceContext.jsx
- 사용자 설정 (테마, 언어, 필터 기본값)
- 전역 UI 상태 (사이드바 열림/닫힘)
- 인증 상태 (향후 확장)
```

### 2. 로컬 상태 (useState)
```javascript
// 컴포넌트별 상태
- 폼 입력 상태
- 로딩/에러 상태
- 모달 열림/닫힘
- 임시 UI 상태
```

### 3. 서버 상태 (Custom Hooks)
```javascript
// useAnalysisResults.js
const {
  data: results,
  loading,
  error,
  refresh,
  loadMore,
  hasMore
} = useAnalysisResults(filters);

// 주요 기능
- 자동 캐싱
- 백그라운드 업데이트
- 에러 복구
- 무한 스크롤 지원
```

## 📱 반응형 디자인

### 브레이크포인트
```javascript
// Tailwind CSS 브레이크포인트
sm: '640px',   // 모바일 (가로)
md: '768px',   // 태블릿
lg: '1024px',  // 랩톱
xl: '1280px',  // 데스크톱
2xl: '1536px'  // 큰 화면
```

### 반응형 패턴
```javascript
// 그리드 레이아웃
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// 컨테이너 크기
<div className="w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl">

// 텍스트 크기
<h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl">

// 패딩/마진
<div className="p-2 sm:p-4 lg:p-6 xl:p-8">
```

## 🎯 성능 최적화

### 1. 컴포넌트 최적화
```javascript
// React.memo로 불필요한 리렌더링 방지
const MemoizedComponent = React.memo(({ data }) => {
  return <div>{data.title}</div>;
});

// useMemo로 비싼 계산 캐싱
const processedData = useMemo(() => {
  return data.map(item => expensiveTransform(item));
}, [data]);

// useCallback으로 함수 참조 안정화
const handleClick = useCallback((id) => {
  onItemClick(id);
}, [onItemClick]);
```

### 2. 지연 로딩
```javascript
// 컴포넌트 지연 로딩
const LazyChart = lazy(() => import('./components/Chart'));

// 이미지 지연 로딩
<img loading="lazy" src={imageUrl} alt="description" />

// 무한 스크롤로 데이터 지연 로딩
const { data, loadMore, hasMore } = useInfiniteQuery({
  queryKey: ['results'],
  queryFn: ({ pageParam = 1 }) => fetchResults(pageParam),
  getNextPageParam: (lastPage) => lastPage.nextPage,
});
```

### 3. 번들 최적화
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select'],
          charts: ['recharts']
        }
      }
    }
  }
};
```

## 🧪 테스트

### E2E 테스트 (Playwright)
```javascript
// tests/ 디렉터리 구조
├── comprehensive-workflow.spec.ts    // 종합 워크플로우
├── stable-workflow.spec.ts          // 안정성 테스트
├── preference-basic.spec.ts         // 설정 기능
├── api-integration.spec.ts          // API 통합
└── auxiliary-features.spec.ts       // 보조 기능

// 주요 테스트 시나리오
- 사용자 워크플로우 (로그인 → 분석 → 결과 확인)
- API 연동 테스트
- 반응형 디자인 검증
- 접근성 테스트
```

### 테스트 실행
```bash
# 모든 테스트 실행
npm run test:e2e

# 특정 테스트 실행
npm run test:e2e -- --grep "workflow"

# 헤드리스 모드
npm run test:e2e:headless

# 디버그 모드
npm run test:e2e:debug
```

## 🚀 개발 워크플로우

### 1. 개발 환경 설정
```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 백엔드 연결 확인
# http://localhost:5173 (프론트엔드)
# http://localhost:8000 (백엔드 API)
```

### 2. 개발 단계
```bash
# 1. 기능 개발
npm run dev          # 개발 서버 시작

# 2. 린트 검사
npm run lint         # ESLint 실행
npm run lint:fix     # 자동 수정

# 3. 테스트
npm run test:e2e     # E2E 테스트

# 4. 빌드
npm run build        # 프로덕션 빌드
npm run preview      # 빌드 결과 미리보기
```

### 3. Git 워크플로우
```bash
# 기능 브랜치 생성
git checkout -b feature/new-analysis-view

# 커밋
git add .
git commit -m "feat: 새로운 분석 결과 뷰 구현"

# 푸시 및 PR
git push origin feature/new-analysis-view
```

## 🔧 빌드 및 배포

### 개발 빌드
```bash
npm run build:dev
```

### 프로덕션 빌드
```bash
npm run build
```

### Docker 빌드
```bash
# 개발용
docker build --target runtime -t kpi-dashboard-frontend:dev .

# 프로덕션용
docker build --target production -t kpi-dashboard-frontend:prod .
```

### Nginx 설정
```nginx
# nginx.conf - 프로덕션 설정
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    
    # SPA 라우팅 지원
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API 프록시
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # 정적 파일 캐싱
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🐛 디버깅 가이드

### 1. 개발 도구 활용
```javascript
// React DevTools
- 컴포넌트 트리 검사
- Props/State 실시간 확인
- 성능 프로파일링

// Network 탭
- API 요청/응답 확인
- 로딩 시간 분석
- 에러 상태 점검

// Console 로그
console.log('API Response:', response);
console.error('Error occurred:', error);
```

### 2. 일반적인 문제 해결
```javascript
// API 연결 실패
- 백엔드 서버 상태 확인
- CORS 설정 점검
- 네트워크 연결 확인

// 컴포넌트 렌더링 문제
- React DevTools로 상태 확인
- 의존성 배열 점검 (useEffect, useMemo)
- 키(key) 속성 확인

// 스타일 적용 안됨
- Tailwind 클래스명 확인
- CSS 순서 점검
- 브라우저 캐시 클리어
```

### 3. 성능 문제 해결
```javascript
// 느린 렌더링
- React.memo 적용
- 불필요한 리렌더링 확인
- 큰 데이터 처리 최적화

// 메모리 누수
- useEffect 정리 함수 확인
- 이벤트 리스너 해제
- 타이머 정리
```

## 📚 추가 리소스

### 참고 문서
- [React 공식 문서](https://react.dev/)
- [Tailwind CSS 가이드](https://tailwindcss.com/docs)
- [Radix UI 컴포넌트](https://www.radix-ui.com/)
- [Recharts 예제](https://recharts.org/en-US/examples)
- [Vite 설정 가이드](https://vitejs.dev/config/)

### 유용한 VSCode 확장
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",      // Tailwind CSS 자동완성
    "ms-vscode.vscode-typescript-next", // TypeScript 지원
    "esbenp.prettier-vscode",         // 코드 포맷팅
    "ms-playwright.playwright",       // Playwright 테스트
    "formulahendry.auto-rename-tag"   // HTML 태그 자동 이름 변경
  ]
}
```

### 개발 팁
1. **컴포넌트 설계**: 단일 책임 원칙을 따라 작고 재사용 가능한 컴포넌트 작성
2. **상태 관리**: 전역 상태는 최소화하고 로컬 상태를 우선 사용
3. **성능**: 불필요한 리렌더링을 방지하기 위해 React.memo와 useCallback 활용
4. **접근성**: 시맨틱 HTML과 ARIA 속성을 사용하여 접근성 확보
5. **테스트**: 사용자 중심의 E2E 테스트로 실제 사용 시나리오 검증

---

**💡 문의사항이나 개선 제안이 있으시면 개발팀에 연락해주세요!**
