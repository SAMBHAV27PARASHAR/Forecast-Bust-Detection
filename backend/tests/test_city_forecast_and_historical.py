"""
Dedicated tests for:
1. /api/cities endpoint (100+ authentic Indian cities across all subdivisions)
2. /api/city-forecast/{city_id} and /api/forecast/city/{city_id} alias
3. Multi-day 10-day forecast series per city
4. /api/verification/historical endpoint (July 2019 out-of-time ground truth verification)
"""

import pytest
from backend.app.services.data_service import data_service
from backend.app.api.endpoints import (
    get_cities_list,
    get_city_forecast_endpoint,
    get_historical_verification_endpoint
)

def test_cities_list_comprehensive():
    cities = get_cities_list()
    assert isinstance(cities, list)
    assert len(cities) >= 100, f"Expected at least 100 cities, found {len(cities)}"
    city_ids = {c["id"] for c in cities}
    for major in ["bareilly", "delhi", "mumbai", "bengaluru", "kolkata", "chennai", "hyderabad", "jaipur"]:
        assert major in city_ids, f"Expected major city {major} in cities list"

def test_city_forecast_valid_cities():
    test_cities = ["bareilly", "mumbai", "kolkata", "bengaluru", "delhi", "udaipur", "siliguri", "kozhikode", "bathinda"]
    for c in test_cities:
        fc = get_city_forecast_endpoint(c, day=1, valid_hour=0)
        assert fc is not None, f"City forecast for {c} returned None"
        assert "city" in fc, f"Forecast for {c} missing 'city' key"
        assert "temperature" in fc, f"Forecast for {c} missing 'temperature' key"
        assert "bust_probability" in fc, f"Forecast for {c} missing 'bust_probability' key"
        assert "ten_day_trend" in fc, f"Forecast for {c} missing 'ten_day_trend'"
        assert len(fc["ten_day_trend"]) >= 10, f"Forecast for {c} has {len(fc['ten_day_trend'])} entries, expected >= 10"

def test_city_forecast_alias_endpoint():
    # Calling get_city_forecast_endpoint with city_id handles both /city-forecast and /forecast/city
    fc1 = get_city_forecast_endpoint("mumbai", day=2)
    assert fc1["city"]["name"] == "Mumbai"
    assert fc1["city"]["subdivision_id"] == "IND-KON-GOA"

def test_historical_verification_populated():
    hist = get_historical_verification_endpoint(region_id="IND-KON-GOA", limit=10)
    assert hist["status"] == "VERIFIED_HISTORICAL_ARCHIVE"
    assert hist["count"] > 0
    assert len(hist["records"]) > 0
    first = hist["records"][0]
    assert "precip_forecast_mm" in first
    assert "actual_precip_mm" in first
    assert "rain_error_mm" in first
    assert "is_bust" in first
    assert first["observation_source"] is not None

def test_historical_verification_filtering():
    # Filter by lead_time_days
    hist_d5 = get_historical_verification_endpoint(lead_time_days=5, limit=20)
    assert hist_d5["status"] == "VERIFIED_HISTORICAL_ARCHIVE"
    for r in hist_d5["records"]:
        assert r["lead_time_days"] == 5

def test_city_forecast_unknown_city_raises_404():
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        get_city_forecast_endpoint("unknown-non-existent-city-xyz", day=1)
    assert exc_info.value.status_code == 404
    assert "unavailable" in exc_info.value.detail.lower()

def test_live_forecast_unified_endpoint():
    from backend.app.api.endpoints import get_live_forecast_overview
    overview = get_live_forecast_overview(region_id="IND-UP-BIH", day=1)
    assert overview is not None
    assert "temperature" in overview
    assert "rainfall" in overview
    assert "wind_speed" in overview
    assert "humidity" in overview
    assert "pressure" in overview
    assert "cape_j_kg" in overview
    assert "wind_shear" in overview
    assert "ensemble_spread" in overview
    assert "bust_probability" in overview
    assert "confidence" in overview
    assert "ten_day_forecast" in overview
    assert len(overview["ten_day_forecast"]) == 11

def test_city_forecast_variables_complete_across_days():
    # Verify Bareilly, Mumbai, Kolkata, Delhi, Bengaluru all have D0-D10 with actual variables
    for c in ["bareilly", "mumbai", "kolkata", "delhi", "bengaluru"]:
        fc = get_city_forecast_endpoint(c, day=1)
        series = fc.get("ten_day_forecast", [])
        assert len(series) == 11, f"Expected 11 days (D0-D10) for {c}, got {len(series)}"
        for day_entry in series:
            assert "day" in day_entry
            assert "temp_c" in day_entry
            assert "precip_mm" in day_entry
            assert "wind_speed_kmh" in day_entry
            assert "rh_850" in day_entry or "rh_pct" in day_entry
            assert "mslp_hpa" in day_entry
            assert "cape_j_kg" in day_entry or "cape_surface" in day_entry
            assert "ensemble_spread" in day_entry
            assert "bust_probability" in day_entry
            assert "model_confidence" in day_entry or "confidence_score" in day_entry

