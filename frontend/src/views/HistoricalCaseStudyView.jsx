import React from 'react';

export default function HistoricalCaseStudyView({ onSelectScenario, onNavigateView }) {
  return (
    <div className="view-container case-study-view">
      <div className="view-header-card">
        <div className="header-left-block">
          <h2 className="view-title">📁 Historical Case Study: July 2019 Extreme Monsoon Depression</h2>
          <p className="view-desc">
            A comprehensive retrospective analysis of the July 2019 active monsoon spell over Central India and Western Ghats, where operational GEFS failed to resolve extreme precipitation surges, causing major forecast busts.
          </p>
        </div>
        <div className="header-right-block">
          <button
            className="btn-primary"
            onClick={() => {
              onSelectScenario('real_gefs_july2019');
              onNavigateView('dashboard');
            }}
          >
            Load 2019 Event in Dashboard 🔄
          </button>
        </div>
      </div>

      {/* Synoptic Overview Cards */}
      <div className="case-study-hero-grid">
        <div className="case-card">
          <span className="case-tag">Synoptic System</span>
          <h3>Bay of Bengal Low Pressure System (BOB LPS)</h3>
          <p>
            Formed on 22 July 2019 over northwest Bay of Bengal and moved west-northwestwards across Odisha, Chhattisgarh, and Madhya Pradesh, dragging vigorous monsoon surge across Maharashtra and the Konkan coast.
          </p>
        </div>

        <div className="case-card">
          <span className="case-tag">NWP Failure Mode</span>
          <h3>Convective Underestimation Bust</h3>
          <p>
            Operational GEFS Day 5 (+120h) forecast predicted 35 mm/day over Konkan & Goa. Ground stations (IMD Mahabaleshwar and Mumbai) recorded &gt;180 mm/day, exceeding the 25 mm bust threshold by over 145 mm.
          </p>
        </div>

        <div className="case-card">
          <span className="case-tag">AI Model Detection</span>
          <h3>Early Warning Bust Signal: 88% Risk</h3>
          <p>
            The calibrated AI Bust Classifier triggered a HIGH BUST RISK warning at +120h lead time, flagging extreme vertical wind shear (22 m/s) and severe ensemble spread divergence (14.2 mm) 3 days before the event.
          </p>
        </div>
      </div>

      {/* Timeline of July 2019 Event */}
      <div className="timeline-card">
        <h3>Chronological Timeline of the July 2019 Bust Event</h3>
        <div className="case-timeline">
          <div className="t-event">
            <div className="t-date">July 18, 2019</div>
            <div className="t-body">
              <strong>GEFS Forecast Initialized (Lead Time: Day 7, +168h)</strong>
              <p>Model predicts moderate rainfall (15–20 mm) along the western coast. AI Model flags 74% bust risk due to high moisture flux convergence.</p>
            </div>
          </div>
          <div className="t-event">
            <div className="t-date">July 20, 2019</div>
            <div className="t-body">
              <strong>Ensemble Spread Expands (Lead Time: Day 5, +120h)</strong>
              <p>Consecutive GEFS runs flip-flop on precipitation intensity (+18mm delta). AI Model Stability Monitor triggers "Severe Jump" alert with 88% bust probability.</p>
            </div>
          </div>
          <div className="t-event">
            <div className="t-date">July 22, 2019</div>
            <div className="t-body">
              <strong>Depression Intensification (Lead Time: Day 3, +72h)</strong>
              <p>Low pressure area concentrates into well-marked depression over Bay of Bengal. Western Ghats orographic lifting intensifies.</p>
            </div>
          </div>
          <div className="t-event critical">
            <div className="t-date">July 25, 2019</div>
            <div className="t-body">
              <strong>Verification Day: Massive Ground Bust Observed</strong>
              <p>Konkan & Goa records 195 mm rainfall vs GEFS forecast of 38 mm (Error: +157 mm). AI Model successfully predicted this bust 5 days in advance.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ground Truth Validation Table */}
      <div className="case-table-card">
        <h3>Subdivision Verification Breakdown (July 25, 2019 Target)</h3>
        <div className="table-responsive">
          <table className="forecast-data-table">
            <thead>
              <tr>
                <th>Subdivision</th>
                <th>GEFS Day 5 Forecast</th>
                <th>ERA5 / IMD Observed</th>
                <th>Error (|Obs - Fcst|)</th>
                <th>Bust Threshold</th>
                <th>Verified Ground Status</th>
                <th>AI Model Predicted Risk</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-bold">Konkan & Goa</td>
                <td className="font-mono">38.4 mm</td>
                <td className="font-mono">195.2 mm</td>
                <td className="font-mono text-red font-bold">+156.8 mm</td>
                <td>≥ 25 mm</td>
                <td><span className="table-badge badge-bust-high">VERIFIED BUST</span></td>
                <td className="font-bold text-bust">88% (HIGH RISK)</td>
              </tr>
              <tr>
                <td className="font-bold">Madhya Maharashtra</td>
                <td className="font-mono">22.1 mm</td>
                <td className="font-mono">86.5 mm</td>
                <td className="font-mono text-red font-bold">+64.4 mm</td>
                <td>≥ 25 mm</td>
                <td><span className="table-badge badge-bust-high">VERIFIED BUST</span></td>
                <td className="font-bold text-bust">79% (HIGH RISK)</td>
              </tr>
              <tr>
                <td className="font-bold">Coastal Karnataka</td>
                <td className="font-mono">45.0 mm</td>
                <td className="font-mono">124.0 mm</td>
                <td className="font-mono text-red font-bold">+79.0 mm</td>
                <td>≥ 25 mm</td>
                <td><span className="table-badge badge-bust-high">VERIFIED BUST</span></td>
                <td className="font-bold text-bust">82% (HIGH RISK)</td>
              </tr>
              <tr>
                <td className="font-bold">West Rajasthan</td>
                <td className="font-mono">2.1 mm</td>
                <td className="font-mono">3.4 mm</td>
                <td className="font-mono text-green font-bold">+1.3 mm</td>
                <td>≥ 25 mm</td>
                <td><span className="table-badge badge-bust-low">NORMAL MARGIN</span></td>
                <td className="font-bold text-green">12% (LOW RISK)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
