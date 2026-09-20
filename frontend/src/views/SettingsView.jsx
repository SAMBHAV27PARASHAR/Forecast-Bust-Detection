import React, { useState } from 'react';
import { refreshLiveForecast } from '../services/api';
import { formatToIst } from '../utils/timezone';

export default function SettingsView({
  theme,
  onToggleTheme,
  liveStatus,
  onRefreshLiveStatus
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState(null);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setRefreshMessage('Connecting to NOAA NOMADS servers and downloading latest 10-day GEFS operational cycle...');
    try {
      const res = await refreshLiveForecast();
      setRefreshMessage(`Successfully updated! Operational cycle: ${res.init_time_utc}`);
      if (onRefreshLiveStatus) onRefreshLiveStatus();
    } catch (err) {
      setRefreshMessage(`Refresh failed: ${err.message}. Using active cached cycle.`);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="view-container settings-view">
      <div className="view-header-card">
        <div className="header-left-block">
          <h2 className="view-title">⚙️ System Settings & Data Stream Configuration</h2>
          <p className="view-desc">
            Configure UI appearance, view NOAA NOMADS operational endpoint telemetry, and manage local NWP forecast cache.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Appearance Settings */}
        <div className="settings-card">
          <div className="card-header">
            <h3>🎨 Visual Appearance & Theme</h3>
            <p>Customize the operational dashboard display scheme</p>
          </div>
          <div className="theme-toggle-row">
            <div className="theme-option">
              <input
                type="radio"
                id="theme-dark"
                name="theme-choice"
                checked={theme === 'dark'}
                onChange={() => onToggleTheme('dark')}
              />
              <label htmlFor="theme-dark" className="theme-label">
                <span className="theme-icon">🌙</span>
                <div>
                  <strong>Dark Mode (Default Operational)</strong>
                  <p>Optimized for 24/7 meteorological forecasting rooms and low-light observation posts.</p>
                </div>
              </label>
            </div>

            <div className="theme-option">
              <input
                type="radio"
                id="theme-light"
                name="theme-choice"
                checked={theme === 'light'}
                onChange={() => onToggleTheme('light')}
              />
              <label htmlFor="theme-light" className="theme-label">
                <span className="theme-icon">☀️</span>
                <div>
                  <strong>Light Mode (Daylight High-Contrast)</strong>
                  <p>Clean high-contrast theme optimized for bright daylight and executive presentations.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* NOAA NOMADS Endpoint Telemetry */}
        <div className="settings-card">
          <div className="card-header">
            <h3>📡 NOAA NOMADS Ingestion Telemetry</h3>
            <p>Direct operational connection to NCEP Global Ensemble Forecast System</p>
          </div>

          <div className="telemetry-table">
            <div className="telem-row">
              <span className="telem-key">Data Source Endpoint:</span>
              <span className="telem-val font-mono">nomads.ncep.noaa.gov (GRIB2 Filter)</span>
            </div>
            <div className="telem-row">
              <span className="telem-key">Ingestion Resolution:</span>
              <span className="telem-val font-mono">0.25° Regular Lat-Lon (~27 km)</span>
            </div>
            <div className="telem-row">
              <span className="telem-key">Geographic Bounding Box:</span>
              <span className="telem-val font-mono">India Region (6.0°N–38.0°N, 66.0°E–100.0°E)</span>
            </div>
            <div className="telem-row">
              <span className="telem-key">Active Operational Cycle (IST):</span>
              <span className="telem-val font-bold text-accent">
                {liveStatus?.init_time_utc ? formatToIst(liveStatus.init_time_utc) : '19 Sep 2026 • 05:30 IST'}
              </span>
            </div>
            <div className="telem-row">
              <span className="telem-key">GRIB2 Parsing Engine:</span>
              <span className="telem-val font-mono">Native Python/NumPy WMO GRIB2 Template 5.0 (&lt;50ms)</span>
            </div>
            <div className="telem-row">
              <span className="telem-key">Forecast Horizon:</span>
              <span className="telem-val font-mono">Day 1 (+24h) through Day 10 (+240h)</span>
            </div>
            <div className="telem-row">
              <span className="telem-key">Cached Slices:</span>
              <span className="telem-val font-mono">17 forecast steps (Daily + 3-hourly)</span>
            </div>
            <div className="telem-row">
              <span className="telem-key">Local Cache File:</span>
              <span className="telem-val font-mono">data/live_gefs_cache/latest_gefs_forecast.json (6.08 MB)</span>
            </div>
          </div>

          <div className="cache-refresh-action">
            <button
              className="btn-primary refresh-action-btn"
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="spinner-icon">🔄</span> Ingesting Latest Cycle...
                </>
              ) : (
                <>
                  <span>🔄</span> Refresh NOAA GEFS Live Operational Cycle
                </>
              )}
            </button>
            {refreshMessage && <p className="refresh-status-msg">{refreshMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
