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
            <span className={`card-badge ${isInsufficient ? 'badge-status-insufficient' : direction === 'increased' ? 'badge-status-unstable' : 'badge-status-stable'}`}>
              {isInsufficient ? 'INSUFFICIENT_DATA' : direction === 'increased' ? 'Risk Increased' : direction === 'decreased' ? 'Risk Decreased' : 'Unchanged'}
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
        /* INSUFFICIENT DATA FALLBACK */
        <div className="stability-insufficient-box what-changed-insufficient">
          <div className="insufficient-header">
            <span className="insufficient-icon">ℹ️</span>
            <div className="insufficient-text-wrap">
              <h4>INSUFFICIENT_DATA</h4>
              <p>{whatChangedData?.message || 'A valid preceding forecast initialization run is unavailable for this region and horizon. Operating on a single reference cycle.'}</p>
            </div>
          </div>
          <div className="insufficient-footer-note">
            <em>No synthetic or assumed values are substituted. Run-to-run attribution strictly requires multi-cycle NWP archive data.</em>
          </div>
        </div>
      )}
    </div>
  );
}
