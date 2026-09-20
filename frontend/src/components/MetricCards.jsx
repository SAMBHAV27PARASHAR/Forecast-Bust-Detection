import React from 'react';

export default function MetricCards({
  riskMapData,
  selectedRegionDetail,
  selectedDay
}) {
  const nationalMeanConf = riskMapData?.national_mean_confidence ?? 78.5;
  const nationalMeanBust = riskMapData?.national_mean_bust_prob ?? 21.5;
  const alertedCount = (riskMapData?.low_confidence_count ?? 0) + (riskMapData?.severe_risk_count ?? 0);
  const totalCount = riskMapData?.total_regions ?? 14;

  const regPred = selectedRegionDetail?.prediction;
  const selectedBustProb = regPred?.bust_probability ?? 15.0;
  const selectedConfScore = regPred?.confidence_score ?? 85.0;
  const selectedRiskLevel = regPred?.risk_level ?? 'Low';
  const selectedFactor = regPred?.dominant_factor ?? 'Atmospheric Balance';

  const getRiskBadgeClass = (risk) => {
    switch (risk?.toLowerCase()) {
      case 'severe': return 'badge-severe';
      case 'high': return 'badge-high';
      case 'moderate': return 'badge-moderate';
      default: return 'badge-low';
    }
  };

  return (
    <div className="metric-cards-grid">
      {/* Metric 1: National Confidence Average */}
      <div className="metric-card">
        <div className="card-top">
          <span className="card-label">National Mean Confidence</span>
          <span className="card-icon-wrapper blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </span>
        </div>
        <div className="card-value-row">
          <span className="card-main-val">{nationalMeanConf}%</span>
          <span className="card-sub-val">Day {selectedDay} Horizon</span>
        </div>
        <div className="metric-bar-bg">
          <div
            className="metric-bar-fill conf-gradient"
            style={{ width: `${Math.min(100, Math.max(5, nationalMeanConf))}%` }}
          ></div>
        </div>
        <div className="card-footer-info">
          <span>National Mean Bust Risk: <strong>{nationalMeanBust}%</strong></span>
        </div>
      </div>

      {/* Metric 2: Error-Prone / Vulnerable Subdivisions */}
      <div className="metric-card">
        <div className="card-top">
          <span className="card-label">Error-Prone Subdivisions</span>
          <span className="card-icon-wrapper red">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
        </div>
        <div className="card-value-row">
          <span className="card-main-val text-red">{alertedCount}</span>
          <span className="card-sub-val">of {totalCount} Zones Alerted</span>
        </div>
        <div className="metric-bar-bg">
          <div
            className="metric-bar-fill alert-gradient"
            style={{ width: `${Math.min(100, (alertedCount / totalCount) * 100)}%` }}
          ></div>
        </div>
        <div className="card-footer-info">
          <span>{riskMapData?.severe_risk_count ?? 0} zones in Critical Bust status</span>
        </div>
      </div>

      {/* Metric 3: Selected Region Bust Probability */}
      <div className="metric-card">
        <div className="card-top">
          <span className="card-label">Selected Zone Bust Risk</span>
          <span className={`risk-pill ${getRiskBadgeClass(selectedRiskLevel)}`}>
            {selectedRiskLevel} Risk
          </span>
        </div>
        <div className="card-value-row">
          <span className={`card-main-val ${selectedBustProb >= 50 ? 'text-red' : 'text-slate'}`}>
            {selectedBustProb}%
          </span>
          <span className="card-sub-val">Confidence: {selectedConfScore}%</span>
        </div>
        <div className="metric-bar-bg">
          <div
            className="metric-bar-fill risk-fill"
            style={{
              width: `${Math.min(100, Math.max(5, selectedBustProb))}%`,
              backgroundColor: selectedBustProb >= 75 ? '#dc2626' : selectedBustProb >= 50 ? '#ef4444' : selectedBustProb >= 25 ? '#f59e0b' : '#10b981'
            }}
          ></div>
        </div>
        <div className="card-footer-info">
          <span className="truncate-text">Zone: <strong>{selectedRegionDetail?.region?.name || 'All India'}</strong></span>
        </div>
      </div>

      {/* Metric 4: Dominant Atmospheric Driver */}
      <div className="metric-card">
        <div className="card-top">
          <span className="card-label">Primary Bust Sensitivity</span>
          <span className="card-icon-wrapper amber">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
          </span>
        </div>
        <div className="card-value-row">
          <span className="card-main-val-sm">{selectedFactor}</span>
        </div>
        <div className="status-quote-box">
          <span>{regPred?.summary || 'Atmospheric stability within nominal deterministic NWP bounds.'}</span>
        </div>
      </div>
    </div>
  );
}
