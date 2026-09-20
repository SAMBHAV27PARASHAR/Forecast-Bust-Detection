# AI-Based Forecast Bust Detection for Medium-Range Weather Forecasts (SIH 26079)

![SIH 26079 Prototype](https://img.shields.io/badge/SIH-Problem_26079-0284c7?style=for-the-badge)
![FastAPI Backend](https://img.shields.io/badge/Backend-FastAPI_Python_3.14-059669?style=for-the-badge&logo=fastapi)
![React Frontend](https://img.shields.io/badge/Frontend-React_Vite-6366f1?style=for-the-badge&logo=react)
![ML Engine](https://img.shields.io/badge/ML-Scikit--Learn_Random_Forest-ea580c?style=for-the-badge&logo=scikitlearn)

An operational, explainable AI prototype designed for **Smart India Hackathon (SIH) Problem Statement 26079** to predict, quantify, and explain numerical weather prediction (NWP) "forecast busts" across 14 Indian meteorological subdivisions for medium-range forecast horizons (**Day 1 to Day 10**).

---

## 1. Problem Statement & Motivation

Numerical weather prediction models (e.g. IMD NCUM, ECMWF IFS, NOAA GFS) exhibit rapid loss of skill at medium-range horizons (Day 3 to Day 10). Under specific atmospheric regimes—such as tropical cyclogenesis in the Bay of Bengal, orographic cloudbursts, or pre-monsoon convective squalls—forecast errors deviate dramatically from standard margins. These catastrophic failures are known as **Forecast Busts**.

Forecasters and disaster management authorities (NDRF, SDMAs) currently lack an automated, real-time warning system that flags *when*, *where*, and *why* a numerical model is likely to bust before catastrophic weather strikes.

---

## 2. Solution Overview

This system provides:
1. **Interactive India Forecast Confidence Map**: Color-coded visualization of 14 meteorological zones across India from Day 1 to Day 10 (Green = High Confidence $\ge 75\%$, Amber = Moderate Risk, Red = Low Confidence, Crimson = Critical Bust Alert).
2. **Quantified Bust Probability**: Probability of large forecast error ($P(\text{Bust}) \in [0, 100\%]$) with risk classifications.
3. **Error-Prone Region Detection**: Immediate real-time alert counters identifying volatile sub-divisions.
4. **Meteorological Explainability**: Transparent, physically-grounded explanations showing why confidence is low (e.g., CAPE convective surge, 24h pressure falls, deep-layer shear, ensemble spread divergence).
5. **Forecast vs Simulated Verification Delta**: Direct side-by-side comparison between forecasted weather and verification actuals.
6. **10-Day Predictability Decay Curves**: Line/area visualization tracking confidence loss across the 10-day forecast horizon.
7. **Interactive What-If Scenario Simulator**: Stress-tester for forecasters to simulate custom atmospheric conditions and receive instant ML risk evaluations.

---

## 3. Technology Stack

- **Frontend**: React 18, Vite, Vanilla CSS (dark tactical meteorological design system, glassmorphism, responsive layouts).
- **Vector Mapping**: Custom interactive SVG map of India with 14 meteorological sub-divisions.
- **Backend API**: Python 3.14, FastAPI, Pydantic, Uvicorn.
- **Machine Learning**: Scikit-Learn (Calibrated Random Forest / Gradient Boosting), Pandas, NumPy, Joblib.

---

## 4. Repository Structure

```
SIH26079/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints.py        # Endpoints: /health, /api/risk-map, /api/forecast, /api/predict
│   │   ├── core/
│   │   │   └── config.py           # Operational thresholds & constants
│   │   ├── models/
│   │   │   └── schemas.py          # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── data_service.py     # Subdivisions metadata & deterministic scenario cache
│   │   │   └── ml_service.py       # ML inference & feature attribution engine
│   │   └── main.py                 # FastAPI application entrypoint
│   └── requirements.txt
├── ml/
│   ├── features.py                 # Atmospheric proxies & local explainability attribution
│   ├── dataset_generator.py        # Synthesizes 7,000+ realistic NWP historical verification pairs
│   ├── train.py                    # Trains calibrated Random Forest (ROC-AUC 0.93+)
│   └── generate_scenarios.py       # Produces deterministic 10-day case studies for live demo
├── data/
│   ├── india_regions.json          # 14 Indian meteorological subdivisions with SVG boundaries
│   ├── sample_forecasts.json       # Deterministic 10-day scenarios (Monsoon Depression, etc.)
│   └── historical_nwp_dataset.csv  # Generated verification dataset
├── models/
│   ├── bust_classifier.pkl         # Serialized ML model artifact
│   └── model_metadata.json         # Performance metrics & threshold metadata
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx          # SIH header & demo indicator badge
│   │   │   ├── LeadTimeSlider.jsx  # Day 1 - Day 10 scrub bar
│   │   │   ├── IndiaRiskMap.jsx    # Interactive SVG India map with hover tooltips
│   │   │   ├── MetricCards.jsx     # High-level operational KPI cards
│   │   │   ├── ExplainabilityCard.jsx # Meteorological reason waterfall breakdown
│   │   │   ├── ForecastVsObsChart.jsx # Forecast vs Actual comparison visualizer
│   │   │   ├── LeadTimeDegradationChart.jsx # 10-day confidence decay curve
│   │   │   ├── ScenarioSelector.jsx# Case study switcher
│   │   │   └── WhatIfSimulator.jsx # Interactive custom weather stress tester
│   │   ├── services/
│   │   │   └── api.js              # Fetch client communicating with FastAPI
│   │   ├── App.jsx                 # Main dashboard layout
│   │   ├── App.css / index.css     # Dark mode meteorological styling
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── docs/
│   └── architecture.md             # Technical design & scientific documentation
├── .gitignore
└── README.md
```

---

## 5. Getting Started (Running Locally)

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Node.js LTS (v20+ or v24) with npm

### 1. Backend Setup & Run
From the root directory:

```bash
# Install backend Python dependencies
python -m pip install -r backend/requirements.txt

# (Optional) Retrain ML Model & regenerate dataset
python ml/train.py

# Launch FastAPI Server
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend will start at:
- API Base: `http://localhost:8000`
- Interactive Swagger Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### 2. Frontend Setup & Run
Open a second terminal:

```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite Development Server
npm run dev
```
The dashboard will start at:
- Web Dashboard: `http://localhost:5173`

---

## 6. How the Machine Learning Pipeline Works

1. **Feature Formulation**:
   - `lead_time_days`: Forecast lead time (1 to 10 days)
   - `temp_forecast`: 2m Surface Temperature (°C)
   - `precip_forecast`: 24h Accumulated Rainfall (mm)
   - `mslp`: Mean Sea Level Pressure (hPa)
   - `pressure_tendency_24h`: 24h Pressure Fall (hPa)
   - `rh_850`: 850 hPa Relative Humidity (%)
   - `wind_shear_850_200`: Deep-Layer Wind Shear (m/s)
   - `cape_j_kg`: Convective Available Potential Energy (J/kg)
   - `ensemble_spread`: Multi-member NWP variance ($\sigma$)
   - Derived physical proxies: compound instability index, lead-time decay scaling, baroclinic gradient.

2. **Ground Truth Bust Criterion**:
   A forecast is flagged as a bust if:
   $$\text{Bust} = \left(|P_{\text{actual}} - P_{\text{forecast}}| \ge 35\text{ mm}\right) \lor \left(|T_{\text{actual}} - T_{\text{forecast}}| \ge 4.5^\circ\text{C}\right)$$

3. **Classification & Calibration**:
   A calibrated Random Forest Classifier trained on 7,000+ verification points produces calibrated probabilities $P(\text{Bust}) \in [0, 1]$.
   $$\text{Confidence Score} = (1 - P(\text{Bust})) \times 100\%$$

4. **Tree Gradient Explainability**:
   Feature deviations relative to climatological baselines are multiplied by global tree importance weights to yield percentage attribution bars explaining exactly why the forecast is unstable.

---

## 7. Sample Data & Future Real-World Integration

> **Notice**: To allow seamless local evaluation without requiring live IMD/ECMWF API credentials, this prototype includes a **clearly labelled Synthetic / Demo Data Layer** that models realistic physics and historical error distributions.

### Future Operational Integration Path:
- **GRIB2 / NetCDF Ingestor**: Connect directly to ECMWF MARS or IMD Open Data servers via `cfgrib` and `xarray`.
- **Automated Weather Stations (AWS)**: Stream actual IMD ground observations into the verification pipeline via WMO GTS or IMD REST APIs.
- **Ensemble NetCDF Parser**: Automatically extract ensemble standard deviation $\sigma_{\text{ens}}$ from GEFS/EPS 50-member runs.
