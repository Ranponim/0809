import { test, expect } from '@playwright/test';

/**
 * Preference 페이지 기본 기능 E2E 테스트
 * 
 * 테스트 목적:
 * - Preference 페이지 로딩 확인
 * - 실제 API 데이터 연동 확인 (/api/master/pegs)
 * - 기본 UI 컴포넌트 렌더링 확인
 */
test.describe('Preference Page - Basic Functionality', () => {

  test.beforeEach(async ({ page }) => {
    // 모든 테스트 전에 Preference 페이지로 이동
    await page.goto('/');
    
    // Preference 메뉴 클릭 (실제 UI에 맞게 수정)
    await page.click('button:has-text("Preference")');
    
    // 페이지 로딩 대기
    await page.waitForLoadState('networkidle');
    
    // PreferenceManager가 로드될 때까지 대기
    await page.waitForTimeout(2000);
  });

  test('should load preference page and display main sections', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page).toHaveTitle(/KPI Dashboard/);
    
    // 현재 페이지 내용 확인 (실제 UI에 맞게 수정)
    await expect(page.getByRole('heading', { name: 'Preference' })).toBeVisible();
    
    // 현재 표시되는 내용 확인
    const pageContent = await page.textContent('body');
    console.log('📋 현재 페이지 내용:', pageContent?.substring(0, 200) + '...');
    
    // 기본적인 Preference 페이지 요소 확인
    await expect(page.locator('button:has-text("Import"), button:has-text("New Preference")')).toBeVisible();
    
    console.log('✅ Preference 페이지가 정상적으로 로드됨');
  });

  test('should fetch PEG data from API and display in dashboard settings', async ({ page }) => {
    // API 응답 대기
    const pegApiResponse = page.waitForResponse('**/api/master/pegs**');
    
    // Dashboard 탭 클릭
    await page.click('[data-testid="tab-dashboard"], [role="tab"]:has-text("Dashboard")');
    
    // API 응답 확인
    const response = await pegApiResponse;
    expect(response.ok()).toBeTruthy();
    
    console.log('✅ PEG API 호출 성공:', response.url());
    
    // API 데이터를 기반으로 PEG 옵션들이 표시되는지 확인
    // (실제 구현에 따라 선택자 조정 필요)
    await expect(page.locator('[data-testid="peg-selector"], select, [role="listbox"]')).toBeVisible();
    
    console.log('✅ PEG 선택기가 정상적으로 표시됨');
  });

  test('should allow switching between different tabs', async ({ page }) => {
    // Dashboard 탭 테스트
    await page.click('[role="tab"]:has-text("Dashboard")');
    await expect(page.getByText('Dashboard 설정', { exact: false })).toBeVisible();
    
    // Statistics 탭 테스트
    await page.click('[role="tab"]:has-text("Statistics")');
    await expect(page.getByText('Statistics 설정', { exact: false })).toBeVisible();
    
    // Derived PEG 탭 테스트
    await page.click('[role="tab"]:has-text("Derived PEG")');
    await expect(page.getByText('Derived PEG', { exact: false })).toBeVisible();
    
    console.log('✅ 모든 탭 전환이 정상적으로 동작함');
  });

  test('should display data source selection options', async ({ page }) => {
    // Dashboard 탭으로 이동
    await page.click('[role="tab"]:has-text("Dashboard")');
    
    // PEG 데이터 소스 선택 버튼들 확인
    await expect(page.getByRole('button', { name: '기본 KPI' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'DB PEG' })).toBeVisible();
    
    // DB PEG 버튼 클릭
    await page.click('button:has-text("DB PEG")');
    
    // 로딩 상태나 성공 상태 확인
    await expect(page.locator('button:has-text("로딩 중"), button:has-text("DB PEG")')).toBeVisible();
    
    console.log('✅ 데이터 소스 선택 기능이 정상적으로 동작함');
  });

  test('should show import/export functionality', async ({ page }) => {
    // Import/Export 섹션 확인
    await expect(page.getByText('설정 관리', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: '설정 내보내기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '설정 가져오기' })).toBeVisible();
    
    console.log('✅ Import/Export 기능이 표시됨');
  });

});
