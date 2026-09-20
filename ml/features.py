"""
SIH 26079: Atmospheric Feature Engineering and Explainability Module
Computes meteorological proxies, lead-time scaling, and feature contributions for forecast bust detection.
"""

from typing import Dict, List, Any
import numpy as np

FEATURE_NAMES = [
    "lead_time_days",
    "temp_forecast",
    "precip_forecast",
    "mslp",
    "pressure_tendency_24h",
    "rh_850",
    "wind_shear_850_200",
    "cape_j_kg",
    "ensemble_spread",
    "instability_index",
    "lead_decay_factor",
    "baroclinic_gradient"
]

FEATURE_LABELS = {
    "lead_time_days": "Forecast Lead Time (Days)",
    "temp_forecast": "2m Surface Temperature (°C)",
    "precip_forecast": "24h Accumulated Precipitation (mm)",
    "mslp": "Mean Sea Level Pressure (hPa)",
    "pressure_tendency_24h": "24h Pressure Fall / Tendency (hPa)",
    "rh_850": "Relative Humidity at 850 hPa (%)",
    "wind_shear_850_200": "Deep Layer Wind Shear (m/s)",
    "cape_j_kg": "Convective Instability (CAPE, J/kg)",
    "ensemble_spread": "NWP Ensemble Spread / Variance",
    "instability_index": "Compound Convective Index",
    "lead_decay_factor": "Lead Horizon Predictability Decay",
    "baroclinic_gradient": "Baroclinic Dynamic Gradient"
}

FEATURE_EXPLANATIONS = {
    "lead_time_days": "Predictability drops non-linearly past Day 4 due to numerical chaos and error propagation.",
    "pressure_tendency_24h": "Rapid 24h pressure drop indicates cyclogenesis or intensifying low-pressure system.",
    "cape_j_kg": "High convective available potential energy (>2000 J/kg) drives explosive sub-grid thunderstorms.",
    "ensemble_spread": "Wide divergence between ensemble members signifies high atmospheric bifurcation risk.",
    "wind_shear_850_200": "Strong vertical shear can abruptly displace convective cores or organize squall lines.",
    "precip_forecast": "High forecasted rainfall triggers complex non-linear cloud microphysics errors.",
    "rh_850": "Moisture saturation in lower troposphere primes rapid atmospheric overturn.",
    "instability_index": "Coupled moisture and convective energy trigger localized precipitation busts.",
    "baroclinic_gradient": "Frontal/trough boundary sharpening leads to positional forecast displacement."
}


def compute_derived_features(raw_dict: Dict[str, float]) -> List[float]:
    """
    Transforms raw NWP weather parameters into complete feature vector with derived physical indices.
    """
    lead_time = float(raw_dict.get("lead_time_days", 3))
    temp = float(raw_dict.get("temp_forecast", 28.0))
    precip = float(raw_dict.get("precip_forecast", 10.0))
    mslp = float(raw_dict.get("mslp", 1008.0))
    p_tend = float(raw_dict.get("pressure_tendency_24h", -1.0))
    rh = float(raw_dict.get("rh_850", 65.0))
    shear = float(raw_dict.get("wind_shear_850_200", 12.0))
    cape = float(raw_dict.get("cape_j_kg", 800.0))
    ens_spread = float(raw_dict.get("ensemble_spread", 1.5))

    # Derived physical proxies
    instability = (cape / 1000.0) * (rh / 50.0)
    lead_decay = np.sqrt(max(1.0, lead_time))
    baroclinic = abs(p_tend) * (shear / 10.0)

    return [
        lead_time,
        temp,
        precip,
        mslp,
        p_tend,
        rh,
        shear,
        cape,
        ens_spread,
        instability,
        lead_decay,
        baroclinic
    ]


def calculate_contributing_factors(
    feature_values: List[float],
    feature_importances: List[float],
    bust_prob: float,
    top_k: int = 4
) -> List[Dict[str, Any]]:
    """
    Computes local feature contribution weights explaining why confidence is low or high.
    Uses feature anomalies multiplied by global tree importances.
    """
    # Baselines for normalization
    baselines = {
        0: 3.0,     # lead_time_days
        1: 28.0,    # temp_forecast
        2: 5.0,     # precip_forecast
        3: 1010.0,  # mslp
        4: 0.0,     # pressure_tendency_24h
        5: 60.0,    # rh_850
        6: 10.0,    # wind_shear
        7: 600.0,   # cape_j_kg
        8: 1.2,     # ensemble_spread
        9: 1.2,     # instability_index
        10: 1.73,   # lead_decay_factor
        11: 1.0     # baroclinic_gradient
    }

    scales = {
        0: 3.0,
        1: 6.0,
        2: 25.0,
        3: 8.0,
        4: 4.0,
        5: 20.0,
        6: 8.0,
        7: 1200.0,
        8: 1.5,
        9: 2.0,
        10: 1.0,
        11: 3.0
    }

    contributions = []
    for idx, (val, imp) in enumerate(zip(feature_values, feature_importances)):
        base = baselines.get(idx, 1.0)
        scale = scales.get(idx, 1.0)
        # Standardized deviation from nominal
        dev = (val - base) / scale

        # For pressure tendency, negative deviation (falling pressure) increases bust risk
        if idx == 4:
            dev = -dev

        # Directional impact weight
        impact = dev * imp
        fname = FEATURE_NAMES[idx]
        
        # Skip pure mathematical helper features in end-user explanation unless significant
        if fname in ["lead_decay_factor"]:
            continue

        contributions.append({
            "feature_id": fname,
            "feature_name": FEATURE_LABELS.get(fname, fname),
            "observed_value": round(val, 2),
            "raw_impact": float(impact),
            "importance": float(imp),
            "explanation": FEATURE_EXPLANATIONS.get(fname, "Influences forecast numerical dispersion.")
        })

    # Sort by absolute impact
    contributions.sort(key=lambda x: abs(x["raw_impact"]), reverse=True)
    top_factors = contributions[:top_k]

    # Convert to normalized percentage impact
    total_abs_impact = sum(abs(f["raw_impact"]) for f in top_factors) or 1.0
    for factor in top_factors:
        pct = (factor["raw_impact"] / total_abs_impact) * 100.0
        factor["impact_pct"] = round(pct, 1)
        factor["risk_contribution"] = "Elevates Bust Risk" if factor["raw_impact"] > 0 else "Stabilizes Forecast"

    return top_factors
