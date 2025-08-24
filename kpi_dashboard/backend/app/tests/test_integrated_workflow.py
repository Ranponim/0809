"""
Integration Tests for Integrated Analysis Workflow

Task 6.6: Create integration tests for the Celery task and API endpoints.
Test the complete workflow: period identification, statistical analysis, 
anomaly detection, and Pass/Fail determination.
"""

import unittest
import sys
import os
import tempfile
import shutil
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
from datetime import datetime

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from app.analysis.pass_fail_engine import (
    PassFailEngine, 
    PassFailResult, 
    ThresholdConfig, 
    PassFailRule,
    ThresholdType,
    PassFailStatus
)
from app.analysis.integrated_workflow import (
    IntegratedAnalysisWorkflow,
    WorkflowConfig,
    IntegratedAnalysisResult
)
from app.routers.integrated_analysis import (
    IntegratedAnalysisRequest,
    QuickAnalysisRequest,
    CustomAnalysisRequest,
    BatchAnalysisRequest
)


class TestPassFailEngine(unittest.TestCase):
    """Test the Pass/Fail determination engine"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.config = ThresholdConfig(
            z_score_threshold=2.0,
            rsd_threshold=0.15,
            anomaly_score_threshold=0.8,
            statistical_significance_threshold=0.05,
            effect_size_threshold=0.5
        )
        self.engine = PassFailEngine(self.config)
    
    def test_engine_initialization(self):
        """Test Pass/Fail engine initialization"""
        self.assertIsNotNone(self.engine)
        self.assertEqual(len(self.engine.rules), 5)  # Default rules
        self.assertEqual(self.engine.config.z_score_threshold, 2.0)
    
    def test_rule_evaluation(self):
        """Test individual rule evaluation"""
        # Test Z-Score rule
        data = {'z_score': 2.5}
        rule = PassFailRule(
            name="Test Z-Score",
            description="Test rule",
            threshold_type=ThresholdType.Z_SCORE,
            threshold_value=2.0,
            operator=">"
        )
        
        result = self.engine._evaluate_rule(rule, data)
        self.assertTrue(result['passed'])  # 2.5 > 2.0, so rule passes
        self.assertEqual(result['value'], 2.5)
    
    def test_rsd_calculation(self):
        """Test RSD calculation"""
        data = [10, 12, 11, 13, 10]
        rsd = self.engine._calculate_rsd(data)
        self.assertGreater(rsd, 0)
        self.assertLess(rsd, 1)
    
    def test_z_score_calculation(self):
        """Test Z-Score calculation"""
        data = [10, 12, 11, 13, 10]
        z_score = self.engine._calculate_z_score(15, data)  # Outlier value
        self.assertGreater(abs(z_score), 1)  # Should be an outlier
    
    def test_pass_fail_evaluation(self):
        """Test complete Pass/Fail evaluation"""
        # Sample data that should result in FAIL
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
        
        result = self.engine.evaluate(statistical_results, anomaly_results, period_data)
        
        self.assertIsInstance(result, PassFailResult)
        self.assertIn(result.status, [PassFailStatus.PASS, PassFailStatus.FAIL, PassFailStatus.WARNING, PassFailStatus.INCONCLUSIVE])
        self.assertGreaterEqual(result.score, 0)
        self.assertLessEqual(result.score, 1)
        self.assertGreaterEqual(result.confidence, 0)
        self.assertLessEqual(result.confidence, 1)
    
    def test_custom_rules(self):
        """Test adding and evaluating custom rules"""
        custom_rule = PassFailRule(
            name="Custom Rule",
            description="Custom test rule",
            threshold_type=ThresholdType.Z_SCORE,
            threshold_value=1.5,
            operator=">",
            weight=2.0
        )
        
        self.engine.add_rule(custom_rule)
        self.assertEqual(len(self.engine.rules), 6)
        
        # Test rule removal
        self.engine.remove_rule("Custom Rule")
        self.assertEqual(len(self.engine.rules), 5)


class TestIntegratedWorkflow(unittest.TestCase):
    """Test the integrated analysis workflow"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.config = WorkflowConfig(
            min_period_length=5,
            confidence_level=0.95,
            include_comprehensive_analysis=True
        )
        self.workflow = IntegratedAnalysisWorkflow(self.config)
    
    def test_workflow_initialization(self):
        """Test workflow initialization"""
        self.assertIsNotNone(self.workflow)
        self.assertEqual(len(self.workflow.progress.steps), 6)
        self.assertEqual(self.workflow.progress.total_steps, 6)
    
    def test_data_validation(self):
        """Test data validation"""
        # Valid data
        period_data = {
            'period_1': [10, 12, 11, 13, 10],
            'period_2': [15, 18, 16, 17, 19]
        }
        metrics = ['value']
        
        result = self.workflow._validate_data(period_data, metrics)
        self.assertTrue(result['is_valid'])
        self.assertEqual(result['data_summary']['num_periods'], 2)
        self.assertEqual(result['data_summary']['total_data_points'], 10)
        
        # Invalid data
        invalid_data = {}
        result = self.workflow._validate_data(invalid_data, metrics)
        self.assertFalse(result['is_valid'])
        self.assertGreater(len(result['errors']), 0)
    
    def test_progress_tracking(self):
        """Test workflow progress tracking"""
        self.workflow._update_progress(0, "running")
        self.assertEqual(self.workflow.progress.steps[0].status, "running")
        self.assertIsNotNone(self.workflow.progress.steps[0].start_time)
        
        self.workflow._update_progress(0, "completed", {"test": "result"})
        self.assertEqual(self.workflow.progress.steps[0].status, "completed")
        self.assertIsNotNone(self.workflow.progress.steps[0].end_time)
        self.assertEqual(self.workflow.progress.steps[0].result, {"test": "result"})
    
    @patch('app.analysis.integrated_workflow.identify_stable_periods')
    def test_period_identification(self, mock_identify):
        """Test period identification step"""
        mock_identify.return_value = [
            {'start': 0, 'end': 4, 'stability_score': 0.8},
            {'start': 5, 'end': 9, 'stability_score': 0.9}
        ]
        
        period_data = {
            'period_1': [10, 12, 11, 13, 10],
            'period_2': [15, 18, 16, 17, 19]
        }
        
        result = self.workflow._identify_periods(period_data)
        self.assertIn('stable_periods', result)
        self.assertEqual(len(result['stable_periods']), 2)
        self.assertEqual(result['total_data_points'], 10)
    
    @patch('app.statistical_analysis.engine.StatisticalAnalysisEngine')
    def test_statistical_analysis(self, mock_engine_class):
        """Test statistical analysis step"""
        mock_engine = MagicMock()
        mock_engine.analyze_periods.return_value = {
            'test_results': [
                {'test_type': 't_test', 'p_value': 0.01, 'effect_size': {'value': 0.8}}
            ],
            'recommendations': ['Test recommendation']
        }
        mock_engine_class.return_value = mock_engine
        
        period_data = {
            'period_1': [10, 12, 11, 13, 10],
            'period_2': [15, 18, 16, 17, 19]
        }
        metrics = ['value']
        
        result = self.workflow._perform_statistical_analysis(period_data, metrics)
        self.assertIn('test_results', result)
        self.assertIn('recommendations', result)
    
    @patch('app.ml.anomaly_detection.AnomalyDetectionEngine')
    def test_anomaly_detection(self, mock_engine_class):
        """Test anomaly detection step"""
        mock_engine = MagicMock()
        mock_engine.detect_anomalies.return_value = {
            'anomaly_score': 0.7,
            'anomalies': [{'index': 5, 'score': 0.8}],
            'recommendations': ['Anomaly detected']
        }
        mock_engine_class.return_value = mock_engine
        
        period_data = {
            'period_1': [10, 12, 11, 13, 10],
            'period_2': [15, 18, 16, 17, 19]
        }
        
        result = self.workflow._perform_anomaly_detection(period_data)
        self.assertIn('anomaly_score', result)
        self.assertIn('anomalies', result)
        self.assertIn('recommendations', result)
    
    def test_result_integration(self):
        """Test result integration"""
        period_identification = {
            'stable_periods': [{'start': 0, 'end': 4}],
            'total_data_points': 10
        }
        
        statistical_analysis = {
            'test_results': [{'p_value': 0.01}],
            'recommendations': ['Statistical recommendation']
        }
        
        anomaly_detection = {
            'anomaly_score': 0.7,
            'recommendations': ['Anomaly recommendation']
        }
        
        pass_fail_result = PassFailResult(
            status=PassFailStatus.FAIL,
            score=0.8,
            confidence=0.9,
            failed_rules=['High Z-Score'],
            passed_rules=['Effect Size'],
            details={},
            recommendations=['Pass/Fail recommendation']
        )
        
        result = self.workflow._integrate_results(
            period_identification, statistical_analysis, anomaly_detection, pass_fail_result
        )
        
        self.assertEqual(result['final_status'], 'FAIL')
        self.assertEqual(result['final_score'], 0.8)
        self.assertEqual(result['final_confidence'], 0.9)
        self.assertIn('Pass/Fail recommendation', result['final_recommendations'])
        self.assertIn('Statistical recommendation', result['final_recommendations'])
        self.assertIn('Anomaly recommendation', result['final_recommendations'])


class TestAPIEndpoints(unittest.TestCase):
    """Test the API endpoints"""
    
    def test_integrated_analysis_request_validation(self):
        """Test request model validation"""
        # Valid request
        valid_request = IntegratedAnalysisRequest(
            period_data={
                'period_1': [10, 12, 11, 13, 10],
                'period_2': [15, 18, 16, 17, 19]
            },
            metrics=['value']
        )
        self.assertIsNotNone(valid_request)
        
        # Invalid request - empty period data
        with self.assertRaises(ValueError):
            IntegratedAnalysisRequest(
                period_data={},
                metrics=['value']
            )
        
        # Invalid request - empty metrics
        with self.assertRaises(ValueError):
            IntegratedAnalysisRequest(
                period_data={'period_1': [10, 12, 11, 13, 10]},
                metrics=[]
            )
    
    def test_quick_analysis_request_validation(self):
        """Test quick analysis request validation"""
        valid_request = QuickAnalysisRequest(
            period_data={
                'period_1': [10, 12, 11, 13, 10],
                'period_2': [15, 18, 16, 17, 19]
            },
            metrics=['value']
        )
        self.assertIsNotNone(valid_request)
    
    def test_custom_analysis_request_validation(self):
        """Test custom analysis request validation"""
        custom_rule = PassFailRule(
            name="Custom Rule",
            description="Custom test rule",
            threshold_type=ThresholdType.Z_SCORE,
            threshold_value=1.5,
            operator=">"
        )
        
        valid_request = CustomAnalysisRequest(
            period_data={
                'period_1': [10, 12, 11, 13, 10],
                'period_2': [15, 18, 16, 17, 19]
            },
            metrics=['value'],
            pass_fail_rules=[custom_rule],
            thresholds=ThresholdConfig(z_score_threshold=1.5)
        )
        self.assertIsNotNone(valid_request)
    
    def test_batch_analysis_request_validation(self):
        """Test batch analysis request validation"""
        analysis_request = IntegratedAnalysisRequest(
            period_data={
                'period_1': [10, 12, 11, 13, 10],
                'period_2': [15, 18, 16, 17, 19]
            },
            metrics=['value']
        )
        
        valid_request = BatchAnalysisRequest(
            analyses=[analysis_request]
        )
        self.assertIsNotNone(valid_request)
        
        # Test maximum limit
        with self.assertRaises(ValueError):
            BatchAnalysisRequest(
                analyses=[analysis_request] * 11  # More than 10
            )


class TestEndToEndWorkflow(unittest.TestCase):
    """Test the complete end-to-end workflow"""
    
    @patch('app.analysis.integrated_workflow.identify_stable_periods')
    @patch('app.statistical_analysis.engine.StatisticalAnalysisEngine')
    @patch('app.ml.anomaly_detection.AnomalyDetectionEngine')
    def test_complete_workflow_execution(self, mock_anomaly_class, mock_stat_class, mock_identify):
        """Test complete workflow execution with mocked components"""
        # Mock period identification
        mock_identify.return_value = [
            {'start': 0, 'end': 4, 'stability_score': 0.8},
            {'start': 5, 'end': 9, 'stability_score': 0.9}
        ]
        
        # Mock statistical analysis
        mock_stat_engine = MagicMock()
        mock_stat_engine.analyze_periods.return_value = {
            'test_results': [
                {'test_type': 't_test', 'p_value': 0.01, 'effect_size': {'value': 0.8}}
            ],
            'recommendations': ['Statistical recommendation']
        }
        mock_stat_class.return_value = mock_stat_engine
        
        # Mock anomaly detection
        mock_anomaly_engine = MagicMock()
        mock_anomaly_engine.detect_anomalies.return_value = {
            'anomaly_score': 0.7,
            'anomalies': [{'index': 5, 'score': 0.8}],
            'recommendations': ['Anomaly recommendation']
        }
        mock_anomaly_class.return_value = mock_anomaly_engine
        
        # Create workflow
        config = WorkflowConfig(
            min_period_length=5,
            confidence_level=0.95,
            include_comprehensive_analysis=True
        )
        workflow = IntegratedAnalysisWorkflow(config)
        
        # Test data
        period_data = {
            'period_1': [10, 12, 11, 13, 10],
            'period_2': [15, 18, 16, 17, 19]
        }
        metrics = ['value']
        workflow_id = "test-workflow-001"
        
        # Execute workflow
        result = workflow.execute(period_data, metrics, workflow_id)
        
        # Verify result structure
        self.assertIsInstance(result, IntegratedAnalysisResult)
        self.assertEqual(result.workflow_id, workflow_id)
        self.assertIsNotNone(result.analysis_timestamp)
        self.assertIn(result.final_status, ['PASS', 'FAIL', 'WARNING', 'INCONCLUSIVE'])
        self.assertGreaterEqual(result.final_score, 0)
        self.assertLessEqual(result.final_score, 1)
        self.assertGreaterEqual(result.final_confidence, 0)
        self.assertLessEqual(result.final_confidence, 1)
        self.assertIsInstance(result.recommendations, list)
        
        # Verify component results
        self.assertIsNotNone(result.period_identification)
        self.assertIsNotNone(result.statistical_analysis)
        self.assertIsNotNone(result.anomaly_detection)
        self.assertIsNotNone(result.pass_fail_evaluation)
        
        # Verify progress tracking
        self.assertEqual(len(result.progress.steps), 6)
        completed_steps = [s for s in result.progress.steps if s.status == 'completed']
        self.assertEqual(len(completed_steps), 6)  # All steps should be completed
        
        # Verify execution summary
        self.assertIsNotNone(result.execution_summary)
        self.assertIn('total_duration', result.execution_summary)
        self.assertIn('steps_completed', result.execution_summary)
        self.assertEqual(result.execution_summary['steps_completed'], 6)


def run_tests():
    """Run all tests"""
    # Create test suite
    test_suite = unittest.TestSuite()
    
    # Add test classes
    test_suite.addTest(unittest.makeSuite(TestPassFailEngine))
    test_suite.addTest(unittest.makeSuite(TestIntegratedWorkflow))
    test_suite.addTest(unittest.makeSuite(TestAPIEndpoints))
    test_suite.addTest(unittest.makeSuite(TestEndToEndWorkflow))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
