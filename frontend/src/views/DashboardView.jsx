import React from 'react';
import MetricCards from '../components/MetricCards';
import LeadTimeSlider from '../components/LeadTimeSlider';
import SelectedCityForecastCard from '../components/SelectedCityForecastCard';
import IndiaRiskMap from '../components/IndiaRiskMap';
import LeadTimeDegradationChart from '../components/LeadTimeDegradationChart';
import ExplainabilityCard from '../components/ExplainabilityCard';
import ForecastStabilityMonitor from '../components/ForecastStabilityMonitor';
import WhatChangedCard from '../components/WhatChangedCard';

export default function DashboardView({
  riskMapData,
  selectedRegionDetail,
  selectedDay,
  setSelectedDay,
  selectedHour,
  setSelectedHour,
  selectedDate,
  setSelectedDate,
  selectedRegionId,
  setSelectedRegionId,
  regions,
  curveData,
  stabilityData,
  whatChangedData,
  mapLoading,
  stabilityLoading,
  whatChangedLoading,
  activeScenarioId,
  onNavigateView,
  cities = [],
  selectedCity,
  onSelectCity,
  cityForecast,
  cityLoading,
  cityForecastError
}) {
  const selectedRegionName = selectedRegionDetail?.region?.name || 'Selected Subdivision';
  const activeRegion = regions?.find(r => (r.id || r.region_id) === (selectedCity?.subdivision_id || selectedRegionId));

  return (
    <div className="view-container dashboard-view">
      {/* Lead Time & Exact Horizon Timeline with Integrated City Selector */}
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
        cities={cities}
        selectedCity={selectedCity}
        onSelectCity={onSelectCity}
        regions={regions}
        selectedRegionId={selectedRegionId}
        onSelectRegion={setSelectedRegionId}
      />

      {/* Dedicated Selected City Forecast Section */}
      {selectedCity && (
        <SelectedCityForecastCard
          selectedCity={selectedCity}
          cityForecast={cityForecast}
          cityLoading={cityLoading}
          cityForecastError={cityForecastError}
          selectedDate={selectedDate}
          selectedHour={selectedHour}
          selectedDay={selectedDay}
          selectedRegion={activeRegion}
        />
      )}

      {/* Top Metric Cards */}
      <MetricCards
        riskMapData={riskMapData}
        selectedRegionDetail={selectedRegionDetail}
        selectedDay={selectedDay}
      />

      {/* Quick Action Badges */}
      <div className="command-center-quick-bar">
        <span className="quick-bar-label">Operational Workflows:</span>
        <button className="quick-chip" onClick={() => onNavigateView('city_forecast')}>
          📍 Search City Forecast
        </button>
        <button className="quick-chip" onClick={() => onNavigateView('stability')}>
          📈 Stability Monitor
        </button>
        <button className="quick-chip" onClick={() => onNavigateView('what_changed')}>
          🔄 What Changed?
        </button>
        <button className="quick-chip" onClick={() => onNavigateView('verification')}>
          ✅ Forecast Verification
        </button>
        <button className="quick-chip" onClick={() => onNavigateView('model_performance')}>
          🏆 Model Evaluation
        </button>
      </div>

      {/* Main Operational Two-Column Grid */}
      <div className="main-operational-grid">
        {/* LEFT COLUMN: India Risk Map + 10-Day NWP Horizon Graph */}
        <section className="grid-col left-stack-column">
          <div className="section-header-row">
            <span className="section-title">Nationwide Forecast Bust Risk</span>
            <button className="btn-link" onClick={() => onNavigateView('risk_map')}>
              Expand Map & Details →
            </button>
          </div>
          <IndiaRiskMap
            regionsData={regions}
            riskMapData={riskMapData}
            selectedRegionId={selectedRegionId}
            onSelectRegion={setSelectedRegionId}
            selectedDay={selectedDay}
            exactTimeMeta={riskMapData}
          />

          <div className="section-header-row" style={{ marginTop: '1.25rem' }}>
            <span className="section-title">10-Day NWP Predictability Degradation</span>
            <button className="btn-link" onClick={() => onNavigateView('nwp_predictability')}>
              Full Horizon Analysis →
            </button>
          </div>
          <LeadTimeDegradationChart
            curveData={curveData}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            regionName={selectedRegionName}
          />
        </section>

        {/* RIGHT COLUMN: Explainability + Stability + What Changed? */}
        <section className="grid-col right-stack-column">
          <div className="section-header-row">
            <span className="section-title">Subdivision Atmospheric Drivers</span>
            <button className="btn-link" onClick={() => onNavigateView('bust_detection')}>
              Deep Bust Diagnostics →
            </button>
          </div>
          <ExplainabilityCard
            selectedRegionDetail={selectedRegionDetail}
          />

          <div className="section-header-row" style={{ marginTop: '1.25rem' }}>
            <span className="section-title">Forecast Stability Monitor</span>
            <button className="btn-link" onClick={() => onNavigateView('stability')}>
              Detailed Run Tracking →
            </button>
          </div>
          <ForecastStabilityMonitor
            stabilityData={stabilityData}
            loading={stabilityLoading}
            regionName={selectedRegionName}
            selectedDay={selectedDay}
          />

          <div className="section-header-row" style={{ marginTop: '1.25rem' }}>
            <span className="section-title">What Changed? Run-to-Run Attribution</span>
            <button className="btn-link" onClick={() => onNavigateView('what_changed')}>
              Full Attribution Analysis →
            </button>
          </div>
          <WhatChangedCard
            whatChangedData={whatChangedData}
            loading={whatChangedLoading}
            regionName={selectedRegionName}
            selectedDay={selectedDay}
          />
        </section>
      </div>
    </div>
  );
}
