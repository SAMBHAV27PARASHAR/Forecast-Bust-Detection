"""
Tests for Live NOAA GEFS Operational Service, City Forecast, and Verification Pending Status.
Directly tests service functions and router logic.
"""

from backend.app.services.live_gefs_service import live_gefs_service
from backend.app.services.data_service import data_service
from backend.app.api.endpoints import get_live_status, get_cities_list, get_city_forecast_endpoint, get_model_performance


def test_live_status():
    status = get_live_status()
    assert status["available"] is True
    assert "2026-09" in status["init_time_utc"]
    assert status["subdivisions_count"] == 14
    assert status["cities_count"] >= 50


def test_live_risk_map():
    data = data_service.get_risk_map(day=1, scenario_id="live_gefs", valid_hour=0)
    assert data["day"] == 1
    assert data["is_demo_mode"] is False
    assert "2026-09" in data["initialization_time"]
    assert len(data["regions"]) == 14
    assert data["regions"][0]["bust_probability"] >= 0.0


def test_cities_endpoint():
    cities = get_cities_list()
    assert len(cities) >= 50
    bareilly = next((c for c in cities if c["id"] == "bareilly"), None)
    assert bareilly is not None
    assert bareilly["state"] == "Uttar Pradesh"


def test_city_forecast_bareilly():
    data = get_city_forecast_endpoint("bareilly", day=1, valid_hour=0, lat=28.3670, lon=79.4304)
    assert data["city"]["name"] == "Bareilly"
    assert data["city"]["state"] == "Uttar Pradesh"
    assert data["coordinates"]["latitude"] == 28.3670
    assert data["coordinates"]["longitude"] == 79.4304
    assert len(data["ten_day_trend"]) >= 10
    day1 = next((d for d in data["ten_day_trend"] if d["day"] == 1), None)
    assert day1 is not None
    assert "2026-09" in day1["valid_date"]
    assert day1["temp_c"] > 0
    assert day1["bust_probability"] >= 0.0


def test_city_selection_bareilly_and_delhi():
    cities = get_cities_list()
    # Bareilly selection
    bareilly = next((c for c in cities if c["id"] == "bareilly"), None)
    assert bareilly is not None
    assert bareilly["state"] == "Uttar Pradesh"
    assert round(bareilly["lat"], 2) == 28.37
    assert round(bareilly["lon"], 2) == 79.43

    # Delhi selection
    delhi = next((c for c in cities if c["id"] == "delhi"), None)
    assert delhi is not None
    assert delhi["state"] in ["Delhi", "Delhi NCR"]
    assert round(delhi["lat"], 2) == 28.61
    assert round(delhi["lon"], 2) == 77.21


def test_city_forecast_coordinates_reach_request_and_values_differ():
    # Fetch Bareilly with exact coordinates
    b_data = get_city_forecast_endpoint("bareilly", day=1, valid_hour=0, date="2026-09-20", lat=28.3670, lon=79.4304)
    assert b_data["coordinates"]["latitude"] == 28.3670
    assert b_data["coordinates"]["longitude"] == 79.4304
    assert b_data["selected_day"] == 1
    assert b_data["selected_hour"] == 0

    # Fetch Delhi with exact coordinates
    d_data = get_city_forecast_endpoint("delhi", day=1, valid_hour=0, date="2026-09-20", lat=28.6139, lon=77.2090)
    assert d_data["coordinates"]["latitude"] == 28.6139
    assert d_data["coordinates"]["longitude"] == 77.2090
    assert d_data["selected_day"] == 1
    assert d_data["selected_hour"] == 0

    # Real grid-derived values must reflect distinct meteorological locations
    assert b_data["temperature"] != d_data["temperature"]
    assert b_data["city"]["name"] != d_data["city"]["name"]


def test_live_future_verification_pending():
    data = data_service.get_forecast_detail("IND-WB-ODI", day=5, scenario_id="live_gefs", valid_hour=0)
    sim_actual = data.get("simulated_actual", {})
    assert sim_actual.get("status") == "VERIFICATION PENDING"
    assert sim_actual.get("rain_delta") == 0.0


def test_model_performance_endpoint():
    data = get_model_performance()
    eval_metrics = data.get("evaluation_metrics", {})
    roc_auc = eval_metrics.get("roc_auc") or data.get("roc_auc")
    assert roc_auc == 0.9924

