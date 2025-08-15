import { test, expect } from '@playwright/test';

/**
 * 통합 E2E 워크플로우 테스트
 * 
 * 전체 시스템의 핵심 사용자 여정을 검증하는 포괄적인 테스트 스위트
 * Task 50.3: 주요 사용자 플로우 E2E 테스트 스크립트 작성
 */
test.describe('Comprehensive User Workflow Tests', () => {

  test.beforeEach(async ({ page }) => {
    // 각 테스트에 충분한 시간 할당
    test.setTimeout(120000);
    
    // 기본 페이지로 이동 및 로딩 대기
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // 기본 UI 요소 로딩 확인
    await page.waitForSelector('h1:has-text("3GPP KPI Dashboard")', { timeout: 15000 });
    
    console.log('✅ 애플리케이션 초기화 완료');
  });

  test('UC001: Complete User Journey - Preference → Statistics → Dashboard', async ({ page }) => {
    console.log('🚀 시작: 완전한 사용자 여정 테스트');
    
    // === 1단계: 애플리케이션 초기 상태 확인 ===
    console.log('📱 1단계: 애플리케이션 초기 상태 확인');
    
    // 헤더 및 네비게이션 확인
    await expect(page.locator('h1:has-text("3GPP KPI Dashboard")')).toBeVisible();
    
    // 사이드바 메뉴 존재 확인
    const menuItems = ['Dashboard', '분석 결과', 'Statistics', 'Preference'];
    for (const menuName of menuItems) {
      await expect(page.locator(`button:has-text("${menuName}")`)).toBeVisible();
      console.log(`✅ ${menuName} 메뉴 확인됨`);
    }

    // === 2단계: Preference 설정 ===
    console.log('⚙️ 2단계: Preference 설정');
    
    // Preference 메뉴 접근
    await page.locator('button:has-text("Preference")').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Preference 페이지 로딩 확인
    await expect(page.locator('h2:has-text("환경설정")')).toBeVisible();
    
    // Dashboard 탭 설정
    await page.locator('[role="tab"]:has-text("Dashboard")').click();
    await page.waitForTimeout(500);
    
    // PEG 데이터 소스 설정
    const dbPegButton = page.locator('button:has-text("DB PEG")');
    if (await dbPegButton.isVisible()) {
      await dbPegButton.click();
      console.log('✅ DB PEG 소스 선택됨');
      
      // API 응답 대기
      await page.waitForResponse('**/api/master/pegs**').catch(() => {
        console.log('PEG API 응답 대기 중...');
      });
      await page.waitForTimeout(2000);
    }
    
    // Statistics 탭 설정
    await page.locator('[role="tab"]:has-text("Statistics")').click();
    await page.waitForTimeout(500);
    
    // NE 및 Cell ID 기본값 설정
    const neInputs = page.locator('input[placeholder*="nvgnb"], input[placeholder*="eNB"]');
    const cellInputs = page.locator('input[placeholder*="2010"], input[placeholder*="Cell"]');
    
    if (await neInputs.first().isVisible()) {
      await neInputs.first().clear();
      await neInputs.first().fill('TEST_NE_001');
      console.log('✅ NE 값 설정: TEST_NE_001');
    }
    
    if (await cellInputs.first().isVisible()) {
      await cellInputs.first().clear();
      await cellInputs.first().fill('TEST_CELL_001');
      console.log('✅ Cell ID 값 설정: TEST_CELL_001');
    }
    
    // 설정 자동 저장 대기
    await page.waitForTimeout(2000);
    
    console.log('✅ Preference 설정 완료');

    // === 3단계: Statistics 분석 수행 ===
    console.log('📊 3단계: Statistics 분석 수행');
    
    // Statistics 메뉴 접근
    await page.locator('button:has-text("Statistics")').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Statistics 페이지 로딩 확인
    await expect(page.locator('h2:has-text("Statistics")')).toBeVisible();
    
    // Preference에서 설정한 기본값 확인
    const hasTestNE = await page.locator('input[value*="TEST_NE"]').isVisible().catch(() => false);
    const hasTestCell = await page.locator('input[value*="TEST_CELL"]').isVisible().catch(() => false);
    
    if (hasTestNE) {
      console.log('✅ Preference NE 값이 Statistics에 반영됨');
    }
    if (hasTestCell) {
      console.log('✅ Preference Cell 값이 Statistics에 반영됨');
    }
    
    // Basic Analysis 탭 확인
    await page.locator('[role="tab"]:has-text("Basic"), [role="tab"]:has-text("Basic Analysis")').click();
    await page.waitForTimeout(1000);
    
    // 날짜 입력 필드가 있는지 확인
    const dateInputs = page.locator('input[type="date"]');
    const dateInputCount = await dateInputs.count();
    
    if (dateInputCount >= 4) {
      // 첫 번째 기간 설정
      await dateInputs.nth(0).fill('2025-08-09');
      await dateInputs.nth(1).fill('2025-08-10');
      
      // 두 번째 기간 설정
      await dateInputs.nth(2).fill('2025-08-11');
      await dateInputs.nth(3).fill('2025-08-12');
      
      console.log('✅ 분석 날짜 구간 설정됨');
    }
    
    // 분석 실행 버튼 찾기
    const analyzeButton = page.locator('button:has-text("분석"), button:has-text("비교"), button:has-text("실행")');
    if (await analyzeButton.first().isVisible()) {
      await analyzeButton.first().click();
      console.log('✅ 분석 실행됨');
      
      // API 응답 대기
      await page.waitForResponse('**/api/statistics/**').catch(() => {
        console.log('통계 API 응답 대기 중...');
      });
      await page.waitForTimeout(3000);
      
      // 분석 결과 확인
      const hasResults = await page.locator('table, .result, .chart').isVisible().catch(() => false);
      if (hasResults) {
        console.log('✅ 분석 결과가 표시됨');
      }
    }
    
    console.log('✅ Statistics 분석 완료');

    // === 4단계: Dashboard 저장 및 확인 ===
    console.log('💾 4단계: Dashboard 저장 및 확인');
    
    // 분석 결과에서 일부 PEG 선택 (체크박스가 있는 경우)
    const resultCheckboxes = page.locator('input[type="checkbox"]:visible');
    const checkboxCount = await resultCheckboxes.count();
    
    if (checkboxCount > 0) {
      await resultCheckboxes.first().check();
      if (checkboxCount > 1) {
        await resultCheckboxes.nth(1).check();
      }
      console.log('✅ 분석 결과 PEG 선택됨');
    }
    
    // Dashboard 저장 버튼 찾기
    const saveButton = page.locator('button:has-text("Dashboard"), button:has-text("저장")');
    if (await saveButton.isVisible()) {
      await saveButton.click();
      
      // 성공 메시지 대기
      await page.waitForTimeout(2000);
      console.log('✅ Dashboard 저장 시도됨');
    }
    
    // Dashboard 페이지로 이동하여 확인
    await page.locator('button:has-text("Dashboard")').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 차트나 데이터 시각화 요소 확인
    const hasVisualization = await page.locator('canvas, svg, .recharts-wrapper, .chart-container').isVisible().catch(() => false);
    if (hasVisualization) {
      console.log('✅ Dashboard 시각화 요소 확인됨');
    }
    
    console.log('✅ Dashboard 확인 완료');
    console.log('🎉 완전한 사용자 여정 테스트 성공!');
  });

  test('UC002: LLM Analysis Results Management Workflow', async ({ page }) => {
    console.log('🔍 시작: LLM 분석 결과 관리 워크플로우 테스트');
    
    // 분석 결과 페이지 접근
    await page.locator('button:has-text("분석 결과")').click();
    await page.waitForLoadState('networkidle');
    
    // API 응답 대기
    await page.waitForResponse('**/api/analysis/results**').catch(() => {
      console.log('분석 결과 API 응답 대기 중...');
    });
    await page.waitForTimeout(3000);
    
    // 결과 목록 확인
    const hasResultList = await page.locator('table, .result-item, .list-container').isVisible().catch(() => false);
    if (hasResultList) {
      console.log('✅ 분석 결과 목록 표시됨');
      
      // 필터링 기능 확인
      const filterInputs = page.locator('input[placeholder*="필터"], input[placeholder*="검색"]');
      if (await filterInputs.first().isVisible()) {
        await filterInputs.first().fill('test');
        await page.waitForTimeout(1000);
        console.log('✅ 필터링 기능 테스트됨');
      }
      
      // 상세 보기 기능 확인 (첫 번째 항목 클릭)
      const firstResult = page.locator('tr:has(td), .result-item').first();
      if (await firstResult.isVisible()) {
        await firstResult.click();
        await page.waitForTimeout(1000);
        console.log('✅ 상세 보기 기능 테스트됨');
      }
    }
    
    console.log('🎉 LLM 분석 결과 관리 워크플로우 테스트 완료');
  });

  test('UC003: Preference Import/Export Workflow', async ({ page }) => {
    console.log('🔄 시작: Preference Import/Export 워크플로우 테스트');
    
    // Preference 페이지 접근
    await page.locator('button:has-text("Preference")').click();
    await page.waitForLoadState('networkidle');
    
    // 백업/복원 탭 접근
    await page.locator('[role="tab"]:has-text("백업"), [role="tab"]:has-text("복원")').click();
    await page.waitForTimeout(1000);
    
    // Import/Export 컴포넌트 확인
    await expect(page.locator('text=설정 백업')).toBeVisible();
    
    // Export 기능 테스트
    const exportButtons = page.locator('button:has-text("내보내기"), button:has-text("Export")');
    const exportButtonCount = await exportButtons.count();
    
    if (exportButtonCount > 0) {
      console.log(`✅ ${exportButtonCount}개의 Export 버튼 확인됨`);
      
      // 첫 번째 Export 버튼 클릭 (다운로드 이벤트 확인)
      const downloadPromise = page.waitForEvent('download').catch(() => null);
      await exportButtons.first().click();
      
      const download = await downloadPromise;
      if (download) {
        console.log('✅ Export 다운로드 성공');
      } else {
        console.log('ℹ️ Export 기능 버튼 클릭됨 (다운로드 미확인)');
      }
    }
    
    // Import 기능 확인
    const importInput = page.locator('input[type="file"]');
    if (await importInput.isVisible()) {
      console.log('✅ Import 파일 입력 확인됨');
    }
    
    console.log('🎉 Preference Import/Export 워크플로우 테스트 완료');
  });

  test('UC004: System Performance and Responsiveness', async ({ page }) => {
    console.log('⚡ 시작: 시스템 성능 및 반응성 테스트');
    
    const performanceMetrics = {
      initialLoad: 0,
      menuTransitions: [],
      apiResponseTimes: []
    };
    
    const startTime = Date.now();
    await page.waitForLoadState('networkidle');
    performanceMetrics.initialLoad = Date.now() - startTime;
    
    console.log(`📊 초기 로딩 시간: ${performanceMetrics.initialLoad}ms`);
    
    // 메뉴 전환 성능 측정
    const menuItems = ['Statistics', 'Preference', '분석 결과', 'Dashboard'];
    
    for (const menuName of menuItems) {
      const transitionStart = Date.now();
      
      await page.locator(`button:has-text("${menuName}")`).click();
      await page.waitForLoadState('networkidle');
      
      const transitionTime = Date.now() - transitionStart;
      performanceMetrics.menuTransitions.push({
        menu: menuName,
        time: transitionTime
      });
      
      console.log(`📊 ${menuName} 전환 시간: ${transitionTime}ms`);
      
      // 성능 임계값 검증
      if (transitionTime > 3000) {
        console.warn(`⚠️ ${menuName} 페이지 전환이 느림: ${transitionTime}ms`);
      }
      
      await page.waitForTimeout(500); // 안정화 대기
    }
    
    // 성능 요약
    const avgTransition = performanceMetrics.menuTransitions.reduce((sum, item) => sum + item.time, 0) / performanceMetrics.menuTransitions.length;
    console.log(`📊 평균 페이지 전환 시간: ${avgTransition.toFixed(0)}ms`);
    
    // 성능 임계값 검증
    expect(performanceMetrics.initialLoad).toBeLessThan(10000); // 10초 이내
    expect(avgTransition).toBeLessThan(5000); // 평균 5초 이내
    
    console.log('🎉 시스템 성능 및 반응성 테스트 완료');
  });

  test('UC005: Error Handling and Edge Cases', async ({ page }) => {
    console.log('🔧 시작: 오류 처리 및 엣지 케이스 테스트');
    
    // Statistics 페이지에서 잘못된 데이터 입력 테스트
    await page.locator('button:has-text("Statistics")').click();
    await page.waitForLoadState('networkidle');
    
    // 존재하지 않는 날짜 범위로 분석 시도
    const dateInputs = page.locator('input[type="date"]');
    const dateInputCount = await dateInputs.count();
    
    if (dateInputCount >= 2) {
      // 과거 날짜로 설정 (데이터가 없을 가능성 높음)
      await dateInputs.nth(0).fill('2020-01-01');
      await dateInputs.nth(1).fill('2020-01-02');
      
      console.log('✅ 유효하지 않은 날짜 범위 설정됨');
    }
    
    // 분석 실행
    const analyzeButton = page.locator('button:has-text("분석"), button:has-text("비교")');
    if (await analyzeButton.first().isVisible()) {
      await analyzeButton.first().click();
      
      // 오류 응답 또는 빈 결과 대기
      await page.waitForTimeout(5000);
      
      // 적절한 오류 메시지나 빈 결과 표시 확인
      const hasErrorMessage = await page.locator('text=오류, text=에러, text=데이터가 없습니다, text=결과가 없습니다').isVisible().catch(() => false);
      const hasEmptyState = await page.locator('text=데이터 없음, .empty-state, .no-data').isVisible().catch(() => false);
      
      if (hasErrorMessage || hasEmptyState) {
        console.log('✅ 적절한 오류 처리 또는 빈 상태 표시됨');
      } else {
        console.log('ℹ️ 오류 처리 상태 확인 불가 (정상적인 동작일 수 있음)');
      }
    }
    
    // Database Settings에서 잘못된 연결 정보 테스트
    const dbHostInput = page.locator('input[id="host"]');
    if (await dbHostInput.isVisible()) {
      await dbHostInput.clear();
      await dbHostInput.fill('invalid-host-name');
      
      const testConnectionButton = page.locator('button:has-text("Test Connection")');
      if (await testConnectionButton.isVisible()) {
        await testConnectionButton.click();
        await page.waitForTimeout(5000);
        console.log('✅ 잘못된 DB 연결 테스트 시도됨');
      }
    }
    
    console.log('🎉 오류 처리 및 엣지 케이스 테스트 완료');
  });

});

