import React from 'react';
import IndiaRiskMap from '../components/IndiaRiskMap';
import LeadTimeSlider from '../components/LeadTimeSlider';

export default function IndiaRiskMapView({
  regions,
  riskMapData,
  selectedRegionId,
  setSelectedRegionId,
  selectedDay,
  setSelectedDay,
  selectedHour,
  setSelectedHour,
  selectedDate,
  setSelectedDate,
  selectedRegionDetail,
  activeScenarioId,
  mapLoading,
  onNavigateView
}) {
  const selectedRegion = riskMapData?.regions?.find(r => (r.region_id || r.id) === selectedRegionId) || selectedRegionDetail?.region;

  return (
    <div className="view-container full-risk-map-view">
      <div className="view-header-card">
        <div className="header-left-block">
          <h2 className="view-title">🗺️ Interactive India NWP Bust Risk Map</h2>
          <p className="view-desc">
            Geospatial choropleth of calibrated Random Forest forecast bust probabilities across all 14 major IMD subdivisions. Click any subdivision to inspect local atmospheric features.
          </p>
        </div>
      </div>

      <LeadTimeSlider
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        selectedHour={selectedHour}
        onSelectHour={setSelectedHour}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        exactTimeMeta={riskMapData}
        activeScenarioId={activeScenarioId}
        isPredicting={mapLoading}
      />

      <div className="map-view-layout">
        {/* Large Interactive Map Canvas */}
        <div className="map-canvas-container">
          <IndiaRiskMap
            regionsData={regions}
            riskMapData={riskMapData}
            selectedRegionId={selectedRegionId}
            onSelectRegion={setSelectedRegionId}
            selectedDay={selectedDay}
            exactTimeMeta={riskMapData}
          />
        </div>

        {/* Selected Subdivision Details Sidebar */}
        <div className="map-details-sidebar">
          <div className="sidebar-card">
            <h3>Subdivision Inspection</h3>
            {selectedRegion ? (
              <div className="selected-subdiv-info">
                <div className="subdiv-name-badge">
                  <span className="subdiv-title">{selectedRegion.name}</span>
                  <span className="subdiv-id font-mono">{selectedRegion.region_id || selectedRegion.id}</span>
                </div>

                <div className="metric-row">
                  <span className="metric-label">Bust Risk Probability:</span>
                  <span className="metric-val font-bold text-bust">{selectedRegion.bust_probability}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Model Confidence:</span>
                  <span className="metric-val">{selectedRegion.confidence_score}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Forecast Rainfall:</span>
                  <span className="metric-val font-mono">{(selectedRegion.precip_mean ?? selectedRegion.forecast_rainfall ?? 0).toFixed(1)} mm</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Ensemble Spread (Std Dev):</span>
                  <span className="metric-val font-mono">{(selectedRegion.ensemble_spread ?? 0).toFixed(2)} mm</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">2m Temperature:</span>
                  <span className="metric-val font-mono">{(selectedRegion.temp_c ?? 28).toFixed(1)}°C</span>
                </div>

                <div className="sidebar-action-buttons">
                  <button className="btn-primary" onClick={() => onNavigateView('bust_detection')}>
                    Deep Bust Analysis →
                  </button>
                  <button className="btn-secondary" onClick={() => onNavigateView('stability')}>
                    Run Stability Monitor →
                  </button>
                </div>
              </div>
            ) : (
              <p className="placeholder-text">Click on any subdivision in the map to view detailed atmospheric parameters.</p>
            )}
          </div>

          <div className="sidebar-card">
            <h3>Subdivision Quick Jump</h3>
            <div className="subdiv-jump-list">
              {riskMapData?.regions?.map(r => (
                <button
                  key={r.region_id || r.id}
                  className={`subdiv-jump-item ${(r.region_id || r.id) === selectedRegionId ? 'active' : ''}`}
                  onClick={() => setSelectedRegionId(r.region_id || r.id)}
                >
                  <span className="subdiv-jump-name">{r.name}</span>
                  <span className="subdiv-jump-risk">{r.bust_probability}%</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
