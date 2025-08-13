from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import random
from datetime import datetime, timedelta

app = FastAPI(title="3GPP KPI Management API", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 origin 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 데이터 모델 정의
class KPIData(BaseModel):
    timestamp: str
    entity_id: str
    kpi_type: str
    value: float

class PreferenceModel(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    config: dict

class SummaryReport(BaseModel):
    id: int
    title: str
    content: str
    generated_at: str

# 가상 데이터 생성 함수
def generate_mock_kpi_data(start_date: str, end_date: str, kpi_type: str, entity_ids: List[str]) -> List[KPIData]:
    data = []
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    
    current = start
    while current <= end:
        for entity_id in entity_ids:
            # KPI 타입별로 다른 범위의 값 생성
            if kpi_type == "availability":
                base_value = 99.0
                value = base_value + random.uniform(-2.0, 1.0)
            elif kpi_type == "rrc":
                base_value = 98.5
                value = base_value + random.uniform(-1.5, 1.0)
            elif kpi_type == "erab":
                base_value = 99.2
                value = base_value + random.uniform(-1.0, 0.8)
            elif kpi_type == "sar":
                base_value = 2.5
                value = base_value + random.uniform(-0.5, 1.0)
            elif kpi_type == "mobility_intra":
                base_value = 95.0
                value = base_value + random.uniform(-5.0, 3.0)
            elif kpi_type == "payload":
                base_value = 500.0
                value = base_value + random.uniform(-100.0, 200.0)
            elif kpi_type == "cqi":
                base_value = 8.0
                value = base_value + random.uniform(-2.0, 2.0)
            elif kpi_type == "se":
                base_value = 2.0
                value = base_value + random.uniform(-0.5, 1.0)
            elif kpi_type == "dl_thp":
                base_value = 10000.0
                value = base_value + random.uniform(-2000.0, 5000.0)
            elif kpi_type == "ul_int":
                base_value = -110.0
                value = base_value + random.uniform(-5.0, 5.0)
            else:
                value = random.uniform(0, 100)
            
            data.append(KPIData(
                timestamp=current.isoformat(),
                entity_id=entity_id,
                kpi_type=kpi_type,
                value=round(value, 2)
            ))
        
        current += timedelta(hours=1)  # 1시간 간격
    
    return data

# 가상 preference 저장소
preferences_db = []
preference_counter = 1

# 가상 리포트 데이터
mock_reports = [
    SummaryReport(
        id=1,
        title="주간 네트워크 성능 분석 리포트",
        content="""
# 주간 네트워크 성능 분석 리포트

## 요약
이번 주 네트워크 성능은 전반적으로 안정적이었으며, 주요 KPI들이 목표치를 달성했습니다.

## 주요 발견사항
- **가용성(Availability)**: 평균 99.1%로 목표치(99.0%) 달성
- **RRC 성공률**: 평균 98.7%로 양호한 수준 유지
- **ERAB 성공률**: 평균 99.3%로 우수한 성능
- **다운링크 처리량**: 평균 12.5 Mbps로 증가 추세

## 권장사항
1. 특정 셀에서 간헐적인 성능 저하 모니터링 필요
2. 피크 시간대 용량 증설 검토
3. 인터페어런스 최적화 작업 수행
        """,
        generated_at="2024-08-13T10:00:00"
    )
]

# API 엔드포인트
@app.get("/")
async def root():
    return {"message": "3GPP KPI Management API"}

@app.get("/api/kpi/statistics")
async def get_kpi_statistics(
    start_date: str = Query(..., description="시작 날짜 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="종료 날짜 (YYYY-MM-DD)"),
    kpi_type: str = Query(..., description="KPI 타입"),
    entity_ids: str = Query("LHK078ML1,LHK078MR1", description="엔티티 ID 목록 (쉼표로 구분)")
):
    entity_list = entity_ids.split(",")
    data = generate_mock_kpi_data(start_date, end_date, kpi_type, entity_list)
    return {"data": data}

@app.get("/api/kpi/trends")
async def get_kpi_trends(
    start_date: str = Query(..., description="시작 날짜 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="종료 날짜 (YYYY-MM-DD)"),
    kpi_type: str = Query(..., description="KPI 타입"),
    entity_id: str = Query(..., description="엔티티 ID")
):
    data = generate_mock_kpi_data(start_date, end_date, kpi_type, [entity_id])
    return {"data": data}

@app.get("/api/reports/summary")
async def get_summary_reports(report_id: Optional[int] = None):
    if report_id:
        report = next((r for r in mock_reports if r.id == report_id), None)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return report
    return {"reports": mock_reports}

@app.get("/api/preferences")
async def get_preferences():
    return {"preferences": preferences_db}

@app.get("/api/preferences/{preference_id}")
async def get_preference(preference_id: int):
    preference = next((p for p in preferences_db if p.id == preference_id), None)
    if not preference:
        raise HTTPException(status_code=404, detail="Preference not found")
    return preference

@app.post("/api/preferences")
async def create_preference(preference: PreferenceModel):
    global preference_counter
    preference.id = preference_counter
    preference_counter += 1
    preferences_db.append(preference)
    return {"id": preference.id, "message": "Preference created successfully"}

@app.put("/api/preferences/{preference_id}")
async def update_preference(preference_id: int, preference: PreferenceModel):
    existing = next((p for p in preferences_db if p.id == preference_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail="Preference not found")
    
    existing.name = preference.name
    existing.description = preference.description
    existing.config = preference.config
    return {"message": "Preference updated successfully"}

@app.delete("/api/preferences/{preference_id}")
async def delete_preference(preference_id: int):
    global preferences_db
    preferences_db = [p for p in preferences_db if p.id != preference_id]
    return {"message": "Preference deleted successfully"}

@app.get("/api/master/pegs")
async def get_pegs():
    return {
        "pegs": [
            {"id": "PEG001", "name": "Seoul Central"},
            {"id": "PEG002", "name": "Busan North"},
            {"id": "PEG003", "name": "Daegu West"}
        ]
    }

@app.get("/api/master/cells")
async def get_cells():
    return {
        "cells": [
            {"id": "LHK078ML1", "name": "Seoul-Gangnam-001"},
            {"id": "LHK078MR1", "name": "Seoul-Gangnam-002"},
            {"id": "LHK078ML1_SIMPANGRAMBONGL04", "name": "Seoul-Gangnam-003"}
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

