"""
LLM 분석 결과 모델 정의

이 모듈은 LLM 분석 결과의 저장, 조회, 관리를 위한 
Pydantic 모델들을 정의합니다.
"""

import logging
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from .common import PyObjectId

# 로깅 설정
logger = logging.getLogger(__name__)


class AnalysisDetail(BaseModel):
    """
    개별 KPI 분석 결과 상세 정보
    
    각 KPI에 대한 분석값, 임계값, 상태 등을 포함합니다.
    """
    kpi_name: Optional[str] = Field(None, description="KPI 이름 (예: RACH Success Rate)")  # ✅ LLM 분석용 Optional
    value: Optional[float] = Field(None, description="측정된 KPI 값")                    # ✅ LLM 분석용 Optional
    threshold: Optional[float] = Field(None, description="임계값 (설정된 경우)")
    status: str = Field(default="normal", description="상태 (normal, warning, critical)")
    unit: Optional[str] = Field(None, description="측정 단위 (%, dB, count 등)")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "kpi_name": "RACH Success Rate",
                "value": 98.5,
                "threshold": 95.0,
                "status": "normal",
                "unit": "%"
            }
        }
    )


class StatDetail(BaseModel):
    """
    통계 분석 결과 상세 정보
    
    특정 기간에 대한 KPI의 통계값들을 포함합니다.
    """
    period: str = Field(..., description="분석 기간 (예: N-1, N)")
    kpi_name: str = Field(..., description="KPI 이름")
    avg: Optional[float] = Field(None, description="평균값")
    std: Optional[float] = Field(None, description="표준편차")
    min: Optional[float] = Field(None, description="최솟값")
    max: Optional[float] = Field(None, description="최댓값")
    count: Optional[int] = Field(None, description="데이터 개수")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "period": "N-1",
                "kpi_name": "RACH Success Rate",
                "avg": 97.8,
                "std": 1.2,
                "min": 95.0,
                "max": 99.5,
                "count": 144
            }
        }
    )


class AnalysisMetadata(BaseModel):
    """
    분석 메타데이터
    
    분석 과정에서 생성되는 추가 정보들을 포함합니다.
    """
    created_at: datetime = Field(default_factory=datetime.utcnow, description="생성 시간")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="수정 시간")
    created_by: Optional[str] = Field(None, description="생성자")
    analysis_type: str = Field(default="llm_analysis", description="분석 유형")
    version: str = Field(default="1.0", description="분석 버전")
    processing_time: Optional[float] = Field(None, description="처리 시간 (초)")


class AnalysisResultBase(BaseModel):
    """
    분석 결과 기본 모델
    
    생성과 응답에서 공통으로 사용되는 필드들을 정의합니다.
    """
    analysis_date: datetime = Field(
        default_factory=datetime.utcnow,
        description="분석 기준 날짜",
        alias="analysisDate"
    )
    # LLM 분석의 경우 ne_id, cell_id가 없을 수 있으므로 Optional로 변경
    ne_id: Optional[str] = Field(None, description="Network Element ID", alias="neId")
    cell_id: Optional[str] = Field(None, description="Cell ID", alias="cellId")
    results: List[AnalysisDetail] = Field(
        default_factory=list,
        description="KPI별 분석 결과 목록"
    )
    stats: List[StatDetail] = Field(
        default_factory=list,
        description="통계 분석 결과 목록"
    )
    status: str = Field(default="success", description="분석 상태")
    report_path: Optional[str] = Field(None, description="보고서 파일 경로")
    metadata: AnalysisMetadata = Field(
        default_factory=AnalysisMetadata,
        description="분석 메타데이터"
    )
    
    # LLM 분석 관련 필드 추가
    analysis_id: Optional[str] = Field(None, description="분석 고유 ID")
    analysis_type: str = Field(default="standard", description="분석 유형 (standard, llm_analysis)")
    request_params: Optional[Dict[str, Any]] = Field(None, description="요청 파라미터")
    completed_at: Optional[datetime] = Field(None, description="완료 시간")
    error_message: Optional[str] = Field(None, description="오류 메시지")
    
    # 기존 필드와의 호환성을 위해 유지
    analysis: Optional[Dict[str, Any]] = Field(
        None,
        description="레거시 분석 데이터 (호환성 유지용)"
    )
    
    model_config = ConfigDict(
        populate_by_name=True,  # alias와 원본 필드명 모두 허용
        json_encoders={
            datetime: lambda v: v.isoformat(),
            PyObjectId: lambda v: str(v)
        }
    )


class AnalysisResultCreate(AnalysisResultBase):
    """
    분석 결과 생성 요청 모델
    
    새로운 분석 결과를 생성할 때 사용됩니다.
    """
    pass


class AnalysisResultUpdate(BaseModel):
    """
    분석 결과 업데이트 요청 모델
    
    기존 분석 결과를 수정할 때 사용됩니다.
    """
    analysis_date: Optional[datetime] = Field(None, alias="analysisDate")
    ne_id: Optional[str] = Field(None, alias="neId") 
    cell_id: Optional[str] = Field(None, alias="cellId")
    results: Optional[List[AnalysisDetail]] = None
    stats: Optional[List[StatDetail]] = None
    status: Optional[str] = None
    report_path: Optional[str] = None
    analysis: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(populate_by_name=True)


class AnalysisResultModel(AnalysisResultBase):
    """
    분석 결과 응답 모델
    
    데이터베이스에서 조회된 분석 결과를 반환할 때 사용됩니다.
    """
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    
    @classmethod
    def from_mongo(cls, data: dict):
        """
        MongoDB 문서를 AnalysisResultModel로 변환
        
        Args:
            data: MongoDB에서 조회된 문서
            
        Returns:
            AnalysisResultModel: 변환된 모델 인스턴스
        """
        if not data:
            return None
        
        # _id를 id로 변환
        if "_id" in data:
            data["id"] = data["_id"]
            
        # metadata 처리 - 없으면 기본값 생성
        if "metadata" not in data:
            data["metadata"] = AnalysisMetadata().model_dump()
            
        return cls(**data)


class AnalysisResultSummary(BaseModel):
    """
    분석 결과 요약 모델
    
    목록 조회 시 사용되는 간소화된 모델입니다.
    LLM 분석의 경우 ne_id, cell_id가 없을 수 있으므로 Optional로 처리합니다.
    """
    id: str = Field(alias="_id")  # ✅ PyObjectId → str 변경
    analysis_date: datetime = Field(alias="analysisDate")
    ne_id: Optional[str] = Field(None, alias="neId")  # ✅ Optional로 변경
    cell_id: Optional[str] = Field(None, alias="cellId")  # ✅ Optional로 변경
    status: str
    results_count: int = Field(0, description="분석 결과 개수")
    analysis_type: Optional[str] = Field(None, description="분석 유형 (standard, llm_analysis)")  # ✅ 추가
    
    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )


class AnalysisResultFilter(BaseModel):
    """
    분석 결과 필터링 모델
    
    검색 및 필터링 파라미터를 정의합니다.
    """
    ne_id: Optional[str] = Field(None, alias="neId", description="Network Element ID로 필터링")
    cell_id: Optional[str] = Field(None, alias="cellId", description="Cell ID로 필터링")
    status: Optional[str] = Field(None, description="상태로 필터링")
    date_from: Optional[datetime] = Field(None, description="시작 날짜")
    date_to: Optional[datetime] = Field(None, description="종료 날짜")
    analysis_type: Optional[str] = Field(None, description="분석 유형으로 필터링")
    
    model_config = ConfigDict(populate_by_name=True)


# 응답 모델들
class AnalysisResultListResponse(BaseModel):
    """분석 결과 목록 응답"""
    items: List[Dict[str, Any]]  # ✅ Pydantic 모델 대신 Dict 사용
    total: int
    page: int
    size: int
    has_next: bool


class AnalysisResultResponse(BaseModel):
    """단일 분석 결과 응답"""
    success: bool = True
    message: str = "Analysis result retrieved successfully"
    data: AnalysisResultModel


class AnalysisResultCreateResponse(BaseModel):
    """분석 결과 생성 응답"""
    success: bool = True
    message: str = "Analysis result created successfully"
    data: AnalysisResultModel

