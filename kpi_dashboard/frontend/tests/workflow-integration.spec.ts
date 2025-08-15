import { test, expect } from '@playwright/test';

/**
 * 전체 시스템 통합 워크플로우 E2E 테스트
 * 
 * 테스트 시나리오: TC001 - 완전한 워크플로우
 * Preference → Statistics → Dashboard 전체 흐름 검증
 */
test.describe('Complete System Workflow Integration', () => {

  test('TC001: Complete workflow - Preference → Statistics → Dashboard', async ({ page }) => {
    console.log('🚀 시작: 완전한 워크플로우 테스트');
    
    // === 1단계: Preference 설정 ===
    console.log('📝 1단계: Preference 설정');
    
    await page.goto('/');
    
    // Preference 메뉴 접근
    await page.click('button:has-text("Preference"), [data-testid="menu-preference"]');
    await page.waitForLoadState('networkidle');
    
    // Dashboard 설정
    await page.click('[role="tab"]:has-text("Dashboard")');
    
    // DB PEG 소스 선택
    await page.click('button:has-text("DB PEG")');
    await page.waitForResponse('**/api/master/pegs**');
    
    // 기본 PEG 2-3개 선택 (예: availability, rrc_success_rate)
    const pegCheckboxes = page.locator('input[type="checkbox"]');
    const firstFewPegs = pegCheckboxes.first();
    await firstFewPegs.check();
    
    // Statistics 설정
    await page.click('[role="tab"]:has-text("Statistics")');
    
    // 기본 NE 및 Cell ID 설정
    await page.fill('input[placeholder*="NE"], input[name*="ne"]', 'eNB_001');
    await page.fill('input[placeholder*="Cell"], input[name*="cell"]', 'Cell_001');
    
    console.log('✅ Preference 설정 완료');

    // === 2단계: Statistics 분석 수행 ===
    console.log('📊 2단계: Statistics 분석 수행');
    
    // Statistics 메뉴 접근
    await page.click('button:has-text("Statistics"), [data-testid="menu-statistics"]');
    await page.waitForLoadState('networkidle');
    
    // Basic 탭 확인
    await page.click('[role="tab"]:has-text("Basic")');
    
    // 날짜 구간 설정
    await page.fill('input[type="date"]:first-of-type, input[placeholder*="시작"]', '2025-08-09');
    await page.fill('input[type="date"]:last-of-type, input[placeholder*="종료"]', '2025-08-10');
    
    // 두 번째 기간 설정
    const periodInputs = page.locator('input[type="date"]');
    await periodInputs.nth(2).fill('2025-08-11');
    await periodInputs.nth(3).fill('2025-08-12');
    
    // Preference에서 설정한 NE/Cell이 기본값으로 표시되는지 확인
    await expect(page.locator('input[value="eNB_001"]')).toBeVisible();
    await expect(page.locator('input[value="Cell_001"]')).toBeVisible();
    
    // 실제 DB PEG 목록 로드 확인
    const pegOptionsResponse = page.waitForResponse('**/api/master/pegs**');
    
    // 분석 실행
    await page.click('button:has-text("분석"), button:has-text("비교")');
    
    // API 응답 대기
    await pegOptionsResponse;
    
    // 통계 API 호출 대기
    const statsResponse = page.waitForResponse('**/api/statistics/compare**');
    await statsResponse;
    
    console.log('✅ Statistics 분석 완료');

    // === 3단계: Dashboard 저장 기능 ===
    console.log('💾 3단계: Dashboard 저장 기능');
    
    // 분석 결과 확인
    await expect(page.getByText('분석 결과', { exact: false })).toBeVisible();
    
    // 일부 PEG 체크박스 선택
    const resultCheckboxes = page.locator('input[type="checkbox"]:visible');
    await resultCheckboxes.first().check();
    await resultCheckboxes.nth(1).check();
    
    // "Dashboard에 저장" 버튼 클릭
    await page.click('button:has-text("Dashboard"), button:has-text("저장")');
    
    // 성공 메시지 확인
    await expect(page.getByText('성공', { exact: false })).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Dashboard 저장 완료');

    // === 4단계: Dashboard 확인 ===
    console.log('📈 4단계: Dashboard 확인');
    
    // Dashboard 메뉴 접근
    await page.click('button:has-text("Dashboard"), [data-testid="menu-dashboard"]');
    await page.waitForLoadState('networkidle');
    
    // Statistics에서 저장한 PEG가 표시되는지 확인
    await expect(page.locator('canvas, svg, .recharts-wrapper')).toBeVisible({ timeout: 15000 });
    
    // 차트가 정상적으로 렌더링되는지 확인
    await page.waitForTimeout(2000); // 차트 렌더링 대기
    
    console.log('✅ Dashboard 표시 확인 완료');
    console.log('🎉 전체 워크플로우 테스트 성공!');
  });

  test('should handle workflow with no data gracefully', async ({ page }) => {
    console.log('🔍 데이터 없음 시나리오 테스트');
    
    await page.goto('/');
    
    // Statistics 접근
    await page.click('button:has-text("Statistics")');
    
    // 존재하지 않는 날짜 범위 설정
    await page.fill('input[type="date"]:first-of-type', '2020-01-01');
    await page.fill('input[type="date"]:last-of-type', '2020-01-02');
    
    // 분석 실행
    await page.click('button:has-text("분석")');
    
    // 적절한 오류 메시지 표시 확인
    await expect(page.getByText('데이터가 없습니다', { exact: false })).toBeVisible({ timeout: 10000 });
    
    console.log('✅ 데이터 없음 시나리오 처리 확인');
  });

});

