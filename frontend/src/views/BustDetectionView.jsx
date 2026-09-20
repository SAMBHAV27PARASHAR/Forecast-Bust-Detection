import React from 'react';
import ExplainabilityCard from '../components/ExplainabilityCard';

export default function BustDetectionView({
  selectedRegionDetail,
  selectedRegionId,
  setSelectedRegionId,
  regions,
  selectedDay,
  setSelectedDay,
  onNavigateView
}) {
  const regionName = selectedRegionDetail?.region?.name || 'Selected Subdivision';
  const bustRisk = selectedRegionDetail?.bust_probability ?? 0;
  const confidence = selectedRegionDetail?.confidence_score ?? 0;
  const features = selectedRegionDetail?.features || {};

  return (
    <div className="view-container bust-detection-view">
      <div className="view-header-card">
        <div className="header-left-block">
          <h2 className="view-title">⚠️ AI Forecast Bust Detection & Meteorological Diagnostics</h2>
          <p className="view-desc">
            Calibrated Random Forest classification of numerical weather prediction bust likelihood. Analyzes non-linear atmospheric interactions, moisture transport, and baroclinic instability.
          </p>
        </div>
      </div>

      {/* Region & Lead Time Selection Bar */}
      <div className="selection-bar-card">
        <div className="selection-field">
          <label>Target Subdivision:</label>
          <select
            value={selectedRegionId}
            onChange={(e) => setSelectedRegionId(e.target.value)}
            className="styled-select"
          >
            {regions.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
            ))}
          </select>
        </div>

        <div className="selection-field">
          <label>Forecast Lead Time:</label>
          <div className="day-pills-row">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => (
              <button
                key={d}
                className={`day-pill-btn ${d === selectedDay ? 'active' : ''}`}
                onClick={() => setSelectedDay(d)}
              >
                D{d} (+{d * 24}h)
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Assessment Summary Cards */}
      <div className="bust-summary-grid">
        <div className="bust-summary-card">
          <span className="card-label">Predicted Bust Probability</span>
          <div className="big-prob-val">
            <span className="val-text text-bust">{bustRisk}%</span>
            <span className={`status-badge ${bustRisk >= 60 ? 'badge-bust-high' : bustRisk >= 35 ? 'badge-bust-elevated' : 'badge-bust-low'}`}>
              {bustRisk >= 60 ? 'HIGH BUST RISK' : bustRisk >= 35 ? 'ELEVATED RISK' : 'LOW RISK (STABLE)'}
            </span>
          </div>
          <p className="card-subtext">
            Probability of operational NWP 24h accumulated rainfall deviating by ≥25mm from actual ground verification.
          </p>
        </div>

        <div className="bust-summary-card">
          <span className="card-label">Model Confidence Score</span>
          <div className="big-prob-val">
            <span className="val-text text-conf">{confidence}%</span>
            <span className="status-badge badge-conf">Calibrated</span>
          </div>
          <p className="card-subtext">
            Derived from Platt scaling and ensemble tree agreement over local atmospheric feature space.
          </p>
        </div>

        <div className="bust-summary-card">
          <span className="card-label">Dominant Instability Trigger</span>
          <div className="big-prob-val">
            <span className="val-text text-warning">
              {features.cape_surface > 1500 ? 'Deep Convection (CAPE)' : features.vertical_wind_shear > 18 ? 'Strong Wind Shear' : features.rh_850 > 80 ? 'High Moisture Influx' : 'Mesoscale Forcing'}
            </span>
          </div>
          <p className="card-subtext">
            Primary atmospheric driver contributing to ensemble dispersion and trajectory divergence.
          </p>
        </div>
      </div>

      {/* Deep Explainability & Feature Drivers */}
      <div className="bust-details-section">
        <ExplainabilityCard selectedRegionDetail={selectedRegionDetail} />
      </div>

      {/* Quick Navigation to Stability & What Changed */}
      <div className="next-steps-banner">
        <div>
          <h4>Want to know if this forecast is drifting over consecutive runs?</h4>
          <p>Check the Forecast Stability Monitor to track run-to-run cycle consistency.</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigateView('stability')}>
          Open Forecast Stability Monitor 📈
        </button>
      </div>
    </div>
  );
}
