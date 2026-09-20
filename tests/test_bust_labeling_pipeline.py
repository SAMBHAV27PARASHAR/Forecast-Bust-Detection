"""
Unit & Integration Tests for SIH 26079 Forecast Error & Bust Labeling Pipeline
"""

import pytest
import numpy as np
import pandas as pd
from ml.bust_labeling_pipeline import (
    ForecastRecord,
    VerifyingObservation,
    calculate_forecast_errors,
    evaluate_bust_label,
    process_forecast_and_observations,
    THRESHOLDS
)


def create_sample_fcst(precip=20.0, temp=28.0, mslp=1008.0):
    return ForecastRecord(
        init_date="2019-07-01 00:00",
        valid_date="2019-07-05",
        lead_time_days=5,
        region_id="IND-WB-ODI",
        precip_forecast_mm=precip,
        temp_forecast_degc=temp,
        mslp_forecast_hpa=mslp,
        pressure_tendency_24h=-1.5,
        rh_850_pct=75.0,
        wind_shear_850_200_ms=14.0,
        cape_j_kg=1200.0,
        ensemble_spread=1.2,
        source="NOAA_GEFS_v12"
    )


def test_missing_observation_does_not_invent_bust():
    """Verifies that missing observations yield PENDING_VERIFICATION and None bust label."""
    fcst = create_sample_fcst()
    errors = calculate_forecast_errors(fcst, obs=None)
    
    assert errors["verification_status"] == "PENDING_VERIFICATION"
    assert errors["rain_error_mm"] is None
    assert errors["climatological_z_error"] is None

    bust = evaluate_bust_label(errors)
    assert bust["is_bust"] is None
    assert bust["bust_category"] == "UNVERIFIED"
    assert "Pending" in bust["bust_trigger"]


def test_unverified_observation_flag():
    """Verifies that unverified observation records are rejected from bust labeling."""
    fcst = create_sample_fcst()
    obs = VerifyingObservation(
        valid_date="2019-07-05",
        region_id="IND-WB-ODI",
        precip_actual_mm=50.0,
        is_verified=False  # Data quality flag False
    )
    errors = calculate_forecast_errors(fcst, obs)
    assert errors["verification_status"] == "PENDING_VERIFICATION"
    assert errors["rain_error_mm"] is None


def test_nominal_forecast_within_tolerance():
    """Verifies that normal forecast divergence is labeled nominal (is_bust = 0)."""
    fcst = create_sample_fcst(precip=24.0, temp=28.5)
    obs = VerifyingObservation(
        valid_date="2019-07-05",
        region_id="IND-WB-ODI",
        precip_actual_mm=21.0,
        temp_actual_degc=29.0
    )
    errors = calculate_forecast_errors(fcst, obs, climatological_std_mm=15.0)
    assert errors["verification_status"] == "VERIFIED"
    assert errors["rain_error_mm"] == 3.0
    assert errors["abs_rain_error_mm"] == 3.0

    bust = evaluate_bust_label(errors)
    assert bust["is_bust"] == 0
    assert bust["bust_category"] == "NOMINAL"


def test_missed_heavy_rain_warning_bust():
    """
    Verifies operational hazard failure:
    Observed rainfall >= 64.5mm (IMD Heavy Rain Alert) while forecast was under 15mm.
    """
    fcst = create_sample_fcst(precip=12.0)
    obs = VerifyingObservation(
        valid_date="2019-07-05",
        region_id="IND-WB-ODI",
        precip_actual_mm=78.5  # Severe downpour
    )
    errors = calculate_forecast_errors(fcst, obs)
    assert errors["contingency_category"] == "MISSED_HEAVY_RAIN"

    bust = evaluate_bust_label(errors)
    assert bust["is_bust"] == 1
    assert bust["bust_category"] == "CONFIRMED_BUST"
    assert "Missed IMD Heavy Rain Alert" in bust["bust_trigger"]


def test_catastrophic_false_alarm_bust():
    """Verifies operational failure when model predicts extreme rain but actual weather is dry."""
    fcst = create_sample_fcst(precip=85.0)
    obs = VerifyingObservation(
        valid_date="2019-07-05",
        region_id="IND-WB-ODI",
        precip_actual_mm=4.0
    )
    errors = calculate_forecast_errors(fcst, obs)
    assert errors["contingency_category"] == "FALSE_ALARM_HEAVY"

    bust = evaluate_bust_label(errors)
    assert bust["is_bust"] == 1
    assert "Catastrophic False Alarm" in bust["bust_trigger"]


def test_extreme_temperature_bust():
    """Verifies temperature divergence exceeding 4.5°C threshold triggers bust."""
    fcst = create_sample_fcst(temp=35.5)
    obs = VerifyingObservation(
        valid_date="2019-07-05",
        region_id="IND-WB-ODI",
        precip_actual_mm=10.0,
        temp_actual_degc=29.0  # 6.5°C cold bias
    )
    errors = calculate_forecast_errors(fcst, obs)
    assert errors["abs_temp_error_degc"] == 6.5

    bust = evaluate_bust_label(errors)
    assert bust["is_bust"] == 1
    assert "Extreme Temp Error" in bust["bust_trigger"]


def test_climatological_z_score_bust():
    """Verifies anomaly error exceeding 2.5 sigma triggers bust."""
    fcst = create_sample_fcst(precip=32.0)
    obs = VerifyingObservation(
        valid_date="2019-07-05",
        region_id="IND-WB-ODI",
        precip_actual_mm=2.0
    )
    # Regional climatological std is low (e.g. 8.0mm in semi-arid region)
    errors = calculate_forecast_errors(fcst, obs, climatological_std_mm=8.0)
    # Z-error = 30 / 8 = 3.75 >= 2.5
    assert errors["climatological_z_error"] >= 2.5

    bust = evaluate_bust_label(errors)
    assert bust["is_bust"] == 1
    assert "Climatological Anomaly Exceeded" in bust["bust_trigger"]


def test_end_to_end_dataframe_processing():
    """Tests batch processing of forecast and observation streams into DataFrame."""
    fcsts = [
        create_sample_fcst(precip=10.0),
        create_sample_fcst(precip=70.0)
    ]
    fcsts[1].valid_date = "2019-07-06"

    obs_lookup = {
        "2019-07-05_IND-WB-ODI": VerifyingObservation(
            valid_date="2019-07-05",
            region_id="IND-WB-ODI",
            precip_actual_mm=12.0,
            temp_actual_degc=28.0
        ),
        # 2019-07-06 is purposely omitted to test pending verification handling
    }

    df = process_forecast_and_observations(fcsts, obs_lookup)

    assert len(df) == 2
    assert df.loc[0, "verification_status"] == "VERIFIED"
    assert df.loc[0, "is_bust"] == 0

    assert df.loc[1, "verification_status"] == "PENDING_VERIFICATION"
    assert pd.isna(df.loc[1, "is_bust"])
    assert pd.isna(df.loc[1, "rain_error_mm"])
