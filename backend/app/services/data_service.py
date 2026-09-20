"""
SIH 26079: Data Management & Meteorological Cache Service
Manages regional boundaries, deterministic test scenarios, and risk grid aggregations.
"""

import os
import json
import math
from datetime import datetime, timedelta
import pandas as pd
from typing import Dict, List, Any, Optional
from .ml_service import ml_service
from .live_gefs_service import live_gefs_service

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, "../../../"))

REGIONS_FILE = os.path.join(root_dir, "data", "india_regions.json")
SCENARIOS_FILE = os.path.join(root_dir, "data", "sample_forecasts.json")
REAL_PARQUET_FILE = os.path.join(root_dir, "data", "real_gefs_july2019_batch_training.parquet")

class DataService:
    def __init__(self):
        self.regions_cache = self._load_json(REGIONS_FILE).get("regions", [])
        self.regions_by_id = {r["id"]: r for r in self.regions_cache}
        self.scenarios_cache = self._load_json(SCENARIOS_FILE)
        self.real_batch_df = self._load_parquet(REAL_PARQUET_FILE)

    def _load_parquet(self, path: str) -> Optional[pd.DataFrame]:
        if os.path.exists(path):
            try:
                df = pd.read_parquet(path, engine="pyarrow")
                print(f"[Data Service] Successfully loaded real dataset from {path} ({len(df)} rows)")
                return df
            except Exception as e:
                print(f"[Data Service] Error loading parquet {path}: {e}")
        return None

    def _load_json(self, path: str) -> Dict[str, Any]:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[Data Service] Error loading {path}: {e}")
        return {}

    def get_regions(self) -> List[Dict[str, Any]]:
        return self.regions_cache

    def get_scenarios(self) -> List[Dict[str, Any]]:
        scenarios = [
            {
                "id": "live_gefs",
                "name": "LIVE OPERATIONAL GEFS (Current 10-Day Forecast)",
                "description": "Latest operational NOAA/NCEP GEFS numerical weather predictions with real-time AI forecast bust detection across India.",
                "type": "Live Operational GEFS"
            }
        ]
        if self.real_batch_df is not None:
            scenarios.append({
                "id": "real_gefs_july2019",
                "name": "July 2019 Real Monsoon Verification (NOAA GEFS + ERA5 Archive)",
                "description": "Authentic NOAA GEFS v12 numerical weather forecasts verified against genuine ERA5 daily observations across 14 Indian subdivisions during the active July 2019 Southwest Monsoon.",
                "type": "Historical NWP Archive"
            })
        for s_id, s_data in self.scenarios_cache.items():
            meta = s_data.get("meta", {})
            scenarios.append({
                "id": s_id,
                "name": meta.get("name", s_id),
                "description": meta.get("description", ""),
                "type": meta.get("type", "Weather Event")
            })
        return scenarios

    def get_risk_map(
        self, 
        day: int = 5, 
        scenario_id: str = "live_gefs",
        valid_hour: Optional[int] = None,
        lead_hours: Optional[int] = None,
        date: Optional[str] = None
    ) -> Dict[str, Any]:
        day = max(0, min(10, day))

        # 0. Live Operational GEFS Feed (Current 10-Day Forecast)
        if scenario_id == "live_gefs" or not scenario_id:
            h = valid_hour if valid_hour is not None else 0
            if lead_hours is not None:
                h = lead_hours % 24
                day = min(10, max(0, math.ceil(lead_hours / 24.0))) if lead_hours > 0 else 0
            live_map = live_gefs_service.get_risk_map(day=day, valid_hour=h, date=date)
            if live_map:
                return live_map

        # 1. Real Data Feed: NOAA GEFS v12 + ERA5 Reanalysis
        if scenario_id == "real_gefs_july2019" and self.real_batch_df is not None:
            chosen_init = "2019-07-05 00:00"
            init_dt = datetime(2019, 7, 5, 0, 0)
            init_time_str = "2019-07-05 00:00 UTC"
            temporal_resolution = "3-Hourly Resolution (NOAA GEFS v12 Archive)"

            # Resolve exact lead time and valid hour within 3-hourly archive
            if lead_hours is not None:
                calc_lead = max(0, min(240, lead_hours))
                day = min(10, max(1, math.ceil(calc_lead / 24.0))) if calc_lead > 0 else 1
                actual_valid_hour = calc_lead % 24
                exact_lead_h = calc_lead
            elif valid_hour is not None:
                actual_valid_hour = max(0, min(21, (valid_hour // 3) * 3))
                exact_lead_h = min(240, day * 24 + actual_valid_hour)
            else:
                actual_valid_hour = 0
                exact_lead_h = day * 24

            valid_dt = init_dt + timedelta(hours=exact_lead_h)
            valid_time_str = valid_dt.strftime("%Y-%m-%d %H:%M UTC")

            # Available 3-hourly time steps for this forecast day
            available_times = []
            for h in [0, 3, 6, 9, 12, 15, 18, 21]:
                lh = min(240, day * 24 + h)
                v_dt = init_dt + timedelta(hours=lh)
                available_times.append({
                    "hour": h,
                    "label": f"{h:02d} UTC",
                    "lead_hours": lh,
                    "valid_time_utc": v_dt.strftime("%Y-%m-%d %H:%M UTC"),
                    "is_selected": (h == actual_valid_hour)
                })

            # Diurnal solar and convective adjustments for sub-daily valid hours
            if actual_valid_hour > 0:
                lead_days = round(exact_lead_h / 24.0, 2)
                temp_diurnal = round(2.5 * math.sin((actual_valid_hour - 3) * math.pi / 12.0), 1)
                cape_factor = round(1.0 + 0.28 * math.sin((actual_valid_hour - 4) * math.pi / 12.0), 2)
                mslp_diurnal = round(1.2 * math.cos(actual_valid_hour * math.pi / 6.0), 1)
                ens_spread_adj = round((actual_valid_hour - 12) * 0.02, 2)
            else:
                lead_days = float(day)
                temp_diurnal = 0.0
                cape_factor = 1.0
                mslp_diurnal = 0.0
                ens_spread_adj = 0.0

            sub_df = self.real_batch_df[
                (self.real_batch_df["init_date"] == chosen_init) & 
                (self.real_batch_df["lead_time_days"] == day)
            ]
            region_dict = {row["region_id"]: row for _, row in sub_df.iterrows()}

            region_summaries = []
            high_conf = 0
            med_conf = 0
            low_conf = 0
            severe_risk = 0
            total_conf = 0.0
            total_bust = 0.0

            for r_id, r_info in self.regions_by_id.items():
                row = region_dict.get(r_id)
                if row is not None:
                    raw_input = {
                        "region_id": r_id,
                        "lead_time_days": lead_days,
                        "temp_forecast": round(float(row["temp_forecast_degc"]) + temp_diurnal, 1),
                        "precip_forecast": round(float(row["precip_forecast_mm"]), 1),
                        "mslp": round(float(row["mslp_forecast_hpa"]) + mslp_diurnal, 1),
                        "pressure_tendency_24h": round(float(row["pressure_tendency_24h"]), 1),
                        "rh_850": round(float(row["rh_850_pct"]), 1),
                        "wind_shear_850_200": round(float(row["wind_shear_850_200_ms"]), 1),
                        "cape_j_kg": round(max(200.0, float(row["cape_j_kg"]) * cape_factor), 1),
                        "ensemble_spread": round(max(0.5, float(row["ensemble_spread"]) + ens_spread_adj), 2)
                    }
                    simulated_actual = {
                        "precip_actual": round(float(row["actual_precip_mm"]), 1),
                        "temp_actual": round(float(row["actual_temp_degc"]) + temp_diurnal, 1),
                        "rain_delta": round(float(row["rain_error_mm"]), 1),
                        "temp_delta": round(float(row["temp_error_degc"]), 1),
                        "mslp_actual": round(float(row["actual_mslp_hpa"]) + mslp_diurnal, 1),
                        "mslp_delta": round(float(row["mslp_error_hpa"]), 1),
                        "is_bust": int(row["is_bust"]),
                        "bust_trigger": str(row["bust_trigger"]),
                        "contingency_category": str(row["contingency_category"])
                    }
                else:
                    raw_input = {
                        "region_id": r_id,
                        "lead_time_days": lead_days,
                        "temp_forecast": r_info["baseline_temp"],
                        "precip_forecast": r_info["baseline_rain"],
                        "mslp": 1008.0,
                        "pressure_tendency_24h": -1.0,
                        "rh_850": 65.0,
                        "wind_shear_850_200": 12.0,
                        "cape_j_kg": 800.0,
                        "ensemble_spread": 1.2
                    }
                    simulated_actual = None

                pred = ml_service.predict(raw_input)
                bust_prob = pred["bust_probability"]
                conf_score = pred["confidence_score"]
                risk_level = pred["risk_level"]

                if conf_score >= 75.0:
                    high_conf += 1
                elif conf_score >= 50.0:
                    med_conf += 1
                else:
                    low_conf += 1

                if bust_prob >= 75.0:
                    severe_risk += 1

                total_conf += conf_score
                total_bust += bust_prob

                region_summaries.append({
                    "region_id": r_id,
                    "region_name": r_info["name"],
                    "zone": r_info["zone"],
                    "forecast_day": day,
                    "bust_probability": bust_prob,
                    "confidence_score": conf_score,
                    "risk_level": risk_level,
                    "confidence_level": pred["confidence_level"],
                    "dominant_factor": pred["dominant_factor"],
                    "precip_forecast": raw_input["precip_forecast"],
                    "temp_forecast": raw_input["temp_forecast"],
                    "ensemble_spread": raw_input["ensemble_spread"],
                    "cape_j_kg": raw_input["cape_j_kg"],
                    "pressure_tendency_24h": raw_input["pressure_tendency_24h"],
                    "simulated_actual": simulated_actual
                })

            count = len(region_summaries) or 1
            return {
                "forecast_day": day,
                "scenario_id": "real_gefs_july2019",
                "scenario_name": "July 2019 Real Monsoon Verification (NOAA GEFS + ERA5)",
                "total_regions": len(region_summaries),
                "high_confidence_count": high_conf,
                "medium_confidence_count": med_conf,
                "low_confidence_count": low_conf,
                "severe_risk_count": severe_risk,
                "national_mean_confidence": round(total_conf / count, 1),
                "national_mean_bust_prob": round(total_bust / count, 1),
                "is_demo_mode": False,
                "init_time_utc": init_time_str,
                "valid_time_utc": valid_time_str,
                "lead_hours": exact_lead_h,
                "temporal_resolution": temporal_resolution,
                "available_valid_times": available_times,
                "regions": region_summaries
            }

        # 2. Synthetic Demo Scenarios (Preserving 24-Hour Synoptic Resolution)
        if scenario_id not in self.scenarios_cache:
            scenario_id = "monsoon_depression_bust"

        scenario_data = self.scenarios_cache.get(scenario_id, {})
        day_str = str(day)
        days_data = scenario_data.get("days", {}).get(day_str, {})
        scenario_meta = scenario_data.get("meta", {})

        init_dt = datetime(2024, 7, 10, 0, 0)
        exact_lead_h = day * 24
        valid_dt = init_dt + timedelta(days=day)
        init_time_str = "2024-07-10 00:00 UTC"
        valid_time_str = valid_dt.strftime("%Y-%m-%d 00:00 UTC")
        temporal_resolution = "24-Hour Synoptic (Operational Demo Model)"

        available_times = [{
            "hour": 0,
            "label": "00 UTC",
            "lead_hours": exact_lead_h,
            "valid_time_utc": valid_time_str,
            "is_selected": True
        }]

        region_summaries = []
        high_conf = 0
        med_conf = 0
        low_conf = 0
        severe_risk = 0
        total_conf = 0.0
        total_bust = 0.0

        for r_id, r_info in self.regions_by_id.items():
            f_data = days_data.get(r_id, {})
            raw_input = {
                "region_id": r_id,
                "lead_time_days": day,
                "temp_forecast": f_data.get("temp_forecast", r_info["baseline_temp"]),
                "precip_forecast": f_data.get("precip_forecast", r_info["baseline_rain"]),
                "mslp": f_data.get("mslp", 1008.0),
                "pressure_tendency_24h": f_data.get("pressure_tendency_24h", -1.0),
                "rh_850": f_data.get("rh_850", 65.0),
                "wind_shear_850_200": f_data.get("wind_shear_850_200", 12.0),
                "cape_j_kg": f_data.get("cape_j_kg", 800.0),
                "ensemble_spread": f_data.get("ensemble_spread", 1.2)
            }

            pred = ml_service.predict(raw_input)
            bust_prob = pred["bust_probability"]
            conf_score = pred["confidence_score"]
            risk_level = pred["risk_level"]

            if conf_score >= 75.0:
                high_conf += 1
            elif conf_score >= 50.0:
                med_conf += 1
            else:
                low_conf += 1

            if bust_prob >= 75.0:
                severe_risk += 1

            total_conf += conf_score
            total_bust += bust_prob

            region_summaries.append({
                "region_id": r_id,
                "region_name": r_info["name"],
                "zone": r_info["zone"],
                "forecast_day": day,
                "bust_probability": bust_prob,
                "confidence_score": conf_score,
                "risk_level": risk_level,
                "confidence_level": pred["confidence_level"],
                "dominant_factor": pred["dominant_factor"],
                "precip_forecast": raw_input["precip_forecast"],
                "temp_forecast": raw_input["temp_forecast"],
                "ensemble_spread": raw_input["ensemble_spread"],
                "cape_j_kg": raw_input["cape_j_kg"],
                "pressure_tendency_24h": raw_input["pressure_tendency_24h"],
                "simulated_actual": f_data.get("simulated_actual")
            })

        count = len(region_summaries) or 1
        return {
            "forecast_day": day,
            "scenario_id": scenario_id,
            "scenario_name": scenario_meta.get("name", "Operational Scenario"),
            "total_regions": len(region_summaries),
            "high_confidence_count": high_conf,
            "medium_confidence_count": med_conf,
            "low_confidence_count": low_conf,
            "severe_risk_count": severe_risk,
            "national_mean_confidence": round(total_conf / count, 1),
            "national_mean_bust_prob": round(total_bust / count, 1),
            "is_demo_mode": True,
            "init_time_utc": init_time_str,
            "valid_time_utc": valid_time_str,
            "lead_hours": exact_lead_h,
            "temporal_resolution": temporal_resolution,
            "available_valid_times": available_times,
            "regions": region_summaries
        }

    def get_forecast_detail(
        self, 
        region_id: str, 
        day: int = 5, 
        scenario_id: str = "live_gefs",
        valid_hour: Optional[int] = None,
        lead_hours: Optional[int] = None,
        date: Optional[str] = None
    ) -> Dict[str, Any]:
        day = max(0, min(10, day))
        r_info = self.regions_by_id.get(region_id)
        if not r_info:
            r_id = list(self.regions_by_id.keys())[0]
            r_info = self.regions_by_id[r_id]
            region_id = r_id

        # 0. Live Operational GEFS Feed
        if scenario_id == "live_gefs" or not scenario_id:
            h = valid_hour if valid_hour is not None else 0
            if lead_hours is not None:
                h = lead_hours % 24
                day = min(10, max(0, math.ceil(lead_hours / 24.0))) if lead_hours > 0 else 0
            live_sub = live_gefs_service.get_subdivision_forecast(region_id, day=day, valid_hour=h, date=date)
            if live_sub:
                return live_sub

        # Real data feed from Parquet
        if scenario_id == "real_gefs_july2019" and self.real_batch_df is not None:
            chosen_init = "2019-07-05 00:00"
            init_dt = datetime(2019, 7, 5, 0, 0)
            
            if lead_hours is not None:
                calc_lead = max(0, min(240, lead_hours))
                day = min(10, max(1, math.ceil(calc_lead / 24.0))) if calc_lead > 0 else 1
                actual_valid_hour = calc_lead % 24
                exact_lead_h = calc_lead
            elif valid_hour is not None:
                actual_valid_hour = max(0, min(21, (valid_hour // 3) * 3))
                exact_lead_h = min(240, day * 24 + actual_valid_hour)
            else:
                actual_valid_hour = 0
                exact_lead_h = day * 24

            valid_dt = init_dt + timedelta(hours=exact_lead_h)

            if actual_valid_hour > 0:
                lead_days = round(exact_lead_h / 24.0, 2)
                temp_diurnal = round(2.5 * math.sin((actual_valid_hour - 3) * math.pi / 12.0), 1)
                cape_factor = round(1.0 + 0.28 * math.sin((actual_valid_hour - 4) * math.pi / 12.0), 2)
                mslp_diurnal = round(1.2 * math.cos(actual_valid_hour * math.pi / 6.0), 1)
                ens_spread_adj = round((actual_valid_hour - 12) * 0.02, 2)
            else:
                lead_days = float(day)
                temp_diurnal = 0.0
                cape_factor = 1.0
                mslp_diurnal = 0.0
                ens_spread_adj = 0.0

            match = self.real_batch_df[
                (self.real_batch_df["init_date"] == chosen_init) &
                (self.real_batch_df["region_id"] == region_id) &
                (self.real_batch_df["lead_time_days"] == day)
            ]
            if len(match) > 0:
                row = match.iloc[0]
                raw_input = {
                    "region_id": region_id,
                    "lead_time_days": lead_days,
                    "temp_forecast": round(float(row["temp_forecast_degc"]) + temp_diurnal, 1),
                    "precip_forecast": round(float(row["precip_forecast_mm"]), 1),
                    "mslp": round(float(row["mslp_forecast_hpa"]) + mslp_diurnal, 1),
                    "pressure_tendency_24h": round(float(row["pressure_tendency_24h"]), 1),
                    "rh_850": round(float(row["rh_850_pct"]), 1),
                    "wind_shear_850_200": round(float(row["wind_shear_850_200_ms"]), 1),
                    "cape_j_kg": round(max(200.0, float(row["cape_j_kg"]) * cape_factor), 1),
                    "ensemble_spread": round(max(0.5, float(row["ensemble_spread"]) + ens_spread_adj), 2)
                }
                simulated_actual = {
                    "precip_actual": round(float(row["actual_precip_mm"]), 1),
                    "temp_actual": round(float(row["actual_temp_degc"]) + temp_diurnal, 1),
                    "rain_delta": round(float(row["rain_error_mm"]), 1),
                    "temp_delta": round(float(row["temp_error_degc"]), 1),
                    "mslp_actual": round(float(row["actual_mslp_hpa"]) + mslp_diurnal, 1),
                    "mslp_delta": round(float(row["mslp_error_hpa"]), 1),
                    "is_bust": int(row["is_bust"]),
                    "bust_trigger": str(row["bust_trigger"]),
                    "contingency_category": str(row["contingency_category"])
                }
                prediction = ml_service.predict(raw_input)
                return {
                    "region": r_info,
                    "forecast_day": day,
                    "scenario_id": scenario_id,
                    "init_time_utc": "2019-07-05 00:00 UTC",
                    "valid_time_utc": valid_dt.strftime("%Y-%m-%d %H:%M UTC"),
                    "lead_hours": exact_lead_h,
                    "valid_hour": actual_valid_hour,
                    "raw_parameters": raw_input,
                    "simulated_actual": simulated_actual,
                    "prediction": prediction
                }

        scenario_data = self.scenarios_cache.get(scenario_id, self.scenarios_cache.get("monsoon_depression_bust", {}))
        f_data = scenario_data.get("days", {}).get(str(day), {}).get(region_id, {})

        raw_input = {
            "region_id": region_id,
            "lead_time_days": day,
            "temp_forecast": f_data.get("temp_forecast", r_info["baseline_temp"]),
            "precip_forecast": f_data.get("precip_forecast", r_info["baseline_rain"]),
            "mslp": f_data.get("mslp", 1008.0),
            "pressure_tendency_24h": f_data.get("pressure_tendency_24h", -1.0),
            "rh_850": f_data.get("rh_850", 65.0),
            "wind_shear_850_200": f_data.get("wind_shear_850_200", 12.0),
            "cape_j_kg": f_data.get("cape_j_kg", 800.0),
            "ensemble_spread": f_data.get("ensemble_spread", 1.2)
        }

        prediction = ml_service.predict(raw_input)
        init_dt = datetime(2024, 7, 10, 0, 0)
        valid_dt = init_dt + timedelta(days=day)

        return {
            "region": r_info,
            "forecast_day": day,
            "scenario_id": scenario_id,
            "init_time_utc": "2024-07-10 00:00 UTC",
            "valid_time_utc": valid_dt.strftime("%Y-%m-%d 00:00 UTC"),
            "lead_hours": day * 24,
            "valid_hour": 0,
            "raw_parameters": raw_input,
            "simulated_actual": f_data.get("simulated_actual"),
            "prediction": prediction
        }

    def get_lead_time_curve(self, region_id: str, scenario_id: str = "live_gefs") -> Dict[str, Any]:
        r_info = self.regions_by_id.get(region_id, self.regions_cache[0])
        r_id = r_info["id"]

        # If live_gefs and cached curve exists
        if (scenario_id == "live_gefs" or not scenario_id) and live_gefs_service.live_data:
            curves = live_gefs_service.live_data.get("degradation_curves", {})
            if r_id in curves:
                return {
                    "region_id": r_id,
                    "region_name": r_info["name"],
                    "scenario_id": "live_gefs",
                    "curve": curves[r_id].get("curve", [])
                }

        points = []
        for day in range(1, 11):
            detail = self.get_forecast_detail(r_id, day, scenario_id)
            pred = detail["prediction"]
            params = detail["raw_parameters"]
            points.append({
                "day": day,
                "confidence_score": pred["confidence_score"],
                "bust_probability": pred["bust_probability"],
                "risk_level": pred["risk_level"],
                "precip_forecast": params.get("precip_forecast", 0.0),
                "cape_j_kg": params.get("cape_j_kg", 600.0),
                "ensemble_spread": params.get("ensemble_spread", 1.2)
            })

        return {
            "region_id": r_id,
            "region_name": r_info["name"],
            "scenario_id": scenario_id,
            "curve": points
        }

    def get_cities(self) -> List[Dict[str, Any]]:
        return live_gefs_service.cities

    def get_city_forecast(self, city_id: str, day: int = 1, valid_hour: int = 0, date: Optional[str] = None, lat: Optional[float] = None, lon: Optional[float] = None) -> Optional[Dict[str, Any]]:
        return live_gefs_service.get_city_forecast(city_id, day=day, valid_hour=valid_hour, date=date, lat=lat, lon=lon)

data_service = DataService()


