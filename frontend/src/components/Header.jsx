import React, { useState } from 'react';
import { formatToIst } from '../utils/timezone';

export default function Header({
  isOnline,
  isLiveMode,
  activeScenarioName,
  liveInitTime,
  onToggleSidebar,
  theme,
  onToggleTheme,
  onRefreshLive
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || !onRefreshLive) return;
    setIsRefreshing(true);
    try {
      await onRefreshLive();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        {/* Hamburger Menu Toggle Button (☰) */}
        <button
          className="hamburger-btn"
          onClick={onToggleSidebar}
          title="Toggle Navigation Menu (13 Views)"
          aria-label="Toggle navigation menu"
        >
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
        </button>

        <div className="logo-badge">
          <svg className="weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            <path d="M12 19v3" />
            <path d="m9 21 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="sih-tag">SIH 26079</span>
        </div>

        <div className="title-group">
          <h1>AI Forecast Bust Detection System</h1>
          <p className="subtitle">
            Operational Medium-Range Numerical Weather Prediction (NWP) Reliability Engine • Days 1–10
          </p>
        </div>
      </div>

      <div className="header-right">
        {/* Operational Mode Pill */}
        <div
          className={`mode-pill ${isLiveMode ? 'live-mode' : 'archive-mode'}`}
          title={isLiveMode ? 'Connected to NOAA NOMADS operational GEFS 10-day forecast' : 'Viewing historical validation archive'}
        >
          <span className={`pulse-indicator ${isLiveMode ? 'live-pulse' : ''}`}></span>
          <span className="mode-label">
            {isLiveMode ? 'LIVE OPERATIONAL GEFS' : (activeScenarioName || 'HISTORICAL ARCHIVE')}
          </span>
        </div>

        {/* Live Cycle Pill */}
        {isLiveMode && (
          <div className="cycle-pill" title="Operational Model Initialization Cycle (IST)">
            <span className="cycle-icon">🕒</span>
            <span className="cycle-time">{liveInitTime ? formatToIst(liveInitTime) : '19 Sep 2026 • 05:30 IST'}</span>
          </div>
        )}

        {/* Quick Refresh Button */}
        {isLiveMode && (
          <button
            className={`header-btn-refresh ${isRefreshing ? 'spinning' : ''}`}
            onClick={handleRefresh}
            title="Refresh latest GEFS forecast from NOAA NOMADS"
            disabled={isRefreshing}
          >
            <span className="refresh-icon">🔄</span>
            <span className="refresh-label">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        )}

        {/* Quick Dark/Light Theme Toggle */}
        <button
          className="header-theme-toggle"
          onClick={() => onToggleTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle visual theme"
        >
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>

        {/* Backend Connectivity Status */}
        <div
          className={`status-pill ${isOnline ? 'online' : 'offline'}`}
          title={isOnline ? 'FastAPI ML Backend Connected' : 'Connecting to Backend...'}
        >
          <span className="status-dot"></span>
          <span>{isOnline ? 'API & ML Ready' : 'Reconnecting...'}</span>
        </div>
      </div>
    </header>
  );
}
