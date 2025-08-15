"""
3GPP KPI 대시보드 백엔드 API

이 모듈은 FastAPI를 사용한 KPI 대시보드의 메인 애플리케이션을 정의합니다.
Task 39: Backend LLM 분석 결과 API 및 DB 스키마 구현 완료
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# 내부 모듈 임포트
from .db import connect_to_mongo, close_mongo_connection, get_db_stats
from .routers import analysis, preference, kpi, statistics, master, llm_analysis
from .middleware.performance import performance_middleware, setup_mongo_monitoring, get_performance_stats
from .exceptions import (
    BaseAPIException,
    AnalysisResultNotFoundException,
    InvalidAnalysisDataException,
    DatabaseConnectionException,
    DuplicateAnalysisResultException,
    UserPreferenceNotFoundException,
    InvalidPreferenceDataException,
    PreferenceImportException,
    base_api_exception_handler,
    analysis_result_not_found_handler,
    invalid_analysis_data_handler,
    database_connection_handler,
    duplicate_analysis_result_handler,
    user_preference_not_found_handler,
    invalid_preference_data_handler,
    preference_import_handler,
    general_exception_handler
)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    애플리케이션 생명주기 관리
    
    시작 시 데이터베이스 연결을 설정하고,
    종료 시 연결을 정리합니다.
    """
    # 시작 시 실행
    logger.info("애플리케이션 시작 중...")
    try:
        await connect_to_mongo()
        logger.info("데이터베이스 연결 완료")
        
        # MongoDB 성능 모니터링 설정
        setup_mongo_monitoring()
        logger.info("성능 모니터링 설정 완료")
    except Exception as e:
        logger.error(f"애플리케이션 초기화 실패: {e}")
        raise
    
    yield
    
    # 종료 시 실행
    logger.info("애플리케이션 종료 중...")
    await close_mongo_connection()
    logger.info("애플리케이스 종료 완료")


# FastAPI 애플리케이션 생성
app = FastAPI(
    title="3GPP KPI Management API",
    version="1.0.0",
    description="""
    ## 3GPP KPI 대시보드 백엔드 API
    
    이 API는 LLM 분석 결과 및 사용자 설정을 관리하는 시스템입니다.
    
    ### 주요 기능
    - **분석 결과 관리**: LLM 분석 결과의 CRUD 작업
    - **통계 분석**: 두 날짜 구간의 데이터 비교 분석
    - **사용자 설정**: 대시보드 및 통계 설정 관리
    - **필터링**: 다양한 조건으로 데이터 검색
    
    ### 개발 정보
    - **버전**: 1.0.0
    - **프레임워크**: FastAPI + MongoDB + Motor
    - **문서**: Swagger UI 및 ReDoc 제공
    """,
    contact={
        "name": "KPI Dashboard Team",
        "email": "kpi-dashboard@example.com"
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT"
    },
    lifespan=lifespan
)

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 구체적인 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 성능 모니터링 미들웨어 추가
app.middleware("http")(performance_middleware)

# 예외 핸들러 등록
app.add_exception_handler(BaseAPIException, base_api_exception_handler)
app.add_exception_handler(AnalysisResultNotFoundException, analysis_result_not_found_handler)
app.add_exception_handler(InvalidAnalysisDataException, invalid_analysis_data_handler)
app.add_exception_handler(DatabaseConnectionException, database_connection_handler)
app.add_exception_handler(DuplicateAnalysisResultException, duplicate_analysis_result_handler)
app.add_exception_handler(UserPreferenceNotFoundException, user_preference_not_found_handler)
app.add_exception_handler(InvalidPreferenceDataException, invalid_preference_data_handler)
app.add_exception_handler(PreferenceImportException, preference_import_handler)
app.add_exception_handler(Exception, general_exception_handler)

# 라우터 등록
app.include_router(analysis.router)
app.include_router(preference.router)
app.include_router(kpi.router)
app.include_router(statistics.router)   # Task 46 - Statistics 비교 분석 API
app.include_router(master.router)       # Master 데이터 API (PEG, Cell 목록)
app.include_router(llm_analysis.router) # LLM 분석 API


@app.get("/", summary="API 루트", tags=["General"])
async def root():
    """
    API 루트 엔드포인트
    
    API가 정상적으로 동작하는지 확인할 수 있습니다.
    """
    return {
        "message": "Welcome to 3GPP KPI Management API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "status": "healthy"
    }


@app.get("/health", summary="헬스 체크", tags=["General"])
async def health_check():
    """
    애플리케이션 헬스 체크
    
    데이터베이스 연결 상태를 포함한 시스템 상태를 확인합니다.
    """
    try:
        # 데이터베이스 상태 확인
        db_stats = await get_db_stats()
        
        return {
            "status": "healthy",
            "timestamp": "2025-08-14T20:00:00Z",
            "services": {
                "api": "healthy",
                "database": "healthy" if "error" not in db_stats else "unhealthy"
            },
            "database": db_stats
        }
    except Exception as e:
        logger.error(f"헬스 체크 실패: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": "2025-08-14T20:00:00Z",
                "services": {
                    "api": "healthy",
                    "database": "unhealthy"
                },
                "error": str(e)
            }
        )


@app.get("/api/performance", summary="성능 통계", tags=["General"])
async def performance_stats():
    """
    현재 애플리케이션 성능 통계
    
    메모리 사용량, CPU 사용률 등 실시간 성능 지표를 제공합니다.
    """
    try:
        stats = get_performance_stats()
        return {
            "status": "success",
            "data": stats,
            "timestamp": "2025-01-15T12:00:00Z"
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"성능 통계 조회 실패: {str(e)}"
            }
        )


@app.get("/api/info", summary="API 정보", tags=["General"])
async def api_info():
    """
    API 상세 정보
    
    현재 API의 상세 정보와 사용 가능한 엔드포인트를 제공합니다.
    """
    return {
        "api": {
            "name": "3GPP KPI Management API",
            "version": "1.0.0",
            "description": "LLM 분석 결과 및 사용자 설정 관리 API"
        },
        "endpoints": {
            "analysis_results": "/api/analysis/results",
            "user_preferences": "/api/preference/settings", 
            "preference_import_export": "/api/preference/import|export",
            "kpi_query": "/api/kpi/query",
            "statistics_compare": "/api/statistics/compare",
            "master_pegs": "/api/master/pegs",
            "master_cells": "/api/master/cells",
            "health_check": "/health",
            "documentation": {
                "swagger": "/docs",
                "redoc": "/redoc",
                "openapi": "/openapi.json"
            }
        },
        "features": [
            "분석 결과 CRUD",
            "사용자 설정 관리", 
            "설정 Import/Export",
            "Statistics 비교 분석",
            "페이지네이션",
            "필터링",
            "통계 요약",
            "비동기 처리",
            "자동 문서화"
        ],
        "database": {
            "type": "MongoDB",
            "driver": "Motor (비동기)"
        }
    }


# 기존 간단한 로깅 미들웨어는 성능 미들웨어로 교체됨


if __name__ == "__main__":
    import uvicorn
    
    logger.info("개발 서버 시작")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
