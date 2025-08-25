"""
Statistical Analysis Database Models

이 모듈은 통계 분석 엔진의 결과를 저장하기 위한 데이터베이스 모델을 정의합니다.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, validator, ConfigDict
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class TestTypeEnum(str, Enum):
    """통계 검정 유형"""
    STUDENTS_T_TEST = "students_t_test"
    WELCHS_T_TEST = "welchs_t_test"
    MANN_WHITNEY_U_TEST = "mann_whitney_u_test"
    WILCOXON_SIGNED_RANK_TEST = "wilcoxon_signed_rank_test"
    PAIRED_T_TEST = "paired_t_test"
    KRUSKAL_WALLIS_H_TEST = "kruskal_wallis_h_test"
    ANOVA_TEST = "anova_test"
    KS_TEST = "ks_test"

class EffectSizeTypeEnum(str, Enum):
    """효과 크기 유형"""
    COHENS_D = "cohens_d"
    HEDGES_G = "hedges_g"
    CLIFFS_DELTA = "cliffs_delta"

class EffectSizeMagnitudeEnum(str, Enum):
    """효과 크기 크기"""
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"

class ClinicalSignificanceLevelEnum(str, Enum):
    """임상적 유의성 수준"""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"

class StatisticalTestResult(BaseModel):
    """통계 검정 결과"""
    test_type: TestTypeEnum = Field(..., description="검정 유형")
    statistic: float = Field(..., description="검정 통계량")
    p_value: float = Field(..., description="p-값")
    is_significant: bool = Field(..., description="통계적 유의성")
    alpha: float = Field(0.05, description="유의수준")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "test_type": "students_t_test",
                "statistic": 2.5,
                "p_value": 0.015,
                "is_significant": True,
                "alpha": 0.05
            }
        }
    )

class EffectSizeResult(BaseModel):
    """효과 크기 결과"""
    effect_size_type: EffectSizeTypeEnum = Field(..., description="효과 크기 유형")
    value: float = Field(..., description="효과 크기 값")
    interpretation: str = Field(..., description="효과 크기 해석")
    magnitude: EffectSizeMagnitudeEnum = Field(..., description="효과 크기 크기")
    confidence_interval_lower: Optional[float] = Field(None, description="신뢰구간 하한")
    confidence_interval_upper: Optional[float] = Field(None, description="신뢰구간 상한")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "effect_size_type": "cohens_d",
                "value": 0.8,
                "interpretation": "large 크기의 증가 효과",
                "magnitude": "large",
                "confidence_interval_lower": 0.6,
                "confidence_interval_upper": 1.0
            }
        }
    )

class ClinicalSignificanceAssessment(BaseModel):
    """임상적 유의성 평가"""
    is_clinically_significant: bool = Field(..., description="임상적 유의성 여부")
    significance_level: ClinicalSignificanceLevelEnum = Field(..., description="유의성 수준")
    reasoning: str = Field(..., description="판단 근거")
    recommendations: List[str] = Field(..., description="권장사항")
    risk_assessment: str = Field(..., description="위험도 평가")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "is_clinically_significant": True,
                "significance_level": "high",
                "reasoning": "통계적 유의성과 큰 효과 크기를 모두 만족",
                "recommendations": ["개선 조치 권장", "지속적 모니터링 필요"],
                "risk_assessment": "낮음"
            }
        }
    )

class MetricAnalysisResult(BaseModel):
    """메트릭별 분석 결과"""
    metric_name: str = Field(..., description="메트릭 이름")
    test_result: StatisticalTestResult = Field(..., description="통계 검정 결과")
    effect_size: EffectSizeResult = Field(..., description="효과 크기 결과")
    clinical_significance: ClinicalSignificanceAssessment = Field(..., description="임상적 유의성 평가")
    summary: str = Field(..., description="요약")
    
    # 기간별 통계 정보
    period_n_stats: Dict[str, float] = Field(..., description="현재 기간 통계")
    period_n1_stats: Dict[str, float] = Field(..., description="이전 기간 통계")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
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
        }
    )

class ComprehensiveAnalysisResult(BaseModel):
    """종합 분석 결과"""
    analysis_id: str = Field(..., description="분석 ID")
    period_n_info: Dict[str, Any] = Field(..., description="현재 기간 정보")
    period_n1_info: Dict[str, Any] = Field(..., description="이전 기간 정보")
    metrics_results: List[MetricAnalysisResult] = Field(..., description="메트릭별 분석 결과")
    overall_assessment: str = Field(..., description="전체 평가")
    confidence_level: float = Field(..., description="신뢰수준")
    timestamp: datetime = Field(..., description="분석 시간")
    total_metrics: int = Field(..., description="총 메트릭 수")
    significant_metrics: int = Field(..., description="유의한 메트릭 수")
    clinically_significant_metrics: int = Field(..., description="임상적으로 유의한 메트릭 수")
    
    # 종합 효과 크기 분석
    comprehensive_effect_sizes: Optional[Dict[str, Any]] = Field(None, description="종합 효과 크기 분석")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "analysis_id": "stat_analysis_20241201_001",
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
                "metrics_results": [],
                "overall_assessment": "전체 1개 메트릭 중 1개 유의 (100.0%), 1개 임상적 유의 (100.0%). 종합 평가: 매우 좋음",
                "confidence_level": 0.95,
                "timestamp": "2024-12-01T10:00:00",
                "total_metrics": 1,
                "significant_metrics": 1,
                "clinically_significant_metrics": 1
            }
        }
    )

class StatisticalAnalysisRequest(BaseModel):
    """통계 분석 요청 모델"""
    period_n_data: Dict[str, Any] = Field(..., description="현재 기간 데이터")
    period_n1_data: Dict[str, Any] = Field(..., description="이전 기간 데이터")
    metrics: Optional[List[str]] = Field(None, description="분석할 메트릭 리스트")
    config: Optional[Dict[str, Any]] = Field(None, description="통계 분석 엔진 설정")
    test_types: Optional[List[str]] = Field(None, description="사용자 지정 검정 유형")
    use_recommended_tests: bool = Field(True, description="권장 검정 사용 여부")
    include_comprehensive_analysis: bool = Field(True, description="종합 분석 포함 여부")
    confidence_level: float = Field(0.95, description="신뢰구간 신뢰수준")
    
    @validator('confidence_level')
    def validate_confidence_level(cls, v):
        """신뢰수준 검증"""
        if not 0 < v < 1:
            raise ValueError('신뢰수준은 0과 1 사이의 값이어야 합니다')
        return v
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "period_n_data": {"timestamp": ["2024-01-01T10:00:00"], "throughput": [150.5]},
                "period_n1_data": {"timestamp": ["2024-01-02T10:00:00"], "throughput": [100.3]},
                "metrics": ["throughput", "latency"],
                "use_recommended_tests": True,
                "include_comprehensive_analysis": True,
                "confidence_level": 0.95
            }
        }
    )

class StatisticalAnalysisTask(BaseModel):
    """통계 분석 작업 모델"""
    task_id: str = Field(..., description="작업 ID")
    request: StatisticalAnalysisRequest = Field(..., description="분석 요청")
    status: str = Field(..., description="작업 상태")
    created_at: datetime = Field(..., description="생성 시간")
    started_at: Optional[datetime] = Field(None, description="시작 시간")
    completed_at: Optional[datetime] = Field(None, description="완료 시간")
    result: Optional[ComprehensiveAnalysisResult] = Field(None, description="분석 결과")
    error: Optional[str] = Field(None, description="오류 메시지")
    progress: Optional[int] = Field(None, description="진행률")
    current_step: Optional[str] = Field(None, description="현재 단계")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "task_id": "task_20241201_001",
                "request": {
                    "period_n_data": {"timestamp": ["2024-01-01T10:00:00"], "throughput": [150.5]},
                    "period_n1_data": {"timestamp": ["2024-01-02T10:00:00"], "throughput": [100.3]},
                    "metrics": ["throughput"],
                    "use_recommended_tests": True,
                    "include_comprehensive_analysis": True,
                    "confidence_level": 0.95
                },
                "status": "RUNNING",
                "created_at": "2024-12-01T10:00:00",
                "progress": 50,
                "current_step": "통계 비교 분석 수행"
            }
        }
    )

class IntegratedAnalysisReport(BaseModel):
    """통합 분석 보고서 모델"""
    analysis_id: str = Field(..., description="분석 ID")
    summary_statistics: Dict[str, Any] = Field(..., description="요약 통계")
    overall_pass_fail: str = Field(..., description="전체 Pass/Fail 판정")
    recommendations: List[str] = Field(..., description="권장사항")
    risk_assessment: str = Field(..., description="위험도 평가")
    generated_at: datetime = Field(..., description="생성 시간")
    report_format: str = Field(..., description="보고서 형식")
    
    # JSON 형태의 구조화된 결과
    json_report: Dict[str, Any] = Field(..., description="JSON 형태 보고서")
    
    # 사람이 읽기 쉬운 텍스트 보고서
    text_report: str = Field(..., description="텍스트 형태 보고서")
    
    # 시각화 데이터 (선택사항)
    visualization_data: Optional[Dict[str, Any]] = Field(None, description="시각화 데이터")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "analysis_id": "stat_analysis_20241201_001",
                "summary_statistics": {
                    "total_metrics": 3,
                    "significant_metrics": 2,
                    "clinically_significant_metrics": 1,
                    "pass_rate": 66.7
                },
                "overall_pass_fail": "PASS",
                "recommendations": ["개선 조치 권장", "지속적 모니터링 필요"],
                "risk_assessment": "낮음",
                "generated_at": "2024-12-01T10:00:00",
                "report_format": "both",
                "json_report": {},
                "text_report": "통계 분석 보고서..."
            }
        }
    )
