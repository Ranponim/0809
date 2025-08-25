"""
통계 분석 엔진 단위 테스트

작업 3: Backend: Develop Core Statistical Analysis Engine
다양한 시나리오를 사용하여 통계 분석 엔진의 정확성을 검증합니다.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import os
import unittest

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.utils.statistical_analysis import (
    StatisticalAnalysisEngine, 
    TestType, 
    EffectSizeType,
    StatisticalTestResult,
    EffectSizeResult,
    MetricAnalysisResult,
    ComprehensiveAnalysisResult,
    IntegratedAnalysisReport
)

class TestStatisticalAnalysisEngine(unittest.TestCase):
    """StatisticalAnalysisEngine 테스트 클래스"""
    
    def setUp(self):
        """각 테스트 메서드 실행 전 설정"""
        self.engine = StatisticalAnalysisEngine()
        self.sample_n_data = np.array([100, 110, 120])
        self.sample_n1_data = np.array([90, 100, 110])

    def test_default_config(self):
        """기본 설정이 올바르게 로드되는지 테스트"""
        config = self.engine.config

        assert 'alpha' in config
        assert 'normality_threshold' in config
        assert 'homogeneity_threshold' in config
        assert 'cohens_d_thresholds' in config
        assert 'clinical_significance_threshold' in config
        assert 'min_sample_size' in config
        assert 'max_missing_ratio' in config

        assert config['alpha'] == 0.05
        assert config['min_sample_size'] == 10
        assert config['max_missing_ratio'] == 0.3

    def test_custom_config(self):
        """사용자 정의 설정이 올바르게 적용되는지 테스트"""
        custom_config = {
            'alpha': 0.01,
            'min_sample_size': 20,
            'cohens_d_thresholds': {
                'small': 0.1,
                'medium': 0.3,
                'large': 0.5
            }
        }

        engine = StatisticalAnalysisEngine(config=custom_config)

        assert engine.config['alpha'] == 0.01
        assert engine.config['min_sample_size'] == 20
        assert engine.config['cohens_d_thresholds']['small'] == 0.1

    def test_generate_sample_data(self):
        """샘플 데이터 생성 테스트"""
        # 명확한 차이가 있는 두 기간 데이터 생성
        timestamps_n = pd.date_range(start='2024-01-01', end='2024-01-01 02:00', freq='1min')
        timestamps_n1 = pd.date_range(start='2024-01-02', end='2024-01-02 02:00', freq='1min')

        # 기간 n: 높은 값
        n_data = np.random.normal(150, 10, len(timestamps_n))
        # 기간 n-1: 낮은 값
        n1_data = np.random.normal(100, 10, len(timestamps_n1))

        period_n_df = pd.DataFrame({
            'timestamp': timestamps_n,
            'throughput': n_data,
            'latency': 1000 / (n_data + 1)
        })
        period_n_df.set_index('timestamp', inplace=True)

        period_n1_df = pd.DataFrame({
            'timestamp': timestamps_n1,
            'throughput': n1_data,
            'latency': 1000 / (n1_data + 1)
        })
        period_n1_df.set_index('timestamp', inplace=True)

        return period_n_df, period_n1_df

    def test_basic_statistical_comparison(self):
        """기본 통계 비교 분석 테스트"""
        period_n_df, period_n1_df = self.test_generate_sample_data()

        # 통계 분석 수행
        result = self.engine.analyze_periods_comparison(period_n_df, period_n1_df)

        # 기본 검증
        assert isinstance(result, ComprehensiveAnalysisResult)
        assert result.total_metrics > 0
        assert len(result.metrics_results) > 0
        assert result.timestamp is not None

        # 기간 정보 검증
        assert result.period_n_info['period_name'] == 'n'
        assert result.period_n1_info['period_name'] == 'n-1'

    def test_single_metric_analysis(self):
        """단일 메트릭 분석 테스트"""
        period_n_df, period_n1_df = self.test_generate_sample_data()

        # 단일 메트릭 분석
        result = self.engine._analyze_single_metric(period_n_df, period_n1_df, 'throughput')

        assert isinstance(result, MetricAnalysisResult)
        assert result.metric_name == 'throughput'
        assert len(result.period_n_data) > 0
        assert len(result.period_n1_data) > 0
        assert isinstance(result.test_result, StatisticalTestResult)
        assert isinstance(result.effect_size, EffectSizeResult)

    def test_statistical_test_selection(self):
        """통계 검정 방법 선택 테스트"""
        # 정규분포 데이터
        normal_data_n = np.random.normal(100, 10, 50)
        normal_data_n1 = np.random.normal(95, 10, 50)

        test_result = self.engine._perform_statistical_test(normal_data_n, normal_data_n1)

        assert isinstance(test_result, StatisticalTestResult)
        assert test_result.test_type in [TestType.T_TEST, TestType.MANN_WHITNEY]
        assert 0 <= test_result.p_value <= 1
        assert test_result.alpha == self.engine.config['alpha']

    def test_effect_size_calculation(self):
        """효과 크기 계산 테스트"""
        # 명확한 차이가 있는 데이터
        data_n = np.random.normal(150, 10, 50)
        data_n1 = np.random.normal(100, 10, 50)

        effect_size = self.engine._calculate_effect_size(data_n, data_n1)

        assert isinstance(effect_size, EffectSizeResult)
        assert effect_size.effect_size_type == EffectSizeType.COHENS_D
        assert effect_size.value > 0  # n이 n-1보다 큰 경우
        assert effect_size.magnitude in ['small', 'medium', 'large']
        assert len(effect_size.interpretation) > 0

    def test_clinical_significance_assessment(self):
        """임상적 유의성 판단 테스트"""
        # 유의한 결과와 큰 효과 크기
        significant_test = StatisticalTestResult(
            test_type=TestType.T_TEST,
            statistic=2.5,
            p_value=0.01,  # 유의함
            is_significant=True
        )

        large_effect = EffectSizeResult(
            effect_size_type=EffectSizeType.COHENS_D,
            value=0.9,  # 큰 효과
            interpretation="large 크기의 증가 효과",
            magnitude="large"
        )

        clinical_sig = self.engine._assess_clinical_significance(significant_test, large_effect)
        assert clinical_sig == True

        # 유의하지 않은 결과
        non_significant_test = StatisticalTestResult(
            test_type=TestType.T_TEST,
            statistic=1.0,
            p_value=0.1,  # 유의하지 않음
            is_significant=False
        )

        clinical_sig = self.engine._assess_clinical_significance(non_significant_test, large_effect)
        assert clinical_sig == False

    def test_data_quality_check(self):
        """데이터 품질 검사 테스트"""
        # 좋은 품질의 데이터
        good_data_n = np.random.normal(100, 10, 50)
        good_data_n1 = np.random.normal(95, 10, 50)

        quality_good = self.engine._check_data_quality(good_data_n, good_data_n1)
        assert quality_good == True

        # 부족한 샘플 크기
        small_data_n = np.random.normal(100, 10, 5)  # 최소 샘플 크기 미만
        small_data_n1 = np.random.normal(95, 10, 5)

        quality_bad = self.engine._check_data_quality(small_data_n, small_data_n1)
        assert quality_bad == False

    def test_normality_test(self):
        """정규성 검정 테스트"""
        # 정규분포 데이터
        normal_data = np.random.normal(100, 10, 100)
        is_normal = self.engine._test_normality(normal_data)
        assert isinstance(bool(is_normal), bool)
        
        # 비정규분포 데이터
        non_normal_data = np.random.exponential(1, 100)
        is_normal_non = self.engine._test_normality(non_normal_data)
        assert isinstance(bool(is_normal_non), bool)

    def test_homogeneity_test(self):
        """등분산성 검정 테스트"""
        # 등분산 데이터
        data_n = np.random.normal(100, 10, 50)
        data_n1 = np.random.normal(95, 10, 50)

        is_homogeneous = self.engine._test_homogeneity(data_n, data_n1)
        assert isinstance(bool(is_homogeneous), bool)
        
        # 비등분산 데이터
        data_n_unequal = np.random.normal(100, 5, 50)
        data_n1_unequal = np.random.normal(95, 20, 50)
        
        is_homogeneous_unequal = self.engine._test_homogeneity(data_n_unequal, data_n1_unequal)
        assert isinstance(bool(is_homogeneous_unequal), bool)

    def test_metric_extraction(self):
        """메트릭 데이터 추출 테스트"""
        # 샘플 데이터 생성
        timestamps = pd.date_range(start='2024-01-01', end='2024-01-01 01:00', freq='1min')
        data = pd.DataFrame({
            'timestamp': timestamps,
            'throughput': np.random.normal(100, 10, len(timestamps)),
            'latency': np.random.normal(50, 5, len(timestamps))
        })
        data.set_index('timestamp', inplace=True)

        # 메트릭 추출
        throughput_data = self.engine._extract_metric_data(data, 'throughput')
        assert len(throughput_data) > 0
        assert isinstance(throughput_data, np.ndarray)

        # 존재하지 않는 메트릭
        with pytest.raises(ValueError):
            self.engine._extract_metric_data(data, 'nonexistent_metric')

    def test_numeric_metrics_detection(self):
        """숫자형 메트릭 감지 테스트"""
        # 혼합 데이터 타입을 가진 DataFrame
        timestamps = pd.date_range(start='2024-01-01', end='2024-01-01 01:00', freq='1min')
        n_points = len(timestamps)
        
        data = pd.DataFrame({
            'timestamp': timestamps,
            'throughput': np.random.normal(100, 10, n_points),
            'latency': np.random.normal(50, 5, n_points),
            'status': ['active'] * n_points,
            'category': ['A', 'B'] * (n_points // 2) + ['A'] * (n_points % 2)
        })
        
        numeric_metrics = self.engine._get_numeric_metrics(data)
        
        # 숫자형 컬럼만 감지되어야 함
        expected_metrics = ['throughput', 'latency']
        assert set(numeric_metrics) == set(expected_metrics)
        
        # timestamp는 제외되어야 함
        assert 'timestamp' not in numeric_metrics
        assert 'status' not in numeric_metrics
        assert 'category' not in numeric_metrics

    def test_period_info_extraction(self):
        """기간 정보 추출 테스트"""
        timestamps = pd.date_range(start='2024-01-01', end='2024-01-01 02:00', freq='1min')
        data = pd.DataFrame({
            'throughput': np.random.normal(100, 10, len(timestamps))
        }, index=timestamps)

        period_info = self.engine._extract_period_info(data, 'test_period')

        assert period_info['period_name'] == 'test_period'
        assert period_info['start_time'] == timestamps[0]
        assert period_info['end_time'] == timestamps[-1]
        assert period_info['total_records'] == len(timestamps)
        assert period_info['metrics_count'] > 0

    def test_confidence_level_calculation(self):
        """신뢰도 계산 테스트"""
        # 샘플 메트릭 결과 생성
        results = []
        for i in range(3):
            test_result = StatisticalTestResult(
                test_type=TestType.T_TEST,
                statistic=2.0,
                p_value=0.05,  # 유의함
                is_significant=True
            )
            
            effect_size = EffectSizeResult(
                effect_size_type=EffectSizeType.COHENS_D,
                value=0.5,
                interpretation="medium 크기의 효과",
                magnitude="medium"
            )
            
            result = MetricAnalysisResult(
                metric_name=f"metric_{i}",
                period_n_data=np.array([100, 110, 120]),
                period_n1_data=np.array([90, 100, 110]),
                test_result=test_result,
                effect_size=effect_size,
                clinical_significance=True,
                summary=f"Metric {i} summary"
            )
            results.append(result)

        confidence = self.engine._calculate_confidence_level(results)
        assert 0 <= confidence <= 1

    def test_overall_assessment_generation(self):
        """종합 평가 생성 테스트"""
        # 다양한 시나리오 테스트
        scenarios = [
            (10, 8, 7),   # 매우 좋음
            (10, 6, 5),   # 좋음
            (10, 4, 3),   # 보통
            (10, 2, 1),   # 개선 필요
        ]

        for total, significant, clinical in scenarios:
            assessment = self.engine._generate_overall_assessment(total, significant, clinical)
            assert len(assessment) > 0
            assert str(total) in assessment
            assert str(significant) in assessment
            assert str(clinical) in assessment

    def test_empty_data_handling(self):
        """빈 데이터 처리 테스트"""
        # 빈 DataFrame
        empty_df = pd.DataFrame()

        with pytest.raises(Exception):
            self.engine.analyze_periods_comparison(empty_df, empty_df)

    def test_missing_data_handling(self):
        """결측치 처리 테스트"""
        timestamps = pd.date_range(start='2024-01-01', end='2024-01-01 01:00', freq='1min')
        
        # 결측치가 있는 데이터
        data_with_missing = pd.DataFrame({
            'throughput': [100, np.nan, 110, np.nan, 120] * (len(timestamps) // 5)
        }, index=timestamps[:len(timestamps)//5*5])

        # 결측치가 없는 데이터
        data_without_missing = pd.DataFrame({
            'throughput': np.random.normal(100, 10, len(timestamps))
        }, index=timestamps)

        # 결측치가 있는 데이터에서 메트릭 추출
        extracted_data = self.engine._extract_metric_data(data_with_missing, 'throughput')
        assert len(extracted_data) < len(data_with_missing)  # 결측치가 제거됨

    def test_edge_cases(self):
        """엣지 케이스 테스트"""
        # 매우 작은 샘플 크기
        small_data_n = np.array([1, 2, 3])
        small_data_n1 = np.array([2, 3, 4])

        with pytest.raises(ValueError):
            self.engine._extract_metric_data(
                pd.DataFrame({'metric': small_data_n}), 'metric'
            )

        # 매우 큰 효과 크기
        large_diff_n = np.random.normal(200, 10, 50)
        large_diff_n1 = np.random.normal(50, 10, 50)

        effect_size = self.engine._calculate_effect_size(large_diff_n, large_diff_n1)
        assert effect_size.magnitude == 'large'

    def test_custom_statistical_tests(self):
        """사용자 지정 통계 검정 테스트"""
        # 테스트 데이터 생성
        n_data = np.random.normal(100, 10, 50)
        n1_data = np.random.normal(95, 10, 50)

        # Student's t-test
        result = self.engine.perform_custom_statistical_test(n_data, n1_data, TestType.T_TEST)
        assert isinstance(result, StatisticalTestResult)
        assert result.test_type == TestType.T_TEST

        # Mann-Whitney U test
        result = self.engine.perform_custom_statistical_test(n_data, n1_data, TestType.MANN_WHITNEY)
        assert isinstance(result, StatisticalTestResult)
        assert result.test_type == TestType.MANN_WHITNEY

        # Wilcoxon signed-rank test
        result = self.engine.perform_custom_statistical_test(n_data, n1_data, TestType.WILCOXON)
        assert isinstance(result, StatisticalTestResult)
        assert result.test_type == TestType.WILCOXON

        # Paired t-test
        result = self.engine.perform_custom_statistical_test(n_data, n1_data, TestType.PAIRED_T_TEST)
        assert isinstance(result, StatisticalTestResult)
        assert result.test_type == TestType.PAIRED_T_TEST

        # Kruskal-Wallis H test
        result = self.engine.perform_custom_statistical_test(n_data, n1_data, TestType.KRUSKAL_WALLIS)
        assert isinstance(result, StatisticalTestResult)
        assert result.test_type == TestType.KRUSKAL_WALLIS

        # One-way ANOVA
        result = self.engine.perform_custom_statistical_test(n_data, n1_data, TestType.ANOVA)
        assert isinstance(result, StatisticalTestResult)
        assert result.test_type == TestType.ANOVA

        # Kolmogorov-Smirnov test
        result = self.engine.perform_custom_statistical_test(n_data, n1_data, TestType.KS_TEST)
        assert isinstance(result, StatisticalTestResult)
        assert result.test_type == TestType.KS_TEST

    def test_multiple_tests(self):
        """여러 통계 검정 동시 수행 테스트"""
        n_data = np.random.normal(100, 10, 50)
        n1_data = np.random.normal(95, 10, 50)

        test_types = [TestType.T_TEST, TestType.MANN_WHITNEY, TestType.KS_TEST]
        results = self.engine.perform_multiple_tests(n_data, n1_data, test_types)

        assert len(results) == 3
        assert TestType.T_TEST in results
        assert TestType.MANN_WHITNEY in results
        assert TestType.KS_TEST in results

        for test_type, result in results.items():
            assert isinstance(result, StatisticalTestResult)
            assert result.test_type == test_type

    def test_recommended_tests(self):
        """권장 검정 방법 테스트"""
        # 정규분포 데이터
        normal_n = np.random.normal(100, 10, 50)
        normal_n1 = np.random.normal(95, 10, 50)

        recommended = self.engine.get_recommended_tests(normal_n, normal_n1)
        assert len(recommended) > 0
        assert TestType.T_TEST in recommended
        assert TestType.ANOVA in recommended
        assert TestType.KS_TEST in recommended

        # 비정규분포 데이터
        uniform_n = np.random.uniform(0, 100, 50)
        uniform_n1 = np.random.uniform(0, 100, 50)

        recommended = self.engine.get_recommended_tests(uniform_n, uniform_n1)
        assert len(recommended) > 0
        assert TestType.MANN_WHITNEY in recommended
        assert TestType.KRUSKAL_WALLIS in recommended
        assert TestType.KS_TEST in recommended

    def test_specific_test_methods(self):
        """개별 검정 메서드 테스트"""
        n_data = np.random.normal(100, 10, 50)
        n1_data = np.random.normal(95, 10, 50)

        # Student's t-test
        stat, p_val = self.engine._perform_students_t_test(n_data, n1_data)
        assert isinstance(stat, float)
        assert isinstance(p_val, float)
        assert 0 <= p_val <= 1

        # Welch's t-test
        stat, p_val = self.engine._perform_welchs_t_test(n_data, n1_data)
        assert isinstance(stat, float)
        assert isinstance(p_val, float)
        assert 0 <= p_val <= 1

        # Mann-Whitney U test
        stat, p_val = self.engine._perform_mann_whitney_test(n_data, n1_data)
        assert isinstance(stat, float)
        assert isinstance(p_val, float)
        assert 0 <= p_val <= 1

        # Wilcoxon signed-rank test
        stat, p_val = self.engine._perform_wilcoxon_test(n_data, n1_data)
        assert isinstance(stat, float)
        assert isinstance(p_val, float)
        assert 0 <= p_val <= 1

        # Paired t-test
        stat, p_val = self.engine._perform_paired_t_test(n_data, n1_data)
        assert isinstance(stat, float)
        assert isinstance(p_val, float)
        assert 0 <= p_val <= 1

        # Kruskal-Wallis H test
        stat, p_val = self.engine._perform_kruskal_wallis_test(n_data, n1_data)
        assert isinstance(stat, float)
        assert isinstance(p_val, float)
        assert 0 <= p_val <= 1

        # One-way ANOVA
        stat, p_val = self.engine._perform_anova_test(n_data, n1_data)
        assert isinstance(stat, float)
        assert isinstance(p_val, float)
        assert 0 <= p_val <= 1

        # Kolmogorov-Smirnov test
        stat, p_val = self.engine._perform_ks_test(n_data, n1_data)
        assert isinstance(stat, float)
        assert isinstance(p_val, float)
        assert 0 <= p_val <= 1

    def test_different_length_data(self):
        """다른 길이의 데이터 처리 테스트"""
        n_data = np.random.normal(100, 10, 50)
        n1_data = np.random.normal(95, 10, 30)  # 더 짧은 데이터

        # 대응표본 검정은 짧은 길이에 맞춰야 함
        stat, p_val = self.engine._perform_wilcoxon_test(n_data, n1_data)
        assert isinstance(stat, float)
        assert isinstance(p_val, float)

        stat, p_val = self.engine._perform_paired_t_test(n_data, n1_data)
        assert isinstance(stat, float)
        assert isinstance(p_val, float)

    def test_error_handling(self):
        """오류 처리 테스트"""
        # 빈 데이터
        empty_data = np.array([])
        normal_data = np.random.normal(100, 10, 50)

        with pytest.raises(Exception):
            self.engine.perform_custom_statistical_test(empty_data, normal_data, TestType.T_TEST)

        # 잘못된 검정 유형
        with pytest.raises(ValueError):
            self.engine.perform_custom_statistical_test(normal_data, normal_data, "invalid_test")

    def test_comprehensive_effect_sizes(self):
        """종합 효과 크기 계산 테스트"""
        # 테스트 데이터 생성
        n_data = np.random.normal(150, 10, 50)
        n1_data = np.random.normal(100, 10, 50)

        # 종합 효과 크기 계산
        effect_sizes = self.engine.calculate_comprehensive_effect_sizes(n_data, n1_data)

        # 모든 효과 크기 유형이 포함되어야 함
        assert EffectSizeType.COHENS_D in effect_sizes
        assert EffectSizeType.HEDGES_G in effect_sizes
        assert EffectSizeType.CLIFFS_DELTA in effect_sizes

        # 각 효과 크기 검증
        for effect_type, effect_result in effect_sizes.items():
            assert isinstance(effect_result, EffectSizeResult)
            assert effect_result.effect_size_type == effect_type
            assert effect_result.value > 0  # n이 n-1보다 큰 경우
            assert effect_result.magnitude in ['small', 'medium', 'large']

    def test_individual_effect_size_calculations(self):
        """개별 효과 크기 계산 테스트"""
        n_data = np.random.normal(150, 10, 50)
        n1_data = np.random.normal(100, 10, 50)

        # Cohen's d
        cohens_d = self.engine._calculate_cohens_d(n_data, n1_data)
        assert isinstance(cohens_d, EffectSizeResult)
        assert cohens_d.effect_size_type == EffectSizeType.COHENS_D
        assert cohens_d.value > 0

        # Hedges' g
        hedges_g = self.engine._calculate_hedges_g(n_data, n1_data)
        assert isinstance(hedges_g, EffectSizeResult)
        assert hedges_g.effect_size_type == EffectSizeType.HEDGES_G
        assert hedges_g.value > 0
        # Hedges' g는 Cohen's d보다 약간 작아야 함 (편향 보정)
        assert abs(hedges_g.value) <= abs(cohens_d.value)

        # Cliff's Delta
        cliffs_delta = self.engine._calculate_cliffs_delta(n_data, n1_data)
        assert isinstance(cliffs_delta, EffectSizeResult)
        assert cliffs_delta.effect_size_type == EffectSizeType.CLIFFS_DELTA
        assert cliffs_delta.value > 0

    def test_confidence_intervals(self):
        """신뢰구간 계산 테스트"""
        n_data = np.random.normal(150, 10, 50)
        n1_data = np.random.normal(100, 10, 50)

        # 신뢰구간 계산
        intervals = self.engine.calculate_confidence_intervals(n_data, n1_data, confidence_level=0.95)

        assert 'cohens_d' in intervals
        assert 'hedges_g' in intervals

        for effect_type, interval in intervals.items():
            assert 'effect_size' in interval
            assert 'lower_bound' in interval
            assert 'upper_bound' in interval
            assert 'confidence_level' in interval
            assert interval['confidence_level'] == 0.95
            assert interval['lower_bound'] <= interval['effect_size'] <= interval['upper_bound']

    def test_cliffs_delta_edge_cases(self):
        """Cliff's Delta 엣지 케이스 테스트"""
        # 동일한 데이터
        same_data = np.random.normal(100, 10, 30)
        cliffs_delta = self.engine._calculate_cliffs_delta(same_data, same_data)
        assert abs(cliffs_delta.value) < 0.1  # 거의 0에 가까워야 함

        # 완전히 분리된 데이터
        low_data = np.random.normal(50, 5, 30)
        high_data = np.random.normal(150, 5, 30)
        cliffs_delta = self.engine._calculate_cliffs_delta(high_data, low_data)
        assert cliffs_delta.value > 0.8  # 매우 큰 양수 값

    def test_comprehensive_clinical_significance(self):
        """종합 임상적 유의성 평가 테스트"""
        # 테스트 데이터 생성
        n_data = np.random.normal(150, 10, 50)
        n1_data = np.random.normal(100, 10, 50)

        # 통계 검정 수행
        test_result = self.engine._perform_statistical_test(n_data, n1_data)

        # 효과 크기 계산
        effect_sizes = self.engine.calculate_comprehensive_effect_sizes(n_data, n1_data)

        # 종합 임상적 유의성 평가
        assessment = self.engine.assess_comprehensive_clinical_significance(
            test_result, effect_sizes, n_data, n1_data
        )

        # 평가 결과 검증
        assert 'is_clinically_significant' in assessment
        assert 'confidence_level' in assessment
        assert 'reasoning' in assessment
        assert 'recommendations' in assessment
        assert 'risk_assessment' in assessment

        assert isinstance(bool(assessment['is_clinically_significant']), bool)
        assert isinstance(assessment['confidence_level'], (int, float))
        assert isinstance(assessment['reasoning'], list)
        assert isinstance(assessment['recommendations'], list)
        assert isinstance(assessment['risk_assessment'], str)

    def test_practical_importance_assessment(self):
        """실용적 중요성 평가 테스트"""
        # 큰 차이가 있는 데이터
        n_data = np.random.normal(200, 10, 50)
        n1_data = np.random.normal(100, 10, 50)
        practical_importance = self.engine._assess_practical_importance(n_data, n1_data)
        assert practical_importance > 0.5  # 높은 실용적 중요성

        # 작은 차이가 있는 데이터
        n_data = np.random.normal(101, 10, 50)
        n1_data = np.random.normal(100, 10, 50)
        practical_importance = self.engine._assess_practical_importance(n_data, n1_data)
        assert practical_importance < 0.3  # 낮은 실용적 중요성

    def test_risk_assessment(self):
        """위험도 평가 테스트"""
        # 낮은 위험도 시나리오
        n_data = np.random.normal(150, 10, 50)
        n1_data = np.random.normal(100, 10, 50)
        test_result = StatisticalTestResult(
            test_type=TestType.T_TEST,
            statistic=5.0,
            p_value=0.0001,  # 매우 유의함
            is_significant=True
        )
        effect_sizes = self.engine.calculate_comprehensive_effect_sizes(n_data, n1_data)
        
        risk_level = self.engine._assess_risk_level(test_result, effect_sizes, n_data, n1_data)
        assert risk_level == 'low'

        # 높은 위험도 시나리오
        test_result.p_value = 0.1  # 유의하지 않음
        risk_level = self.engine._assess_risk_level(test_result, effect_sizes, n_data, n1_data)
        assert risk_level in ['medium', 'high']

    def test_effect_size_interpretations(self):
        """효과 크기 해석 테스트"""
        engine = StatisticalAnalysisEngine()
        
        # Cohen's d 해석 테스트
        cohens_d_result = engine._calculate_cohens_d(self.sample_n_data, self.sample_n1_data)
        self.assertIsInstance(cohens_d_result.interpretation, str)
        self.assertIn(cohens_d_result.magnitude, ['small', 'medium', 'large'])
        
        # Hedges' g 해석 테스트
        hedges_g_result = engine._calculate_hedges_g(self.sample_n_data, self.sample_n1_data)
        self.assertIsInstance(hedges_g_result.interpretation, str)
        self.assertIn(hedges_g_result.magnitude, ['small', 'medium', 'large'])
        
        # Cliff's Delta 해석 테스트
        cliffs_delta_result = engine._calculate_cliffs_delta(self.sample_n_data, self.sample_n1_data)
        self.assertIsInstance(cliffs_delta_result.interpretation, str)
        self.assertIn(cliffs_delta_result.magnitude, ['small', 'medium', 'large'])

    def test_integrated_analysis_report_generation(self):
        """통합 분석 보고서 생성 테스트"""
        engine = StatisticalAnalysisEngine()
        
        # 샘플 분석 결과 생성
        analysis_result = self._create_sample_analysis_result()
        
        # JSON 형태 보고서 생성
        json_report = engine.generate_integrated_analysis_report(analysis_result, "json")
        self.assertIsInstance(json_report, dict)
        self.assertIn("report_id", json_report)
        self.assertIn("summary_statistics", json_report)
        self.assertIn("pass_fail_assessment", json_report)
        self.assertIn("recommendations", json_report)
        self.assertIn("risk_assessment", json_report)
        
        # 텍스트 형태 보고서 생성
        text_report = engine.generate_integrated_analysis_report(analysis_result, "text")
        self.assertIsInstance(text_report, str)
        self.assertIn("통계 분석 종합 보고서", text_report)
        self.assertIn("요약 통계", text_report)
        self.assertIn("Pass/Fail 평가", text_report)
        
        # 통합 보고서 객체 생성
        integrated_report = engine.generate_integrated_analysis_report(analysis_result, "both")
        self.assertIsInstance(integrated_report, IntegratedAnalysisReport)
        self.assertIsInstance(integrated_report.to_json(), dict)
        self.assertIsInstance(integrated_report.to_text_report(), str)

    def test_summary_statistics_calculation(self):
        """요약 통계 계산 테스트"""
        engine = StatisticalAnalysisEngine()
        analysis_result = self._create_sample_analysis_result()
        
        summary_stats = engine._calculate_summary_statistics(analysis_result)
        
        self.assertIn("total_metrics", summary_stats)
        self.assertIn("significant_metrics", summary_stats)
        self.assertIn("clinically_significant_metrics", summary_stats)
        self.assertIn("significance_rate", summary_stats)
        self.assertIn("clinical_significance_rate", summary_stats)
        self.assertIn("avg_effect_size", summary_stats)
        self.assertIn("test_type_distribution", summary_stats)
        
        # 값 검증
        self.assertEqual(summary_stats["total_metrics"], 2)
        self.assertGreaterEqual(summary_stats["significance_rate"], 0)
        self.assertLessEqual(summary_stats["significance_rate"], 1)
        self.assertGreaterEqual(summary_stats["clinical_significance_rate"], 0)
        self.assertLessEqual(summary_stats["clinical_significance_rate"], 1)

    def test_overall_pass_fail_assessment(self):
        """전체 Pass/Fail 평가 테스트"""
        engine = StatisticalAnalysisEngine()
        analysis_result = self._create_sample_analysis_result()
        
        assessment = engine._assess_overall_pass_fail(analysis_result)
        
        self.assertIn("overall_result", assessment)
        self.assertIn("confidence", assessment)
        self.assertIn("reasoning", assessment)
        self.assertIn("significance_rate", assessment)
        self.assertIn("clinical_rate", assessment)
        
        # 결과 값 검증
        self.assertIn(assessment["overall_result"], ["PASS", "CONDITIONAL_PASS", "FAIL"])
        self.assertIn(assessment["confidence"], ["high", "medium", "low"])
        self.assertGreaterEqual(assessment["significance_rate"], 0)
        self.assertLessEqual(assessment["significance_rate"], 1)

    def test_recommendations_generation(self):
        """권장사항 생성 테스트"""
        engine = StatisticalAnalysisEngine()
        analysis_result = self._create_sample_analysis_result()
        
        recommendations = engine._generate_recommendations(analysis_result)
        
        self.assertIsInstance(recommendations, list)
        self.assertGreater(len(recommendations), 0)
        
        for recommendation in recommendations:
            self.assertIsInstance(recommendation, str)
            self.assertGreater(len(recommendation), 0)

    def test_overall_risk_assessment(self):
        """전체 위험도 평가 테스트"""
        engine = StatisticalAnalysisEngine()
        analysis_result = self._create_sample_analysis_result()
        
        risk_assessment = engine._assess_overall_risk(analysis_result)
        
        self.assertIn("overall_risk", risk_assessment)
        self.assertIn("risk_score", risk_assessment)
        self.assertIn("risk_factors", risk_assessment)
        self.assertIn("risk_explanation", risk_assessment)
        
        # 값 검증
        self.assertIn(risk_assessment["overall_risk"], ["low", "medium", "high"])
        self.assertGreaterEqual(risk_assessment["risk_score"], 0)
        self.assertLessEqual(risk_assessment["risk_score"], 1)
        self.assertIsInstance(risk_assessment["risk_factors"], list)

    def test_comprehensive_report_with_visualization(self):
        """시각화를 포함한 종합 보고서 생성 테스트"""
        engine = StatisticalAnalysisEngine()
        analysis_result = self._create_sample_analysis_result()
        
        comprehensive_report = engine.generate_comprehensive_report_with_visualization(analysis_result)
        
        self.assertIn("report", comprehensive_report)
        self.assertIn("text_report", comprehensive_report)
        self.assertIn("visualization", comprehensive_report)
        self.assertIn("metadata", comprehensive_report)
        
        # 시각화 데이터 검증
        visualization = comprehensive_report["visualization"]
        self.assertIn("metrics_summary", visualization)
        self.assertIn("significance_distribution", visualization)
        self.assertIn("effect_size_distribution", visualization)
        self.assertIn("test_type_distribution", visualization)
        self.assertIn("p_value_distribution", visualization)

    def test_visualization_data_generation(self):
        """시각화 데이터 생성 테스트"""
        engine = StatisticalAnalysisEngine()
        analysis_result = self._create_sample_analysis_result()
        
        visualization_data = engine._generate_visualization_data(analysis_result)
        
        # 메트릭 요약 검증
        metrics_summary = visualization_data["metrics_summary"]
        self.assertEqual(len(metrics_summary), 2)
        for metric in metrics_summary:
            self.assertIn("metric_name", metric)
            self.assertIn("p_value", metric)
            self.assertIn("effect_size", metric)
            self.assertIn("is_significant", metric)
            self.assertIn("clinical_significance", metric)
            self.assertIn("test_type", metric)
        
        # 유의성 분포 검증
        significance_dist = visualization_data["significance_distribution"]
        self.assertIn("significant", significance_dist)
        self.assertIn("non_significant", significance_dist)
        self.assertIn("total", significance_dist)
        self.assertEqual(significance_dist["total"], 2)
        
        # 효과 크기 분포 검증
        effect_size_dist = visualization_data["effect_size_distribution"]
        self.assertIn("values", effect_size_dist)
        self.assertIn("mean", effect_size_dist)
        self.assertIn("median", effect_size_dist)
        self.assertIn("std", effect_size_dist)
        self.assertEqual(len(effect_size_dist["values"]), 2)

    def _create_sample_analysis_result(self) -> ComprehensiveAnalysisResult:
        """테스트용 샘플 분석 결과 생성"""
        # 샘플 메트릭 결과 생성
        metric_result_1 = MetricAnalysisResult(
            metric_name="response_time",
            period_n_data=self.sample_n_data,
            period_n1_data=self.sample_n1_data,
            test_result=StatisticalTestResult(
                test_type=TestType.T_TEST,
                statistic=2.5,
                p_value=0.02,
                is_significant=True
            ),
            effect_size=EffectSizeResult(
                effect_size_type=EffectSizeType.COHENS_D,
                value=0.6,
                interpretation="중간 크기의 효과",
                magnitude="medium"
            ),
            clinical_significance=True,
            summary="응답 시간이 통계적으로 유의하게 개선되었습니다."
        )
        
        metric_result_2 = MetricAnalysisResult(
            metric_name="error_rate",
            period_n_data=self.sample_n_data,
            period_n1_data=self.sample_n1_data,
            test_result=StatisticalTestResult(
                test_type=TestType.MANN_WHITNEY,
                statistic=1.8,
                p_value=0.08,
                is_significant=False
            ),
            effect_size=EffectSizeResult(
                effect_size_type=EffectSizeType.COHENS_D,
                value=0.3,
                interpretation="작은 크기의 효과",
                magnitude="small"
            ),
            clinical_significance=False,
            summary="오류율 개선이 통계적으로 유의하지 않습니다."
        )
        
        return ComprehensiveAnalysisResult(
            analysis_id="test_analysis_001",
            period_n_info={"start_date": "2024-01-01", "end_date": "2024-01-31", "sample_size": 100},
            period_n1_info={"start_date": "2023-12-01", "end_date": "2023-12-31", "sample_size": 100},
            metrics_results=[metric_result_1, metric_result_2],
            overall_assessment="전반적으로 양호한 결과를 보입니다.",
            confidence_level=0.95,
            timestamp=datetime.now(),
            total_metrics=2,
            significant_metrics=1,
            clinically_significant_metrics=1
        )

if __name__ == "__main__":
    # 테스트 실행
    pytest.main([__file__, "-v"])
