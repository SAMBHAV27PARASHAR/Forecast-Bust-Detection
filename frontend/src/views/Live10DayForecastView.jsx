import React, { useState, useEffect, useMemo, useCallback } from 'react';
import LeadTimeSlider from '../components/LeadTimeSlider';
import IndiaRiskMap from '../components/IndiaRiskMap';
import { fetchCities, fetchCityForecast, fetchForecastDetail } from '../services/api';
import { formatUtcHourToIst, formatToIst } from '../utils/timezone';
// Static city data — imported directly so search works immediately (no API race condition)
import staticCitiesData from '../data/indian_cities.json';
const STATIC_CITIES = staticCitiesData.cities || [];

export default function Live10DayForecastView({
  selectedDay,
  setSelectedDay,
  selectedHour,
  setSelectedHour,
  selectedDate,
  setSelectedDate,
  riskMapData,
  activeScenarioId,
  mapLoading,
  onNavigateView,
  regions: propRegions = [],
  selectedRegionId = 'IND-UP-BIH',
  setSelectedRegionId,
  // City forecast props from App.jsx (preferred when provided)
  cities: propCities,
  selectedCity: propSelectedCity,
  onSelectCity: propOnSelectCity,
  cityForecast: propCityForecast,
  cityLoading: propCityLoading,
  cityForecastError: propCityForecastError,
}) {
  const regions = (propRegions && propRegions.length > 0) ? propRegions : (riskMapData?.regions || []);
  const validDate = riskMapData?.valid_forecast_time || '2026-09-24';
  const initDate = riskMapData?.initialization_time || '2026-09-19 00:00 UTC';

  // Domain Mode: 'subdivision' (default for Live 10-Day Operational View)
  const [domainMode, setDomainMode] = useState('subdivision');

  // ── Internal fallback city state ──────────────────────────────────────────
  // Used only when App.jsx does NOT provide city forecast props
  const [_cities, _setCities] = useState(STATIC_CITIES);
  const [_selectedCityId, _setSelectedCityId] = useState('bareilly');
  const [_cityForecast, _setCityForecast] = useState(null);
  const [_cityLoading, _setCityLoading] = useState(false);
  const [_cityForecastError, _setCityForecastError] = useState(null);

  // ── Effective values: prefer App.jsx props, fall back to internal state ───
  const cities = (propCities && propCities.length > 0) ? propCities : _cities;

  // Derived internal city from local ID (fallback only)
  const _internalCity = useMemo(() => {
    return _cities.find(c => c.id === _selectedCityId) || _cities[0] || {
      id: 'bareilly', name: 'Bareilly', state: 'Uttar Pradesh',
      lat: 28.367, lon: 79.4304, subdivision_id: 'IND-UP-BIH'
    };
  }, [_cities, _selectedCityId]);

  // Effective selected city: prefer prop (App.jsx manages it), fall back to internal
  const selectedCity = propSelectedCity || _internalCity;

  // Effective forecast data: prefer prop from App.jsx when it's not undefined/null
  const cityForecast = (propCityForecast !== undefined && propCityForecast !== null)
    ? propCityForecast
    : _cityForecast;
  const cityLoading = propCityLoading !== undefined ? propCityLoading : _cityLoading;
  const cityForecastError = (propCityForecastError !== undefined && propCityForecastError !== null)
    ? propCityForecastError
    : _cityForecastError;

  // ── City selection handler ────────────────────────────────────────────────
  const handleCitySelect = useCallback((cityObj) => {
    if (!cityObj) return;
    if (propOnSelectCity) {
      // App.jsx manages state and re-fetch
      propOnSelectCity(cityObj);
    } else {
      // Internal fallback: update local city ID which triggers internal fetch
      _setSelectedCityId(cityObj.id);
    }
    // Sync subdivision highlight regardless of who manages city state
    if (cityObj.subdivision_id && setSelectedRegionId) {
      setSelectedRegionId(cityObj.subdivision_id);
    }
  }, [propOnSelectCity, setSelectedRegionId]);

  // ── Subdivision sync on mount (internal fallback only) ───────────────────
  useEffect(() => {
    if (propOnSelectCity) return; // App.jsx manages this
    const b = STATIC_CITIES.find(c => c.id === _selectedCityId) || STATIC_CITIES[0];
    if (b && b.subdivision_id && setSelectedRegionId) {
      setSelectedRegionId(b.subdivision_id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── City list refresh from API (internal fallback only) ───────────────────
  useEffect(() => {
    if (propCities && propCities.length > 0) return; // App.jsx manages cities
    async function refreshCitiesFromApi() {
      try {
        const list = await fetchCities();
        if (list && list.length > 0) _setCities(list);
      } catch (err) {
        console.warn('City API refresh skipped:', err.message);
      }
    }
    refreshCitiesFromApi();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Internal city forecast fetch (only when App.jsx does NOT manage it) ───
  // If propOnSelectCity is defined, App.jsx owns the city state and fetches its own forecast.
  // If propOnSelectCity is undefined, this view manages city state locally.
  useEffect(() => {
    const appManages = propOnSelectCity !== undefined;
    if (appManages) return;
    if (!selectedCity) return;
    let isMounted = true;
    async function loadCityData() {
      _setCityLoading(true);
      _setCityForecastError(null);
      try {
        const cityId = selectedCity.id || selectedCity.name?.toLowerCase().replace(/\s+/g, '-');
        const data = await fetchCityForecast(
          cityId, selectedDay, selectedHour || 0, selectedDate,
          selectedCity.lat, selectedCity.lon
        );
        if (isMounted) _setCityForecast(data);
      } catch (err) {
        console.error('Failed to load live city forecast:', err);
        if (isMounted) _setCityForecastError(err.message || 'Forecast unavailable');
      } finally {
        if (isMounted) _setCityLoading(false);
      }
    }
    loadCityData();
    return () => { isMounted = false; };
  }, [selectedCity?.id, selectedDay, selectedHour, selectedDate, propOnSelectCity]);

  // ── Subdivision forecast detail for Days 0-10 overview ────────────────────
  const [subdivisionDetail, setSubdivisionDetail] = useState(null);
  const [subdivisionLoading, setSubdivisionLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadSubdivisionForecast() {
      setSubdivisionLoading(true);
      try {
        const detail = await fetchForecastDetail(
          selectedRegionId || 'IND-UP-BIH',
          selectedDay,
          'live_gefs',
          selectedHour || 0,
          selectedDate
        );
        if (isMounted) setSubdivisionDetail(detail);
      } catch (err) {
        console.warn('Could not load subdivision detail:', err);
      } finally {
        if (isMounted) setSubdivisionLoading(false);
      }
    }
    loadSubdivisionForecast();
    return () => { isMounted = false; };
  }, [selectedRegionId, selectedDay, selectedHour, selectedDate]);

  // ── Find active subdivision metadata ─────────────────────────────────────
  const selectedRegion = useMemo(() => {
    return regions.find(r => (r.id || r.region_id) === (selectedCity?.subdivision_id || selectedRegionId));
  }, [regions, selectedCity?.subdivision_id, selectedRegionId]);

  // ── Active day slice from 10-day operational timeline ─────────────────────
  const activeDayDetail = useMemo(() => {
    if (!subdivisionDetail) return null;
    if (Array.isArray(subdivisionDetail.ten_day_forecast)) {
      const found = subdivisionDetail.ten_day_forecast.find(item => item.day === selectedDay);
      if (found) {
        return {
          ...subdivisionDetail,
          ...found,
          temperature: found.temp_c ?? found.temp_degc ?? subdivisionDetail.temperature,
          rainfall: found.precip_mm ?? subdivisionDetail.rainfall,
          humidity: found.rh_pct ?? found.rh_850 ?? subdivisionDetail.humidity,
          wind_speed: found.wind_speed_kmh ?? subdivisionDetail.wind_speed,
          pressure: found.mslp_hpa ?? subdivisionDetail.pressure,
          cape_j_kg: found.cape_j_kg ?? subdivisionDetail.cape_j_kg,
          wind_shear: found.wind_shear_ms ?? subdivisionDetail.wind_shear,
          ensemble_spread: found.ensemble_spread ?? subdivisionDetail.ensemble_spread,
          bust_probability: found.bust_probability ?? subdivisionDetail.bust_probability,
          confidence: found.model_confidence ?? found.confidence_score ?? subdivisionDetail.confidence
        };
      }
    }
    return subdivisionDetail;
  }, [subdivisionDetail, selectedDay]);

  // ── Derived metrics and risk badge ────────────────────────────────────────
  const currentBustProb = cityForecast?.bust_probability ?? cityForecast?.current_step?.bust_probability ?? null;
  const getRiskBadge = (prob) => {
    if (prob === null || prob === undefined) return { label: 'EVALUATING', cls: 'badge-bust-low' };
    if (prob >= 60) return { label: 'HIGH BUST RISK', cls: 'badge-bust-high' };
    if (prob >= 35) return { label: 'ELEVATED RISK', cls: 'badge-bust-elevated' };
    return { label: 'LOW RISK (STABLE)', cls: 'badge-bust-low' };
  };
  const riskBadge = getRiskBadge(currentBustProb);

  // ── IST time label ────────────────────────────────────────────────────────
  const effectiveHour = selectedHour || 0;
  const displayDateStr = cityForecast?.selected_date_display || (selectedDate ? `${selectedDate}` : 'Selected Date');
  const forecastIstStr = cityForecast?.valid_time_utc
    ? formatToIst(cityForecast.valid_time_utc)
    : `${displayDateStr} • ${formatUtcHourToIst(effectiveHour)}`;
  const rawLeadHours = cityForecast?.lead_hours ?? (selectedDay * 24 + effectiveHour);
  const contributingFactors = cityForecast?.contributing_factors || [];
  const aiSummary = cityForecast?.summary || null;

  return (
    <div className="view-container live-forecast-view">
      {/* Top Header Banner */}
      <div className="view-header-card">
        <div className="header-left-block">
          <h2 className="view-title">⏱️ Operational 10-Day NWP Forecast Horizon</h2>
          <p className="view-desc">
            Medium-range weather forecast progression from +0h (Initialization) to +240h (Day 10). Operational GEFS broad / subdivision-level forecast horizon across 14 meteorological subdivisions with synchronized risk mapping.
          </p>
        </div>
        <div className="header-right-block">
          <div className="cycle-badge">
            <span className="dot pulse"></span>
            <span>Cycle (IST): {formatToIst(initDate)}</span>
          </div>
        </div>
      </div>

      {/* Distinction Bar */}
      <div className="view-distinction-bar">
        <span className="distinction-tag">Subdivision Overview</span>
        <span>Broad All-India Meteorological Subdivision Horizon</span>
        <button
          type="button"
          className="btn-link distinction-link"
          onClick={() => onNavigateView && onNavigateView('city_forecast')}
        >
          Switch to Point-Level City Forecast (119 Cities) 📍 →
        </button>
      </div>

      {/* 1. FORECAST DATE, VALID TIME & INTEGRATED LOCATION CONTROLS */}
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
        onSelectCity={handleCitySelect}
        domainMode={domainMode}
        onDomainModeChange={setDomainMode}
        regions={regions}
        selectedRegionId={selectedRegionId}
        onSelectRegion={setSelectedRegionId}
      />

      {/* 2. SELECTED LOCATION FORECAST CARD (CITY MODE) OR SUBDIVISION TABLE */}
      {domainMode === 'city' ? (
        <div className="selected-location-forecast-card" id="city-forecast-card">
          {/* ── Card Header ── */}
          <div className="location-card-header">
            <div className="loc-card-title-group">
              <div className="loc-main-headline">
                <span className="loc-badge-icon">📍</span>
                <h3 className="loc-city-heading">{selectedCity?.name}, {selectedCity?.state}</h3>
                <span className="loc-nwp-badge">Live GEFS Point Extraction</span>
              </div>
              <div className="loc-sub-details">
                <span>Coordinates: <strong>{selectedCity?.lat?.toFixed(4)}°N, {selectedCity?.lon?.toFixed(4)}°E</strong></span>
                <span className="sep">•</span>
                <span>Valid (IST): <strong>{forecastIstStr}</strong></span>
                <span className="sep">•</span>
                <span>Lead: <strong>+{rawLeadHours}h</strong></span>
                {selectedRegion && (
                  <>
                    <span className="sep">•</span>
                    <span>Subdivision: <strong>{selectedRegion.name}</strong></span>
                  </>
                )}
              </div>
            </div>
            {cityLoading && (
              <span className="loc-loading-pill">
                <span className="dot pulse"></span> Updating NWP grid...
              </span>
            )}
          </div>

          {/* ── Error State ── */}
          {cityForecastError && !cityLoading && (
            <div className="city-forecast-error-banner">
              ⚠️ Could not load forecast for {selectedCity?.name}: {cityForecastError}
            </div>
          )}

          {/* ── NWP Meteorological Parameters Grid ── */}
          {!cityForecastError && (
            <div className="city-exact-metrics-grid">
              <div className="hero-metric-tile">
                <span className="tile-label">Temperature</span>
                <span className="tile-value">
                  {cityForecast?.temperature != null ? `${Number(cityForecast.temperature).toFixed(1)}°C` : cityLoading ? '—' : 'N/A'}
                </span>
                <span className="tile-sub">2m Surface Air Temp (GEFS)</span>
              </div>

              <div className="hero-metric-tile">
                <span className="tile-label">Precipitation</span>
                <span className="tile-value text-precip">
                  {cityForecast?.rainfall != null ? `${Number(cityForecast.rainfall).toFixed(1)} mm` : cityLoading ? '—' : 'N/A'}
                </span>
                <span className="tile-sub">
                  {cityForecast?.rainfall != null
                    ? `Rate: ${(Number(cityForecast.rainfall) / 24.0).toFixed(2)} mm/h`
                    : 'Accumulation forecast'}
                </span>
              </div>

              <div className="hero-metric-tile">
                <span className="tile-label">Humidity</span>
                <span className="tile-value">
                  {cityForecast?.humidity != null ? `${Number(cityForecast.humidity).toFixed(0)}%` : cityLoading ? '—' : 'N/A'}
                </span>
                <span className="tile-sub">Relative Humidity 850hPa</span>
              </div>

              <div className="hero-metric-tile">
                <span className="tile-label">Wind Speed</span>
                <span className="tile-value">
                  {cityForecast?.wind_speed != null ? `${Number(cityForecast.wind_speed).toFixed(1)} km/h` : cityLoading ? '—' : 'N/A'}
                </span>
                <span className="tile-sub">10m Operational Vector</span>
              </div>

              <div className="hero-metric-tile">
                <span className="tile-label">Pressure (MSLP)</span>
                <span className="tile-value font-mono">
                  {cityForecast?.pressure != null ? `${Number(cityForecast.pressure).toFixed(1)} hPa` : cityLoading ? '—' : 'N/A'}
                </span>
                <span className="tile-sub">Mean Sea Level Pressure</span>
              </div>

              <div className="hero-metric-tile">
                <span className="tile-label">CAPE / Instability</span>
                <span className="tile-value">
                  {cityForecast?.cape_j_kg != null ? `${Number(cityForecast.cape_j_kg).toFixed(0)} J/kg` : cityLoading ? '—' : 'N/A'}
                </span>
                <span className="tile-sub">Convective Available Energy</span>
              </div>

              <div className="hero-metric-tile">
                <span className="tile-label">Ensemble Spread</span>
                <span className="tile-value font-mono">
                  {cityForecast?.ensemble_spread != null ? `${Number(cityForecast.ensemble_spread).toFixed(2)} σ` : cityLoading ? '—' : 'N/A'}
                </span>
                <span className="tile-sub">31-Member GEFS Dispersion</span>
              </div>

              {/* Bust Probability — highlighted */}
              <div className="hero-metric-tile bust-tile">
                <span className="tile-label">Bust Probability</span>
                <span className="tile-value text-bust">
                  {currentBustProb != null ? `${Number(currentBustProb).toFixed(1)}%` : cityLoading ? '—' : 'N/A'}
                </span>
                <span className={`risk-status-pill ${riskBadge.cls}`}>
                  {riskBadge.label}
                </span>
              </div>

              <div className="hero-metric-tile">
                <span className="tile-label">Model Confidence</span>
                <span className="tile-value text-conf">
                  {cityForecast?.confidence != null ? `${Number(cityForecast.confidence).toFixed(1)}%` : cityLoading ? '—' : 'N/A'}
                </span>
                <span className="tile-sub">{cityForecast?.confidence_level || 'Calibrated RF Score'}</span>
              </div>

              <div className="hero-metric-tile">
                <span className="tile-label">Risk Level</span>
                <span className="tile-value" style={{ textTransform: 'capitalize' }}>
                  {cityForecast?.risk_level || (cityLoading ? '—' : riskBadge.label)}
                </span>
                <span className="tile-sub">Reliability Classification</span>
              </div>
            </div>
          )}

          {/* ── AI Bust Detection & Explainability ── */}
          {!cityForecastError && (cityForecast?.dominant_factor || contributingFactors.length > 0) && (
            <div className="city-explainability-section">
              <div className="explain-header-row">
                <span className="explain-title">🤖 AI Forecast Bust Detection</span>
                {cityForecast?.dominant_factor && (
                  <span className="explain-primary-tag">
                    Primary Sensitivity: <strong>{cityForecast.dominant_factor}</strong>
                  </span>
                )}
              </div>

              {/* AI Summary */}
              {aiSummary && (
                <p className="city-ai-summary">{aiSummary}</p>
              )}

              {/* Contributing Factors */}
              {contributingFactors.length > 0 && (
                <div className="city-factors-list">
                  {contributingFactors.map((f, i) => {
                    const isPositive = f.risk_contribution === 'Elevates Bust Risk';
                    return (
                      <div key={f.feature_id || i} className={`city-factor-row ${isPositive ? 'factor-risk' : 'factor-stable'}`}>
                        <div className="factor-top-row">
                          <span className="factor-name">{f.feature_name}</span>
                          <span className={`factor-contribution-tag ${isPositive ? 'tag-risk' : 'tag-stable'}`}>
                            {isPositive ? '▲' : '▼'} {f.risk_contribution}
                          </span>
                        </div>
                        <div className="factor-detail-row">
                          <span className="factor-value-chip">
                            Observed: <strong>{typeof f.observed_value === 'number' ? f.observed_value.toFixed(2) : f.observed_value}</strong>
                          </span>
                          <span className="factor-impact-chip">
                            Impact: <strong>{f.impact_pct > 0 ? '+' : ''}{f.impact_pct?.toFixed(1)}%</strong>
                          </span>
                          <span className="factor-importance-chip">
                            Feature Weight: <strong>{(f.importance * 100).toFixed(1)}%</strong>
                          </span>
                        </div>
                        {f.explanation && (
                          <p className="factor-explanation">{f.explanation}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      ) : (
        /* SUBDIVISION MODE OVERVIEW: Compact 10-Day Timeline + Metrics + 14 Subdivisions Table */
        <div className="subdivision-forecast-card" id="subdivision-forecast-container">
          {/* Top Headline */}
          <div className="card-header-flex" style={{ marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: '700' }}>
                Operational 10-Day Timeline & Subdivision Diagnostics ({selectedRegion?.name || selectedRegionId})
              </h3>
              <span className="sub-text" style={{ fontSize: '12px', color: '#64748b' }}>
                Operational GEFS forecast slices across Days 0–10 • Valid Time: {subdivisionDetail?.valid_time_utc ? formatToIst(subdivisionDetail.valid_time_utc) : validDate}
              </span>
            </div>
            {onNavigateView && (
              <button className="btn-secondary" onClick={() => onNavigateView('city_forecast')}>
                Switch to City Forecast Drill-Down 📍
              </button>
            )}
          </div>

          {/* Compact 10-Day Timeline (D0 through D10) */}
          <div className="subdivision-timeline-row" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
            {Array.from({ length: 11 }, (_, i) => i).map((d) => {
              const isSelected = selectedDay === d;
              const dObj = subdivisionDetail?.available_dates?.find(ad => ad.day === d)
                || riskMapData?.available_dates?.find(ad => ad.day === d);
              const dateLabel = dObj?.short_label || (d === 0 ? 'Init' : `+${d * 24}h`);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSelectedDay(d);
                    if (dObj?.date && setSelectedDate) {
                      setSelectedDate(dObj.date);
                    }
                  }}
                  style={{
                    flex: '1 0 70px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'center',
                    boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: isSelected ? '700' : '600', color: isSelected ? '#1d4ed8' : '#334155', fontSize: '13px' }}>
                    {d === 0 ? 'D0' : `D${d}`}
                  </div>
                  <div style={{ fontSize: '11px', color: isSelected ? '#2563eb' : '#64748b', marginTop: '2px' }}>
                    {dateLabel}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Meteorological Metrics for Selected Day */}
          <div className="city-exact-metrics-grid" style={{ marginBottom: '24px' }}>
            <div className="hero-metric-tile">
              <span className="tile-label">Temperature</span>
              <span className="tile-value">
                {activeDayDetail?.temperature != null ? `${Number(activeDayDetail.temperature).toFixed(1)}°C` : subdivisionLoading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">2m Surface Air Temp (GEFS)</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Rainfall</span>
              <span className="tile-value text-precip">
                {activeDayDetail?.rainfall != null ? `${Number(activeDayDetail.rainfall).toFixed(1)} mm` : subdivisionLoading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">
                {activeDayDetail?.rainfall != null ? `Rate: ${(Number(activeDayDetail.rainfall) / 24.0).toFixed(2)} mm/h` : 'Accumulation'}
              </span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Relative Humidity</span>
              <span className="tile-value">
                {activeDayDetail?.humidity != null ? `${Math.round(activeDayDetail.humidity)}%` : subdivisionLoading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">850hPa Synoptic Level</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Wind Speed</span>
              <span className="tile-value">
                {activeDayDetail?.wind_speed != null ? `${Number(activeDayDetail.wind_speed).toFixed(1)} km/h` : subdivisionLoading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">10m Operational Vector</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Pressure (MSLP)</span>
              <span className="tile-value font-mono">
                {activeDayDetail?.pressure != null ? `${Number(activeDayDetail.pressure).toFixed(1)} hPa` : subdivisionLoading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">Mean Sea Level Pressure</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">CAPE / Instability</span>
              <span className="tile-value font-mono">
                {activeDayDetail?.cape_j_kg != null ? `${Math.round(activeDayDetail.cape_j_kg)} J/kg` : subdivisionLoading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">Convective Energy</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Ensemble Spread</span>
              <span className="tile-value font-mono">
                {activeDayDetail?.ensemble_spread != null ? `${Number(activeDayDetail.ensemble_spread).toFixed(2)} σ` : subdivisionLoading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">31-Member Dispersion</span>
            </div>

            <div className="hero-metric-tile bust-tile">
              <span className="tile-label">Bust Probability</span>
              <span className="tile-value text-bust">
                {activeDayDetail?.bust_probability != null ? `${Number(activeDayDetail.bust_probability).toFixed(1)}%` : subdivisionLoading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">Calibrated Random Forest</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Model Confidence</span>
              <span className="tile-value text-conf">
                {activeDayDetail?.confidence != null ? `${Number(activeDayDetail.confidence).toFixed(1)}%` : subdivisionLoading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">NWP Reliability Score</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Wind Shear</span>
              <span className="tile-value font-mono">
                {activeDayDetail?.wind_shear != null ? `${Number(activeDayDetail.wind_shear).toFixed(1)} m/s` : subdivisionLoading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">850-200 hPa Deep Shear</span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="forecast-data-table">
              <thead>
                <tr>
                  <th>Subdivision</th>
                  <th>Region ID</th>
                  <th>Bust Risk (%)</th>
                  <th>Risk Category</th>
                  <th>Forecast Rainfall</th>
                  <th>2m Temp</th>
                  <th>Wind Speed</th>
                  <th>Model Confidence</th>
                </tr>
              </thead>
              <tbody>
                {regions.map(r => {
                  const prob = r.bust_probability ?? 0;
                  const riskCat = prob >= 60 ? 'HIGH BUST RISK' : prob >= 35 ? 'ELEVATED RISK' : 'LOW RISK';
                  const badgeClass = prob >= 60 ? 'badge-bust-high' : prob >= 35 ? 'badge-bust-elevated' : 'badge-bust-low';
                  const isSelected = (r.region_id || r.id) === selectedRegionId;

                  return (
                    <tr
                      key={r.region_id || r.id}
                      className={isSelected ? 'selected-row' : ''}
                      onClick={() => setSelectedRegionId && setSelectedRegionId(r.region_id || r.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="font-bold">
                        {isSelected && <span className="selected-indicator">▶ </span>}
                        {r.name}
                      </td>
                      <td className="font-mono text-muted">{r.region_id || r.id}</td>
                      <td>
                        <div className="bust-prob-cell">
                          <div className="prob-bar-track">
                            <div
                              className="prob-bar-fill"
                              style={{
                                width: `${prob}%`,
                                backgroundColor: prob >= 60 ? '#ef4444' : prob >= 35 ? '#f59e0b' : '#10b981'
                              }}
                            />
                          </div>
                          <span className="prob-number">{prob}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`table-badge ${badgeClass}`}>{riskCat}</span>
                      </td>
                      <td className="font-mono precip-cell">{(r.precip_mean ?? r.forecast_rainfall ?? 0).toFixed(1)} mm</td>
                      <td className="font-mono">{(r.temp_c ?? 28.5).toFixed(1)}°C</td>
                      <td className="font-mono">{(r.wind_speed_kmh ?? 18.0).toFixed(1)} km/h</td>
                      <td>{r.confidence_score ?? 85}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. INDIA METEOROLOGICAL RISK MAP EMBEDDED ON THE SAME PAGE */}
      <div className="live-map-section-wrapper">
        <div className="map-section-header-bar">
          <div className="map-sec-title">
            <span className="map-sec-icon">🗺️</span>
            <div>
              <h4>India Meteorological Subdivision Risk Map</h4>
              <p className="map-sec-subtitle">
                Geographic visualization synchronized to selected location. Active subdivision <strong>{selectedRegion?.name || selectedRegionId}</strong> is highlighted with real-time coordinate pin for <strong>{selectedCity?.name}</strong>.
              </p>
            </div>
          </div>
          <div className="map-sec-badges">
            <span className="active-subdiv-badge">
              Active Region: <strong>{selectedRegion?.name || selectedRegionId}</strong>
            </span>
          </div>
        </div>

        <div className="live-map-canvas-container">
          <IndiaRiskMap
            regionsData={regions}
            riskMapData={riskMapData}
            selectedRegionId={selectedRegionId}
            onSelectRegion={(regId) => {
              if (setSelectedRegionId) setSelectedRegionId(regId);
            }}
            selectedDay={selectedDay}
            selectedCity={domainMode === 'city' ? selectedCity : null}
          />
        </div>
      </div>
    </div>
  );
}
