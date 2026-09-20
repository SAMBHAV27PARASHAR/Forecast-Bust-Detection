# SIH 26079: AI-Based Forecast Bust Detection Architecture

## 1. Problem Definition & Operational Context

In medium-range numerical weather prediction (NWP, typically covering forecast horizons from **Day 1 to Day 10**), atmospheric predictability decreases as lead time advances due to dynamical chaos (Lorenz, 1969). While standard forecast verification yields gradual error growth, numerical models occasionally suffer from catastrophic failure modes known as **Forecast Busts**:

> **Forecast Bust**: A forecast event where the numerical model error unexpectedly and dramatically exceeds standard verification bounds (e.g. precipitation delta $|Error| \ge 35\text{ mm/day}$ or 2m temperature anomaly $|Error| \ge 4.5^\circ\text{C}$).

Such busts are critical hazards in India due to sudden, unpredicted cloudbursts, rapidly diverging cyclonic tracks across the Bay of Bengal or Arabian Sea, abrupt monsoon trough oscillations, and severe pre-monsoon convective squalls.

---

## 2. End-to-End System Architecture

```
+-------------------------------------------------------------------------------+
|                           NWP INPUT STREAMS                                  |
| (Simulated Multi-Member Ensemble / IMD / ECMWF / NCUM GRIB2/NetCDF)           |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                    ATMOSPHERIC FEATURE ENGINEERING                            |
|  - Lead Horizon (1-10 Days)            - Convective Available Potential Energy|
|  - 2m Temperature Forecast             - 850 hPa Relative Humidity            |
|  - 24h Accumulated Rainfall            - Deep-Layer Wind Shear (850-200 hPa)  |
|  - Mean Sea Level Pressure (MSLP)      - Multi-Model Ensemble Spread (σ_ens)  |
|  - 24h Pressure Tendency (ΔP)          - Compound Instability Indices         |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                  MACHINE LEARNING CLASSIFICATION ENGINE                       |
|  - Calibrated Random Forest / Gradient Boosting Ensemble                      |
|  - Probability of Bust: P(Bust) in [0, 100%]                                  |
|  - Confidence Score: (100 - P(Bust))%                                         |
|  - Tree Gradient Local Feature Attribution (SHAP-aligned explainability)       |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                             FASTAPI BACKEND                                   |
|  - GET /health               : Service health & model readiness               |
|  - GET /api/risk-map         : All 14 Indian meteorological subdivisions      |
|  - GET /api/forecast/{region}: Weather variables & simulated verification     |
|  - GET /api/lead-time-curve  : Day 1 to Day 10 confidence degradation curve   |
|  - POST /api/predict         : What-If stress testing operational simulator   |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
|                      REACT OPERATIONAL DASHBOARD                              |
|  - Dynamic Lead Time Scrub Bar (Day 1 - Day 10)                               |
|  - Interactive Vector SVG India Map with Confidence Coloring                  |
|  - 4 Operational Metric Cards (Confidence, Alert Count, Risk Tier)            |
|  - Meteorological Explainability Waterfall Card                               |
|  - Forecast vs Simulated Verification Comparison Visualizer                   |
|  - What-If Forecast Stress-Testing Drawer                                      |
+-------------------------------------------------------------------------------+
```

---

## 3. Meteorological Calibration & Operational Thresholds

| Confidence Level | Confidence Score | Bust Probability | Operational Action |
| :--- | :--- | :--- | :--- |
| **High Confidence** | $\ge 75\%$ | $< 25\%$ | High deterministic reliability; standard public advisory |
| **Medium Confidence**| $50\% - 74\%$ | $25\% - 49\%$ | Moderate spread; continuous radar/satellite cross-check |
| **Low Confidence** | $25\% - 49\%$ | $50\% - 74\%$ | Forecast volatility alert; ensemble bifurcation flagged |
| **Bust Alert (Critical)** | $< 25\%$ | $\ge 75\%$ | Severe divergence warning; high probability of model failure |

---

## 4. Explainability & Meteorological Attribution

Antigravity Forecast Bust Detection avoids "black-box" predictions. When confidence drops, the attribution engine determines the exact physical drivers responsible:
- **Convective Overturn**: High CAPE coupled with high lower-tropospheric humidity triggers sub-grid mesoscale convective systems that coarse NWP grids fail to resolve.
- **Baroclinic Wave Divergence / Cyclogenesis**: Rapid 24h pressure falls ($\le -4\text{ hPa}$) combined with strong vertical shear signify accelerating vortex intensification.
- **Ensemble Spread**: High divergence among perturbed ensemble members directly maps to dynamic bifurcation points in the atmosphere.
