"""
Integrated Analysis API Router

Task 6.4: Create comprehensive result structure and API endpoints
for the integrated analysis workflow.

This router provides endpoints for the complete analysis workflow that combines
all components: period identification, statistical analysis, anomaly detection, and Pass/Fail determination.
"""

import logging
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field, validator
from datetime import datetime
import uuid

from ..tasks import (
    execute_integrated_analysis,
    execute_quick_analysis,
    execute_custom_analysis,
    execute_batch_analysis
)
from ..analysis.integrated_workflow import WorkflowConfig
from ..analysis.pass_fail_engine import ThresholdConfig, PassFailRule

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrated-analysis", tags=["Integrated Analysis"])


class IntegratedAnalysisRequest(BaseModel):
    """Request model for integrated analysis"""
    period_data: Dict[str, List[float]] = Field(..., description="Period data for analysis")
    metrics: List[str] = Field(..., description="Metrics to analyze")
    config: Optional[WorkflowConfig] = Field(default=None, description="Workflow configuration")
    
    @validator('period_data')
    def validate_period_data(cls, v):
        if not v:
            raise ValueError("Period data cannot be empty")
        for period_name, period_values in v.items():
            if not period_values:
                raise ValueError(f"Period {period_name} cannot be empty")
            if len(period_values) < 2:
                raise ValueError(f"Period {period_name} must have at least 2 data points")
        return v
    
    @validator('metrics')
    def validate_metrics(cls, v):
        if not v:
            raise ValueError("Metrics cannot be empty")
        return v


class QuickAnalysisRequest(BaseModel):
    """Request model for quick analysis"""
    period_data: Dict[str, List[float]] = Field(..., description="Period data for analysis")
    metrics: List[str] = Field(..., description="Metrics to analyze")
    
    @validator('period_data')
    def validate_period_data(cls, v):
        if not v:
            raise ValueError("Period data cannot be empty")
        return v
    
    @validator('metrics')
    def validate_metrics(cls, v):
        if not v:
            raise ValueError("Metrics cannot be empty")
        return v


class CustomAnalysisRequest(BaseModel):
    """Request model for custom analysis"""
    period_data: Dict[str, List[float]] = Field(..., description="Period data for analysis")
    metrics: List[str] = Field(..., description="Metrics to analyze")
    pass_fail_rules: Optional[List[PassFailRule]] = Field(default=None, description="Custom Pass/Fail rules")
    thresholds: Optional[ThresholdConfig] = Field(default=None, description="Custom threshold configuration")
    
    @validator('period_data')
    def validate_period_data(cls, v):
        if not v:
            raise ValueError("Period data cannot be empty")
        return v
    
    @validator('metrics')
    def validate_metrics(cls, v):
        if not v:
            raise ValueError("Metrics cannot be empty")
        return v


class BatchAnalysisRequest(BaseModel):
    """Request model for batch analysis"""
    analyses: List[IntegratedAnalysisRequest] = Field(..., description="List of analysis requests")
    
    @validator('analyses')
    def validate_analyses(cls, v):
        if not v:
            raise ValueError("Analyses list cannot be empty")
        if len(v) > 10:
            raise ValueError("Maximum 10 analyses allowed per batch")
        return v


class AnalysisResponse(BaseModel):
    """Response model for analysis requests"""
    task_id: str = Field(..., description="Celery task ID")
    workflow_id: str = Field(..., description="Workflow execution ID")
    status: str = Field(..., description="Task status")
    message: str = Field(..., description="Response message")
    estimated_duration: Optional[float] = Field(default=None, description="Estimated duration in seconds")


class TaskStatusResponse(BaseModel):
    """Response model for task status"""
    task_id: str = Field(..., description="Celery task ID")
    status: str = Field(..., description="Task status")
    progress: Optional[Dict[str, Any]] = Field(default=None, description="Progress information")
    result: Optional[Dict[str, Any]] = Field(default=None, description="Analysis results")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    created_at: datetime = Field(..., description="Task creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class AnalysisResultResponse(BaseModel):
    """Response model for analysis results"""
    workflow_id: str = Field(..., description="Workflow execution ID")
    analysis_timestamp: datetime = Field(..., description="Analysis timestamp")
    final_status: str = Field(..., description="Final Pass/Fail status")
    final_score: float = Field(..., description="Overall analysis score")
    final_confidence: float = Field(..., description="Confidence in the result")
    recommendations: List[str] = Field(..., description="Recommendations")
    data_summary: Dict[str, Any] = Field(..., description="Data summary")
    execution_summary: Dict[str, Any] = Field(..., description="Execution statistics")
    component_results: Dict[str, Any] = Field(..., description="Results from each component")


@router.post("/execute", response_model=AnalysisResponse, summary="Execute Integrated Analysis")
async def execute_analysis(request: IntegratedAnalysisRequest):
    """
    Execute the complete integrated analysis workflow.
    
    This endpoint orchestrates:
    1. Period identification
    2. Statistical analysis
    3. Anomaly detection
    4. Pass/Fail determination
    
    Returns a task ID for tracking the analysis progress.
    """
    try:
        logger.info("Received integrated analysis request")
        
        # Convert request to task parameters
        task_params = {
            'period_data': request.period_data,
            'metrics': request.metrics,
            'config': request.config.dict() if request.config else None
        }
        
        # Execute Celery task
        task = execute_integrated_analysis.delay(**task_params)
        
        # Estimate duration based on data size
        total_points = sum(len(values) for values in request.period_data.values())
        estimated_duration = min(300, max(30, total_points * 2))  # 30-300 seconds
        
        return AnalysisResponse(
            task_id=task.id,
            workflow_id=str(uuid.uuid4()),
            status="PENDING",
            message="Integrated analysis started successfully",
            estimated_duration=estimated_duration
        )
        
    except Exception as e:
        logger.error(f"Error starting integrated analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quick", response_model=AnalysisResponse, summary="Execute Quick Analysis")
async def execute_quick(request: QuickAnalysisRequest):
    """
    Execute a quick analysis with optimized settings for faster results.
    
    This endpoint uses simplified settings to provide faster analysis results
    while maintaining accuracy for most use cases.
    """
    try:
        logger.info("Received quick analysis request")
        
        # Execute Celery task
        task = execute_quick_analysis.delay(
            period_data=request.period_data,
            metrics=request.metrics
        )
        
        # Estimate duration for quick analysis
        total_points = sum(len(values) for values in request.period_data.values())
        estimated_duration = min(120, max(15, total_points))  # 15-120 seconds
        
        return AnalysisResponse(
            task_id=task.id,
            workflow_id=str(uuid.uuid4()),
            status="PENDING",
            message="Quick analysis started successfully",
            estimated_duration=estimated_duration
        )
        
    except Exception as e:
        logger.error(f"Error starting quick analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/custom", response_model=AnalysisResponse, summary="Execute Custom Analysis")
async def execute_custom(request: CustomAnalysisRequest):
    """
    Execute analysis with custom Pass/Fail rules and thresholds.
    
    This endpoint allows users to specify custom rules and thresholds
    for more specialized analysis requirements.
    """
    try:
        logger.info("Received custom analysis request")
        
        # Convert custom rules to dictionaries
        pass_fail_rules = None
        if request.pass_fail_rules:
            pass_fail_rules = [rule.dict() for rule in request.pass_fail_rules]
        
        # Convert thresholds to dictionary
        thresholds = None
        if request.thresholds:
            thresholds = request.thresholds.dict()
        
        # Execute Celery task
        task = execute_custom_analysis.delay(
            period_data=request.period_data,
            metrics=request.metrics,
            pass_fail_rules=pass_fail_rules,
            thresholds=thresholds
        )
        
        # Estimate duration
        total_points = sum(len(values) for values in request.period_data.values())
        estimated_duration = min(400, max(40, total_points * 2.5))  # 40-400 seconds
        
        return AnalysisResponse(
            task_id=task.id,
            workflow_id=str(uuid.uuid4()),
            status="PENDING",
            message="Custom analysis started successfully",
            estimated_duration=estimated_duration
        )
        
    except Exception as e:
        logger.error(f"Error starting custom analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch", response_model=AnalysisResponse, summary="Execute Batch Analysis")
async def execute_batch(request: BatchAnalysisRequest):
    """
    Execute multiple analyses in batch.
    
    This endpoint processes multiple analysis requests in a single batch,
    providing efficiency for bulk analysis operations.
    """
    try:
        logger.info(f"Received batch analysis request with {len(request.analyses)} analyses")
        
        # Convert analyses to task format
        analyses = []
        for analysis in request.analyses:
            analysis_dict = {
                'period_data': analysis.period_data,
                'metrics': analysis.metrics,
                'config': analysis.config.dict() if analysis.config else None
            }
            analyses.append(analysis_dict)
        
        # Execute Celery task
        task = execute_batch_analysis.delay(analyses=analyses)
        
        # Estimate duration for batch
        total_analyses = len(analyses)
        estimated_duration = min(1800, max(60, total_analyses * 120))  # 1-30 minutes
        
        return AnalysisResponse(
            task_id=task.id,
            workflow_id=str(uuid.uuid4()),
            status="PENDING",
            message=f"Batch analysis started successfully with {total_analyses} analyses",
            estimated_duration=estimated_duration
        )
        
    except Exception as e:
        logger.error(f"Error starting batch analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task-status/{task_id}", response_model=TaskStatusResponse, summary="Get Task Status")
async def get_task_status(task_id: str):
    """
    Get the status and results of an analysis task.
    
    This endpoint provides real-time status updates and final results
    for analysis tasks.
    """
    try:
        from celery.result import AsyncResult
        
        # Get task result
        task_result = AsyncResult(task_id)
        
        # Prepare response
        response = TaskStatusResponse(
            task_id=task_id,
            status=task_result.status,
            created_at=datetime.now(),  # TODO: Get actual creation time
            updated_at=datetime.now()
        )
        
        # Add progress information if available
        if task_result.info and isinstance(task_result.info, dict):
            if 'progress' in task_result.info:
                response.progress = task_result.info['progress']
            elif 'current_step' in task_result.info:
                response.progress = {
                    'current_step': task_result.info['current_step'],
                    'total_steps': task_result.info.get('total_steps', 0),
                    'step_name': task_result.info.get('step_name', ''),
                    'overall_progress': task_result.info.get('overall_progress', 0)
                }
        
        # Add results if completed
        if task_result.ready():
            if task_result.successful():
                response.result = task_result.result
            else:
                response.error = str(task_result.info)
        
        return response
        
    except Exception as e:
        logger.error(f"Error getting task status for {task_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config/default", summary="Get Default Configuration")
async def get_default_config():
    """
    Get the default configuration for integrated analysis.
    
    This endpoint returns the default settings that can be used
    as a starting point for custom configurations.
    """
    try:
        default_config = WorkflowConfig()
        default_thresholds = ThresholdConfig()
        
        return {
            "workflow_config": default_config.dict(),
            "threshold_config": default_thresholds.__dict__,
            "description": "Default configuration for integrated analysis workflow"
        }
        
    except Exception as e:
        logger.error(f"Error getting default config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate", summary="Validate Analysis Request")
async def validate_request(request: IntegratedAnalysisRequest):
    """
    Validate an analysis request without executing it.
    
    This endpoint performs validation checks on the request data
    and configuration to identify potential issues before execution.
    """
    try:
        validation_result = {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "data_summary": {}
        }
        
        # Validate period data
        total_points = 0
        for period_name, period_values in request.period_data.items():
            total_points += len(period_values)
            
            # Check minimum data points
            if len(period_values) < 5:
                validation_result["warnings"].append(
                    f"Period {period_name} has only {len(period_values)} points (recommended: 10+)"
                )
        
        # Validate metrics
        if len(request.metrics) > 10:
            validation_result["warnings"].append(
                f"Large number of metrics ({len(request.metrics)}) may impact performance"
            )
        
        # Check configuration
        if request.config:
            if request.config.min_period_length < 2:
                validation_result["errors"].append("Minimum period length must be at least 2")
            
            if request.config.confidence_level < 0.5 or request.config.confidence_level > 0.99:
                validation_result["warnings"].append(
                    f"Confidence level {request.config.confidence_level} is outside typical range (0.5-0.99)"
                )
        
        # Update data summary
        validation_result["data_summary"] = {
            "num_periods": len(request.period_data),
            "total_data_points": total_points,
            "num_metrics": len(request.metrics),
            "avg_points_per_period": total_points / len(request.period_data) if request.period_data else 0
        }
        
        # Determine overall validity
        validation_result["is_valid"] = len(validation_result["errors"]) == 0
        
        return validation_result
        
    except Exception as e:
        logger.error(f"Error validating request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", summary="Health Check")
async def health_check():
    """
    Health check endpoint for the integrated analysis service.
    
    This endpoint verifies that all required components are available
    and the service is ready to process analysis requests.
    """
    try:
        # Check if Celery is available
        from celery import current_app
        celery_available = current_app.control.inspect().active() is not None
        
        # Check if required modules are available
        modules_available = True
        missing_modules = []
        
        try:
            from ..analysis.integrated_workflow import IntegratedAnalysisWorkflow
        except ImportError:
            modules_available = False
            missing_modules.append("integrated_workflow")
        
        try:
            from ..analysis.pass_fail_engine import PassFailEngine
        except ImportError:
            modules_available = False
            missing_modules.append("pass_fail_engine")
        
        try:
            from ..statistical_analysis.engine import StatisticalAnalysisEngine
        except ImportError:
            modules_available = False
            missing_modules.append("statistical_analysis")
        
        try:
            from ..ml.anomaly_detection import AnomalyDetectionEngine
        except ImportError:
            modules_available = False
            missing_modules.append("anomaly_detection")
        
        health_status = {
            "status": "healthy" if celery_available and modules_available else "unhealthy",
            "timestamp": datetime.now(),
            "celery_available": celery_available,
            "modules_available": modules_available,
            "missing_modules": missing_modules if not modules_available else [],
            "version": "1.0.0"
        }
        
        if not health_status["status"] == "healthy":
            raise HTTPException(status_code=503, detail="Service unhealthy")
        
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=str(e))
