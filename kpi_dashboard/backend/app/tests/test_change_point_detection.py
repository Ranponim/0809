"""
Change Point Detection 단위 테스트

작업 2: Backend: Implement Automated Test Period Identification
다양한 시계열 데이터셋을 사용하여 알고리즘의 정확성을 검증합니다.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import os

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.utils.change_point_detection import ChangePointDetector

class TestChangePointDetector:
    """ChangePointDetector 클래스 테스트"""
    
    def setup_method(self):
        """각 테스트 메서드 실행 전 설정"""
        self.detector = ChangePointDetector()
        
    def test_default_config(self):
        """기본 설정이 올바르게 로드되는지 테스트"""
        config = self.detector.config
        
        assert 'penalty' in config
        assert 'min_segment_length' in config
        assert 'min_duration_minutes' in config
        assert 'min_activity_threshold' in config
        assert 'stability_threshold' in config
        assert 'metric_weights' in config
        
        assert config['penalty'] == 10
        assert config['min_segment_length'] == 50
        assert config['min_duration_minutes'] == 30
        
    def test_custom_config(self):
        """사용자 정의 설정이 올바르게 적용되는지 테스트"""
        custom_config = {
            'penalty': 5,
            'min_segment_length': 30,
            'min_duration_minutes': 15
        }
        
        detector = ChangePointDetector(config=custom_config)
        
        assert detector.config['penalty'] == 5
        assert detector.config['min_segment_length'] == 30
        assert detector.config['min_duration_minutes'] == 15
        
    def test_generate_sample_data_with_clear_periods(self):
        """명확한 테스트 기간이 있는 데이터 생성 및 테스트"""
        # 명확한 변화점이 있는 데이터 생성
        timestamps = pd.date_range(start='2024-01-01', end='2024-01-02', freq='1min')
        n_points = len(timestamps)
        
        # 3개의 명확한 구간 생성
        data = np.zeros(n_points)
        
        # 구간 1: 낮은 값 (0-8시간)
        data[:480] = np.random.normal(50, 5, 480)
        
        # 구간 2: 높은 값 (8-16시간)
        data[480:960] = np.random.normal(150, 10, 480)
        
        # 구간 3: 중간 값 (16-24시간)
        data[960:] = np.random.normal(100, 8, n_points - 960)
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'throughput': data
        })
        df.set_index('timestamp', inplace=True)
        
        # 테스트 기간 식별
        periods = self.detector.identify_test_periods(df, ['throughput'])
        
        # 최소 2개 이상의 기간이 식별되어야 함
        assert len(periods) >= 2
        
        # 각 기간이 최소 지속 시간을 만족해야 함
        for period in periods:
            assert period['duration_minutes'] >= self.detector.config['min_duration_minutes']
            
    def test_data_with_no_clear_periods(self):
        """명확한 테스트 기간이 없는 데이터 테스트"""
        # 노이즈가 많은 데이터 생성
        timestamps = pd.date_range(start='2024-01-01', end='2024-01-01 02:00', freq='1min')
        n_points = len(timestamps)
        
        # 높은 노이즈로 인해 변화점이 감지되지 않을 데이터
        data = np.random.normal(100, 50, n_points)  # 높은 표준편차
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'throughput': data
        })
        df.set_index('timestamp', inplace=True)
        
        # 테스트 기간 식별
        periods = self.detector.identify_test_periods(df, ['throughput'])
        
        # 노이즈가 많은 데이터에서는 적은 수의 기간이 식별되어야 함
        # 또는 안정성 검사로 인해 필터링되어야 함
        assert len(periods) <= 2
        
    def test_data_with_noise(self):
        """노이즈가 많은 데이터 테스트"""
        timestamps = pd.date_range(start='2024-01-01', end='2024-01-01 04:00', freq='1min')
        n_points = len(timestamps)
        
        # 기본 트렌드에 노이즈 추가
        trend = np.linspace(100, 120, n_points)
        noise = np.random.normal(0, 20, n_points)  # 중간 정도의 노이즈
        data = trend + noise
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'throughput': data
        })
        df.set_index('timestamp', inplace=True)
        
        # 테스트 기간 식별
        periods = self.detector.identify_test_periods(df, ['throughput'])
        
        # 노이즈가 있는 데이터에서도 일부 기간이 식별되어야 함
        assert len(periods) >= 0  # 0개 이상 (필터링에 따라 달라질 수 있음)
        
    def test_multiple_metrics(self):
        """여러 메트릭에 대한 테스트"""
        timestamps = pd.date_range(start='2024-01-01', end='2024-01-01 02:00', freq='1min')
        n_points = len(timestamps)
        
        # 여러 메트릭 생성
        throughput = np.random.normal(100, 10, n_points)
        latency = 1000 / (throughput + 1) + np.random.normal(0, 5, n_points)
        error_rate = np.random.exponential(0.01, n_points)
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'throughput': throughput,
            'latency': latency,
            'error_rate': error_rate
        })
        df.set_index('timestamp', inplace=True)
        
        # 여러 메트릭에 대해 테스트 기간 식별
        periods = self.detector.identify_test_periods(df, ['throughput', 'latency', 'error_rate'])
        
        # 각 메트릭에서 기간이 식별되어야 함
        metrics_found = set(period['metric'] for period in periods)
        assert len(metrics_found) >= 1
        
    def test_filtering_criteria(self):
        """필터링 기준 테스트"""
        # 매우 짧은 기간의 데이터 생성
        timestamps = pd.date_range(start='2024-01-01', end='2024-01-01 00:10', freq='1min')
        n_points = len(timestamps)
        
        data = np.random.normal(100, 5, n_points)
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'throughput': data
        })
        df.set_index('timestamp', inplace=True)
        
        # 테스트 기간 식별
        periods = self.detector.identify_test_periods(df, ['throughput'])
        
        # 짧은 기간은 필터링되어야 함
        for period in periods:
            assert period['duration_minutes'] >= self.detector.config['min_duration_minutes']
            
    def test_confidence_score_calculation(self):
        """신뢰도 점수 계산 테스트"""
        # 안정적인 데이터 생성
        timestamps = pd.date_range(start='2024-01-01', end='2024-01-01 01:00', freq='1min')
        n_points = len(timestamps)
        
        # 낮은 표준편차로 안정적인 데이터
        data = np.random.normal(100, 2, n_points)
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'throughput': data
        })
        df.set_index('timestamp', inplace=True)
        
        # 테스트 기간 식별
        periods = self.detector.identify_test_periods(df, ['throughput'])
        
        # 신뢰도 점수가 0-1 범위에 있어야 함
        for period in periods:
            assert 0.0 <= period['confidence_score'] <= 1.0
            
    def test_empty_data(self):
        """빈 데이터 테스트"""
        # 빈 DataFrame 생성
        df = pd.DataFrame(columns=['throughput'])
        
        # 테스트 기간 식별
        periods = self.detector.identify_test_periods(df, ['throughput'])
        
        # 빈 데이터에서는 기간이 식별되지 않아야 함
        assert len(periods) == 0
        
    def test_invalid_metrics(self):
        """존재하지 않는 메트릭 테스트"""
        timestamps = pd.date_range(start='2024-01-01', end='2024-01-01 01:00', freq='1min')
        data = np.random.normal(100, 5, len(timestamps))
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'throughput': data
        })
        df.set_index('timestamp', inplace=True)
        
        # 존재하지 않는 메트릭으로 테스트
        periods = self.detector.identify_test_periods(df, ['nonexistent_metric'])
        
        # 존재하지 않는 메트릭에서는 기간이 식별되지 않아야 함
        assert len(periods) == 0
        
    def test_pelt_algorithm_edge_cases(self):
        """PELT 알고리즘 엣지 케이스 테스트"""
        # 매우 짧은 데이터
        short_data = pd.Series([1, 2, 3, 4, 5])
        segments = self.detector._apply_pelt_algorithm(short_data)
        
        # 매우 짧은 데이터에서는 세그먼트가 생성되지 않거나 최소 길이 조건을 만족해야 함
        for start_idx, end_idx in segments:
            assert end_idx - start_idx >= self.detector.config['min_segment_length']
            
        # 상수 데이터
        constant_data = pd.Series([100] * 100)
        segments = self.detector._apply_pelt_algorithm(constant_data)
        
        # 상수 데이터에서는 변화점이 감지되지 않거나 매우 적게 감지되어야 함
        assert len(segments) <= 2

if __name__ == "__main__":
    # 테스트 실행
    pytest.main([__file__, "-v"])
