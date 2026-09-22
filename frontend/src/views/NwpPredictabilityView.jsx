import React, { useState, useEffect } from 'react';
import LeadTimeDegradationChart from '../components/LeadTimeDegradationChart';
import { fetchLeadTimeCurve } from '../services/api';

export default function NwpPredictabilityView({
  curveData: propCurveData,
  selectedDay,
  setSelectedDay,
  selectedRegionDetail,
  selectedRegionId,
  setSelectedRegionId,
  regions = [],
  onNavigateView
}) {
  const [activeCurve, setActiveCurve] = useState(propCurveData);
  const [curveLoading, setCurveLoading] = useState(false);

  // Automatically fetch fresh curve whenever selectedRegionId changes
  useEffect(() => {
    if (!selectedRegionId) return;
    let isMounted = true;
    async function loadCurve() {
      setCurveLoading(true);
      try {
        const freshCurve = await fetchLeadTimeCurve(selectedRegionId, 'live_gefs');
        if (isMounted && freshCurve && freshCurve.curve) {
          setActiveCurve(freshCurve);
        }
      } catch (err) {
        console.warn('Could not fetch lead time curve for region:', selectedRegionId, err);
      } finally {
        if (isMounted) setCurveLoading(false);
      }
    }
    loadCurve();
    return () => { isMounted = false; };
  }, [selectedRegionId]);

  const handleRegionChange = (newRegionId) => {
    if (setSelectedRegionId) setSelectedRegionId(newRegionId);
  };

  const selectedRegion = regions.find(r => (r.id || r.region_id) === selectedRegionId);
  const regionName = selectedRegion?.name || selectedRegionDetail?.region?.name || 'Selected Subdivision';

  // Compute dynamic metrics from actual active curve points
  const points = activeCurve?.curve || [];
  const p1_3 = points.filter(p => p.day >= 1 && p.day <= 3);
  const p4_6 = points.filter(p => p.day >= 4 && p.day <= 6);
  const p7_10 = points.filter(p => p.day >= 7 && p.day <= 10);

  const calcMean = (pts, key) => pts.length ? Math.round(pts.reduce((s, p) => s + (p[key] || 0), 0) / pts.length) : null;

  const shortConf = calcMean(p1_3, 'confidence_score');
  const shortBust = calcMean(p1_3, 'bust_probability');
  const medConf = calcMean(p4_6, 'confidence_score');
  const medBust = calcMean(p4_6, 'bust_probability');
  const extConf = calcMean(p7_10, 'confidence_score');
  const extBust = calcMean(p7_10, 'bust_probability');

  return (
    <div className="view-container nwp-predictability-view">
      <div className="view-header-card">
        <div className="header-left-block">
          <h2 className="view-title">📉 NWP Medium-Range Predictability Degradation Horizon</h2>
          <p className="view-desc">
            Lead-time decay of numerical weather prediction skill from Day 1 (+24h) to Day 10 (+240h). Tracks non-linear error growth, Lyapunov predictability horizon limits, and ensemble variance for each meteorological subdivision.
          </p>
        </div>
      </div>

      {/* Region Selector */}
      <div className="selection-bar-card">
        <div className="selection-field">
          <label>Target Meteorological Subdivision:</label>
          <select
            value={selectedRegionId}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="styled-select"
          >
            {regions.map(r => (
              <option key={r.id || r.region_id} value={r.id || r.region_id}>
                {r.name} ({r.id || r.region_id})
              </option>
            ))}
          </select>
        </div>
        {curveLoading && (
          <span className="loc-loading-pill">
            <span className="dot pulse"></span> Updating subdivision curve...
          </span>
        )}
      </div>

      {/* Degradation Horizon Chart */}
      <div className="predictability-chart-wrapper">
        <LeadTimeDegradationChart
          curveData={activeCurve}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          regionName={regionName}
        />
      </div>

      {/* Structured Horizon Insights: Days 1-3, 4-6, 7-10 */}
      <div className="horizon-insights-grid">
        <div className="insight-card card-horizon-short">
          <div className="insight-header">
            <span className="insight-badge badge-short">Days 1–3</span>
            <span className="insight-range font-mono">+24h to +72h Lead</span>
          </div>
          <h4>Deterministic Synoptic Skill</h4>
          <p>
            Atmospheric initial conditions dominate. GEFS ensemble clustering is tight (&lt; 0.8σ spread). Numerical models exhibit high deterministic precision, and bust risk is low unless unpredicted mesoscale convective initiation occurs.
          </p>
          <div className="insight-metric-tag">
            Typical Skill: <strong>{shortConf !== null ? `${shortConf}% Confidence (${shortBust}% Bust Risk)` : 'Calculating...'}</strong>
          </div>
        </div>

        <div className="insight-card card-horizon-medium">
          <div className="insight-header">
            <span className="insight-badge badge-medium">Days 4–6</span>
            <span className="insight-range font-mono">+96h to +144h Lead</span>
          </div>
          <h4>Baroclinic Instability Growth</h4>
          <p>
            Non-linear perturbation growth and atmospheric bifurcation begin to dominate. Ensemble trajectories disperse. Forecast bust likelihood rises rapidly if monsoon low-pressure tracks or moisture convergence zones diverge.
          </p>
          <div className="insight-metric-tag">
            Ensemble Bifurcation Window: <strong>{medConf !== null ? `${medConf}% Confidence (${medBust}% Bust Risk)` : 'Calculating...'}</strong>
          </div>
        </div>

        <div className="insight-card card-horizon-extended">
          <div className="insight-header">
            <span className="insight-badge badge-extended">Days 7–10</span>
            <span className="insight-range font-mono">+168h to +240h Lead</span>
          </div>
          <h4>Climatological Horizon Limit</h4>
          <p>
            Deterministic ensemble members lose phase correlation. Probabilistic ensemble guidance remains useful for regional synoptic patterns, but single-point precipitation amounts suffer high bust rates (&gt;50%).
          </p>
          <div className="insight-metric-tag">
            Probabilistic Only: <strong>{extConf !== null ? `${extConf}% Confidence (${extBust}% Bust Risk)` : 'Calculating...'}</strong>
          </div>
        </div>
      </div>

      {/* Next Step Banner */}
      <div className="next-steps-banner">
        <div>
          <h4>Ready to verify model forecasts against ground observations?</h4>
          <p>Check the Forecast Verification module to compare forecasts with actual observations.</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigateView('verification')}>
          Go to Forecast Verification ✅
        </button>
      </div>
    </div>
  );
}

