import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ScenarioSelector from './components/ScenarioSelector';

// Views
import DashboardView from './views/DashboardView';
import Live10DayForecastView from './views/Live10DayForecastView';
import CityForecastView from './views/CityForecastView';
import IndiaRiskMapView from './views/IndiaRiskMapView';
import BustDetectionView from './views/BustDetectionView';
import StabilityMonitorView from './views/StabilityMonitorView';
import WhatChangedView from './views/WhatChangedView';
import NwpPredictabilityView from './views/NwpPredictabilityView';
import VerificationView from './views/VerificationView';
import WhatIfSimulatorView from './views/WhatIfSimulatorView';
import HistoricalCaseStudyView from './views/HistoricalCaseStudyView';
import ModelPerformanceView from './views/ModelPerformanceView';
import SettingsView from './views/SettingsView';

import {
  fetchHealth,
  fetchScenarios,
  fetchRegions,
  fetchRiskMap,
  fetchForecastDetail,
  fetchLeadTimeCurve,
  fetchForecastStability,
  fetchWhatChanged,
  fetchLiveStatus,
  refreshLiveForecast,
  fetchCities,
  fetchCityForecast
} from './services/api';
import staticCitiesData from './data/indian_cities.json';
const STATIC_CITIES = staticCitiesData.cities || [];


export default function App() {
  // Navigation & Drawer
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');

  // Theme Management
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sih26079_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sih26079_theme', theme);
  }, [theme]);

  // Operational State
  const [isOnline, setIsOnline] = useState(false);
  const [scenarios, setScenarios] = useState([]);
  const [regions, setRegions] = useState([]);
  const [liveStatus, setLiveStatus] = useState(null);

  const [selectedDay, setSelectedDay] = useState(5);
  const [selectedHour, setSelectedHour] = useState(0);
  const [selectedDate, setSelectedDate] = useState('2026-09-24');
  const [selectedRegionId, setSelectedRegionId] = useState('IND-WB-ODI');
  const [activeScenarioId, setActiveScenarioId] = useState('live_gefs'); // Default is LIVE OPERATIONAL GEFS

  const [riskMapData, setRiskMapData] = useState(null);
  const [selectedRegionDetail, setSelectedRegionDetail] = useState(null);
  const [curveData, setCurveData] = useState(null);
  const [stabilityData, setStabilityData] = useState(null);
  const [whatChangedData, setWhatChangedData] = useState(null);

  const [mapLoading, setMapLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(true);
  const [stabilityLoading, setStabilityLoading] = useState(true);
  const [whatChangedLoading, setWhatChangedLoading] = useState(true);

  // Operational Selected City & Forecast State
  const [cities, setCities] = useState(STATIC_CITIES);
  const [selectedCity, setSelectedCity] = useState(() => STATIC_CITIES[0] || {
    id: 'bareilly',
    name: 'Bareilly',
    state: 'Uttar Pradesh',
    lat: 28.367,
    lon: 79.4304,
    subdivision_id: 'IND-UP-BIH'
  });
  const [cityForecast, setCityForecast] = useState(null);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityForecastError, setCityForecastError] = useState(null);

  // Sync cities catalog from API in background
  useEffect(() => {
    async function loadCities() {
      try {
        const list = await fetchCities();
        if (Array.isArray(list) && list.length > 0) {
          setCities(list);
        }
      } catch (err) {
        console.warn('Background city list refresh skipped:', err.message);
      }
    }
    loadCities();
  }, []);

  // Fetch Live GEFS City Forecast & Calibrated RF Inference
  useEffect(() => {
    if (!selectedCity) return;
    let isMounted = true;
    async function loadCityData() {
      setCityLoading(true);
      setCityForecastError(null);
      try {
        // Use city.id as the canonical lookup key; lat/lon for point precision
        const cityId = selectedCity.id || selectedCity.name?.toLowerCase().replace(/\s+/g, '-');
        const lat = selectedCity.lat;
        const lon = selectedCity.lon;
        const data = await fetchCityForecast(cityId, selectedDay, selectedHour || 0, selectedDate, lat, lon);
        if (isMounted) {
          setCityForecast(data);
        }
      } catch (err) {
        console.error('Failed to load live city forecast:', err);
        if (isMounted) setCityForecastError(err.message || 'Forecast unavailable');
      } finally {
        if (isMounted) setCityLoading(false);
      }
    }
    loadCityData();
    return () => { isMounted = false; };
    // Depend on individual fields — not the full object — to avoid reference equality issues
  }, [selectedCity?.id, selectedCity?.lat, selectedCity?.lon, selectedDay, selectedHour, selectedDate]);

  const handleCitySelect = (cityObj) => {
    if (!cityObj) return;
    // Spread to create new reference and guarantee React sees a state change
    setSelectedCity({ ...cityObj });
    if (cityObj.subdivision_id) {
      setSelectedRegionId(cityObj.subdivision_id);
    }
  };


  // Initialize meta: health, scenarios, regions, liveStatus
  useEffect(() => {
    async function init() {
      try {
        const health = await fetchHealth();
        setIsOnline(health.status === 'healthy');

        const scList = await fetchScenarios();
        setScenarios(scList);
        // If live_gefs is present in scenarios, set as default
        if (scList.some(s => s.id === 'live_gefs')) {
          setActiveScenarioId('live_gefs');
        }

        const regList = await fetchRegions();
        setRegions(regList);

        const lStatus = await fetchLiveStatus();
        setLiveStatus(lStatus);
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    init();
  }, []);

  // Fetch Nationwide Risk Map whenever day, scenario, exact hour, or date changes
  useEffect(() => {
    async function loadRiskMap() {
      setMapLoading(true);
      try {
        const data = await fetchRiskMap(selectedDay, activeScenarioId, selectedHour, selectedDate);
        setRiskMapData(data);
        setIsOnline(true);
      } catch (err) {
        console.error('Error loading risk map:', err);
      } finally {
        setMapLoading(false);
      }
    }
    loadRiskMap();
  }, [selectedDay, activeScenarioId, selectedHour, selectedDate]);

  // Fetch Region Detail, 10-day curve & Forecast Stability whenever region, day, scenario, exact hour, or date changes
  useEffect(() => {
    async function loadRegionData() {
      if (!selectedRegionId) return;
      setDetailLoading(true);
      setStabilityLoading(true);
      setWhatChangedLoading(true);
      try {
        const detail = await fetchForecastDetail(selectedRegionId, selectedDay, activeScenarioId, selectedHour, selectedDate);
        setSelectedRegionDetail(detail);

        const curve = await fetchLeadTimeCurve(selectedRegionId, activeScenarioId);
        setCurveData(curve);

        const stability = await fetchForecastStability(selectedRegionId, selectedDay, activeScenarioId, selectedHour);
        setStabilityData(stability);

        const whatChanged = await fetchWhatChanged(selectedRegionId, selectedDay, activeScenarioId, selectedHour);
        setWhatChangedData(whatChanged);
      } catch (err) {
        console.error('Error loading region detail, stability, or what-changed:', err);
      } finally {
        setDetailLoading(false);
        setStabilityLoading(false);
        setWhatChangedLoading(false);
      }
    }
    loadRegionData();
  }, [selectedRegionId, selectedDay, activeScenarioId, selectedHour, selectedDate]);

  const handleScenarioSelect = (scId) => {
    setActiveScenarioId(scId);
    setSelectedHour(0);
    if (scId !== 'live_gefs') {
      setSelectedDate(null);
    } else {
      setSelectedDate('2026-09-24');
    }
  };

  const handleManualLiveRefresh = async () => {
    try {
      const res = await refreshLiveForecast();
      const status = await fetchLiveStatus();
      setLiveStatus(status);
      // Reload current map and region
      const data = await fetchRiskMap(selectedDay, 'live_gefs', selectedHour, selectedDate);
      setRiskMapData(data);
      const detail = await fetchForecastDetail(selectedRegionId, selectedDay, 'live_gefs', selectedHour, selectedDate);
      setSelectedRegionDetail(detail);
      return res;
    } catch (err) {
      console.error('Failed to refresh live forecast:', err);
      throw err;
    }
  };

  const isLiveMode = activeScenarioId === 'live_gefs';
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId);
  const liveInitTime = liveStatus?.init_time_utc || riskMapData?.initialization_time || '2026-09-19 00:00 UTC';

  return (
    <div className={`app-layout theme-${theme}`}>
      {/* 3-Line Sidebar (Docked on Desktop, Drawer on Mobile) */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeView={activeView}
        onSelectView={setActiveView}
        isLiveMode={isLiveMode}
        liveInitTime={liveInitTime}
      />

      <div className="app-main-content-wrapper">
        {/* Global Header */}
        <Header
          isOnline={isOnline}
          isLiveMode={isLiveMode}
          activeScenarioName={activeScenario?.name}
          liveInitTime={liveInitTime}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          theme={theme}
          onToggleTheme={setTheme}
          onRefreshLive={handleManualLiveRefresh}
        />

      {/* Operational Scenario Bar (always accessible for switching between Live and Historical) */}
      {scenarios.length > 0 && (
        <ScenarioSelector
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          onSelectScenario={handleScenarioSelect}
        />
      )}

      {/* Dynamic View Router */}
      <main className="dashboard-content">
        {activeView === 'dashboard' && (
          <DashboardView
            riskMapData={riskMapData}
            selectedRegionDetail={selectedRegionDetail}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            selectedHour={selectedHour}
            setSelectedHour={setSelectedHour}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedRegionId={selectedRegionId}
            setSelectedRegionId={setSelectedRegionId}
            regions={regions}
            curveData={curveData}
            stabilityData={stabilityData}
            whatChangedData={whatChangedData}
            mapLoading={mapLoading}
            stabilityLoading={stabilityLoading}
            whatChangedLoading={whatChangedLoading}
            activeScenarioId={activeScenarioId}
            onNavigateView={setActiveView}
            cities={cities}
            selectedCity={selectedCity}
            onSelectCity={handleCitySelect}
            cityForecast={cityForecast}
            cityLoading={cityLoading}
            cityForecastError={cityForecastError}
          />
        )}

        {activeView === 'live_10day' && (
          <Live10DayForecastView
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            selectedHour={selectedHour}
            setSelectedHour={setSelectedHour}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            riskMapData={riskMapData}
            activeScenarioId={activeScenarioId}
            mapLoading={mapLoading}
            onNavigateView={setActiveView}
            regions={regions}
            selectedRegionId={selectedRegionId}
            setSelectedRegionId={setSelectedRegionId}
            cities={cities}
            selectedCity={selectedCity}
            onSelectCity={handleCitySelect}
            cityForecast={cityForecast}
            cityLoading={cityLoading}
            cityForecastError={cityForecastError}
          />
        )}

        {activeView === 'city_forecast' && (
          <CityForecastView
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            selectedHour={selectedHour}
            setSelectedHour={setSelectedHour}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            regions={regions}
            selectedRegionId={selectedRegionId}
            setSelectedRegionId={setSelectedRegionId}
          />
        )}

        {activeView === 'risk_map' && (
          <IndiaRiskMapView
            regions={regions}
            riskMapData={riskMapData}
            selectedRegionId={selectedRegionId}
            setSelectedRegionId={setSelectedRegionId}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            selectedHour={selectedHour}
            setSelectedHour={setSelectedHour}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedRegionDetail={selectedRegionDetail}
            activeScenarioId={activeScenarioId}
            mapLoading={mapLoading}
            onNavigateView={setActiveView}
          />
        )}

        {activeView === 'bust_detection' && (
          <BustDetectionView
            selectedRegionDetail={selectedRegionDetail}
            selectedRegionId={selectedRegionId}
            setSelectedRegionId={setSelectedRegionId}
            regions={regions}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            onNavigateView={setActiveView}
          />
        )}

        {activeView === 'stability' && (
          <StabilityMonitorView
            stabilityData={stabilityData}
            stabilityLoading={stabilityLoading}
            selectedRegionDetail={selectedRegionDetail}
            selectedRegionId={selectedRegionId}
            setSelectedRegionId={setSelectedRegionId}
            regions={regions}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            onNavigateView={setActiveView}
          />
        )}

        {activeView === 'what_changed' && (
          <WhatChangedView
            whatChangedData={whatChangedData}
            whatChangedLoading={whatChangedLoading}
            selectedRegionDetail={selectedRegionDetail}
            selectedRegionId={selectedRegionId}
            setSelectedRegionId={setSelectedRegionId}
            regions={regions}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            onNavigateView={setActiveView}
          />
        )}

        {activeView === 'nwp_predictability' && (
          <NwpPredictabilityView
            curveData={curveData}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            selectedRegionDetail={selectedRegionDetail}
            selectedRegionId={selectedRegionId}
            setSelectedRegionId={setSelectedRegionId}
            regions={regions}
            onNavigateView={setActiveView}
          />
        )}

        {activeView === 'verification' && (
          <VerificationView
            selectedRegionDetail={selectedRegionDetail}
            activeScenarioId={activeScenarioId}
            selectedDay={selectedDay}
            selectedHour={selectedHour}
            selectedDate={selectedDate}
            selectedCity={selectedCity}
            cityForecast={cityForecast}
            cities={cities}
            onSelectCity={setSelectedCity}
            onSelectScenario={handleScenarioSelect}
            onNavigateView={setActiveView}
          />
        )}

        {activeView === 'what_if' && (
          <WhatIfSimulatorView />
        )}

        {activeView === 'historical_2019' && (
          <HistoricalCaseStudyView
            onSelectScenario={handleScenarioSelect}
            onNavigateView={setActiveView}
          />
        )}

        {activeView === 'model_performance' && (
          <ModelPerformanceView />
        )}

        {activeView === 'settings' && (
          <SettingsView
            theme={theme}
            onToggleTheme={setTheme}
            liveStatus={liveStatus}
            onRefreshLiveStatus={async () => {
              const status = await fetchLiveStatus();
              setLiveStatus(status);
            }}
          />
        )}
      </main>

      {/* Operational Footer */}
      <footer className="app-footer">
        <div className="footer-left">
          <span>AI-Based Forecast Bust Detection Prototype</span>
          <span className="divider">•</span>
          <span>SIH Problem Statement 26079</span>
          <span className="divider">•</span>
          <span>Ministry of Earth Sciences / IMD Operational Reliability</span>
        </div>
        <div className="footer-right">
          <span className="academic-tag">
            {isLiveMode ? 'Operational Ingestion: NOAA/NCEP GEFS 0.25° Regular Grid' : 'Validation Archive: ERA5 Reanalysis & IMD Gridded Rainfall'}
          </span>
        </div>
      </footer>
      </div>
    </div>
  );
}
