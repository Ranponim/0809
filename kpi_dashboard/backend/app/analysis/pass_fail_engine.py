"""
Pass/Fail Determination Engine

Task 6.1: Design and implement Pass/Fail determination engine
based on Z-Score, RSD, and anomaly score thresholds.

This module implements the configurable rules engine from PRD Section 3.4.1,
which flags a peg/cell as 'Fail' based on statistical and anomaly thresholds.
"""

import logging
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass
from enum import Enum
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field, validator

logger = logging.getLogger(__name__)


class PassFailStatus(str, Enum):
    """Pass/Fail status enumeration"""
    PASS = "PASS"
    FAIL = "FAIL"
    WARNING = "WARNING"
    INCONCLUSIVE = "INCONCLUSIVE"


class ThresholdType(str, Enum):
    """Threshold type enumeration"""
    Z_SCORE = "z_score"
    RSD = "rsd"
    ANOMALY_SCORE = "anomaly_score"
    STATISTICAL_SIGNIFICANCE = "statistical_significance"
    EFFECT_SIZE = "effect_size"


@dataclass
class ThresholdConfig:
    """Configuration for Pass/Fail thresholds"""
    z_score_threshold: float = 2.0  # Standard deviations
    rsd_threshold: float = 0.15  # 15% relative standard deviation
    anomaly_score_threshold: float = 0.8  # Anomaly detection threshold
    statistical_significance_threshold: float = 0.05  # p-value threshold
    effect_size_threshold: float = 0.5  # Cohen's d threshold
    min_data_points: int = 10  # Minimum data points required
    confidence_level: float = 0.95  # Confidence level for analysis


class PassFailRule(BaseModel):
    """Individual Pass/Fail rule definition"""
    name: str
    description: str
    threshold_type: ThresholdType
    threshold_value: float
    operator: str = Field(default=">=", description="Comparison operator: >=, <=, >, <, ==")
    weight: float = Field(default=1.0, description="Weight of this rule in overall decision")
    enabled: bool = Field(default=True, description="Whether this rule is active")
    
    @validator('operator')
    def validate_operator(cls, v):
        valid_operators = ['>=', '<=', '>', '<', '==', '!=']
        if v not in valid_operators:
            raise ValueError(f'Operator must be one of {valid_operators}')
        return v


class PassFailResult(BaseModel):
    """Result of Pass/Fail evaluation"""
    status: PassFailStatus
    score: float = Field(description="Overall Pass/Fail score (0-1, higher = more likely to fail)")
    confidence: float = Field(description="Confidence in the decision (0-1)")
    failed_rules: List[str] = Field(default_factory=list, description="Names of rules that failed")
    passed_rules: List[str] = Field(default_factory=list, description="Names of rules that passed")
    details: Dict[str, Any] = Field(default_factory=dict, description="Detailed evaluation results")
    recommendations: List[str] = Field(default_factory=list, description="Recommendations based on results")


class PassFailEngine:
    """
    Pass/Fail determination engine that evaluates statistical analysis
    and anomaly detection results to determine if a peg/cell passes or fails.
    """
    
    def __init__(self, config: Optional[ThresholdConfig] = None):
        """
        Initialize the Pass/Fail engine with configuration.
        
        Args:
            config: Threshold configuration, uses defaults if None
        """
        self.config = config or ThresholdConfig()
        self.rules: List[PassFailRule] = []
        self._setup_default_rules()
    
    def _setup_default_rules(self):
        """Setup default Pass/Fail rules"""
        self.rules = [
            PassFailRule(
                name="High Z-Score",
                description="Data points with Z-Score above threshold indicate outliers",
                threshold_type=ThresholdType.Z_SCORE,
                threshold_value=self.config.z_score_threshold,
                operator=">",
                weight=1.0
            ),
            PassFailRule(
                name="High RSD",
                description="Relative Standard Deviation above threshold indicates high variability",
                threshold_type=ThresholdType.RSD,
                threshold_value=self.config.rsd_threshold,
                operator=">",
                weight=1.0
            ),
            PassFailRule(
                name="Anomaly Detection",
                description="Anomaly score above threshold indicates detected anomalies",
                threshold_type=ThresholdType.ANOMALY_SCORE,
                threshold_value=self.config.anomaly_score_threshold,
                operator=">",
                weight=1.5
            ),
            PassFailRule(
                name="Statistical Significance",
                description="Statistical significance below threshold indicates no significant difference",
                threshold_type=ThresholdType.STATISTICAL_SIGNIFICANCE,
                threshold_value=self.config.statistical_significance_threshold,
                operator="<",
                weight=0.8
            ),
            PassFailRule(
                name="Effect Size",
                description="Effect size above threshold indicates meaningful difference",
                threshold_type=ThresholdType.EFFECT_SIZE,
                threshold_value=self.config.effect_size_threshold,
                operator=">",
                weight=0.7
            )
        ]
    
    def add_rule(self, rule: PassFailRule):
        """Add a custom rule to the engine"""
        self.rules.append(rule)
        logger.info(f"Added Pass/Fail rule: {rule.name}")
    
    def remove_rule(self, rule_name: str):
        """Remove a rule by name"""
        self.rules = [rule for rule in self.rules if rule.name != rule_name]
        logger.info(f"Removed Pass/Fail rule: {rule_name}")
    
    def update_config(self, config: ThresholdConfig):
        """Update the threshold configuration"""
        self.config = config
        self._setup_default_rules()  # Recreate rules with new thresholds
        logger.info("Updated Pass/Fail engine configuration")
    
    def _evaluate_rule(self, rule: PassFailRule, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate a single rule against the data.
        
        Args:
            rule: The rule to evaluate
            data: Dictionary containing analysis results
            
        Returns:
            Dictionary with evaluation results
        """
        result = {
            'rule_name': rule.name,
            'passed': False,
            'value': None,
            'threshold': rule.threshold_value,
            'operator': rule.operator,
            'weight': rule.weight
        }
        
        try:
            # Extract value based on threshold type
            if rule.threshold_type == ThresholdType.Z_SCORE:
                value = data.get('z_score', 0)
            elif rule.threshold_type == ThresholdType.RSD:
                value = data.get('rsd', 0)
            elif rule.threshold_type == ThresholdType.ANOMALY_SCORE:
                value = data.get('anomaly_score', 0)
            elif rule.threshold_type == ThresholdType.STATISTICAL_SIGNIFICANCE:
                value = data.get('p_value', 1.0)
            elif rule.threshold_type == ThresholdType.EFFECT_SIZE:
                value = data.get('effect_size', 0)
            else:
                logger.warning(f"Unknown threshold type: {rule.threshold_type}")
                return result
            
            result['value'] = value
            
            # Apply operator
            if rule.operator == '>=':
                result['passed'] = value >= rule.threshold_value
            elif rule.operator == '<=':
                result['passed'] = value <= rule.threshold_value
            elif rule.operator == '>':
                result['passed'] = value > rule.threshold_value
            elif rule.operator == '<':
                result['passed'] = value < rule.threshold_value
            elif rule.operator == '==':
                result['passed'] = value == rule.threshold_value
            elif rule.operator == '!=':
                result['passed'] = value != rule.threshold_value
                
        except Exception as e:
            logger.error(f"Error evaluating rule {rule.name}: {e}")
            result['error'] = str(e)
        
        return result
    
    def _calculate_rsd(self, data: List[float]) -> float:
        """Calculate Relative Standard Deviation"""
        if not data or len(data) < 2:
            return 0.0
        
        data_array = np.array(data)
        mean = np.mean(data_array)
        std = np.std(data_array, ddof=1)
        
        if mean == 0:
            return 0.0
        
        return std / abs(mean)
    
    def _calculate_z_score(self, value: float, data: List[float]) -> float:
        """Calculate Z-Score for a value relative to data distribution"""
        if not data or len(data) < 2:
            return 0.0
        
        data_array = np.array(data)
        mean = np.mean(data_array)
        std = np.std(data_array, ddof=1)
        
        if std == 0:
            return 0.0
        
        return (value - mean) / std
    
    def evaluate(self, 
                statistical_results: Dict[str, Any],
                anomaly_results: Dict[str, Any],
                period_data: Dict[str, List[float]]) -> PassFailResult:
        """
        Evaluate Pass/Fail status based on statistical and anomaly results.
        
        Args:
            statistical_results: Results from statistical analysis
            anomaly_results: Results from anomaly detection
            period_data: Raw period data for additional calculations
            
        Returns:
            PassFailResult with evaluation results
        """
        logger.info("Starting Pass/Fail evaluation")
        
        # Prepare evaluation data
        evaluation_data = {
            'z_score': 0.0,
            'rsd': 0.0,
            'anomaly_score': 0.0,
            'p_value': 1.0,
            'effect_size': 0.0
        }
        
        # Extract values from statistical results
        if statistical_results:
            # Get p-value from statistical tests
            p_values = []
            for test_result in statistical_results.get('test_results', []):
                if 'p_value' in test_result:
                    p_values.append(test_result['p_value'])
            
            if p_values:
                evaluation_data['p_value'] = min(p_values)  # Most significant result
            
            # Get effect size
            effect_sizes = []
            for test_result in statistical_results.get('test_results', []):
                if 'effect_size' in test_result and test_result['effect_size']:
                    effect_sizes.append(abs(test_result['effect_size']['value']))
            
            if effect_sizes:
                evaluation_data['effect_size'] = max(effect_sizes)  # Largest effect
        
        # Extract values from anomaly results
        if anomaly_results:
            evaluation_data['anomaly_score'] = anomaly_results.get('anomaly_score', 0.0)
        
        # Calculate additional metrics from period data
        if period_data:
            all_values = []
            for period_values in period_data.values():
                all_values.extend(period_values)
            
            if all_values:
                evaluation_data['rsd'] = self._calculate_rsd(all_values)
                
                # Calculate Z-Score for the most recent value
                if all_values:
                    evaluation_data['z_score'] = self._calculate_z_score(all_values[-1], all_values)
        
        # Evaluate each rule
        rule_results = []
        total_weight = 0
        failed_weight = 0
        failed_rules = []
        passed_rules = []
        
        for rule in self.rules:
            if not rule.enabled:
                continue
                
            rule_result = self._evaluate_rule(rule, evaluation_data)
            rule_results.append(rule_result)
            
            total_weight += rule.weight
            
            if rule_result['passed']:
                passed_rules.append(rule.name)
            else:
                failed_rules.append(rule.name)
                failed_weight += rule.weight
        
        # Calculate overall score and confidence
        if total_weight > 0:
            fail_score = failed_weight / total_weight
        else:
            fail_score = 0.0
        
        # Determine status based on score
        if fail_score >= 0.7:
            status = PassFailStatus.FAIL
        elif fail_score >= 0.4:
            status = PassFailStatus.WARNING
        elif fail_score >= 0.1:
            status = PassFailStatus.INCONCLUSIVE
        else:
            status = PassFailStatus.PASS
        
        # Calculate confidence based on data quality and rule coverage
        confidence = min(1.0, len(rule_results) / len(self.rules))
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            status, fail_score, failed_rules, evaluation_data
        )
        
        result = PassFailResult(
            status=status,
            score=fail_score,
            confidence=confidence,
            failed_rules=failed_rules,
            passed_rules=passed_rules,
            details={
                'evaluation_data': evaluation_data,
                'rule_results': rule_results,
                'total_weight': total_weight,
                'failed_weight': failed_weight
            },
            recommendations=recommendations
        )
        
        logger.info(f"Pass/Fail evaluation complete: {status} (score: {fail_score:.3f})")
        return result
    
    def _generate_recommendations(self, 
                                status: PassFailStatus,
                                score: float,
                                failed_rules: List[str],
                                evaluation_data: Dict[str, float]) -> List[str]:
        """Generate recommendations based on evaluation results"""
        recommendations = []
        
        if status == PassFailStatus.FAIL:
            recommendations.append("Immediate attention required - multiple criteria failed")
            
            if 'High Z-Score' in failed_rules:
                recommendations.append("Investigate outliers in the data")
            
            if 'High RSD' in failed_rules:
                recommendations.append("High variability detected - consider process stability")
            
            if 'Anomaly Detection' in failed_rules:
                recommendations.append("Anomalies detected - review recent changes or events")
        
        elif status == PassFailStatus.WARNING:
            recommendations.append("Monitor closely - some criteria exceeded thresholds")
            
            if evaluation_data['rsd'] > self.config.rsd_threshold * 0.8:
                recommendations.append("Variability approaching threshold - monitor trends")
        
        elif status == PassFailStatus.INCONCLUSIVE:
            recommendations.append("Insufficient data or mixed signals - collect more data")
        
        else:  # PASS
            recommendations.append("All criteria passed - system operating within expected parameters")
        
        return recommendations


def create_default_pass_fail_engine() -> PassFailEngine:
    """Create a default Pass/Fail engine with standard configuration"""
    config = ThresholdConfig()
    return PassFailEngine(config)


def test_pass_fail_engine():
    """Test the Pass/Fail engine with sample data"""
    engine = create_default_pass_fail_engine()
    
    # Sample data
    statistical_results = {
        'test_results': [
            {'p_value': 0.01, 'effect_size': {'value': 0.8}},
            {'p_value': 0.03, 'effect_size': {'value': 0.6}}
        ]
    }
    
    anomaly_results = {
        'anomaly_score': 0.9
    }
    
    period_data = {
        'period_1': [10, 12, 11, 13, 10],
        'period_2': [15, 18, 16, 17, 19]
    }
    
    result = engine.evaluate(statistical_results, anomaly_results, period_data)
    
    print(f"Pass/Fail Result: {result.status}")
    print(f"Score: {result.score:.3f}")
    print(f"Confidence: {result.confidence:.3f}")
    print(f"Failed Rules: {result.failed_rules}")
    print(f"Recommendations: {result.recommendations}")
    
    return result


if __name__ == "__main__":
    test_pass_fail_engine()
