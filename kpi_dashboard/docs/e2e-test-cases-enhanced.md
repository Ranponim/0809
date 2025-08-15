# 개선된 E2E 테스트 케이스 정의서

## 🎯 목적
3GPP KPI 대시보드 시스템의 전체 사용자 여정을 검증하여 모든 기능이 유기적으로 동작하는지 확인합니다.

## 🔍 테스트 환경
- **Frontend**: React (Vite) - http://localhost:5173
- **Backend**: FastAPI - http://localhost:8000  
- **Database**: MongoDB - localhost:27017
- **실제 데이터**: MongoDB의 실제 PEG 마스터 데이터 및 KPI 데이터 사용

---

## 📋 핵심 사용자 여정 테스트 케이스

### 🚀 **TC001: 완전한 워크플로우 - Preference → Statistics → Dashboard**

**목적**: 가장 핵심적인 사용자 워크플로우 검증

**사전 조건**:
- 시스템이 정상적으로 실행 중 (docker-compose up -d)
- MongoDB에 테스트 데이터 존재
- 브라우저에서 http://localhost:5173 접근 가능

**테스트 단계**:

1. **애플리케이션 초기 로딩 확인**
   - 메인 페이지 접근: http://localhost:5173
   - 기본 Dashboard 페이지 로딩 확인
   - 헤더 "3GPP KPI Dashboard" 표시 확인
   - 좌측 사이드바 메뉴 항목들 표시 확인:
     - Dashboard (BarChart3 아이콘)
     - 분석 결과 (Database 아이콘) 
     - Summary Report (FileText 아이콘)
     - Statistics (TrendingUp 아이콘)
     - Preference (Settings 아이콘)

2. **Preference 설정**
   - Preference 메뉴 클릭 (Settings 아이콘)
   - PreferenceManager 컴포넌트 로딩 확인
   - **Dashboard 설정 탭**:
     - API `/api/master/pegs` 호출 확인
     - PEG 목록 로딩 확인 (availability, rrc_success_rate, erab_success_rate 등)
     - 기본 PEG 2-3개 선택: availability, rrc_success_rate
   - **Statistics 설정 탭**:
     - 기본 NE 설정: "eNB_001"
     - 기본 Cell ID 설정: "Cell_001"
   - **Derived PEG 설정 탭** (있다면):
     - 사용자 정의 PEG 공식 확인
   - 설정 저장 확인

3. **Statistics 분석 수행**
   - Statistics 메뉴 클릭 (TrendingUp 아이콘)
   - Statistics 컴포넌트 로딩 확인
   - **Basic 탭**:
     - 두 날짜 구간 설정:
       - Period 1: 2025-08-09 ~ 2025-08-10
       - Period 2: 2025-08-11 ~ 2025-08-12
     - Preference에서 설정한 NE/Cell이 기본값으로 표시되는지 확인
     - API `/api/master/pegs` 호출하여 PEG 목록 로드 확인
     - 분석 실행 버튼 클릭
     - API `/api/statistics/compare` 호출 확인
     - 분석 결과 표시 확인

4. **Dashboard 저장 기능**
   - Statistics 결과에서 일부 PEG 체크박스 선택
   - "Dashboard에 저장" 버튼 클릭
   - 성공 메시지 확인
   - 저장된 데이터가 시스템에 반영되었는지 확인

5. **Dashboard 확인**
   - Dashboard 메뉴 클릭 (BarChart3 아이콘)
   - Dashboard 컴포넌트 로딩 확인
   - Statistics에서 저장한 PEG가 표시되는지 확인
   - 차트가 정상적으로 렌더링되는지 확인 (canvas, svg, .recharts-wrapper)
   - 차트 데이터가 Statistics 분석 결과와 일치하는지 확인

**예상 결과**: 전체 워크플로우가 끊김 없이 동작하며, 설정한 값들이 각 단계에서 올바르게 반영됨

---

### 🔄 **TC002: Preference Import/Export 기능**

**목적**: 설정 관리 기능의 완전성 검증

**테스트 단계**:

1. **초기 설정 생성**
   - Preference 메뉴 접근
   - Dashboard, Statistics, Derived PEG 설정 구성
   - 다양한 설정값 입력:
     - Dashboard: 여러 PEG 선택
     - Statistics: NE 및 Cell ID 설정
     - 테마 및 언어 설정 변경

2. **Export 기능 확인**
   - API `/api/preference/export?user_id=default` 호출 확인
   - "설정 내보내기" 기능 실행
   - 생성된 JSON 파일 다운로드 확인
   - JSON 파일 내용 검증:
     - dashboard_settings 포함
     - statistics_settings 포함
     - notification_settings 포함
     - theme, language 정보 포함
     - export_date, version 정보 포함

3. **설정 변경**
   - 기존 설정을 다른 값으로 변경
   - 변경사항 저장 확인
   - API `/api/preference/settings?user_id=default` PUT 호출 확인

4. **Import 기능 확인**
   - "설정 가져오기"로 이전에 내보낸 JSON 파일 업로드
   - API `/api/preference/import?user_id=default` 호출 확인
   - 모든 설정이 원래 값으로 복원되는지 확인
   - 각 탭에서 설정값이 정확히 복원되었는지 검증

**예상 결과**: Import/Export가 정확히 동작하며 모든 설정이 손실 없이 보존됨

---

### 📊 **TC003: LLM 분석 결과 관리 워크플로우**

**목적**: LLM 분석 결과 저장, 조회, 필터링 기능 검증

**테스트 단계**:

1. **분석 결과 조회**
   - "분석 결과" 메뉴 접근 (Database 아이콘)
   - ResultsList 컴포넌트 로딩 확인
   - API `/api/analysis/results/` 호출 확인
   - 기존 분석 결과 목록 표시 확인
   - 페이지네이션 기능 확인

2. **필터링 기능**
   - 날짜 범위 필터:
     - date_from, date_to 파라미터로 API 호출 확인
   - NE 필터:
     - ne_id 파라미터로 API 호출 확인
   - Cell ID 필터:
     - cell_id 파라미터로 API 호출 확인
   - 상태 필터:
     - status 파라미터 (success, warning, error)로 API 호출 확인
   - 복합 필터 적용 확인

3. **상세보기 및 비교**
   - 개별 결과 클릭하여 상세보기 확인
   - API `/api/analysis/results/{result_id}` 호출 확인
   - 분석 결과 세부 정보 표시 확인
   - 여러 결과 선택하여 비교 기능 확인
   - 비교 차트 및 테이블 표시 확인

4. **결과 관리**
   - 결과 삭제 기능:
     - API DELETE `/api/analysis/results/{result_id}` 호출 확인
   - 대량 선택 및 삭제 확인
   - 삭제 확인 다이얼로그 표시 확인

**예상 결과**: 분석 결과가 체계적으로 관리되며 사용자가 원하는 데이터를 쉽게 찾을 수 있음

---

### 🧮 **TC004: Derived PEG 관리 및 활용**

**목적**: 사용자 정의 PEG 공식 기능의 완전성 검증

**테스트 단계**:

1. **Derived PEG 생성**
   - Preference → Derived PEG 탭 접근
   - DerivedPegManager 컴포넌트 확인
   - 새로운 공식 추가:
     ```
     RACH_SUCCESS_RATE = (rrc_success_rate / availability) * 100
     ```
   - 공식 검증 기능 확인
   - 공식 저장 확인

2. **공식 활용 확인**
   - Dashboard 설정에서 생성한 Derived PEG가 선택 가능한지 확인
   - Statistics에서 Derived PEG가 PEG 목록에 포함되는지 확인
   - API `/api/master/pegs` 응답에 Derived PEG 포함 확인

3. **공식 관리**
   - 공식 수정 기능 확인
   - 공식 삭제 기능 확인
   - 순환 참조 방지 검증:
     - A = B + C, B = A + D 같은 순환 참조 시도 시 오류 표시 확인

4. **공식 계산 검증**
   - Statistics 분석 시 Derived PEG 계산 결과 확인
   - 수식이 정확히 적용되었는지 검증

**예상 결과**: 사용자 정의 PEG가 시스템 전반에서 기본 PEG와 동일하게 취급됨

---

### 🌐 **TC005: 실제 데이터 API 연동**

**목적**: Mock 데이터가 아닌 실제 MongoDB 데이터 연동 검증

**테스트 단계**:

1. **Master API 검증**
   - 브라우저 개발자 도구 Network 탭 활용
   - `/api/master/pegs` 호출 시:
     - 실제 MongoDB peg_master 컬렉션에서 데이터 반환 확인
     - 데이터가 없을 경우 기본 하드코딩된 PEG 목록 반환 확인
   - `/api/master/cells` 호출 시:
     - 실제 MongoDB cell_master 컬렉션에서 데이터 반환 확인
     - 데이터가 없을 경우 기본 하드코딩된 Cell 목록 반환 확인

2. **Statistics API 검증**
   - `/api/statistics/compare` 호출 시:
     - 실제 MongoDB에서 KPI 데이터 조회 확인
     - 데이터 부족 시 적절한 오류 메시지 표시 확인:
       - "첫 번째 기간에 분석할 데이터가 없습니다"
       - "두 번째 기간에 분석할 데이터가 없습니다"
       - "두 기간 모두에 존재하는 공통 PEG가 없습니다"
   - `/api/statistics/health` 호출하여 상태 확인

3. **Preference API 검증**
   - `/api/preference/settings` GET/PUT 호출 시:
     - 실제 MongoDB preference 컬렉션 저장/로드 확인
   - 여러 사용자 설정 격리 확인:
     - user_id별로 독립적인 설정 관리 확인

4. **Analysis Results API 검증**
   - `/api/analysis/results/` CRUD 작업 시:
     - 실제 MongoDB analysis_results 컬렉션 연동 확인
   - 중복 검사 확인:
     - 같은 NE, Cell, 날짜에 대한 중복 분석 결과 생성 시도 시 오류 확인

**예상 결과**: 모든 API가 실제 데이터베이스와 정상적으로 연동되어 동작함

---

### 🔧 **TC006: 오류 처리 및 회복성 테스트**

**목적**: 예외 상황에서의 시스템 안정성 검증

**테스트 단계**:

1. **네트워크 오류 시나리오**
   - Backend 서버 종료 후 API 호출
   - 적절한 오류 메시지 표시 확인
   - 로딩 스피너 종료 확인
   - 사용자에게 재시도 옵션 제공 확인

2. **데이터 부족 시나리오**
   - 존재하지 않는 날짜 범위로 Statistics 분석 시도
   - "데이터가 없습니다" 메시지 표시 확인
   - 빈 결과에 대한 적절한 UI 표시 확인

3. **잘못된 입력 처리**
   - Preference에서 잘못된 형식의 설정 입력
   - Derived PEG에서 잘못된 수식 입력
   - 입력 검증 오류 메시지 표시 확인

4. **브라우저 호환성**
   - Chrome, Firefox, Safari에서 동일한 동작 확인
   - 반응형 디자인 동작 확인

**예상 결과**: 모든 오류 상황에서 시스템이 안정적으로 동작하며 사용자에게 명확한 피드백 제공

---

## 📈 **성능 및 사용성 검증 항목**

### ⚡ **성능 테스트**
- **API 응답 시간**: 
  - `/api/master/pegs` < 1초
  - `/api/statistics/compare` < 3초
  - `/api/preference/settings` < 1초
- **차트 렌더링**: Dashboard 차트 로딩 시간 < 2초
- **대용량 데이터**: 100개 이상 분석 결과 처리 시 응답 시간 < 5초

### 🎨 **UI/UX 검증**
- **반응형 디자인**: 1024px, 768px, 375px 화면에서 정상 동작
- **에러 처리**: 네트워크 오류 시 토스트 메시지 또는 에러 바운더리 표시
- **로딩 상태**: 모든 비동기 작업 시 로딩 스피너 또는 프로그레스 바 표시
- **접근성**: 키보드 네비게이션 지원, 적절한 ARIA 라벨 확인

### 🔒 **데이터 무결성**
- **동시성**: 여러 브라우저 탭에서 동시 접근 시 데이터 충돌 없음
- **트랜잭션**: Preference 설정 저장 실패 시 부분 업데이트 방지
- **백업**: 중요 설정 변경 시 이전 상태 복구 가능

---

## 🛠 **테스트 실행 가이드**

### **자동화 테스트 준비사항**
1. **Playwright 테스트 환경**:
   ```bash
   cd kpi_dashboard/frontend
   npm install @playwright/test
   npx playwright install
   ```

2. **테스트 데이터 시딩**:
   ```bash
   # Mock 데이터 생성
   curl -X POST http://localhost:8000/api/statistics/mock-data?count=1000
   ```

3. **테스트 실행**:
   ```bash
   # 모든 E2E 테스트 실행
   npx playwright test
   
   # 특정 테스트만 실행
   npx playwright test workflow-integration.spec.ts
   
   # 헤드 모드로 실행 (브라우저 확인)
   npx playwright test --headed
   ```

### **테스트 환경 설정**
```bash
# 1. 시스템 시작
cd kpi_dashboard
docker-compose up -d

# 2. 프론트엔드 시작
cd frontend
npm run dev

# 3. 테스트 데이터 확인
curl http://localhost:8000/api/master/pegs
curl http://localhost:8000/api/master/cells

# 4. 브라우저에서 수동 테스트 수행
# http://localhost:5173
```

---

## 📊 **테스트 결과 기록 양식**

| 테스트 케이스 | 실행일시 | 브라우저 | 상태 | 실행시간 | 발견된 이슈 | 해결방안 |
|-------------|---------|---------|------|---------|------------|---------|
| TC001 완전한 워크플로우 | - | Chrome/Firefox/Safari | ⏳ | - | - | - |
| TC002 Import/Export | - | Chrome | ⏳ | - | - | - |
| TC003 분석결과 관리 | - | Chrome | ⏳ | - | - | - |
| TC004 Derived PEG | - | Chrome | ⏳ | - | - | - |
| TC005 실제 데이터 연동 | - | Chrome | ⏳ | - | - | - |
| TC006 오류 처리 | - | Chrome | ⏳ | - | - | - |

**범례**: ✅ 성공 | ❌ 실패 | ⚠️ 부분성공 | ⏳ 미실행

---

## 🎯 **성공 기준**
- **핵심 워크플로우 테스트**: TC001-TC005 통과율 100%
- **오류 처리 테스트**: TC006 통과율 95% 이상
- **성능 기준**: 모든 API 응답시간 목표 달성
- **브라우저 호환성**: Chrome, Firefox, Safari에서 동일한 동작
- **중대한 UI/UX 이슈**: 0건
- **데이터 무결성 이슈**: 0건

---

## 📝 **추가 고려사항**

### **CI/CD 통합 준비**
- GitHub Actions workflow 파일 작성 준비
- 테스트 결과 리포팅 (Allure, HTML Report)
- 실패 시 스크린샷 및 비디오 녹화
- Slack 알림 또는 이메일 알림 설정

### **테스트 데이터 관리**
- 테스트용 MongoDB 시드 데이터 스크립트
- 테스트 환경별 데이터 격리
- 테스트 완료 후 데이터 정리 스크립트

### **모니터링 및 메트릭**
- 테스트 실행 시간 추적
- 실패율 통계
- 성능 회귀 감지
- 커버리지 리포팅
