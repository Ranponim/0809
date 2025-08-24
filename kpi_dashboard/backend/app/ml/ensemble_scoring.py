"""
Ensemble Anomaly Scoring System

Task 9: Backend: Implement Transformer Model and Ensemble Anomaly Scoring

This module implements an ensemble scoring system that combines predictions from
multiple anomaly detection models (LSTM Autoencoder and Transformer) to provide
more robust and accurate anomaly detection.
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Union, Any
from dataclasses import dataclass
from pathlib import Path
import joblib
import json
from enum import Enum

from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, precision_recall_curve, average_precision_score
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor

from .lstm_autoencoder import LSTMAutoencoder, LSTMConfig, train_lstm_autoencoder
from .transformer_model import TransformerAnomalyDetectionEngine, TransformerConfig, train_transformer_model

logger = logging.getLogger(__name__)

class ModelType(Enum):
    """Types of anomaly detection models"""
    LSTM_AUTOENCODER = "lstm_autoencoder"
    TRANSFORMER = "transformer"
    ISOLATION_FOREST = "isolation_forest"
    LOCAL_OUTLIER_FACTOR = "local_outlier_factor"

@dataclass
class EnsembleConfig:
    """Configuration for ensemble scoring system"""
    # Model weights for ensemble
    lstm_weight: float = 0.4
    transformer_weight: float = 0.4
    isolation_forest_weight: float = 0.1
    lof_weight: float = 0.1
    
    # Threshold settings
    anomaly_threshold: float = 0.7
    high_anomaly_threshold: float = 0.9
    
    # Ensemble method
    ensemble_method: str = "weighted_average"  # "weighted_average", "voting", "max"
    
    # Model configurations
    lstm_config: Optional[LSTMConfig] = None
    transformer_config: Optional[TransformerConfig] = None
    
    # Isolation Forest parameters
    isolation_forest_contamination: float = 0.1
    isolation_forest_n_estimators: int = 100
    
    # Local Outlier Factor parameters
    lof_contamination: float = 0.1
    lof_n_neighbors: int = 20

class EnsembleAnomalyScoringEngine:
    """Engine for ensemble anomaly scoring"""
    
    def __init__(self, config: Optional[EnsembleConfig] = None):
        self.config = config or EnsembleConfig()
        self.models = {}
        self.scalers = {}
        self.is_trained = False
        self.ensemble_scores = None
        self.performance_metrics = {}
        
        logger.info(f"Initializing Ensemble Anomaly Scoring Engine with config: {self.config}")
    
    def _validate_weights(self):
        """Validate that model weights sum to 1.0"""
        total_weight = (
            self.config.lstm_weight +
            self.config.transformer_weight +
            self.config.isolation_forest_weight +
            self.config.lof_weight
        )
        
        if abs(total_weight - 1.0) > 1e-6:
            raise ValueError(f"Model weights must sum to 1.0, got {total_weight}")
    
    def _prepare_data(self, data: np.ndarray, model_type: ModelType) -> np.ndarray:
        """
        Prepare data for specific model type
        
        Args:
            data: Input data
            model_type: Type of model
            
        Returns:
            Prepared data
        """
        if model_type not in self.scalers:
            self.scalers[model_type] = StandardScaler()
            return self.scalers[model_type].fit_transform(data)
        else:
            return self.scalers[model_type].transform(data)
    
    def train_lstm_model(self, data: np.ndarray, save_path: Optional[str] = None):
        """Train LSTM Autoencoder model"""
        logger.info("Training LSTM Autoencoder model...")
        
        prepared_data = self._prepare_data(data, ModelType.LSTM_AUTOENCODER)
        
        # Train LSTM model
        lstm_model, history = train_lstm_autoencoder(
            prepared_data,
            config=self.config.lstm_config
        )
        
        # Save model if path provided
        if save_path:
            save_dir = Path(save_path)
            save_dir.mkdir(parents=True, exist_ok=True)
            torch.save(lstm_model.state_dict(), save_dir / "lstm_model.pth")
            joblib.dump(self.scalers[ModelType.LSTM_AUTOENCODER], save_dir / "lstm_scaler.pkl")
        
        self.models[ModelType.LSTM_AUTOENCODER] = lstm_model
        logger.info("LSTM Autoencoder model training completed")
    
    def train_transformer_model(self, data: np.ndarray, save_path: Optional[str] = None):
        """Train Transformer model"""
        logger.info("Training Transformer model...")
        
        prepared_data = self._prepare_data(data, ModelType.TRANSFORMER)
        
        # Train Transformer model
        transformer_model = train_transformer_model(
            prepared_data,
            config=self.config.transformer_config,
            save_path=save_path
        )
        
        self.models[ModelType.TRANSFORMER] = transformer_model
        logger.info("Transformer model training completed")
    
    def train_isolation_forest(self, data: np.ndarray, save_path: Optional[str] = None):
        """Train Isolation Forest model"""
        logger.info("Training Isolation Forest model...")
        
        prepared_data = self._prepare_data(data, ModelType.ISOLATION_FOREST)
        
        # Train Isolation Forest
        isolation_forest = IsolationForest(
            contamination=self.config.isolation_forest_contamination,
            n_estimators=self.config.isolation_forest_n_estimators,
            random_state=42
        )
        
        isolation_forest.fit(prepared_data)
        self.models[ModelType.ISOLATION_FOREST] = isolation_forest
        
        # Save model if path provided
        if save_path:
            save_dir = Path(save_path)
            save_dir.mkdir(parents=True, exist_ok=True)
            joblib.dump(isolation_forest, save_dir / "isolation_forest.pkl")
            joblib.dump(self.scalers[ModelType.ISOLATION_FOREST], save_dir / "isolation_forest_scaler.pkl")
        
        logger.info("Isolation Forest model training completed")
    
    def train_local_outlier_factor(self, data: np.ndarray, save_path: Optional[str] = None):
        """Train Local Outlier Factor model"""
        logger.info("Training Local Outlier Factor model...")
        
        prepared_data = self._prepare_data(data, ModelType.LOCAL_OUTLIER_FACTOR)
        
        # Train LOF
        lof = LocalOutlierFactor(
            contamination=self.config.lof_contamination,
            n_neighbors=self.config.lof_n_neighbors,
            novelty=True
        )
        
        lof.fit(prepared_data)
        self.models[ModelType.LOCAL_OUTLIER_FACTOR] = lof
        
        # Save model if path provided
        if save_path:
            save_dir = Path(save_path)
            save_dir.mkdir(parents=True, exist_ok=True)
            joblib.dump(lof, save_dir / "local_outlier_factor.pkl")
            joblib.dump(self.scalers[ModelType.LOCAL_OUTLIER_FACTOR], save_dir / "lof_scaler.pkl")
        
        logger.info("Local Outlier Factor model training completed")
    
    def train_all_models(self, data: np.ndarray, save_path: Optional[str] = None):
        """
        Train all models in the ensemble
        
        Args:
            data: Training data
            save_path: Base path for saving models
        """
        logger.info("Training all ensemble models...")
        
        # Validate weights
        self._validate_weights()
        
        # Train each model
        if save_path:
            base_path = Path(save_path)
            base_path.mkdir(parents=True, exist_ok=True)
        
        # Train LSTM Autoencoder
        lstm_path = str(base_path / "lstm") if save_path else None
        self.train_lstm_model(data, lstm_path)
        
        # Train Transformer
        transformer_path = str(base_path / "transformer") if save_path else None
        self.train_transformer_model(data, transformer_path)
        
        # Train Isolation Forest
        iforest_path = str(base_path / "isolation_forest") if save_path else None
        self.train_isolation_forest(data, iforest_path)
        
        # Train Local Outlier Factor
        lof_path = str(base_path / "local_outlier_factor") if save_path else None
        self.train_local_outlier_factor(data, lof_path)
        
        self.is_trained = True
        logger.info("All ensemble models training completed")
    
    def _get_lstm_scores(self, data: np.ndarray) -> np.ndarray:
        """Get anomaly scores from LSTM model"""
        if ModelType.LSTM_AUTOENCODER not in self.models:
            raise ValueError("LSTM model not trained")
        
        prepared_data = self._prepare_data(data, ModelType.LSTM_AUTOENCODER)
        lstm_model = self.models[ModelType.LSTM_AUTOENCODER]
        
        # Get predictions
        predictions = lstm_model.predict(prepared_data)
        return predictions["anomaly_scores"]
    
    def _get_transformer_scores(self, data: np.ndarray) -> np.ndarray:
        """Get anomaly scores from Transformer model"""
        if ModelType.TRANSFORMER not in self.models:
            raise ValueError("Transformer model not trained")
        
        prepared_data = self._prepare_data(data, ModelType.TRANSFORMER)
        transformer_model = self.models[ModelType.TRANSFORMER]
        
        # Get predictions
        predictions = transformer_model.predict(prepared_data)
        return predictions["anomaly_scores"]
    
    def _get_isolation_forest_scores(self, data: np.ndarray) -> np.ndarray:
        """Get anomaly scores from Isolation Forest model"""
        if ModelType.ISOLATION_FOREST not in self.models:
            raise ValueError("Isolation Forest model not trained")
        
        prepared_data = self._prepare_data(data, ModelType.ISOLATION_FOREST)
        isolation_forest = self.models[ModelType.ISOLATION_FOREST]
        
        # Get anomaly scores (negative values indicate anomalies)
        scores = isolation_forest.score_samples(prepared_data)
        
        # Convert to positive scores (higher = more anomalous)
        normalized_scores = 1 - (scores - scores.min()) / (scores.max() - scores.min())
        return normalized_scores
    
    def _get_lof_scores(self, data: np.ndarray) -> np.ndarray:
        """Get anomaly scores from Local Outlier Factor model"""
        if ModelType.LOCAL_OUTLIER_FACTOR not in self.models:
            raise ValueError("Local Outlier Factor model not trained")
        
        prepared_data = self._prepare_data(data, ModelType.LOCAL_OUTLIER_FACTOR)
        lof = self.models[ModelType.LOCAL_OUTLIER_FACTOR]
        
        # Get anomaly scores (negative values indicate anomalies)
        scores = lof.score_samples(prepared_data)
        
        # Convert to positive scores (higher = more anomalous)
        normalized_scores = 1 - (scores - scores.min()) / (scores.max() - scores.min())
        return normalized_scores
    
    def predict(self, data: np.ndarray) -> Dict[str, Any]:
        """
        Make ensemble predictions
        
        Args:
            data: Input data
            
        Returns:
            Dictionary containing ensemble predictions and scores
        """
        if not self.is_trained:
            raise ValueError("Models must be trained before making predictions")
        
        logger.info("Making ensemble predictions...")
        
        # Get individual model scores
        individual_scores = {}
        
        try:
            individual_scores[ModelType.LSTM_AUTOENCODER] = self._get_lstm_scores(data)
        except Exception as e:
            logger.warning(f"LSTM prediction failed: {e}")
            individual_scores[ModelType.LSTM_AUTOENCODER] = np.zeros(len(data))
        
        try:
            individual_scores[ModelType.TRANSFORMER] = self._get_transformer_scores(data)
        except Exception as e:
            logger.warning(f"Transformer prediction failed: {e}")
            individual_scores[ModelType.TRANSFORMER] = np.zeros(len(data))
        
        try:
            individual_scores[ModelType.ISOLATION_FOREST] = self._get_isolation_forest_scores(data)
        except Exception as e:
            logger.warning(f"Isolation Forest prediction failed: {e}")
            individual_scores[ModelType.ISOLATION_FOREST] = np.zeros(len(data))
        
        try:
            individual_scores[ModelType.LOCAL_OUTLIER_FACTOR] = self._get_lof_scores(data)
        except Exception as e:
            logger.warning(f"LOF prediction failed: {e}")
            individual_scores[ModelType.LOCAL_OUTLIER_FACTOR] = np.zeros(len(data))
        
        # Calculate ensemble scores
        if self.config.ensemble_method == "weighted_average":
            ensemble_scores = (
                self.config.lstm_weight * individual_scores[ModelType.LSTM_AUTOENCODER] +
                self.config.transformer_weight * individual_scores[ModelType.TRANSFORMER] +
                self.config.isolation_forest_weight * individual_scores[ModelType.ISOLATION_FOREST] +
                self.config.lof_weight * individual_scores[ModelType.LOCAL_OUTLIER_FACTOR]
            )
        elif self.config.ensemble_method == "voting":
            # Convert scores to binary predictions and take majority vote
            binary_predictions = np.zeros((len(data), 4))
            binary_predictions[:, 0] = individual_scores[ModelType.LSTM_AUTOENCODER] > self.config.anomaly_threshold
            binary_predictions[:, 1] = individual_scores[ModelType.TRANSFORMER] > self.config.anomaly_threshold
            binary_predictions[:, 2] = individual_scores[ModelType.ISOLATION_FOREST] > self.config.anomaly_threshold
            binary_predictions[:, 3] = individual_scores[ModelType.LOCAL_OUTLIER_FACTOR] > self.config.anomaly_threshold
            
            ensemble_scores = np.mean(binary_predictions, axis=1)
        elif self.config.ensemble_method == "max":
            # Take maximum score across all models
            ensemble_scores = np.maximum.reduce([
                individual_scores[ModelType.LSTM_AUTOENCODER],
                individual_scores[ModelType.TRANSFORMER],
                individual_scores[ModelType.ISOLATION_FOREST],
                individual_scores[ModelType.LOCAL_OUTLIER_FACTOR]
            ])
        else:
            raise ValueError(f"Unknown ensemble method: {self.config.ensemble_method}")
        
        # Determine anomalies
        anomalies = ensemble_scores > self.config.anomaly_threshold
        high_anomalies = ensemble_scores > self.config.high_anomaly_threshold
        
        # Calculate confidence scores
        confidence_scores = np.abs(ensemble_scores - 0.5) * 2  # Higher confidence for scores far from 0.5
        
        self.ensemble_scores = ensemble_scores
        
        logger.info(f"Ensemble prediction completed. Found {np.sum(anomalies)} anomalies out of {len(anomalies)} samples")
        
        return {
            "ensemble_scores": ensemble_scores,
            "individual_scores": individual_scores,
            "anomalies": anomalies,
            "high_anomalies": high_anomalies,
            "confidence_scores": confidence_scores,
            "anomaly_threshold": self.config.anomaly_threshold,
            "high_anomaly_threshold": self.config.high_anomaly_threshold,
            "ensemble_method": self.config.ensemble_method
        }
    
    def evaluate_performance(self, data: np.ndarray, labels: np.ndarray) -> Dict[str, float]:
        """
        Evaluate ensemble performance
        
        Args:
            data: Test data
            labels: True anomaly labels (1 for anomaly, 0 for normal)
            
        Returns:
            Performance metrics
        """
        logger.info("Evaluating ensemble performance...")
        
        # Get predictions
        predictions = self.predict(data)
        ensemble_scores = predictions["ensemble_scores"]
        
        # Calculate metrics
        metrics = {}
        
        # ROC AUC
        try:
            metrics["roc_auc"] = roc_auc_score(labels, ensemble_scores)
        except Exception as e:
            logger.warning(f"ROC AUC calculation failed: {e}")
            metrics["roc_auc"] = 0.0
        
        # Average Precision
        try:
            metrics["average_precision"] = average_precision_score(labels, ensemble_scores)
        except Exception as e:
            logger.warning(f"Average Precision calculation failed: {e}")
            metrics["average_precision"] = 0.0
        
        # Precision-Recall curve
        try:
            precision, recall, thresholds = precision_recall_curve(labels, ensemble_scores)
            metrics["precision"] = precision
            metrics["recall"] = recall
            metrics["thresholds"] = thresholds
        except Exception as e:
            logger.warning(f"Precision-Recall curve calculation failed: {e}")
            metrics["precision"] = []
            metrics["recall"] = []
            metrics["thresholds"] = []
        
        # Individual model performance
        individual_metrics = {}
        for model_type, scores in predictions["individual_scores"].items():
            try:
                individual_metrics[model_type.value] = {
                    "roc_auc": roc_auc_score(labels, scores),
                    "average_precision": average_precision_score(labels, scores)
                }
            except Exception as e:
                logger.warning(f"Individual model {model_type.value} evaluation failed: {e}")
                individual_metrics[model_type.value] = {"roc_auc": 0.0, "average_precision": 0.0}
        
        metrics["individual_model_metrics"] = individual_metrics
        self.performance_metrics = metrics
        
        logger.info(f"Performance evaluation completed. ROC AUC: {metrics['roc_auc']:.4f}")
        return metrics
    
    def save_ensemble(self, filepath: str):
        """Save the entire ensemble"""
        if not self.is_trained:
            raise ValueError("No trained ensemble to save")
        
        save_dir = Path(filepath)
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Save configuration
        config_dict = {
            "lstm_weight": self.config.lstm_weight,
            "transformer_weight": self.config.transformer_weight,
            "isolation_forest_weight": self.config.isolation_forest_weight,
            "lof_weight": self.config.lof_weight,
            "anomaly_threshold": self.config.anomaly_threshold,
            "high_anomaly_threshold": self.config.high_anomaly_threshold,
            "ensemble_method": self.config.ensemble_method,
            "isolation_forest_contamination": self.config.isolation_forest_contamination,
            "isolation_forest_n_estimators": self.config.isolation_forest_n_estimators,
            "lof_contamination": self.config.lof_contamination,
            "lof_n_neighbors": self.config.lof_n_neighbors
        }
        
        with open(save_dir / "ensemble_config.json", 'w') as f:
            json.dump(config_dict, f, indent=2)
        
        # Save performance metrics
        if self.performance_metrics:
            with open(save_dir / "performance_metrics.json", 'w') as f:
                json.dump(self.performance_metrics, f, indent=2, default=str)
        
        # Save ensemble scores
        if self.ensemble_scores is not None:
            np.save(save_dir / "ensemble_scores.npy", self.ensemble_scores)
        
        logger.info(f"Ensemble saved to {filepath}")
    
    def load_ensemble(self, filepath: str):
        """Load a saved ensemble"""
        load_dir = Path(filepath)
        
        # Load configuration
        with open(load_dir / "ensemble_config.json", 'r') as f:
            config_dict = json.load(f)
        
        self.config = EnsembleConfig(**config_dict)
        
        # Load models (assuming they were saved separately)
        # This would need to be implemented based on how models were saved
        
        # Load performance metrics
        metrics_file = load_dir / "performance_metrics.json"
        if metrics_file.exists():
            with open(metrics_file, 'r') as f:
                self.performance_metrics = json.load(f)
        
        # Load ensemble scores
        scores_file = load_dir / "ensemble_scores.npy"
        if scores_file.exists():
            self.ensemble_scores = np.load(scores_file)
        
        self.is_trained = True
        logger.info(f"Ensemble loaded from {filepath}")
    
    def get_ensemble_info(self) -> Dict:
        """Get information about the ensemble"""
        if not self.is_trained:
            return {"status": "not_trained"}
        
        model_info = {}
        for model_type in self.models:
            if hasattr(self.models[model_type], 'get_model_info'):
                model_info[model_type.value] = self.models[model_type].get_model_info()
            else:
                model_info[model_type.value] = {"status": "trained", "type": str(type(self.models[model_type]))}
        
        return {
            "status": "trained",
            "config": {
                "lstm_weight": self.config.lstm_weight,
                "transformer_weight": self.config.transformer_weight,
                "isolation_forest_weight": self.config.isolation_forest_weight,
                "lof_weight": self.config.lof_weight,
                "ensemble_method": self.config.ensemble_method,
                "anomaly_threshold": self.config.anomaly_threshold,
                "high_anomaly_threshold": self.config.high_anomaly_threshold
            },
            "models": model_info,
            "performance_metrics": self.performance_metrics
        }

def create_ensemble_engine(config: Optional[EnsembleConfig] = None) -> EnsembleAnomalyScoringEngine:
    """
    Create an ensemble anomaly scoring engine
    
    Args:
        config: Ensemble configuration
        
    Returns:
        EnsembleAnomalyScoringEngine instance
    """
    return EnsembleAnomalyScoringEngine(config)

def train_ensemble_engine(
    data: np.ndarray,
    config: Optional[EnsembleConfig] = None,
    save_path: Optional[str] = None
) -> EnsembleAnomalyScoringEngine:
    """
    Train an ensemble anomaly scoring engine
    
    Args:
        data: Training data
        config: Ensemble configuration
        save_path: Path to save the ensemble
        
    Returns:
        Trained EnsembleAnomalyScoringEngine
    """
    logger.info("Starting ensemble engine training...")
    
    # Create engine
    engine = create_ensemble_engine(config)
    
    # Train all models
    engine.train_all_models(data, save_path)
    
    # Save ensemble
    if save_path:
        engine.save_ensemble(save_path)
    
    logger.info("Ensemble engine training completed")
    return engine
