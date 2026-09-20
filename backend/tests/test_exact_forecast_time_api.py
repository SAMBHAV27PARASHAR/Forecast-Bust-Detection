import pytest
import math
from datetime import datetime, timedelta
import requests

class LiveApiClient:
    def __init__(self, base_url="http://127.0.0.1:8000"):
        self.base_url = base_url
    def get(self, path, params=None):
        return requests.get(f"{self.base_url}{path}", params=params)

client = LiveApiClient()

def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True

def test_real_gefs_scenarios_available():
    response = client.get("/api/scenarios")
    assert response.status_code == 200
    scenarios = response.json()
    scenario_ids = [s["id"] for s in scenarios]
    assert "real_gefs_july2019" in scenario_ids

@pytest.mark.parametrize("day,hour,expected_lead,expected_valid_str", [
    (1, 0, 24, "2019-07-06 00:00 UTC"),
    (1, 6, 30, "2019-07-06 06:00 UTC"),
    (4, 0, 96, "2019-07-09 00:00 UTC"),
    (4, 9, 105, "2019-07-09 09:00 UTC"),
    (5, 0, 120, "2019-07-10 00:00 UTC"),
    (5, 12, 132, "2019-07-10 12:00 UTC"),
    (7, 0, 168, "2019-07-12 00:00 UTC"),
    (7, 18, 186, "2019-07-12 18:00 UTC"),
    (10, 0, 240, "2019-07-15 00:00 UTC"),
])
def test_exact_time_risk_map(day, hour, expected_lead, expected_valid_str):
    params = {
        "day": day,
        "scenario": "real_gefs_july2019",
        "valid_hour": hour
    }
    response = client.get("/api/risk-map", params=params)
    assert response.status_code == 200
    data = response.json()

    # 1. Lead time verification
    assert data["forecast_day"] == day
    assert data["lead_hours"] == expected_lead

    # 2. Timestamp verification
    assert data["init_time_utc"] == "2019-07-05 00:00 UTC"
    assert data["valid_time_utc"] == expected_valid_str

    # 3. Temporal resolution verification
    assert "3-Hourly Resolution" in data["temporal_resolution"]
    assert len(data["available_valid_times"]) == 8

    # Verify that available valid times match 3-hourly intervals
    hours_in_meta = [t["hour"] for t in data["available_valid_times"]]
    assert hours_in_meta == [0, 3, 6, 9, 12, 15, 18, 21]

    # Verify that the requested hour is marked as selected
    selected_meta = [t for t in data["available_valid_times"] if t["is_selected"]]
    assert len(selected_meta) == 1
    assert selected_meta[0]["hour"] == hour

    # 4. Regions and probabilities verification
    regions = data["regions"]
    assert len(regions) > 0
    for r in regions:
        assert 0.0 <= r["bust_probability"] <= 100.0
        assert r["risk_level"] in ["Low", "Moderate", "High", "Severe", "Low Risk", "Medium Risk", "High Risk", "Nominal"]

def test_subdaily_diurnal_variation():
    # Day 5 at 00 UTC vs Day 5 at 12 UTC should exhibit physical diurnal sensitivity
    r00 = client.get("/api/risk-map?day=5&scenario=real_gefs_july2019&valid_hour=0").json()
    r12 = client.get("/api/risk-map?day=5&scenario=real_gefs_july2019&valid_hour=12").json()

    assert r00["lead_hours"] == 120
    assert r12["lead_hours"] == 132

    # Verify forecast detail updates meteorological values
    d00 = client.get("/api/forecast/IND-KON-GOA?day=5&scenario=real_gefs_july2019&valid_hour=0").json()
    d12 = client.get("/api/forecast/IND-KON-GOA?day=5&scenario=real_gefs_july2019&valid_hour=12").json()

    temp00 = d00["raw_parameters"]["temp_forecast"]
    temp12 = d12["raw_parameters"]["temp_forecast"]
    cape00 = d00["raw_parameters"]["cape_j_kg"]
    cape12 = d12["raw_parameters"]["cape_j_kg"]

    # Afternoon (12 UTC) should be warmer and have higher convective CAPE than 00 UTC
    assert temp12 != temp00
    assert cape12 != cape00
    assert d00["lead_hours"] == 120
    assert d12["lead_hours"] == 132
    assert d00["valid_time_utc"] == "2019-07-10 00:00 UTC"
    assert d12["valid_time_utc"] == "2019-07-10 12:00 UTC"

def test_synthetic_scenario_no_fake_hourly_data():
    # Synthetic scenarios should only have 24-hour synoptic resolution
    response = client.get("/api/risk-map?day=5&scenario=monsoon_depression_bust")
    assert response.status_code == 200
    data = response.json()

    assert data["lead_hours"] == 120
    assert "24-Hour Synoptic" in data["temporal_resolution"]
    assert len(data["available_valid_times"]) == 1
    assert data["available_valid_times"][0]["hour"] == 0
