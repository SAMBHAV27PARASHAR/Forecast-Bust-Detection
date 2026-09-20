import React, { useState } from 'react';
import { postCustomPrediction } from '../services/api';

export default function WhatIfSimulator({ onSimulationResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    forecast_day: 6,
    precip_forecast: 45.0,
    temp_forecast: 31.0,
    mslp: 1002.0,
    pressure_tendency_24h: -4.5,
    rh_850: 82.0,
    wind_shear_850_200: 20.0,
    cape_j_kg: 2600.0,
    ensemble_spread: 2.8
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleRunSimulation = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await postCustomPrediction(formData);
      setResult(res);
      if (onSimulationResult) onSimulationResult(res);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="simulator-drawer-card">
      <div className="simulator-header" onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer' }}>
        <div className="simulator-title-row">
          <span className="sim-badge">Interactive Tool</span>
          <h4>What-If NWP Forecast Simulator & Stress Tester</h4>
        </div>
        <button className="toggle-btn" aria-label="Toggle Simulator">
          {isOpen ? 'Collapse Simulator ▲' : 'Open Forecast Parameter Simulator ▼'}
        </button>
      </div>

      {isOpen && (
        <div className="simulator-content">
          <p className="sim-intro">
            Simulate custom atmospheric and numerical conditions to test the ML model's sensitivity to convective instability, cyclogenesis pressure collapse, or ensemble spread divergence.
          </p>

          <form onSubmit={handleRunSimulation} className="simulator-form">
            <div className="sim-grid">
              <div className="form-group">
                <label>Lead Time: Day {formData.forecast_day} (+{formData.forecast_day * 24}h)</label>
                <input
                  type="range"
                  name="forecast_day"
                  min="1"
                  max="10"
                  step="1"
                  value={formData.forecast_day}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Forecast Rain: {formData.precip_forecast} mm/24h</label>
                <input
                  type="range"
                  name="precip_forecast"
                  min="0"
                  max="150"
                  step="2"
                  value={formData.precip_forecast}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>24h Pressure Tendency: {formData.pressure_tendency_24h} hPa</label>
                <input
                  type="range"
                  name="pressure_tendency_24h"
                  min="-8"
                  max="3"
                  step="0.2"
                  value={formData.pressure_tendency_24h}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>CAPE Instability: {formData.cape_j_kg} J/kg</label>
                <input
                  type="range"
                  name="cape_j_kg"
                  min="100"
                  max="4500"
                  step="100"
                  value={formData.cape_j_kg}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>850 hPa Humidity: {formData.rh_850}%</label>
                <input
                  type="range"
                  name="rh_850"
                  min="20"
                  max="100"
                  step="2"
                  value={formData.rh_850}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Ensemble Spread: {formData.ensemble_spread}σ</label>
                <input
                  type="range"
                  name="ensemble_spread"
                  min="0.5"
                  max="4.5"
                  step="0.1"
                  value={formData.ensemble_spread}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-action-row">
              <button
                type="submit"
                id="btn-run-simulation"
                className="btn-run-sim"
                disabled={loading}
              >
                {loading ? 'Evaluating ML Model...' : 'Run Forecast Bust Predictor (ML Inference)'}
              </button>
            </div>
          </form>

          {/* Simulation Output Card */}
          {result && (
            <div className="sim-result-box">
              <div className="sim-result-header">
                <h5>Simulation Output:</h5>
                <span className={`risk-pill ${result.risk_level === 'Severe' ? 'badge-severe' : result.risk_level === 'High' ? 'badge-high' : 'badge-low'}`}>
                  {result.risk_level} Bust Risk
                </span>
              </div>

              <div className="sim-stats-row">
                <div className="sim-stat">
                  <span className="lbl">Bust Probability</span>
                  <strong className={result.bust_probability >= 50 ? 'text-red' : 'text-green'}>
                    {result.bust_probability}%
                  </strong>
                </div>
                <div className="sim-stat">
                  <span className="lbl">Confidence Score</span>
                  <strong className={result.confidence_score >= 75 ? 'text-green' : 'text-amber'}>
                    {result.confidence_score}%
                  </strong>
                </div>
                <div className="sim-stat">
                  <span className="lbl">Status</span>
                  <span>{result.confidence_level}</span>
                </div>
              </div>

              <p className="sim-summary">{result.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
