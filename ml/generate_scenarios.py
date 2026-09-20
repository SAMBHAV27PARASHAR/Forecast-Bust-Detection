"""
Generate rich deterministic scenario forecasts for SIH 26079 Demo.
Produces realistic 10-day forecasts across 14 Indian meteorological subdivisions for 4 operational scenarios.
"""

import json
import numpy as np

def build_scenarios():
    with open("d:/SIH26079/data/india_regions.json", "r") as f:
        regions_data = json.load(f)["regions"]

    scenarios = [
        {
            "id": "monsoon_depression_bust",
            "name": "Bay of Bengal Monsoon Depression (Extreme Day 5+ Bust)",
            "description": "Simulates a deepening low-pressure depression over the Bay of Bengal. By Day 5-8, numerical NWP models fail to resolve localized trough surge, causing a severe precipitation bust in Odisha, Bengal, and Central India.",
            "type": "Cyclone / Depression Bust"
        },
        {
            "id": "western_disturbance_bust",
            "name": "Western Disturbance Trough Divergence (Day 6-9 Bust)",
            "description": "An intense upper-tropospheric trough enters the Western Himalayas. Model ensemble bifurcates over Day 6-8, yielding temperature anomalies >5°C and unpredicted cloudburst risk.",
            "type": "Orographic / Baroclinic Bust"
        },
        {
            "id": "pre_monsoon_squall_bust",
            "name": "Pre-Monsoon Convective Squall & Heatwave Break (Day 4-7 Bust)",
            "description": "High surface heating triggers intense convective instability (CAPE > 3200 J/kg) over Maharashtra, Gujarat, and Gangetic plains with sudden squall lines missed by medium-range deterministic runs.",
            "type": "Convective Instability Bust"
        },
        {
            "id": "quiescent_flow",
            "name": "Stable Quiescent High-Pressure Flow (Nominal Forecast)",
            "description": "Post-monsoon continental high pressure dominating the subcontinent. Predictability remains exceptionally high across all 10 days with minimal bust risk.",
            "type": "Normal Baseline"
        }
    ]

    scenario_forecasts = {}

    for sc in scenarios:
        s_id = sc["id"]
        scenario_forecasts[s_id] = {
            "meta": sc,
            "days": {}
        }

        for day in range(1, 11):
            day_key = str(day)
            region_forecasts = {}

            for reg in regions_data:
                r_id = reg["id"]
                base_temp = reg["baseline_temp"]
                base_rain = reg["baseline_rain"]

                # Base values with lead time degradation
                lead_spread = 0.8 + (day - 1) * 0.28

                # Scenario specific perturbations
                if s_id == "monsoon_depression_bust":
                    if r_id in ["IND-WB-ODI", "IND-CEN-MP", "IND-KON-GOA", "IND-TEL-AP"]:
                        if day >= 4:
                            # Severe bust conditions
                            cape = 1800 + day * 160
                            p_tend = -2.0 - (day - 3) * 1.1
                            precip = 25.0 + (day - 3) * 18.0
                            shear = 16.0 + day * 1.4
                            rh = 82.0 + min(15.0, day * 2.0)
                            ens_spread = 1.4 + (day - 2) * 0.52
                            actual_precip = precip + (45.0 + day * 8.0)  # Major observed rain overshoot
                            actual_temp = base_temp - 3.5
                        else:
                            cape = 950 + day * 100
                            p_tend = -0.8
                            precip = base_rain + 4.0
                            shear = 12.0
                            rh = 72.0
                            ens_spread = 1.0 + day * 0.15
                            actual_precip = precip + 4.0
                            actual_temp = base_temp
                    else:
                        cape = 600 + day * 50
                        p_tend = -0.4
                        precip = base_rain
                        shear = 9.0
                        rh = 55.0
                        ens_spread = 0.9 + day * 0.18
                        actual_precip = precip + 2.0
                        actual_temp = base_temp

                elif s_id == "western_disturbance_bust":
                    if r_id in ["IND-NW-HIM", "IND-NW-PLN", "IND-UP-BIH"]:
                        if day >= 5:
                            cape = 1200 + day * 80
                            p_tend = -3.5 - (day - 4) * 0.8
                            precip = 15.0 + day * 7.0
                            shear = 22.0 + day * 1.2
                            rh = 78.0
                            ens_spread = 1.8 + (day - 3) * 0.45
                            actual_precip = precip + 38.0
                            actual_temp = base_temp - (4.8 + (day - 4) * 0.6)  # Severe cold drop
                        else:
                            cape = 500
                            p_tend = -0.5
                            precip = base_rain
                            shear = 14.0
                            rh = 60.0
                            ens_spread = 1.0 + day * 0.12
                            actual_precip = precip + 2.0
                            actual_temp = base_temp
                    else:
                        cape = 500
                        p_tend = 0.0
                        precip = base_rain
                        shear = 8.0
                        rh = 45.0
                        ens_spread = 0.8 + day * 0.15
                        actual_precip = precip
                        actual_temp = base_temp

                elif s_id == "pre_monsoon_squall_bust":
                    if r_id in ["IND-RAJ", "IND-GUJ", "IND-MAH-DESH"]:
                        if day >= 4:
                            cape = 2500 + day * 140
                            p_tend = -3.2 - (day - 3) * 0.7
                            precip = 6.0 + day * 4.0
                            shear = 18.0 + day * 1.5
                            rh = 68.0
                            ens_spread = 1.6 + (day - 2) * 0.42
                            actual_precip = precip + 48.0
                            actual_temp = base_temp - 5.5
                        else:
                            cape = 1100
                            p_tend = -0.6
                            precip = 2.0
                            shear = 10.0
                            rh = 40.0
                            ens_spread = 0.9 + day * 0.14
                            actual_precip = precip
                            actual_temp = base_temp
                    else:
                        cape = 700
                        p_tend = -0.2
                        precip = base_rain
                        shear = 8.0
                        rh = 55.0
                        ens_spread = 0.8 + day * 0.16
                        actual_precip = precip
                        actual_temp = base_temp

                else:  # quiescent_flow
                    cape = 350 + day * 20
                    p_tend = 0.1
                    precip = max(0.0, base_rain * 0.4)
                    shear = 6.0 + day * 0.4
                    rh = 45.0
                    ens_spread = 0.6 + day * 0.11
                    actual_precip = precip + 1.0
                    actual_temp = base_temp + 0.5

                temp_f = round(base_temp + np.sin(day * 0.5) * 1.2, 1)
                precip_f = round(max(0.0, precip), 1)
                mslp_val = round(1012.0 + p_tend, 1)

                region_forecasts[r_id] = {
                    "region_id": r_id,
                    "region_name": reg["name"],
                    "lead_time_days": day,
                    "temp_forecast": temp_f,
                    "precip_forecast": precip_f,
                    "mslp": mslp_val,
                    "pressure_tendency_24h": round(p_tend, 2),
                    "rh_850": round(rh, 1),
                    "wind_shear_850_200": round(shear, 1),
                    "cape_j_kg": round(cape, 1),
                    "ensemble_spread": round(ens_spread, 2),
                    # Synthetic verification actuals for demo comparison charts
                    "simulated_actual": {
                        "precip_actual": round(float(actual_precip), 1),
                        "temp_actual": round(float(actual_temp), 1),
                        "rain_delta": round(float(actual_precip - precip_f), 1),
                        "temp_delta": round(float(actual_temp - temp_f), 1)
                    }
                }

            scenario_forecasts[s_id]["days"][day_key] = region_forecasts

    with open("d:/SIH26079/data/sample_forecasts.json", "w") as f:
        json.dump(scenario_forecasts, f, indent=2)

    print("Generated d:/SIH26079/data/sample_forecasts.json successfully.")

if __name__ == "__main__":
    build_scenarios()
