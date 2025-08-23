# 특정 NE/Cell ID/Host 분석 기능 강화 PRD

## 1. 프로젝트 개요

### 1.1 목적
기존 analysis_llm.py의 전체 네트워크 분석 기능을 확장하여, 특정 NE(Network Element), Cell ID, Host를 타겟팅한 정밀 분석 기능을 강화하고, MongoDB 저장 및 조회 기능의 견고성을 개선합니다.

### 1.2 배경
- 현재 코드는 'ne', 'cellid' 필터링을 지원하지만 'host' 필터링 및 통합 검증 처리가 미흡
- MongoDB 저장 시 ne/cellid/host 메타데이터가 부족하여 효과적인 조회가 어려움
- LLM 분석 시 특정 타겟(NE+Cell+Host 조합)의 컨텍스트가 충분히 반영되지 않음
- 백엔드 API(/api/analysis/results/) 연동에서 다중 필터 처리 개선 필요

### 1.3 목표
- **정확성**: 특정 NE/Cell/Host 분석의 데이터 신뢰성 99% 이상
- **견고성**: 다중 필터 입력 검증 및 에러 처리로 시스템 안정성 확보
- **조회성**: MongoDB에서 ne/cellid/host 기반 빠른 검색 지원
- **분석 품질**: LLM 분석 결과의 타겟 특화 정확도 향상

## 2. 기능 요구사항

### 2.1 입력 검증 및 필터링 강화

#### 2.1.1 ne 필터 개선
```python
# 현재 구현 (line 1461-1477)
ne_raw = request.get('ne')
ne_filters = to_list(ne_raw)

# 개선 요구사항
- NE ID 형식 검증 (예: "nvgnb#10000" 패턴)
- DB에서 실제 존재하는 NE인지 확인
- 복수 NE 처리 시 각각의 유효성 검사
- 잘못된 NE ID에 대한 명확한 에러 메시지
```

#### 2.1.2 cellid 필터 개선
```python
# 현재 구현
cell_raw = request.get('cellid') or request.get('cell')
cellid_filters = to_list(cell_raw)

# 개선 요구사항
- Cell ID 형식 검증 (숫자, 문자열 형식 지원)
- 지정된 NE 하위의 유효한 Cell인지 확인
- NE와 Cell의 연관성 검증
- 존재하지 않는 Cell ID에 대한 상세 에러 정보
```

#### 2.1.3 host 필터 신규 추가
```python
# 신규 구현 요구사항
host_raw = request.get('host')
host_filters = to_list(host_raw)

# 기능 요구사항
- Host 식별자 형식 검증 (IP 주소, 호스트명 등)
- DB에서 실제 존재하는 Host인지 확인
- Host와 NE/Cell의 연관성 검증 (물리적/논리적 연결)
- 복수 Host 처리 시 각각의 유효성 검사
- Host별 데이터 수집 범위 및 품질 확인
```

#### 2.1.4 통합 검증 로직
```python
def validate_ne_cell_host_filters(ne_filters, cellid_filters, host_filters, conn, table, columns):
    """
    NE, Cell ID, Host 필터의 유효성을 검증하고 상호 연관성을 확인
    
    Args:
        ne_filters: NE ID 목록
        cellid_filters: Cell ID 목록  
        host_filters: Host 식별자 목록
        conn: DB 연결
        table: 대상 테이블
        columns: 컬럼 매핑 정보
    
    Returns:
        dict: {
            "valid": bool,
            "validated_ne": list,
            "validated_cells": list,
            "validated_hosts": list,
            "relationships": {
                "ne_cell_mapping": dict,
                "host_ne_mapping": dict,
                "coverage_analysis": dict
            },
            "warnings": list,
            "errors": list
        }
    """
```

### 2.2 MongoDB 통합 개선

#### 2.2.1 스키마 확장
```python
# 현재 payload 구조 (line 1707-1721)
result_payload = {
    "neId": ne_id_repr,
    "cellId": cell_id_repr,
    # ... 기타 필드
}

# Host 포함 개선된 구조
result_payload = {
    "target_scope": {
        "ne_ids": ne_filters,  # 전체 NE 목록
        "cell_ids": cellid_filters,  # 전체 Cell 목록
        "host_ids": host_filters,  # 전체 Host 목록
        "primary_ne": ne_id_repr,  # 대표 NE
        "primary_cell": cell_id_repr,  # 대표 Cell
        "primary_host": host_id_repr,  # 대표 Host
        "scope_type": "specific_target" | "network_wide",
        "target_combinations": [  # NE-Cell-Host 조합들
            {"ne": "nvgnb#10000", "cell": "2010", "host": "host01"},
            {"ne": "nvgnb#10000", "cell": "2011", "host": "host01"}
        ]
    },
    "filter_metadata": {
        "applied_ne_count": len(ne_filters),
        "applied_cell_count": len(cellid_filters),
        "applied_host_count": len(host_filters),
        "data_coverage_ratio": float,  # 필터링된 데이터 비율
        "relationship_coverage": {  # 연관성 커버리지
            "ne_cell_matches": int,
            "host_ne_matches": int, 
            "full_combination_matches": int
        }
    }
}
```

#### 2.2.2 인덱싱 최적화
```javascript
// MongoDB 인덱스 추가 (Host 포함)
db.analysis_results.createIndex({
    "target_scope.ne_ids": 1,
    "target_scope.cell_ids": 1,
    "target_scope.host_ids": 1,
    "analysisDate": -1
})

db.analysis_results.createIndex({
    "target_scope.primary_ne": 1,
    "target_scope.primary_cell": 1,
    "target_scope.primary_host": 1,
    "target_scope.scope_type": 1
})

// 복합 검색용 인덱스
db.analysis_results.createIndex({
    "target_scope.target_combinations.ne": 1,
    "target_scope.target_combinations.cell": 1,
    "target_scope.target_combinations.host": 1
})

// Host 기반 조회 최적화
db.analysis_results.createIndex({
    "target_scope.host_ids": 1,
    "filter_metadata.relationship_coverage.host_ne_matches": -1
})
```

### 2.3 LLM 분석 품질 향상

#### 2.3.1 타겟 특화 프롬프트 템플릿
```python
def create_llm_analysis_prompt_targeted(processed_df, n1_range, n_range, ne_info, cell_info, host_info):
    """
    특정 NE/Cell/Host 타겟팅 분석용 프롬프트 생성
    
    추가 컨텍스트:
    - 타겟 NE의 특성 (위치, 용량, 주파수 등)
    - Cell의 특성 (섹터, 커버리지, 인접 Cell 등)
    - Host의 특성 (하드웨어 사양, 부하 수준, 연결 상태 등)
    - NE-Cell-Host 조합별 성능 특성
    - 타겟 범위에 특화된 분석 관점
    - 물리적/논리적 인프라 연관성
    """
```

#### 2.3.2 결과 해석 개선
```python
# Host 포함 LLM 결과 구조 확장
llm_analysis = {
    "executive_summary": "...",
    "target_specific_insights": {
        "ne_performance": {
            "ne_id": str,
            "overall_health": str,
            "critical_issues": list,
            "capacity_utilization": float
        },
        "cell_performance": {
            "cell_id": str, 
            "coverage_quality": str,
            "interference_issues": list,
            "handover_performance": str
        },
        "host_performance": {
            "host_id": str,
            "resource_utilization": {
                "cpu_usage": float,
                "memory_usage": float,
                "network_throughput": float
            },
            "infrastructure_health": str,
            "bottleneck_analysis": list
        },
        "integration_analysis": {
            "ne_cell_synergy": str,
            "host_infrastructure_impact": str,
            "end_to_end_performance": str
        }
    },
    "comparative_analysis": {
        "vs_network_average": dict,
        "vs_peer_cells": dict,
        "vs_peer_hosts": dict,
        "multi_dimensional_ranking": {
            "ne_ranking": int,
            "cell_ranking": int,
            "host_ranking": int,
            "combined_score": float
        }
    }
}
```

### 2.4 API 및 조회 기능 강화

#### 2.4.1 POST 엔드포인트 개선
```python
# 현재: /api/analysis/results/
# 개선: payload 검증 및 메타데이터 추가

def validate_analysis_payload(payload):
    """
    분석 결과 payload의 구조와 내용을 검증
    - 필수 필드 존재 확인
    - ne/cellid 메타데이터 유효성
    - stats 데이터 일관성 검사
    """
```

#### 2.4.2 조회 API 확장
```python
# Host 포함 새로운 조회 엔드포인트
GET /api/analysis/results/by-target?ne={ne_id}&cell={cell_id}&host={host_id}&limit=10
GET /api/analysis/results/ne/{ne_id}/cells/{cell_id}/hosts/{host_id}/latest
GET /api/analysis/results/host/{host_id}/performance-summary
GET /api/analysis/results/combinations?ne={ne_id}&include_hosts=true
GET /api/analysis/results/search?scope_type=specific_target&host_filter={host_pattern}&date_from=...

# 다중 필터 조회
GET /api/analysis/results/multi-target?ne_ids={ne1,ne2}&cell_ids={cell1,cell2}&host_ids={host1,host2}
```

## 3. 기술 사양

### 3.1 입력 형식 확장
```json
{
  "n_minus_1": "2025-07-01_00:00~2025-07-01_23:59",
  "n": "2025-07-02_00:00~2025-07-02_23:59",
  "ne": ["nvgnb#10000", "nvgnb#20000"],  // 복수 NE 지원
  "cellid": ["2010", "2011", "2012"],    // 복수 Cell 지원
  "host": ["host01", "192.168.1.10", "host03"],  // 복수 Host 지원 (호스트명, IP 혼용)
  "validation_mode": "strict|lenient",   // 검증 수준
  "include_metadata": true,              // NE/Cell/Host 메타데이터 포함
  "target_analysis_depth": "detailed",   // 분석 깊이
  "relationship_validation": true,       // NE-Cell-Host 연관성 검증
  "host_performance_metrics": [          // Host 성능 메트릭 선택
    "cpu_utilization", 
    "memory_usage", 
    "network_throughput"
  ]
}
```

### 3.2 에러 처리 강화
```python
class TargetValidationError(Exception):
    """NE/Cell/Host 타겟 검증 실패"""
    def __init__(self, message, invalid_targets, suggestions=None):
        self.invalid_targets = invalid_targets  # {"ne": [...], "cell": [...], "host": [...]}
        self.suggestions = suggestions
        super().__init__(message)

class HostValidationError(Exception):
    """Host 관련 검증 실패"""
    def __init__(self, message, invalid_hosts, host_metadata=None):
        self.invalid_hosts = invalid_hosts
        self.host_metadata = host_metadata
        super().__init__(message)

def handle_multi_target_validation_errors(validation_result):
    """
    NE/Cell/Host 복합 검증 실패 시 상세한 에러 정보 및 개선 제안 제공
    - 개별 타겟별 검증 결과
    - 연관성 검증 실패 원인
    - 대안 조합 제안
    """
```

### 3.3 로깅 및 모니터링
```python
def log_multi_target_analysis_metrics(ne_filters, cell_filters, host_filters, data_stats):
    """
    다중 타겟 분석 관련 메트릭 로깅
    - 필터링된 데이터 양 (NE/Cell/Host 별)
    - 분석 소요 시간
    - LLM 토큰 사용량
    - 결과 품질 지표
    - Host 성능 메트릭 수집 상태
    - 연관성 검증 결과
    """

def monitor_host_infrastructure_impact(host_filters, analysis_start_time):
    """
    Host 인프라 영향도 모니터링
    - Host별 리소스 사용률 변화
    - 분석 중 Host 성능 임팩트
    - 네트워크 대역폭 사용량
    """
```

## 4. 구현 계획

### Phase 1: 다중 타겟 입력 검증 및 필터링 (1.5주)
- [ ] `validate_ne_cell_host_filters()` 함수 구현
- [ ] Host 식별자 형식 검증 로직 (IP 주소, 호스트명)
- [ ] NE-Cell-Host 연관성 검증 알고리즘
- [ ] DB 연결을 통한 실시간 검증 로직
- [ ] 복합 에러 처리 및 사용자 피드백 개선
- [ ] 단위 테스트 작성 (Host 검증 포함)

### Phase 2: MongoDB 스키마 및 API 확장 (1.5주)  
- [ ] `target_scope`, `filter_metadata` 필드 Host 지원 추가
- [ ] Host 관련 MongoDB 인덱스 최적화
- [ ] POST payload 다중 필터 검증 로직 강화
- [ ] Host 포함 조회 API 엔드포인트 구현
- [ ] 복합 필터 조회 성능 최적화

### Phase 3: LLM 분석 품질 향상 (1.5주)
- [ ] Host 포함 타겟 특화 프롬프트 템플릿
- [ ] NE/Cell/Host 메타데이터 수집 로직
- [ ] Host 성능 메트릭 통합 분석
- [ ] 결과 구조 확장 및 검증 (Host 성능 포함)
- [ ] 다차원 품질 평가 메트릭 구현

### Phase 4: 통합 테스트 및 최적화 (1주)
- [ ] Host 포함 End-to-End 테스트 시나리오
- [ ] 다중 필터 성능 벤치마크 및 최적화
- [ ] Host 인프라 영향도 모니터링
- [ ] 문서화 및 사용자 가이드 (Host 사용법 포함)
- [ ] 모니터링 대시보드 구성

## 5. 성공 지표

### 5.1 기능적 지표
- **입력 검증 정확도**: 잘못된 ne/cellid/host 입력 감지율 100%
- **데이터 일관성**: 다중 필터링된 분석 결과의 정확성 99%+
- **API 응답 시간**: 복합 타겟 분석 요청 처리 < 45초
- **조회 성능**: ne/cellid/host 기반 검색 < 800ms
- **연관성 검증 정확도**: NE-Cell-Host 관계 검증 정확도 95%+

### 5.2 품질 지표  
- **LLM 분석 관련성**: 다중 타겟 특화 인사이트 포함률 90%+
- **Host 성능 분석 정확도**: Host 리소스 메트릭 분석 정확도 85%+
- **에러 복구율**: 복합 필터 입력 오류에 대한 의미있는 에러 메시지 제공
- **사용자 만족도**: 다중 타겟 분석 기능 사용성 평가 4.5/5.0+

### 5.3 운영 지표
- **시스템 안정성**: 다중 타겟 분석 실행 성공률 99.5%+
- **MongoDB 저장 성공률**: 99.9%+
- **데이터 품질**: 저장된 분석 결과의 완결성 검증 (Host 메타데이터 포함)
- **Host 인프라 영향도**: 분석 중 Host 성능 저하 < 5%

## 6. 리스크 및 완화 방안

### 6.1 기술적 리스크
- **DB 성능 저하**: 복잡한 ne/cellid/host 다중 검증으로 인한 응답 지연
  - **완화**: 캐싱 및 인덱스 최적화, 비동기 검증, 배치 검증
- **LLM 토큰 사용량 증가**: Host 메타데이터 추가로 인한 비용 상승
  - **완화**: 프롬프트 최적화 및 토큰 사용량 모니터링, Host 메트릭 선택적 포함
- **Host 연결성 이슈**: Host 접근 불가 또는 메트릭 수집 실패
  - **완화**: 타임아웃 설정, 폴백 메커니즘, 부분 결과 지원

### 6.2 운영 리스크  
- **기존 기능 영향**: 새로운 Host 검증 로직이 기존 분석에 영향
  - **완화**: 하위 호환성 유지 및 점진적 배포, Host 필터 선택적 활성화
- **데이터 품질 이슈**: 잘못된 다중 필터링으로 인한 분석 결과 왜곡
  - **완화**: 다단계 검증 및 결과 검토 프로세스, 연관성 검증 강화
- **Host 인프라 과부하**: 집중적인 Host 메트릭 수집으로 인한 성능 영향
  - **완화**: 수집 빈도 조절, 분산 수집, 리소스 모니터링

## 7. 부록

### 7.1 현재 코드 분석
- **ne/cellid 처리**: line 1461-1477에서 기본 처리 구현됨
- **host 필터 부재**: 현재 코드에서 host 필터링 미지원
- **SQL 필터링**: line 443-467에서 WHERE 조건 적용 (host 컬럼 추가 필요)
- **payload 구성**: line 1707-1721에서 기본 메타데이터 포함 (host 정보 부족)
- **개선 필요 영역**: Host 필터링, 다중 검증, 에러 처리, LLM 컨텍스트, MongoDB 스키마

### 7.2 관련 파일
- `analysis_llm.py`: 주요 구현 파일
- `kpi_dashboard/backend/app/routers/analysis.py`: API 엔드포인트
- `kpi_dashboard/backend/app/models/`: MongoDB 모델 정의
- `kpi_dashboard/docs/`: 관련 문서

### 7.3 테스트 시나리오
```json
// 단일 NE/Cell/Host 테스트
{
  "ne": "nvgnb#10000", 
  "cellid": "2010",
  "host": "host01"
}

// 복수 다중 타겟 테스트  
{
  "ne": ["nvgnb#10000", "nvgnb#20000"],
  "cellid": ["2010", "2011", "2012"],
  "host": ["host01", "192.168.1.10", "host03"]
}

// 부분 필터 테스트 (Host만 지정)
{
  "host": ["host01", "host02"]
}

// 에러 케이스 테스트
{
  "ne": "invalid_ne",
  "cellid": "99999",
  "host": "invalid_host"
}

// 연관성 검증 테스트 (불일치하는 조합)
{
  "ne": "nvgnb#10000",
  "cellid": "9999",  // nvgnb#10000에 속하지 않는 Cell
  "host": "host_other_ne"  // 다른 NE에 연결된 Host
}
```
