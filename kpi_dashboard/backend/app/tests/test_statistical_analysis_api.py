"""
Statistical Analysis API Tests

이 모듈은 통계 분석 API 엔드포인트들을 테스트합니다.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from app.main import app
from app.utils.statistical_analysis import StatisticalAnalysisEngine

client = TestClient(app)

class TestStatisticalAnalysisAPI:
    """통계 분석 API 테스트 클래스"""
    
    def setup_method(self):
        """테스트 설정"""
        # 샘플 데이터 생성
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
        
        self.valid_request_data = {
            "period_n_data": self.sample_period_n_data,
            "period_n1_data": self.sample_period_n1_data,
            "metrics": ["throughput", "latency"],
            "use_recommended_tests": True,
            "include_comprehensive_analysis": True,
            "confidence_level": 0.95
        }
    
    def test_async_statistical_comparison_request_success(self):
        """비동기 통계 비교 분석 요청 성공 테스트"""
        with patch('app.routers.statistical_comparison.perform_statistical_analysis') as mock_task:
            # Mock Celery task
            mock_task.delay.return_value = MagicMock()
            mock_task.delay.return_value.id = "test_task_123"
            
            response = client.post(
                "/api/analysis/statistical-comparison",
                json=self.valid_request_data
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["task_id"] == "test_task_123"
            assert data["status"] == "PENDING"
            assert "작업이 시작되었습니다" in data["message"]
            assert data["estimated_completion_time"] == 300
    
    def test_async_statistical_comparison_invalid_period_data(self):
        """잘못된 기간 데이터로 인한 실패 테스트"""
        invalid_request = self.valid_request_data.copy()
        invalid_request["period_n_data"] = {"invalid": "data"}
        
        response = client.post(
            "/api/analysis/statistical-comparison",
            json=invalid_request
        )
        
        assert response.status_code == 400
        assert "현재 기간 데이터가 유효하지 않습니다" in response.json()["detail"]
    
    def test_async_statistical_comparison_invalid_metrics(self):
        """잘못된 메트릭으로 인한 실패 테스트"""
        invalid_request = self.valid_request_data.copy()
        invalid_request["metrics"] = ["non_existent_metric"]
        
        response = client.post(
            "/api/analysis/statistical-comparison",
            json=invalid_request
        )
        
        assert response.status_code == 400
        assert "지정된 메트릭이 데이터에 존재하지 않습니다" in response.json()["detail"]
    
    def test_async_statistical_comparison_invalid_test_types(self):
        """잘못된 검정 유형으로 인한 실패 테스트"""
        invalid_request = self.valid_request_data.copy()
        invalid_request["test_types"] = ["invalid_test_type"]
        invalid_request["use_recommended_tests"] = False
        
        response = client.post(
            "/api/analysis/statistical-comparison",
            json=invalid_request
        )
        
        assert response.status_code == 400
        assert "지정된 검정 유형이 유효하지 않습니다" in response.json()["detail"]
    
    def test_task_status_success(self):
        """작업 상태 조회 성공 테스트"""
        with patch('app.routers.statistical_comparison.get_analysis_status') as mock_status:
            # Mock task status
            mock_status.delay.return_value.get.return_value = {
                "task_id": "test_task_123",
                "status": "SUCCESS",
                "ready": True,
                "successful": True,
                "failed": False,
                "result": {"analysis_id": "test_analysis_123"}
            }
            
            response = client.get("/api/analysis/task-status/test_task_123")
            
            assert response.status_code == 200
            data = response.json()
            assert data["task_id"] == "test_task_123"
            assert data["status"] == "SUCCESS"
            assert data["ready"] is True
            assert data["successful"] is True
            assert data["failed"] is False
    
    def test_task_status_running(self):
        """실행 중인 작업 상태 조회 테스트"""
        with patch('app.routers.statistical_comparison.get_analysis_status') as mock_status:
            # Mock running task status
            mock_status.delay.return_value.get.return_value = {
                "task_id": "test_task_123",
                "status": "RUNNING",
                "ready": False,
                "successful": False,
                "failed": False,
                "meta": {
                    "progress": 50,
                    "current_step": "통계 비교 분석 수행"
                }
            }
            
            response = client.get("/api/analysis/task-status/test_task_123")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "RUNNING"
            assert data["progress"] == 50
            assert data["current_step"] == "통계 비교 분석 수행"
    
    def test_task_status_failed(self):
        """실패한 작업 상태 조회 테스트"""
        with patch('app.routers.statistical_comparison.get_analysis_status') as mock_status:
            # Mock failed task status
            mock_status.delay.return_value.get.return_value = {
                "task_id": "test_task_123",
                "status": "FAILURE",
                "ready": True,
                "successful": False,
                "failed": True,
                "error": "분석 중 오류가 발생했습니다"
            }
            
            response = client.get("/api/analysis/task-status/test_task_123")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "FAILURE"
            assert data["failed"] is True
            assert data["error"] == "분석 중 오류가 발생했습니다"
    
    def test_sync_statistical_comparison_success(self):
        """동기 통계 비교 분석 성공 테스트"""
        with patch('app.routers.statistical_comparison.StatisticalAnalysisEngine') as mock_engine:
            # Mock engine and result
            mock_engine_instance = MagicMock()
            mock_engine.return_value = mock_engine_instance
            
            mock_result = MagicMock()
            mock_result.analysis_id = "test_analysis_123"
            mock_result.period_n_info = {"period_name": "n", "total_records": 6}
            mock_result.period_n1_info = {"period_name": "n-1", "total_records": 6}
            mock_result.metrics_results = []
            mock_result.overall_assessment = "테스트 완료"
            mock_result.confidence_level = 0.95
            mock_result.timestamp = datetime.now()
            mock_result.total_metrics = 2
            mock_result.significant_metrics = 1
            mock_result.clinically_significant_metrics = 1
            
            mock_engine_instance.analyze_periods_comparison.return_value = mock_result
            
            response = client.post(
                "/api/analysis/statistical-comparison-sync",
                json=self.valid_request_data
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["analysis_id"] == "test_analysis_123"
            assert data["total_metrics"] == 2
            assert data["significant_metrics"] == 1
    
    def test_sync_statistical_comparison_with_custom_tests(self):
        """사용자 지정 검정 유형을 사용한 동기 분석 테스트"""
        custom_request = self.valid_request_data.copy()
        custom_request["test_types"] = ["students_t_test", "mann_whitney_u_test"]
        custom_request["use_recommended_tests"] = False
        
        with patch('app.routers.statistical_comparison.StatisticalAnalysisEngine') as mock_engine:
            mock_engine_instance = MagicMock()
            mock_engine.return_value = mock_engine_instance
            
            mock_result = MagicMock()
            mock_result.analysis_id = "test_analysis_123"
            mock_result.period_n_info = {"period_name": "n", "total_records": 6}
            mock_result.period_n1_info = {"period_name": "n-1", "total_records": 6}
            mock_result.metrics_results = []
            mock_result.overall_assessment = "테스트 완료"
            mock_result.confidence_level = 0.95
            mock_result.timestamp = datetime.now()
            mock_result.total_metrics = 2
            mock_result.significant_metrics = 1
            mock_result.clinically_significant_metrics = 1
            
            mock_engine_instance.analyze_periods_comparison_with_custom_tests.return_value = mock_result
            
            response = client.post(
                "/api/analysis/statistical-comparison-sync",
                json=custom_request
            )
            
            assert response.status_code == 200
            # 사용자 지정 검정이 호출되었는지 확인
            mock_engine_instance.analyze_periods_comparison_with_custom_tests.assert_called_once()
    
    def test_existing_compare_periods_endpoint(self):
        """기존 /api/statistical/compare-periods 엔드포인트 테스트"""
        request_data = {
            "period_n_start": "2024-01-01T10:00:00",
            "period_n_end": "2024-01-01T12:00:00",
            "period_n1_start": "2024-01-02T10:00:00",
            "period_n1_end": "2024-01-02T12:00:00",
            "metrics": ["throughput", "latency"],
            "include_comprehensive_analysis": True,
            "confidence_level": 0.95
        }
        
        with patch('app.routers.statistical_comparison._generate_sample_period_data') as mock_generate:
            # Mock sample data generation
            mock_generate.return_value = pd.DataFrame(self.sample_period_n_data)
            
            with patch('app.routers.statistical_comparison.StatisticalAnalysisEngine') as mock_engine:
                mock_engine_instance = MagicMock()
                mock_engine.return_value = mock_engine_instance
                
                mock_result = MagicMock()
                mock_result.analysis_id = "test_analysis_123"
                mock_result.period_n_info = {"period_name": "n", "total_records": 6}
                mock_result.period_n1_info = {"period_name": "n-1", "total_records": 6}
                mock_result.metrics_results = []
                mock_result.overall_assessment = "테스트 완료"
                mock_result.confidence_level = 0.95
                mock_result.timestamp = datetime.now()
                mock_result.total_metrics = 2
                mock_result.significant_metrics = 1
                mock_result.clinically_significant_metrics = 1
                
                mock_engine_instance.analyze_periods_comparison.return_value = mock_result
                
                response = client.post(
                    "/api/statistical/compare-periods",
                    json=request_data
                )
                
                assert response.status_code == 200
                data = response.json()
                assert data["analysis_id"] == "test_analysis_123"
                assert data["total_metrics"] == 2
    
    def test_recommend_tests_endpoint(self):
        """권장 검정 방법 조회 엔드포인트 테스트"""
        # CSV 파일 데이터 생성
        csv_data = "timestamp,throughput,latency\n2024-01-01T10:00:00,150.5,45.2\n2024-01-01T10:01:00,152.3,44.8"
        
        with patch('app.routers.statistical_comparison.pd.read_csv') as mock_read_csv:
            # Mock CSV reading
            mock_read_csv.return_value = pd.DataFrame({
                'timestamp': ['2024-01-01T10:00:00', '2024-01-01T10:01:00'],
                'throughput': [150.5, 152.3],
                'latency': [45.2, 44.8]
            })
            
            with patch('app.routers.statistical_comparison.StatisticalAnalysisEngine') as mock_engine:
                mock_engine_instance = MagicMock()
                mock_engine.return_value = mock_engine_instance
                
                # Mock numeric metrics detection
                mock_engine_instance._get_numeric_metrics.return_value = ["throughput", "latency"]
                
                # Mock test recommendations
                mock_engine_instance.get_recommended_tests.return_value = ["students_t_test"]
                
                # Mock normality and homogeneity tests
                mock_engine_instance._test_normality.return_value = True
                mock_engine_instance._test_homogeneity.return_value = True
                
                # Create file-like objects for upload
                from io import BytesIO
                files = {
                    'period_n_file': ('period_n.csv', BytesIO(csv_data.encode()), 'text/csv'),
                    'period_n1_file': ('period_n1.csv', BytesIO(csv_data.encode()), 'text/csv')
                }
                
                response = client.post(
                    "/api/statistical/recommend-tests",
                    files=files,
                    data={"metric": "throughput"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "success"
                assert len(data["recommendations"]) > 0
    
    def test_generate_report_endpoint(self):
        """통합 분석 보고서 생성 엔드포인트 테스트"""
        csv_data = "timestamp,throughput,latency\n2024-01-01T10:00:00,150.5,45.2\n2024-01-01T10:01:00,152.3,44.8"
        
        with patch('app.routers.statistical_comparison.pd.read_csv') as mock_read_csv:
            mock_read_csv.return_value = pd.DataFrame({
                'timestamp': ['2024-01-01T10:00:00', '2024-01-01T10:01:00'],
                'throughput': [150.5, 152.3],
                'latency': [45.2, 44.8]
            })
            
            with patch('app.routers.statistical_comparison.StatisticalAnalysisEngine') as mock_engine:
                mock_engine_instance = MagicMock()
                mock_engine.return_value = mock_engine_instance
                
                mock_engine_instance._get_numeric_metrics.return_value = ["throughput", "latency"]
                
                mock_result = MagicMock()
                mock_result.analysis_id = "test_analysis_123"
                mock_engine_instance.analyze_periods_comparison.return_value = mock_result
                
                # Mock report generation
                mock_report = {
                    "summary_statistics": {"total_metrics": 2},
                    "overall_pass_fail": "PASS",
                    "recommendations": ["테스트 권장"],
                    "risk_assessment": "낮음"
                }
                mock_engine_instance.generate_integrated_analysis_report.return_value = mock_report
                
                from io import BytesIO
                files = {
                    'period_n_file': ('period_n.csv', BytesIO(csv_data.encode()), 'text/csv'),
                    'period_n1_file': ('period_n1.csv', BytesIO(csv_data.encode()), 'text/csv')
                }
                
                response = client.post(
                    "/api/statistical/generate-report",
                    files=files,
                    data={
                        "metrics": "throughput,latency",
                        "report_format": "json",
                        "include_visualization": "false"
                    }
                )
                
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "success"
                assert data["analysis_id"] == "test_analysis_123"
    
    def test_validation_functions(self):
        """검증 함수들 테스트"""
        from app.routers.statistical_comparison import (
            validate_period_data, 
            validate_metrics, 
            validate_test_types
        )
        
        # validate_period_data 테스트
        assert validate_period_data(self.sample_period_n_data) is True
        assert validate_period_data({"invalid": "data"}) is False
        assert validate_period_data({"timestamp": []}) is False
        assert validate_period_data({"timestamp": ["2024-01-01"], "metric": [1, 2]}) is False  # 길이 불일치
        
        # validate_metrics 테스트
        valid_metrics = validate_metrics(["throughput", "latency"], self.sample_period_n_data)
        assert valid_metrics == ["throughput", "latency"]
        
        invalid_metrics = validate_metrics(["non_existent"], self.sample_period_n_data)
        assert invalid_metrics == []
        
        # validate_test_types 테스트
        valid_types = validate_test_types(["students_t_test", "mann_whitney_u_test"])
        assert valid_types == ["students_t_test", "mann_whitney_u_test"]
        
        invalid_types = validate_test_types(["invalid_test"])
        assert invalid_types == []
