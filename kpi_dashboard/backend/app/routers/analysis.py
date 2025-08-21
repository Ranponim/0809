"""
분석 결과 API 라우터

이 모듈은 LLM 분석 결과의 CRUD 작업을 위한 API 엔드포인트들을 정의합니다.
Task 39: Backend LLM 분석 결과 API 및 DB 스키마 구현
"""

import logging
from fastapi import APIRouter, Body, HTTPException, status, Query, Depends
from typing import List, Optional
from datetime import datetime
from pymongo.errors import DuplicateKeyError, PyMongoError
from bson import BSON

from ..db import get_analysis_collection
from ..models.analysis import (
    AnalysisResultModel,
    AnalysisResultCreate,
    AnalysisResultUpdate,
    AnalysisResultSummary,
    AnalysisResultFilter,
    AnalysisResultListResponse,
    AnalysisResultResponse,
    AnalysisResultCreateResponse
)
from ..models.common import PyObjectId
from ..exceptions import (
    AnalysisResultNotFoundException,
    InvalidAnalysisDataException,
    DatabaseConnectionException,
    DuplicateAnalysisResultException
)

# 로깅 설정
logger = logging.getLogger(__name__)

# 라우터 생성
router = APIRouter(
    prefix="/api/analysis/results",
    tags=["Analysis Results"],
    responses={
        400: {"description": "Bad Request"},
        404: {"description": "Not Found"},
        422: {"description": "Validation Error"},
        500: {"description": "Internal Server Error"}
    }
)


def _normalize_legacy_keys(doc: dict) -> dict:
    """레거시 camelCase 문서를 snake_case 우선 형태로 정규화합니다."""
    if not isinstance(doc, dict):
        return doc
    mapping = {
        "analysisDate": "analysis_date",
        "neId": "ne_id",
        "cellId": "cell_id",
        "analysisType": "analysis_type",
        "resultsOverview": "results_overview",
        "analysisRawCompact": "analysis_raw_compact",
        "reportPath": "report_path",
        "requestParams": "request_params",
    }
    for old_key, new_key in mapping.items():
        if new_key not in doc and old_key in doc:
            doc[new_key] = doc[old_key]
    return doc


@router.post(
    "/",
    response_model=AnalysisResultCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="분석 결과 생성",
    description="새로운 LLM 분석 결과를 생성합니다."
)
async def create_analysis_result(
    result: AnalysisResultCreate = Body(
        ...,
        example={
            "ne_id": "eNB001",
            "cell_id": "CELL001",
            "analysis_date": "2025-08-14T10:00:00Z",
            "results": [
                {
                    "kpi_name": "RACH Success Rate",
                    "value": 98.5,
                    "threshold": 95.0,
                    "status": "normal",
                    "unit": "%"
                }
            ],
            "status": "success"
        }
    )
):
    """
    새로운 LLM 분석 결과를 생성합니다.
    
    - **ne_id**: 네트워크 장비 ID (예: eNB001)
    - **cell_id**: 셀 ID (예: CELL001)  
    - **analysis_date**: 분석 기준 날짜 (ISO 8601 형식)
    - **results**: KPI별 분석 결과 목록
    - **stats**: 통계 분석 결과 목록 (선택사항)
    - **status**: 분석 상태 (success, warning, error)
    """
    try:
        collection = get_analysis_collection()
        
        # 데이터 준비: DB에는 snake_case 필드명으로 저장 (v2 표준 키)
        # by_alias=False로 덤프하여 camelCase alias가 아닌 원 필드명으로 저장한다
        result_dict = result.model_dump(by_alias=False, exclude_unset=True)

        # MongoDB 문서 크기(16MB) 체크
        try:
            encoded = BSON.encode(result_dict)
            doc_size = len(encoded)
            max_size = 16 * 1024 * 1024
            warn_size = 12 * 1024 * 1024
            if doc_size > max_size:
                logger.error(f"문서 크기 초과: size={doc_size}B > 16MB")
                raise InvalidAnalysisDataException(
                    f"Document too large to store ({doc_size} bytes). Please reduce payload."
                )
            if doc_size > warn_size:
                logger.warning(f"문서 크기 경고: size={doc_size}B > 12MB, 축약 필요 가능")
        except Exception as e:
            logger.warning(f"문서 크기 체크 실패(계속 진행): {e}")
        
        # metadata 업데이트
        if "metadata" in result_dict:
            result_dict["metadata"]["created_at"] = datetime.utcnow()
            result_dict["metadata"]["updated_at"] = datetime.utcnow()
        
        logger.info(f"새 분석 결과 생성 시도: NE={result.ne_id}, Cell={result.cell_id}")
        
        # 중복 검사 (같은 NE, Cell, 날짜에 대한 분석 결과가 이미 있는지 확인)
        existing = await collection.find_one({
            "ne_id": result.ne_id,
            "cell_id": result.cell_id,
            "analysis_date": result.analysis_date
        })
        
        if existing:
            raise DuplicateAnalysisResultException(
                ne_id=result.ne_id,
                cell_id=result.cell_id,
                analysis_date=result.analysis_date.isoformat()
            )
        
        # 문서 삽입
        insert_result = await collection.insert_one(result_dict)
        
        # 생성된 문서 조회
        created_result = await collection.find_one({"_id": insert_result.inserted_id})
        
        if not created_result:
            raise DatabaseConnectionException("Failed to retrieve created analysis result")
        
        # 응답 모델로 변환
        analysis_model = AnalysisResultModel.from_mongo(created_result)
        
        logger.info(f"분석 결과 생성 성공: ID={insert_result.inserted_id}")
        
        return AnalysisResultCreateResponse(
            message="Analysis result created successfully",
            data=analysis_model
        )
        
    except (DuplicateAnalysisResultException, DatabaseConnectionException) as e:
        # 이미 정의된 커스텀 예외는 그대로 전파
        raise e
        
    except PyMongoError as e:
        logger.error(f"MongoDB 오류: {e}")
        raise DatabaseConnectionException(f"Database operation failed: {str(e)}")
        
    except Exception as e:
        logger.error(f"분석 결과 생성 중 예상치 못한 오류: {e}")
        raise InvalidAnalysisDataException(f"Failed to create analysis result: {str(e)}")


@router.get(
    "/",
    response_model=AnalysisResultListResponse,
    summary="분석 결과 목록 조회",
    description="분석 결과 목록을 조회합니다. 페이지네이션과 필터링을 지원합니다."
)
async def list_analysis_results(
    page: int = Query(1, ge=1, description="페이지 번호 (1부터 시작)"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기 (1-100)"),
    ne_id: Optional[str] = Query(None, description="Network Element ID로 필터링"),
    cell_id: Optional[str] = Query(None, description="Cell ID로 필터링"),
    status: Optional[str] = Query(None, description="상태로 필터링 (success, warning, error)"),
    date_from: Optional[datetime] = Query(None, description="시작 날짜 (ISO 8601 형식)"),
    date_to: Optional[datetime] = Query(None, description="종료 날짜 (ISO 8601 형식)")
):
    """
    분석 결과 목록을 조회합니다.
    
    페이지네이션을 지원하며, 다양한 조건으로 필터링할 수 있습니다.
    결과는 분석 날짜 기준 내림차순으로 정렬됩니다.
    """
    try:
        collection = get_analysis_collection()
        
        # 필터 조건 구성
        filter_dict = {}
        
        if ne_id:
            filter_dict["ne_id"] = ne_id
        if cell_id:
            filter_dict["cell_id"] = cell_id
        if status:
            filter_dict["status"] = status
        if date_from or date_to:
            filter_dict["analysis_date"] = {}
            if date_from:
                filter_dict["analysis_date"]["$gte"] = date_from
            if date_to:
                filter_dict["analysis_date"]["$lte"] = date_to
        
        logger.info(f"분석 결과 목록 조회: page={page}, size={size}, filters={filter_dict}")
        
        # 전체 개수 조회
        total_count = await collection.count_documents(filter_dict)
        
        # 페이지네이션 계산
        skip = (page - 1) * size
        has_next = (skip + size) < total_count
        
        # 데이터 조회 (요약 정보만)
        # 기존 camelCase 저장 레거시 문서와 호환을 위해 양쪽 키를 모두 조회
        projection = {
            "_id": 1,
            "analysis_date": 1,
            "analysisDate": 1,
            "ne_id": 1,
            "neId": 1,
            "cell_id": 1,
            "cellId": 1,
            "status": 1,
            "results": 1,
            "analysis_type": 1,
            "analysisType": 1,
            # include overview by default, exclude raw compact
            "results_overview": 1,
            "resultsOverview": 1,
        }
        
        cursor = collection.find(filter_dict, projection)
        cursor = cursor.sort("analysis_date", -1).skip(skip).limit(size)
        
        documents = await cursor.to_list(length=size)
        
        # 응답 데이터 직접 구성 (Pydantic alias 문제 우회)
        items = []
        for doc in documents:
            # results_count 계산
            results_count = len(doc.get("results", []))

            # 레거시 호환: snake_case 우선, 없으면 camelCase 폴백
            analysis_date_val = doc.get("analysis_date") or doc.get("analysisDate")
            ne_id_val = doc.get("ne_id") or doc.get("neId")
            cell_id_val = doc.get("cell_id") or doc.get("cellId")
            analysis_type_val = doc.get("analysis_type") or doc.get("analysisType")

            # 직접 dict로 구성 (FastAPI가 JSON 직렬화 시 필드명 사용)
            item_dict = {
                "id": str(doc["_id"]),  # ✅ _id → id로 변환
                "analysisDate": analysis_date_val.isoformat() if analysis_date_val else None,
                "neId": ne_id_val,
                "cellId": cell_id_val,
                "status": doc.get("status"),
                "results_count": results_count,
                "analysis_type": analysis_type_val,
                "results_overview": doc.get("results_overview") or doc.get("resultsOverview"),
            }
            
            items.append(item_dict)
        
        logger.info(f"분석 결과 목록 조회 완료: {len(items)}개 항목")
        
        return AnalysisResultListResponse(
            items=items,
            total=total_count,
            page=page,
            size=size,
            has_next=has_next
        )
        
    except PyMongoError as e:
        logger.error(f"MongoDB 오류: {e}")
        raise DatabaseConnectionException(f"Database query failed: {str(e)}")
        
    except Exception as e:
        logger.error(f"분석 결과 목록 조회 중 오류: {e}")
        raise DatabaseConnectionException(f"Failed to retrieve analysis results: {str(e)}")


@router.get(
    "/{result_id}",
    response_model=AnalysisResultResponse,
    summary="분석 결과 상세 조회",
    description="특정 ID의 분석 결과를 상세 조회합니다."
)
async def get_analysis_result(result_id: PyObjectId, includeRaw: bool = Query(False, description="압축 원본(analysis_raw_compact) 포함 여부")):
    """
    특정 ID의 분석 결과를 상세 조회합니다.
    
    - **result_id**: 조회할 분석 결과의 ObjectId
    """
    try:
        collection = get_analysis_collection()
        
        logger.info(f"분석 결과 상세 조회: ID={result_id}")
        
        # 문서 조회
        document = await collection.find_one({"_id": result_id})
        
        if not document:
            raise AnalysisResultNotFoundException(str(result_id))
        
        # 레거시 키 정규화 (camelCase → snake_case 우선)
        document = _normalize_legacy_keys(document)

        # includeRaw=false인 경우 압축 원본 제외하여 경량 응답 (두 케이스 모두 제거)
        if not includeRaw:
            document.pop("analysis_raw_compact", None)
            document.pop("analysisRawCompact", None)
        
        # 응답 모델로 변환
        analysis_model = AnalysisResultModel.from_mongo(document)
        
        logger.info(f"분석 결과 상세 조회 완료: ID={result_id}")
        
        return AnalysisResultResponse(
            message="Analysis result retrieved successfully",
            data=analysis_model
        )
        
    except AnalysisResultNotFoundException:
        # 이미 정의된 예외는 그대로 전파
        raise
        
    except PyMongoError as e:
        logger.error(f"MongoDB 오류: {e}")
        raise DatabaseConnectionException(f"Database query failed: {str(e)}")
        
    except Exception as e:
        logger.error(f"분석 결과 조회 중 오류: {e}")
        raise DatabaseConnectionException(f"Failed to retrieve analysis result: {str(e)}")


@router.put(
    "/{result_id}",
    response_model=AnalysisResultResponse,
    summary="분석 결과 수정",
    description="특정 ID의 분석 결과를 수정합니다."
)
async def update_analysis_result(
    result_id: PyObjectId,
    update_data: AnalysisResultUpdate = Body(...)
):
    """
    특정 ID의 분석 결과를 수정합니다.
    
    - **result_id**: 수정할 분석 결과의 ObjectId
    - **update_data**: 수정할 데이터 (일부 필드만 포함 가능)
    """
    try:
        collection = get_analysis_collection()
        
        logger.info(f"분석 결과 수정 시도: ID={result_id}")
        
        # 기존 문서 존재 확인
        existing = await collection.find_one({"_id": result_id})
        if not existing:
            raise AnalysisResultNotFoundException(str(result_id))
        
        # 수정 데이터 준비
        update_dict = update_data.model_dump(by_alias=True, exclude_unset=True)
        
        if update_dict:
            # metadata 업데이트
            update_dict["metadata.updated_at"] = datetime.utcnow()
            
            # 문서 업데이트
            await collection.update_one(
                {"_id": result_id},
                {"$set": update_dict}
            )
            
            logger.info(f"분석 결과 수정 완료: ID={result_id}")
        
        # 수정된 문서 조회
        updated_document = await collection.find_one({"_id": result_id})
        analysis_model = AnalysisResultModel.from_mongo(updated_document)
        
        return AnalysisResultResponse(
            message="Analysis result updated successfully",
            data=analysis_model
        )
        
    except AnalysisResultNotFoundException:
        raise
        
    except PyMongoError as e:
        logger.error(f"MongoDB 오류: {e}")
        raise DatabaseConnectionException(f"Database update failed: {str(e)}")
        
    except Exception as e:
        logger.error(f"분석 결과 수정 중 오류: {e}")
        raise InvalidAnalysisDataException(f"Failed to update analysis result: {str(e)}")


@router.delete(
    "/{result_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="분석 결과 삭제",
    description="특정 ID의 분석 결과를 삭제합니다."
)
async def delete_analysis_result(result_id: PyObjectId):
    """
    특정 ID의 분석 결과를 삭제합니다.
    
    - **result_id**: 삭제할 분석 결과의 ObjectId
    """
    try:
        collection = get_analysis_collection()
        
        logger.info(f"분석 결과 삭제 시도: ID={result_id}")
        
        # 문서 삭제
        delete_result = await collection.delete_one({"_id": result_id})
        
        if delete_result.deleted_count == 0:
            raise AnalysisResultNotFoundException(str(result_id))
        
        logger.info(f"분석 결과 삭제 완료: ID={result_id}")
        
        # 204 No Content 응답 (body 없음)
        return
        
    except AnalysisResultNotFoundException:
        raise
        
    except PyMongoError as e:
        logger.error(f"MongoDB 오류: {e}")
        raise DatabaseConnectionException(f"Database delete failed: {str(e)}")
        
    except Exception as e:
        logger.error(f"분석 결과 삭제 중 오류: {e}")
        raise DatabaseConnectionException(f"Failed to delete analysis result: {str(e)}")


@router.get(
    "/stats/summary",
    summary="분석 결과 통계 요약",
    description="분석 결과의 전체 통계를 조회합니다."
)
async def get_analysis_summary():
    """
    분석 결과의 전체 통계를 조회합니다.
    
    각 상태별 개수, 최근 분석 날짜 등의 요약 정보를 제공합니다.
    """
    try:
        collection = get_analysis_collection()
        
        logger.info("분석 결과 통계 요약 조회")
        
        # 집계 파이프라인 구성
        pipeline = [
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                    "latest_date": {"$max": "$analysis_date"},
                    "oldest_date": {"$min": "$analysis_date"}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        # 집계 실행
        status_stats = await collection.aggregate(pipeline).to_list(length=None)
        
        # 전체 개수
        total_count = await collection.count_documents({})
        
        # 최근 분석 결과 (상위 5개)
        recent_results = await collection.find(
            {},
            {"_id": 1, "ne_id": 1, "cell_id": 1, "analysis_date": 1, "status": 1}
        ).sort("analysis_date", -1).limit(5).to_list(length=5)
        
        summary = {
            "total_count": total_count,
            "status_breakdown": {stat["_id"]: stat["count"] for stat in status_stats},
            "date_range": {
                "earliest": min((stat["oldest_date"] for stat in status_stats), default=None),
                "latest": max((stat["latest_date"] for stat in status_stats), default=None)
            },
            "recent_results": recent_results
        }
        
        logger.info("분석 결과 통계 요약 조회 완료")
        
        return {
            "success": True,
            "message": "Analysis summary retrieved successfully",
            "data": summary
        }
        
    except PyMongoError as e:
        logger.error(f"MongoDB 오류: {e}")
        raise DatabaseConnectionException(f"Database aggregation failed: {str(e)}")
        
    except Exception as e:
        logger.error(f"분석 결과 통계 조회 중 오류: {e}")
        raise DatabaseConnectionException(f"Failed to retrieve analysis summary: {str(e)}")

