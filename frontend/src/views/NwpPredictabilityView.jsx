import React from 'react';
import LeadTimeDegradationChart from '../components/LeadTimeDegradationChart';

export default function NwpPredictabilityView({
  curveData,
  selectedDay,
  setSelectedDay,
  selectedRegionDetail,
  selectedRegionId,
  setSelectedRegionId,
  regions,
  onNavigateView
}) {
  const regionName = selectedRegionDetail?.region?.name || 'Selected Subdivision';

  return (
    <div className="view-container nwp-predictability-view">
      <div className="view-header-card">
        <div className="header-left-block">
          <h2 className="view-title">📉 NWP Medium-Range Predictability Degradation Horizon</h2>
          <p className="view-desc">
            Lead-time decay of numerical weather prediction skill from Day 1 (+24h) to Day 10 (+240h). Tracks non-linear error growth, Lyapunov predictability horizon limits, and ensemble variance.
          </p>
        </div>
      </div>

      {/* Region Selector */}
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
      </div>

      {/* Degradation Horizon Chart */}
      <div className="predictability-chart-wrapper">
        <LeadTimeDegradationChart
          curveData={curveData}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          regionName={regionName}
        />
      </div>

      {/* Theoretical Horizon Insights */}
      <div className="horizon-insights-grid">
        <div className="insight-card">
          <span className="insight-lead">Days 1–3 (+24h to +72h)</span>
          <h4>Deterministic Synoptic Skill</h4>
          <p>
            Atmospheric initial conditions dominate. GEFS ensemble spread remains tight (&lt; 5mm). Bust risk is generally low unless abrupt mesoscale convective initiation occurs.
          </p>
        </div>

        <div className="insight-card">
          <span className="insight-lead">Days 4–6 (+96h to +144h)</span>
          <h4>Baroclinic Instability Growth</h4>
          <p>
            Non-linear perturbation growth begins to dominate. Ensemble trajectories disperse. Forecast bust likelihood rises rapidly if monsoon low-pressure tracks diverge.
          </p>
        </div>

        <div className="insight-card">
          <span className="insight-lead">Days 7–10 (+168h to +240h)</span>
          <h4>Climatological Horizon Limit</h4>
          <p>
            Individual deterministic ensemble members lose phase correlation. Probabilistic ensemble guidance remains valuable, but single-point precipitation amounts suffer high bust rates.
          </p>
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
