"""
Test-related API endpoints
"""
from fastapi import APIRouter
from .. import tasks

router = APIRouter()

@router.post("/api/test-celery-task", summary="테스트 Celery 작업 실행", tags=["Test"])
async def test_celery_task():
    """
    간단한 Celery 작업을 비동기적으로 실행하고 작업 ID를 반환합니다.
    """
    task = tasks.add_together.delay(2, 3)
    return {"message": "Celery 작업이 시작되었습니다.", "task_id": task.id}

@router.post("/api/test-endpoint", summary="테스트 엔드포인트", tags=["Test"])
async def test_endpoint():
    """
    간단한 테스트 엔드포인트
    """
    return {"message": "Test endpoint works!", "status": "success"}

@router.get("/api/test-endpoint", summary="테스트 엔드포인트 GET", tags=["Test"])
async def test_endpoint_get():
    """
    간단한 테스트 엔드포인트 (GET)
    """
    return {"message": "Test endpoint GET works!", "status": "success"}
