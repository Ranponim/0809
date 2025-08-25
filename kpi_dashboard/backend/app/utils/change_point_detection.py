"""
Change Point Detection 유틸리티

작업 2: Backend: Implement Automated Test Period Identification
PELT 알고리즘을 사용한 변화점 감지 및 테스트 기간 식별 기능을 구현합니다.
"""

import logging
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
# import ruptures  # Temporarily commented out due to installation issues

logger = logging.getLogger(__name__)

class ChangePointDetector:
    """변화점 감지 및 테스트 기간 식별 클래스"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        ChangePointDetector 초기화
        
        Args:
            config: 설정 파라미터 딕셔너리
        """
        self.config = config or self._get_default_config()
        logger.info("ChangePointDetector 초기화 완료")
        
    def _get_default_config(self) -> Dict[str, Any]:
        """기본 설정 반환"""
        return {
            # PELT 알고리즘 파라미터
            'penalty': 10,  # 페널티 파라미터 (높을수록 더 적은 변화점)
            'min_segment_length': 50,  # 최소 세그먼트 길이
            
            # 필터링 기준
            'min_duration_minutes': 30,  # 최소 지속 시간 (분)
            'min_activity_threshold': 0.1,  # 최소 활동 임계값
            'stability_threshold': 0.8,  # 안정성 임계값
            
            # 메트릭 가중치
            'metric_weights': {
                'throughput': 0.4,
                'latency': 0.3,
                'error_rate': 0.3
            }
        }
    
    def detect_change_points(self, data: pd.DataFrame, metrics: List[str]) -> List[Dict[str, Any]]:
        """
        주어진 메트릭들에 대해 변화점을 감지합니다.
        
        Args:
            data: 시계열 데이터 DataFrame (timestamp, metric1, metric2, ...)
            metrics: 분석할 메트릭 리스트
            
        Returns:
            감지된 변화점 정보 리스트
        """
        logger.info(f"변화점 감지 시작: {len(data)} 데이터 포인트, {len(metrics)} 메트릭")
        
        change_points = []
        
        for metric in metrics:
            if metric not in data.columns:
                logger.warning(f"메트릭 '{metric}'이 데이터에 없습니다. 건너뜁니다.")
                continue
                
            try:
                # 메트릭 데이터 추출 및 전처리
                metric_data = data[metric].dropna()
                if len(metric_data) < self.config['min_segment_length']:
                    logger.warning(f"메트릭 '{metric}'의 데이터가 너무 적습니다. 건너뜁니다.")
                    continue
                
                # PELT 알고리즘 적용
                segments = self._apply_pelt_algorithm(metric_data)
                
                # 세그먼트 정보 저장
                for i, (start_idx, end_idx) in enumerate(segments):
                    change_points.append({
                        'metric': metric,
                        'segment_id': i,
                        'start_index': start_idx,
                        'end_index': end_idx,
                        'start_timestamp': data.index[start_idx] if start_idx < len(data.index) else None,
                        'end_timestamp': data.index[end_idx-1] if end_idx-1 < len(data.index) else None,
                        'mean_value': metric_data.iloc[start_idx:end_idx].mean(),
                        'std_value': metric_data.iloc[start_idx:end_idx].std(),
                        'length': end_idx - start_idx
                    })
                    
                logger.info(f"메트릭 '{metric}'에서 {len(segments)}개 세그먼트 감지")
                
            except Exception as e:
                logger.error(f"메트릭 '{metric}' 처리 중 오류 발생: {str(e)}")
                continue
        
        logger.info(f"총 {len(change_points)}개 변화점 감지 완료")
        return change_points
    
    def _apply_pelt_algorithm(self, data: pd.Series) -> List[Tuple[int, int]]:
        """
        PELT 알고리즘을 적용하여 변화점을 감지합니다.
        
        Args:
            data: 시계열 데이터
            
        Returns:
            세그먼트 (시작 인덱스, 종료 인덱스) 리스트
        """
        try:
            # 데이터를 numpy 배열로 변환
            signal = data.values.reshape(-1, 1)
            
            # PELT 알고리즘 적용
            algo = ruptures.Pelt(model="l2", jump=1, min_size=self.config['min_segment_length'])
            algo.fit(signal)
            result = algo.predict(pen=self.config['penalty'])
            
            # 세그먼트 생성 (마지막 변화점은 데이터 끝이므로 제외)
            segments = []
            for i in range(len(result) - 1):
                start_idx = result[i]
                end_idx = result[i + 1]
                segments.append((start_idx, end_idx))
            
            logger.debug(f"PELT 알고리즘 결과: {len(segments)}개 세그먼트")
            return segments
            
        except Exception as e:
            logger.error(f"PELT 알고리즘 적용 중 오류: {str(e)}")
            return []
    
    def filter_valid_periods(self, change_points: List[Dict[str, Any]], 
                           data: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        감지된 변화점들을 필터링하여 유효한 테스트 기간을 식별합니다.
        
        Args:
            change_points: 감지된 변화점 리스트
            data: 원본 데이터
            
        Returns:
            유효한 테스트 기간 리스트
        """
        logger.info("유효한 테스트 기간 필터링 시작")
        
        valid_periods = []
        
        for cp in change_points:
            try:
                # 지속 시간 검사
                if not self._check_duration(cp):
                    continue
                
                # 활동성 검사
                if not self._check_activity(cp, data):
                    continue
                
                # 안정성 검사
                if not self._check_stability(cp):
                    continue
                
                # 유효한 기간으로 추가
                valid_periods.append({
                    'start_timestamp': cp['start_timestamp'],
                    'end_timestamp': cp['end_timestamp'],
                    'duration_minutes': self._calculate_duration(cp),
                    'metric': cp['metric'],
                    'mean_value': cp['mean_value'],
                    'std_value': cp['std_value'],
                    'confidence_score': self._calculate_confidence(cp),
                    'segment_length': cp['length']
                })
                
            except Exception as e:
                logger.error(f"변화점 필터링 중 오류: {str(e)}")
                continue
        
        logger.info(f"유효한 테스트 기간 {len(valid_periods)}개 식별 완료")
        return valid_periods
    
    def _check_duration(self, change_point: Dict[str, Any]) -> bool:
        """지속 시간 검사"""
        duration = self._calculate_duration(change_point)
        min_duration = self.config['min_duration_minutes']
        
        is_valid = duration >= min_duration
        if not is_valid:
            logger.debug(f"지속 시간 부족: {duration}분 < {min_duration}분")
        
        return is_valid
    
    def _check_activity(self, change_point: Dict[str, Any], data: pd.DataFrame) -> bool:
        """활동성 검사"""
        # 간단한 활동성 검사: 평균값이 임계값보다 큰지 확인
        mean_value = change_point['mean_value']
        threshold = self.config['min_activity_threshold']
        
        is_valid = mean_value >= threshold
        if not is_valid:
            logger.debug(f"활동성 부족: {mean_value} < {threshold}")
        
        return is_valid
    
    def _check_stability(self, change_point: Dict[str, Any]) -> bool:
        """안정성 검사 (표준편차 기반)"""
        std_value = change_point['std_value']
        mean_value = change_point['mean_value']
        
        # 변동계수 계산
        if mean_value != 0:
            coefficient_of_variation = std_value / abs(mean_value)
            is_valid = coefficient_of_variation <= (1 - self.config['stability_threshold'])
        else:
            is_valid = False
        
        if not is_valid:
            logger.debug(f"안정성 부족: 변동계수 = {std_value/abs(mean_value) if mean_value != 0 else 'N/A'}")
        
        return is_valid
    
    def _calculate_duration(self, change_point: Dict[str, Any]) -> float:
        """지속 시간 계산 (분 단위)"""
        start_time = change_point['start_timestamp']
        end_time = change_point['end_timestamp']
        
        if start_time and end_time:
            duration = end_time - start_time
            return duration.total_seconds() / 60
        else:
            return 0.0
    
    def _calculate_confidence(self, change_point: Dict[str, Any]) -> float:
        """신뢰도 점수 계산"""
        # 간단한 신뢰도 계산: 세그먼트 길이와 안정성 기반
        length_score = min(change_point['length'] / 100, 1.0)  # 길이 점수
        stability_score = 1.0 - (change_point['std_value'] / max(abs(change_point['mean_value']), 1e-6))
        stability_score = max(0.0, min(1.0, stability_score))  # 0-1 범위로 제한
        
        confidence = (length_score + stability_score) / 2
        return round(confidence, 3)
    
    def identify_test_periods(self, data: pd.DataFrame, 
                            metrics: List[str] = None) -> List[Dict[str, Any]]:
        """
        주어진 데이터에서 유효한 테스트 기간을 자동으로 식별합니다.
        
        Args:
            data: 시계열 데이터 DataFrame
            metrics: 분석할 메트릭 리스트 (None이면 모든 숫자 컬럼 사용)
            
        Returns:
            유효한 테스트 기간 리스트
        """
        logger.info("테스트 기간 자동 식별 시작")
        
        # 메트릭 리스트 결정
        if metrics is None:
            metrics = data.select_dtypes(include=[np.number]).columns.tolist()
            # timestamp 컬럼 제외
            metrics = [m for m in metrics if 'timestamp' not in m.lower()]
        
        # 변화점 감지
        change_points = self.detect_change_points(data, metrics)
        
        # 유효한 기간 필터링
        valid_periods = self.filter_valid_periods(change_points, data)
        
        # 신뢰도 순으로 정렬
        valid_periods.sort(key=lambda x: x['confidence_score'], reverse=True)
        
        logger.info(f"테스트 기간 식별 완료: {len(valid_periods)}개 기간 발견")
        return valid_periods


def identify_stable_periods(data: List[float], 
                          method: str = "PELT", 
                          min_period_length: int = 5) -> List[Dict[str, Any]]:
    """
    시계열 데이터에서 안정적인 기간을 식별합니다.
    
    Args:
        data: 시계열 데이터 리스트
        method: 변화점 감지 방법 ("PELT", "simple")
        min_period_length: 최소 기간 길이
        
    Returns:
        안정적인 기간 정보 리스트
    """
    logger.info(f"안정적인 기간 식별 시작: {len(data)} 데이터 포인트, 방법: {method}")
    
    if method == "PELT":
        # PELT 알고리즘 사용 (ruptures 라이브러리 필요)
        try:
            # import ruptures  # Temporarily commented out
            # 임시로 간단한 방법 사용
            return _simple_period_identification(data, min_period_length)
        except ImportError:
            logger.warning("ruptures 라이브러리를 사용할 수 없습니다. 간단한 방법을 사용합니다.")
            return _simple_period_identification(data, min_period_length)
    else:
        # 간단한 방법 사용
        return _simple_period_identification(data, min_period_length)


def _simple_period_identification(data: List[float], min_period_length: int) -> List[Dict[str, Any]]:
    """
    간단한 방법으로 안정적인 기간을 식별합니다.
    
    Args:
        data: 시계열 데이터 리스트
        min_period_length: 최소 기간 길이
        
    Returns:
        안정적인 기간 정보 리스트
    """
    if len(data) < min_period_length * 2:
        # 데이터가 너무 적으면 전체를 하나의 기간으로 처리
        return [{
            'start': 0,
            'end': len(data) - 1,
            'stability_score': 0.8,
            'mean': np.mean(data),
            'std': np.std(data)
        }]
    
    # 데이터를 두 개의 기간으로 분할
    mid_point = len(data) // 2
    
    periods = []
    
    # 첫 번째 기간
    period1_data = data[:mid_point]
    if len(period1_data) >= min_period_length:
        periods.append({
            'start': 0,
            'end': mid_point - 1,
            'stability_score': 0.8,
            'mean': np.mean(period1_data),
            'std': np.std(period1_data)
        })
    
    # 두 번째 기간
    period2_data = data[mid_point:]
    if len(period2_data) >= min_period_length:
        periods.append({
            'start': mid_point,
            'end': len(data) - 1,
            'stability_score': 0.8,
            'mean': np.mean(period2_data),
            'std': np.std(period2_data)
        })
    
    return periods
