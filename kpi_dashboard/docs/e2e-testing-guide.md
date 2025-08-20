# E2E 테스트 가이드

## 🎯 개요
3GPP KPI Dashboard의 End-to-End (E2E) 테스트 구현 및 실행 가이드입니다.

## 📋 테스트 구성

### 🧪 테스트 파일들

#### 핵심 테스트 스위트
- **`comprehensive-workflow.spec.ts`**: 전체 사용자 여정 테스트 (5개 핵심 시나리오)
  - UC001: 완전한 사용자 여정 (Preference → Statistics → Dashboard)
  - UC002: LLM 분석 결과 관리 워크플로우
  - UC003: Preference Import/Export 워크플로우
  - UC004: 시스템 성능 및 반응성
  - UC005: 오류 처리 및 엣지 케이스

- **`auxiliary-features.spec.ts`**: 보조 기능 테스트 (6개 고급 시나리오)
  - AF001: LLM 분석 결과 필터링 및 검색
  - AF002: 상세 보기 및 비교 기능
  - AF003: Preference Import/Export 기능
  - AF004: 고급 Statistics 기능
  - AF005: Dashboard 커스터마이징 및 PEG 관리
  - AF006: 시스템 통합 및 API 상태 모니터링

#### 안정성 및 CI 테스트
- **`stable-workflow.spec.ts`**: 로컬 개발용 안정적인 테스트 (8개 기본 테스트)
- **`ci-workflow.spec.ts`**: CI 환경용 핵심 기능 테스트 (12개 테스트)
- **`real-system-workflow.spec.ts`**: 실제 시스템 워크플로우 테스트
- **`workflow-integration.spec.ts`**: 통합 워크플로우 테스트

### 🎯 테스트 범위

#### 핵심 기능 검증
1. **전체 사용자 여정**: Preference 설정 → Statistics 분석 → Dashboard 반영
2. **데이터 관리**: LLM 분석 결과 조회, 필터링, 상세 보기, 비교
3. **설정 관리**: Preference Import/Export, 실시간 동기화
4. **API 통합**: Master APIs, Analysis APIs, Statistics APIs 상태 확인

#### 고급 기능 검증
5. **성능 모니터링**: 로딩 시간, 응답 시간, 메모리 사용량
6. **오류 처리**: API 실패, 네트워크 오류, 유효하지 않은 입력
7. **브라우저 호환성**: Chromium, WebKit, Firefox 크로스 브라우저
8. **UI/UX**: 반응성, 접근성, 사용자 인터페이스 일관성

## 🚀 로컬에서 테스트 실행

### 사전 준비
```bash
# 1. Docker 서비스 시작
cd ../../  # 리포지토리 루트 (예: D:\Coding\0809)
docker compose up -d

# 2. 프론트엔드 의존성 설치
cd frontend
npm install

# 3. Playwright 브라우저 설치
npx playwright install
```

### 테스트 실행 명령어

#### 기본 테스트 실행
```bash
# 전체 사용자 여정 테스트 (권장)
npm run test:e2e:comprehensive

# 보조 기능 테스트 (고급)
npm run test:e2e:auxiliary

# 모든 핵심 테스트 (comprehensive + auxiliary + stable)
npm run test:e2e:all

# 빠른 검증 테스트 (CI용)
npm run test:e2e:smoke
```

#### 안정성 및 디버깅
```bash
# 안정적인 기본 테스트
npm run test:e2e:stable

# CI 환경용 테스트
npm run test:e2e:ci

# UI 모드로 테스트 (디버깅용)
npm run test:e2e:ui

# 헤드리스 모드로 테스트 (빠름)
npm run test:e2e

# 디버그 모드 (단계별 실행)
npm run test:e2e:debug

# 브라우저 창 표시 모드
npm run test:e2e:headed

# 테스트 리포트 보기
npm run test:e2e:report
```

### 특정 브라우저로 테스트
```bash
# Chrome만
npx playwright test ci-workflow.spec.ts --project=chromium

# Chrome + Safari
npx playwright test ci-workflow.spec.ts --project=chromium --project=webkit

# 단일 워커 (안정성 향상)
npx playwright test ci-workflow.spec.ts --workers=1
```

## 🔧 CI/CD 통합

### GitHub Actions 워크플로우

#### 1. 포괄적 E2E 테스트 (`comprehensive-e2e.yml`)
- **트리거**: push/PR to main/develop, 매일 스케줄, 수동 실행
- **실행 환경**: Ubuntu Latest
- **테스트 브라우저**: Chromium, WebKit, Firefox (매트릭스)
- **테스트 스위트**: comprehensive-workflow, auxiliary-features, stable-workflow
- **특징**: 매트릭스 전략으로 브라우저별 병렬 실행

#### 2. 기본 E2E 테스트 (`e2e-tests.yml`)
- **트리거**: push/PR to main/develop
- **실행 환경**: Ubuntu Latest
- **테스트 브라우저**: Chromium, WebKit
- **테스트 스위트**: ci-workflow (빠른 검증)

### CI 워크플로우 단계

#### 포괄적 테스트 워크플로우
1. **환경 설정**: Node.js 20, Python 3.11, MongoDB 7
2. **매트릭스 전략**: 3개 브라우저 × 3개 테스트 스위트 = 9개 작업
3. **테스트 데이터 초기화**: 격리된 테스트 DB 생성
4. **서비스 시작**: Backend (uvicorn), Frontend (vite preview)
5. **서비스 검증**: 재시도 로직을 포함한 상태 확인
6. **E2E 테스트 실행**: 타임아웃 45분, 워커 1개
7. **결과 업로드**: 브라우저별 리포트 및 스크린샷
8. **정리**: 테스트 데이터베이스 및 서비스 정리

#### 빠른 검증 워크플로우
1. **환경 설정**: 기본 환경 구성
2. **의존성 설치**: 캐시 활용한 빠른 설치
3. **서비스 시작**: 최소한의 서비스만 시작
4. **빠른 테스트**: CI용 핵심 테스트만 실행 (15분 이내)

### 수동 실행 옵션
GitHub Actions UI에서 다음 옵션으로 수동 실행 가능:
- **all**: 모든 테스트 실행
- **comprehensive**: 핵심 사용자 여정만
- **auxiliary**: 보조 기능만
- **ci-only**: 빠른 검증만
- **stable**: 안정성 테스트만

### 성공 기준
- **포괄적 테스트**: 11개 핵심 시나리오 (UC001-UC005, AF001-AF006)
- **API 상태**: Master, Analysis, Preference, Statistics APIs 모두 200 응답
- **성능 기준**: 초기 로딩 < 10초, 평균 응답 < 10초, 페이지 전환 < 5초
- **브라우저 호환성**: Chromium, WebKit에서 100% 통과
- **안정성**: 재시도 포함하여 최종 성공률 95% 이상

## 📊 테스트 결과

### 최근 성과
- **통과율**: 100% (Chrome, Safari)
- **실행 시간**: ~39초
- **API 상태**: Master PEGs ✅, Master Cells ✅
- **성능**: 로딩 568-954ms, 전환 162-680ms

### 주요 검증 항목
- ✅ 기본 UI 요소 로딩
- ✅ 메뉴 네비게이션
- ✅ API 엔드포인트 응답
- ✅ 페이지 구조 및 컴포넌트
- ✅ 성능 기준 달성

## 🛠 디버깅 및 문제 해결

### 테스트 실패 시 확인사항
1. **Docker 서비스 상태**
   ```bash
   docker compose ps
   curl http://localhost:8000/api/master/info
   curl http://localhost:5173
   ```

2. **로그 확인**
   ```bash
   # Backend 로그
   docker compose logs backend
   
   # 테스트 상세 로그
   npx playwright test --debug
   ```

3. **스크린샷 및 비디오**
   - 실패 시 자동으로 `test-results/` 폴더에 저장
   - 브라우저 개발자 도구 활용

### 일반적인 문제와 해결책

#### 문제: Firefox 타임아웃
- **원인**: Firefox 브라우저 초기화 지연
- **해결**: CI에서 Firefox 제외, Chrome/Safari만 사용

#### 문제: 버튼 중복 감지 (strict mode violation)
- **원인**: 동일한 텍스트의 버튼이 여러 개 존재
- **해결**: 더 구체적인 셀렉터 사용 (`aside button:has-text("메뉴")`)

#### 문제: API 응답 없음
- **원인**: Backend 서비스 미시작 또는 MongoDB 연결 실패
- **해결**: 서비스 상태 확인 및 재시작

## 📈 성능 최적화

### CI 환경 최적화
- **단일 워커 사용**: `--workers=1`
- **핵심 브라우저만**: Chromium, WebKit
- **헤드리스 모드**: CI에서 자동 적용
- **타임아웃 증가**: 90초로 설정

### 테스트 안정성 향상
- **네트워크 대기**: `waitForLoadState('networkidle')`
- **요소 대기**: 명시적 대기 시간 설정
- **재시도 설정**: CI에서 2회 재시도
- **스크린샷 캡처**: 실패 시 자동 저장

## 🔄 지속적 개선

### 향후 계획
1. **테스트 케이스 확장**: 더 많은 사용자 시나리오
2. **성능 모니터링**: 지속적인 성능 기준 추적
3. **시각적 회귀 테스트**: 스크린샷 비교
4. **크로스 브라우저 확장**: 더 많은 브라우저 지원

### 기여 가이드
1. 새로운 기능 개발 시 해당 E2E 테스트 추가
2. 테스트 실패 시 원인 분석 및 개선
3. 성능 기준 모니터링 및 최적화
4. 문서 업데이트 및 가이드 개선

---

**📝 마지막 업데이트**: 2025-08-15  
**📊 테스트 커버리지**: 핵심 사용자 여정 100%  
**🎯 CI 통합**: 완료
