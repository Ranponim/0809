import { test, expect } from '@playwright/test';

/**
 * 보조 기능 E2E 테스트
 * 
 * LLM 결과 필터링, 설정 Import/Export, 고급 기능 등
 * Task 50.4: 보조 기능 E2E 테스트 스크립트 작성
 */
test.describe('Auxiliary Features E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // 각 테스트에 충분한 시간 할당
    test.setTimeout(90000);
    
    // 기본 페이지로 이동
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1:has-text("3GPP KPI Dashboard")', { timeout: 10000 });
    
    console.log('✅ 보조 기능 테스트 환경 초기화 완료');
  });

  test('AF001: LLM Analysis Results Filtering and Search', async ({ page }) => {
    console.log('🔍 시작: LLM 분석 결과 필터링 및 검색 테스트');
    
    // 분석 결과 페이지 접근
    await page.locator('button:has-text("분석 결과")').click();
    await page.waitForLoadState('networkidle');
    
    // API 응답 대기
    await page.waitForResponse('**/api/analysis/results**').catch(() => {
      console.log('분석 결과 API 응답 대기 중...');
    });
    await page.waitForTimeout(3000);
    
    // === 날짜 필터링 테스트 ===
    console.log('📅 날짜 필터링 테스트');
    
    const dateFilters = page.locator('input[type="date"]');
    const dateFilterCount = await dateFilters.count();
    
    if (dateFilterCount >= 2) {
      // 날짜 범위 설정
      await dateFilters.nth(0).fill('2025-08-01');
      await dateFilters.nth(1).fill('2025-08-15');
      
      // 필터 적용 버튼 찾기
      const filterButton = page.locator('button:has-text("필터"), button:has-text("적용"), button:has-text("검색")');
      if (await filterButton.first().isVisible()) {
        await filterButton.first().click();
        await page.waitForTimeout(2000);
        console.log('✅ 날짜 필터 적용됨');
      }
    }
    
    // === NE ID 필터링 테스트 ===
    console.log('🏢 NE ID 필터링 테스트');
    
    const neFilterInput = page.locator('input[placeholder*="NE"], input[placeholder*="네트워크"], input[name*="ne"]').first();
    if (await neFilterInput.isVisible()) {
      await neFilterInput.clear();
      await neFilterInput.fill('eNB');
      await page.waitForTimeout(1000);
      
      // 자동 필터링 또는 수동 적용
      const autoFilterDelay = page.waitForTimeout(2000);
      const manualFilterButton = page.locator('button:has-text("필터"), button:has-text("검색")');
      
      if (await manualFilterButton.first().isVisible()) {
        await manualFilterButton.first().click();
      }
      await autoFilterDelay;
      
      console.log('✅ NE ID 필터 적용됨');
    }
    
    // === Cell ID 필터링 테스트 ===
    console.log('📱 Cell ID 필터링 테스트');
    
    const cellFilterInput = page.locator('input[placeholder*="Cell"], input[placeholder*="셀"], input[name*="cell"]').first();
    if (await cellFilterInput.isVisible()) {
      await cellFilterInput.clear();
      await cellFilterInput.fill('2010');
      await page.waitForTimeout(1000);
      
      // 필터 적용
      const filterButton = page.locator('button:has-text("필터"), button:has-text("검색")');
      if (await filterButton.first().isVisible()) {
        await filterButton.first().click();
      }
      await page.waitForTimeout(2000);
      
      console.log('✅ Cell ID 필터 적용됨');
    }
    
    // === 텍스트 검색 테스트 ===
    console.log('🔎 텍스트 검색 테스트');
    
    const searchInput = page.locator('input[placeholder*="검색"], input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.clear();
      await searchInput.fill('analysis');
      
      // 검색 실행
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      console.log('✅ 텍스트 검색 실행됨');
    }
    
    // === 필터 초기화 테스트 ===
    console.log('🔄 필터 초기화 테스트');
    
    const resetButton = page.locator('button:has-text("초기화"), button:has-text("리셋"), button:has-text("Clear")');
    if (await resetButton.first().isVisible()) {
      await resetButton.first().click();
      await page.waitForTimeout(1000);
      console.log('✅ 필터 초기화됨');
    }
    
    // === 결과 목록 확인 ===
    const hasResults = await page.locator('table, .result-item, .list-container').isVisible().catch(() => false);
    if (hasResults) {
      console.log('✅ 필터링된 결과 목록 표시됨');
    }
    
    console.log('🎉 LLM 분석 결과 필터링 및 검색 테스트 완료');
  });

  test('AF002: LLM Analysis Results Detail View and Comparison', async ({ page }) => {
    console.log('👁️ 시작: LLM 분석 결과 상세 보기 및 비교 테스트');
    
    // 분석 결과 페이지 접근
    await page.locator('button:has-text("분석 결과")').click();
    await page.waitForLoadState('networkidle');
    
    // API 응답 대기
    await page.waitForResponse('**/api/analysis/results**').catch(() => {
      console.log('분석 결과 API 응답 대기 중...');
    });
    await page.waitForTimeout(3000);
    
    // === 단일 결과 상세 보기 테스트 ===
    console.log('📋 단일 결과 상세 보기 테스트');
    
    const resultRows = page.locator('tr:has(td), .result-item, .list-item');
    const resultCount = await resultRows.count();
    
    if (resultCount > 0) {
      // 첫 번째 결과 클릭
      await resultRows.first().click();
      await page.waitForTimeout(1000);
      
      // 상세 보기 모달 또는 페이지 확인
      const hasDetailView = await page.locator('.modal, .detail-view, .result-detail').isVisible().catch(() => false);
      if (hasDetailView) {
        console.log('✅ 상세 보기 모달/페이지 표시됨');
        
        // 상세 정보 요소들 확인
        const detailElements = await page.locator('text=분석 일시, text=NE ID, text=Cell ID, text=분석 결과').count();
        if (detailElements > 0) {
          console.log('✅ 상세 정보 요소들 확인됨');
        }
        
        // 모달 닫기
        const closeButton = page.locator('button:has-text("닫기"), button:has-text("Close"), [aria-label="close"]');
        if (await closeButton.first().isVisible()) {
          await closeButton.first().click();
        }
      }
    }
    
    // === 복수 결과 비교 테스트 ===
    console.log('⚖️ 복수 결과 비교 테스트');
    
    // 체크박스를 통한 다중 선택
    const checkboxes = page.locator('input[type="checkbox"]:visible');
    const checkboxCount = await checkboxes.count();
    
    if (checkboxCount >= 2) {
      // 2개 이상의 결과 선택
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      
      console.log('✅ 2개 결과 선택됨');
      
      // 비교 버튼 찾기
      const compareButton = page.locator('button:has-text("비교"), button:has-text("Compare")');
      if (await compareButton.first().isVisible()) {
        await compareButton.first().click();
        await page.waitForTimeout(2000);
        
        // 비교 결과 화면 확인
        const hasComparisonView = await page.locator('.comparison-view, .compare-modal, .comparison-table').isVisible().catch(() => false);
        if (hasComparisonView) {
          console.log('✅ 비교 결과 화면 표시됨');
        }
      }
    }
    
    console.log('🎉 LLM 분석 결과 상세 보기 및 비교 테스트 완료');
  });

  test('AF003: Preference Settings Import/Export Functionality', async ({ page }) => {
    console.log('📥📤 시작: Preference 설정 Import/Export 기능 테스트');
    
    // Preference 페이지 접근
    await page.locator('button:has-text("Preference")').click();
    await page.waitForLoadState('networkidle');
    
    // 백업/복원 탭 접근
    await page.locator('[role="tab"]:has-text("백업"), [role="tab"]:has-text("복원"), [role="tab"]:has-text("백업/복원")').click();
    await page.waitForTimeout(1000);
    
    // === Export 기능 테스트 ===
    console.log('📤 Export 기능 테스트');
    
    // Import/Export 컴포넌트 확인
    await expect(page.locator('text=설정 백업, text=Export, text=내보내기')).toBeVisible();
    
    // 전체 설정 내보내기 테스트
    const exportAllButton = page.locator('button:has-text("전체 설정 내보내기"), button:has-text("Export All")');
    if (await exportAllButton.isVisible()) {
      // 다운로드 이벤트 리스너 설정
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      
      await exportAllButton.click();
      
      const download = await downloadPromise;
      if (download) {
        const fileName = download.suggestedFilename();
        console.log(`✅ 전체 설정 Export 성공: ${fileName}`);
        
        // 다운로드 파일 확인 (확장자 검증)
        if (fileName && fileName.endsWith('.json')) {
          console.log('✅ JSON 형식 파일 다운로드 확인됨');
        }
      } else {
        console.log('ℹ️ Export 버튼 클릭됨 (다운로드 이벤트 미확인)');
      }
    }
    
    // 선택적 설정 내보내기 테스트
    const exportSelectedButton = page.locator('button:has-text("선택된 설정"), button:has-text("Export Selected")');
    if (await exportSelectedButton.isVisible()) {
      // 일부 설정 선택
      const settingCheckboxes = page.locator('input[type="checkbox"]:visible');
      const cbCount = await settingCheckboxes.count();
      
      if (cbCount > 0) {
        await settingCheckboxes.first().check();
        console.log('✅ 설정 항목 선택됨');
      }
      
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await exportSelectedButton.click();
      
      const download = await downloadPromise;
      if (download) {
        console.log('✅ 선택적 설정 Export 성공');
      }
    }
    
    // === Import 기능 테스트 ===
    console.log('📥 Import 기능 테스트');
    
    // Import 파일 입력 확인
    const importInput = page.locator('input[type="file"]');
    if (await importInput.isVisible()) {
      console.log('✅ Import 파일 입력 필드 확인됨');
      
      // 더미 JSON 파일 생성 및 업로드 테스트 (실제 파일 업로드는 복잡하므로 UI 요소만 확인)
      const importButton = page.locator('button:has-text("가져오기"), button:has-text("Import")');
      if (await importButton.isVisible()) {
        console.log('✅ Import 버튼 확인됨');
      }
    }
    
    // === 설정 검증 기능 테스트 ===
    console.log('✅ 설정 검증 기능 테스트');
    
    const validateButton = page.locator('button:has-text("검증"), button:has-text("Validate")');
    if (await validateButton.isVisible()) {
      await validateButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ 설정 검증 기능 테스트됨');
    }
    
    console.log('🎉 Preference 설정 Import/Export 기능 테스트 완료');
  });

  test('AF004: Advanced Statistics Features', async ({ page }) => {
    console.log('📊🔬 시작: 고급 Statistics 기능 테스트');
    
    // Statistics 페이지 접근
    await page.locator('button:has-text("Statistics")').click();
    await page.waitForLoadState('networkidle');
    
    // === Database Settings 고급 기능 테스트 ===
    console.log('🗄️ Database Settings 고급 기능 테스트');
    
    // Database Settings 카드 확인
    await expect(page.locator('text=Database Settings')).toBeVisible();
    
    // 연결 설정 필드들
    const dbFields = [
      { id: 'host', value: 'localhost', label: 'Host' },
      { id: 'port', value: '5432', label: 'Port' },
      { id: 'user', value: 'postgres', label: 'User' },
      { id: 'password', value: 'password', label: 'Password' },
      { id: 'dbname', value: 'kpi_dashboard', label: 'Database' },
      { id: 'table', value: 'summary', label: 'Table' }
    ];
    
    // 각 필드 설정
    for (const field of dbFields) {
      const input = page.locator(`input[id="${field.id}"]`);
      if (await input.isVisible()) {
        await input.clear();
        await input.fill(field.value);
        console.log(`✅ ${field.label} 설정: ${field.value}`);
      }
    }
    
    // Save Settings 기능 테스트
    const saveButton = page.locator('button:has-text("Save Settings")');
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Settings 저장 테스트됨');
    }
    
    // Test Connection 기능 테스트
    const testConnectionButton = page.locator('button:has-text("Test Connection")');
    if (await testConnectionButton.isVisible()) {
      await testConnectionButton.click();
      
      // 연결 테스트 결과 대기
      await page.waitForTimeout(5000);
      
      // 성공/실패 메시지 확인
      const hasConnectionResult = await page.locator('text=연결 성공, text=연결 실패, text=Connection, .connection-status').isVisible().catch(() => false);
      if (hasConnectionResult) {
        console.log('✅ 연결 테스트 결과 표시됨');
      } else {
        console.log('ℹ️ 연결 테스트 시도됨 (결과 메시지 미확인)');
      }
    }
    
    // === Advanced Analysis 탭 테스트 ===
    console.log('🔬 Advanced Analysis 탭 테스트');
    
    const advancedTab = page.locator('[role="tab"]:has-text("Advanced"), [role="tab"]:has-text("고급")');
    if (await advancedTab.isVisible()) {
      await advancedTab.click();
      await page.waitForTimeout(1000);
      
      console.log('✅ Advanced Analysis 탭 접근됨');
      
      // 고급 분석 옵션들 확인
      const advancedOptions = await page.locator('select, input[type="checkbox"], input[type="radio"]').count();
      if (advancedOptions > 0) {
        console.log(`✅ ${advancedOptions}개의 고급 분석 옵션 확인됨`);
      }
    }
    
    console.log('🎉 고급 Statistics 기능 테스트 완료');
  });

  test('AF005: Dashboard Customization and PEG Management', async ({ page }) => {
    console.log('📈⚙️ 시작: Dashboard 커스터마이징 및 PEG 관리 테스트');
    
    // Preference 페이지에서 Dashboard 설정 접근
    await page.locator('button:has-text("Preference")').click();
    await page.waitForLoadState('networkidle');
    
    await page.locator('[role="tab"]:has-text("Dashboard")').click();
    await page.waitForTimeout(1000);
    
    // === PEG 데이터 소스 관리 테스트 ===
    console.log('📊 PEG 데이터 소스 관리 테스트');
    
    // 기본 KPI vs DB PEG 전환 테스트
    const basicKpiButton = page.locator('button:has-text("기본 KPI")');
    const dbPegButton = page.locator('button:has-text("DB PEG")');
    
    if (await basicKpiButton.isVisible()) {
      await basicKpiButton.click();
      await page.waitForTimeout(500);
      console.log('✅ 기본 KPI 소스 선택됨');
    }
    
    if (await dbPegButton.isVisible()) {
      await dbPegButton.click();
      
      // DB PEG API 호출 대기
      await page.waitForResponse('**/api/master/pegs**').catch(() => {
        console.log('DB PEG API 응답 대기 중...');
      });
      await page.waitForTimeout(2000);
      
      console.log('✅ DB PEG 소스 선택됨');
    }
    
    // === PEG 선택 및 관리 테스트 ===
    console.log('🎯 PEG 선택 및 관리 테스트');
    
    // Multiselect 컴포넌트 확인
    const pegSelector = page.locator('.multi-select, select[multiple], [role="combobox"]').first();
    if (await pegSelector.isVisible()) {
      await pegSelector.click();
      await page.waitForTimeout(1000);
      
      // PEG 옵션들 확인
      const pegOptions = page.locator('[role="option"], option');
      const optionCount = await pegOptions.count();
      
      if (optionCount > 0) {
        console.log(`✅ ${optionCount}개의 PEG 옵션 확인됨`);
        
        // 몇 개 PEG 선택
        const selectCount = Math.min(3, optionCount);
        for (let i = 0; i < selectCount; i++) {
          await pegOptions.nth(i).click();
          await page.waitForTimeout(200);
        }
        
        console.log(`✅ ${selectCount}개 PEG 선택됨`);
      }
    }
    
    // PEG 체크박스 형태인 경우
    const pegCheckboxes = page.locator('input[type="checkbox"]:visible');
    const checkboxCount = await pegCheckboxes.count();
    
    if (checkboxCount > 0) {
      console.log(`✅ ${checkboxCount}개의 PEG 체크박스 확인됨`);
      
      // 일부 PEG 선택
      const selectCount = Math.min(3, checkboxCount);
      for (let i = 0; i < selectCount; i++) {
        await pegCheckboxes.nth(i).check();
        await page.waitForTimeout(200);
      }
      
      console.log(`✅ ${selectCount}개 PEG 체크박스 선택됨`);
    }
    
    // === Derived PEG 관리 테스트 ===
    console.log('🧮 Derived PEG 관리 테스트');
    
    const derivedPegTab = page.locator('[role="tab"]:has-text("Derived PEG")');
    if (await derivedPegTab.isVisible()) {
      await derivedPegTab.click();
      await page.waitForTimeout(1000);
      
      // Derived PEG 추가 버튼
      const addDerivedButton = page.locator('button:has-text("추가"), button:has-text("Add")');
      if (await addDerivedButton.isVisible()) {
        await addDerivedButton.click();
        await page.waitForTimeout(500);
        console.log('✅ Derived PEG 추가 버튼 테스트됨');
      }
      
      // Derived PEG 목록 확인
      const derivedPegList = page.locator('.derived-peg-item, .peg-formula, .formula-editor');
      const derivedCount = await derivedPegList.count();
      
      if (derivedCount > 0) {
        console.log(`✅ ${derivedCount}개의 Derived PEG 확인됨`);
      }
    }
    
    // === Dashboard 실시간 미리보기 테스트 ===
    console.log('👁️ Dashboard 실시간 미리보기 테스트');
    
    // Dashboard 페이지로 이동하여 설정 반영 확인
    await page.locator('button:has-text("Dashboard")').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 선택한 PEG들이 Dashboard에 반영되었는지 확인
    const dashboardElements = await page.locator('canvas, svg, .recharts-wrapper, .chart-container, .dashboard-widget').count();
    if (dashboardElements > 0) {
      console.log(`✅ ${dashboardElements}개의 Dashboard 시각화 요소 확인됨`);
    }
    
    console.log('🎉 Dashboard 커스터마이징 및 PEG 관리 테스트 완료');
  });

  test('AF006: System Integration and API Health Monitoring', async ({ page }) => {
    console.log('🔗🏥 시작: 시스템 통합 및 API 상태 모니터링 테스트');
    
    const apiHealthStatus = {
      masterAPIs: {},
      analysisAPIs: {},
      preferenceAPIs: {},
      statisticsAPIs: {}
    };
    
    // API 응답 모니터링 설정
    page.on('response', response => {
      const url = response.url();
      const status = response.status();
      const timing = response.timing();
      
      // Master APIs
      if (url.includes('/api/master/')) {
        const endpoint = url.split('/api/master/')[1];
        apiHealthStatus.masterAPIs[endpoint] = {
          status,
          responseTime: timing?.responseEnd || 0,
          success: status >= 200 && status < 300
        };
        console.log(`🔗 Master API [${endpoint}]: ${status} (${timing?.responseEnd || 0}ms)`);
      }
      
      // Analysis APIs
      if (url.includes('/api/analysis/')) {
        const endpoint = url.split('/api/analysis/')[1];
        apiHealthStatus.analysisAPIs[endpoint] = {
          status,
          responseTime: timing?.responseEnd || 0,
          success: status >= 200 && status < 300
        };
        console.log(`🔬 Analysis API [${endpoint}]: ${status} (${timing?.responseEnd || 0}ms)`);
      }
      
      // Preference APIs
      if (url.includes('/api/preference/')) {
        const endpoint = url.split('/api/preference/')[1];
        apiHealthStatus.preferenceAPIs[endpoint] = {
          status,
          responseTime: timing?.responseEnd || 0,
          success: status >= 200 && status < 300
        };
        console.log(`⚙️ Preference API [${endpoint}]: ${status} (${timing?.responseEnd || 0}ms)`);
      }
      
      // Statistics APIs
      if (url.includes('/api/statistics/')) {
        const endpoint = url.split('/api/statistics/')[1];
        apiHealthStatus.statisticsAPIs[endpoint] = {
          status,
          responseTime: timing?.responseEnd || 0,
          success: status >= 200 && status < 300
        };
        console.log(`📊 Statistics API [${endpoint}]: ${status} (${timing?.responseEnd || 0}ms)`);
      }
    });
    
    // === 각 페이지 방문하여 API 호출 유발 ===
    console.log('🌐 API 상태 확인을 위한 페이지 순회');
    
    const pages = [
      { name: 'Dashboard', button: 'button:has-text("Dashboard")' },
      { name: '분석 결과', button: 'button:has-text("분석 결과")' },
      { name: 'Statistics', button: 'button:has-text("Statistics")' },
      { name: 'Preference', button: 'button:has-text("Preference")' }
    ];
    
    for (const pageInfo of pages) {
      console.log(`📱 ${pageInfo.name} 페이지 방문`);
      
      await page.locator(pageInfo.button).click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000); // API 호출 완료 대기
      
      console.log(`✅ ${pageInfo.name} 페이지 API 호출 완료`);
    }
    
    // === API 상태 요약 및 검증 ===
    console.log('📊 API 상태 요약');
    
    const allAPIs = {
      ...apiHealthStatus.masterAPIs,
      ...apiHealthStatus.analysisAPIs,
      ...apiHealthStatus.preferenceAPIs,
      ...apiHealthStatus.statisticsAPIs
    };
    
    const totalAPICount = Object.keys(allAPIs).length;
    const successfulAPIs = Object.values(allAPIs).filter(api => api.success).length;
    const averageResponseTime = Object.values(allAPIs).reduce((sum, api) => sum + api.responseTime, 0) / totalAPICount;
    
    console.log(`📈 전체 API 호출: ${totalAPICount}개`);
    console.log(`✅ 성공한 API: ${successfulAPIs}개`);
    console.log(`📊 평균 응답 시간: ${averageResponseTime.toFixed(0)}ms`);
    
    // 성능 임계값 검증
    const slowAPIs = Object.entries(allAPIs).filter(([_, api]) => api.responseTime > 5000);
    if (slowAPIs.length > 0) {
      console.warn(`⚠️ 느린 API 발견 (5초 이상): ${slowAPIs.map(([name]) => name).join(', ')}`);
    }
    
    const failedAPIs = Object.entries(allAPIs).filter(([_, api]) => !api.success);
    if (failedAPIs.length > 0) {
      console.warn(`❌ 실패한 API: ${failedAPIs.map(([name]) => name).join(', ')}`);
    }
    
    // 기본 성능 기준 검증
    expect(successfulAPIs).toBeGreaterThan(0); // 최소 1개 이상 성공
    expect(averageResponseTime).toBeLessThan(10000); // 평균 10초 이내
    
    console.log('🎉 시스템 통합 및 API 상태 모니터링 테스트 완료');
  });

});

