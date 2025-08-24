"""
Feature Engineering Pipeline for Multi-UE Data

This module implements the feature engineering pipeline described in PRD Section 3.3.1
to convert raw Multi-UE data into structured multivariate time series features.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
import logging
from scipy import stats
from sklearn.preprocessing import StandardScaler, MinMaxScaler
import warnings

warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

@dataclass
class FeatureConfig:
    """Configuration for feature engineering"""
    window_size: int = 24  # Time window size for feature calculation
    overlap: float = 0.5   # Overlap between windows (0.0 to 1.0)
    features: List[str] = None  # List of features to calculate
    
    def __post_init__(self):
        if self.features is None:
            self.features = [
                'mean', 'std', 'min', 'max', 'median', 'skew', 'kurtosis',
                'range', 'iqr', 'cv', 'zscore_mean', 'zscore_std',
                'trend', 'seasonality', 'volatility'
            ]

class FeatureEngineeringPipeline:
    """
    Feature Engineering Pipeline for Multi-UE Data
    
    Converts raw time series data into structured multivariate features
    for anomaly detection using LSTM Autoencoder.
    """
    
    def __init__(self, config: Optional[FeatureConfig] = None):
        """
        Initialize the feature engineering pipeline
        
        Args:
            config: Feature engineering configuration
        """
        self.config = config or FeatureConfig()
        self.scaler = StandardScaler()
        self.is_fitted = False
        
    def extract_statistical_features(self, data: pd.Series, window: int) -> Dict[str, float]:
        """
        Extract statistical features from a time series window
        
        Args:
            data: Time series data
            window: Window size for feature calculation
            
        Returns:
            Dictionary of statistical features
        """
        if len(data) < window:
            # Pad with the last value if window is larger than data
            padded_data = np.pad(data, (window - len(data), 0), mode='edge')
        else:
            padded_data = data[-window:]
            
        features = {}
        
        # Basic statistical features
        features['mean'] = np.mean(padded_data)
        features['std'] = np.std(padded_data)
        features['min'] = np.min(padded_data)
        features['max'] = np.max(padded_data)
        features['median'] = np.median(padded_data)
        
        # Distribution features
        if len(padded_data) > 3:
            features['skew'] = stats.skew(padded_data)
            features['kurtosis'] = stats.kurtosis(padded_data)
        else:
            features['skew'] = 0.0
            features['kurtosis'] = 0.0
            
        # Range and variability features
        features['range'] = features['max'] - features['min']
        features['iqr'] = np.percentile(padded_data, 75) - np.percentile(padded_data, 25)
        
        # Coefficient of variation
        if features['mean'] != 0:
            features['cv'] = features['std'] / abs(features['mean'])
        else:
            features['cv'] = 0.0
            
        # Z-score based features
        if features['std'] > 0:
            z_scores = (padded_data - features['mean']) / features['std']
            features['zscore_mean'] = np.mean(z_scores)
            features['zscore_std'] = np.std(z_scores)
        else:
            features['zscore_mean'] = 0.0
            features['zscore_std'] = 0.0
            
        # Trend features
        if len(padded_data) > 1:
            # Linear trend
            x = np.arange(len(padded_data))
            slope, _, _, _, _ = stats.linregress(x, padded_data)
            features['trend'] = slope
        else:
            features['trend'] = 0.0
            
        # Seasonality features (simplified)
        if len(padded_data) >= 4:
            # Simple seasonality detection using autocorrelation
            autocorr = np.corrcoef(padded_data[:-1], padded_data[1:])[0, 1]
            features['seasonality'] = autocorr if not np.isnan(autocorr) else 0.0
        else:
            features['seasonality'] = 0.0
            
        # Volatility features
        if len(padded_data) > 1:
            returns = np.diff(padded_data)
            features['volatility'] = np.std(returns) if len(returns) > 0 else 0.0
        else:
            features['volatility'] = 0.0
            
        return features
    
    def create_sliding_windows(self, data: pd.DataFrame, window_size: int, overlap: float = 0.5) -> List[pd.DataFrame]:
        """
        Create sliding windows from time series data
        
        Args:
            data: Input DataFrame with time series data
            window_size: Size of each window
            overlap: Overlap between consecutive windows (0.0 to 1.0)
            
        Returns:
            List of windowed DataFrames
        """
        windows = []
        step_size = int(window_size * (1 - overlap))
        
        for i in range(0, len(data) - window_size + 1, step_size):
            window_data = data.iloc[i:i + window_size].copy()
            windows.append(window_data)
            
        return windows
    
    def extract_features_from_window(self, window_data: pd.DataFrame) -> Dict[str, float]:
        """
        Extract features from a single window of data
        
        Args:
            window_data: DataFrame containing window data
            
        Returns:
            Dictionary of extracted features
        """
        features = {}
        
        # Extract features for each column
        for column in window_data.columns:
            if column == 'timestamp':
                continue
                
            column_features = self.extract_statistical_features(
                window_data[column], 
                self.config.window_size
            )
            
            # Prefix features with column name
            for feature_name, value in column_features.items():
                features[f"{column}_{feature_name}"] = value
                
        return features
    
    def fit(self, data: pd.DataFrame) -> 'FeatureEngineeringPipeline':
        """
        Fit the feature engineering pipeline
        
        Args:
            data: Training data DataFrame
            
        Returns:
            Self for method chaining
        """
        logger.info("Fitting feature engineering pipeline...")
        
        # Extract features from training data
        training_features = self.extract_features(data)
        
        # Fit scaler on training features
        feature_matrix = pd.DataFrame(training_features)
        
        # Remove non-feature columns before fitting scaler
        feature_columns = [col for col in feature_matrix.columns 
                          if col not in ['window_id', 'timestamp']]
        
        self.scaler.fit(feature_matrix[feature_columns])
        
        self.is_fitted = True
        logger.info("Feature engineering pipeline fitted successfully")
        
        return self
    
    def extract_features(self, data: pd.DataFrame) -> List[Dict[str, float]]:
        """
        Extract features from time series data
        
        Args:
            data: Input DataFrame with time series data
            
        Returns:
            List of feature dictionaries for each window
        """
        logger.info(f"Extracting features from data with shape: {data.shape}")
        
        # Ensure data has timestamp column
        if 'timestamp' not in data.columns:
            data = data.reset_index()
            if 'index' in data.columns:
                data = data.rename(columns={'index': 'timestamp'})
        
        # Create sliding windows
        windows = self.create_sliding_windows(
            data, 
            self.config.window_size, 
            self.config.overlap
        )
        
        logger.info(f"Created {len(windows)} sliding windows")
        
        # Extract features from each window
        features_list = []
        for i, window_data in enumerate(windows):
            try:
                window_features = self.extract_features_from_window(window_data)
                window_features['window_id'] = i
                window_features['timestamp'] = window_data['timestamp'].iloc[-1]
                features_list.append(window_features)
            except Exception as e:
                logger.warning(f"Error extracting features from window {i}: {e}")
                continue
                
        logger.info(f"Successfully extracted features from {len(features_list)} windows")
        return features_list
    
    def transform(self, data: pd.DataFrame) -> np.ndarray:
        """
        Transform data into feature matrix
        
        Args:
            data: Input DataFrame
            
        Returns:
            Feature matrix as numpy array
        """
        if not self.is_fitted:
            raise ValueError("Pipeline must be fitted before transform")
            
        # Extract features
        features_list = self.extract_features(data)
        
        if not features_list:
            raise ValueError("No features extracted from data")
            
        # Convert to DataFrame
        features_df = pd.DataFrame(features_list)
        
        # Remove non-feature columns
        feature_columns = [col for col in features_df.columns 
                          if col not in ['window_id', 'timestamp']]
        
        # Scale features
        feature_matrix = self.scaler.transform(features_df[feature_columns])
        
        return feature_matrix
    
    def fit_transform(self, data: pd.DataFrame) -> np.ndarray:
        """
        Fit the pipeline and transform data
        
        Args:
            data: Input DataFrame
            
        Returns:
            Feature matrix as numpy array
        """
        return self.fit(data).transform(data)
    
    def get_feature_names(self, data: pd.DataFrame) -> List[str]:
        """
        Get feature names for the given data
        
        Args:
            data: Input DataFrame
            
        Returns:
            List of feature names
        """
        # Extract features from a small sample to get feature names
        sample_data = data.head(self.config.window_size * 2)
        features_list = self.extract_features(sample_data)
        
        if features_list:
            features_df = pd.DataFrame(features_list)
            feature_columns = [col for col in features_df.columns 
                              if col not in ['window_id', 'timestamp']]
            return feature_columns
        else:
            return []
    
    def create_sequences(self, feature_matrix: np.ndarray, sequence_length: int = 10) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create sequences for LSTM training
        
        Args:
            feature_matrix: Feature matrix
            sequence_length: Length of each sequence
            
        Returns:
            Tuple of (X, y) where X is input sequences and y is target sequences
        """
        X, y = [], []
        
        for i in range(len(feature_matrix) - sequence_length):
            X.append(feature_matrix[i:(i + sequence_length)])
            y.append(feature_matrix[i:(i + sequence_length)])  # Autoencoder: input = target
            
        return np.array(X), np.array(y)
    
    def generate_sample_data(self, n_samples: int = 1000, n_features: int = 5) -> pd.DataFrame:
        """
        Generate sample Multi-UE data for testing
        
        Args:
            n_samples: Number of samples
            n_features: Number of features
            
        Returns:
            Sample DataFrame
        """
        logger.info(f"Generating sample data: {n_samples} samples, {n_features} features")
        
        # Generate timestamps
        timestamps = pd.date_range(
            start='2024-01-01', 
            periods=n_samples, 
            freq='H'
        )
        
        # Generate sample data
        data = {}
        data['timestamp'] = timestamps
        
        # Generate different types of metrics
        metrics = {
            'response_time': (100, 20),      # (mean, std)
            'error_rate': (0.05, 0.02),      # (mean, std)
            'throughput': (1000, 200),       # (mean, std)
            'cpu_usage': (0.6, 0.15),        # (mean, std)
            'memory_usage': (0.7, 0.1)       # (mean, std)
        }
        
        for i, (metric_name, (mean, std)) in enumerate(metrics.items()):
            if i < n_features:
                # Generate normal data with some noise
                normal_data = np.random.normal(mean, std, n_samples)
                
                # Add some anomalies (outliers)
                anomaly_indices = np.random.choice(n_samples, size=n_samples//20, replace=False)
                normal_data[anomaly_indices] = np.random.normal(mean * 2, std * 2, len(anomaly_indices))
                
                data[metric_name] = normal_data
                
        return pd.DataFrame(data)
    
    def save_pipeline(self, filepath: str) -> None:
        """
        Save the fitted pipeline
        
        Args:
            filepath: Path to save the pipeline
        """
        import joblib
        
        if not self.is_fitted:
            raise ValueError("Pipeline must be fitted before saving")
            
        pipeline_data = {
            'config': self.config,
            'scaler': self.scaler,
            'is_fitted': self.is_fitted
        }
        
        joblib.dump(pipeline_data, filepath)
        logger.info(f"Pipeline saved to {filepath}")
    
    @classmethod
    def load_pipeline(cls, filepath: str) -> 'FeatureEngineeringPipeline':
        """
        Load a fitted pipeline
        
        Args:
            filepath: Path to the saved pipeline
            
        Returns:
            Loaded pipeline
        """
        import joblib
        
        pipeline_data = joblib.load(filepath)
        
        pipeline = cls(config=pipeline_data['config'])
        pipeline.scaler = pipeline_data['scaler']
        pipeline.is_fitted = pipeline_data['is_fitted']
        
        logger.info(f"Pipeline loaded from {filepath}")
        return pipeline
