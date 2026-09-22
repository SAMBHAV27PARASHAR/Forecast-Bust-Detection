import React from 'react';
import ForecastStabilityMonitor from '../components/ForecastStabilityMonitor';

export default function StabilityMonitorView({
  stabilityData,
  stabilityLoading,
  selectedRegionDetail,
  selectedRegionId,
  setSelectedRegionId,
  regions,
  selectedDay,
  setSelectedDay,
  onNavigateView
}) {
  const regionName = selectedRegionDetail?.region?.name || 'Selected Subdivision';

  return (
    <div className="view-container stability-view">
      <div className="view-header-card">
        <div className="header-left-block">
          <h2 className="view-title">📈 Operational Forecast Stability Monitor</h2>
          <p className="view-desc">
            SIH 26079 Core Intelligence: Compares consecutive numerical weather prediction initialization cycles for the same valid forecast target. Detects rapid forecast drift and ensemble flip-flops.
          </p>
        </div>
      </div>

      {/* Region & Day Selector */}
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

      {/* Stability Monitor Core Component */}
      <div className="stability-monitor-expanded">
        <ForecastStabilityMonitor
          stabilityData={stabilityData}
          loading={stabilityLoading}
          regionName={regionName}
          selectedDay={selectedDay}
        />
      </div>

    </div>
  );
}
