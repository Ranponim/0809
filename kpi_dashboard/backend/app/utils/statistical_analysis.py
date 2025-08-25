"""
통계 분석 엔진

작업 3: Backend: Develop Core Statistical Analysis Engine
두 테스트 기간('n'과 'n-1') 간의 통계적 비교를 수행하는 엔진을 구현합니다.
"""

import logging
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional, Union
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
import scipy.stats as stats
from scipy.stats import shapiro, levene, ttest_ind, mannwhitneyu, wilcoxon

logger = logging.getLogger(__name__)

class TestType(Enum):
    """통계 검정 유형"""
    T_TEST = "t_test"
    MANN_WHITNEY = "mann_whitney"
    WILCOXON = "wilcoxon"
    PAIRED_T_TEST = "paired_t_test"
    KRUSKAL_WALLIS = "kruskal_wallis"
    ANOVA = "anova"
    KS_TEST = "ks_test"

class EffectSizeType(Enum):
    """효과 크기 유형"""
    COHENS_D = "cohens_d"
    HEDGES_G = "hedges_g"
    CLIFFS_DELTA = "cliffs_delta"

@dataclass
class StatisticalTestResult:
    """통계 검정 결과"""
    test_type: TestType
    statistic: float
    p_value: float
    is_significant: bool
    alpha: float = 0.05
    
    def __post_init__(self):
        self.is_significant = self.p_value < self.alpha

@dataclass
class EffectSizeResult:
    """효과 크기 결과"""
    effect_size_type: EffectSizeType
    value: float
    interpretation: str
    magnitude: str  # small, medium, large

@dataclass
class MetricAnalysisResult:
    """메트릭별 분석 결과"""
    metric_name: str
    period_n_data: np.ndarray
    period_n1_data: np.ndarray
    test_result: StatisticalTestResult
    effect_size: EffectSizeResult
    clinical_significance: bool
    summary: str

@dataclass
class ComprehensiveAnalysisResult:
    """종합 분석 결과"""
    analysis_id: str
    period_n_info: Dict[str, Any]
    period_n1_info: Dict[str, Any]
    metrics_results: List[MetricAnalysisResult]
    overall_assessment: str
    confidence_level: float
    timestamp: datetime
    total_metrics: int
    significant_metrics: int
    clinically_significant_metrics: int

@dataclass
class IntegratedAnalysisReport:
    """통합 분석 보고서"""
    report_id: str
    analysis_result: ComprehensiveAnalysisResult
    summary_statistics: Dict[str, Any]
    pass_fail_assessment: Dict[str, Any]
    recommendations: List[str]
    risk_assessment: Dict[str, Any]
    generated_at: datetime
    
    def to_json(self) -> Dict[str, Any]:
        """JSON 형태로 변환"""
        return {
            "report_id": self.report_id,
            "generated_at": self.generated_at.isoformat(),
            "summary_statistics": self.summary_statistics,
            "pass_fail_assessment": self.pass_fail_assessment,
            "recommendations": self.recommendations,
            "risk_assessment": self.risk_assessment,
            "analysis_result": {
                "analysis_id": self.analysis_result.analysis_id,
                "period_n_info": self.analysis_result.period_n_info,
                "period_n1_info": self.analysis_result.period_n1_info,
                "overall_assessment": self.analysis_result.overall_assessment,
                "confidence_level": self.analysis_result.confidence_level,
                "timestamp": self.analysis_result.timestamp.isoformat(),
                "total_metrics": self.analysis_result.total_metrics,
                "significant_metrics": self.analysis_result.significant_metrics,
                "clinically_significant_metrics": self.analysis_result.clinically_significant_metrics,
                "metrics_results": [
                    {
                        "metric_name": result.metric_name,
                        "test_result": {
                            "test_type": result.test_result.test_type.value,
                            "statistic": result.test_result.statistic,
                            "p_value": result.test_result.p_value,
                            "is_significant": result.test_result.is_significant,
                            "alpha": result.test_result.alpha
                        },
                        "effect_size": {
                            "effect_size_type": result.effect_size.effect_size_type.value,
                            "value": result.effect_size.value,
                            "interpretation": result.effect_size.interpretation,
                            "magnitude": result.effect_size.magnitude
                        },
                        "clinical_significance": result.clinical_significance,
                        "summary": result.summary
                    }
                    for result in self.analysis_result.metrics_results
                ]
            }
        }
    
    def to_text_report(self) -> str:
        """사람이 읽기 쉬운 텍스트 보고서 생성"""
        report_lines = []
        
        # 헤더
        report_lines.append("=" * 80)
        report_lines.append("통계 분석 종합 보고서")
        report_lines.append("=" * 80)
        report_lines.append(f"보고서 ID: {self.report_id}")
        report_lines.append(f"생성 시간: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        
        # 요약 통계
        report_lines.append("📊 요약 통계")
        report_lines.append("-" * 40)
        report_lines.append(f"총 메트릭 수: {self.summary_statistics['total_metrics']}")
        report_lines.append(f"통계적으로 유의한 메트릭: {self.summary_statistics['significant_metrics']}")
        report_lines.append(f"임상적으로 유의한 메트릭: {self.summary_statistics['clinically_significant_metrics']}")
        report_lines.append(f"유의율: {self.summary_statistics['significance_rate']:.1%}")
        report_lines.append(f"임상적 유의율: {self.summary_statistics['clinical_significance_rate']:.1%}")
        report_lines.append("")
        
        # Pass/Fail 평가
        report_lines.append("✅ Pass/Fail 평가")
        report_lines.append("-" * 40)
        report_lines.append(f"전체 평가: {self.pass_fail_assessment['overall_result']}")
        report_lines.append(f"평가 근거: {self.pass_fail_assessment['reasoning']}")
        report_lines.append(f"신뢰도: {self.pass_fail_assessment['confidence']}")
        report_lines.append("")
        
        # 메트릭별 상세 결과
        report_lines.append("📈 메트릭별 상세 결과")
        report_lines.append("-" * 40)
        for i, result in enumerate(self.analysis_result.metrics_results, 1):
            report_lines.append(f"{i}. {result.metric_name}")
            report_lines.append(f"   - 검정 방법: {result.test_result.test_type.value}")
            report_lines.append(f"   - 통계량: {result.test_result.statistic:.4f}")
            report_lines.append(f"   - p-value: {result.test_result.p_value:.4f}")
            report_lines.append(f"   - 통계적 유의성: {'예' if result.test_result.is_significant else '아니오'}")
            report_lines.append(f"   - 효과 크기: {result.effect_size.value:.4f} ({result.effect_size.magnitude})")
            report_lines.append(f"   - 임상적 유의성: {'예' if result.clinical_significance else '아니오'}")
            report_lines.append(f"   - 요약: {result.summary}")
            report_lines.append("")
        
        # 권장사항
        if self.recommendations:
            report_lines.append("💡 권장사항")
            report_lines.append("-" * 40)
            for i, recommendation in enumerate(self.recommendations, 1):
                report_lines.append(f"{i}. {recommendation}")
            report_lines.append("")
        
        # 위험도 평가
        report_lines.append("⚠️ 위험도 평가")
        report_lines.append("-" * 40)
        report_lines.append(f"전체 위험도: {self.risk_assessment['overall_risk']}")
        report_lines.append(f"위험 요소: {', '.join(self.risk_assessment['risk_factors'])}")
        report_lines.append(f"위험 설명: {self.risk_assessment['risk_explanation']}")
        report_lines.append("")
        
        # 푸터
        report_lines.append("=" * 80)
        report_lines.append("보고서 끝")
        report_lines.append("=" * 80)
        
        return "\n".join(report_lines)

class StatisticalAnalysisEngine:
    """통계 분석 엔진"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        StatisticalAnalysisEngine 초기화
        
        Args:
            config: 설정 파라미터 딕셔너리
        """
        self.config = config or self._get_default_config()
        logger.info("StatisticalAnalysisEngine 초기화 완료")
        
    def _get_default_config(self) -> Dict[str, Any]:
        """기본 설정 반환"""
        return {
            # 통계 검정 설정
            'alpha': 0.05,  # 유의수준
            'normality_threshold': 0.05,  # 정규성 검정 임계값
            'homogeneity_threshold': 0.05,  # 등분산성 검정 임계값
            
            # 효과 크기 기준
            'cohens_d_thresholds': {
                'small': 0.2,
                'medium': 0.5,
                'large': 0.8
            },
            
            # 임상적 유의성 기준
            'clinical_significance_threshold': 0.5,  # 중간 이상의 효과 크기
            
            # 데이터 품질 기준
            'min_sample_size': 10,  # 최소 샘플 크기
            'max_missing_ratio': 0.3,  # 최대 결측치 비율
        }
    
    def analyze_periods_comparison(self, 
                                 period_n_data: pd.DataFrame,
                                 period_n1_data: pd.DataFrame,
                                 metrics: List[str] = None) -> ComprehensiveAnalysisResult:
        """
        두 테스트 기간 간의 통계적 비교 분석을 수행합니다.
        
        Args:
            period_n_data: 현재 기간(n) 데이터
            period_n1_data: 이전 기간(n-1) 데이터
            metrics: 분석할 메트릭 리스트 (None이면 모든 숫자 컬럼 사용)
            
        Returns:
            종합 분석 결과
        """
        logger.info("통계적 비교 분석 시작")
        
        # 메트릭 리스트 결정
        if metrics is None:
            metrics = self._get_numeric_metrics(period_n_data)
        
        # 기간 정보 수집
        period_n_info = self._extract_period_info(period_n_data, "n")
        period_n1_info = self._extract_period_info(period_n1_data, "n-1")
        
        # 각 메트릭별 분석 수행
        metrics_results = []
        significant_count = 0
        clinically_significant_count = 0
        
        for metric in metrics:
            try:
                result = self._analyze_single_metric(
                    period_n_data, period_n1_data, metric
                )
                metrics_results.append(result)
                
                if result.test_result.is_significant:
                    significant_count += 1
                if result.clinical_significance:
                    clinically_significant_count += 1
                    
            except Exception as e:
                logger.error(f"메트릭 '{metric}' 분석 중 오류: {str(e)}")
                continue
        
        # 종합 평가 생성
        overall_assessment = self._generate_overall_assessment(
            len(metrics_results), significant_count, clinically_significant_count
        )
        
        # 신뢰도 계산
        confidence_level = self._calculate_confidence_level(metrics_results)
        
        # 분석 결과 생성
        analysis_result = ComprehensiveAnalysisResult(
            analysis_id=f"analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            period_n_info=period_n_info,
            period_n1_info=period_n1_info,
            metrics_results=metrics_results,
            overall_assessment=overall_assessment,
            confidence_level=confidence_level,
            timestamp=datetime.now(),
            total_metrics=len(metrics_results),
            significant_metrics=significant_count,
            clinically_significant_metrics=clinically_significant_count
        )
        
        logger.info(f"통계적 비교 분석 완료: {len(metrics_results)}개 메트릭, "
                   f"{significant_count}개 유의, {clinically_significant_count}개 임상적 유의")
        
        return analysis_result
    
    def _analyze_single_metric(self, 
                             period_n_data: pd.DataFrame,
                             period_n1_data: pd.DataFrame,
                             metric: str) -> MetricAnalysisResult:
        """
        단일 메트릭에 대한 통계 분석을 수행합니다.
        
        Args:
            period_n_data: 현재 기간 데이터
            period_n1_data: 이전 기간 데이터
            metric: 분석할 메트릭
            
        Returns:
            메트릭별 분석 결과
        """
        # 데이터 추출 및 전처리
        n_data = self._extract_metric_data(period_n_data, metric)
        n1_data = self._extract_metric_data(period_n1_data, metric)
        
        # 데이터 품질 검사
        if not self._check_data_quality(n_data, n1_data):
            raise ValueError(f"메트릭 '{metric}'의 데이터 품질이 기준을 만족하지 않습니다.")
        
        # 적절한 통계 검정 선택 및 수행
        test_result = self._perform_statistical_test(n_data, n1_data)
        
        # 효과 크기 계산
        effect_size = self._calculate_effect_size(n_data, n1_data)
        
        # 임상적 유의성 판단
        clinical_significance = self._assess_clinical_significance(test_result, effect_size)
        
        # 요약 생성
        summary = self._generate_metric_summary(metric, test_result, effect_size, clinical_significance)
        
        return MetricAnalysisResult(
            metric_name=metric,
            period_n_data=n_data,
            period_n1_data=n1_data,
            test_result=test_result,
            effect_size=effect_size,
            clinical_significance=clinical_significance,
            summary=summary
        )
    
    def _extract_metric_data(self, data: pd.DataFrame, metric: str) -> np.ndarray:
        """메트릭 데이터 추출 및 전처리"""
        if metric not in data.columns:
            raise ValueError(f"메트릭 '{metric}'이 데이터에 없습니다.")
        
        # 결측치 제거
        metric_data = data[metric].dropna().values
        
        if len(metric_data) < self.config['min_sample_size']:
            raise ValueError(f"메트릭 '{metric}'의 유효한 데이터가 부족합니다.")
        
        return metric_data
    
    def _check_data_quality(self, n_data: np.ndarray, n1_data: np.ndarray) -> bool:
        """데이터 품질 검사"""
        # 최소 샘플 크기 검사
        if len(n_data) < self.config['min_sample_size'] or len(n1_data) < self.config['min_sample_size']:
            return False
        
        # 결측치 비율 검사
        n_missing_ratio = np.sum(np.isnan(n_data)) / len(n_data)
        n1_missing_ratio = np.sum(np.isnan(n1_data)) / len(n1_data)
        
        if n_missing_ratio > self.config['max_missing_ratio'] or n1_missing_ratio > self.config['max_missing_ratio']:
            return False
        
        return True
    
    def _perform_statistical_test(self, n_data: np.ndarray, n1_data: np.ndarray) -> StatisticalTestResult:
        """
        적절한 통계 검정을 선택하고 수행합니다.
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            통계 검정 결과
        """
        # 정규성 검정
        n_normal = self._test_normality(n_data)
        n1_normal = self._test_normality(n1_data)
        
        # 등분산성 검정 (정규분포인 경우에만)
        equal_variance = True
        if n_normal and n1_normal:
            equal_variance = self._test_homogeneity(n_data, n1_data)
        
        # 적절한 검정 방법 선택 및 수행
        if n_normal and n1_normal and equal_variance:
            # 정규분포이고 등분산인 경우: Student's t-test
            test_type = TestType.T_TEST
            statistic, p_value = self._perform_students_t_test(n_data, n1_data)
        elif n_normal and n1_normal:
            # 정규분포이지만 등분산이 아닌 경우: Welch's t-test
            test_type = TestType.T_TEST
            statistic, p_value = self._perform_welchs_t_test(n_data, n1_data)
        else:
            # 비정규분포인 경우: Mann-Whitney U test
            test_type = TestType.MANN_WHITNEY
            statistic, p_value = self._perform_mann_whitney_test(n_data, n1_data)
        
        return StatisticalTestResult(
            test_type=test_type,
            statistic=statistic,
            p_value=p_value,
            is_significant=p_value < self.config['alpha'],
            alpha=self.config['alpha']
        )
    
    def _perform_students_t_test(self, n_data: np.ndarray, n1_data: np.ndarray) -> Tuple[float, float]:
        """
        Student's t-test 수행 (등분산 가정)
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            (통계량, p-value) 튜플
        """
        try:
            statistic, p_value = ttest_ind(n_data, n1_data, equal_var=True)
            logger.debug(f"Student's t-test: statistic={statistic:.4f}, p-value={p_value:.4f}")
            return statistic, p_value
        except Exception as e:
            logger.error(f"Student's t-test 수행 중 오류: {str(e)}")
            raise
    
    def _perform_welchs_t_test(self, n_data: np.ndarray, n1_data: np.ndarray) -> Tuple[float, float]:
        """
        Welch's t-test 수행 (비등분산 가정)
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            (통계량, p-value) 튜플
        """
        try:
            statistic, p_value = ttest_ind(n_data, n1_data, equal_var=False)
            logger.debug(f"Welch's t-test: statistic={statistic:.4f}, p-value={p_value:.4f}")
            return statistic, p_value
        except Exception as e:
            logger.error(f"Welch's t-test 수행 중 오류: {str(e)}")
            raise
    
    def _perform_mann_whitney_test(self, n_data: np.ndarray, n1_data: np.ndarray) -> Tuple[float, float]:
        """
        Mann-Whitney U test 수행 (비모수 검정)
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            (통계량, p-value) 튜플
        """
        try:
            statistic, p_value = mannwhitneyu(n_data, n1_data, alternative='two-sided')
            logger.debug(f"Mann-Whitney U test: statistic={statistic:.4f}, p-value={p_value:.4f}")
            return statistic, p_value
        except Exception as e:
            logger.error(f"Mann-Whitney U test 수행 중 오류: {str(e)}")
            raise
    
    def _perform_wilcoxon_test(self, n_data: np.ndarray, n1_data: np.ndarray) -> Tuple[float, float]:
        """
        Wilcoxon signed-rank test 수행 (대응표본)
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            (통계량, p-value) 튜플
        """
        try:
            # 데이터 길이가 다른 경우 짧은 길이에 맞춤
            min_length = min(len(n_data), len(n1_data))
            n_data_trimmed = n_data[:min_length]
            n1_data_trimmed = n1_data[:min_length]
            
            statistic, p_value = wilcoxon(n_data_trimmed, n1_data_trimmed, alternative='two-sided')
            logger.debug(f"Wilcoxon signed-rank test: statistic={statistic:.4f}, p-value={p_value:.4f}")
            return statistic, p_value
        except Exception as e:
            logger.error(f"Wilcoxon signed-rank test 수행 중 오류: {str(e)}")
            raise
    
    def _perform_paired_t_test(self, n_data: np.ndarray, n1_data: np.ndarray) -> Tuple[float, float]:
        """
        Paired t-test 수행 (대응표본)
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            (통계량, p-value) 튜플
        """
        try:
            # 데이터 길이가 다른 경우 짧은 길이에 맞춤
            min_length = min(len(n_data), len(n1_data))
            n_data_trimmed = n_data[:min_length]
            n1_data_trimmed = n1_data[:min_length]
            
            statistic, p_value = stats.ttest_rel(n_data_trimmed, n1_data_trimmed)
            logger.debug(f"Paired t-test: statistic={statistic:.4f}, p-value={p_value:.4f}")
            return statistic, p_value
        except Exception as e:
            logger.error(f"Paired t-test 수행 중 오류: {str(e)}")
            raise
    
    def _perform_kruskal_wallis_test(self, n_data: np.ndarray, n1_data: np.ndarray) -> Tuple[float, float]:
        """
        Kruskal-Wallis H test 수행 (비모수 일원배치 분산분석)
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            (통계량, p-value) 튜플
        """
        try:
            statistic, p_value = stats.kruskal(n_data, n1_data)
            logger.debug(f"Kruskal-Wallis H test: statistic={statistic:.4f}, p-value={p_value:.4f}")
            return statistic, p_value
        except Exception as e:
            logger.error(f"Kruskal-Wallis H test 수행 중 오류: {str(e)}")
            raise
    
    def _perform_anova_test(self, n_data: np.ndarray, n1_data: np.ndarray) -> Tuple[float, float]:
        """
        One-way ANOVA 수행 (일원배치 분산분석)
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            (통계량, p-value) 튜플
        """
        try:
            statistic, p_value = stats.f_oneway(n_data, n1_data)
            logger.debug(f"One-way ANOVA: statistic={statistic:.4f}, p-value={p_value:.4f}")
            return statistic, p_value
        except Exception as e:
            logger.error(f"One-way ANOVA 수행 중 오류: {str(e)}")
            raise
    
    def _perform_ks_test(self, n_data: np.ndarray, n1_data: np.ndarray) -> Tuple[float, float]:
        """
        Kolmogorov-Smirnov test 수행 (분포 비교)
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            (통계량, p-value) 튜플
        """
        try:
            statistic, p_value = stats.ks_2samp(n_data, n1_data)
            logger.debug(f"Kolmogorov-Smirnov test: statistic={statistic:.4f}, p-value={p_value:.4f}")
            return statistic, p_value
        except Exception as e:
            logger.error(f"Kolmogorov-Smirnov test 수행 중 오류: {str(e)}")
            raise
    
    def perform_custom_statistical_test(self, 
                                      n_data: np.ndarray, 
                                      n1_data: np.ndarray, 
                                      test_type: TestType) -> StatisticalTestResult:
        """
        사용자가 지정한 통계 검정을 수행합니다.
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            test_type: 수행할 검정 유형
            
        Returns:
            통계 검정 결과
        """
        try:
            if test_type == TestType.T_TEST:
                # 정규성 검정 후 적절한 t-test 선택
                n_normal = self._test_normality(n_data)
                n1_normal = self._test_normality(n1_data)
                
                if n_normal and n1_normal:
                    equal_variance = self._test_homogeneity(n_data, n1_data)
                    if equal_variance:
                        statistic, p_value = self._perform_students_t_test(n_data, n1_data)
                    else:
                        statistic, p_value = self._perform_welchs_t_test(n_data, n1_data)
                else:
                    logger.warning("정규성 검정 실패로 Mann-Whitney U test로 대체")
                    statistic, p_value = self._perform_mann_whitney_test(n_data, n1_data)
                    
            elif test_type == TestType.MANN_WHITNEY:
                statistic, p_value = self._perform_mann_whitney_test(n_data, n1_data)
                
            elif test_type == TestType.WILCOXON:
                statistic, p_value = self._perform_wilcoxon_test(n_data, n1_data)
                
            elif test_type == TestType.PAIRED_T_TEST:
                statistic, p_value = self._perform_paired_t_test(n_data, n1_data)
                
            elif test_type == TestType.KRUSKAL_WALLIS:
                statistic, p_value = self._perform_kruskal_wallis_test(n_data, n1_data)
                
            elif test_type == TestType.ANOVA:
                statistic, p_value = self._perform_anova_test(n_data, n1_data)
                
            elif test_type == TestType.KS_TEST:
                statistic, p_value = self._perform_ks_test(n_data, n1_data)
                
            else:
                raise ValueError(f"지원하지 않는 검정 유형: {test_type}")
            
            return StatisticalTestResult(
                test_type=test_type,
                statistic=statistic,
                p_value=p_value,
                is_significant=p_value < self.config['alpha'],
                alpha=self.config['alpha']
            )
            
        except Exception as e:
            logger.error(f"사용자 지정 통계 검정 수행 중 오류: {str(e)}")
            raise
    
    def perform_multiple_tests(self, 
                             n_data: np.ndarray, 
                             n1_data: np.ndarray, 
                             test_types: List[TestType]) -> Dict[TestType, StatisticalTestResult]:
        """
        여러 통계 검정을 동시에 수행합니다.
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            test_types: 수행할 검정 유형 리스트
            
        Returns:
            검정 유형별 결과 딕셔너리
        """
        results = {}
        
        for test_type in test_types:
            try:
                result = self.perform_custom_statistical_test(n_data, n1_data, test_type)
                results[test_type] = result
                logger.info(f"{test_type.value} 검정 완료: p-value={result.p_value:.4f}")
            except Exception as e:
                logger.error(f"{test_type.value} 검정 실패: {str(e)}")
                continue
        
        return results
    
    def get_recommended_tests(self, n_data: np.ndarray, n1_data: np.ndarray) -> List[TestType]:
        """
        데이터 특성에 따라 권장되는 통계 검정을 반환합니다.
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            권장 검정 유형 리스트
        """
        recommended_tests = []
        
        # 정규성 검정
        n_normal = self._test_normality(n_data)
        n1_normal = self._test_normality(n1_data)
        
        # 데이터 길이 확인
        n_length = len(n_data)
        n1_length = len(n1_data)
        min_length = min(n_length, n1_length)
        
        if n_normal and n1_normal:
            # 정규분포인 경우
            recommended_tests.append(TestType.T_TEST)
            recommended_tests.append(TestType.ANOVA)
            
            # 대응표본 가능 여부 확인
            if n_length == n1_length:
                recommended_tests.append(TestType.PAIRED_T_TEST)
                recommended_tests.append(TestType.WILCOXON)
        else:
            # 비정규분포인 경우
            recommended_tests.append(TestType.MANN_WHITNEY)
            recommended_tests.append(TestType.KRUSKAL_WALLIS)
            
            # 대응표본 가능 여부 확인
            if n_length == n1_length:
                recommended_tests.append(TestType.WILCOXON)
        
        # 분포 비교 검정은 항상 추가
        recommended_tests.append(TestType.KS_TEST)
        
        # 최소 샘플 크기 확인
        if min_length < 10:
            logger.warning(f"샘플 크기가 작습니다 ({min_length}). 비모수 검정을 권장합니다.")
            # 작은 샘플 크기에서는 비모수 검정만 유지
            recommended_tests = [test for test in recommended_tests 
                               if test in [TestType.MANN_WHITNEY, TestType.WILCOXON, TestType.KS_TEST]]
        
        return recommended_tests
    
    def analyze_periods_comparison_with_custom_tests(self, 
                                                   period_n_data: pd.DataFrame,
                                                   period_n1_data: pd.DataFrame,
                                                   metrics: List[str] = None,
                                                   test_types: List[TestType] = None) -> ComprehensiveAnalysisResult:
        """
        사용자가 지정한 통계 검정을 사용하여 두 테스트 기간 간의 비교 분석을 수행합니다.
        
        Args:
            period_n_data: 현재 기간(n) 데이터
            period_n1_data: 이전 기간(n-1) 데이터
            metrics: 분석할 메트릭 리스트
            test_types: 사용할 검정 유형 리스트
            
        Returns:
            종합 분석 결과
        """
        logger.info("사용자 지정 검정을 사용한 통계적 비교 분석 시작")
        
        # 메트릭 리스트 결정
        if metrics is None:
            metrics = self._get_numeric_metrics(period_n_data)
        
        # 기간 정보 수집
        period_n_info = self._extract_period_info(period_n_data, "n")
        period_n1_info = self._extract_period_info(period_n1_data, "n-1")
        
        # 각 메트릭별 분석 수행
        metrics_results = []
        significant_count = 0
        clinically_significant_count = 0
        
        for metric in metrics:
            try:
                # 데이터 추출 및 전처리
                n_data = self._extract_metric_data(period_n_data, metric)
                n1_data = self._extract_metric_data(period_n1_data, metric)
                
                # 데이터 품질 검사
                if not self._check_data_quality(n_data, n1_data):
                    logger.warning(f"메트릭 '{metric}'의 데이터 품질이 기준을 만족하지 않습니다.")
                    continue
                
                # 여러 검정 수행
                test_results = self.perform_multiple_tests(n_data, n1_data, test_types)
                
                # 가장 유의한 결과 선택 (가장 작은 p-value)
                best_result = min(test_results.values(), key=lambda x: x.p_value)
                
                # 효과 크기 계산
                effect_size = self._calculate_effect_size(n_data, n1_data)
                
                # 임상적 유의성 판단
                clinical_significance = self._assess_clinical_significance(best_result, effect_size)
                
                # 요약 생성
                summary = self._generate_metric_summary(metric, best_result, effect_size, clinical_significance)
                
                # 메트릭 결과 생성
                metric_result = MetricAnalysisResult(
                    metric_name=metric,
                    period_n_data=n_data,
                    period_n1_data=n1_data,
                    test_result=best_result,
                    effect_size=effect_size,
                    clinical_significance=clinical_significance,
                    summary=summary
                )
                
                metrics_results.append(metric_result)
                
                if best_result.is_significant:
                    significant_count += 1
                if clinical_significance:
                    clinically_significant_count += 1
                    
            except Exception as e:
                logger.error(f"메트릭 '{metric}' 분석 중 오류: {str(e)}")
                continue
        
        # 종합 평가 생성
        overall_assessment = self._generate_overall_assessment(
            len(metrics_results), significant_count, clinically_significant_count
        )
        
        # 신뢰도 계산
        confidence_level = self._calculate_confidence_level(metrics_results)
        
        # 분석 결과 생성
        analysis_result = ComprehensiveAnalysisResult(
            analysis_id=f"analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            period_n_info=period_n_info,
            period_n1_info=period_n1_info,
            metrics_results=metrics_results,
            overall_assessment=overall_assessment,
            confidence_level=confidence_level,
            timestamp=datetime.now(),
            total_metrics=len(metrics_results),
            significant_metrics=significant_count,
            clinically_significant_metrics=clinically_significant_count
        )
        
        logger.info(f"사용자 지정 검정을 사용한 통계적 비교 분석 완료: {len(metrics_results)}개 메트릭, "
                   f"{significant_count}개 유의, {clinically_significant_count}개 임상적 유의")
        
        return analysis_result
    
    def _test_normality(self, data: np.ndarray) -> bool:
        """정규성 검정 (Shapiro-Wilk test)"""
        if len(data) < 3 or len(data) > 5000:  # Shapiro-Wilk test 제한
            return False
        
        statistic, p_value = shapiro(data)
        return p_value > self.config['normality_threshold']
    
    def _test_homogeneity(self, n_data: np.ndarray, n1_data: np.ndarray) -> bool:
        """등분산성 검정 (Levene's test)"""
        statistic, p_value = levene(n_data, n1_data)
        return p_value > self.config['homogeneity_threshold']
    
    def _calculate_effect_size(self, n_data: np.ndarray, n1_data: np.ndarray) -> EffectSizeResult:
        """효과 크기 계산 (Cohen's d)"""
        # Cohen's d 계산
        pooled_std = np.sqrt(((len(n_data) - 1) * np.var(n_data, ddof=1) + 
                             (len(n1_data) - 1) * np.var(n1_data, ddof=1)) / 
                            (len(n_data) + len(n1_data) - 2))
        
        cohens_d = (np.mean(n_data) - np.mean(n1_data)) / pooled_std
        
        # 효과 크기 해석
        magnitude = self._interpret_effect_size(abs(cohens_d))
        
        return EffectSizeResult(
            effect_size_type=EffectSizeType.COHENS_D,
            value=cohens_d,
            interpretation=self._get_effect_size_interpretation(cohens_d),
            magnitude=magnitude
        )
    
    def calculate_comprehensive_effect_sizes(self, n_data: np.ndarray, n1_data: np.ndarray) -> Dict[EffectSizeType, EffectSizeResult]:
        """
        다양한 효과 크기를 계산합니다.
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            효과 크기 유형별 결과 딕셔너리
        """
        effect_sizes = {}
        
        # Cohen's d
        effect_sizes[EffectSizeType.COHENS_D] = self._calculate_cohens_d(n_data, n1_data)
        
        # Hedges' g
        effect_sizes[EffectSizeType.HEDGES_G] = self._calculate_hedges_g(n_data, n1_data)
        
        # Cliff's Delta
        effect_sizes[EffectSizeType.CLIFFS_DELTA] = self._calculate_cliffs_delta(n_data, n1_data)
        
        return effect_sizes
    
    def _calculate_cohens_d(self, n_data: np.ndarray, n1_data: np.ndarray) -> EffectSizeResult:
        """Cohen's d 계산"""
        # Cohen's d 계산
        pooled_std = np.sqrt(((len(n_data) - 1) * np.var(n_data, ddof=1) + 
                             (len(n1_data) - 1) * np.var(n1_data, ddof=1)) / 
                            (len(n_data) + len(n1_data) - 2))
        
        cohens_d = (np.mean(n_data) - np.mean(n1_data)) / pooled_std
        
        # 효과 크기 해석
        magnitude = self._interpret_effect_size(abs(cohens_d))
        
        return EffectSizeResult(
            effect_size_type=EffectSizeType.COHENS_D,
            value=cohens_d,
            interpretation=self._get_effect_size_interpretation(cohens_d),
            magnitude=magnitude
        )
    
    def _calculate_hedges_g(self, n_data: np.ndarray, n1_data: np.ndarray) -> EffectSizeResult:
        """Hedges' g 계산 (Cohen's d의 편향 보정 버전)"""
        # Cohen's d 계산
        pooled_std = np.sqrt(((len(n_data) - 1) * np.var(n_data, ddof=1) + 
                             (len(n1_data) - 1) * np.var(n1_data, ddof=1)) / 
                            (len(n_data) + len(n1_data) - 2))
        
        cohens_d = (np.mean(n_data) - np.mean(n1_data)) / pooled_std
        
        # Hedges' g 계산 (편향 보정)
        df = len(n_data) + len(n1_data) - 2
        correction_factor = 1 - (3 / (4 * df - 1))
        hedges_g = cohens_d * correction_factor
        
        # 효과 크기 해석
        magnitude = self._interpret_effect_size(abs(hedges_g))
        
        return EffectSizeResult(
            effect_size_type=EffectSizeType.HEDGES_G,
            value=hedges_g,
            interpretation=self._get_effect_size_interpretation(hedges_g),
            magnitude=magnitude
        )
    
    def _calculate_cliffs_delta(self, n_data: np.ndarray, n1_data: np.ndarray) -> EffectSizeResult:
        """Cliff's Delta 계산 (비모수 효과 크기)"""
        # 모든 가능한 쌍 비교
        wins = 0
        losses = 0
        ties = 0
        total_pairs = len(n_data) * len(n1_data)
        
        for n_val in n_data:
            for n1_val in n1_data:
                if n_val > n1_val:
                    wins += 1
                elif n_val < n1_val:
                    losses += 1
                else:
                    ties += 1
        
        # Cliff's Delta 계산
        cliffs_delta = (wins - losses) / total_pairs
        
        # 효과 크기 해석 (Cliff's Delta 기준)
        magnitude = self._interpret_cliffs_delta(abs(cliffs_delta))
        
        return EffectSizeResult(
            effect_size_type=EffectSizeType.CLIFFS_DELTA,
            value=cliffs_delta,
            interpretation=self._get_cliffs_delta_interpretation(cliffs_delta),
            magnitude=magnitude
        )
    
    def _interpret_cliffs_delta(self, cliffs_delta: float) -> str:
        """Cliff's Delta 해석"""
        if cliffs_delta < 0.147:
            return 'small'
        elif cliffs_delta < 0.33:
            return 'medium'
        else:
            return 'large'
    
    def _get_cliffs_delta_interpretation(self, cliffs_delta: float) -> str:
        """Cliff's Delta 해석 텍스트"""
        magnitude = self._interpret_cliffs_delta(abs(cliffs_delta))
        direction = "증가" if cliffs_delta > 0 else "감소"
        
        return f"{magnitude} 크기의 {direction} 효과 (Cliff's Delta)"
    
    def calculate_confidence_intervals(self, n_data: np.ndarray, n1_data: np.ndarray, 
                                     confidence_level: float = 0.95) -> Dict[str, Dict[str, float]]:
        """
        효과 크기의 신뢰구간을 계산합니다.
        
        Args:
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            confidence_level: 신뢰수준 (기본값: 0.95)
            
        Returns:
            효과 크기별 신뢰구간 딕셔너리
        """
        intervals = {}
        
        # Cohen's d 신뢰구간
        cohens_d_result = self._calculate_cohens_d(n_data, n1_data)
        cohens_d_ci = self._calculate_cohens_d_confidence_interval(n_data, n1_data, confidence_level)
        intervals['cohens_d'] = {
            'effect_size': cohens_d_result.value,
            'lower_bound': cohens_d_ci[0],
            'upper_bound': cohens_d_ci[1],
            'confidence_level': confidence_level
        }
        
        # Hedges' g 신뢰구간
        hedges_g_result = self._calculate_hedges_g(n_data, n1_data)
        hedges_g_ci = self._calculate_hedges_g_confidence_interval(n_data, n1_data, confidence_level)
        intervals['hedges_g'] = {
            'effect_size': hedges_g_result.value,
            'lower_bound': hedges_g_ci[0],
            'upper_bound': hedges_g_ci[1],
            'confidence_level': confidence_level
        }
        
        return intervals
    
    def _calculate_cohens_d_confidence_interval(self, n_data: np.ndarray, n1_data: np.ndarray, 
                                              confidence_level: float) -> Tuple[float, float]:
        """Cohen's d 신뢰구간 계산"""
        # Cohen's d 계산
        pooled_std = np.sqrt(((len(n_data) - 1) * np.var(n_data, ddof=1) + 
                             (len(n1_data) - 1) * np.var(n1_data, ddof=1)) / 
                            (len(n_data) + len(n1_data) - 2))
        
        cohens_d = (np.mean(n_data) - np.mean(n1_data)) / pooled_std
        
        # 자유도
        df = len(n_data) + len(n1_data) - 2
        
        # 표준오차 계산
        n1, n2 = len(n_data), len(n1_data)
        se = np.sqrt((n1 + n2) / (n1 * n2) + cohens_d**2 / (2 * (n1 + n2)))
        
        # t 분포의 임계값
        alpha = 1 - confidence_level
        t_critical = stats.t.ppf(1 - alpha/2, df)
        
        # 신뢰구간
        lower_bound = cohens_d - t_critical * se
        upper_bound = cohens_d + t_critical * se
        
        return lower_bound, upper_bound
    
    def _calculate_hedges_g_confidence_interval(self, n_data: np.ndarray, n1_data: np.ndarray, 
                                              confidence_level: float) -> Tuple[float, float]:
        """Hedges' g 신뢰구간 계산"""
        # Hedges' g 계산
        hedges_g_result = self._calculate_hedges_g(n_data, n1_data)
        hedges_g = hedges_g_result.value
        
        # 자유도
        df = len(n_data) + len(n1_data) - 2
        
        # 표준오차 계산 (Hedges' g용)
        n1, n2 = len(n_data), len(n1_data)
        correction_factor = 1 - (3 / (4 * df - 1))
        se = np.sqrt((n1 + n2) / (n1 * n2) + hedges_g**2 / (2 * (n1 + n2))) * correction_factor
        
        # t 분포의 임계값
        alpha = 1 - confidence_level
        t_critical = stats.t.ppf(1 - alpha/2, df)
        
        # 신뢰구간
        lower_bound = hedges_g - t_critical * se
        upper_bound = hedges_g + t_critical * se
        
        return lower_bound, upper_bound
    
    def _interpret_effect_size(self, effect_size: float) -> str:
        """효과 크기 해석"""
        thresholds = self.config['cohens_d_thresholds']
        
        if effect_size < thresholds['small']:
            return 'small'
        elif effect_size < thresholds['medium']:
            return 'medium'
        else:
            return 'large'
    
    def _get_effect_size_interpretation(self, effect_size: float) -> str:
        """효과 크기 해석 텍스트"""
        magnitude = self._interpret_effect_size(abs(effect_size))
        direction = "증가" if effect_size > 0 else "감소"
        
        return f"{magnitude} 크기의 {direction} 효과"
    
    def _assess_clinical_significance(self, 
                                    test_result: StatisticalTestResult,
                                    effect_size: EffectSizeResult) -> bool:
        """임상적 유의성 판단"""
        # 통계적 유의성과 효과 크기를 모두 고려
        is_statistically_significant = test_result.is_significant
        has_meaningful_effect = effect_size.magnitude in ['medium', 'large']
        
        return is_statistically_significant and has_meaningful_effect
    
    def assess_comprehensive_clinical_significance(self, 
                                                 test_result: StatisticalTestResult,
                                                 effect_sizes: Dict[EffectSizeType, EffectSizeResult],
                                                 n_data: np.ndarray,
                                                 n1_data: np.ndarray) -> Dict[str, Any]:
        """
        종합적인 임상적 유의성을 평가합니다.
        
        Args:
            test_result: 통계 검정 결과
            effect_sizes: 다양한 효과 크기 결과
            n_data: 현재 기간 데이터
            n1_data: 이전 기간 데이터
            
        Returns:
            임상적 유의성 평가 결과
        """
        assessment = {
            'is_clinically_significant': False,
            'confidence_level': 0.0,
            'reasoning': [],
            'recommendations': [],
            'risk_assessment': 'low'
        }
        
        # 1. 통계적 유의성 평가
        if test_result.is_significant:
            assessment['reasoning'].append("통계적으로 유의한 차이를 보입니다.")
            assessment['confidence_level'] += 0.3
        else:
            assessment['reasoning'].append("통계적으로 유의한 차이가 없습니다.")
            assessment['recommendations'].append("더 큰 샘플 크기나 다른 검정 방법을 고려하세요.")
        
        # 2. 효과 크기 평가
        effect_size_scores = []
        for effect_type, effect_result in effect_sizes.items():
            if effect_result.magnitude == 'large':
                effect_size_scores.append(1.0)
                assessment['reasoning'].append(f"{effect_type.value}: 큰 효과 크기")
            elif effect_result.magnitude == 'medium':
                effect_size_scores.append(0.7)
                assessment['reasoning'].append(f"{effect_type.value}: 중간 효과 크기")
            else:
                effect_size_scores.append(0.3)
                assessment['reasoning'].append(f"{effect_type.value}: 작은 효과 크기")
        
        if effect_size_scores:
            avg_effect_score = np.mean(effect_size_scores)
            assessment['confidence_level'] += avg_effect_score * 0.4
            
            if avg_effect_score >= 0.7:
                assessment['reasoning'].append("전반적으로 의미 있는 효과 크기를 보입니다.")
            elif avg_effect_score >= 0.5:
                assessment['reasoning'].append("보통 수준의 효과 크기를 보입니다.")
            else:
                assessment['reasoning'].append("효과 크기가 작습니다.")
        
        # 3. 실용적 중요성 평가
        practical_importance = self._assess_practical_importance(n_data, n1_data)
        assessment['confidence_level'] += practical_importance * 0.3
        
        if practical_importance >= 0.7:
            assessment['reasoning'].append("실용적으로 중요한 차이를 보입니다.")
        elif practical_importance >= 0.5:
            assessment['reasoning'].append("실용적 중요성이 보통 수준입니다.")
        else:
            assessment['reasoning'].append("실용적 중요성이 낮습니다.")
        
        # 4. 최종 임상적 유의성 판단
        assessment['is_clinically_significant'] = assessment['confidence_level'] >= 0.6
        
        # 5. 위험도 평가
        assessment['risk_assessment'] = self._assess_risk_level(test_result, effect_sizes, n_data, n1_data)
        
        # 6. 추가 권장사항
        if assessment['confidence_level'] < 0.5:
            assessment['recommendations'].append("임상적 유의성을 확립하기 위해 추가 연구가 필요합니다.")
        
        if test_result.p_value < 0.01:
            assessment['recommendations'].append("매우 강한 통계적 증거가 있으므로 임상적 적용을 고려하세요.")
        
        return assessment
    
    def _assess_practical_importance(self, n_data: np.ndarray, n1_data: np.ndarray) -> float:
        """실용적 중요성 평가"""
        # 평균 차이의 절대값
        mean_diff = abs(np.mean(n_data) - np.mean(n1_data))
        
        # 전체 범위 대비 차이 비율
        total_range = max(np.max(n_data), np.max(n1_data)) - min(np.min(n_data), np.min(n1_data))
        if total_range > 0:
            relative_diff = mean_diff / total_range
        else:
            relative_diff = 0
        
        # 표준편차 대비 차이
        pooled_std = np.sqrt(((len(n_data) - 1) * np.var(n_data, ddof=1) + 
                             (len(n1_data) - 1) * np.var(n1_data, ddof=1)) / 
                            (len(n_data) + len(n1_data) - 2))
        
        if pooled_std > 0:
            std_diff = mean_diff / pooled_std
        else:
            std_diff = 0
        
        # 종합 점수 계산
        practical_score = (relative_diff * 0.4 + min(std_diff / 2, 1.0) * 0.6)
        
        return min(practical_score, 1.0)
    
    def _assess_risk_level(self, test_result: StatisticalTestResult, 
                          effect_sizes: Dict[EffectSizeType, EffectSizeResult],
                          n_data: np.ndarray, n1_data: np.ndarray) -> str:
        """위험도 평가"""
        risk_score = 0
        
        # p-value 기반 위험도
        if test_result.p_value < 0.001:
            risk_score += 0.1  # 매우 낮은 위험
        elif test_result.p_value < 0.01:
            risk_score += 0.2
        elif test_result.p_value < 0.05:
            risk_score += 0.3
        else:
            risk_score += 0.5  # 높은 위험
        
        # 효과 크기 기반 위험도
        effect_size_scores = []
        for effect_result in effect_sizes.values():
            if effect_result.magnitude == 'large':
                effect_size_scores.append(0.1)  # 낮은 위험
            elif effect_result.magnitude == 'medium':
                effect_size_scores.append(0.3)
            else:
                effect_size_scores.append(0.5)  # 높은 위험
        
        if effect_size_scores:
            avg_effect_risk = np.mean(effect_size_scores)
            risk_score += avg_effect_risk * 0.5
        
        # 최종 위험도 판정
        if risk_score < 0.3:
            return 'low'
        elif risk_score < 0.6:
            return 'medium'
        else:
            return 'high'
    
    def _generate_metric_summary(self, 
                               metric: str,
                               test_result: StatisticalTestResult,
                               effect_size: EffectSizeResult,
                               clinical_significance: bool) -> str:
        """메트릭별 요약 생성"""
        significance_text = "유의함" if test_result.is_significant else "유의하지 않음"
        clinical_text = "임상적으로 유의함" if clinical_significance else "임상적으로 유의하지 않음"
        
        summary = (f"메트릭 '{metric}': {significance_text} (p={test_result.p_value:.4f}), "
                  f"효과 크기: {effect_size.interpretation} (d={effect_size.value:.3f}), "
                  f"{clinical_text}")
        
        return summary
    
    def _generate_overall_assessment(self, 
                                   total_metrics: int,
                                   significant_metrics: int,
                                   clinically_significant_metrics: int) -> str:
        """종합 평가 생성"""
        if total_metrics == 0:
            return "분석할 메트릭이 없습니다."
        
        significant_ratio = significant_metrics / total_metrics
        clinical_ratio = clinically_significant_metrics / total_metrics
        
        if clinical_ratio >= 0.7:
            assessment = "매우 좋음"
        elif clinical_ratio >= 0.5:
            assessment = "좋음"
        elif clinical_ratio >= 0.3:
            assessment = "보통"
        else:
            assessment = "개선 필요"
        
        return (f"전체 {total_metrics}개 메트릭 중 {significant_metrics}개 유의 "
                f"({significant_ratio:.1%}), {clinically_significant_metrics}개 임상적 유의 "
                f"({clinical_ratio:.1%}). 종합 평가: {assessment}")
    
    def _calculate_confidence_level(self, metrics_results: List[MetricAnalysisResult]) -> float:
        """신뢰도 계산"""
        if not metrics_results:
            return 0.0
        
        # 각 메트릭의 신뢰도 계산 (p-value 기반)
        confidences = []
        for result in metrics_results:
            # p-value를 신뢰도로 변환 (1 - p_value)
            confidence = 1 - result.test_result.p_value
            confidences.append(confidence)
        
        # 평균 신뢰도 반환
        return np.mean(confidences)
    
    def _get_numeric_metrics(self, data: pd.DataFrame) -> List[str]:
        """숫자형 메트릭 리스트 반환"""
        numeric_columns = data.select_dtypes(include=[np.number]).columns.tolist()
        # timestamp 컬럼 제외
        return [col for col in numeric_columns if 'timestamp' not in col.lower()]
    
    def _extract_period_info(self, data: pd.DataFrame, period_name: str) -> Dict[str, Any]:
        """기간 정보 추출"""
        return {
            'period_name': period_name,
            'start_time': data.index.min() if len(data) > 0 else None,
            'end_time': data.index.max() if len(data) > 0 else None,
            'duration_minutes': (data.index.max() - data.index.min()).total_seconds() / 60 if len(data) > 1 else 0,
            'total_records': len(data),
            'metrics_count': len(self._get_numeric_metrics(data))
        }

    def generate_integrated_analysis_report(self, 
                                          analysis_result: ComprehensiveAnalysisResult,
                                          report_format: str = "both") -> Union[IntegratedAnalysisReport, Dict[str, Any], str]:
        """
        통합 분석 보고서를 생성합니다.
        
        Args:
            analysis_result: 종합 분석 결과
            report_format: 보고서 형식 ("json", "text", "both")
            
        Returns:
            보고서 객체 또는 JSON/텍스트 형태의 보고서
        """
        # 요약 통계 계산
        summary_stats = self._calculate_summary_statistics(analysis_result)
        
        # Pass/Fail 평가
        pass_fail_assessment = self._assess_overall_pass_fail(analysis_result)
        
        # 권장사항 생성
        recommendations = self._generate_recommendations(analysis_result)
        
        # 위험도 평가
        risk_assessment = self._assess_overall_risk(analysis_result)
        
        # 보고서 생성
        report = IntegratedAnalysisReport(
            report_id=f"report_{analysis_result.analysis_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            analysis_result=analysis_result,
            summary_statistics=summary_stats,
            pass_fail_assessment=pass_fail_assessment,
            recommendations=recommendations,
            risk_assessment=risk_assessment,
            generated_at=datetime.now()
        )
        
        # 요청된 형식에 따라 반환
        if report_format == "json":
            return report.to_json()
        elif report_format == "text":
            return report.to_text_report()
        else:  # "both"
            return report
    
    def _calculate_summary_statistics(self, analysis_result: ComprehensiveAnalysisResult) -> Dict[str, Any]:
        """요약 통계를 계산합니다."""
        total_metrics = analysis_result.total_metrics
        significant_metrics = analysis_result.significant_metrics
        clinically_significant_metrics = analysis_result.clinically_significant_metrics
        
        # 유의율 계산
        significance_rate = significant_metrics / total_metrics if total_metrics > 0 else 0
        clinical_significance_rate = clinically_significant_metrics / total_metrics if total_metrics > 0 else 0
        
        # 효과 크기 통계
        effect_sizes = []
        test_types = []
        p_values = []
        
        for result in analysis_result.metrics_results:
            effect_sizes.append(result.effect_size.value)
            test_types.append(result.test_result.test_type.value)
            p_values.append(result.test_result.p_value)
        
        return {
            "total_metrics": total_metrics,
            "significant_metrics": significant_metrics,
            "clinically_significant_metrics": clinically_significant_metrics,
            "significance_rate": significance_rate,
            "clinical_significance_rate": clinical_significance_rate,
            "avg_effect_size": np.mean(effect_sizes) if effect_sizes else 0,
            "median_effect_size": np.median(effect_sizes) if effect_sizes else 0,
            "min_effect_size": np.min(effect_sizes) if effect_sizes else 0,
            "max_effect_size": np.max(effect_sizes) if effect_sizes else 0,
            "avg_p_value": np.mean(p_values) if p_values else 1,
            "test_type_distribution": {test_type: test_types.count(test_type) for test_type in set(test_types)}
        }
    
    def _assess_overall_pass_fail(self, analysis_result: ComprehensiveAnalysisResult) -> Dict[str, Any]:
        """전체 Pass/Fail 평가를 수행합니다."""
        total_metrics = analysis_result.total_metrics
        significant_metrics = analysis_result.significant_metrics
        clinically_significant_metrics = analysis_result.clinically_significant_metrics
        
        # 기본 기준: 80% 이상의 메트릭이 통계적으로 유의하고 임상적으로 유의해야 Pass
        significance_threshold = 0.8
        clinical_threshold = 0.8
        
        significance_rate = significant_metrics / total_metrics if total_metrics > 0 else 0
        clinical_rate = clinically_significant_metrics / total_metrics if total_metrics > 0 else 0
        
        # Pass/Fail 판정
        if significance_rate >= significance_threshold and clinical_rate >= clinical_threshold:
            overall_result = "PASS"
            confidence = "high"
        elif significance_rate >= 0.6 and clinical_rate >= 0.6:
            overall_result = "CONDITIONAL_PASS"
            confidence = "medium"
        else:
            overall_result = "FAIL"
            confidence = "high"
        
        # 평가 근거 생성
        reasoning = []
        if significance_rate >= significance_threshold:
            reasoning.append(f"통계적 유의성 기준 충족 ({significance_rate:.1%} >= {significance_threshold:.1%})")
        else:
            reasoning.append(f"통계적 유의성 기준 미충족 ({significance_rate:.1%} < {significance_threshold:.1%})")
        
        if clinical_rate >= clinical_threshold:
            reasoning.append(f"임상적 유의성 기준 충족 ({clinical_rate:.1%} >= {clinical_threshold:.1%})")
        else:
            reasoning.append(f"임상적 유의성 기준 미충족 ({clinical_rate:.1%} < {clinical_threshold:.1%})")
        
        return {
            "overall_result": overall_result,
            "confidence": confidence,
            "reasoning": " | ".join(reasoning),
            "significance_rate": significance_rate,
            "clinical_rate": clinical_rate,
            "significance_threshold": significance_threshold,
            "clinical_threshold": clinical_threshold
        }
    
    def _generate_recommendations(self, analysis_result: ComprehensiveAnalysisResult) -> List[str]:
        """권장사항을 생성합니다."""
        recommendations = []
        
        total_metrics = analysis_result.total_metrics
        significant_metrics = analysis_result.significant_metrics
        clinically_significant_metrics = analysis_result.clinically_significant_metrics
        
        # 통계적 유의성 관련 권장사항
        significance_rate = significant_metrics / total_metrics if total_metrics > 0 else 0
        if significance_rate < 0.5:
            recommendations.append("통계적 유의성이 낮습니다. 샘플 크기를 늘리거나 측정 방법을 개선하는 것을 고려하세요.")
        elif significance_rate < 0.8:
            recommendations.append("통계적 유의성이 보통 수준입니다. 추가 데이터 수집을 통해 결과를 강화하는 것을 권장합니다.")
        
        # 임상적 유의성 관련 권장사항
        clinical_rate = clinically_significant_metrics / total_metrics if total_metrics > 0 else 0
        if clinical_rate < 0.5:
            recommendations.append("임상적 유의성이 낮습니다. 실용적 중요성을 높이기 위한 개선 방안을 검토하세요.")
        elif clinical_rate < 0.8:
            recommendations.append("임상적 유의성이 보통 수준입니다. 효과 크기를 높이기 위한 개입을 고려하세요.")
        
        # 효과 크기 관련 권장사항
        effect_sizes = [result.effect_size.value for result in analysis_result.metrics_results]
        avg_effect_size = np.mean(effect_sizes) if effect_sizes else 0
        
        if avg_effect_size < 0.2:
            recommendations.append("평균 효과 크기가 작습니다. 더 강력한 개입이나 측정 방법의 개선이 필요할 수 있습니다.")
        elif avg_effect_size > 0.8:
            recommendations.append("평균 효과 크기가 큽니다. 결과의 안정성을 확인하기 위해 추가 검증을 권장합니다.")
        
        # 검정 방법 관련 권장사항
        test_types = [result.test_result.test_type.value for result in analysis_result.metrics_results]
        test_distribution = {test_type: test_types.count(test_type) for test_type in set(test_types)}
        
        if len(test_distribution) == 1:
            recommendations.append("모든 메트릭에 동일한 검정 방법이 사용되었습니다. 데이터 특성에 따른 다양한 검정 방법 적용을 고려하세요.")
        
        # 일반적인 권장사항
        if significant_metrics == total_metrics:
            recommendations.append("모든 메트릭이 통계적으로 유의합니다. 결과의 신뢰성을 높이기 위해 교차 검증을 권장합니다.")
        
        if len(recommendations) == 0:
            recommendations.append("현재 결과는 양호합니다. 정기적인 모니터링을 통해 지속적인 개선을 추진하세요.")
        
        return recommendations
    
    def _assess_overall_risk(self, analysis_result: ComprehensiveAnalysisResult) -> Dict[str, Any]:
        """전체 위험도를 평가합니다."""
        risk_factors = []
        risk_score = 0
        
        total_metrics = analysis_result.total_metrics
        significant_metrics = analysis_result.significant_metrics
        
        # 통계적 유의성 기반 위험도
        significance_rate = significant_metrics / total_metrics if total_metrics > 0 else 0
        if significance_rate < 0.3:
            risk_score += 0.4
            risk_factors.append("낮은 통계적 유의성")
        elif significance_rate < 0.6:
            risk_score += 0.2
            risk_factors.append("보통 통계적 유의성")
        
        # p-value 기반 위험도
        p_values = [result.test_result.p_value for result in analysis_result.metrics_results]
        high_p_values = [p for p in p_values if p > 0.1]
        if len(high_p_values) > len(p_values) * 0.5:
            risk_score += 0.3
            risk_factors.append("높은 p-value 비율")
        
        # 효과 크기 기반 위험도
        effect_sizes = [result.effect_size.value for result in analysis_result.metrics_results]
        small_effects = [e for e in effect_sizes if e < 0.2]
        if len(small_effects) > len(effect_sizes) * 0.7:
            risk_score += 0.3
            risk_factors.append("작은 효과 크기")
        
        # 샘플 크기 기반 위험도
        for result in analysis_result.metrics_results:
            n_size = len(result.period_n_data)
            n1_size = len(result.period_n1_data)
            if n_size < 30 or n1_size < 30:
                risk_score += 0.1
                risk_factors.append("작은 샘플 크기")
                break
        
        # 최종 위험도 판정
        if risk_score < 0.3:
            overall_risk = "low"
            risk_explanation = "전반적으로 낮은 위험도를 보입니다."
        elif risk_score < 0.6:
            overall_risk = "medium"
            risk_explanation = "보통 수준의 위험도를 보입니다. 추가 검증이 권장됩니다."
        else:
            overall_risk = "high"
            risk_explanation = "높은 위험도를 보입니다. 결과 해석에 주의가 필요합니다."
        
        return {
            "overall_risk": overall_risk,
            "risk_score": risk_score,
            "risk_factors": list(set(risk_factors)),  # 중복 제거
            "risk_explanation": risk_explanation
        }
    
    def generate_comprehensive_report_with_visualization(self, 
                                                       analysis_result: ComprehensiveAnalysisResult,
                                                       include_charts: bool = True) -> Dict[str, Any]:
        """
        시각화를 포함한 종합 보고서를 생성합니다.
        
        Args:
            analysis_result: 종합 분석 결과
            include_charts: 차트 포함 여부
            
        Returns:
            시각화 데이터를 포함한 종합 보고서
        """
        # 기본 통합 보고서 생성
        integrated_report = self.generate_integrated_analysis_report(analysis_result, "both")
        
        # 시각화 데이터 생성
        visualization_data = {}
        if include_charts:
            visualization_data = self._generate_visualization_data(analysis_result)
        
        # 종합 보고서 구성
        comprehensive_report = {
            "report": integrated_report.to_json() if hasattr(integrated_report, 'to_json') else integrated_report,
            "text_report": integrated_report.to_text_report() if hasattr(integrated_report, 'to_text_report') else "",
            "visualization": visualization_data,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "analysis_id": analysis_result.analysis_id,
                "total_metrics": analysis_result.total_metrics,
                "confidence_level": analysis_result.confidence_level
            }
        }
        
        return comprehensive_report
    
    def _generate_visualization_data(self, analysis_result: ComprehensiveAnalysisResult) -> Dict[str, Any]:
        """시각화를 위한 데이터를 생성합니다."""
        visualization_data = {}
        
        # 메트릭별 결과 요약
        metrics_summary = []
        for result in analysis_result.metrics_results:
            metrics_summary.append({
                "metric_name": result.metric_name,
                "p_value": result.test_result.p_value,
                "effect_size": result.effect_size.value,
                "is_significant": result.test_result.is_significant,
                "clinical_significance": result.clinical_significance,
                "test_type": result.test_result.test_type.value
            })
        
        visualization_data["metrics_summary"] = metrics_summary
        
        # 통계적 유의성 분포
        significant_count = sum(1 for result in analysis_result.metrics_results if result.test_result.is_significant)
        non_significant_count = len(analysis_result.metrics_results) - significant_count
        
        visualization_data["significance_distribution"] = {
            "significant": significant_count,
            "non_significant": non_significant_count,
            "total": len(analysis_result.metrics_results)
        }
        
        # 효과 크기 분포
        effect_sizes = [result.effect_size.value for result in analysis_result.metrics_results]
        visualization_data["effect_size_distribution"] = {
            "values": effect_sizes,
            "mean": np.mean(effect_sizes) if effect_sizes else 0,
            "median": np.median(effect_sizes) if effect_sizes else 0,
            "std": np.std(effect_sizes) if effect_sizes else 0
        }
        
        # 검정 방법 분포
        test_types = [result.test_result.test_type.value for result in analysis_result.metrics_results]
        test_distribution = {test_type: test_types.count(test_type) for test_type in set(test_types)}
        visualization_data["test_type_distribution"] = test_distribution
        
        # p-value 분포
        p_values = [result.test_result.p_value for result in analysis_result.metrics_results]
        visualization_data["p_value_distribution"] = {
            "values": p_values,
            "mean": np.mean(p_values) if p_values else 1,
            "median": np.median(p_values) if p_values else 1,
            "significant_count": sum(1 for p in p_values if p < 0.05)
        }
        
        return visualization_data
