"""
SIH 26079: Realistic Meteorological NWP Historical Dataset Generator
Synthesizes multi-region Indian weather forecast vs observation verification dataset
incorporating atmospheric physics, lead time error growth, and chaotic bust regimes.
"""

import numpy as np
import pandas as pd
from typing import Tuple
from features import compute_derived_features, FEATURE_NAMES

def generate_synthetic_nwp_dataset(num_samples: int = 6000, random_seed: int = 42) -> pd.DataFrame:
    np.random.seed(random_seed)

    # Lead times distributed 1 to 10 days
    lead_times = np.random.choice(range(1, 11), size=num_samples, p=[0.14, 0.13, 0.12, 0.11, 0.10, 0.10, 0.10, 0.10, 0.05, 0.05])
    
    # 2m Temperature: Tropical / subtropical ranges 14°C to 42°C
    temp_forecast = np.random.normal(loc=29.0, scale=6.5, size=num_samples)
    temp_forecast = np.clip(temp_forecast, 10.0, 48.0)

    # 24h Precipitation: Log-normal distribution with dry days and heavy wet bursts
    precip_raw = np.random.exponential(scale=12.0, size=num_samples) - 4.0
    precip_forecast = np.clip(precip_raw, 0.0, 180.0)

    # Mean Sea Level Pressure (hPa): normal range 995 to 1018 hPa
    mslp = np.random.normal(loc=1007.0, scale=5.5, size=num_samples)

    # 24h Pressure Tendency (hPa): falling implies approaching trough / depression
    p_tend = np.random.normal(loc=-0.5, scale=2.8, size=num_samples)

    # 850 hPa Relative Humidity (%)
    rh_850 = np.random.normal(loc=65.0, scale=18.0, size=num_samples)
    rh_850 = np.clip(rh_850, 15.0, 98.0)

    # Vertical Wind Shear (m/s between 850 and 200 hPa)
    shear = np.random.gamma(shape=3.0, scale=4.0, size=num_samples)
    shear = np.clip(shear, 2.0, 35.0)

    # CAPE (J/kg): Convective Available Potential Energy
    cape = np.random.exponential(scale=900.0, size=num_samples)
    cape = np.clip(cape, 0.0, 4500.0)

    # Ensemble Spread: increases with lead time and instability
    base_spread = np.random.gamma(shape=2.0, scale=0.5, size=num_samples)
    lead_spread_multiplier = 1.0 + (lead_times - 1) * 0.22
    instability_spread = (cape / 3000.0) * 0.8
    ensemble_spread = base_spread * lead_spread_multiplier + instability_spread

    # Atmospheric Verification Synthesis (Simulated Actual Observations)
    # Lead-time error expansion: Lorenz butterfly effect
    time_decay = (lead_times / 3.0) ** 1.35

    # Convective trigger factor
    convective_trigger = (cape > 2200) & (rh_850 > 75)
    
    # Depression / Baroclinic trigger
    depression_trigger = (p_tend < -4.5) & (shear > 18)

    # Spread bifurcation trigger
    spread_trigger = ensemble_spread > 3.2

    # Actual observation deviations
    noise_rain = np.random.normal(0, 4.0 * time_decay, size=num_samples)
    noise_temp = np.random.normal(0, 0.8 * time_decay, size=num_samples)

    # Injected systematic non-linear errors under volatile regimes
    rain_error = noise_rain.copy()
    rain_error[convective_trigger] += np.random.choice([1, -1], size=np.sum(convective_trigger)) * np.random.uniform(40, 95, size=np.sum(convective_trigger))
    rain_error[depression_trigger] += np.random.choice([1, -1], size=np.sum(depression_trigger)) * np.random.uniform(45, 110, size=np.sum(depression_trigger))

    temp_error = noise_temp.copy()
    temp_error[spread_trigger] += np.random.choice([1, -1], size=np.sum(spread_trigger)) * np.random.uniform(3.5, 7.5, size=np.sum(spread_trigger))

    actual_precip = np.clip(precip_forecast + rain_error, 0.0, 300.0)
    actual_temp = np.clip(temp_forecast + temp_error, 5.0, 50.0)

    # Ground Truth Bust Definition (operational IMD/WMO standard criteria)
    # Severe rain delta > 35mm OR severe temperature delta > 4.5°C
    is_rain_bust = np.abs(actual_precip - precip_forecast) >= 35.0
    is_temp_bust = np.abs(actual_temp - temp_forecast) >= 4.5
    bust_occurred = (is_rain_bust | is_temp_bust).astype(int)

    # Assemble dataset
    records = []
    for i in range(num_samples):
        raw = {
            "lead_time_days": lead_times[i],
            "temp_forecast": temp_forecast[i],
            "precip_forecast": precip_forecast[i],
            "mslp": mslp[i],
            "pressure_tendency_24h": p_tend[i],
            "rh_850": rh_850[i],
            "wind_shear_850_200": shear[i],
            "cape_j_kg": cape[i],
            "ensemble_spread": ensemble_spread[i]
        }
        features = compute_derived_features(raw)
        row = dict(zip(FEATURE_NAMES, features))
        row["actual_precip"] = actual_precip[i]
        row["actual_temp"] = actual_temp[i]
        row["rain_error"] = actual_precip[i] - precip_forecast[i]
        row["temp_error"] = actual_temp[i] - temp_forecast[i]
        row["bust_occurred"] = bust_occurred[i]
        records.append(row)

    df = pd.DataFrame(records)
    return df

if __name__ == "__main__":
    df = generate_synthetic_nwp_dataset()
    print(f"Generated {len(df)} samples.")
    print(f"Bust rate: {df['bust_occurred'].mean() * 100:.2f}%")
    df.to_csv("d:/SIH26079/data/historical_nwp_dataset.csv", index=False)
    print("Saved to d:/SIH26079/data/historical_nwp_dataset.csv")
