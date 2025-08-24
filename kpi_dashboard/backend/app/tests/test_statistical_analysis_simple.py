"""
Simple Statistical Analysis Tests

이 모듈은 통계 분석 관련 기능들을 간단히 테스트합니다.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime

# Import validation functions directly
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from app.routers.statistical_comparison import (
    validate_period_data, 
    validate_metrics, 
    validate_test_types
)
from app.models.statistical_analysis import (
    StatisticalAnalysisRequest,
    ComprehensiveAnalysisResult,
    MetricAnalysisResult,
    StatisticalTestResult,
    EffectSizeResult,
    ClinicalSignificanceAssessment
)

class TestStatisticalAnalysisValidation:
    """통계 분석 검증 함수 테스트"""
    
    def setup_method(self):
        """테스트 설정"""
        self.sample_period_n_data = {
            "timestamp": [
                "2024-01-01T10:00:00", "2024-01-01T10:01:00", "2024-01-01T10:02:00",
                "2024-01-01T10:03:00", "2024-01-01T10:04:00", "2024-01-01T10:05:00"
            ],
            "throughput": [150.5, 152.3, 148.7, 151.2, 149.8, 153.1],
            "latency": [45.2, 44.8, 46.1, 45.5, 45.9, 44.3],
            "error_rate": [0.02, 0.01, 0.03, 0.02, 0.01, 0.02]
        }
        
        self.sample_period_n1_data = {
            "timestamp": [
                "2024-01-02T10:00:00", "2024-01-02T10:01:00", "2024-01-02T10:02:00",
                "2024-01-02T10:03:00", "2024-01-02T10:04:00", "2024-01-02T10:05:00"
            ],
            "throughput": [100.3, 102.1, 98.7, 101.5, 99.2, 103.8],
            "latency": [55.8, 56.2, 54.9, 55.3, 56.7, 54.5],
            "error_rate": [0.05, 0.04, 0.06, 0.05, 0.04, 0.05]
        }
    
    def test_validate_period_data_valid(self):
        """유효한 기간 데이터 검증 테스트"""
        assert validate_period_data(self.sample_period_n_data) is True
        assert validate_period_data(self.sample_period_n1_data) is True
    
    def test_validate_period_data_invalid(self):
        """잘못된 기간 데이터 검증 테스트"""
        # timestamp가 없는 경우
        assert validate_period_data({"invalid": "data"}) is False
        
        # timestamp가 비어있는 경우
        assert validate_period_data({"timestamp": []}) is False
        
        # 메트릭 데이터 길이가 다른 경우
        invalid_data = {
            "timestamp": ["2024-01-01T10:00:00", "2024-01-01T10:01:00"],
            "throughput": [150.5, 152.3, 148.7]  # 길이 불일치
        }
        assert validate_period_data(invalid_data) is False
    
    def test_validate_metrics_valid(self):
        """유효한 메트릭 검증 테스트"""
        valid_metrics = validate_metrics(["throughput", "latency"], self.sample_period_n_data)
        assert valid_metrics == ["throughput", "latency"]
    
    def test_validate_metrics_invalid(self):
        """잘못된 메트릭 검증 테스트"""
        # 존재하지 않는 메트릭
        invalid_metrics = validate_metrics(["non_existent"], self.sample_period_n_data)
        assert invalid_metrics == []
        
        # 빈 메트릭 리스트
        empty_metrics = validate_metrics([], self.sample_period_n_data)
        assert empty_metrics == []
    
    def test_validate_test_types_valid(self):
        """유효한 검정 유형 검증 테스트"""
        valid_types = validate_test_types(["students_t_test", "mann_whitney_u_test"])
        assert valid_types == ["students_t_test", "mann_whitney_u_test"]
    
    def test_validate_test_types_invalid(self):
        """잘못된 검정 유형 검증 테스트"""
        # 존재하지 않는 검정 유형
        invalid_types = validate_test_types(["invalid_test_type"])
        assert invalid_types == []
        
        # 빈 검정 유형 리스트
        empty_types = validate_test_types([])
        assert empty_types == []

class TestStatisticalAnalysisModels:
    """통계 분석 모델 테스트"""
    
    def test_statistical_analysis_request_valid(self):
        """유효한 통계 분석 요청 모델 테스트"""
        request_data = {
            "period_n_data": {
                "timestamp": ["2024-01-01T10:00:00"],
                "throughput": [150.5]
            },
            "period_n1_data": {
                "timestamp": ["2024-01-02T10:00:00"],
                "throughput": [100.3]
            },
            "metrics": ["throughput"],
            "use_recommended_tests": True,
            "include_comprehensive_analysis": True,
            "confidence_level": 0.95
        }
        
        request = StatisticalAnalysisRequest(**request_data)
        assert request.metrics == ["throughput"]
        assert request.use_recommended_tests is True
        assert request.confidence_level == 0.95
    
    def test_statistical_analysis_request_invalid_confidence_level(self):
        """잘못된 신뢰수준 테스트"""
        request_data = {
            "period_n_data": {
                "timestamp": ["2024-01-01T10:00:00"],
                "throughput": [150.5]
            },
            "period_n1_data": {
                "timestamp": ["2024-01-02T10:00:00"],
                "throughput": [100.3]
            },
            "confidence_level": 1.5  # 잘못된 신뢰수준
        }
        
        with pytest.raises(ValueError, match="신뢰수준은 0과 1 사이의 값이어야 합니다"):
            StatisticalAnalysisRequest(**request_data)
    
    def test_statistical_test_result_model(self):
        """통계 검정 결과 모델 테스트"""
        test_result_data = {
            "test_type": "students_t_test",
            "statistic": 2.5,
            "p_value": 0.015,
            "is_significant": True,
            "alpha": 0.05
        }
        
        test_result = StatisticalTestResult(**test_result_data)
        assert test_result.test_type.value == "students_t_test"
        assert test_result.statistic == 2.5
        assert test_result.p_value == 0.015
        assert test_result.is_significant is True
    
    def test_effect_size_result_model(self):
        """효과 크기 결과 모델 테스트"""
        effect_size_data = {
            "effect_size_type": "cohens_d",
            "value": 0.8,
            "interpretation": "large 크기의 증가 효과",
            "magnitude": "large",
            "confidence_interval_lower": 0.6,
            "confidence_interval_upper": 1.0
        }
        
        effect_size = EffectSizeResult(**effect_size_data)
        assert effect_size.effect_size_type.value == "cohens_d"
        assert effect_size.value == 0.8
        assert effect_size.magnitude.value == "large"
        assert effect_size.confidence_interval_lower == 0.6
    
    def test_clinical_significance_assessment_model(self):
        """임상적 유의성 평가 모델 테스트"""
        clinical_data = {
            "is_clinically_significant": True,
            "significance_level": "high",
            "reasoning": "통계적 유의성과 큰 효과 크기를 모두 만족",
            "recommendations": ["개선 조치 권장", "지속적 모니터링 필요"],
            "risk_assessment": "낮음"
        }
        
        clinical = ClinicalSignificanceAssessment(**clinical_data)
        assert clinical.is_clinically_significant is True
        assert clinical.significance_level.value == "high"
        assert len(clinical.recommendations) == 2
        assert clinical.risk_assessment == "낮음"
    
    def test_metric_analysis_result_model(self):
        """메트릭 분석 결과 모델 테스트"""
        metric_result_data = {
            "metric_name": "throughput",
            "test_result": {
                "test_type": "students_t_test",
                "statistic": 2.5,
                "p_value": 0.015,
                "is_significant": True,
                "alpha": 0.05
            },
            "effect_size": {
                "effect_size_type": "cohens_d",
                "value": 0.8,
                "interpretation": "large 크기의 증가 효과",
                "magnitude": "large"
            },
            "clinical_significance": {
                "is_clinically_significant": True,
                "significance_level": "high",
                "reasoning": "통계적 유의성과 큰 효과 크기를 모두 만족",
                "recommendations": ["개선 조치 권장"],
                "risk_assessment": "낮음"
            },
            "summary": "메트릭 'throughput': 유의함 (p=0.0150), 효과 크기: large 크기의 증가 효과 (d=0.800), 임상적으로 유의함",
            "period_n_stats": {"mean": 150.5, "std": 10.2, "count": 120},
            "period_n1_stats": {"mean": 100.3, "std": 8.7, "count": 120}
        }
        
        metric_result = MetricAnalysisResult(**metric_result_data)
        assert metric_result.metric_name == "throughput"
        assert metric_result.test_result.test_type.value == "students_t_test"
        assert metric_result.effect_size.value == 0.8
        assert metric_result.clinical_significance.is_clinically_significant is True
        assert metric_result.period_n_stats["mean"] == 150.5
