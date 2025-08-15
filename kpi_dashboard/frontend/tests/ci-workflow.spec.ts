import { test, expect } from '@playwright/test';

/**
 * CI 환경용 안정적인 E2E 테스트
 * 
 * 핵심 기능만을 검증하여 CI 파이프라인에서 안정적으로 실행
 */
test.describe('CI Environment E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // CI 환경에서 더 긴 타임아웃 설정
    test.setTimeout(90000);
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // 초기 로딩 대기
    await page.waitForSelector('h1:has-text("3GPP KPI Dashboard")', { timeout: 15000 });
  });

  test('CI-001: Basic Application Loading', async ({ page }) => {
    console.log('🚀 시작: CI 기본 애플리케이션 로딩 테스트');
    
    // 헤더 확인
    await expect(page.locator('h1:has-text("3GPP KPI Dashboard")')).toBeVisible();
    
    // 사이드바 메뉴 확인
    await expect(page.locator('button:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('button:has-text("분석 결과")')).toBeVisible();
    await expect(page.locator('button:has-text("Statistics")')).toBeVisible();
    await expect(page.locator('button:has-text("Preference")')).toBeVisible();
    
    console.log('✅ 기본 UI 요소 확인 완료');
  });

  test('CI-002: Menu Navigation Test', async ({ page }) => {
    console.log('📱 시작: CI 메뉴 네비게이션 테스트');
    
    // 각 메뉴 순서대로 테스트
    const menus = ['Statistics', 'Preference'];
    
    for (const menu of menus) {
      console.log(`🔍 ${menu} 메뉴 테스트`);
      
      // 사이드바 메뉴 클릭 (더 구체적인 셀렉터 사용)
      await page.locator(`aside button:has-text("${menu}")`).click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      console.log(`✅ ${menu} 페이지 로딩 완료`);
    }
    
    console.log('🎉 메뉴 네비게이션 테스트 완료');
  });

  test('CI-003: API Endpoints Health Check', async ({ page }) => {
    console.log('🌐 시작: CI API 엔드포인트 상태 확인');
    
    // API 호출 모니터링
    const apiCalls = {
      masterInfo: false,
      masterPegs: false,
      masterCells: false
    };
    
    // API 응답 리스너 설정
    page.on('response', response => {
      const url = response.url();
      const status = response.status();
      
      if (url.includes('/api/master/info') && status === 200) {
        apiCalls.masterInfo = true;
        console.log('📊 Master Info API: OK');
      }
      if (url.includes('/api/master/pegs') && status === 200) {
        apiCalls.masterPegs = true;
        console.log('📊 Master PEGs API: OK');
      }
      if (url.includes('/api/master/cells') && status === 200) {
        apiCalls.masterCells = true;
        console.log('📊 Master Cells API: OK');
      }
    });
    
    // Statistics 페이지 방문하여 API 호출 유발
    await page.locator('aside button:has-text("Statistics")').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // 결과 확인
    console.log('📊 API 호출 결과:', apiCalls);
    
    // 최소 하나의 API는 성공해야 함
    const hasApiSuccess = Object.values(apiCalls).some(Boolean);
    expect(hasApiSuccess).toBe(true);
    
    console.log('🎉 API 상태 확인 완료');
  });

  test('CI-004: Preference Page Structure', async ({ page }) => {
    console.log('⚙️ 시작: CI Preference 페이지 구조 테스트');
    
    // Preference 페이지 접근
    await page.locator('aside button:has-text("Preference")').click();
    await page.waitForLoadState('networkidle');
    
    // 헤더 확인
    await expect(page.locator('h2:has-text("환경설정")')).toBeVisible();
    
    // 주요 탭 확인
    await expect(page.locator('[role="tab"]:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Statistics")')).toBeVisible();
    
    console.log('✅ Preference 페이지 구조 확인 완료');
  });

  test('CI-005: Statistics Page Structure', async ({ page }) => {
    console.log('📊 시작: CI Statistics 페이지 구조 테스트');
    
    // Statistics 페이지 접근
    await page.locator('aside button:has-text("Statistics")').click();
    await page.waitForLoadState('networkidle');
    
    // 헤더 확인
    await expect(page.locator('h2:has-text("Statistics")')).toBeVisible();
    
    // Database Settings 카드 확인
    await expect(page.locator('text=Database Settings')).toBeVisible();
    
    // 탭 구조 확인
    await expect(page.locator('[role="tab"]:has-text("Basic Analysis")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Advanced Analysis")')).toBeVisible();
    
    console.log('✅ Statistics 페이지 구조 확인 완료');
  });

  test('CI-006: Performance Baseline Check', async ({ page }) => {
    console.log('⚡ 시작: CI 성능 기준 확인');
    
    const startTime = Date.now();
    
    // 초기 로딩 시간 측정
    await page.waitForLoadState('networkidle');
    const initialLoadTime = Date.now() - startTime;
    console.log(`📊 초기 로딩 시간: ${initialLoadTime}ms`);
    
    // 페이지 전환 시간 측정
    const transitionStart = Date.now();
    await page.locator('aside button:has-text("Statistics")').click();
    await page.waitForLoadState('networkidle');
    const transitionTime = Date.now() - transitionStart;
    console.log(`📊 페이지 전환 시간: ${transitionTime}ms`);
    
    // 성능 기준 검증 (CI 환경에서는 더 관대하게)
    expect(initialLoadTime).toBeLessThan(10000); // 10초 이내
    expect(transitionTime).toBeLessThan(5000);   // 5초 이내
    
    console.log('✅ 성능 기준 확인 완료');
  });

});
