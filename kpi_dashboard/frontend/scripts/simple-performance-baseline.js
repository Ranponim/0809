/**
 * 간단한 성능 기준선 측정 스크립트
 * 
 * API 응답 시간과 기본 성능 지표를 측정합니다.
 */

import fs from 'fs/promises';
import path from 'path';

const BASE_URL = process.env.TEST_URL || 'http://localhost:5173';
const API_BASE_URL = process.env.API_URL || 'http://localhost:8000';
const OUTPUT_DIR = './performance-reports';

async function ensureOutputDir() {
  try {
    await fs.access(OUTPUT_DIR);
  } catch {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  }
}

async function measureAPIPerformance() {
  console.log('🔌 API 성능 측정 시작...');
  
  const apiEndpoints = [
    `${API_BASE_URL}/api/master/info`,
    `${API_BASE_URL}/api/master/pegs`,
    `${API_BASE_URL}/api/master/cells`,
    `${API_BASE_URL}/api/analysis/results`,
    `${API_BASE_URL}/api/preference/123`
  ];
  
  const results = {};
  
  for (const endpoint of apiEndpoints) {
    const times = [];
    console.log(`📡 ${endpoint} 테스트 중...`);
    
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      try {
        const response = await fetch(endpoint);
        const end = performance.now();
        times.push(end - start);
        
        if (!response.ok && response.status !== 404) {
          console.warn(`⚠️ ${endpoint}: ${response.status}`);
        }
      } catch (error) {
        console.error(`❌ ${endpoint}: ${error.message}`);
        times.push(null);
      }
    }
    
    const validTimes = times.filter(t => t !== null);
    if (validTimes.length > 0) {
      results[endpoint] = {
        avg: validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length,
        min: Math.min(...validTimes),
        max: Math.max(...validTimes),
        count: validTimes.length,
        p95: validTimes.sort((a, b) => a - b)[Math.floor(validTimes.length * 0.95)]
      };
    }
  }
  
  return results;
}

async function measureFrontendLoadTime() {
  console.log('🌐 프론트엔드 로딩 시간 측정...');
  
  const results = {};
  
  try {
    // 메인 페이지 로딩 시간 측정
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const response = await fetch(BASE_URL);
      const end = performance.now();
      
      if (response.ok) {
        times.push(end - start);
      }
    }
    
    if (times.length > 0) {
      results.htmlLoad = {
        avg: times.reduce((sum, t) => sum + t, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times)
      };
    }
    
  } catch (error) {
    console.error(`❌ 프론트엔드 측정 실패: ${error.message}`);
  }
  
  return results;
}

async function measureBundleSize() {
  console.log('📦 번들 크기 측정...');
  
  const distPath = './dist';
  const bundleInfo = {};
  
  try {
    const files = await fs.readdir(distPath, { recursive: true });
    
    for (const file of files) {
      if (typeof file === 'string' && file.endsWith('.js')) {
        const filePath = path.join(distPath, file);
        const stats = await fs.stat(filePath);
        bundleInfo[file] = {
          size: stats.size,
          sizeKB: Math.round(stats.size / 1024 * 100) / 100
        };
      }
    }
    
    const totalSize = Object.values(bundleInfo).reduce((sum, info) => sum + info.size, 0);
    bundleInfo._total = {
      size: totalSize,
      sizeKB: Math.round(totalSize / 1024 * 100) / 100,
      sizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
    };
    
  } catch (error) {
    console.error(`❌ 번들 크기 측정 실패: ${error.message}`);
  }
  
  return bundleInfo;
}

async function generateSimpleBaselineReport() {
  console.log('📋 성능 기준선 리포트 생성 중...');
  
  await ensureOutputDir();
  
  // 각종 성능 지표 측정
  const apiResults = await measureAPIPerformance();
  const frontendResults = await measureFrontendLoadTime();
  const bundleResults = await measureBundleSize();
  
  // 기준선 리포트 생성
  const baseline = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    apiBaseUrl: API_BASE_URL,
    measurements: {
      api: apiResults,
      frontend: frontendResults,
      bundles: bundleResults
    },
    targets: {
      apiAvgResponse: 200, // ms
      frontendLoad: 2000, // ms
      bundleSize: 1000, // KB
      totalBundleSize: 2000 // KB
    },
    summary: {
      apiAvgResponse: Object.values(apiResults).reduce((sum, r) => sum + r.avg, 0) / Object.keys(apiResults).length,
      frontendLoadTime: frontendResults.htmlLoad?.avg || 0,
      totalBundleSize: bundleResults._total?.sizeKB || 0,
      largestBundle: Math.max(...Object.values(bundleResults)
        .filter(b => typeof b.sizeKB === 'number')
        .map(b => b.sizeKB)) || 0
    }
  };
  
  // JSON 리포트 저장
  const reportPath = path.join(OUTPUT_DIR, `performance-baseline-${new Date().toISOString().slice(0, 10)}.json`);
  await fs.writeFile(reportPath, JSON.stringify(baseline, null, 2));
  
  // 콘솔 출력
  console.log('\n📊 성능 기준선 측정 완료!');
  console.log('='.repeat(60));
  
  console.log('\n🔌 API 성능:');
  Object.entries(apiResults).forEach(([endpoint, metrics]) => {
    const path = endpoint.replace(API_BASE_URL, '');
    console.log(`   ${path}: ${metrics.avg.toFixed(1)}ms (avg), ${metrics.p95.toFixed(1)}ms (p95)`);
  });
  
  if (frontendResults.htmlLoad) {
    console.log('\n🌐 프론트엔드 로딩:');
    console.log(`   HTML 로드: ${frontendResults.htmlLoad.avg.toFixed(1)}ms (avg)`);
  }
  
  console.log('\n📦 번들 크기:');
  const sortedBundles = Object.entries(bundleResults)
    .filter(([name]) => !name.startsWith('_'))
    .sort(([,a], [,b]) => b.sizeKB - a.sizeKB)
    .slice(0, 10); // 상위 10개만 표시
  
  sortedBundles.forEach(([file, info]) => {
    console.log(`   ${file}: ${info.sizeKB} KB`);
  });
  
  if (bundleResults._total) {
    console.log(`   📊 총 크기: ${bundleResults._total.sizeMB} MB`);
  }
  
  console.log('\n🎯 요약:');
  console.log(`   평균 API 응답: ${baseline.summary.apiAvgResponse.toFixed(1)}ms`);
  console.log(`   프론트엔드 로딩: ${baseline.summary.frontendLoadTime.toFixed(1)}ms`);
  console.log(`   총 번들 크기: ${baseline.summary.totalBundleSize.toFixed(1)} KB`);
  console.log(`   최대 번들 크기: ${baseline.summary.largestBundle.toFixed(1)} KB`);
  
  console.log(`\n📄 상세 리포트: ${reportPath}`);
  console.log('='.repeat(60));
  
  return baseline;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateSimpleBaselineReport().catch(console.error);
}

export { generateSimpleBaselineReport };
