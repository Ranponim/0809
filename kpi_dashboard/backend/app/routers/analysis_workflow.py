"""
분석 워크플로우 API 라우터

작업 1: System Architecture & Asynchronous Workflow Setup
기본 /analyze 엔드포인트와 작업 상태 조회 엔드포인트를 구현합니다.
"""

import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from datetime import datetime

from ..tasks import analyze_kpi_data, get_analysis_status
from ..celery_app import celery_app

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analyze", tags=["Analysis Workflow"])

class AnalysisRequest(BaseModel):
    """분석 요청 모델"""
    start_date: str
    end_date: str
    analysis_type: str = "kpi_comparison"
    parameters: Dict[str, Any] = {}

class AnalysisResponse(BaseModel):
    """분석 응답 모델"""
    task_id: str
    status: str
    message: str
    timestamp: datetime

class TaskStatusResponse(BaseModel):
    """작업 상태 응답 모델"""
    task_id: str
    status: str
    progress: int = 0
    current_step: str = ""
    result: Dict[str, Any] = None
    error: str = None
    timestamp: datetime

@router.post("/", response_model=AnalysisResponse, summary="분석 요청")
async def start_analysis(request: AnalysisRequest):
    """
    분석 작업을 시작합니다.
    
    분석 요청을 받아 Celery 작업을 큐에 추가하고 작업 ID를 반환합니다.
    """
    try:
        logger.info(f"분석 요청 수신: {request.start_date} ~ {request.end_date}")
        
        # 분석 요청 데이터 준비
        analysis_data = {
            "start_date": request.start_date,
            "end_date": request.end_date,
            "analysis_type": request.analysis_type,
            "parameters": request.parameters,
            "requested_at": datetime.now().isoformat()
        }
        
        # Celery 작업 시작
        task = analyze_kpi_data.delay(analysis_data)
        
        logger.info(f"분석 작업 시작됨: {task.id}")
        
        return AnalysisResponse(
            task_id=task.id,
            status="PENDING",
            message="분석 작업이 시작되었습니다.",
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"분석 요청 처리 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"분석 작업 시작 실패: {str(e)}"
        )

@router.get("/{task_id}/status", response_model=TaskStatusResponse, summary="작업 상태 조회")
async def get_task_status(task_id: str):
    """
    분석 작업의 상태를 조회합니다.
    
    작업 ID를 받아 현재 상태, 진행률, 결과를 반환합니다.
    """
    try:
        logger.info(f"작업 상태 조회: {task_id}")
        
        # Celery 작업 상태 조회
        task_result = celery_app.AsyncResult(task_id)
        
        # 기본 응답 데이터
        response_data = {
            "task_id": task_id,
            "status": task_result.status,
            "timestamp": datetime.now()
        }
        
        # 작업 상태에 따른 추가 정보
        if task_result.status == "PENDING":
            response_data.update({
                "progress": 0,
                "current_step": "대기 중"
            })
        elif task_result.status == "RUNNING":
            # 진행 중인 경우 메타데이터에서 진행률 정보 추출
            meta = task_result.info or {}
            response_data.update({
                "progress": meta.get("progress", 0),
                "current_step": meta.get("current_step", "처리 중")
            })
        elif task_result.status == "SUCCESS":
            # 성공한 경우 결과 포함
            result = task_result.result or {}
            response_data.update({
                "progress": 100,
                "current_step": "완료",
                "result": result
            })
        elif task_result.status == "FAILURE":
            # 실패한 경우 오류 정보 포함
            response_data.update({
                "progress": 0,
                "current_step": "실패",
                "error": str(task_result.info) if task_result.info else "알 수 없는 오류"
            })
        
        logger.info(f"작업 상태 조회 완료: {task_id}, 상태: {task_result.status}")
        
        return TaskStatusResponse(**response_data)
        
    except Exception as e:
        logger.error(f"작업 상태 조회 실패: {task_id}, 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"작업 상태 조회 실패: {str(e)}"
        )

@router.get("/{task_id}/result", summary="분석 결과 조회")
async def get_analysis_result(task_id: str):
    """
    완료된 분석 작업의 결과를 조회합니다.
    
    작업이 성공적으로 완료된 경우에만 결과를 반환합니다.
    """
    try:
        logger.info(f"분석 결과 조회: {task_id}")
        
        # Celery 작업 상태 조회
        task_result = celery_app.AsyncResult(task_id)
        
        if not task_result.ready():
            raise HTTPException(
                status_code=202,
                detail="작업이 아직 완료되지 않았습니다."
            )
        
        if task_result.failed():
            raise HTTPException(
                status_code=500,
                detail=f"작업 실패: {str(task_result.info)}"
            )
        
        # 성공한 경우 결과 반환
        result = task_result.result
        logger.info(f"분석 결과 조회 완료: {task_id}")
        
        return {
            "task_id": task_id,
            "status": "SUCCESS",
            "result": result,
            "timestamp": datetime.now()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"분석 결과 조회 실패: {task_id}, 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"분석 결과 조회 실패: {str(e)}"
        )

@router.delete("/{task_id}", summary="작업 취소")
async def cancel_analysis_task(task_id: str):
    """
    진행 중인 분석 작업을 취소합니다.
    """
    try:
        logger.info(f"작업 취소 요청: {task_id}")
        
        # Celery 작업 취소
        celery_app.control.revoke(task_id, terminate=True)
        
        logger.info(f"작업 취소 완료: {task_id}")
        
        return {
            "task_id": task_id,
            "status": "CANCELLED",
            "message": "작업이 취소되었습니다.",
            "timestamp": datetime.now()
        }
        
    except Exception as e:
        logger.error(f"작업 취소 실패: {task_id}, 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"작업 취소 실패: {str(e)}"
        )
