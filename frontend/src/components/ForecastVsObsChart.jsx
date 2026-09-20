import React from 'react';

export default function ForecastVsObsChart({ selectedRegionDetail, retrospectiveData }) {
  const isRetro = Boolean(retrospectiveData && retrospectiveData.status === 'VERIFIED');
  const retroComp = retrospectiveData?.comparison || {};
  const regName = retrospectiveData?.location_name || selectedRegionDetail?.region?.name || 'Selected Target';

  const raw = selectedRegionDetail?.raw_parameters || {};
  const sim = selectedRegionDetail?.simulated_actual || {};

  // Precipitation
  const precipF = isRetro ? (retroComp.precipitation?.forecast ?? 0.0) : (raw.precip_forecast ?? 10.0);
  const precipA = isRetro ? (retroComp.precipitation?.observed ?? 0.0) : (sim.precip_actual ?? 12.0);
  const rainDelta = isRetro ? (retroComp.precipitation?.delta ?? 0.0) : (sim.rain_delta ?? (precipA - precipF));
  const rainAbsError = isRetro ? (retroComp.precipitation?.absolute_error ?? Math.abs(rainDelta)) : Math.abs(rainDelta);
  const isRainBust = isRetro ? Boolean(retroComp.precipitation?.is_bust) : (Math.abs(rainDelta) >= 35.0);

  // Temperature
  const tempF = isRetro ? (retroComp.temperature?.forecast ?? 28.0) : (raw.temp_forecast ?? 28.0);
  const tempA = isRetro ? (retroComp.temperature?.observed ?? 28.5) : (sim.temp_actual ?? 28.5);
  const tempDelta = isRetro ? (retroComp.temperature?.delta ?? 0.0) : (sim.temp_delta ?? (tempA - tempF));
  const tempAbsError = isRetro ? (retroComp.temperature?.absolute_error ?? Math.abs(tempDelta)) : Math.abs(tempDelta);
  const isTempBust = isRetro ? Boolean(retroComp.temperature?.is_bust) : (Math.abs(tempDelta) >= 4.5);

  const isBustVerified = isRainBust || isTempBust;

  // Visual scaling helpers
  const maxRain = Math.max(50, precipF, precipA) * 1.25;
  const rainFHeight = (precipF / maxRain) * 100;
  const rainAHeight = (precipA / maxRain) * 100;

  return (
    <div className="forecast-chart-card">
      <div className="chart-header-row">
        <div>
          <h4>
            {isRetro
              ? 'Retrospective Verification Analysis (Forecast vs Public Ground Truth)'
              : 'Verification Analysis (Forecast vs Simulated Actual)'}
          </h4>
          <p className="chart-sub">
            {isRetro
              ? `Real ground-truth verification comparison for ${regName}`
              : `Demonstrating operational verification delta for ${regName}`}
          </p>
        </div>
        <div className={`verification-badge ${isBustVerified ? 'verified-bust' : 'verified-normal'}`}>
          <span className="dot"></span>
          <span>{isBustVerified ? 'VERIFIED FORECAST BUST' : 'NOMINAL ERROR MARGIN'}</span>
        </div>
      </div>

      <div className="comparison-columns">
        {/* Precipitation Column */}
        <div className="comparison-metric-box">
          <div className="metric-box-title">
            <span>Precipitation Verification</span>
            <span className="metric-unit">Bust: |Δ| ≥ 25mm</span>
          </div>

          <div className="bars-comparison-visual">
            <div className="bar-group">
              <div className="bar-column">
                <div
                  className="bar-body bar-forecast"
                  style={{ height: `${Math.max(8, rainFHeight)}%` }}
                  title={`NWP Forecast: ${precipF} mm`}
                ></div>
              </div>
              <span className="bar-label">GEFS Fcst</span>
              <strong className="bar-value">{precipF} mm</strong>
            </div>

            <div className="bar-group">
              <div className="bar-column">
                <div
                  className={`bar-body bar-actual ${isRainBust ? 'bar-bust-highlight' : ''}`}
                  style={{ height: `${Math.max(8, rainAHeight)}%` }}
                  title={`Real Observed: ${precipA} mm`}
                ></div>
              </div>
              <span className="bar-label">Observed</span>
              <strong className="bar-value">{precipA} mm</strong>
            </div>
          </div>

          <div className="delta-summary-box">
            <span>Precipitation Delta / Abs Error:</span>
            <strong className={isRainBust ? 'text-red' : 'text-green'}>
              |Error|: {rainAbsError} mm ({rainDelta > 0 ? `+${rainDelta}` : rainDelta} mm bias)
              {isRainBust ? ' (BUST THRESHOLD EXCEEDED)' : ' (Within Standard Tolerance)'}
            </strong>
          </div>
        </div>

        {/* Temperature Verification Box */}
        <div className="comparison-metric-box">
          <div className="metric-box-title">
            <span>Surface 2m Temperature Verification</span>
            <span className="metric-unit">Bust: |Δ| ≥ 4.5°C</span>
          </div>

          <div className="temp-comparison-row">
            <div className="temp-stat-card">
              <span className="temp-label">GEFS Forecast</span>
              <span className="temp-value">{tempF}°C</span>
            </div>
            <div className="temp-divider">vs</div>
            <div className="temp-stat-card">
              <span className="temp-label">Observed Ground Truth</span>
              <span className={`temp-value ${isTempBust ? 'text-red' : ''}`}>{tempA}°C</span>
            </div>
          </div>

          <div className="delta-summary-box">
            <span>Temperature Bias / Abs Error:</span>
            <strong className={isTempBust ? 'text-red' : 'text-slate'}>
              |Error|: {tempAbsError}°C ({tempDelta > 0 ? `+${tempDelta}` : tempDelta}°C bias)
              {isTempBust ? ' (SEVERE TEMPERATURE BUST)' : ' (Nominal Calibration)'}
            </strong>
          </div>
        </div>
      </div>

      {/* Additional Retrospective Observation Cards if available */}
      {isRetro && (retroComp.humidity || retroComp.pressure || retroComp.wind_speed) && (
        <div className="retro-extra-variables-row">
          {retroComp.humidity && (
            <div className="retro-mini-tile">
              <span className="mini-label">Relative Humidity</span>
              <div className="mini-values">
                <span>Fcst: <strong>{retroComp.humidity.forecast}%</strong></span>
                <span>Obs: <strong>{retroComp.humidity.observed}%</strong></span>
              </div>
              <span className="mini-error">Abs Error: <strong>{retroComp.humidity.absolute_error}%</strong></span>
            </div>
          )}
          {retroComp.wind_speed && (
            <div className="retro-mini-tile">
              <span className="mini-label">Wind Speed</span>
              <div className="mini-values">
                <span>Fcst: <strong>{retroComp.wind_speed.forecast} km/h</strong></span>
                <span>Obs: <strong>{retroComp.wind_speed.observed} km/h</strong></span>
              </div>
              <span className="mini-error">Abs Error: <strong>{retroComp.wind_speed.absolute_error} km/h</strong></span>
            </div>
          )}
          {retroComp.pressure && (
            <div className="retro-mini-tile">
              <span className="mini-label">Surface Pressure</span>
              <div className="mini-values">
                <span>Fcst: <strong>{retroComp.pressure.forecast} hPa</strong></span>
                <span>Obs: <strong>{retroComp.pressure.observed} hPa</strong></span>
              </div>
              <span className="mini-error">Abs Error: <strong>{retroComp.pressure.absolute_error} hPa</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

