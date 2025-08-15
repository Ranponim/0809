"""
커스텀 예외 클래스 정의

이 모듈은 애플리케이션에서 사용되는 커스텀 예외들과
중앙 집중식 예외 처리를 위한 클래스들을 정의합니다.
"""

import logging
from typing import Optional, Dict, Any
from fastapi import Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class BaseAPIException(Exception):
    """
    API 예외의 기본 클래스
    
    모든 커스텀 예외는 이 클래스를 상속받아야 합니다.
    """
    
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class AnalysisResultNotFoundException(BaseAPIException):
    """분석 결과를 찾을 수 없을 때 발생하는 예외"""
    
    def __init__(self, result_id: str):
        self.result_id = result_id
        message = f"Analysis result with id '{result_id}' not found"
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            details={"result_id": result_id}
        )


class InvalidAnalysisDataException(BaseAPIException):
    """분석 데이터가 유효하지 않을 때 발생하는 예외"""
    
    def __init__(self, message: str, validation_errors: Optional[list] = None):
        super().__init__(
            message=f"Invalid analysis data: {message}",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={"validation_errors": validation_errors or []}
        )


class DatabaseConnectionException(BaseAPIException):
    """데이터베이스 연결 오류 시 발생하는 예외"""
    
    def __init__(self, message: str = "Database connection failed"):
        super().__init__(
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"service": "database"}
        )


class DuplicateAnalysisResultException(BaseAPIException):
    """중복된 분석 결과가 있을 때 발생하는 예외"""
    
    def __init__(self, ne_id: str, cell_id: str, analysis_date: str):
        message = f"Analysis result already exists for NE '{ne_id}', Cell '{cell_id}' on date '{analysis_date}'"
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            details={
                "ne_id": ne_id,
                "cell_id": cell_id,
                "analysis_date": analysis_date
            }
        )


class InvalidFilterException(BaseAPIException):
    """필터 파라미터가 유효하지 않을 때 발생하는 예외"""
    
    def __init__(self, message: str, invalid_filters: Optional[Dict] = None):
        super().__init__(
            message=f"Invalid filter parameters: {message}",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"invalid_filters": invalid_filters or {}}
        )


class UserPreferenceNotFoundException(BaseAPIException):
    """사용자 설정을 찾을 수 없을 때 발생하는 예외"""
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        message = f"User preference for user '{user_id}' not found"
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            details={"user_id": user_id}
        )


class InvalidPreferenceDataException(BaseAPIException):
    """설정 데이터가 유효하지 않을 때 발생하는 예외"""
    
    def __init__(self, message: str, validation_errors: Optional[list] = None):
        super().__init__(
            message=f"Invalid preference data: {message}",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={"validation_errors": validation_errors or []}
        )


class PreferenceImportException(BaseAPIException):
    """설정 가져오기 과정에서 오류가 발생할 때의 예외"""
    
    def __init__(self, message: str, import_errors: Optional[list] = None):
        super().__init__(
            message=f"Preference import failed: {message}",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"import_errors": import_errors or []}
        )


# 예외 핸들러 함수들
async def base_api_exception_handler(request: Request, exc: BaseAPIException) -> JSONResponse:
    """
    BaseAPIException에 대한 기본 예외 핸들러
    
    Args:
        request: FastAPI 요청 객체
        exc: 발생한 예외
        
    Returns:
        JSONResponse: 표준화된 에러 응답
    """
    logger.error(
        f"API Exception: {exc.message} | "
        f"Status: {exc.status_code} | "
        f"Details: {exc.details} | "
        f"Path: {request.url.path}"
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": exc.message,
                "type": exc.__class__.__name__,
                "status_code": exc.status_code,
                "details": exc.details
            },
            "path": str(request.url.path),
            "method": request.method
        }
    )


async def analysis_result_not_found_handler(request: Request, exc: AnalysisResultNotFoundException) -> JSONResponse:
    """분석 결과 찾을 수 없음 예외 핸들러"""
    logger.warning(f"Analysis result not found: {exc.result_id} | Path: {request.url.path}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": exc.message,
                "type": "AnalysisResultNotFound",
                "result_id": exc.result_id
            }
        }
    )


async def invalid_analysis_data_handler(request: Request, exc: InvalidAnalysisDataException) -> JSONResponse:
    """유효하지 않은 분석 데이터 예외 핸들러"""
    logger.warning(f"Invalid analysis data: {exc.message} | Path: {request.url.path}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": exc.message,
                "type": "InvalidAnalysisData",
                "validation_errors": exc.details.get("validation_errors", [])
            }
        }
    )


async def database_connection_handler(request: Request, exc: DatabaseConnectionException) -> JSONResponse:
    """데이터베이스 연결 오류 예외 핸들러"""
    logger.error(f"Database connection error: {exc.message} | Path: {request.url.path}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": "Service temporarily unavailable. Please try again later.",
                "type": "ServiceUnavailable",
                "service": "database"
            }
        }
    )


async def duplicate_analysis_result_handler(request: Request, exc: DuplicateAnalysisResultException) -> JSONResponse:
    """중복 분석 결과 예외 핸들러"""
    logger.warning(f"Duplicate analysis result: {exc.message} | Path: {request.url.path}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": exc.message,
                "type": "DuplicateAnalysisResult",
                "details": exc.details
            }
        }
    )


async def user_preference_not_found_handler(request: Request, exc: UserPreferenceNotFoundException) -> JSONResponse:
    """사용자 설정 찾을 수 없음 예외 핸들러"""
    logger.warning(f"User preference not found: {exc.user_id} | Path: {request.url.path}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": exc.message,
                "type": "UserPreferenceNotFound",
                "user_id": exc.user_id
            }
        }
    )


async def invalid_preference_data_handler(request: Request, exc: InvalidPreferenceDataException) -> JSONResponse:
    """유효하지 않은 설정 데이터 예외 핸들러"""
    logger.warning(f"Invalid preference data: {exc.message} | Path: {request.url.path}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": exc.message,
                "type": "InvalidPreferenceData",
                "validation_errors": exc.details.get("validation_errors", [])
            }
        }
    )


async def preference_import_handler(request: Request, exc: PreferenceImportException) -> JSONResponse:
    """설정 가져오기 오류 예외 핸들러"""
    logger.warning(f"Preference import error: {exc.message} | Path: {request.url.path}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": exc.message,
                "type": "PreferenceImportError",
                "import_errors": exc.details.get("import_errors", [])
            }
        }
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    일반적인 예외에 대한 핸들러
    
    예상하지 못한 예외가 발생했을 때 사용됩니다.
    """
    logger.error(f"Unexpected error: {str(exc)} | Path: {request.url.path}", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "message": "An unexpected error occurred. Please try again later.",
                "type": "InternalServerError"
            }
        }
    )
