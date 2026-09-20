import React from 'react';
import { formatUtcHourToIst, formatToIst } from '../utils/timezone';

export default function SelectedCityForecastCard({
  selectedCity,
  cityForecast,
  cityLoading = false,
  cityForecastError = null,
  selectedDate,
  selectedHour = 0,
  selectedDay = 5,
  selectedRegion = null
}) {
  if (!selectedCity) return null;

  // Derived metrics and risk badge
  const currentBustProb = cityForecast?.bust_probability ?? cityForecast?.current_step?.bust_probability ?? null;
  const getRiskBadge = (prob) => {
    if (prob === null || prob === undefined) return { label: 'EVALUATING', cls: 'badge-bust-low' };
    if (prob >= 60) return { label: 'HIGH BUST RISK', cls: 'badge-bust-high' };
    if (prob >= 35) return { label: 'ELEVATED RISK', cls: 'badge-bust-elevated' };
    return { label: 'LOW RISK (STABLE)', cls: 'badge-bust-low' };
  };
  const riskBadge = getRiskBadge(currentBustProb);

  const effectiveHour = selectedHour || 0;
  const displayDateStr = cityForecast?.selected_date_display || (selectedDate ? `${selectedDate}` : 'Selected Date');
  const forecastIstStr = cityForecast?.valid_time_utc
    ? formatToIst(cityForecast.valid_time_utc)
    : `${displayDateStr} • ${formatUtcHourToIst(effectiveHour)}`;
  const rawLeadHours = cityForecast?.lead_hours ?? (selectedDay * 24 + effectiveHour);
  const contributingFactors = cityForecast?.contributing_factors || [];
  const aiSummary = cityForecast?.summary || null;

  return (
    <div className="selected-location-forecast-card" id="city-forecast-card">
      {/* ── Section Eyebrow Tag ── */}
      <div className="section-eyebrow-tag" style={{
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-accent-blue, #0284c7)',
        marginBottom: '6px'
      }}>
        Selected City Forecast
      </div>

      {/* ── Card Header ── */}
      <div className="location-card-header">
        <div className="loc-card-title-group">
          <div className="loc-main-headline">
            <span className="loc-badge-icon">📍</span>
            <h3 className="loc-city-heading">
              {selectedCity?.name || 'Selected City'}{selectedCity?.state ? `, ${selectedCity.state}` : ''}
            </h3>
            <span className="loc-nwp-badge">Live GEFS Point Extraction</span>
          </div>
          <div className="loc-sub-details">
            <span>
              Coordinates: <strong>
                {selectedCity?.lat != null ? `${Number(selectedCity.lat).toFixed(4)}°N` : 'N/A'}, {selectedCity?.lon != null ? `${Number(selectedCity.lon).toFixed(4)}°E` : 'N/A'}
              </strong>
            </span>
            <span className="sep">•</span>
            <span>Forecast (IST): <strong>{forecastIstStr}</strong></span>
            <span className="sep">•</span>
            <span>Lead: <strong>+{rawLeadHours}h</strong></span>
            {selectedRegion && (
              <>
                <span className="sep">•</span>
                <span>Subdivision: <strong>{selectedRegion.name}</strong></span>
              </>
            )}
          </div>
        </div>
        {cityLoading && (
          <span className="loc-loading-pill">
            <span className="dot pulse"></span> Updating NWP grid...
          </span>
        )}
      </div>

      {/* ── Error / Unavailable State ── */}
      {(cityForecastError || cityForecast?.status === 'UNAVAILABLE' || cityForecast?.error) && !cityLoading && (
        <div className="city-forecast-error-banner" style={{
          padding: '16px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '8px',
          color: '#ef4444',
          margin: '12px 0',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          ⚠️ {cityForecast?.message || cityForecast?.error || cityForecastError || 'Data unavailable'}
        </div>
      )}

      {/* ── NWP Meteorological Parameters Grid ── */}
      {!cityForecastError && cityForecast?.status !== 'UNAVAILABLE' && !cityForecast?.error && (
        <div className="city-exact-metrics-grid">
          {/* Temperature */}
          <div className="hero-metric-tile">
            <span className="tile-label">Temperature</span>
            <span className="tile-value">
              {cityForecast?.temperature != null
                ? `${Number(cityForecast.temperature).toFixed(1)}°C`
                : cityLoading ? '—' : 'N/A'}
            </span>
            <span className="tile-sub">2m Surface Air Temp (GEFS)</span>
          </div>

          {/* Precipitation */}
          <div className="hero-metric-tile">
            <span className="tile-label">Precipitation</span>
            <span className="tile-value text-precip">
              {cityForecast?.rainfall != null
                ? `${Number(cityForecast.rainfall).toFixed(1)} mm`
                : cityLoading ? '—' : 'N/A'}
            </span>
            <span className="tile-sub">
              {cityForecast?.rainfall != null
                ? `Rate: ${(Number(cityForecast.rainfall) / 24.0).toFixed(2)} mm/h`
                : 'Accumulation forecast'}
            </span>
          </div>

          {/* Humidity */}
          <div className="hero-metric-tile">
            <span className="tile-label">Humidity</span>
            <span className="tile-value">
              {cityForecast?.humidity != null
                ? `${Number(cityForecast.humidity).toFixed(0)}%`
                : cityLoading ? '—' : 'N/A'}
            </span>
            <span className="tile-sub">Relative Humidity 850hPa</span>
          </div>

          {/* Wind Speed */}
          <div className="hero-metric-tile">
            <span className="tile-label">Wind Speed</span>
            <span className="tile-value">
              {cityForecast?.wind_speed != null
                ? `${Number(cityForecast.wind_speed).toFixed(1)} km/h`
                : cityLoading ? '—' : 'N/A'}
            </span>
            <span className="tile-sub">10m Operational Vector</span>
          </div>

          {/* Pressure (MSLP) */}
          <div className="hero-metric-tile">
            <span className="tile-label">Pressure (MSLP)</span>
            <span className="tile-value font-mono">
              {cityForecast?.pressure != null
                ? `${Number(cityForecast.pressure).toFixed(1)} hPa`
                : cityLoading ? '—' : 'N/A'}
            </span>
            <span className="tile-sub">Mean Sea Level Pressure</span>
          </div>

          {/* CAPE / Instability */}
          <div className="hero-metric-tile">
            <span className="tile-label">CAPE / Instability</span>
            <span className="tile-value">
              {cityForecast?.cape_j_kg != null
                ? `${Number(cityForecast.cape_j_kg).toFixed(0)} J/kg`
                : cityLoading ? '—' : 'N/A'}
            </span>
            <span className="tile-sub">Convective Available Energy</span>
          </div>

          {/* Ensemble Spread */}
          <div className="hero-metric-tile">
            <span className="tile-label">Ensemble Spread</span>
            <span className="tile-value font-mono">
              {cityForecast?.ensemble_spread != null
                ? `${Number(cityForecast.ensemble_spread).toFixed(2)} σ`
                : cityLoading ? '—' : 'N/A'}
            </span>
            <span className="tile-sub">31-Member GEFS Dispersion</span>
          </div>

          {/* Bust Probability — highlighted */}
          <div className="hero-metric-tile bust-tile">
            <span className="tile-label">Bust Probability</span>
            <span className="tile-value text-bust">
              {currentBustProb != null
                ? `${Number(currentBustProb).toFixed(1)}%`
                : cityLoading ? '—' : 'N/A'}
            </span>
            <span className={`risk-status-pill ${riskBadge.cls}`}>
              {riskBadge.label}
            </span>
          </div>

          {/* Model Confidence */}
          <div className="hero-metric-tile">
            <span className="tile-label">Model Confidence</span>
            <span className="tile-value text-conf">
              {cityForecast?.confidence != null
                ? `${Number(cityForecast.confidence).toFixed(1)}%`
                : cityLoading ? '—' : 'N/A'}
            </span>
            <span className="tile-sub">{cityForecast?.confidence_level || 'Calibrated RF Score'}</span>
          </div>

          {/* Risk Level */}
          <div className="hero-metric-tile">
            <span className="tile-label">Risk Level</span>
            <span className="tile-value" style={{ textTransform: 'capitalize' }}>
              {cityForecast?.risk_level || (cityLoading ? '—' : riskBadge.label)}
            </span>
            <span className="tile-sub">Reliability Classification</span>
          </div>
        </div>
      )}

      {/* ── AI Bust Detection & Explainability ── */}
      {!cityForecastError && (cityForecast?.dominant_factor || contributingFactors.length > 0) && (
        <div className="city-explainability-section">
          <div className="explain-header-row">
            <span className="explain-title">🤖 AI Forecast Bust Detection</span>
            {cityForecast?.dominant_factor && (
              <span className="explain-primary-tag">
                Primary Sensitivity: <strong>{cityForecast.dominant_factor}</strong>
              </span>
            )}
          </div>

          {/* AI Summary */}
          {aiSummary && (
            <p className="city-ai-summary">{aiSummary}</p>
          )}

          {/* Contributing Factors */}
          {contributingFactors.length > 0 && (
            <div className="city-factors-list">
              {contributingFactors.map((f, i) => {
                const isPositive = f.risk_contribution === 'Elevates Bust Risk';
                return (
                  <div key={f.feature_id || i} className={`city-factor-row ${isPositive ? 'factor-risk' : 'factor-stable'}`}>
                    <div className="factor-top-row">
                      <span className="factor-name">{f.feature_name}</span>
                      <span className={`factor-contribution-tag ${isPositive ? 'tag-risk' : 'tag-stable'}`}>
                        {isPositive ? '▲' : '▼'} {f.risk_contribution}
                      </span>
                    </div>
                    <div className="factor-detail-row">
                      <span className="factor-value-chip">
                        Observed: <strong>{typeof f.observed_value === 'number' ? f.observed_value.toFixed(2) : f.observed_value}</strong>
                      </span>
                      <span className="factor-impact-chip">
                        Impact: <strong>{f.impact_pct > 0 ? '+' : ''}{f.impact_pct?.toFixed(1)}%</strong>
                      </span>
                      <span className="factor-importance-chip">
                        Feature Weight: <strong>{(f.importance * 100).toFixed(1)}%</strong>
                      </span>
                    </div>
                    {f.explanation && (
                      <p className="factor-explanation">{f.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
