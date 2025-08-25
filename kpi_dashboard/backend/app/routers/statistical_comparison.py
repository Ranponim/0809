"""
통계 비교 분석 API 라우터

작업 3: Backend: Develop Core Statistical Analysis Engine
두 테스트 기간 간의 통계적 비교 분석을 위한 API 엔드포인트를 제공합니다.
"""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from datetime import datetime
import pandas as pd
import io
import json
import numpy as np

from ..utils.statistical_analysis import StatisticalAnalysisEngine
from ..tasks import perform_statistical_analysis, get_analysis_status
from ..models.statistical_analysis import (
    StatisticalAnalysisRequest, 
    ComprehensiveAnalysisResult,
    StatisticalAnalysisTask
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/statistical", tags=["Statistical Comparison"])

# 새로운 라우터 추가: /api/analysis/statistical-comparison 엔드포인트를 위한 별도 라우터
analysis_router = APIRouter(prefix="/api/analysis", tags=["Analysis"])

def validate_period_data(data: Dict[str, Any]) -> bool:
    """기간 데이터 유효성 검증"""
    if not isinstance(data, dict):
        return False
    
    # 최소한 timestamp 컬럼이 있어야 함
    if 'timestamp' not in data:
        return False
    
    # 데이터가 비어있지 않아야 함
    if not data['timestamp'] or len(data['timestamp']) == 0:
        return False
    
    # 모든 메트릭 컬럼의 길이가 timestamp와 같아야 함
    timestamp_length = len(data['timestamp'])
    for key, value in data.items():
        if key != 'timestamp' and isinstance(value, list):
            if len(value) != timestamp_length:
                return False
    
    return True

def validate_metrics(metrics: List[str], data: Dict[str, Any]) -> List[str]:
    """메트릭 유효성 검증 및 필터링"""
    if not metrics:
        return []
    
    available_metrics = [key for key in data.keys() if key != 'timestamp' and isinstance(data[key], list)]
    valid_metrics = [metric for metric in metrics if metric in available_metrics]
    
    if len(valid_metrics) != len(metrics):
        invalid_metrics = [metric for metric in metrics if metric not in available_metrics]
        logger.warning(f"유효하지 않은 메트릭 제외: {invalid_metrics}")
    
    return valid_metrics

def validate_test_types(test_types: List[str]) -> List[str]:
    """검정 유형 유효성 검증"""
    valid_test_types = [
        "students_t_test", "welchs_t_test", "mann_whitney_u_test",
        "wilcoxon_signed_rank_test", "paired_t_test", "kruskal_wallis_h_test",
        "anova_test", "ks_test"
    ]
    
    if not test_types:
        return []
    
    valid_types = [test_type for test_type in test_types if test_type in valid_test_types]
    
    if len(valid_types) != len(test_types):
        invalid_types = [test_type for test_type in test_types if test_type not in valid_test_types]
        logger.warning(f"유효하지 않은 검정 유형 제외: {invalid_types}")
    
    return valid_types

class StatisticalComparisonRequest(BaseModel):
    """통계 비교 분석 요청 모델"""
    period_n_start: str
    period_n_end: str
    period_n1_start: str
    period_n1_end: str
    metrics: Optional[List[str]] = None
    config: Optional[Dict[str, Any]] = None
    test_types: Optional[List[str]] = None  # 사용자 지정 검정 유형
    use_recommended_tests: bool = True  # 권장 검정 사용 여부
    include_comprehensive_analysis: bool = True  # 종합 효과 크기 및 임상적 유의성 분석 포함
    confidence_level: float = 0.95  # 신뢰구간 신뢰수준

class StatisticalComparisonResponse(BaseModel):
    """통계 비교 분석 응답 모델"""
    analysis_id: str
    period_n_info: Dict[str, Any]
    period_n1_info: Dict[str, Any]
    metrics_results: List[Dict[str, Any]]
    overall_assessment: str
    confidence_level: float
    timestamp: datetime
    total_metrics: int
    significant_metrics: int
    clinically_significant_metrics: int

class AsyncStatisticalComparisonRequest(BaseModel):
    """비동기 통계 비교 분석 요청 모델"""
    period_n_data: Dict[str, Any]  # 현재 기간 데이터
    period_n1_data: Dict[str, Any]  # 이전 기간 데이터
    metrics: Optional[List[str]] = None
    config: Optional[Dict[str, Any]] = None
    test_types: Optional[List[str]] = None
    use_recommended_tests: bool = True
    include_comprehensive_analysis: bool = True
    confidence_level: float = 0.95

class AsyncStatisticalComparisonResponse(BaseModel):
    """비동기 통계 비교 분석 응답 모델"""
    task_id: str
    status: str
    message: str
    estimated_completion_time: Optional[int] = None

class TaskStatusResponse(BaseModel):
    """작업 상태 응답 모델"""
    task_id: str
    status: str
    ready: bool
    successful: bool
    failed: bool
    progress: Optional[int] = None
    current_step: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@analysis_router.post("/statistical-comparison", response_model=AsyncStatisticalComparisonResponse, summary="비동기 통계 비교 분석 요청")
async def request_statistical_comparison(request: AsyncStatisticalComparisonRequest):
    """
    두 테스트 기간 간의 통계적 비교 분석을 비동기적으로 요청합니다.
    
    Args:
        request: 비동기 통계 비교 분석 요청 데이터
        
    Returns:
        작업 ID와 상태 정보
    """
    try:
        logger.info("비동기 통계 비교 분석 요청 수신")
        
        # 입력 데이터 유효성 검증
        if not validate_period_data(request.period_n_data):
            raise HTTPException(
                status_code=400,
                detail="현재 기간 데이터가 유효하지 않습니다. timestamp 컬럼과 메트릭 데이터가 필요합니다."
            )
        
        if not validate_period_data(request.period_n1_data):
            raise HTTPException(
                status_code=400,
                detail="이전 기간 데이터가 유효하지 않습니다. timestamp 컬럼과 메트릭 데이터가 필요합니다."
            )
        
        # 메트릭 유효성 검증
        valid_metrics = validate_metrics(request.metrics, request.period_n_data)
        if request.metrics and not valid_metrics:
            raise HTTPException(
                status_code=400,
                detail="지정된 메트릭이 데이터에 존재하지 않습니다."
            )
        
        # 검정 유형 유효성 검증
        valid_test_types = validate_test_types(request.test_types or [])
        if request.test_types and not valid_test_types:
            raise HTTPException(
                status_code=400,
                detail="지정된 검정 유형이 유효하지 않습니다."
            )
        
        # Celery 작업 시작
        task = perform_statistical_analysis.delay(
            period_n_data=request.period_n_data,
            period_n1_data=request.period_n1_data,
            metrics=valid_metrics,
            config=request.config,
            test_types=valid_test_types,
            use_recommended_tests=request.use_recommended_tests,
            include_comprehensive_analysis=request.include_comprehensive_analysis,
            confidence_level=request.confidence_level
        )
        
        logger.info(f"통계 분석 작업 시작: {task.id}")
        
        return AsyncStatisticalComparisonResponse(
            task_id=task.id,
            status="PENDING",
            message="통계 분석 작업이 시작되었습니다. 작업 상태를 확인하려면 /api/analysis/task-status/{task_id}를 사용하세요.",
            estimated_completion_time=300  # 5분 예상
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"비동기 통계 비교 분석 요청 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"통계 분석 작업 시작 실패: {str(e)}"
        )

@analysis_router.get("/task-status/{task_id}", response_model=TaskStatusResponse, summary="작업 상태 조회")
async def get_task_status(task_id: str):
    """
    비동기 작업의 상태를 조회합니다.
    
    Args:
        task_id: 조회할 작업 ID
        
    Returns:
        작업 상태 정보
    """
    try:
        logger.info(f"작업 상태 조회 요청: {task_id}")
        
        # Celery 작업 상태 조회
        status_info = get_analysis_status.delay(task_id)
        result = status_info.get()
        
        return TaskStatusResponse(
            task_id=result['task_id'],
            status=result['status'],
            ready=result['ready'],
            successful=result['successful'],
            failed=result['failed'],
            progress=result.get('meta', {}).get('progress') if 'meta' in result else None,
            current_step=result.get('meta', {}).get('current_step') if 'meta' in result else None,
            result=result.get('result'),
            error=result.get('error')
        )
        
    except Exception as e:
        logger.error(f"작업 상태 조회 실패: {task_id}, 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"작업 상태 조회 실패: {str(e)}"
        )

@analysis_router.post("/statistical-comparison-sync", response_model=StatisticalComparisonResponse, summary="동기 통계 비교 분석")
async def perform_sync_statistical_comparison(request: AsyncStatisticalComparisonRequest):
    """
    두 테스트 기간 간의 통계적 비교 분석을 동기적으로 수행합니다.
    
    Args:
        request: 동기 통계 비교 분석 요청 데이터
        
    Returns:
        통계 비교 분석 결과
    """
    try:
        logger.info("동기 통계 비교 분석 요청 수신")
        
        # StatisticalAnalysisEngine 초기화
        engine = StatisticalAnalysisEngine(config=request.config)
        
        # DataFrame으로 변환
        period_n_df = pd.DataFrame(request.period_n_data)
        period_n1_df = pd.DataFrame(request.period_n1_data)
        
        # timestamp 컬럼을 인덱스로 설정
        if 'timestamp' in period_n_df.columns:
            period_n_df['timestamp'] = pd.to_datetime(period_n_df['timestamp'])
            period_n_df.set_index('timestamp', inplace=True)
        
        if 'timestamp' in period_n1_df.columns:
            period_n1_df['timestamp'] = pd.to_datetime(period_n1_df['timestamp'])
            period_n1_df.set_index('timestamp', inplace=True)
        
        # 통계 비교 분석 수행
        if request.test_types and not request.use_recommended_tests:
            # 사용자가 지정한 검정 유형 사용
            from ..utils.statistical_analysis import TestType
            test_types = [TestType(test_type) for test_type in request.test_types]
            result = engine.analyze_periods_comparison_with_custom_tests(
                period_n_df, period_n1_df, request.metrics, test_types
            )
        else:
            # 기본 분석 또는 권장 검정 사용
            result = engine.analyze_periods_comparison(period_n_df, period_n1_df, request.metrics)
        
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
            "clinically_significant_metrics": result.clinically_significant_metrics
        }
        
        # 종합 효과 크기 및 임상적 유의성 분석 추가
        if request.include_comprehensive_analysis:
            comprehensive_analysis = _generate_comprehensive_analysis(
                result.metrics_results, request.confidence_level
            )
            response_data["comprehensive_analysis"] = comprehensive_analysis
        
        logger.info(f"동기 통계 비교 분석 완료: {result.total_metrics}개 메트릭, "
                   f"{result.significant_metrics}개 유의, {result.clinically_significant_metrics}개 임상적 유의")
        
        return StatisticalComparisonResponse(**response_data)
        
    except Exception as e:
        logger.error(f"동기 통계 비교 분석 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"통계 비교 분석 실패: {str(e)}"
        )

class FileUploadComparisonRequest(BaseModel):
    """파일 업로드 통계 비교 요청 모델"""
    metrics: Optional[List[str]] = None
    config: Optional[Dict[str, Any]] = None

@router.post("/compare-periods", response_model=StatisticalComparisonResponse, summary="두 기간 간 통계 비교 분석")
async def compare_periods_statistically(request: StatisticalComparisonRequest):
    """
    두 테스트 기간 간의 통계적 비교 분석을 수행합니다.
    
    Args:
        request: 통계 비교 분석 요청 데이터
        
    Returns:
        통계 비교 분석 결과
    """
    try:
        logger.info(f"통계 비교 분석 요청 수신: 기간 n({request.period_n_start}~{request.period_n_end}) vs "
                   f"기간 n-1({request.period_n1_start}~{request.period_n1_end})")
        
        # StatisticalAnalysisEngine 초기화
        engine = StatisticalAnalysisEngine(config=request.config)
        
        # TODO: 실제 데이터베이스에서 데이터 로드
        # 현재는 샘플 데이터 생성
        period_n_data = _generate_sample_period_data(request.period_n_start, request.period_n_end)
        period_n1_data = _generate_sample_period_data(request.period_n1_start, request.period_n1_end)
        
        # 통계 비교 분석 수행
        if request.test_types and not request.use_recommended_tests:
            # 사용자가 지정한 검정 유형 사용
            from ..utils.statistical_analysis import TestType
            test_types = [TestType(test_type) for test_type in request.test_types]
            result = engine.analyze_periods_comparison_with_custom_tests(
                period_n_data, period_n1_data, request.metrics, test_types
            )
        else:
            # 기본 분석 또는 권장 검정 사용
            result = engine.analyze_periods_comparison(period_n_data, period_n1_data, request.metrics)
        
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
            "clinically_significant_metrics": result.clinically_significant_metrics
        }
        
        # 종합 효과 크기 및 임상적 유의성 분석 추가
        if request.include_comprehensive_analysis:
            comprehensive_analysis = _generate_comprehensive_analysis(
                result.metrics_results, request.confidence_level
            )
            response_data["comprehensive_analysis"] = comprehensive_analysis
        
        logger.info(f"통계 비교 분석 완료: {result.total_metrics}개 메트릭, "
                   f"{result.significant_metrics}개 유의, {result.clinically_significant_metrics}개 임상적 유의")
        
        return StatisticalComparisonResponse(**response_data)
        
    except Exception as e:
        logger.error(f"통계 비교 분석 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"통계 비교 분석 실패: {str(e)}"
        )

@router.post("/compare-periods-upload", summary="파일 업로드를 통한 통계 비교 분석")
async def compare_periods_from_files(
    period_n_file: UploadFile = File(...),
    period_n1_file: UploadFile = File(...),
    metrics: Optional[str] = None,
    config: Optional[str] = None
):
    """
    CSV 파일 업로드를 통해 두 기간 간의 통계 비교 분석을 수행합니다.
    
    Args:
        period_n_file: 현재 기간(n) 데이터 CSV 파일
        period_n1_file: 이전 기간(n-1) 데이터 CSV 파일
        metrics: 분석할 메트릭 리스트 (쉼표로 구분)
        config: 설정 JSON 문자열
        
    Returns:
        통계 비교 분석 결과
    """
    try:
        logger.info(f"파일 업로드 통계 비교 분석 요청: {period_n_file.filename} vs {period_n1_file.filename}")
        
        # 파일 내용 읽기
        period_n_content = await period_n_file.read()
        period_n1_content = await period_n1_file.read()
        
        # CSV 파싱
        try:
            period_n_df = pd.read_csv(io.StringIO(period_n_content.decode('utf-8')))
            period_n1_df = pd.read_csv(io.StringIO(period_n1_content.decode('utf-8')))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"CSV 파일 파싱 실패: {str(e)}"
            )
        
        # timestamp 컬럼을 인덱스로 설정
        if 'timestamp' in period_n_df.columns:
            period_n_df['timestamp'] = pd.to_datetime(period_n_df['timestamp'])
            period_n_df.set_index('timestamp', inplace=True)
        
        if 'timestamp' in period_n1_df.columns:
            period_n1_df['timestamp'] = pd.to_datetime(period_n1_df['timestamp'])
            period_n1_df.set_index('timestamp', inplace=True)
        
        # 메트릭 리스트 파싱
        metrics_list = None
        if metrics:
            metrics_list = [m.strip() for m in metrics.split(',')]
        
        # 설정 파싱
        config_dict = None
        if config:
            try:
                config_dict = json.loads(config)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=400,
                    detail="설정 JSON 파싱 실패"
                )
        
        # StatisticalAnalysisEngine 초기화
        engine = StatisticalAnalysisEngine(config=config_dict)
        
        # 통계 비교 분석 수행
        result = engine.analyze_periods_comparison(period_n_df, period_n1_df, metrics_list)
        
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
            "file_info": {
                "period_n_file": period_n_file.filename,
                "period_n1_file": period_n1_file.filename,
                "period_n_rows": len(period_n_df),
                "period_n1_rows": len(period_n1_df)
            }
        }
        
        logger.info(f"파일 기반 통계 비교 분석 완료: {result.total_metrics}개 메트릭")
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"파일 기반 통계 비교 분석 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"파일 기반 통계 비교 분석 실패: {str(e)}"
        )

@router.get("/analysis/{analysis_id}", summary="특정 분석 결과 조회")
async def get_analysis_result(analysis_id: str):
    """
    특정 분석 결과를 조회합니다.
    
    Args:
        analysis_id: 분석 ID
        
    Returns:
        분석 결과
    """
    try:
        logger.info(f"분석 결과 조회 요청: {analysis_id}")
        
        # TODO: 데이터베이스에서 실제 분석 결과 조회
        # 현재는 샘플 데이터 반환
        sample_result = {
            "analysis_id": analysis_id,
            "period_n_info": {
                "period_name": "n",
                "start_time": "2024-01-01T10:00:00",
                "end_time": "2024-01-01T12:00:00",
                "duration_minutes": 120.0,
                "total_records": 120,
                "metrics_count": 3
            },
            "period_n1_info": {
                "period_name": "n-1",
                "start_time": "2024-01-02T10:00:00",
                "end_time": "2024-01-02T12:00:00",
                "duration_minutes": 120.0,
                "total_records": 120,
                "metrics_count": 3
            },
            "metrics_results": [
                {
                    "metric_name": "throughput",
                    "test_result": {
                        "test_type": "t_test",
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
                    "clinical_significance": True,
                    "summary": "메트릭 'throughput': 유의함 (p=0.0150), 효과 크기: large 크기의 증가 효과 (d=0.800), 임상적으로 유의함"
                }
            ],
            "overall_assessment": "전체 1개 메트릭 중 1개 유의 (100.0%), 1개 임상적 유의 (100.0%). 종합 평가: 매우 좋음",
            "confidence_level": 0.985,
            "timestamp": datetime.now(),
            "total_metrics": 1,
            "significant_metrics": 1,
            "clinically_significant_metrics": 1
        }
        
        return sample_result
        
    except Exception as e:
        logger.error(f"분석 결과 조회 실패: {analysis_id}, 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"분석 결과 조회 실패: {str(e)}"
        )

@router.get("/analysis/{analysis_id}/metrics/{metric_name}", summary="특정 메트릭 분석 결과 조회")
async def get_metric_analysis_result(analysis_id: str, metric_name: str):
    """
    특정 분석의 특정 메트릭 결과를 조회합니다.
    
    Args:
        analysis_id: 분석 ID
        metric_name: 메트릭 이름
        
    Returns:
        메트릭별 분석 결과
    """
    try:
        logger.info(f"메트릭 분석 결과 조회: {analysis_id}, {metric_name}")
        
        # TODO: 데이터베이스에서 실제 메트릭 결과 조회
        # 현재는 샘플 데이터 반환
        sample_metric_result = {
            "analysis_id": analysis_id,
            "metric_name": metric_name,
            "test_result": {
                "test_type": "t_test",
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
            "clinical_significance": True,
            "summary": f"메트릭 '{metric_name}': 유의함 (p=0.0150), 효과 크기: large 크기의 증가 효과 (d=0.800), 임상적으로 유의함",
            "period_n_stats": {
                "mean": 150.5,
                "std": 10.2,
                "count": 120
            },
            "period_n1_stats": {
                "mean": 100.3,
                "std": 8.7,
                "count": 120
            }
        }
        
        return sample_metric_result
        
    except Exception as e:
        logger.error(f"메트릭 분석 결과 조회 실패: {analysis_id}, {metric_name}, 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"메트릭 분석 결과 조회 실패: {str(e)}"
        )

@router.post("/recommend-tests", summary="데이터 특성에 따른 권장 검정 방법 조회")
async def get_recommended_tests(
    period_n_file: UploadFile = File(...),
    period_n1_file: UploadFile = File(...),
    metric: str = None
):
    """업로드된 데이터의 특성에 따라 권장되는 통계 검정 방법을 조회합니다."""
    try:
        # 파일 읽기
        period_n_data = pd.read_csv(period_n_file.file)
        period_n1_data = pd.read_csv(period_n1_file.file)
        
        # 엔진 초기화
        engine = StatisticalAnalysisEngine()
        
        # 메트릭 선택
        if metric:
            metrics = [metric]
        else:
            metrics = engine._get_numeric_metrics(period_n_data)
        
        # 권장 검정 방법 조회
        recommendations = []
        for metric_name in metrics:
            if metric_name in period_n_data.columns and metric_name in period_n1_data.columns:
                n_data = period_n_data[metric_name].dropna().values
                n1_data = period_n1_data[metric_name].dropna().values
                
                if len(n_data) > 0 and len(n1_data) > 0:
                    recommended_tests = engine.get_recommended_tests(n_data, n1_data)
                    reasoning = _generate_recommendation_reasoning(
                        engine._test_normality(n_data),
                        engine._test_normality(n1_data),
                        engine._test_homogeneity(n_data, n1_data),
                        len(n_data), len(n1_data)
                    )
                    
                    recommendations.append({
                        "metric": metric_name,
                        "recommended_tests": [test.value for test in recommended_tests],
                        "reasoning": reasoning,
                        "data_characteristics": {
                            "n_sample_size": len(n_data),
                            "n1_sample_size": len(n1_data),
                            "n_normal": engine._test_normality(n_data),
                            "n1_normal": engine._test_normality(n1_data),
                            "equal_variance": engine._test_homogeneity(n_data, n1_data)
                        }
                    })
        
        return {
            "status": "success",
            "recommendations": recommendations,
            "total_metrics": len(recommendations)
        }
        
    except Exception as e:
        logger.error(f"권장 검정 방법 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"권장 검정 방법 조회 실패: {str(e)}")

@router.post("/generate-report", summary="통합 분석 보고서 생성")
async def generate_integrated_report(
    period_n_file: UploadFile = File(...),
    period_n1_file: UploadFile = File(...),
    metrics: Optional[List[str]] = None,
    config: Optional[Dict[str, Any]] = None,
    report_format: str = "both",  # "json", "text", "both"
    include_visualization: bool = True
):
    """통계 분석 결과를 바탕으로 통합 분석 보고서를 생성합니다."""
    try:
        # 파일 읽기
        period_n_data = pd.read_csv(period_n_file.file)
        period_n1_data = pd.read_csv(period_n1_file.file)
        
        # 엔진 초기화
        engine = StatisticalAnalysisEngine(config)
        
        # 메트릭 선택
        if not metrics:
            metrics = engine._get_numeric_metrics(period_n_data)
        
        # 통계 비교 분석 수행
        result = engine.analyze_periods_comparison(period_n_data, period_n1_data, metrics)
        
        # 통합 분석 보고서 생성
        if include_visualization:
            comprehensive_report = engine.generate_comprehensive_report_with_visualization(result)
            return {
                "status": "success",
                "report": comprehensive_report,
                "analysis_id": result.analysis_id
            }
        else:
            integrated_report = engine.generate_integrated_analysis_report(result, report_format)
            
            if report_format == "json":
                return {
                    "status": "success",
                    "report": integrated_report,
                    "analysis_id": result.analysis_id
                }
            elif report_format == "text":
                return {
                    "status": "success",
                    "report": integrated_report,
                    "analysis_id": result.analysis_id
                }
            else:  # "both"
                return {
                    "status": "success",
                    "report": integrated_report.to_json(),
                    "text_report": integrated_report.to_text_report(),
                    "analysis_id": result.analysis_id
                }
        
    except Exception as e:
        logger.error(f"통합 분석 보고서 생성 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"통합 분석 보고서 생성 실패: {str(e)}")

@router.get("/report/{analysis_id}", summary="생성된 분석 보고서 조회")
async def get_analysis_report(analysis_id: str):
    """생성된 분석 보고서를 조회합니다."""
    try:
        # 실제 구현에서는 데이터베이스나 캐시에서 보고서를 조회
        # 현재는 샘플 응답을 반환
        return {
            "status": "success",
            "analysis_id": analysis_id,
            "message": "보고서 조회 기능은 향후 구현 예정입니다."
        }
        
    except Exception as e:
        logger.error(f"분석 보고서 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"분석 보고서 조회 실패: {str(e)}")

@router.post("/export-report", summary="분석 보고서 내보내기")
async def export_analysis_report(
    period_n_file: UploadFile = File(...),
    period_n1_file: UploadFile = File(...),
    export_format: str = "json",  # "json", "text", "pdf"
    metrics: Optional[List[str]] = None,
    config: Optional[Dict[str, Any]] = None
):
    """통계 분석 보고서를 다양한 형식으로 내보냅니다."""
    try:
        # 파일 읽기
        period_n_data = pd.read_csv(period_n_file.file)
        period_n1_data = pd.read_csv(period_n1_file.file)
        
        # 엔진 초기화
        engine = StatisticalAnalysisEngine(config)
        
        # 메트릭 선택
        if not metrics:
            metrics = engine._get_numeric_metrics(period_n_data)
        
        # 통계 비교 분석 수행
        result = engine.analyze_periods_comparison(period_n_data, period_n1_data, metrics)
        
        # 보고서 생성
        if export_format == "json":
            report = engine.generate_integrated_analysis_report(result, "json")
            return {
                "status": "success",
                "format": "json",
                "report": report,
                "analysis_id": result.analysis_id
            }
        elif export_format == "text":
            report = engine.generate_integrated_analysis_report(result, "text")
            return {
                "status": "success",
                "format": "text",
                "report": report,
                "analysis_id": result.analysis_id
            }
        elif export_format == "pdf":
            # PDF 내보내기 기능은 향후 구현
            return {
                "status": "success",
                "format": "pdf",
                "message": "PDF 내보내기 기능은 향후 구현 예정입니다.",
                "analysis_id": result.analysis_id
            }
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 내보내기 형식입니다.")
        
    except Exception as e:
        logger.error(f"분석 보고서 내보내기 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"분석 보고서 내보내기 실패: {str(e)}")

def _generate_recommendation_reasoning(n_normal: bool, n1_normal: bool, 
                                     equal_variance: bool, n_size: int, n1_size: int) -> str:
    """권장 이유 생성"""
    reasoning = []
    
    if n_normal and n1_normal:
        reasoning.append("두 기간 모두 정규분포를 따릅니다.")
        if equal_variance:
            reasoning.append("등분산 가정이 성립하므로 Student's t-test를 권장합니다.")
        else:
            reasoning.append("등분산 가정이 성립하지 않으므로 Welch's t-test를 권장합니다.")
        reasoning.append("일원배치 분산분석(ANOVA)도 적합합니다.")
    else:
        reasoning.append("정규분포 가정이 성립하지 않으므로 비모수 검정을 권장합니다.")
        reasoning.append("Mann-Whitney U test와 Kruskal-Wallis H test가 적합합니다.")
    
    min_size = min(n_size, n1_size)
    if min_size < 10:
        reasoning.append(f"샘플 크기가 작습니다({min_size}). 비모수 검정이 더 안정적입니다.")
    
    if n_size == n1_size:
        reasoning.append("대응표본 검정(Wilcoxon signed-rank test, Paired t-test)이 가능합니다.")
    
    reasoning.append("분포 비교를 위해 Kolmogorov-Smirnov test를 권장합니다.")
    
    return " ".join(reasoning)

def _generate_comprehensive_analysis(metrics_results, confidence_level: float) -> Dict[str, Any]:
    """종합 효과 크기 및 임상적 유의성 분석 생성"""
    from ..utils.statistical_analysis import EffectSizeType
    
    comprehensive_analysis = {
        "effect_size_summary": {},
        "clinical_significance_summary": {},
        "confidence_intervals": {},
        "overall_recommendations": []
    }
    
    # 효과 크기 요약
    effect_size_counts = {
        'cohens_d': {'small': 0, 'medium': 0, 'large': 0},
        'hedges_g': {'small': 0, 'medium': 0, 'large': 0},
        'cliffs_delta': {'small': 0, 'medium': 0, 'large': 0}
    }
    
    # 임상적 유의성 요약
    clinical_significance_count = 0
    total_metrics = len(metrics_results)
    
    for result in metrics_results:
        # 효과 크기 카운트
        effect_size = result['effect_size']
        effect_type = effect_size['effect_size_type']
        magnitude = effect_size['magnitude']
        
        if effect_type in effect_size_counts:
            effect_size_counts[effect_type][magnitude] += 1
        
        # 임상적 유의성 카운트
        if result['clinical_significance']:
            clinical_significance_count += 1
    
    # 효과 크기 요약 생성
    for effect_type, counts in effect_size_counts.items():
        total = sum(counts.values())
        if total > 0:
            comprehensive_analysis["effect_size_summary"][effect_type] = {
                "small_percentage": (counts['small'] / total) * 100,
                "medium_percentage": (counts['medium'] / total) * 100,
                "large_percentage": (counts['large'] / total) * 100,
                "dominant_magnitude": max(counts, key=counts.get)
            }
    
    # 임상적 유의성 요약
    comprehensive_analysis["clinical_significance_summary"] = {
        "clinically_significant_count": clinical_significance_count,
        "total_metrics": total_metrics,
        "clinical_significance_percentage": (clinical_significance_count / total_metrics) * 100 if total_metrics > 0 else 0
    }
    
    # 전체 권장사항 생성
    if clinical_significance_count / total_metrics >= 0.7:
        comprehensive_analysis["overall_recommendations"].append("대부분의 메트릭에서 임상적 유의성을 보이므로 개선 조치를 권장합니다.")
    elif clinical_significance_count / total_metrics >= 0.5:
        comprehensive_analysis["overall_recommendations"].append("일부 메트릭에서 임상적 유의성을 보이므로 선택적 개선을 고려하세요.")
    else:
        comprehensive_analysis["overall_recommendations"].append("대부분의 메트릭에서 임상적 유의성이 낮으므로 추가 분석이 필요합니다.")
    
    # 효과 크기별 권장사항
    for effect_type, summary in comprehensive_analysis["effect_size_summary"].items():
        if summary["large_percentage"] >= 50:
            comprehensive_analysis["overall_recommendations"].append(f"{effect_type}: 대부분 큰 효과 크기를 보이므로 강력한 개선 효과를 기대할 수 있습니다.")
        elif summary["medium_percentage"] >= 50:
            comprehensive_analysis["overall_recommendations"].append(f"{effect_type}: 보통 수준의 효과 크기를 보이므로 적절한 개선 효과를 기대할 수 있습니다.")
    
    return comprehensive_analysis

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

def _generate_sample_period_data(start_date: str, end_date: str) -> pd.DataFrame:
    """
    샘플 기간 데이터를 생성합니다.
    
    Args:
        start_date: 시작 날짜
        end_date: 종료 날짜
        
    Returns:
        샘플 데이터 DataFrame
    """
    try:
        # 날짜 범위 생성
        start = pd.to_datetime(start_date)
        end = pd.to_datetime(end_date)
        
        # 1분 간격으로 타임스탬프 생성
        timestamps = pd.date_range(start=start, end=end, freq='1min')
        
        # 샘플 데이터 생성
        np.random.seed(42)  # 재현성을 위한 시드 설정
        
        # 기본 트렌드와 노이즈 생성
        n_points = len(timestamps)
        trend = np.linspace(100, 120, n_points)
        noise = np.random.normal(0, 5, n_points)
        
        # 메트릭 데이터 생성
        throughput = trend + noise
        latency = 1000 / (throughput + 1) + np.random.normal(0, 10, n_points)
        error_rate = np.random.exponential(0.01, n_points)
        
        # DataFrame 생성
        df = pd.DataFrame({
            'timestamp': timestamps,
            'throughput': throughput,
            'latency': latency,
            'error_rate': error_rate
        })
        
        df.set_index('timestamp', inplace=True)
        
        logger.info(f"샘플 기간 데이터 생성 완료: {len(df)} 데이터 포인트")
        return df
        
    except Exception as e:
        logger.error(f"샘플 기간 데이터 생성 실패: {str(e)}")
        raise
