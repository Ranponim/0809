/**
 * 성능 기준선 측정 스크립트
 * 
 * 이 스크립트는 현재 애플리케이션의 성능 기준선을 측정하고 
 * 최적화 후 비교를 위한 데이터를 수집합니다.
 */

import lighthouse from 'lighthouse';
import chromeLauncher from 'chrome-launcher';
import fs from 'fs/promises';
import path from 'path';

const URL = process.env.TEST_URL || 'http://localhost:5173';
const OUTPUT_DIR = './performance-reports';

async function ensureOutputDir() {
  try {
    await fs.access(OUTPUT_DIR);
  } catch {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  }
}

async function runLighthouseAudit() {
  console.log('🚀 Lighthouse 감사 시작...');
  
  // Chrome 브라우저 실행
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    // Lighthouse 설정
    const options = {
      logLevel: 'info',
      output: 'html',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port,
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1
      }
    };
    
    // 3번 실행하여 평균값 계산
    const results = [];
    for (let i = 0; i < 3; i++) {
      console.log(`📊 실행 ${i + 1}/3...`);
      const runnerResult = await lighthouse(URL, options);
      results.push(runnerResult);
      
      // 첫 번째 실행 결과를 HTML로 저장
      if (i === 0) {
        const reportHtml = runnerResult.report;
        const reportPath = path.join(OUTPUT_DIR, `lighthouse-baseline-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`);
        await fs.writeFile(reportPath, reportHtml);
        console.log(`📄 리포트 저장: ${reportPath}`);
      }
    }
    
    // 성능 지표 평균 계산
    const avgScores = {
      performance: results.reduce((sum, r) => sum + r.lhr.categories.performance.score * 100, 0) / results.length,
      accessibility: results.reduce((sum, r) => sum + r.lhr.categories.accessibility.score * 100, 0) / results.length,
      bestPractices: results.reduce((sum, r) => sum + r.lhr.categories['best-practices'].score * 100, 0) / results.length,
      seo: results.reduce((sum, r) => sum + r.lhr.categories.seo.score * 100, 0) / results.length
    };
    
    const avgMetrics = {
      fcp: results.reduce((sum, r) => sum + r.lhr.audits['first-contentful-paint'].numericValue, 0) / results.length,
      lcp: results.reduce((sum, r) => sum + r.lhr.audits['largest-contentful-paint'].numericValue, 0) / results.length,
      cls: results.reduce((sum, r) => sum + r.lhr.audits['cumulative-layout-shift'].numericValue, 0) / results.length,
      tbt: results.reduce((sum, r) => sum + r.lhr.audits['total-blocking-time'].numericValue, 0) / results.length,
      si: results.reduce((sum, r) => sum + r.lhr.audits['speed-index'].numericValue, 0) / results.length
    };
    
    return { avgScores, avgMetrics };
    
  } finally {
    await chrome.kill();
  }
}

async function measureAPIPerformance() {
  console.log('🔌 API 성능 측정 시작...');
  
  const apiEndpoints = [
    'http://localhost:8000/api/master/info',
    'http://localhost:8000/api/master/pegs',
    'http://localhost:8000/api/statistics/health',
    'http://localhost:8000/api/analysis/results'
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
        
        if (!response.ok) {
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
        count: validTimes.length
      };
    }
  }
  
  return results;
}

async function generateBaselineReport() {
  console.log('📋 성능 기준선 리포트 생성 중...');
  
  await ensureOutputDir();
  
  // Lighthouse 감사 실행
  const lighthouseResults = await runLighthouseAudit();
  
  // API 성능 측정
  const apiResults = await measureAPIPerformance();
  
  // 기준선 리포트 생성
  const baseline = {
    timestamp: new Date().toISOString(),
    url: URL,
    lighthouse: lighthouseResults,
    api: apiResults,
    targets: {
      performance: 85,
      accessibility: 95,
      bestPractices: 85,
      seo: 85,
      fcp: 1800,
      lcp: 2500,
      cls: 0.1,
      tbt: 200,
      apiAvgResponse: 200
    }
  };
  
  // JSON 리포트 저장
  const reportPath = path.join(OUTPUT_DIR, `performance-baseline-${new Date().toISOString().slice(0, 10)}.json`);
  await fs.writeFile(reportPath, JSON.stringify(baseline, null, 2));
  
  // 콘솔 출력
  console.log('\n📊 성능 기준선 측정 완료!');
  console.log('='.repeat(50));
  console.log('🎯 Lighthouse 점수:');
  console.log(`   Performance: ${lighthouseResults.avgScores.performance.toFixed(1)}/100`);
  console.log(`   Accessibility: ${lighthouseResults.avgScores.accessibility.toFixed(1)}/100`);
  console.log(`   Best Practices: ${lighthouseResults.avgScores.bestPractices.toFixed(1)}/100`);
  console.log(`   SEO: ${lighthouseResults.avgScores.seo.toFixed(1)}/100`);
  
  console.log('\n⚡ Core Web Vitals:');
  console.log(`   First Contentful Paint: ${lighthouseResults.avgMetrics.fcp.toFixed(0)}ms`);
  console.log(`   Largest Contentful Paint: ${lighthouseResults.avgMetrics.lcp.toFixed(0)}ms`);
  console.log(`   Cumulative Layout Shift: ${lighthouseResults.avgMetrics.cls.toFixed(3)}`);
  console.log(`   Total Blocking Time: ${lighthouseResults.avgMetrics.tbt.toFixed(0)}ms`);
  console.log(`   Speed Index: ${lighthouseResults.avgMetrics.si.toFixed(0)}ms`);
  
  console.log('\n🔌 API 응답 시간:');
  Object.entries(apiResults).forEach(([endpoint, metrics]) => {
    const path = endpoint.replace('http://localhost:8000', '');
    console.log(`   ${path}: ${metrics.avg.toFixed(1)}ms (avg)`);
  });
  
  console.log(`\n📄 상세 리포트: ${reportPath}`);
  console.log('='.repeat(50));
  
  return baseline;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateBaselineReport().catch(console.error);
}

export { generateBaselineReport };
