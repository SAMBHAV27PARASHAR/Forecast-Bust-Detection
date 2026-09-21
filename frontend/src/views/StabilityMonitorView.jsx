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

      {/* Operational Protocol & Threshold Guide — Only shown when comparison data exists */}
      {stabilityData?.has_previous_run && (
        <>
          <div className="stability-guide-card">
            <h3>Operational Stability Protocols & Decision Rules</h3>
            <div className="protocol-grid">
              <div className="protocol-item border-stable">
                <span className="protocol-badge badge-stable">STABLE</span>
                <h4>|Δ Bust Probability| &lt; 10%</h4>
                <p>Consecutive runs show consistent ensemble clustering and trajectory agreement. High operational confidence for forecasters.</p>
              </div>
              <div className="protocol-item border-moderate">
                <span className="protocol-badge badge-moderate">MODERATE FLIP-FLOP</span>
                <h4>10% ≤ |Δ Bust Probability| &lt; 25%</h4>
                <p>Model is adjusting synoptic timing or precipitation intensity. Forecasters should cross-reference multi-model ensembles.</p>
              </div>
              <div className="protocol-item border-severe">
                <span className="protocol-badge badge-severe">SEVERE JUMP / FLIP-FLOP</span>
                <h4>|Δ Bust Probability| ≥ 25%</h4>
                <p>Sudden regime change or bifurcation detected in consecutive cycles. High probability of model forecast bust. Alert issued.</p>
              </div>
            </div>
          </div>

          {/* Next Step Banner */}
          <div className="next-steps-banner">
            <div>
              <h4>Curious what caused the difference between these two runs?</h4>
              <p>Inspect the "What Changed?" panel for physical feature attribution and atmospheric parameter deltas.</p>
            </div>
            <button className="btn-primary" onClick={() => onNavigateView('what_changed')}>
              Inspect "What Changed?" 🔄
            </button>
          </div>
        </>
      )}
    </div>
  );
}
