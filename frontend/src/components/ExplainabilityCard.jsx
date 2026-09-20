import React from 'react';

export default function ExplainabilityCard({ selectedRegionDetail }) {
  const reg = selectedRegionDetail?.region;
  const pred = selectedRegionDetail?.prediction;
  const factors = pred?.contributing_factors || [];
  const raw = selectedRegionDetail?.raw_parameters || {};

  return (
    <div className="explainability-card">
      <div className="card-header-styled">
        <div className="title-area">
          <div className="icon-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3>Meteorological Explainability & Attribution</h3>
            <p className="subtext">
              Physical factors explaining forecast reliability for <strong>{reg?.name || 'Selected Region'}</strong>
            </p>
          </div>
        </div>
        <div className="zone-pill">
          <span>{reg?.zone || 'Zone'} Sub-Division</span>
        </div>
      </div>

      {/* Atmospheric State Quick Glance */}
      <div className="weather-params-strip">
        <div className="param-item">
          <span className="param-label">Forecast Rain</span>
          <strong className="param-value">{raw.precip_forecast ?? '--'} mm</strong>
        </div>
        <div className="param-item">
          <span className="param-label">2m Temp</span>
          <strong className="param-value">{raw.temp_forecast ?? '--'} °C</strong>
        </div>
        <div className="param-item">
          <span className="param-label">MSLP Tendency</span>
          <strong className={`param-value ${raw.pressure_tendency_24h < -3.0 ? 'text-red' : ''}`}>
            {raw.pressure_tendency_24h ?? '--'} hPa/24h
          </strong>
        </div>
        <div className="param-item">
          <span className="param-label">CAPE</span>
          <strong className={`param-value ${raw.cape_j_kg > 2000 ? 'text-red' : ''}`}>
            {raw.cape_j_kg ?? '--'} J/kg
          </strong>
        </div>
        <div className="param-item">
          <span className="param-label">Wind Shear</span>
          <strong className="param-value">{raw.wind_shear_850_200 ?? '--'} m/s</strong>
        </div>
        <div className="param-item">
          <span className="param-label">Ensemble Spread</span>
          <strong className={`param-value ${raw.ensemble_spread > 2.2 ? 'text-red' : ''}`}>
            {raw.ensemble_spread ?? '--'} σ
          </strong>
        </div>
      </div>

      {/* Factor Attribution Breakdown */}
      <div className="attribution-section">
        <h4 className="section-subtitle">
          "Why is Confidence {pred?.confidence_level}?" — Top Atmospheric Triggers:
        </h4>

        <div className="factors-list">
          {factors.map((factor, idx) => {
            const isElevating = factor.risk_contribution === 'Elevates Bust Risk';
            const barWidth = Math.min(100, Math.max(10, Math.abs(factor.impact_pct)));

            return (
              <div key={idx} className="factor-row">
                <div className="factor-meta">
                  <div className="factor-name-group">
                    <span className={`factor-indicator ${isElevating ? 'risk-up' : 'risk-down'}`}>
                      {isElevating ? '▲' : '▼'}
                    </span>
                    <span className="factor-title">{factor.feature_name}</span>
                    <span className="factor-val-tag">Observed: {factor.observed_value}</span>
                  </div>
                  <div className="factor-impact-tag">
                    <span className={isElevating ? 'text-red' : 'text-green'}>
                      {isElevating ? `+${factor.impact_pct}% Bust Influence` : `${factor.impact_pct}% Stabilizing`}
                    </span>
                  </div>
                </div>

                <div className="factor-bar-track">
                  <div
                    className={`factor-bar-fill ${isElevating ? 'fill-danger' : 'fill-safe'}`}
                    style={{ width: `${barWidth}%` }}
                  ></div>
                </div>

                <p className="factor-explanation-text">
                  {factor.explanation}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="explainability-footer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          Attribution weights are derived from tree feature gradients calibrated on numerical verification records.
        </span>
      </div>
    </div>
  );
}
