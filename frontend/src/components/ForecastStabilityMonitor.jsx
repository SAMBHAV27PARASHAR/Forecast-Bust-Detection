import React from 'react';
import { formatToIst } from '../utils/timezone';

export default function ForecastStabilityMonitor({
  stabilityData,
  loading,
  regionName,
  selectedDay
}) {
  if (loading) {
    return (
      <div className="analytics-card stability-monitor-card loading-card">
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="card-badge blue-badge">SIH 26079 Core Intelligence</span>
            <h3 className="card-title">Forecast Stability Monitor</h3>
          </div>
        </div>
        <div className="stability-loading-skeleton">
          <div className="skeleton-pulse-bar"></div>
          <span className="skeleton-text">Analyzing consecutive NWP initialization cycles...</span>
        </div>
      </div>
    );
  }

  const hasPrev = stabilityData?.has_previous_run;
  const status = stabilityData?.stability_status || 'INSUFFICIENT_DATA';
  const prevRun = stabilityData?.previous_run;
  const currRun = stabilityData?.current_run;
  const deltaBust = stabilityData?.delta_bust_probability_pp ?? 0.0;
  const deltaConf = stabilityData?.delta_confidence_score_pp ?? 0.0;
  const shifts = stabilityData?.main_variables_responsible || [];

  const getStatusBadge = (st) => {
    switch (st) {
      case 'STABLE':
        return {
          label: 'STABLE (Consistent Guidance)',
          class: 'badge-status-stable',
          desc: 'Run-to-run guidance consistent (|Δ| ≤ 5.0 pp). Numerical model convergence is high.'
        };
      case 'MODERATE_VARIATION':
        return {
          label: 'MODERATE VARIATION',
          class: 'badge-status-moderate',
          desc: 'Moderate run-to-run drift in atmospheric parameters (5.0 pp < |Δ| ≤ 15.0 pp).'
        };
      case 'UNSTABLE_FLIP_FLOP':
        return {
          label: 'FLIP-FLOP ALERT',
          class: 'badge-status-unstable',
          desc: 'High run-to-run volatility in synoptic bust probability (|Δ| > 15.0 pp).'
        };
      default:
        return {
          label: 'INSUFFICIENT COMPARISON DATA',
          class: 'badge-status-insufficient',
          desc: stabilityData?.message || 'Comparable preceding initialization cycle is unavailable for this valid forecast time.'
        };
    }
  };

  const statusBadge = getStatusBadge(status);

  return (
    <div className="analytics-card stability-monitor-card">
      {/* Header */}
      <div className="card-header-row">
        <div className="card-title-group">
          <div className="title-tag-row">
            <span className="card-badge blue-badge">Run-to-Run NWP Drift Tracking</span>
            {hasPrev && (
              <span className={`card-badge ${statusBadge.class}`}>{statusBadge.label}</span>
            )}
            {!hasPrev && (
              <span className="card-badge badge-status-awaiting">Waiting for previous cycle</span>
            )}
          </div>
          <h3 className="card-title">Forecast Stability Monitor</h3>
          <p className="card-subtext">
            Run-to-run consistency tracking across consecutive NWP initialization cycles for {regionName || 'Selected Region'} (Day {selectedDay})
          </p>
        </div>
      </div>

      {/* Main Content */}
      {hasPrev && prevRun && currRun ? (
        <div className="stability-content">
          {/* Run Comparison Grid */}
          <div className="runs-comparison-grid">
            {/* Previous Run */}
            <div className="run-box previous-run">
              <div className="run-header">
                <span className="run-tag">Previous Forecast Run</span>
                <span className="run-init-chip">{formatToIst(prevRun.init_time_utc)}</span>
              </div>
              <div className="run-metric-row">
                <div className="metric-cell">
                  <span className="metric-cell-label">Bust Risk</span>
                  <span className="metric-cell-val prev-val">{prevRun.bust_probability}%</span>
                </div>
                <div className="metric-cell">
                  <span className="metric-cell-label">Confidence</span>
                  <span className="metric-cell-val">{prevRun.confidence_score}%</span>
                </div>
              </div>
              <div className="run-meta-row">
                <span>Lead: <strong>+{prevRun.lead_hours}h</strong> (Day {prevRun.lead_time_days})</span>
                <span>Valid (IST): {formatToIst(prevRun.valid_time_utc)}</span>
              </div>
            </div>

            {/* Run-to-Run Delta Center */}
            <div className="run-delta-center">
              <div className="delta-arrow-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
              <div className="delta-numbers">
                <span className="delta-label">Probability Shift</span>
                <span className={`delta-val ${deltaBust > 5 ? 'shift-up-bad' : deltaBust < -5 ? 'shift-down-good' : 'shift-neutral'}`}>
                  {deltaBust > 0 ? `+${deltaBust}` : deltaBust} pp
                </span>
                <span className="delta-sub">
                  Confidence: {deltaConf > 0 ? `+${deltaConf}` : deltaConf} pp
                </span>
              </div>
            </div>

            {/* Current Run */}
            <div className="run-box current-run">
              <div className="run-header">
                <span className="run-tag active-tag">Current Operational Run</span>
                <span className="run-init-chip active-chip">{formatToIst(currRun.init_time_utc)}</span>
              </div>
              <div className="run-metric-row">
                <div className="metric-cell">
                  <span className="metric-cell-label">Bust Risk</span>
                  <span className="metric-cell-val curr-val">{currRun.bust_probability}%</span>
                </div>
                <div className="metric-cell">
                  <span className="metric-cell-label">Confidence</span>
                  <span className="metric-cell-val">{currRun.confidence_score}%</span>
                </div>
              </div>
              <div className="run-meta-row">
                <span>Lead: <strong>+{currRun.lead_hours}h</strong> (Day {currRun.lead_time_days})</span>
                <span>Valid (IST): {formatToIst(currRun.valid_time_utc)}</span>
              </div>
            </div>
          </div>

          {/* Operational Methodology Callout */}
          <div className={`stability-callout-box ${statusBadge.class}`}>
            <span className="callout-icon">ℹ️</span>
            <div className="callout-body">
              <strong>Stability Status: {statusBadge.label}</strong>
              <p>{statusBadge.desc}</p>
            </div>
          </div>

          {/* Atmospheric Variables Shift Table */}
          {shifts.length > 0 && (
            <div className="feature-shifts-section">
              <h4 className="shifts-title">Changes in Available Meteorological Features</h4>
              <div className="shifts-table-wrapper">
                <table className="shifts-table">
                  <thead>
                    <tr>
                      <th>Meteorological Parameter</th>
                      <th>Previous Run</th>
                      <th>Current Run</th>
                      <th>Observed Shift (Δ)</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((s, idx) => (
                      <tr key={idx}>
                        <td className="param-name">{s.feature_name}</td>
                        <td className="param-val">{s.previous_value} {s.unit}</td>
                        <td className="param-val highlight-curr">{s.current_value} {s.unit}</td>
                        <td className={`param-delta ${s.direction === 'increased' ? 'delta-inc' : s.direction === 'decreased' ? 'delta-dec' : ''}`}>
                          {s.change > 0 ? `+${s.change}` : s.change} {s.unit}
                        </td>
                        <td>
                          <span className={`direction-badge dir-${s.direction}`}>
                            {s.direction === 'increased' ? '↑ Increased' : s.direction === 'decreased' ? '↓ Decreased' : '— Unchanged'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Compact Waiting for previous operational cycle State */
        <div className="awaiting-cycle-box stability-awaiting-box">
          <div className="awaiting-header">
            <div className="awaiting-icon-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="awaiting-text-wrap">
              <h4 className="awaiting-title">Waiting for previous operational cycle</h4>
              <p className="awaiting-desc">
                Run-to-run stability tracking monitors guidance consistency across consecutive NWP initialization cycles (00z, 06z, 12z, 18z) for the same valid forecast target.
              </p>
            </div>
          </div>

          {currRun && (
            <div className="awaiting-reference-card">
              <div className="reference-card-header">
                <span className="reference-tag">Current Operational Forecast</span>
                <span className="reference-chip">{formatToIst(currRun.init_time_utc)}</span>
              </div>
              <div className="reference-metrics-row">
                <div className="ref-metric-cell">
                  <span className="ref-cell-label">Forecast Horizon</span>
                  <span className="ref-cell-val">Day {currRun.lead_time_days ?? selectedDay} (+{currRun.lead_hours ?? (selectedDay * 24)}h)</span>
                </div>
                <div className="ref-metric-cell">
                  <span className="ref-cell-label">Valid Target (IST)</span>
                  <span className="ref-cell-val">{formatToIst(currRun.valid_time_utc)}</span>
                </div>
                <div className="ref-metric-cell">
                  <span className="ref-cell-label">Bust Risk</span>
                  <span className="ref-cell-val highlight-val">{currRun.bust_probability}%</span>
                </div>
                <div className="ref-metric-cell">
                  <span className="ref-cell-label">Confidence</span>
                  <span className="ref-cell-val">{currRun.confidence_score}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
