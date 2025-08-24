"""
Enhanced Anomaly Detection Module

Task 9: Backend: Implement Transformer Model and Ensemble Anomaly Scoring

This module integrates the feature engineering pipeline, LSTM autoencoder,
Transformer model, and ensemble scoring system to provide a comprehensive
anomaly detection solution for Multi-UE data.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
import logging
import os
import json
from dataclasses import dataclass
import warnings
from pathlib import Path
import joblib
import torch

from .feature_engineering import FeatureEngineeringPipeline, FeatureConfig
from .lstm_autoencoder import LSTMAutoencoder, LSTMConfig, AnomalyDetector, train_lstm_autoencoder
from .transformer_model import TransformerAnomalyDetectionEngine, TransformerConfig, train_transformer_model
from .ensemble_scoring import EnsembleAnomalyScoringEngine, EnsembleConfig, create_ensemble_engine

warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

@dataclass
class EnhancedAnomalyDetectionConfig:
    """Enhanced configuration for anomaly detection with ensemble support"""
    # Feature engineering config
    feature_config: FeatureConfig = None
    
    # LSTM config
    lstm_config: LSTMConfig = None
    
    # Transformer config
    transformer_config: TransformerConfig = None
    
    # Ensemble config
    ensemble_config: EnsembleConfig = None
    
    # Anomaly detection config
    threshold_percentile: float = 95.0
    min_anomaly_score: float = 0.1
    
    # Model selection
    use_lstm: bool = True
    use_transformer: bool = True
    use_ensemble: bool = True
    
    def __post_init__(self):
        if self.feature_config is None:
            self.feature_config = FeatureConfig()
        if self.lstm_config is None:
            self.lstm_config = LSTMConfig()
        if self.transformer_config is None:
            self.transformer_config = TransformerConfig()
        if self.ensemble_config is None:
            self.ensemble_config = EnsembleConfig()

class EnhancedAnomalyDetectionEngine:
    """
    Enhanced anomaly detection engine
    
    Integrates feature engineering, LSTM autoencoder, Transformer model,
    and ensemble scoring for comprehensive anomaly detection in Multi-UE time series data.
    """
    
    def __init__(self, config: Optional[EnhancedAnomalyDetectionConfig] = None):
        """
        Initialize the enhanced anomaly detection engine
        
        Args:
            config: Configuration for the engine
        """
        self.config = config or EnhancedAnomalyDetectionConfig()
        self.feature_pipeline = None
        self.lstm_model = None
        self.transformer_model = None
        self.ensemble_engine = None
        self.anomaly_detector = None
        self.is_trained = False
        self.training_results = {}
        
        logger.info("Enhanced anomaly detection engine initialized")
        
    def train(self, data: pd.DataFrame, 
              save_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Train the complete enhanced anomaly detection pipeline
        
        Args:
            data: Training data DataFrame
            save_path: Path to save the trained models
            
        Returns:
            Training results and metrics
        """
        logger.info("Starting enhanced anomaly detection training...")
        
        # Step 1: Feature Engineering
        logger.info("Step 1: Feature Engineering")
        self.feature_pipeline = FeatureEngineeringPipeline(self.config.feature_config)
        
        # Fit and transform the data
        feature_matrix = self.feature_pipeline.fit_transform(data)
        logger.info(f"Feature matrix shape: {feature_matrix.shape}")
        
        training_results = {
            "feature_matrix_shape": feature_matrix.shape,
            "models_trained": []
        }
        
        # Step 2: Train individual models
        if self.config.use_lstm:
            logger.info("Step 2a: LSTM Autoencoder Training")
            try:
                self.lstm_model, lstm_history = train_lstm_autoencoder(
                    feature_matrix, 
                    self.config.lstm_config
                )
                training_results["lstm_training"] = lstm_history
                training_results["models_trained"].append("lstm")
                logger.info("LSTM Autoencoder training completed successfully")
            except Exception as e:
                logger.error(f"LSTM training failed: {e}")
                training_results["lstm_training"] = {"error": str(e)}
        
        if self.config.use_transformer:
            logger.info("Step 2b: Transformer Model Training")
            try:
                self.transformer_model = train_transformer_model(
                    feature_matrix,
                    self.config.transformer_config
                )
                training_results["transformer_training"] = self.transformer_model.training_history
                training_results["models_trained"].append("transformer")
                logger.info("Transformer model training completed successfully")
            except Exception as e:
                logger.error(f"Transformer training failed: {e}")
                training_results["transformer_training"] = {"error": str(e)}
        
        # Step 3: Ensemble Training (if enabled and multiple models available)
        if self.config.use_ensemble and len(training_results["models_trained"]) > 1:
            logger.info("Step 3: Ensemble Model Training")
            try:
                # Create ensemble engine
                self.ensemble_engine = create_ensemble_engine(self.config.ensemble_config)
                
                # Train ensemble with available models
                if "lstm" in training_results["models_trained"]:
                    self.ensemble_engine.models["lstm_autoencoder"] = self.lstm_model
                
                if "transformer" in training_results["models_trained"]:
                    self.ensemble_engine.models["transformer"] = self.transformer_model
                
                # Train additional ensemble models
                self.ensemble_engine.train_isolation_forest(feature_matrix)
                self.ensemble_engine.train_local_outlier_factor(feature_matrix)
                
                self.ensemble_engine.is_trained = True
                training_results["models_trained"].append("ensemble")
                logger.info("Ensemble model training completed successfully")
            except Exception as e:
                logger.error(f"Ensemble training failed: {e}")
                training_results["ensemble_training"] = {"error": str(e)}
        
        # Step 4: Save models if path provided
        if save_path:
            self.save_models(save_path)
        
        self.is_trained = True
        self.training_results = training_results
        
        logger.info(f"Enhanced anomaly detection training completed. Models trained: {training_results['models_trained']}")
        return training_results
    
    def predict(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Make predictions using the enhanced anomaly detection pipeline
        
        Args:
            data: Input data DataFrame
            
        Returns:
            Prediction results with ensemble scores
        """
        if not self.is_trained:
            raise ValueError("Models must be trained before making predictions")
        
        logger.info("Making enhanced anomaly detection predictions...")
        
        # Step 1: Feature Engineering
        feature_matrix = self.feature_pipeline.transform(data)
        
        # Step 2: Individual model predictions
        predictions = {
            "feature_matrix_shape": feature_matrix.shape,
            "individual_predictions": {},
            "ensemble_predictions": None
        }
        
        # LSTM predictions
        if self.lstm_model is not None:
            try:
                lstm_predictions = self.lstm_model.predict(feature_matrix)
                predictions["individual_predictions"]["lstm"] = lstm_predictions
                logger.info("LSTM predictions completed")
            except Exception as e:
                logger.error(f"LSTM prediction failed: {e}")
                predictions["individual_predictions"]["lstm"] = {"error": str(e)}
        
        # Transformer predictions
        if self.transformer_model is not None:
            try:
                transformer_predictions = self.transformer_model.predict(feature_matrix)
                predictions["individual_predictions"]["transformer"] = transformer_predictions
                logger.info("Transformer predictions completed")
            except Exception as e:
                logger.error(f"Transformer prediction failed: {e}")
                predictions["individual_predictions"]["transformer"] = {"error": str(e)}
        
        # Step 3: Ensemble predictions
        if self.ensemble_engine is not None and self.ensemble_engine.is_trained:
            try:
                ensemble_predictions = self.ensemble_engine.predict(feature_matrix)
                predictions["ensemble_predictions"] = ensemble_predictions
                logger.info("Ensemble predictions completed")
            except Exception as e:
                logger.error(f"Ensemble prediction failed: {e}")
                predictions["ensemble_predictions"] = {"error": str(e)}
        
        # Step 4: Determine final predictions
        if predictions["ensemble_predictions"] and "error" not in predictions["ensemble_predictions"]:
            # Use ensemble predictions as final result
            final_scores = predictions["ensemble_predictions"]["ensemble_scores"]
            final_anomalies = predictions["ensemble_predictions"]["anomalies"]
            final_confidence = predictions["ensemble_predictions"]["confidence_scores"]
            prediction_method = "ensemble"
        elif "lstm" in predictions["individual_predictions"] and "error" not in predictions["individual_predictions"]["lstm"]:
            # Fallback to LSTM predictions
            final_scores = predictions["individual_predictions"]["lstm"]["anomaly_scores"]
            final_anomalies = predictions["individual_predictions"]["lstm"]["anomalies"]
            final_confidence = np.ones_like(final_scores)  # Default confidence
            prediction_method = "lstm"
        elif "transformer" in predictions["individual_predictions"] and "error" not in predictions["individual_predictions"]["transformer"]:
            # Fallback to Transformer predictions
            final_scores = predictions["individual_predictions"]["transformer"]["anomaly_scores"]
            final_anomalies = predictions["individual_predictions"]["transformer"]["anomalies"]
            final_confidence = np.ones_like(final_scores)  # Default confidence
            prediction_method = "transformer"
        else:
            raise ValueError("No valid predictions available from any model")
        
        # Add final results to predictions
        predictions["final_results"] = {
            "anomaly_scores": final_scores,
            "anomalies": final_anomalies,
            "confidence_scores": final_confidence,
            "prediction_method": prediction_method,
            "total_anomalies": np.sum(final_anomalies),
            "anomaly_rate": np.mean(final_anomalies)
        }
        
        logger.info(f"Enhanced anomaly detection predictions completed. "
                   f"Method: {prediction_method}, "
                   f"Anomalies: {predictions['final_results']['total_anomalies']}")
        
        return predictions
    
    def evaluate_performance(self, data: pd.DataFrame, labels: np.ndarray) -> Dict[str, Any]:
        """
        Evaluate the performance of the enhanced anomaly detection system
        
        Args:
            data: Test data DataFrame
            labels: True anomaly labels (1 for anomaly, 0 for normal)
            
        Returns:
            Performance evaluation results
        """
        logger.info("Evaluating enhanced anomaly detection performance...")
        
        # Get predictions
        predictions = self.predict(data)
        
        # Evaluate ensemble performance if available
        if (self.ensemble_engine is not None and 
            predictions["ensemble_predictions"] and 
            "error" not in predictions["ensemble_predictions"]):
            
            feature_matrix = self.feature_pipeline.transform(data)
            ensemble_metrics = self.ensemble_engine.evaluate_performance(feature_matrix, labels)
            
            evaluation_results = {
                "ensemble_metrics": ensemble_metrics,
                "final_metrics": {
                    "roc_auc": ensemble_metrics.get("roc_auc", 0.0),
                    "average_precision": ensemble_metrics.get("average_precision", 0.0),
                    "total_predictions": len(predictions["final_results"]["anomaly_scores"]),
                    "predicted_anomalies": predictions["final_results"]["total_anomalies"],
                    "true_anomalies": np.sum(labels),
                    "prediction_method": predictions["final_results"]["prediction_method"]
                }
            }
        else:
            # Fallback to individual model evaluation
            evaluation_results = {
                "ensemble_metrics": None,
                "final_metrics": {
                    "total_predictions": len(predictions["final_results"]["anomaly_scores"]),
                    "predicted_anomalies": predictions["final_results"]["total_anomalies"],
                    "true_anomalies": np.sum(labels),
                    "prediction_method": predictions["final_results"]["prediction_method"]
                }
            }
        
        logger.info(f"Performance evaluation completed. "
                   f"ROC AUC: {evaluation_results['final_metrics'].get('roc_auc', 'N/A')}")
        
        return evaluation_results
    
    def save_models(self, save_path: str):
        """Save all trained models"""
        if not self.is_trained:
            raise ValueError("No trained models to save")
        
        save_dir = Path(save_path)
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Save feature pipeline
        if self.feature_pipeline:
            joblib.dump(self.feature_pipeline, save_dir / "feature_pipeline.pkl")
        
        # Save LSTM model
        if self.lstm_model:
            torch.save(self.lstm_model.state_dict(), save_dir / "lstm_model.pth")
        
        # Save Transformer model
        if self.transformer_model:
            self.transformer_model.save_model(str(save_dir / "transformer"))
        
        # Save ensemble engine
        if self.ensemble_engine:
            self.ensemble_engine.save_ensemble(str(save_dir / "ensemble"))
        
        # Save configuration
        config_dict = {
            "use_lstm": self.config.use_lstm,
            "use_transformer": self.config.use_transformer,
            "use_ensemble": self.config.use_ensemble,
            "threshold_percentile": self.config.threshold_percentile,
            "min_anomaly_score": self.config.min_anomaly_score
        }
        
        with open(save_dir / "config.json", 'w') as f:
            json.dump(config_dict, f, indent=2)
        
        # Save training results
        with open(save_dir / "training_results.json", 'w') as f:
            json.dump(self.training_results, f, indent=2, default=str)
        
        logger.info(f"All models saved to {save_path}")
    
    def load_models(self, load_path: str):
        """Load all trained models"""
        load_dir = Path(load_path)
        
        # Load configuration
        with open(load_dir / "config.json", 'r') as f:
            config_dict = json.load(f)
        
        # Load feature pipeline
        if (load_dir / "feature_pipeline.pkl").exists():
            self.feature_pipeline = joblib.load(load_dir / "feature_pipeline.pkl")
        
        # Load LSTM model
        if (load_dir / "lstm_model.pth").exists():
            self.lstm_model = LSTMAutoencoder(self.config.lstm_config)
            self.lstm_model.load_state_dict(torch.load(load_dir / "lstm_model.pth"))
        
        # Load Transformer model
        transformer_dir = load_dir / "transformer"
        if transformer_dir.exists():
            self.transformer_model = TransformerAnomalyDetectionEngine()
            self.transformer_model.load_model(str(transformer_dir))
        
        # Load ensemble engine
        ensemble_dir = load_dir / "ensemble"
        if ensemble_dir.exists():
            self.ensemble_engine = EnsembleAnomalyScoringEngine()
            self.ensemble_engine.load_ensemble(str(ensemble_dir))
        
        # Load training results
        if (load_dir / "training_results.json").exists():
            with open(load_dir / "training_results.json", 'r') as f:
                self.training_results = json.load(f)
        
        self.is_trained = True
        logger.info(f"All models loaded from {load_path}")
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about all models"""
        info = {
            "is_trained": self.is_trained,
            "models_available": [],
            "training_results": self.training_results
        }
        
        if self.lstm_model:
            info["models_available"].append("lstm")
            info["lstm_info"] = self.lstm_model.get_model_info() if hasattr(self.lstm_model, 'get_model_info') else {"status": "trained"}
        
        if self.transformer_model:
            info["models_available"].append("transformer")
            info["transformer_info"] = self.transformer_model.get_model_info()
        
        if self.ensemble_engine:
            info["models_available"].append("ensemble")
            info["ensemble_info"] = self.ensemble_engine.get_ensemble_info()
        
        return info

# Backward compatibility
AnomalyDetectionConfig = EnhancedAnomalyDetectionConfig
AnomalyDetectionEngine = EnhancedAnomalyDetectionEngine
