#!/usr/bin/env python3
"""
Test Script for Task 9: Backend: Implement Transformer Model and Ensemble Anomaly Scoring

This script tests the implementation of:
1. Transformer-based anomaly detection model
2. Ensemble scoring system
3. Enhanced anomaly detection engine integration
"""

import sys
import os
import logging
import numpy as np
import pandas as pd
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.ml.transformer_model import (
    TransformerAnomalyDetectionEngine, 
    TransformerConfig, 
    train_transformer_model,
    load_transformer_model
)
from app.ml.ensemble_scoring import (
    EnsembleAnomalyScoringEngine, 
    EnsembleConfig, 
    create_ensemble_engine,
    train_ensemble_engine
)
from app.ml.anomaly_detection import (
    EnhancedAnomalyDetectionEngine, 
    EnhancedAnomalyDetectionConfig
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_sample_data(n_samples: int = 1000, n_features: int = 64) -> np.ndarray:
    """
    Create sample time-series data for testing
    
    Args:
        n_samples: Number of samples
        n_features: Number of features
        
    Returns:
        Sample data array
    """
    logger.info(f"Creating sample data with {n_samples} samples and {n_features} features")
    
    # Generate base time series with some patterns
    time_steps = np.arange(n_samples)
    
    # Create multiple features with different patterns
    data = np.zeros((n_samples, n_features))
    
    for i in range(n_features):
        # Different patterns for different features
        if i % 4 == 0:
            # Sine wave pattern
            data[:, i] = np.sin(time_steps * 0.1 + i * 0.5) + np.random.normal(0, 0.1, n_samples)
        elif i % 4 == 1:
            # Linear trend
            data[:, i] = time_steps * 0.01 + np.random.normal(0, 0.1, n_samples)
        elif i % 4 == 2:
            # Random walk
            data[:, i] = np.cumsum(np.random.normal(0, 0.1, n_samples))
        else:
            # Stationary random
            data[:, i] = np.random.normal(0, 1, n_samples)
    
    # Add some anomalies
    anomaly_indices = np.random.choice(n_samples, size=int(n_samples * 0.05), replace=False)
    for idx in anomaly_indices:
        feature_idx = np.random.randint(0, n_features)
        data[idx, feature_idx] += np.random.normal(5, 1)  # Add large value
    
    logger.info(f"Sample data created with {len(anomaly_indices)} anomalies")
    return data

def test_transformer_model():
    """Test Transformer model implementation"""
    logger.info("=" * 50)
    logger.info("Testing Transformer Model")
    logger.info("=" * 50)
    
    try:
        # Create sample data
        data = create_sample_data(n_samples=500, n_features=32)
        
        # Create Transformer config
        config = TransformerConfig(
            input_size=32,
            d_model=64,
            nhead=4,
            num_layers=2,
            max_seq_length=50,
            batch_size=16,
            num_epochs=5,  # Reduced for testing
            early_stopping_patience=3
        )
        
        # Train Transformer model
        logger.info("Training Transformer model...")
        transformer_engine = train_transformer_model(data, config)
        
        # Test predictions
        logger.info("Testing Transformer predictions...")
        predictions = transformer_engine.predict(data)
        
        # Verify results
        assert "anomaly_scores" in predictions
        assert "anomalies" in predictions
        assert len(predictions["anomaly_scores"]) > 0
        assert len(predictions["anomalies"]) > 0
        
        logger.info(f"Transformer model test passed!")
        logger.info(f"Found {np.sum(predictions['anomalies'])} anomalies")
        logger.info(f"Score range: {predictions['anomaly_scores'].min():.4f} - {predictions['anomaly_scores'].max():.4f}")
        
        return True
        
    except Exception as e:
        logger.error(f"Transformer model test failed: {e}")
        return False

def test_ensemble_scoring():
    """Test Ensemble scoring system"""
    logger.info("=" * 50)
    logger.info("Testing Ensemble Scoring System")
    logger.info("=" * 50)
    
    try:
        # Create sample data
        data = create_sample_data(n_samples=300, n_features=16)
        
        # Create ensemble config
        config = EnsembleConfig(
            lstm_weight=0.4,
            transformer_weight=0.4,
            isolation_forest_weight=0.1,
            lof_weight=0.1,
            anomaly_threshold=0.7,
            ensemble_method="weighted_average"
        )
        
        # Create and train ensemble engine
        logger.info("Training ensemble engine...")
        ensemble_engine = create_ensemble_engine(config)
        
        # Train all models
        ensemble_engine.train_all_models(data)
        
        # Test predictions
        logger.info("Testing ensemble predictions...")
        predictions = ensemble_engine.predict(data)
        
        # Verify results
        assert "ensemble_scores" in predictions
        assert "individual_scores" in predictions
        assert "anomalies" in predictions
        assert len(predictions["ensemble_scores"]) > 0
        
        logger.info(f"Ensemble scoring test passed!")
        logger.info(f"Found {np.sum(predictions['anomalies'])} anomalies")
        logger.info(f"Ensemble score range: {predictions['ensemble_scores'].min():.4f} - {predictions['ensemble_scores'].max():.4f}")
        
        # Test performance evaluation
        logger.info("Testing performance evaluation...")
        # Create dummy labels (assuming 5% anomalies)
        labels = np.zeros(len(data))
        anomaly_indices = np.random.choice(len(data), size=int(len(data) * 0.05), replace=False)
        labels[anomaly_indices] = 1
        
        metrics = ensemble_engine.evaluate_performance(data, labels)
        
        logger.info(f"Performance evaluation completed. ROC AUC: {metrics.get('roc_auc', 'N/A')}")
        
        return True
        
    except Exception as e:
        logger.error(f"Ensemble scoring test failed: {e}")
        return False

def test_enhanced_anomaly_detection():
    """Test Enhanced anomaly detection engine"""
    logger.info("=" * 50)
    logger.info("Testing Enhanced Anomaly Detection Engine")
    logger.info("=" * 50)
    
    try:
        # Create sample DataFrame
        n_samples = 200
        n_features = 8
        
        # Create time series data
        timestamps = pd.date_range(start='2024-01-01', periods=n_samples, freq='H')
        data = pd.DataFrame()
        
        for i in range(n_features):
            if i % 2 == 0:
                data[f'feature_{i}'] = np.sin(np.arange(n_samples) * 0.1 + i) + np.random.normal(0, 0.1, n_samples)
            else:
                data[f'feature_{i}'] = np.cumsum(np.random.normal(0, 0.1, n_samples))
        
        data['timestamp'] = timestamps
        
        # Create enhanced config
        config = EnhancedAnomalyDetectionConfig(
            use_lstm=True,
            use_transformer=True,
            use_ensemble=True
        )
        
        # Create and train enhanced engine
        logger.info("Training enhanced anomaly detection engine...")
        engine = EnhancedAnomalyDetectionEngine(config)
        
        training_results = engine.train(data)
        
        # Test predictions
        logger.info("Testing enhanced predictions...")
        predictions = engine.predict(data)
        
        # Verify results
        assert "final_results" in predictions
        assert "individual_predictions" in predictions
        assert len(predictions["final_results"]["anomaly_scores"]) > 0
        
        logger.info(f"Enhanced anomaly detection test passed!")
        logger.info(f"Prediction method: {predictions['final_results']['prediction_method']}")
        logger.info(f"Found {predictions['final_results']['total_anomalies']} anomalies")
        
        # Test model info
        model_info = engine.get_model_info()
        logger.info(f"Model info: {model_info['models_available']}")
        
        return True
        
    except Exception as e:
        logger.error(f"Enhanced anomaly detection test failed: {e}")
        return False

def test_model_save_load():
    """Test model save and load functionality"""
    logger.info("=" * 50)
    logger.info("Testing Model Save/Load Functionality")
    logger.info("=" * 50)
    
    try:
        # Create sample data
        data = create_sample_data(n_samples=100, n_features=16)
        
        # Test Transformer model save/load
        logger.info("Testing Transformer model save/load...")
        config = TransformerConfig(
            input_size=16,
            d_model=32,
            nhead=2,
            num_layers=1,
            max_seq_length=30,
            num_epochs=3
        )
        
        # Train and save
        transformer_engine = train_transformer_model(data, config, save_path="./test_transformer")
        
        # Load and test
        loaded_engine = load_transformer_model("./test_transformer")
        predictions = loaded_engine.predict(data)
        
        assert len(predictions["anomaly_scores"]) > 0
        logger.info("Transformer model save/load test passed!")
        
        # Clean up
        import shutil
        shutil.rmtree("./test_transformer", ignore_errors=True)
        
        return True
        
    except Exception as e:
        logger.error(f"Model save/load test failed: {e}")
        return False

def main():
    """Run all tests"""
    logger.info("Starting Task 9 tests...")
    
    test_results = {}
    
    # Run individual tests
    test_results["transformer_model"] = test_transformer_model()
    test_results["ensemble_scoring"] = test_ensemble_scoring()
    test_results["enhanced_anomaly_detection"] = test_enhanced_anomaly_detection()
    test_results["model_save_load"] = test_model_save_load()
    
    # Summary
    logger.info("=" * 50)
    logger.info("TEST SUMMARY")
    logger.info("=" * 50)
    
    passed = sum(test_results.values())
    total = len(test_results)
    
    for test_name, result in test_results.items():
        status = "PASSED" if result else "FAILED"
        logger.info(f"{test_name}: {status}")
    
    logger.info(f"Overall: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("🎉 All Task 9 tests passed successfully!")
        return True
    else:
        logger.error("❌ Some tests failed!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
