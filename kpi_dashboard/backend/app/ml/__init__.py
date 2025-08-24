"""
Machine Learning Module for KPI Dashboard

Task 9: Backend: Implement Transformer Model and Ensemble Anomaly Scoring

This module contains the ML components for anomaly detection:
- Feature engineering pipeline
- LSTM Autoencoder model
- Transformer model
- Ensemble scoring system
- Enhanced anomaly detection utilities
"""

from .feature_engineering import FeatureEngineeringPipeline, FeatureConfig
from .lstm_autoencoder import LSTMAutoencoder, LSTMConfig, AnomalyDetector, train_lstm_autoencoder
from .transformer_model import (
    TransformerAnomalyDetectionEngine, 
    TransformerConfig, 
    train_transformer_model,
    load_transformer_model
)
from .ensemble_scoring import (
    EnsembleAnomalyScoringEngine, 
    EnsembleConfig, 
    create_ensemble_engine,
    train_ensemble_engine
)
from .anomaly_detection import (
    EnhancedAnomalyDetectionEngine, 
    EnhancedAnomalyDetectionConfig,
    # Backward compatibility
    AnomalyDetectionEngine,
    AnomalyDetectionConfig
)

__all__ = [
    # Feature Engineering
    'FeatureEngineeringPipeline',
    'FeatureConfig',
    
    # LSTM Autoencoder
    'LSTMAutoencoder',
    'LSTMConfig', 
    'AnomalyDetector',
    'train_lstm_autoencoder',
    
    # Transformer Model
    'TransformerAnomalyDetectionEngine',
    'TransformerConfig',
    'train_transformer_model',
    'load_transformer_model',
    
    # Ensemble Scoring
    'EnsembleAnomalyScoringEngine',
    'EnsembleConfig',
    'create_ensemble_engine',
    'train_ensemble_engine',
    
    # Enhanced Anomaly Detection
    'EnhancedAnomalyDetectionEngine',
    'EnhancedAnomalyDetectionConfig',
    
    # Backward Compatibility
    'AnomalyDetectionEngine',
    'AnomalyDetectionConfig'
]
