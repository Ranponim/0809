"""
KPI 쿼리 API 라우터

이 모듈은 기존 KPI 쿼리 기능을 새로운 모듈 구조로 이식합니다.
Dashboard, Statistics, AdvancedChart 컴포넌트에서 사용하는 /api/kpi/query 엔드포인트를 제공합니다.
"""

import logging
import json
import random
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Body, HTTPException, status
from fastapi.responses import JSONResponse
import math

logger = logging.getLogger(__name__)

# 라우터 생성
router = APIRouter(
    prefix="/api/kpi",
    tags=["KPI Query"],
    responses={
        400: {"description": "Bad Request"},
        404: {"description": "Not Found"},
        422: {"description": "Validation Error"},
        500: {"description": "Internal Server Error"}
    }
)

def _to_list(raw):
    """문자열이나 배열을 정규화된 리스트로 변환"""
    if raw is None:
        return []
    if isinstance(raw, str):
        return [t.strip() for t in raw.split(',') if t.strip()]
    if isinstance(raw, list):
        return [str(t).strip() for t in raw if str(t).strip()]
    return [str(raw).strip()]

def generate_mock_kpi_data(
    start_dt: datetime,
    end_dt: datetime,
    kpi_type: str,
    entity_ids: List[str],
    ne_filters: List[str] = None,
    cellid_filters: List[str] = None,
    kpi_peg_names: List[str] = None,
    kpi_peg_like: List[str] = None
) -> List[Dict[str, Any]]:
    """
    Mock KPI 데이터 생성기
    기존 로직을 그대로 이식
    """
    try:
        # 기본 설정
        kpi_default_value_map = {
            'availability': 99.5,
            'rrc': 98.2,
            'erab': 97.8,
            'accessibility': 99.1,
            'integrity': 98.9,
            'mobility': 96.5
        }
        
        base_value = kpi_default_value_map.get(kpi_type, 95.0)
        
        # 시간 범위 계산
        total_hours = int((end_dt - start_dt).total_seconds() / 3600) + 1
        if total_hours > 168:  # 1주일 이상이면 일별로 샘플링
            step_hours = max(1, total_hours // 168)
        else:
            step_hours = 1
            
        # Entity ID 처리
        if not entity_ids:
            entity_ids = ['LHK078ML1', 'LHK078MR1']
            
        # NE/Cell ID 필터링 시뮬레이션
        if ne_filters:
            entity_ids = [eid for eid in entity_ids if any(ne in eid for ne in ne_filters)]
        if cellid_filters:
            entity_ids = [eid for eid in entity_ids if any(cell in eid for cell in cellid_filters)]
            
        # 데이터 생성
        data = []
        current_time = start_dt
        
        while current_time <= end_dt:
            for entity_id in entity_ids:
                # 각 entity별로 약간의 변동 추가
                entity_variation = hash(entity_id) % 10 - 5  # -5 to +4
                time_variation = random.uniform(-2, 2)
                
                value = base_value + entity_variation + time_variation
                value = max(0, min(100, value))  # 0-100 범위로 제한
                
                # PEG 이름 생성 (실제 DB에서는 다를 수 있음)
                peg_names = []
                if kpi_peg_names:
                    peg_names.extend(kpi_peg_names)
                if kpi_peg_like:
                    # LIKE 패턴 시뮬레이션
                    for pattern in kpi_peg_like:
                        pattern_clean = pattern.replace('%', '').replace('_', '')
                        peg_names.append(f"{pattern_clean}_{kpi_type}")
                        
                if not peg_names:
                    peg_names = [f"{kpi_type}_rate", f"{kpi_type}_count"]
                
                for peg_name in peg_names[:2]:  # 최대 2개
                    data.append({
                        "timestamp": current_time.strftime("%Y-%m-%d %H:%M:%S"),
                        "entity_id": entity_id,
                        "kpi_type": kpi_type,
                        "peg_name": peg_name,
                        "value": round(value, 2),
                        "ne": entity_id.split('#')[0] if '#' in entity_id else f"ne_{entity_id[:6]}",
                        "cell_id": entity_id.split('#')[1] if '#' in entity_id else f"cell_{entity_id[-3:]}",
                        "date": current_time.strftime("%Y-%m-%d"),
                        "hour": current_time.hour
                    })
                    
            current_time += timedelta(hours=step_hours)
            
        logger.info(f"Mock 데이터 생성 완료: {len(data)}건 ({kpi_type}, {len(entity_ids)} entities)")
        return data
        
    except Exception as e:
        logger.error(f"Mock 데이터 생성 실패: {e}")
        return []

@router.post("/query", summary="KPI 데이터 쿼리", tags=["KPI Query"])
async def kpi_query(payload: dict = Body(...)):
    """
    KPI 데이터 쿼리 엔드포인트
    
    기존 main_legacy.py의 /api/kpi/query 로직을 새로운 모듈 구조로 이식.
    현재는 Mock 데이터를 반환하며, 추후 실제 DB 연동으로 확장 가능.
    
    Request Body:
    ```json
    {
        "db": {"host": "...", "port": 5432, "user": "...", "password": "...", "dbname": "..."},
        "table": "summary",
        "start_date": "2025-08-07",
        "end_date": "2025-08-14", 
        "kpi_type": "availability",
        "entity_ids": "LHK078ML1,LHK078MR1",
        "ne": "nvgnb#10000",
        "cellid": "2010",
        "kpi_peg_names": ["Accessibility_Attempts", "Accessibility_Success"],
        "kpi_peg_like": ["RRC_%", "ERAB_%"]
    }
    ```
    
    Response:
    ```json
    {
        "success": true,
        "data": [
            {
                "timestamp": "2025-08-07 00:00:00",
                "entity_id": "LHK078ML1",
                "kpi_type": "availability",
                "value": 99.2,
                "ne": "nvgnb#10000",
                "cell_id": "2010"
            }
        ],
        "metadata": {
            "total_records": 338,
            "kpi_type": "availability",
            "date_range": "2025-08-07 ~ 2025-08-14"
        }
    }
    ```
    """
    try:
        # 필수 매개변수 검증
        start_date = payload.get("start_date")
        end_date = payload.get("end_date")
        kpi_type = payload.get("kpi_type")
        
        if not start_date or not end_date or not kpi_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date, end_date, kpi_type는 필수 매개변수입니다"
            )

        # 날짜 파싱 및 검증
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="날짜 형식은 YYYY-MM-DD 이어야 합니다"
            )

        # 선택적 매개변수 처리
        entity_ids = payload.get("entity_ids", "LHK078ML1,LHK078MR1")
        ids = [t.strip() for t in str(entity_ids).split(",") if t.strip()]
        
        ne_filters = _to_list(payload.get("ne"))
        cellid_filters = _to_list(payload.get("cellid") or payload.get("cell"))
        kpi_peg_names = _to_list(payload.get("kpi_peg_names") or payload.get("peg_names"))
        kpi_peg_like = _to_list(payload.get("kpi_peg_like") or payload.get("peg_patterns"))

        # 로깅
        logger.info(
            f"/api/kpi/query 매개변수: kpi_type={kpi_type}, "
            f"ids={len(ids)}, ne={len(ne_filters)}, cellid={len(cellid_filters)}, "
            f"기간={start_date}~{end_date}"
        )

        # Mock 데이터 생성
        data = generate_mock_kpi_data(
            start_dt=start_dt,
            end_dt=end_dt,
            kpi_type=kpi_type,
            entity_ids=ids,
            ne_filters=ne_filters,
            cellid_filters=cellid_filters,
            kpi_peg_names=kpi_peg_names,
            kpi_peg_like=kpi_peg_like
        )

        # 응답 생성
        result = {
            "success": True,
            "data": data,
            "metadata": {
                "total_records": len(data),
                "kpi_type": kpi_type,
                "date_range": f"{start_date} ~ {end_date}",
                "entity_count": len(ids),
                "ne_filters": ne_filters,
                "cellid_filters": cellid_filters,
                "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        }

        logger.info(f"/api/kpi/query mock 응답: rows={len(data)}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"KPI 쿼리 처리 중 오류 발생: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"KPI 쿼리 처리 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/info", summary="KPI API 정보", tags=["KPI Query"])
async def kpi_info():
    """
    KPI API 정보 조회
    """
    return {
        "api": "KPI Query API",
        "version": "1.0.0",
        "description": "3GPP KPI 데이터 쿼리 API",
        "endpoints": {
            "query": "/api/kpi/query",
            "info": "/api/kpi/info"
        },
        "supported_kpi_types": [
            "availability",
            "rrc", 
            "erab",
            "accessibility",
            "integrity",
            "mobility"
        ],
        "features": [
            "Mock 데이터 생성",
            "날짜 범위 필터링",
            "Entity ID 필터링", 
            "NE/Cell ID 필터링",
            "PEG 이름/패턴 필터링",
            "확장 가능한 DB 연동 구조"
        ]
    }

