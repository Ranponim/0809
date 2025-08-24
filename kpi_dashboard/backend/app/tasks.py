"""
Celery 작업 정의

이 모듈은 KPI 분석을 위한 Celery 작업들을 정의합니다.
"""

import logging
import time
from typing import Dict, Any, List, Optional
import pandas as pd
from .celery_app import celery_app
from .utils.statistical_analysis import StatisticalAnalysisEngine
from .analysis.integrated_workflow import IntegratedAnalysisWorkflow, WorkflowConfig, IntegratedAnalysisResult
from .analysis.pass_fail_engine import ThresholdConfig
import uuid
import json

logger = logging.getLogger(__name__)

@celery_app.task
def add_together(a, b):
    """기존 테스트용 작업"""
    return a + b

@celery_app.task(bind=True)
def analyze_kpi_data(self, analysis_request: Dict[str, Any]) -> Dict[str, Any]:
    """
    KPI 데이터 분석 작업
    
    Args:
        analysis_request: 분석 요청 데이터
        
    Returns:
        분석 결과 딕셔너리
    """
    task_id = self.request.id
    logger.info(f"분석 작업 시작: {task_id}")
    
    try:
        # 작업 상태 업데이트
        self.update_state(
            state='RUNNING',
            meta={
                'status': '분석 중...',
                'progress': 0,
                'current_step': '데이터 검증'
            }
        )
        
        # 1단계: 데이터 검증 (10%)
        time.sleep(1)  # 실제 작업 시뮬레이션
        self.update_state(
            state='RUNNING',
            meta={
                'status': '데이터 검증 완료',
                'progress': 10,
                'current_step': '테스트 기간 식별'
            }
        )
        
        # 2단계: 테스트 기간 식별 (30%)
        time.sleep(2)
        self.update_state(
            state='RUNNING',
            meta={
                'status': '테스트 기간 식별 완료',
                'progress': 30,
                'current_step': '통계 분석'
            }
        )
        
        # 3단계: 통계 분석 (60%)
        time.sleep(3)
        self.update_state(
            state='RUNNING',
            meta={
                'status': '통계 분석 완료',
                'progress': 60,
                'current_step': '이상 탐지'
            }
        )
        
        # 4단계: 이상 탐지 (80%)
        time.sleep(2)
        self.update_state(
            state='RUNNING',
            meta={
                'status': '이상 탐지 완료',
                'progress': 80,
                'current_step': '결과 정리'
            }
        )
        
        # 5단계: 결과 정리 (100%)
        time.sleep(1)
        
        # 분석 결과 생성 (실제로는 여기서 실제 분석 로직이 들어감)
        result = {
            'task_id': task_id,
            'status': 'SUCCESS',
            'progress': 100,
            'analysis_result': {
                'overall_status': 'PASS',
                'failed_pegs': 5,
                'failed_cells': 12,
                'analysis_periods': {
                    'n_period': '2024-01-01 to 2024-01-31',
                    'n_minus_1_period': '2023-12-01 to 2023-12-31'
                },
                'summary': {
                    'total_pegs': 100,
                    'total_cells': 500,
                    'pass_rate': 95.0
                }
            },
            'timestamp': time.time()
        }
        
        logger.info(f"분석 작업 완료: {task_id}")
        return result
        
    except Exception as e:
        logger.error(f"분석 작업 실패: {task_id}, 오류: {str(e)}")
        self.update_state(
            state='FAILURE',
            meta={
                'status': '분석 실패',
                'error': str(e),
                'progress': 0
            }
        )
        raise

@celery_app.task(bind=True)
def perform_statistical_analysis(
    self, 
    period_n_data: Dict[str, Any], 
    period_n1_data: Dict[str, Any],
    metrics: Optional[List[str]] = None,
    config: Optional[Dict[str, Any]] = None,
    test_types: Optional[List[str]] = None,
    use_recommended_tests: bool = True,
    include_comprehensive_analysis: bool = True,
    confidence_level: float = 0.95
) -> Dict[str, Any]:
    """
    통계 분석을 수행하는 Celery 작업
    
    Args:
        period_n_data: 현재 기간(n) 데이터
        period_n1_data: 이전 기간(n-1) 데이터
        metrics: 분석할 메트릭 리스트
        config: 통계 분석 엔진 설정
        test_types: 사용자 지정 검정 유형
        use_recommended_tests: 권장 검정 사용 여부
        include_comprehensive_analysis: 종합 분석 포함 여부
        confidence_level: 신뢰구간 신뢰수준
        
    Returns:
        통계 분석 결과
    """
    task_id = self.request.id
    logger.info(f"통계 분석 작업 시작: {task_id}")
    
    try:
        # 1단계: 데이터 준비 (20%)
        self.update_state(
            state='RUNNING',
            meta={
                'status': '데이터 준비 중...',
                'progress': 0,
                'current_step': '데이터 검증 및 변환'
            }
        )
        
        # DataFrame으로 변환
        period_n_df = pd.DataFrame(period_n_data)
        period_n1_df = pd.DataFrame(period_n1_data)
        
        # timestamp 컬럼을 인덱스로 설정
        if 'timestamp' in period_n_df.columns:
            period_n_df['timestamp'] = pd.to_datetime(period_n_df['timestamp'])
            period_n_df.set_index('timestamp', inplace=True)
        
        if 'timestamp' in period_n1_df.columns:
            period_n1_df['timestamp'] = pd.to_datetime(period_n1_df['timestamp'])
            period_n1_df.set_index('timestamp', inplace=True)
        
        self.update_state(
            state='RUNNING',
            meta={
                'status': '데이터 준비 완료',
                'progress': 20,
                'current_step': '통계 분석 엔진 초기화'
            }
        )
        
        # 2단계: 통계 분석 엔진 초기화 (30%)
        engine = StatisticalAnalysisEngine(config=config)
        
        self.update_state(
            state='RUNNING',
            meta={
                'status': '통계 분석 엔진 초기화 완료',
                'progress': 30,
                'current_step': '통계 비교 분석 수행'
            }
        )
        
        # 3단계: 통계 비교 분석 수행 (70%)
        if test_types and not use_recommended_tests:
            # 사용자가 지정한 검정 유형 사용
            from .utils.statistical_analysis import TestType
            test_types_enum = [TestType(test_type) for test_type in test_types]
            result = engine.analyze_periods_comparison_with_custom_tests(
                period_n_df, period_n1_df, metrics, test_types_enum
            )
        else:
            # 기본 분석 또는 권장 검정 사용
            result = engine.analyze_periods_comparison(period_n_df, period_n1_df, metrics)
        
        self.update_state(
            state='RUNNING',
            meta={
                'status': '통계 비교 분석 완료',
                'progress': 70,
                'current_step': '종합 분석 수행'
            }
        )
        
        # 4단계: 종합 분석 수행 (90%)
        comprehensive_analysis = None
        if include_comprehensive_analysis:
            comprehensive_analysis = engine.calculate_comprehensive_effect_sizes(
                result.metrics_results, confidence_level
            )
        
        self.update_state(
            state='RUNNING',
            meta={
                'status': '종합 분석 완료',
                'progress': 90,
                'current_step': '결과 정리'
            }
        )
        
        # 5단계: 결과 정리 (100%)
        # 결과를 딕셔너리로 변환
        response_data = {
            "analysis_id": result.analysis_id,
            "period_n_info": result.period_n_info,
            "period_n1_info": result.period_n1_info,
            "metrics_results": _convert_metrics_results_to_dict(result.metrics_results),
            "overall_assessment": result.overall_assessment,
            "confidence_level": result.confidence_level,
            "timestamp": result.timestamp,
            "total_metrics": result.total_metrics,
            "significant_metrics": result.significant_metrics,
            "clinically_significant_metrics": result.clinically_significant_metrics,
            "task_id": task_id
        }
        
        # 종합 효과 크기 및 임상적 유의성 분석 추가
        if comprehensive_analysis:
            response_data["comprehensive_analysis"] = comprehensive_analysis
        
        logger.info(f"통계 분석 작업 완료: {task_id}, {result.total_metrics}개 메트릭 분석")
        
        return response_data
        
    except Exception as e:
        logger.error(f"통계 분석 작업 실패: {task_id}, 오류: {str(e)}")
        self.update_state(
            state='FAILURE',
            meta={
                'status': '통계 분석 실패',
                'error': str(e),
                'progress': 0
            }
        )
        raise

def _convert_metrics_results_to_dict(metrics_results) -> List[Dict[str, Any]]:
    """메트릭 결과를 딕셔너리로 변환"""
    converted_results = []
    for result in metrics_results:
        converted_result = {
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
        converted_results.append(converted_result)
    
    return converted_results

@celery_app.task(bind=True)
def get_analysis_status(self, task_id: str) -> Dict[str, Any]:
    """
    분석 작업 상태 조회
    
    Args:
        task_id: 조회할 작업 ID
        
    Returns:
        작업 상태 정보
    """
    try:
        # Celery에서 작업 상태 조회
        task_result = celery_app.AsyncResult(task_id)
        
        status_info = {
            'task_id': task_id,
            'status': task_result.status,
            'ready': task_result.ready(),
            'successful': task_result.successful(),
            'failed': task_result.failed()
        }
        
        # 작업이 완료된 경우 결과 포함
        if task_result.ready():
            if task_result.successful():
                status_info['result'] = task_result.result
            else:
                status_info['error'] = str(task_result.info)
        
        # 작업이 진행 중인 경우 메타데이터 포함
        elif task_result.status == 'RUNNING':
            status_info['meta'] = task_result.info
            
        return status_info
        
    except Exception as e:
        logger.error(f"작업 상태 조회 실패: {task_id}, 오류: {str(e)}")
        return {
            'task_id': task_id,
            'status': 'ERROR',
            'error': str(e)
        }

@celery_app.task(bind=True)
def execute_integrated_analysis(self, 
                              period_data: Dict[str, List[float]],
                              metrics: List[str],
                              config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Execute the complete integrated analysis workflow.
    
    This task orchestrates:
    1. Period identification
    2. Statistical analysis  
    3. Anomaly detection
    4. Pass/Fail determination
    
    Args:
        period_data: Dictionary of period data
        metrics: List of metrics to analyze
        config: Optional workflow configuration
        
    Returns:
        Dictionary containing the complete analysis results
    """
    workflow_id = str(uuid.uuid4())
    logger.info(f"Starting integrated analysis task: {workflow_id}")
    
    try:
        # Create workflow configuration
        workflow_config = None
        if config:
            # Convert Pass/Fail config if provided
            pass_fail_config = None
            if 'pass_fail_config' in config:
                pass_fail_config = ThresholdConfig(**config['pass_fail_config'])
                config['pass_fail_config'] = pass_fail_config
            
            workflow_config = WorkflowConfig(**config)
        
        # Create and execute workflow
        workflow = IntegratedAnalysisWorkflow(workflow_config)
        result = workflow.execute(period_data, metrics, workflow_id)
        
        # Convert result to dictionary for JSON serialization
        result_dict = result.dict()
        
        logger.info(f"Integrated analysis task completed successfully: {workflow_id}")
        return {
            'status': 'success',
            'workflow_id': workflow_id,
            'result': result_dict
        }
        
    except Exception as e:
        logger.error(f"Error in integrated analysis task {workflow_id}: {e}")
        return {
            'status': 'error',
            'workflow_id': workflow_id,
            'error': str(e)
        }


@celery_app.task(bind=True)
def execute_quick_analysis(self,
                          period_data: Dict[str, List[float]],
                          metrics: List[str]) -> Dict[str, Any]:
    """
    Execute a quick analysis with default settings.
    
    This is a simplified version of the integrated analysis for quick results.
    
    Args:
        period_data: Dictionary of period data
        metrics: List of metrics to analyze
        
    Returns:
        Dictionary containing the analysis results
    """
    workflow_id = str(uuid.uuid4())
    logger.info(f"Starting quick analysis task: {workflow_id}")
    
    try:
        # Use default configuration for quick analysis
        config = WorkflowConfig(
            min_period_length=5,
            confidence_level=0.95,
            include_comprehensive_analysis=False,  # Skip comprehensive analysis for speed
            sequence_length=5,  # Shorter sequence for faster processing
            feature_window_size=3
        )
        
        workflow = IntegratedAnalysisWorkflow(config)
        result = workflow.execute(period_data, metrics, workflow_id)
        
        result_dict = result.dict()
        
        logger.info(f"Quick analysis task completed successfully: {workflow_id}")
        return {
            'status': 'success',
            'workflow_id': workflow_id,
            'result': result_dict
        }
        
    except Exception as e:
        logger.error(f"Error in quick analysis task {workflow_id}: {e}")
        return {
            'status': 'error',
            'workflow_id': workflow_id,
            'error': str(e)
        }


@celery_app.task(bind=True)
def execute_custom_analysis(self,
                           period_data: Dict[str, List[float]],
                           metrics: List[str],
                           pass_fail_rules: Optional[List[Dict[str, Any]]] = None,
                           thresholds: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """
    Execute analysis with custom Pass/Fail rules and thresholds.
    
    Args:
        period_data: Dictionary of period data
        metrics: List of metrics to analyze
        pass_fail_rules: Custom Pass/Fail rules
        thresholds: Custom threshold values
        
    Returns:
        Dictionary containing the analysis results
    """
    workflow_id = str(uuid.uuid4())
    logger.info(f"Starting custom analysis task: {workflow_id}")
    
    try:
        # Create custom Pass/Fail configuration
        pass_fail_config = None
        if thresholds:
            pass_fail_config = ThresholdConfig(**thresholds)
        
        # Create workflow configuration
        config = WorkflowConfig(
            pass_fail_config=pass_fail_config
        )
        
        workflow = IntegratedAnalysisWorkflow(config)
        
        # Add custom rules if provided
        if pass_fail_rules:
            from .analysis.pass_fail_engine import PassFailRule
            for rule_dict in pass_fail_rules:
                rule = PassFailRule(**rule_dict)
                workflow.pass_fail_engine.add_rule(rule)
        
        result = workflow.execute(period_data, metrics, workflow_id)
        result_dict = result.dict()
        
        logger.info(f"Custom analysis task completed successfully: {workflow_id}")
        return {
            'status': 'success',
            'workflow_id': workflow_id,
            'result': result_dict
        }
        
    except Exception as e:
        logger.error(f"Error in custom analysis task {workflow_id}: {e}")
        return {
            'status': 'error',
            'workflow_id': workflow_id,
            'error': str(e)
        }


@celery_app.task(bind=True)
def execute_batch_analysis(self,
                          analyses: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Execute multiple analyses in batch.
    
    Args:
        analyses: List of analysis requests, each containing period_data, metrics, and optional config
        
    Returns:
        Dictionary containing results for all analyses
    """
    batch_id = str(uuid.uuid4())
    logger.info(f"Starting batch analysis task: {batch_id} with {len(analyses)} analyses")
    
    try:
        results = []
        
        for i, analysis_request in enumerate(analyses):
            try:
                # Update task state
                self.update_state(
                    state='PROGRESS',
                    meta={
                        'batch_id': batch_id,
                        'current_analysis': i + 1,
                        'total_analyses': len(analyses),
                        'progress': (i + 1) / len(analyses)
                    }
                )
                
                # Extract analysis parameters
                period_data = analysis_request['period_data']
                metrics = analysis_request['metrics']
                config = analysis_request.get('config')
                
                # Execute individual analysis
                workflow_config = None
                if config:
                    workflow_config = WorkflowConfig(**config)
                
                workflow = IntegratedAnalysisWorkflow(workflow_config)
                result = workflow.execute(period_data, metrics, f"{batch_id}-{i+1}")
                
                results.append({
                    'analysis_index': i + 1,
                    'status': 'success',
                    'result': result.dict()
                })
                
            except Exception as e:
                logger.error(f"Error in batch analysis {batch_id}, analysis {i+1}: {e}")
                results.append({
                    'analysis_index': i + 1,
                    'status': 'error',
                    'error': str(e)
                })
        
        logger.info(f"Batch analysis task completed: {batch_id}")
        return {
            'status': 'success',
            'batch_id': batch_id,
            'total_analyses': len(analyses),
            'successful_analyses': len([r for r in results if r['status'] == 'success']),
            'failed_analyses': len([r for r in results if r['status'] == 'error']),
            'results': results
        }
        
    except Exception as e:
        logger.error(f"Error in batch analysis task {batch_id}: {e}")
        return {
            'status': 'error',
            'batch_id': batch_id,
            'error': str(e)
        }
