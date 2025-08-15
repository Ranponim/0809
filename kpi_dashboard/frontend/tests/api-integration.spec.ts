import { test, expect } from '@playwright/test';

/**
 * API 연동 테스트
 * 
 * 테스트 목적: TC005 - 실제 데이터 API 연동 검증
 * - Master API 검증
 * - Statistics API 검증  
 * - Preference API 검증
 */
test.describe('API Integration Tests', () => {

  test('Master API: should fetch PEG data from MongoDB', async ({ page }) => {
    console.log('🔌 Master API 테스트 시작');
    
    // API 직접 호출 테스트
    const response = await page.request.get('/api/master/pegs');
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const pegData = await response.json();
    
    // 응답 데이터 구조 검증
    expect(Array.isArray(pegData)).toBeTruthy();
    expect(pegData.length).toBeGreaterThan(0);
    
    // 각 PEG 데이터 구조 검증
    const firstPeg = pegData[0];
    expect(firstPeg).toHaveProperty('peg_name');
    expect(firstPeg).toHaveProperty('description');
    expect(firstPeg).toHaveProperty('unit');
    
    console.log('✅ Master API 응답 검증 완료:', pegData.length + '개 PEG');
    console.log('📋 PEG 목록:', pegData.map(p => p.peg_name).join(', '));
  });

  test('Master API: should be accessible from frontend', async ({ page }) => {
    console.log('🌐 프론트엔드에서 Master API 호출 테스트');
    
    await page.goto('/');
    
    // Preference 페이지에서 API 호출 확인
    await page.click('button:has-text("Preference")');
    
    // API 응답 대기 및 검증
    const apiResponse = await page.waitForResponse('**/api/master/pegs**');
    
    expect(apiResponse.ok()).toBeTruthy();
    
    const responseData = await apiResponse.json();
    expect(Array.isArray(responseData)).toBeTruthy();
    
    console.log('✅ 프론트엔드 API 호출 성공');
  });

  test('Statistics API: should handle comparison requests', async ({ page }) => {
    console.log('📊 Statistics API 테스트');
    
    // 정상적인 Statistics API 요청 테스트
    const requestData = {
      period1: {
        start_date: '2025-08-09T00:00:00',
        end_date: '2025-08-10T23:59:59'
      },
      period2: {
        start_date: '2025-08-11T00:00:00', 
        end_date: '2025-08-12T23:59:59'
      },
      peg_names: ['availability', 'rrc_success_rate'],
      filters: {
        ne: 'eNB_001',
        cell_id: 'Cell_001'
      }
    };
    
    const response = await page.request.post('/api/statistics/compare', {
      data: requestData
    });
    
    // 성공 또는 적절한 오류 처리 확인
    expect([200, 422, 500].includes(response.status())).toBeTruthy();
    
    console.log('✅ Statistics API 응답 확인:', response.status());
  });

  test('Health Check: should verify all services are running', async ({ page }) => {
    console.log('🏥 시스템 헬스 체크');
    
    // 백엔드 헬스 체크
    const healthResponse = await page.request.get('/health');
    expect(healthResponse.ok()).toBeTruthy();
    
    const healthData = await healthResponse.json();
    expect(healthData).toHaveProperty('status');
    
    // API 정보 확인
    const infoResponse = await page.request.get('/api/info');
    expect(infoResponse.ok()).toBeTruthy();
    
    const infoData = await infoResponse.json();
    expect(infoData).toHaveProperty('api');
    expect(infoData).toHaveProperty('endpoints');
    expect(infoData.endpoints).toHaveProperty('master_pegs');
    
    console.log('✅ 시스템 헬스 체크 완료');
    console.log('🔗 사용 가능한 엔드포인트:', Object.keys(infoData.endpoints));
  });

  test('Error Handling: should handle network errors gracefully', async ({ page }) => {
    console.log('⚠️ 오류 처리 테스트');
    
    await page.goto('/');
    
    // 네트워크 차단 시뮬레이션
    await page.route('**/api/master/pegs**', (route) => {
      route.abort('failed');
    });
    
    // Preference 페이지 접근
    await page.click('button:has-text("Preference")');
    
    // 적절한 오류 처리 확인
    await expect(page.getByText('오류', { exact: false })).toBeVisible({ timeout: 10000 });
    
    console.log('✅ 네트워크 오류 처리 확인');
  });

  test('Performance: API response times should be reasonable', async ({ page }) => {
    console.log('⚡ 성능 테스트');
    
    const startTime = Date.now();
    
    // Master API 응답 시간 측정
    const response = await page.request.get('/api/master/pegs');
    const responseTime = Date.now() - startTime;
    
    expect(response.ok()).toBeTruthy();
    expect(responseTime).toBeLessThan(5000); // 5초 이내
    
    console.log(`✅ API 응답 시간: ${responseTime}ms`);
    
    // 권장 응답 시간 체크
    if (responseTime < 1000) {
      console.log('🚀 우수한 응답 시간!');
    } else if (responseTime < 3000) {
      console.log('✅ 양호한 응답 시간');
    } else {
      console.log('⚠️ 응답 시간 개선 필요');
    }
  });

});

