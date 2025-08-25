"""
LSTM Autoencoder for Anomaly Detection

This module implements the stacked LSTM Autoencoder model described in PRD Section 3.3.2
for anomaly detection in time series data.
"""

import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Any
import logging
import os
import json
from dataclasses import dataclass
import warnings

warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

@dataclass
class LSTMConfig:
    """Configuration for LSTM Autoencoder"""
    input_size: int = 70  # Number of features
    hidden_size: int = 64  # Hidden layer size
    num_layers: int = 2   # Number of LSTM layers
    dropout: float = 0.2  # Dropout rate
    sequence_length: int = 10  # Length of input sequences
    learning_rate: float = 0.001
    batch_size: int = 32
    epochs: int = 100
    patience: int = 10  # Early stopping patience

class LSTMAutoencoder(nn.Module):
    """
    Stacked LSTM Autoencoder for Anomaly Detection
    
    The model consists of:
    1. Encoder: Multiple LSTM layers that compress the input
    2. Decoder: Multiple LSTM layers that reconstruct the input
    3. Output layer: Linear layer to map to original feature space
    """
    
    def __init__(self, config: LSTMConfig):
        """
        Initialize the LSTM Autoencoder
        
        Args:
            config: Model configuration
        """
        super(LSTMAutoencoder, self).__init__()
        
        self.config = config
        # GPU 사용 가능 여부 확인 및 설정
        if torch.cuda.is_available():
            self.device = torch.device('cuda')
            logger.info(f"GPU detected: {torch.cuda.get_device_name(0)}")
        else:
            self.device = torch.device('cpu')
            logger.info("GPU not available, using CPU")
        
        # Encoder LSTM layers
        self.encoder_lstm = nn.LSTM(
            input_size=config.input_size,
            hidden_size=config.hidden_size,
            num_layers=config.num_layers,
            dropout=config.dropout if config.num_layers > 1 else 0,
            batch_first=True,
            bidirectional=False
        )
        
        # Decoder LSTM layers
        self.decoder_lstm = nn.LSTM(
            input_size=config.hidden_size,
            hidden_size=config.hidden_size,
            num_layers=config.num_layers,
            dropout=config.dropout if config.num_layers > 1 else 0,
            batch_first=True,
            bidirectional=False
        )
        
        # Output projection layer
        self.output_layer = nn.Linear(config.hidden_size, config.input_size)
        
        # Move model to device
        self.to(self.device)
        
        logger.info(f"LSTM Autoencoder initialized on device: {self.device}")
        logger.info(f"Model parameters: {sum(p.numel() for p in self.parameters()):,}")
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass through the autoencoder
        
        Args:
            x: Input tensor of shape (batch_size, sequence_length, input_size)
            
        Returns:
            Reconstructed tensor of shape (batch_size, sequence_length, input_size)
        """
        batch_size, seq_len, input_size = x.size()
        
        # Encoder: compress the input
        encoder_output, (hidden, cell) = self.encoder_lstm(x)
        
        # Use the last hidden state as the compressed representation
        # Repeat it for the decoder
        decoder_input = hidden[-1].unsqueeze(1).repeat(1, seq_len, 1)
        
        # Decoder: reconstruct the input
        decoder_output, _ = self.decoder_lstm(decoder_input)
        
        # Project to original feature space
        reconstructed = self.output_layer(decoder_output)
        
        return reconstructed
    
    def encode(self, x: torch.Tensor) -> torch.Tensor:
        """
        Encode input to compressed representation
        
        Args:
            x: Input tensor
            
        Returns:
            Compressed representation
        """
        with torch.no_grad():
            _, (hidden, _) = self.encoder_lstm(x)
            return hidden[-1]  # Return last layer's hidden state
    
    def decode(self, encoded: torch.Tensor, sequence_length: int) -> torch.Tensor:
        """
        Decode compressed representation back to original space
        
        Args:
            encoded: Compressed representation
            sequence_length: Length of sequence to reconstruct
            
        Returns:
            Reconstructed sequence
        """
        with torch.no_grad():
            # Repeat encoded representation for sequence length
            decoder_input = encoded.unsqueeze(1).repeat(1, sequence_length, 1)
            
            # Decode
            decoder_output, _ = self.decoder_lstm(decoder_input)
            
            # Project to original space
            reconstructed = self.output_layer(decoder_output)
            
            return reconstructed

class LSTMAutoencoderTrainer:
    """
    Trainer for LSTM Autoencoder
    """
    
    def __init__(self, model: LSTMAutoencoder, config: LSTMConfig):
        """
        Initialize the trainer
        
        Args:
            model: LSTM Autoencoder model
            config: Training configuration
        """
        self.model = model
        self.config = config
        self.device = model.device
        
        # Loss function and optimizer
        self.criterion = nn.MSELoss()
        self.optimizer = optim.Adam(model.parameters(), lr=config.learning_rate)
        
        # Training history
        self.train_losses = []
        self.val_losses = []
        
        logger.info(f"Trainer initialized with learning rate: {config.learning_rate}")
        
    def train_epoch(self, train_loader: torch.utils.data.DataLoader) -> float:
        """
        Train for one epoch
        
        Args:
            train_loader: Training data loader
            
        Returns:
            Average training loss
        """
        self.model.train()
        total_loss = 0.0
        num_batches = 0
        
        for batch_idx, (data, target) in enumerate(train_loader):
            data, target = data.to(self.device), target.to(self.device)
            
            # Forward pass
            self.optimizer.zero_grad()
            reconstructed = self.model(data)
            loss = self.criterion(reconstructed, target)
            
            # Backward pass
            loss.backward()
            self.optimizer.step()
            
            total_loss += loss.item()
            num_batches += 1
            
            if batch_idx % 10 == 0:
                logger.debug(f"Batch {batch_idx}: Loss = {loss.item():.6f}")
        
        avg_loss = total_loss / num_batches
        return avg_loss
    
    def validate(self, val_loader: torch.utils.data.DataLoader) -> float:
        """
        Validate the model
        
        Args:
            val_loader: Validation data loader
            
        Returns:
            Average validation loss
        """
        self.model.eval()
        total_loss = 0.0
        num_batches = 0
        
        with torch.no_grad():
            for data, target in val_loader:
                data, target = data.to(self.device), target.to(self.device)
                
                reconstructed = self.model(data)
                loss = self.criterion(reconstructed, target)
                
                total_loss += loss.item()
                num_batches += 1
        
        avg_loss = total_loss / num_batches
        return avg_loss
    
    def train(self, train_loader: torch.utils.data.DataLoader, 
              val_loader: Optional[torch.utils.data.DataLoader] = None) -> Dict[str, List[float]]:
        """
        Train the model
        
        Args:
            train_loader: Training data loader
            val_loader: Validation data loader (optional)
            
        Returns:
            Training history
        """
        logger.info("Starting training...")
        
        best_val_loss = float('inf')
        patience_counter = 0
        
        for epoch in range(self.config.epochs):
            # Training
            train_loss = self.train_epoch(train_loader)
            self.train_losses.append(train_loss)
            
            # Validation
            if val_loader is not None:
                val_loss = self.validate(val_loader)
                self.val_losses.append(val_loss)
                
                logger.info(f"Epoch {epoch+1}/{self.config.epochs}: "
                           f"Train Loss = {train_loss:.6f}, "
                           f"Val Loss = {val_loss:.6f}")
                
                # Early stopping
                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    patience_counter = 0
                    # Save best model
                    self.save_model('best_model.pth')
                else:
                    patience_counter += 1
                    
                if patience_counter >= self.config.patience:
                    logger.info(f"Early stopping at epoch {epoch+1}")
                    break
            else:
                logger.info(f"Epoch {epoch+1}/{self.config.epochs}: "
                           f"Train Loss = {train_loss:.6f}")
        
        logger.info("Training completed!")
        
        return {
            'train_losses': self.train_losses,
            'val_losses': self.val_losses
        }
    
    def save_model(self, filepath: str) -> None:
        """
        Save the trained model
        
        Args:
            filepath: Path to save the model
        """
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'config': self.config,
            'train_losses': self.train_losses,
            'val_losses': self.val_losses
        }, filepath)
        logger.info(f"Model saved to {filepath}")
    
    @classmethod
    def load_model(cls, filepath: str) -> Tuple[LSTMAutoencoder, Dict[str, List[float]]]:
        """
        Load a trained model
        
        Args:
            filepath: Path to the saved model
            
        Returns:
            Tuple of (model, training_history)
        """
        checkpoint = torch.load(filepath, map_location='cpu')
        
        config = checkpoint['config']
        model = LSTMAutoencoder(config)
        model.load_state_dict(checkpoint['model_state_dict'])
        
        training_history = {
            'train_losses': checkpoint.get('train_losses', []),
            'val_losses': checkpoint.get('val_losses', [])
        }
        
        logger.info(f"Model loaded from {filepath}")
        return model, training_history

class AnomalyDetector:
    """
    Anomaly detector using LSTM Autoencoder
    """
    
    def __init__(self, model: LSTMAutoencoder, threshold: Optional[float] = None):
        """
        Initialize the anomaly detector
        
        Args:
            model: Trained LSTM Autoencoder
            threshold: Anomaly threshold (if None, will be computed from training data)
        """
        self.model = model
        self.threshold = threshold
        self.device = model.device
        
        # Set model to evaluation mode
        self.model.eval()
        
        logger.info(f"Anomaly detector initialized with threshold: {threshold}")
    
    def compute_reconstruction_error(self, data: torch.Tensor) -> torch.Tensor:
        """
        Compute reconstruction error for input data
        
        Args:
            data: Input tensor of shape (batch_size, sequence_length, input_size)
            
        Returns:
            Reconstruction error tensor
        """
        with torch.no_grad():
            reconstructed = self.model(data)
            error = torch.mean(torch.square(data - reconstructed), dim=(1, 2))
            return error
    
    def detect_anomalies(self, data: torch.Tensor, 
                        threshold: Optional[float] = None) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Detect anomalies in the data
        
        Args:
            data: Input tensor
            threshold: Anomaly threshold (if None, uses the default threshold)
            
        Returns:
            Tuple of (anomaly_scores, is_anomaly)
        """
        # Compute reconstruction errors
        anomaly_scores = self.compute_reconstruction_error(data)
        
        # Use provided threshold or default
        threshold = threshold or self.threshold
        if threshold is None:
            raise ValueError("Threshold must be provided or set during initialization")
        
        # Determine anomalies
        is_anomaly = anomaly_scores > threshold
        
        return anomaly_scores, is_anomaly
    
    def set_threshold_from_data(self, data: torch.Tensor, 
                               percentile: float = 95.0) -> None:
        """
        Set anomaly threshold from data
        
        Args:
            data: Training data to compute threshold from
            percentile: Percentile to use for threshold (default: 95th percentile)
        """
        logger.info(f"Computing threshold from data using {percentile}th percentile")
        
        # Compute reconstruction errors
        errors = self.compute_reconstruction_error(data)
        
        # Set threshold based on percentile
        self.threshold = torch.quantile(errors, percentile / 100.0).item()
        
        logger.info(f"Threshold set to: {self.threshold:.6f}")
    
    def predict(self, data: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Predict anomalies for numpy array input
        
        Args:
            data: Input data as numpy array
            
        Returns:
            Dictionary containing anomaly scores and predictions
        """
        # Convert to tensor
        if isinstance(data, np.ndarray):
            data = torch.FloatTensor(data)
        
        # Move to device
        data = data.to(self.device)
        
        # Detect anomalies
        anomaly_scores, is_anomaly = self.detect_anomalies(data)
        
        return {
            'anomaly_scores': anomaly_scores.cpu().numpy(),
            'is_anomaly': is_anomaly.cpu().numpy(),
            'threshold': self.threshold
        }
    
    def compute_reconstruction_error(self, data: torch.Tensor) -> torch.Tensor:
        """
        Compute reconstruction error for input data
        
        Args:
            data: Input tensor
            
        Returns:
            Reconstruction error tensor
        """
        self.eval()
        with torch.no_grad():
            reconstructed = self.forward(data)
            error = torch.mean((data - reconstructed) ** 2, dim=-1)
        return error
    
    def predict(self, data: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Predict anomalies for numpy array input
        
        Args:
            data: Input data as numpy array
            
        Returns:
            Dictionary containing anomaly scores and predictions
        """
        # Convert to tensor
        if isinstance(data, np.ndarray):
            data = torch.FloatTensor(data)
        
        # Move to device
        data = data.to(self.device)
        
        # Compute reconstruction errors
        errors = self.compute_reconstruction_error(data)
        
        # Convert to numpy
        error_np = errors.cpu().numpy()
        
        # Set threshold if not set (use 95th percentile)
        if not hasattr(self, 'threshold') or self.threshold is None:
            self.threshold = np.percentile(error_np, 95)
        
        # Determine anomalies
        is_anomaly = error_np > self.threshold
        
        return {
            'anomaly_scores': error_np,
            'is_anomaly': is_anomaly,
            'threshold': self.threshold
        }

def create_data_loader(X: np.ndarray, y: np.ndarray, 
                      batch_size: int, shuffle: bool = True) -> torch.utils.data.DataLoader:
    """
    Create PyTorch DataLoader from numpy arrays
    
    Args:
        X: Input features
        y: Target values
        batch_size: Batch size
        shuffle: Whether to shuffle the data
        
    Returns:
        PyTorch DataLoader
    """
    # Convert to tensors
    X_tensor = torch.FloatTensor(X)
    y_tensor = torch.FloatTensor(y)
    
    # Create dataset
    dataset = torch.utils.data.TensorDataset(X_tensor, y_tensor)
    
    # Create dataloader
    dataloader = torch.utils.data.DataLoader(
        dataset, 
        batch_size=batch_size, 
        shuffle=shuffle
    )
    
    return dataloader

def train_lstm_autoencoder(feature_matrix: np.ndarray, 
                          config: Optional[LSTMConfig] = None,
                          val_split: float = 0.2) -> Tuple[LSTMAutoencoder, Dict[str, List[float]]]:
    """
    Train LSTM Autoencoder on feature matrix
    
    Args:
        feature_matrix: Input feature matrix
        config: Model configuration
        val_split: Validation split ratio
        
    Returns:
        Tuple of (trained_model, training_history)
    """
    logger.info("Starting LSTM Autoencoder training...")
    
    # Create sequences
    sequence_length = config.sequence_length if config else 10
    X, y = [], []
    
    for i in range(len(feature_matrix) - sequence_length):
        X.append(feature_matrix[i:(i + sequence_length)])
        y.append(feature_matrix[i:(i + sequence_length)])
    
    X = np.array(X)
    y = np.array(y)
    
    logger.info(f"Created sequences: X shape = {X.shape}, y shape = {y.shape}")
    
    # Split into train and validation
    split_idx = int(len(X) * (1 - val_split))
    X_train, X_val = X[:split_idx], X[split_idx:]
    y_train, y_val = y[:split_idx], y[split_idx:]
    
    # Create data loaders
    train_loader = create_data_loader(X_train, y_train, config.batch_size if config else 32)
    val_loader = create_data_loader(X_val, y_val, config.batch_size if config else 32, shuffle=False)
    
    # Initialize model with correct input_size
    if config is None:
        config = LSTMConfig(input_size=X.shape[2])
    else:
        # Update input_size to match the actual feature matrix size
        config.input_size = X.shape[2]
        logger.info(f"Updated input_size to {config.input_size} to match feature matrix")
    
    model = LSTMAutoencoder(config)
    
    # Initialize trainer
    trainer = LSTMAutoencoderTrainer(model, config)
    
    # Train model
    history = trainer.train(train_loader, val_loader)
    
    return model, history
