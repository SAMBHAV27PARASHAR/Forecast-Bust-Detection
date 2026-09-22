import React from 'react';
import { formatToIst } from '../utils/timezone';

export default function WhatChangedCard({
  whatChangedData,
  loading,
  regionName,
  selectedDay
}) {
  if (loading) {
    return (
      <div className="analytics-card what-changed-card loading-card">
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="card-badge purple-badge">SIH 26079 Intelligence</span>
            <h3 className="card-title">What Changed?</h3>
          </div>
        </div>
        <div className="stability-loading-skeleton">
          <div className="skeleton-pulse-bar"></div>
          <span className="skeleton-text">Calculating run-to-run delta & feature shifts...</span>
        </div>
      </div>
    );
  }

  const isInsufficient = !whatChangedData?.has_previous_run || whatChangedData?.status === 'INSUFFICIENT_DATA';
  const prevProb = whatChangedData?.previous_bust_probability;
  const currProb = whatChangedData?.current_bust_probability;
  const deltaPp = whatChangedData?.percentage_point_change;
  const direction = whatChangedData?.direction;
  const prevInit = whatChangedData?.previous_init;
  const currInit = whatChangedData?.current_init;
  const summaryStatement = whatChangedData?.summary_statement;
  const shifts = whatChangedData?.top_feature_shifts || [];

  return (
    <div className="analytics-card what-changed-card">
      {/* Header */}
      <div className="card-header-row">
        <div className="card-title-group">
          <div className="title-tag-row">
            <span className="card-badge purple-badge">Run-to-Run Attribution</span>
            <span className={`card-badge ${isInsufficient ? 'badge-status-awaiting' : direction === 'increased' ? 'badge-status-unstable' : 'badge-status-stable'}`}>
              {isInsufficient ? 'Waiting for previous cycle' : direction === 'increased' ? 'Risk Increased' : direction === 'decreased' ? 'Risk Decreased' : 'Unchanged'}
            </span>
          </div>
          <h3 className="card-title">What Changed?</h3>
          <p className="card-subtext">
            Forecast delta and top meteorological feature shifts between consecutive NWP runs for {regionName || 'Selected Region'} (Day {selectedDay})
          </p>
        </div>
      </div>

      {/* Main Content */}
      {!isInsufficient ? (
        <div className="what-changed-content">
          {/* Headline Statement */}
          <div className={`headline-banner ${deltaPp > 0 ? 'banner-risk-up' : deltaPp < 0 ? 'banner-risk-down' : 'banner-risk-neutral'}`}>
            <span className="headline-icon">{deltaPp > 0 ? '⚠️' : deltaPp < 0 ? '📉' : '⚖️'}</span>
            <div className="headline-text-wrap">
              <strong className="headline-quote">{summaryStatement}</strong>
              <span className="headline-sub">
                Direction: <strong className="dir-highlight">{direction?.toUpperCase()}</strong> • Absolute Delta: <strong>{whatChangedData?.absolute_change} pp</strong>
              </span>
            </div>
          </div>

          {/* Cycle Comparison Info */}
          <div className="cycles-meta-strip">
            <div className="cycle-item">
              <span className="cycle-label">Previous Run (IST):</span>
              <span className="cycle-val">{formatToIst(prevInit)}</span>
              <span className="cycle-prob">Bust Risk: <strong>{prevProb}%</strong></span>
            </div>
            <div className="cycle-divider">➔</div>
            <div className="cycle-item">
              <span className="cycle-label">Current Run (IST):</span>
              <span className="cycle-val active-cycle">{formatToIst(currInit)}</span>
              <span className="cycle-prob active-prob">Bust Risk: <strong>{currProb}%</strong></span>
            </div>
          </div>

          {/* Top Meteorological Feature Shifts */}
          {shifts.length > 0 && (
            <div className="feature-shifts-section">
              <h4 className="shifts-title">Meteorological & Model Features with Highest Shift</h4>
              <div className="shifts-table-wrapper">
                <table className="shifts-table">
                  <thead>
                    <tr>
                      <th>Meteorological Parameter</th>
                      <th>Previous Run</th>
                      <th>Current Run</th>
                      <th>Observed Shift (Δ)</th>
                      <th>Direction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.slice(0, 5).map((s, idx) => (
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
        <div className="awaiting-cycle-box what-changed-awaiting-box">
          <div className="awaiting-header">
            <div className="awaiting-icon-badge purple-icon-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </div>
            <div className="awaiting-text-wrap">
              <h4 className="awaiting-title">Waiting for previous operational cycle</h4>
              <p className="awaiting-desc">
                Physical feature attribution decomposes atmospheric parameter deltas between consecutive model cycles using Tree SHAP gradient tracking.
              </p>
            </div>
          </div>

          <div className="awaiting-reference-card">
            <div className="reference-card-header">
              <span className="reference-tag purple-tag">Attribution Baseline State</span>
              <span className="reference-chip">{formatToIst(currInit || whatChangedData?.current_init || 'Current Operational Cycle')}</span>
            </div>
            <div className="reference-metrics-row">
              <div className="ref-metric-cell">
                <span className="ref-cell-label">Forecast Horizon</span>
                <span className="ref-cell-val">Day {selectedDay} (+{selectedDay * 24}h)</span>
              </div>
              <div className="ref-metric-cell">
                <span className="ref-cell-label">Target Region</span>
                <span className="ref-cell-val">{regionName || 'Selected Region'}</span>
              </div>
              <div className="ref-metric-cell">
                <span className="ref-cell-label">Baseline Bust Risk</span>
                <span className="ref-cell-val highlight-val-purple">
                  {currProb ?? whatChangedData?.current_bust_probability ?? 0}%
                </span>
              </div>
              <div className="ref-metric-cell">
                <span className="ref-cell-label">Attribution Engine</span>
                <span className="ref-cell-val">Tree SHAP (8-Feature Gradient)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
