"""
Anomaly Detection API Router

This module provides API endpoints for anomaly detection using the ML components.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import pandas as pd
import numpy as np
import logging
import json
import os
from datetime import datetime

from ..ml import AnomalyDetectionEngine, FeatureEngineeringPipeline
from ..celery_app import celery_app

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/anomaly", tags=["Anomaly Detection"])

# Pydantic models for API requests and responses
class AnomalyDetectionRequest(BaseModel):
    """Request model for anomaly detection"""
    data: List[Dict[str, Any]] = Field(..., description="Time series data for anomaly detection")
    config: Optional[Dict[str, Any]] = Field(default=None, description="Configuration for anomaly detection")
    
class AnomalyDetectionResponse(BaseModel):
    """Response model for anomaly detection"""
    task_id: str = Field(..., description="Task ID for tracking")
    status: str = Field(..., description="Task status")
    message: str = Field(..., description="Status message")

class AnomalyDetectionResult(BaseModel):
    """Model for anomaly detection results"""
    anomaly_scores: List[float] = Field(..., description="Anomaly scores for each sequence")
    is_anomaly: List[bool] = Field(..., description="Boolean flags indicating anomalies")
    timestamps: List[str] = Field(..., description="Timestamps for each sequence")
    threshold: float = Field(..., description="Anomaly threshold used")
    num_anomalies: int = Field(..., description="Number of anomalies detected")
    anomaly_rate: float = Field(..., description="Rate of anomalies in the data")

class ModelTrainingRequest(BaseModel):
    """Request model for model training"""
    training_data: List[Dict[str, Any]] = Field(..., description="Training data")
    config: Optional[Dict[str, Any]] = Field(default=None, description="Training configuration")
    save_path: Optional[str] = Field(default=None, description="Path to save the trained model")

class ModelTrainingResponse(BaseModel):
    """Response model for model training"""
    task_id: str = Field(..., description="Task ID for tracking")
    status: str = Field(..., description="Task status")
    message: str = Field(..., description="Status message")

class ModelInfoResponse(BaseModel):
    """Response model for model information"""
    status: str = Field(..., description="Model status")
    info: Dict[str, Any] = Field(..., description="Model information")

# Global variable to store the trained model
anomaly_engine = None

def get_or_create_engine() -> AnomalyDetectionEngine:
    """Get the anomaly detection engine, create if not exists"""
    global anomaly_engine
    
    if anomaly_engine is None:
        logger.info("Creating new anomaly detection engine")
        anomaly_engine = AnomalyDetectionEngine()
        
        # Try to load pre-trained model if available
        model_path = "models/anomaly_detection"
        if os.path.exists(model_path):
            try:
                anomaly_engine = AnomalyDetectionEngine.load_models(model_path)
                logger.info("Loaded pre-trained anomaly detection model")
            except Exception as e:
                logger.warning(f"Failed to load pre-trained model: {e}")
                logger.info("Will use untrained engine")
    
    return anomaly_engine

@router.post("/detect", response_model=AnomalyDetectionResponse, summary="비동기 이상 탐지 요청")
async def request_anomaly_detection(request: AnomalyDetectionRequest):
    """
    비동기적으로 이상 탐지를 요청합니다.
    
    Args:
        request: 이상 탐지 요청 데이터
        
    Returns:
        작업 ID와 상태 정보
    """
    try:
        logger.info("Anomaly detection request received")
        
        # Convert request data to DataFrame
        df = pd.DataFrame(request.data)
        
        # Validate data
        if len(df) == 0:
            raise HTTPException(status_code=400, detail="Empty data provided")
        
        # Ensure timestamp column exists
        if 'timestamp' not in df.columns:
            df['timestamp'] = pd.date_range(start='2024-01-01', periods=len(df), freq='H')
        
        # Start background task
        task = detect_anomalies_task.delay(
            data=df.to_dict('records'),
            config=request.config
        )
        
        logger.info(f"Anomaly detection task started: {task.id}")
        
        return AnomalyDetectionResponse(
            task_id=task.id,
            status="PENDING",
            message="Anomaly detection task started"
        )
        
    except Exception as e:
        logger.error(f"Error in anomaly detection request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/task-status/{task_id}", response_model=Dict[str, Any], summary="작업 상태 조회")
async def get_anomaly_task_status(task_id: str):
    """
    이상 탐지 작업의 상태를 조회합니다.
    
    Args:
        task_id: 작업 ID
        
    Returns:
        작업 상태 정보
    """
    try:
        task = celery_app.AsyncResult(task_id)
        
        if task.ready():
            if task.successful():
                result = task.result
                return {
                    "task_id": task_id,
                    "status": "SUCCESS",
                    "result": result
                }
            else:
                return {
                    "task_id": task_id,
                    "status": "FAILURE",
                    "error": str(task.info)
                }
        else:
            return {
                "task_id": task_id,
                "status": "PENDING",
                "info": task.info
            }
            
    except Exception as e:
        logger.error(f"Error getting task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect-sync", response_model=AnomalyDetectionResult, summary="동기 이상 탐지")
async def detect_anomalies_sync(request: AnomalyDetectionRequest):
    """
    동기적으로 이상 탐지를 수행합니다.
    
    Args:
        request: 이상 탐지 요청 데이터
        
    Returns:
        이상 탐지 결과
    """
    try:
        logger.info("Synchronous anomaly detection request received")
        
        # Convert request data to DataFrame
        df = pd.DataFrame(request.data)
        
        # Validate data
        if len(df) == 0:
            raise HTTPException(status_code=400, detail="Empty data provided")
        
        # Ensure timestamp column exists
        if 'timestamp' not in df.columns:
            df['timestamp'] = pd.date_range(start='2024-01-01', periods=len(df), freq='H')
        
        # Get or create engine
        engine = get_or_create_engine()
        
        if not engine.is_trained:
            raise HTTPException(
                status_code=400, 
                detail="Model not trained. Please train the model first using /train endpoint."
            )
        
        # Detect anomalies
        results = engine.detect_anomalies(df)
        
        # Convert results to response format
        return AnomalyDetectionResult(
            anomaly_scores=results['anomaly_scores'].tolist(),
            is_anomaly=results['is_anomaly'].tolist(),
            timestamps=[str(ts) for ts in results['timestamps']],
            threshold=results['threshold'],
            num_anomalies=int(np.sum(results['is_anomaly'])),
            anomaly_rate=float(np.mean(results['is_anomaly']))
        )
        
    except Exception as e:
        logger.error(f"Error in synchronous anomaly detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/train", response_model=ModelTrainingResponse, summary="모델 학습 요청")
async def request_model_training(request: ModelTrainingRequest):
    """
    비동기적으로 모델 학습을 요청합니다.
    
    Args:
        request: 모델 학습 요청 데이터
        
    Returns:
        작업 ID와 상태 정보
    """
    try:
        logger.info("Model training request received")
        
        # Convert request data to DataFrame
        df = pd.DataFrame(request.training_data)
        
        # Validate data
        if len(df) == 0:
            raise HTTPException(status_code=400, detail="Empty training data provided")
        
        # Ensure timestamp column exists
        if 'timestamp' not in df.columns:
            df['timestamp'] = pd.date_range(start='2024-01-01', periods=len(df), freq='H')
        
        # Start background task
        task = train_model_task.delay(
            training_data=df.to_dict('records'),
            config=request.config,
            save_path=request.save_path
        )
        
        logger.info(f"Model training task started: {task.id}")
        
        return ModelTrainingResponse(
            task_id=task.id,
            status="PENDING",
            message="Model training task started"
        )
        
    except Exception as e:
        logger.error(f"Error in model training request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/model-info", response_model=ModelInfoResponse, summary="모델 정보 조회")
async def get_model_info():
    """
    현재 모델의 정보를 조회합니다.
    
    Returns:
        모델 정보
    """
    try:
        engine = get_or_create_engine()
        info = engine.get_model_info()
        
        return ModelInfoResponse(
            status=info['status'],
            info=info
        )
        
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sample-data", response_model=Dict[str, Any], summary="샘플 데이터 생성")
async def generate_sample_data(n_samples: int = 100, n_features: int = 5):
    """
    테스트용 샘플 데이터를 생성합니다.
    
    Args:
        n_samples: 샘플 수
        n_features: 특성 수
        
    Returns:
        생성된 샘플 데이터
    """
    try:
        pipeline = FeatureEngineeringPipeline()
        sample_data = pipeline.generate_sample_data(n_samples=n_samples, n_features=n_features)
        
        return {
            "data": sample_data.to_dict('records'),
            "shape": sample_data.shape,
            "columns": sample_data.columns.tolist()
        }
        
    except Exception as e:
        logger.error(f"Error generating sample data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Celery tasks
@celery_app.task(bind=True)
def detect_anomalies_task(self, data: List[Dict[str, Any]], config: Optional[Dict[str, Any]] = None):
    """
    비동기 이상 탐지 작업
    """
    try:
        self.update_state(state='RUNNING', meta={'current_step': 'Loading data'})
        
        # Convert data to DataFrame
        df = pd.DataFrame(data)
        
        # Ensure timestamp column exists
        if 'timestamp' not in df.columns:
            df['timestamp'] = pd.date_range(start='2024-01-01', periods=len(df), freq='H')
        
        self.update_state(state='RUNNING', meta={'current_step': 'Getting anomaly detection engine'})
        
        # Get or create engine
        engine = get_or_create_engine()
        
        if not engine.is_trained:
            raise Exception("Model not trained. Please train the model first.")
        
        self.update_state(state='RUNNING', meta={'current_step': 'Detecting anomalies'})
        
        # Detect anomalies
        results = engine.detect_anomalies(df)
        
        # Convert numpy arrays to lists for JSON serialization
        serializable_results = {
            'anomaly_scores': results['anomaly_scores'].tolist(),
            'is_anomaly': results['is_anomaly'].tolist(),
            'timestamps': [str(ts) for ts in results['timestamps']],
            'threshold': results['threshold'],
            'num_anomalies': int(np.sum(results['is_anomaly'])),
            'anomaly_rate': float(np.mean(results['is_anomaly']))
        }
        
        self.update_state(state='SUCCESS', meta={'result': serializable_results})
        
        return serializable_results
        
    except Exception as e:
        logger.error(f"Error in anomaly detection task: {e}")
        self.update_state(state='FAILURE', meta={'error': str(e)})
        raise

@celery_app.task(bind=True)
def train_model_task(self, training_data: List[Dict[str, Any]], 
                     config: Optional[Dict[str, Any]] = None,
                     save_path: Optional[str] = None):
    """
    비동기 모델 학습 작업
    """
    try:
        self.update_state(state='RUNNING', meta={'current_step': 'Loading training data'})
        
        # Convert data to DataFrame
        df = pd.DataFrame(training_data)
        
        # Ensure timestamp column exists
        if 'timestamp' not in df.columns:
            df['timestamp'] = pd.date_range(start='2024-01-01', periods=len(df), freq='H')
        
        self.update_state(state='RUNNING', meta={'current_step': 'Creating anomaly detection engine'})
        
        # Create new engine
        global anomaly_engine
        anomaly_engine = AnomalyDetectionEngine()
        
        # Apply configuration if provided
        if config:
            if 'feature_config' in config:
                for key, value in config['feature_config'].items():
                    setattr(anomaly_engine.config.feature_config, key, value)
            if 'lstm_config' in config:
                for key, value in config['lstm_config'].items():
                    setattr(anomaly_engine.config.lstm_config, key, value)
        
        self.update_state(state='RUNNING', meta={'current_step': 'Training model'})
        
        # Train the model
        training_results = anomaly_engine.train(df, save_path=save_path)
        
        # Convert training results to serializable format
        serializable_results = {
            'training_metrics': training_results['training_metrics'],
            'feature_matrix_shape': list(training_results['feature_matrix_shape']),
            'threshold': training_results['threshold'],
            'model_info': anomaly_engine.get_model_info()
        }
        
        self.update_state(state='SUCCESS', meta={'result': serializable_results})
        
        return serializable_results
        
    except Exception as e:
        logger.error(f"Error in model training task: {e}")
        self.update_state(state='FAILURE', meta={'error': str(e)})
        raise
