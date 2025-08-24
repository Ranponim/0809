"""
Transformer Model for Anomaly Detection

Task 9: Backend: Implement Transformer Model and Ensemble Anomaly Scoring

This module implements a Transformer-based model for time-series anomaly detection.
The model uses self-attention mechanisms to capture long-range dependencies and
temporal patterns in the data.
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Union
from dataclasses import dataclass
from pathlib import Path
import joblib
import json

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error

logger = logging.getLogger(__name__)

@dataclass
class TransformerConfig:
    """Configuration for Transformer model"""
    input_size: int = 64
    d_model: int = 128
    nhead: int = 8
    num_layers: int = 4
    dim_feedforward: int = 512
    dropout: float = 0.1
    max_seq_length: int = 100
    batch_size: int = 32
    learning_rate: float = 0.001
    num_epochs: int = 100
    early_stopping_patience: int = 10
    device: str = None  # Will be set automatically based on GPU availability

class PositionalEncoding(nn.Module):
    """Positional encoding for Transformer model"""
    
    def __init__(self, d_model: int, max_len: int = 5000):
        super(PositionalEncoding, self).__init__()
        
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-np.log(10000.0) / d_model))
        
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0).transpose(0, 1)
        
        self.register_buffer('pe', pe)
    
    def forward(self, x):
        return x + self.pe[:x.size(0), :]

class TransformerAnomalyDetector(nn.Module):
    """Transformer-based anomaly detection model"""
    
    def __init__(self, config: TransformerConfig):
        super(TransformerAnomalyDetector, self).__init__()
        
        self.config = config
        
        # Input projection layer
        self.input_projection = nn.Linear(config.input_size, config.d_model)
        
        # Positional encoding
        self.pos_encoder = PositionalEncoding(config.d_model, config.max_seq_length)
        
        # Transformer encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=config.d_model,
            nhead=config.nhead,
            dim_feedforward=config.dim_feedforward,
            dropout=config.dropout,
            batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(
            encoder_layer, 
            num_layers=config.num_layers
        )
        
        # Output projection layers
        self.output_projection = nn.Linear(config.d_model, config.input_size)
        
        # Anomaly score head
        self.anomaly_head = nn.Sequential(
            nn.Linear(config.d_model, config.d_model // 2),
            nn.ReLU(),
            nn.Dropout(config.dropout),
            nn.Linear(config.d_model // 2, 1),
            nn.Sigmoid()
        )
        
        # Initialize weights
        self._init_weights()
    
    def _init_weights(self):
        """Initialize model weights"""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
    
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass of the model
        
        Args:
            x: Input tensor of shape (batch_size, seq_len, input_size)
            
        Returns:
            Tuple of (reconstructed_output, anomaly_scores)
        """
        batch_size, seq_len, input_size = x.shape
        
        # Input projection
        x = self.input_projection(x)  # (batch_size, seq_len, d_model)
        
        # Add positional encoding
        x = x.transpose(0, 1)  # (seq_len, batch_size, d_model)
        x = self.pos_encoder(x)
        x = x.transpose(0, 1)  # (batch_size, seq_len, d_model)
        
        # Transformer encoding
        encoded = self.transformer_encoder(x)  # (batch_size, seq_len, d_model)
        
        # Output projection for reconstruction
        reconstructed = self.output_projection(encoded)  # (batch_size, seq_len, input_size)
        
        # Anomaly score calculation
        # Use the last token representation for anomaly detection
        last_token = encoded[:, -1, :]  # (batch_size, d_model)
        anomaly_scores = self.anomaly_head(last_token)  # (batch_size, 1)
        
        return reconstructed, anomaly_scores

class TimeSeriesDataset(Dataset):
    """Dataset for time-series data"""
    
    def __init__(self, data: np.ndarray, seq_length: int = 50):
        self.data = data
        self.seq_length = seq_length
    
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        sequence = self.data[idx]
        return torch.FloatTensor(sequence)

class TransformerAnomalyDetectionEngine:
    """Engine for Transformer-based anomaly detection"""
    
    def __init__(self, config: Optional[TransformerConfig] = None):
        self.config = config or TransformerConfig()
        
        # GPU 사용 가능 여부 확인 및 설정
        if self.config.device is None:
            if torch.cuda.is_available():
                self.config.device = 'cuda'
                logger.info(f"GPU detected: {torch.cuda.get_device_name(0)}")
            else:
                self.config.device = 'cpu'
                logger.info("GPU not available, using CPU")
        
        self.model = None
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.training_history = []
        
        logger.info(f"Initializing Transformer Anomaly Detection Engine with config: {self.config}")
    
    def _prepare_data(self, data: np.ndarray) -> np.ndarray:
        """
        Prepare data for training/inference
        
        Args:
            data: Input data of shape (n_samples, n_features)
            
        Returns:
            Prepared data
        """
        if not self.is_fitted:
            # Fit scaler on training data
            self.scaler.fit(data)
            self.is_fitted = True
        
        # Transform data
        scaled_data = self.scaler.transform(data)
        return scaled_data
    
    def _create_sequences(self, data: np.ndarray, seq_length: int) -> np.ndarray:
        """
        Create sequences from time-series data
        
        Args:
            data: Input data of shape (n_samples, n_features)
            seq_length: Length of each sequence
            
        Returns:
            Sequences of shape (n_sequences, seq_length, n_features)
        """
        logger.info(f"Creating sequences from data shape {data.shape} with seq_length {seq_length}")
        
        if len(data) < seq_length:
            # If data is too short, pad with zeros
            logger.info(f"Data too short, padding with zeros")
            padded_data = np.zeros((seq_length, data.shape[1]))
            padded_data[:len(data)] = data
            result = padded_data.reshape(1, seq_length, -1)
            logger.info(f"Created padded sequence with shape: {result.shape}")
            return result
        
        sequences = []
        for i in range(len(data) - seq_length + 1):
            sequences.append(data[i:i + seq_length])
        
        if not sequences:
            # If no sequences can be created, create a single sequence from all data
            logger.info(f"No sequences created, creating single sequence from all data")
            if len(data) > 0:
                padded_data = np.zeros((seq_length, data.shape[1]))
                padded_data[:len(data)] = data
                result = padded_data.reshape(1, seq_length, -1)
                logger.info(f"Created single sequence with shape: {result.shape}")
                return result
            else:
                result = np.zeros((1, seq_length, 1))
                logger.info(f"Created empty sequence with shape: {result.shape}")
                return result
        
        result = np.array(sequences)
        logger.info(f"Created {len(sequences)} sequences with shape: {result.shape}")
        return result
    
    def fit(self, data: np.ndarray) -> Dict[str, List[float]]:
        """
        Train the Transformer model
        
        Args:
            data: Training data of shape (n_samples, n_features)
            
        Returns:
            Training history
        """
        logger.info("Starting Transformer model training...")
        
        # Prepare data
        scaled_data = self._prepare_data(data)
        
        # Create sequences
        sequences = self._create_sequences(scaled_data, self.config.max_seq_length)
        
        # Check if we have valid sequences
        if len(sequences) == 0:
            raise ValueError("No valid sequences could be created from the data")
        
        logger.info(f"Created sequences with shape: {sequences.shape}")
        
        # Update input size based on actual data
        self.config.input_size = sequences.shape[2]
        
        # Create dataset and dataloader
        dataset = TimeSeriesDataset(sequences, self.config.max_seq_length)
        
        # Ensure we have at least one sample
        if len(dataset) == 0:
            raise ValueError("Dataset is empty after creating sequences")
        
        batch_size = min(self.config.batch_size, len(sequences))
        logger.info(f"Creating DataLoader with {len(dataset)} samples and batch_size {batch_size}")
        
        dataloader = DataLoader(
            dataset, 
            batch_size=batch_size, 
            shuffle=True
        )
        
        # Initialize model
        self.model = TransformerAnomalyDetector(self.config)
        device = torch.device(self.config.device)
        self.model.to(device)
        
        # Loss function and optimizer
        reconstruction_criterion = nn.MSELoss()
        anomaly_criterion = nn.BCELoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=self.config.learning_rate)
        
        # Training loop
        best_loss = float('inf')
        patience_counter = 0
        
        for epoch in range(self.config.num_epochs):
            self.model.train()
            total_loss = 0.0
            
            for batch in dataloader:
                device = torch.device(self.config.device)
                batch = batch.to(device)
                
                # Forward pass
                reconstructed, anomaly_scores = self.model(batch)
                
                # Calculate losses
                reconstruction_loss = reconstruction_criterion(reconstructed, batch)
                
                # Create target anomaly scores (0 for normal data during training)
                target_scores = torch.zeros(batch.size(0), 1).to(device)
                anomaly_loss = anomaly_criterion(anomaly_scores, target_scores)
                
                # Total loss
                loss = reconstruction_loss + 0.1 * anomaly_loss
                
                # Backward pass
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
            
            avg_loss = total_loss / len(dataloader)
            self.training_history.append(avg_loss)
            
            logger.info(f"Epoch {epoch + 1}/{self.config.num_epochs}, Loss: {avg_loss:.6f}")
            
            # Early stopping
            if avg_loss < best_loss:
                best_loss = avg_loss
                patience_counter = 0
            else:
                patience_counter += 1
                
            if patience_counter >= self.config.early_stopping_patience:
                logger.info(f"Early stopping at epoch {epoch + 1}")
                break
        
        logger.info("Transformer model training completed")
        return {"loss": self.training_history}
    
    def predict(self, data: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Predict anomalies using the trained model
        
        Args:
            data: Input data of shape (n_samples, n_features)
            
        Returns:
            Dictionary containing predictions and scores
        """
        if self.model is None:
            raise ValueError("Model must be trained before making predictions")
        
        logger.info("Making predictions with Transformer model...")
        
        # Prepare data
        scaled_data = self._prepare_data(data)
        
        # Create sequences
        sequences = self._create_sequences(scaled_data, self.config.max_seq_length)
        
        # Create dataset and dataloader
        dataset = TimeSeriesDataset(sequences, self.config.max_seq_length)
        dataloader = DataLoader(dataset, batch_size=self.config.batch_size, shuffle=False)
        
        self.model.eval()
        all_reconstructions = []
        all_anomaly_scores = []
        
        with torch.no_grad():
            for batch in dataloader:
                device = torch.device(self.config.device)
                batch = batch.to(device)
                
                # Forward pass
                reconstructed, anomaly_scores = self.model(batch)
                
                all_reconstructions.append(reconstructed.cpu().numpy())
                all_anomaly_scores.append(anomaly_scores.cpu().numpy())
        
        # Concatenate results
        reconstructions = np.concatenate(all_reconstructions, axis=0)
        anomaly_scores = np.concatenate(all_anomaly_scores, axis=0)
        
        # Calculate reconstruction errors
        reconstruction_errors = np.mean((sequences - reconstructions) ** 2, axis=(1, 2))
        
        # Combine scores
        combined_scores = 0.7 * reconstruction_errors + 0.3 * anomaly_scores.flatten()
        
        # Determine anomalies (threshold-based)
        threshold = np.percentile(combined_scores, 95)  # 95th percentile as threshold
        anomalies = combined_scores > threshold
        
        logger.info(f"Prediction completed. Found {np.sum(anomalies)} anomalies out of {len(anomalies)} samples")
        
        return {
            "anomaly_scores": combined_scores,
            "reconstruction_errors": reconstruction_errors,
            "anomaly_scores_raw": anomaly_scores.flatten(),
            "anomalies": anomalies,
            "threshold": threshold,
            "reconstructions": reconstructions
        }
    
    def save_model(self, filepath: str):
        """Save the trained model"""
        if self.model is None:
            raise ValueError("No model to save")
        
        save_dir = Path(filepath)
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Save model state
        torch.save(self.model.state_dict(), save_dir / "transformer_model.pth")
        
        # Save scaler
        joblib.dump(self.scaler, save_dir / "transformer_scaler.pkl")
        
        # Save config
        config_dict = {
            "input_size": self.config.input_size,
            "d_model": self.config.d_model,
            "nhead": self.config.nhead,
            "num_layers": self.config.num_layers,
            "dim_feedforward": self.config.dim_feedforward,
            "dropout": self.config.dropout,
            "max_seq_length": self.config.max_seq_length
        }
        
        with open(save_dir / "transformer_config.json", 'w') as f:
            json.dump(config_dict, f, indent=2)
        
        logger.info(f"Transformer model saved to {filepath}")
    
    def load_model(self, filepath: str):
        """Load a trained model"""
        load_dir = Path(filepath)
        
        # Load config
        with open(load_dir / "transformer_config.json", 'r') as f:
            config_dict = json.load(f)
        
        self.config = TransformerConfig(**config_dict)
        
        # Load scaler
        self.scaler = joblib.load(load_dir / "transformer_scaler.pkl")
        self.is_fitted = True
        
        # Load model
        self.model = TransformerAnomalyDetector(self.config)
        self.model.load_state_dict(torch.load(load_dir / "transformer_model.pth"))
        device = torch.device(self.config.device)
        self.model.to(device)
        
        logger.info(f"Transformer model loaded from {filepath}")
    
    def get_model_info(self) -> Dict:
        """Get information about the model"""
        if self.model is None:
            return {"status": "not_trained"}
        
        total_params = sum(p.numel() for p in self.model.parameters())
        trainable_params = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
        
        return {
            "status": "trained",
            "total_parameters": total_params,
            "trainable_parameters": trainable_params,
            "config": {
                "input_size": self.config.input_size,
                "d_model": self.config.d_model,
                "nhead": self.config.nhead,
                "num_layers": self.config.num_layers,
                "max_seq_length": self.config.max_seq_length
            },
            "training_history": self.training_history
        }

def train_transformer_model(
    data: np.ndarray,
    config: Optional[TransformerConfig] = None,
    save_path: Optional[str] = None
) -> TransformerAnomalyDetectionEngine:
    """
    Train a Transformer anomaly detection model
    
    Args:
        data: Training data of shape (n_samples, n_features)
        config: Model configuration
        save_path: Path to save the trained model
        
    Returns:
        Trained TransformerAnomalyDetectionEngine
    """
    logger.info("Starting Transformer model training pipeline...")
    
    try:
        # Initialize engine
        engine = TransformerAnomalyDetectionEngine(config)
        
        # Train model
        history = engine.fit(data)
        
        # Save model if path provided
        if save_path:
            engine.save_model(save_path)
        
        logger.info("Transformer model training pipeline completed")
        return engine
        
    except Exception as e:
        logger.error(f"Error in train_transformer_model: {e}")
        raise

def load_transformer_model(filepath: str) -> TransformerAnomalyDetectionEngine:
    """
    Load a trained Transformer model
    
    Args:
        filepath: Path to the saved model
        
    Returns:
        Loaded TransformerAnomalyDetectionEngine
    """
    logger.info(f"Loading Transformer model from {filepath}")
    
    engine = TransformerAnomalyDetectionEngine()
    engine.load_model(filepath)
    
    return engine
