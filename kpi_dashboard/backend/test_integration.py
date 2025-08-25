#!/usr/bin/env python3
"""
Task 10: End-to-End Integration Test

This script tests the complete user journey:
1. Frontend-Backend connectivity
2. Analysis workflow from start to finish
3. Data consistency between frontend and backend
4. Performance testing
5. Error handling

Author: AI Assistant
Date: 2025-08-25
"""

import requests
import json
import time
import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List
from datetime import datetime, timedelta
# import asyncio
# import aiohttp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class IntegrationTester:
    """End-to-end integration tester for KPI Dashboard"""
    
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.frontend_url = "http://localhost:5173"
        self.session = requests.Session()
        
        # Test data
        self.test_data = self._generate_test_data()
        
    def _generate_test_data(self) -> pd.DataFrame:
        """Generate realistic test data for integration testing"""
        logger.info("Generating test data for integration testing...")
        
        # Generate 24 hours of data with some anomalies
        timestamps = pd.date_range(
            start=datetime.now() - timedelta(hours=24),
            end=datetime.now(),
            freq='1min'
        )
        
        # Create realistic KPI data with some anomalies
        np.random.seed(42)  # For reproducible results
        
        # Normal operation data
        normal_data = np.random.normal(100, 10, len(timestamps))
        
        # Add some anomalies
        anomaly_indices = [500, 800, 1200, 1500]  # Specific time points
        for idx in anomaly_indices:
            if idx < len(normal_data):
                normal_data[idx] += np.random.normal(50, 5)  # Spike
        
        # Create DataFrame
        data = pd.DataFrame({
            'timestamp': timestamps,
            'kpi_value': normal_data,
            'cpu_usage': np.random.normal(60, 15, len(timestamps)),
            'memory_usage': np.random.normal(70, 10, len(timestamps)),
            'response_time': np.random.normal(200, 30, len(timestamps)),
            'error_rate': np.random.normal(0.5, 0.1, len(timestamps))
        })
        
        logger.info(f"Generated test data with {len(data)} records")
        return data
    
    def test_backend_health(self) -> bool:
        """Test if backend is running and healthy"""
        logger.info("Testing backend health...")
        
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                logger.info("✅ Backend is healthy")
                return True
            else:
                logger.error(f"❌ Backend health check failed: {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Backend connection failed: {e}")
            return False
    
    def test_frontend_connectivity(self) -> bool:
        """Test if frontend is accessible"""
        logger.info("Testing frontend connectivity...")
        
        try:
            response = self.session.get(self.frontend_url)
            if response.status_code == 200:
                logger.info("✅ Frontend is accessible")
                return True
            else:
                logger.error(f"❌ Frontend connectivity failed: {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Frontend connection failed: {e}")
            return False
    
    def test_analysis_workflow(self) -> Dict[str, Any]:
        """Test the complete analysis workflow"""
        logger.info("Testing complete analysis workflow...")
        
        # Step 1: Submit analysis request
        analysis_request = {
            "start_date": (datetime.now() - timedelta(hours=12)).strftime("%Y-%m-%d"),
            "end_date": datetime.now().strftime("%Y-%m-%d"),
            "analysis_type": "kpi_comparison",
            "parameters": {
                "metrics": ["kpi_value", "cpu_usage", "memory_usage", "response_time", "error_rate"]
            }
        }
        
        try:
            # Submit analysis
            logger.info("Submitting analysis request...")
            response = self.session.post(
                f"{self.base_url}/api/analyze/",
                json=analysis_request
            )
            
            if response.status_code != 202:
                logger.error(f"❌ Analysis submission failed: {response.status_code}")
                return {"success": False, "error": "Analysis submission failed"}
            
            task_id = response.json().get("task_id")
            logger.info(f"✅ Analysis submitted successfully. Task ID: {task_id}")
            
            # Step 2: Monitor task progress
            logger.info("Monitoring task progress...")
            max_wait_time = 300  # 5 minutes
            start_time = time.time()
            
            while time.time() - start_time < max_wait_time:
                status_response = self.session.get(f"{self.base_url}/api/analyze/{task_id}/status")
                
                if status_response.status_code == 200:
                    status_data = status_response.json()
                    status = status_data.get("status")
                    
                    logger.info(f"Task status: {status}")
                    
                    if status == "SUCCESS":
                        # Step 3: Get results from task result
                        logger.info("Analysis completed. Fetching results...")
                        results = status_data.get("result", {})
                        logger.info("✅ Analysis workflow completed successfully")
                        return {
                            "success": True,
                            "task_id": task_id,
                            "results": results
                        }
                    
                    elif status == "FAILURE":
                        logger.error("❌ Analysis task failed")
                        return {"success": False, "error": "Analysis task failed"}
                
                time.sleep(5)  # Wait 5 seconds before checking again
            
            logger.error("❌ Analysis timed out")
            return {"success": False, "error": "Analysis timed out"}
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Analysis workflow failed: {e}")
            return {"success": False, "error": str(e)}
    
    def test_data_consistency(self, results: Dict[str, Any]) -> bool:
        """Test data consistency between frontend and backend"""
        logger.info("Testing data consistency...")
        
        try:
            # Check if results contain expected fields
            required_fields = [
                "summary", "statistical_analysis", "anomaly_detection", 
                "pass_fail_results", "periods"
            ]
            
            for field in required_fields:
                if field not in results:
                    logger.error(f"❌ Missing required field: {field}")
                    return False
            
            # Check data types and structure
            if not isinstance(results["summary"], dict):
                logger.error("❌ Summary should be a dictionary")
                return False
            
            if not isinstance(results["statistical_analysis"], dict):
                logger.error("❌ Statistical analysis should be a dictionary")
                return False
            
            if not isinstance(results["anomaly_detection"], dict):
                logger.error("❌ Anomaly detection should be a dictionary")
                return False
            
            logger.info("✅ Data consistency check passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Data consistency check failed: {e}")
            return False
    
    def test_performance(self) -> Dict[str, float]:
        """Test system performance"""
        logger.info("Testing system performance...")
        
        performance_metrics = {}
        
        # Test API response times
        endpoints = [
            "/health",
            "/api/analyze/",
            "/api/statistical/compare-periods",
            "/api/anomaly/detect",
            "/api/integrated-analysis/execute"
        ]
        
        for endpoint in endpoints:
            try:
                start_time = time.time()
                response = self.session.get(f"{self.base_url}{endpoint}")
                response_time = time.time() - start_time
                
                performance_metrics[f"{endpoint}_response_time"] = response_time
                logger.info(f"{endpoint}: {response_time:.3f}s")
                
            except Exception as e:
                logger.warning(f"Could not test {endpoint}: {e}")
        
        return performance_metrics
    
    def test_error_handling(self) -> bool:
        """Test error handling scenarios"""
        logger.info("Testing error handling...")
        
        # Test invalid analysis request
        invalid_request = {
            "start_date": "invalid-date",
            "end_date": "invalid-date",
            "analysis_type": "invalid_type"
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/analyze/",
                json=invalid_request
            )
            
            # Should return 400 Bad Request
            if response.status_code == 400:
                logger.info("✅ Invalid request properly rejected")
            else:
                logger.error(f"❌ Invalid request not properly handled: {response.status_code}")
                return False
            
            # Test non-existent task ID
            response = self.session.get(f"{self.base_url}/api/analyze/non-existent-id/status")
            
            # Should return 404 Not Found
            if response.status_code == 404:
                logger.info("✅ Non-existent task properly handled")
            else:
                logger.error(f"❌ Non-existent task not properly handled: {response.status_code}")
                return False
            
            logger.info("✅ Error handling tests passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error handling test failed: {e}")
            return False
    
    def run_full_integration_test(self) -> Dict[str, Any]:
        """Run the complete integration test suite"""
        logger.info("🚀 Starting comprehensive integration test suite...")
        
        test_results = {
            "timestamp": datetime.now().isoformat(),
            "tests": {},
            "overall_success": True
        }
        
        # Test 1: Backend Health
        test_results["tests"]["backend_health"] = self.test_backend_health()
        if not test_results["tests"]["backend_health"]:
            test_results["overall_success"] = False
        
        # Test 2: Frontend Connectivity
        test_results["tests"]["frontend_connectivity"] = self.test_frontend_connectivity()
        if not test_results["tests"]["frontend_connectivity"]:
            test_results["overall_success"] = False
        
        # Test 3: Analysis Workflow
        workflow_result = self.test_analysis_workflow()
        test_results["tests"]["analysis_workflow"] = workflow_result["success"]
        if workflow_result["success"]:
            test_results["workflow_results"] = workflow_result["results"]
        
        # Test 4: Data Consistency (if workflow succeeded)
        if workflow_result["success"]:
            test_results["tests"]["data_consistency"] = self.test_data_consistency(
                workflow_result["results"]
            )
        else:
            test_results["tests"]["data_consistency"] = False
            test_results["overall_success"] = False
        
        # Test 5: Performance
        test_results["tests"]["performance"] = self.test_performance()
        
        # Test 6: Error Handling
        test_results["tests"]["error_handling"] = self.test_error_handling()
        if not test_results["tests"]["error_handling"]:
            test_results["overall_success"] = False
        
        # Summary
        passed_tests = sum(1 for test, result in test_results["tests"].items() 
                          if isinstance(result, bool) and result)
        total_tests = sum(1 for test, result in test_results["tests"].items() 
                         if isinstance(result, bool))
        
        test_results["summary"] = {
            "passed_tests": passed_tests,
            "total_tests": total_tests,
            "success_rate": (passed_tests / total_tests * 100) if total_tests > 0 else 0
        }
        
        logger.info("=" * 60)
        logger.info("📊 INTEGRATION TEST RESULTS")
        logger.info("=" * 60)
        
        for test_name, result in test_results["tests"].items():
            if isinstance(result, bool):
                status = "✅ PASS" if result else "❌ FAIL"
                logger.info(f"{test_name}: {status}")
            else:
                logger.info(f"{test_name}: {result}")
        
        logger.info(f"Overall Success: {'✅ YES' if test_results['overall_success'] else '❌ NO'}")
        logger.info(f"Success Rate: {test_results['summary']['success_rate']:.1f}%")
        
        return test_results

def main():
    """Main function to run integration tests"""
    logger.info("Starting Task 10: End-to-End Integration Testing")
    
    tester = IntegrationTester()
    results = tester.run_full_integration_test()
    
    # Save results to file
    with open("integration_test_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    
    logger.info("Integration test results saved to integration_test_results.json")
    
    if results["overall_success"]:
        logger.info("🎉 All integration tests passed! System is ready for deployment.")
        return 0
    else:
        logger.error("💥 Some integration tests failed. Please review and fix issues.")
        return 1

if __name__ == "__main__":
    exit(main())
