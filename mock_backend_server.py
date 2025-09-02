#!/usr/bin/env python3
"""
=====================================================================================
간단한 Mock 백엔드 서버 - Payload 구조 검증용
=====================================================================================

이 서버는 analysis_llm.py의 payload 구조를 검증하기 위한 목적으로 만들어졌습니다.
실제 백엔드 API의 동작을 모방하여 payload를 받아들이고 검증합니다.
"""

import json
import logging
from typing import Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
import uvicorn

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# FastAPI 앱 생성
app = FastAPI(
    title="Mock Analysis Backend",
    description="Payload 구조 검증을 위한 Mock 백엔드 서버",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mock 모델들 (실제 백엔드 모델과 유사하게)
class StatDetail(BaseModel):
    period: str
    kpi_name: str
    avg: float = None
    std: float = None
    min: float = None
    max: float = None
    count: int = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "period": "N-1",
                "kpi_name": "Random_access_preamble_count",
                "avg": 1250.5,
                "std": 45.2,
                "min": 1100.0,
                "max": 1400.0,
                "count": 1440
            }
        }
    )


class AnalysisResultCreate(BaseModel):
    analysis_type: str = Field(default="llm_analysis")
    analysis_date: datetime = Field(alias="analysisDate")
    ne_id: str = Field(None, alias="neId")
    cell_id: str = Field(None, alias="cellId")
    status: str = Field(default="success")
    report_path: str = Field(None)
    results: list = Field(default_factory=list)
    stats: list[StatDetail] = Field(default_factory=list)
    analysis: dict = Field(None)
    results_overview: dict = Field(None, alias="resultsOverview")
    analysis_raw_compact: dict = Field(None, alias="analysisRawCompact")
    request_params: dict = Field(None)

    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={
            datetime: lambda v: v.isoformat(),
        }
    )


class AnalysisResultResponse(BaseModel):
    success: bool = True
    message: str = "Analysis result created successfully"
    data: dict


@app.get("/")
async def root():
    """서버 상태 확인"""
    return {
        "status": "running",
        "message": "Mock Analysis Backend Server is running",
        "version": "1.0.0"
    }


@app.post("/api/analysis/results/", response_model=AnalysisResultResponse)
async def create_analysis_result(request: Request):
    """
    분석 결과 생성 (Mock)

    실제 백엔드 API를 모방하여 payload를 받아들이고 검증합니다.
    """
    try:
        # 요청 본문 로깅
        body = await request.body()
        logger.info(f"요청 본문 크기: {len(body)} bytes")

        # JSON 파싱
        try:
            payload = json.loads(body)
            logger.info("✅ JSON 파싱 성공")
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON 파싱 실패: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

        # 필수 필드 검증
        required_fields = ["analysis_type", "analysisDate", "status"]
        missing_fields = [field for field in required_fields if field not in payload]
        if missing_fields:
            logger.error(f"❌ 필수 필드 누락: {missing_fields}")
            raise HTTPException(
                status_code=422,
                detail=f"Missing required fields: {missing_fields}"
            )

        # 구조 검증 로깅
        logger.info("=== Payload 구조 분석 ===")
        logger.info(f"analysis_type: {payload.get('analysis_type')}")
        logger.info(f"analysisDate: {payload.get('analysisDate')}")
        logger.info(f"neId: {payload.get('neId')}")
        logger.info(f"cellId: {payload.get('cellId')}")
        logger.info(f"status: {payload.get('status')}")
        logger.info(f"results 개수: {len(payload.get('results', []))}")
        logger.info(f"stats 개수: {len(payload.get('stats', []))}")

        # stats 구조 검증
        if 'stats' in payload:
            for i, stat in enumerate(payload['stats']):
                logger.info(f"stats[{i}]: period={stat.get('period')}, kpi_name={stat.get('kpi_name')}, avg={stat.get('avg')}")

        # Pydantic 모델로 검증 시도
        try:
            # payload를 Pydantic 모델로 변환하여 검증
            result_model = AnalysisResultCreate(**payload)
            logger.info("✅ Pydantic 모델 검증 성공")

            # 변환된 모델을 dict로 변환
            result_dict = result_model.model_dump(by_alias=True)

        except Exception as e:
            logger.error(f"❌ Pydantic 모델 검증 실패: {e}")
            # 검증 실패해도 계속 진행 (호환성 테스트용)
            result_dict = payload

        # Mock 응답 생성
        mock_response = {
            "_id": "507f1f77bcf86cd799439011",  # Mock ObjectId
            "analysis_type": payload.get("analysis_type"),
            "analysis_date": payload.get("analysisDate"),
            "ne_id": payload.get("neId"),
            "cell_id": payload.get("cellId"),
            "status": payload.get("status"),
            "report_path": payload.get("report_path"),
            "results": payload.get("results", []),
            "stats": payload.get("stats", []),
            "analysis": payload.get("analysis"),
            "results_overview": payload.get("resultsOverview"),
            "analysis_raw_compact": payload.get("analysisRawCompact"),
            "request_params": payload.get("request_params"),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        logger.info("✅ 분석 결과 생성 성공")

        return AnalysisResultResponse(
            success=True,
            message="Analysis result created successfully (Mock)",
            data=mock_response
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 예상치 못한 오류: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/api/analysis/results/")
async def list_analysis_results():
    """분석 결과 목록 조회 (Mock)"""
    return {
        "items": [
            {
                "id": "507f1f77bcf86cd799439011",
                "analysisDate": "2025-09-02T07:58:46.914860+09:00",
                "neId": "nvgnb#10000",
                "cellId": "2010",
                "status": "success",
                "results_count": 4,
                "analysis_type": "llm_analysis"
            }
        ],
        "total": 1,
        "page": 1,
        "size": 20,
        "has_next": False
    }


if __name__ == "__main__":
    logger.info("=== Mock Analysis Backend Server 시작 ===")
    logger.info("서버 주소: http://localhost:8000")
    logger.info("API 엔드포인트: POST /api/analysis/results/")

    uvicorn.run(
        app,
        host="localhost",
        port=8000,
        log_level="info"
    )


