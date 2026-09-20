import React from 'react';
import WhatIfSimulator from '../components/WhatIfSimulator';

export default function WhatIfSimulatorView() {
  return (
    <div className="view-container what-if-view">
      <div className="view-header-card">
        <div className="header-left-block">
          <h2 className="view-title">🎛️ What-If NWP Sensitivity & Atmospheric Perturbation Simulator</h2>
          <p className="view-desc">
            Directly manipulate meteorological parameters to test the non-linear response of the trained AI Bust Detection model. Observe how increasing convective available potential energy, vertical shear, or ensemble spread accelerates forecast bust probability.
          </p>
        </div>
      </div>

      <div className="simulator-wrapper">
        <WhatIfSimulator />
      </div>

      {/* Sensitivity Insights Guide */}
      <div className="simulator-guidance-card">
        <h3>Physical Sensitivity Mechanisms</h3>
        <div className="guidance-grid">
          <div className="guidance-item">
            <h4>CAPE & Convective Initiation</h4>
            <p>
              When CAPE exceeds 2,000 J/kg under high boundary layer moisture, NWP convective parameterization schemes frequently misjudge the exact spatial trigger of deep convective towers, leading to localized rainfall bust events.
            </p>
          </div>
          <div className="guidance-item">
            <h4>Vertical Wind Shear (0–6 km)</h4>
            <p>
              Shear values above 18 m/s organize convective cells into squall lines and mesoscale convective systems (MCSs). NWP grids often smooth out storm organization, underestimating peak precipitation rates.
            </p>
          </div>
          <div className="guidance-item">
            <h4>Ensemble Spread Divergence</h4>
            <p>
              High ensemble spread across GEFS perturbed members indicates strong sensitivity to initial conditions and rapid error growth in phase space, directly correlating with high forecast bust probability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
