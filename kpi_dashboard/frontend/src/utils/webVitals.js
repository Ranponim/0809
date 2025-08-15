/**
 * Web Vitals 측정 유틸리티
 * 
 * 실시간으로 Core Web Vitals 지표를 측정하고 
 * 콘솔 및 서버로 전송하는 기능을 제공합니다.
 */

// web-vitals 임포트 (버전 호환성을 위한 동적 임포트)
let webVitals = null;

let vitalsData = {};

/**
 * 성능 지표를 콘솔에 로그 출력
 */
function logVital(metric) {
  console.log(`📊 ${metric.name}: ${metric.value.toFixed(2)}${metric.unit || 'ms'}`);
  vitalsData[metric.name] = {
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    navigationType: metric.navigationType
  };
}

/**
 * 성능 지표를 서버로 전송 (선택적)
 */
function sendVitalToServer(metric) {
  if (process.env.NODE_ENV === 'production') {
    // 실제 운영 환경에서는 Analytics 서비스로 전송
    // Example: gtag('event', metric.name, { value: metric.value });
  }
}

/**
 * 모든 Core Web Vitals 측정 시작
 */
export async function measureWebVitals() {
  console.log('🔍 Web Vitals 측정 시작...');
  
  try {
    // 동적 임포트로 web-vitals 로드
    if (!webVitals) {
      webVitals = await import('web-vitals');
    }
    
    // 사용 가능한 함수들 확인 및 호출
    if (webVitals.onCLS || webVitals.getCLS) {
      const clsFunction = webVitals.onCLS || webVitals.getCLS;
      clsFunction((metric) => {
        logVital(metric);
        sendVitalToServer(metric);
      });
    }

    if (webVitals.onFID || webVitals.getFID) {
      const fidFunction = webVitals.onFID || webVitals.getFID;
      fidFunction((metric) => {
        logVital(metric);
        sendVitalToServer(metric);
      });
    }

    if (webVitals.onFCP || webVitals.getFCP) {
      const fcpFunction = webVitals.onFCP || webVitals.getFCP;
      fcpFunction((metric) => {
        logVital(metric);
        sendVitalToServer(metric);
      });
    }

    if (webVitals.onLCP || webVitals.getLCP) {
      const lcpFunction = webVitals.onLCP || webVitals.getLCP;
      lcpFunction((metric) => {
        logVital(metric);
        sendVitalToServer(metric);
      });
    }

    if (webVitals.onTTFB || webVitals.getTTFB) {
      const ttfbFunction = webVitals.onTTFB || webVitals.getTTFB;
      ttfbFunction((metric) => {
        logVital(metric);
        sendVitalToServer(metric);
      });
    }
  } catch (error) {
    console.warn('⚠️ Web Vitals 측정 실패:', error);
    // 폴백: 기본 성능 측정
    measureBasicPerformance();
  }
}

/**
 * 기본 성능 측정 (web-vitals 없이)
 */
function measureBasicPerformance() {
  if (typeof window !== 'undefined' && window.performance) {
    // 페이지 로드 시간 측정
    window.addEventListener('load', () => {
      const loadTime = performance.now();
      logVital({
        name: 'PageLoad',
        value: loadTime,
        rating: loadTime < 2000 ? 'good' : loadTime < 4000 ? 'needs-improvement' : 'poor'
      });
    });
    
    // 첫 번째 상호작용까지의 시간 측정
    let firstInteraction = false;
    ['click', 'keydown', 'touchstart'].forEach(eventType => {
      document.addEventListener(eventType, () => {
        if (!firstInteraction) {
          firstInteraction = true;
          const interactionTime = performance.now();
          logVital({
            name: 'FirstInteraction',
            value: interactionTime,
            rating: interactionTime < 1000 ? 'good' : interactionTime < 3000 ? 'needs-improvement' : 'poor'
          });
        }
      }, { once: true });
    });
  }
}

/**
 * 현재까지 측정된 Web Vitals 데이터 반환
 */
export function getVitalsData() {
  return vitalsData;
}

/**
 * 성능 지표가 양호한지 판단
 */
export function evaluatePerformance(vitals = vitalsData) {
  const thresholds = {
    CLS: { good: 0.1, needsImprovement: 0.25 },
    FID: { good: 100, needsImprovement: 300 },
    FCP: { good: 1800, needsImprovement: 3000 },
    LCP: { good: 2500, needsImprovement: 4000 },
    TTFB: { good: 800, needsImprovement: 1800 }
  };

  const evaluation = {};
  
  Object.entries(vitals).forEach(([name, data]) => {
    const threshold = thresholds[name];
    if (threshold) {
      if (data.value <= threshold.good) {
        evaluation[name] = 'good';
      } else if (data.value <= threshold.needsImprovement) {
        evaluation[name] = 'needs-improvement';
      } else {
        evaluation[name] = 'poor';
      }
    }
  });

  return evaluation;
}

/**
 * 성능 리포트 생성
 */
export function generatePerformanceReport() {
  const vitals = getVitalsData();
  const evaluation = evaluatePerformance(vitals);
  
  const report = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    vitals,
    evaluation,
    summary: {
      totalMetrics: Object.keys(vitals).length,
      goodMetrics: Object.values(evaluation).filter(rating => rating === 'good').length,
      poorMetrics: Object.values(evaluation).filter(rating => rating === 'poor').length
    }
  };
  
  console.log('📊 성능 리포트:', report);
  return report;
}
