"""
SIH 26079: Atmospheric Forecast Error & Scientific Bust Labeling Pipeline
Strictly decouples Numerical Forecast inputs from Verifying Observations.
Implements objective WMO/IMD error metrics and threshold-calibrated bust labeling.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict

# Scientifically calibrated thresholds
THRESHOLDS = {
    "rain_bust_extreme_mm": 35.0,           # |P_fcst - P_obs| >= 35mm
    "rain_heavy_warning_min_mm": 64.5,      # IMD official "Heavy Rainfall" criteria
    "rain_moderate_threshold_mm": 15.6,     # IMD "Moderate Rainfall" lower bound
    "rain_missed_alert_max_fcst_mm": 15.0,  # Missed alert if fcst < 15mm while obs >= 64.5mm
    "rain_false_alarm_min_fcst_mm": 64.5,   # False alarm if fcst >= 64.5mm while obs < 10mm
    "rain_false_alarm_max_obs_mm": 10.0,
    "temp_bust_extreme_degc": 4.5,          # |T_fcst - T_obs| >= 4.5°C
    "mslp_bust_extreme_hpa": 6.0,           # |MSLP_fcst - MSLP_obs| >= 6.0 hPa
    "climatological_z_threshold": 2.5       # Z-error >= 2.5 standard deviations
}


@dataclass
class ForecastRecord:
    init_date: str
    valid_date: str
    lead_time_days: int
    region_id: str
    precip_forecast_mm: float
    temp_forecast_degc: float
    mslp_forecast_hpa: float
    pressure_tendency_24h: float
    rh_850_pct: float
    wind_shear_850_200_ms: float
    cape_j_kg: float
    ensemble_spread: float
    source: str = "NOAA_GEFS_v12"


@dataclass
class VerifyingObservation:
    valid_date: str
    region_id: str
    precip_actual_mm: Optional[float] = None
    temp_actual_degc: Optional[float] = None
    mslp_actual_hpa: Optional[float] = None
    source: str = "ERA5_REANALYSIS"
    is_verified: bool = True


def calculate_forecast_errors(
    fcst: ForecastRecord,
    obs: Optional[VerifyingObservation],
    climatological_std_mm: float = 12.0
) -> Dict[str, Any]:
    """
    Computes objective atmospheric forecast verification error metrics.
    If verifying observation is absent, sets status to PENDING_VERIFICATION and avoids inventing data.
    """
    if obs is None or not obs.is_verified or obs.precip_actual_mm is None:
        return {
            "verification_status": "PENDING_VERIFICATION",
            "observation_source": "NONE",
            "rain_error_mm": None,
            "abs_rain_error_mm": None,
            "temp_error_degc": None,
            "abs_temp_error_degc": None,
            "mslp_error_hpa": None,
            "abs_mslp_error_hpa": None,
            "climatological_z_error": None,
            "contingency_category": "UNVERIFIED"
        }

    # Signed and Absolute Errors (Error = Forecast - Observed)
    rain_error = round(fcst.precip_forecast_mm - obs.precip_actual_mm, 2)
    abs_rain_error = round(abs(rain_error), 2)

    temp_error = None
    abs_temp_error = None
    if obs.temp_actual_degc is not None:
        temp_error = round(fcst.temp_forecast_degc - obs.temp_actual_degc, 2)
        abs_temp_error = round(abs(temp_error), 2)

    mslp_error = None
    abs_mslp_error = None
    if obs.mslp_actual_hpa is not None:
        mslp_error = round(fcst.mslp_forecast_hpa - obs.mslp_actual_hpa, 2)
        abs_mslp_error = round(abs(mslp_error), 2)

    # Standardized Anomaly Error
    denom = max(5.0, float(climatological_std_mm))
    z_error = round(abs_rain_error / denom, 2)

    # WMO / IMD Categorical Contingency Classification
    obs_p = obs.precip_actual_mm
    fcst_p = fcst.precip_forecast_mm

    if obs_p >= THRESHOLDS["rain_heavy_warning_min_mm"] and fcst_p < THRESHOLDS["rain_missed_alert_max_fcst_mm"]:
        contingency = "MISSED_HEAVY_RAIN"
    elif fcst_p >= THRESHOLDS["rain_false_alarm_min_fcst_mm"] and obs_p < THRESHOLDS["rain_false_alarm_max_obs_mm"]:
        contingency = "FALSE_ALARM_HEAVY"
    elif fcst_p >= THRESHOLDS["rain_moderate_threshold_mm"] and obs_p >= THRESHOLDS["rain_moderate_threshold_mm"]:
        contingency = "HIT"
    else:
        contingency = "NOMINAL_ACCORD"

    return {
        "verification_status": "VERIFIED",
        "observation_source": obs.source,
        "rain_error_mm": rain_error,
        "abs_rain_error_mm": abs_rain_error,
        "temp_error_degc": temp_error,
        "abs_temp_error_degc": abs_temp_error,
        "mslp_error_hpa": mslp_error,
        "abs_mslp_error_hpa": abs_mslp_error,
        "climatological_z_error": z_error,
        "contingency_category": contingency
    }


def evaluate_bust_label(errors: Dict[str, Any]) -> Dict[str, Any]:
    """
    Applies calibrated multi-factor bust criteria.
    Returns binary is_bust (1 or 0), bust_category, and specific triggering reason.
    If verification is pending, returns is_bust = None.
    """
    if errors["verification_status"] != "VERIFIED":
        return {
            "is_bust": None,
            "bust_category": "UNVERIFIED",
            "bust_trigger": "Observation Pending"
        }

    triggers = []

    # 1. Missed Heavy Rain Alert (Critical Hazard Failure)
    if errors["contingency_category"] == "MISSED_HEAVY_RAIN":
        triggers.append("Missed IMD Heavy Rain Alert (Obs >= 64.5mm with Fcst < 15mm)")

    # 2. Catastrophic False Alarm
    if errors["contingency_category"] == "FALSE_ALARM_HEAVY":
        triggers.append("Catastrophic False Alarm (Fcst >= 64.5mm with Obs < 10mm)")

    # 3. Extreme Rainfall Error Delta (|Delta| >= 35 mm)
    if errors["abs_rain_error_mm"] is not None and errors["abs_rain_error_mm"] >= THRESHOLDS["rain_bust_extreme_mm"]:
        triggers.append(f"Extreme Rain Error ({errors['abs_rain_error_mm']} mm >= {THRESHOLDS['rain_bust_extreme_mm']} mm)")

    # 4. Standardized Anomaly Error (Z >= 2.5)
    if errors["climatological_z_error"] is not None and errors["climatological_z_error"] >= THRESHOLDS["climatological_z_threshold"]:
        triggers.append(f"Climatological Anomaly Exceeded (Z={errors['climatological_z_error']} >= {THRESHOLDS['climatological_z_threshold']})")

    # 5. Extreme Temperature Error (|Delta T| >= 4.5°C)
    if errors["abs_temp_error_degc"] is not None and errors["abs_temp_error_degc"] >= THRESHOLDS["temp_bust_extreme_degc"]:
        triggers.append(f"Extreme Temp Error ({errors['abs_temp_error_degc']}°C >= {THRESHOLDS['temp_bust_extreme_degc']}°C)")

    # 6. Extreme Pressure / Cyclone Track Divergence (|Delta MSLP| >= 6.0 hPa)
    if errors["abs_mslp_error_hpa"] is not None and errors["abs_mslp_error_hpa"] >= THRESHOLDS["mslp_bust_extreme_hpa"]:
        triggers.append(f"Barometric Surge Divergence ({errors['abs_mslp_error_hpa']} hPa >= {THRESHOLDS['mslp_bust_extreme_hpa']} hPa)")

    if len(triggers) > 0:
        return {
            "is_bust": 1,
            "bust_category": "CONFIRMED_BUST",
            "bust_trigger": "; ".join(triggers)
        }
    else:
        return {
            "is_bust": 0,
            "bust_category": "NOMINAL",
            "bust_trigger": "Within Acceptable Error Tolerance"
        }


def process_forecast_and_observations(
    forecasts: List[ForecastRecord],
    observations_lookup: Dict[str, VerifyingObservation],
    climatology_lookup: Optional[Dict[str, float]] = None
) -> pd.DataFrame:
    """
    End-to-end pipeline uniting forecast records with observations,
    computing standardized error metrics, and labeling forecast busts.
    """
    rows = []
    climatology = climatology_lookup or {}

    for fcst in forecasts:
        key = f"{fcst.valid_date}_{fcst.region_id}"
        obs = observations_lookup.get(key)
        reg_std = climatology.get(fcst.region_id, 14.0)

        # 1. Error calculation
        errors = calculate_forecast_errors(fcst, obs, climatological_std_mm=reg_std)

        # 2. Bust classification
        bust_info = evaluate_bust_label(errors)

        # 3. Assemble record
        row = {
            # Forecast metadata
            "init_date": fcst.init_date,
            "valid_date": fcst.valid_date,
            "lead_time_days": fcst.lead_time_days,
            "region_id": fcst.region_id,
            "forecast_source": fcst.source,
            # Forecast variables
            "precip_forecast_mm": fcst.precip_forecast_mm,
            "temp_forecast_degc": fcst.temp_forecast_degc,
            "mslp_forecast_hpa": fcst.mslp_forecast_hpa,
            "pressure_tendency_24h": fcst.pressure_tendency_24h,
            "rh_850_pct": fcst.rh_850_pct,
            "wind_shear_850_200_ms": fcst.wind_shear_850_200_ms,
            "cape_j_kg": fcst.cape_j_kg,
            "ensemble_spread": fcst.ensemble_spread,
            # Observation ground truth
            "observation_source": errors["observation_source"],
            "verification_status": errors["verification_status"],
            "actual_precip_mm": obs.precip_actual_mm if (obs and obs.is_verified) else None,
            "actual_temp_degc": obs.temp_actual_degc if (obs and obs.is_verified) else None,
            "actual_mslp_hpa": obs.mslp_actual_hpa if (obs and obs.is_verified) else None,
            # Error metrics
            "rain_error_mm": errors["rain_error_mm"],
            "abs_rain_error_mm": errors["abs_rain_error_mm"],
            "temp_error_degc": errors["temp_error_degc"],
            "abs_temp_error_degc": errors["abs_temp_error_degc"],
            "mslp_error_hpa": errors["mslp_error_hpa"],
            "abs_mslp_error_hpa": errors["abs_mslp_error_hpa"],
            "climatological_z_error": errors["climatological_z_error"],
            "contingency_category": errors["contingency_category"],
            # Target labels
            "is_bust": bust_info["is_bust"],
            "bust_category": bust_info["bust_category"],
            "bust_trigger": bust_info["bust_trigger"]
        }
        rows.append(row)

    return pd.DataFrame(rows)
