"""
Pydantic Schemas for SIH 26079 Forecast Bust Detection API
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ContributingFactor(BaseModel):
    feature_id: str
    feature_name: str
    observed_value: float
    raw_impact: float
    impact_pct: float
    risk_contribution: str
    explanation: str

class PredictionRequest(BaseModel):
    region_id: Optional[str] = "IND-WB-ODI"
    forecast_day: int = Field(default=5, ge=1, le=10, description="Lead time in days (1 to 10)")
    temp_forecast: float = Field(default=29.0, description="2m Temperature forecast in °C")
    precip_forecast: float = Field(default=25.0, description="24h Precipitation forecast in mm")
    mslp: float = Field(default=1004.0, description="Mean Sea Level Pressure in hPa")
    pressure_tendency_24h: float = Field(default=-3.5, description="24h Pressure tendency in hPa")
    rh_850: float = Field(default=80.0, ge=10.0, le=100.0, description="Relative humidity at 850 hPa in %")
    wind_shear_850_200: float = Field(default=18.0, description="Vertical wind shear in m/s")
    cape_j_kg: float = Field(default=2400.0, description="Convective Available Potential Energy in J/kg")
    ensemble_spread: float = Field(default=2.4, description="NWP Ensemble Spread / Variance index")

class PredictionResponse(BaseModel):
    region_id: Optional[str]
    forecast_day: int
    bust_probability: float
    confidence_score: float
    risk_level: str
    confidence_level: str
    contributing_factors: List[ContributingFactor]
    summary: str

class RegionMeta(BaseModel):
    id: str
    name: str
    states: str
    zone: str
    centroid: List[float]
    svg_path: str
    climate_risk: str
    baseline_temp: float
    baseline_rain: float

class RegionRiskSummary(BaseModel):
    region_id: str
    region_name: str
    zone: str
    forecast_day: int
    bust_probability: float
    confidence_score: float
    risk_level: str
    confidence_level: str
    dominant_factor: str
    precip_forecast: float
    temp_forecast: float
    ensemble_spread: float
    cape_j_kg: float
    pressure_tendency_24h: float
    simulated_actual: Optional[Dict[str, Any]] = None

class RiskMapResponse(BaseModel):
    forecast_day: int
    scenario_id: str
    scenario_name: str
    total_regions: int
    high_confidence_count: int
    medium_confidence_count: int
    low_confidence_count: int
    severe_risk_count: int
    national_mean_confidence: float
    national_mean_bust_prob: float
    is_demo_mode: bool = True
    init_time_utc: Optional[str] = None
    valid_time_utc: Optional[str] = None
    lead_hours: Optional[int] = None
    temporal_resolution: Optional[str] = None
    available_valid_times: Optional[List[Dict[str, Any]]] = None
    initialization_time: Optional[str] = None
    valid_forecast_time: Optional[str] = None
    available_dates: Optional[List[Dict[str, Any]]] = None
    available_times: Optional[List[Dict[str, Any]]] = None
    selected_date: Optional[str] = None
    selected_date_display: Optional[str] = None
    regions: List[RegionRiskSummary]

    class Config:
        extra = "allow"

class LeadTimePoint(BaseModel):
    day: int
    confidence_score: float
    bust_probability: float
    risk_level: str
    precip_forecast: Optional[float] = 0.0
    cape_j_kg: Optional[float] = 600.0
    ensemble_spread: Optional[float] = 1.2
    lead_time_hours: Optional[int] = None
    valid_time_utc: Optional[str] = None

class LeadTimeCurveResponse(BaseModel):
    region_id: str
    region_name: str
    scenario_id: str
    curve: List[LeadTimePoint]

class ForecastStabilityResponse(BaseModel):
    scenario_id: str
    region_id: str
    region_name: Optional[str] = None
    zone: Optional[str] = None
    forecast_day: int
    valid_hour: int
    lead_hours: Optional[int] = None
    has_previous_run: bool
    message: Optional[str] = None
    previous_run: Optional[Dict[str, Any]] = None
    current_run: Optional[Dict[str, Any]] = None
    comparison_type: Optional[str] = None
    delta_bust_probability_pp: Optional[float] = 0.0
    delta_confidence_score_pp: Optional[float] = 0.0
    delta_rain_mm: Optional[float] = None
    delta_ensemble_spread: Optional[float] = None
    stability_status: str
    stability_description: Optional[str] = None
    main_variables_responsible: Optional[List[Dict[str, Any]]] = None

class WhatChangedResponse(BaseModel):
    region_id: str
    region_name: Optional[str] = None
    zone: Optional[str] = None
    forecast_day: int
    valid_hour: int
    lead_hours: Optional[int] = None
    valid_time_utc: Optional[str] = None
    status: str = "SUCCESS"
    has_previous_run: bool = True
    message: Optional[str] = None
    summary_statement: str
    previous_bust_probability: Optional[float] = None
    current_bust_probability: Optional[float] = None
    absolute_change: Optional[float] = None
    percentage_point_change: Optional[float] = None
    direction: Optional[str] = None
    comparison_type: Optional[str] = None
    previous_init: Optional[str] = None
    current_init: Optional[str] = None
    top_feature_shifts: List[Dict[str, Any]] = []

class BustFingerprintResponse(BaseModel):
    region_id: str
    region_name: Optional[str] = None
    forecast_day: int
    valid_hour: int
    feature_space_dimensions: Optional[int] = 12
    distance_metric: Optional[str] = None
    similarity_formula: Optional[str] = None
    closest_matches: List[Dict[str, Any]] = []
    closest_confirmed_busts: List[Dict[str, Any]] = []

class IntelligenceOverviewResponse(BaseModel):
    region_id: str
    forecast_day: int
    valid_hour: int
    stability_monitor: Dict[str, Any]
    what_changed: Dict[str, Any]
    bust_fingerprint: Dict[str, Any]

