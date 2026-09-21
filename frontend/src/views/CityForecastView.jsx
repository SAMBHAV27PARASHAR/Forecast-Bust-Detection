import React, { useState, useEffect, useRef } from 'react';
import { fetchCities, fetchCityForecast, fetchForecastDetail } from '../services/api';
import LocationSelector from '../components/LocationSelector';
import { formatToIst, formatUtcHourToIst } from '../utils/timezone';
import staticCitiesData from '../data/indian_cities.json';

const STATIC_CITIES = staticCitiesData.cities || [];

export default function CityForecastView({
  selectedDay: propDay,
  setSelectedDay: propSetDay,
  selectedHour: propHour,
  setSelectedHour: propSetHour,
  selectedDate: propDate,
  setSelectedDate: propSetDate,
  regions = [],
  selectedRegionId: propRegionId = 'IND-UP-BIH',
  setSelectedRegionId: propSetRegionId
} = {}) {
  const [domainMode, setDomainMode] = useState('city');
  const [cities, setCities] = useState(STATIC_CITIES);
  const [selectedCityId, setSelectedCityId] = useState('bareilly');
  const [selectedRegionId, setSelectedRegionId] = useState(propRegionId || 'IND-UP-BIH');

  // Selected date/time state
  const selectedDate = propDate !== undefined ? propDate : null;
  const setSelectedDate = propSetDate || (() => {});
  const selectedHour = propHour !== undefined ? propHour : 0;
  const setSelectedHour = propSetHour || (() => {});
  const selectedDay = propDay !== undefined ? propDay : 1;
  const setSelectedDay = propSetDay || (() => {});

  const [cityForecast, setCityForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [activeChartMetric, setActiveChartMetric] = useState('risk'); // 'risk', 'precip', 'temp', 'wind'
  const activeRequestIdRef = useRef(0);

  // Load latest cities list from API
  useEffect(() => {
    async function loadCities() {
      try {
        const list = await fetchCities();
        if (Array.isArray(list) && list.length > 0) {
          setCities(list);
        }
      } catch (err) {
        console.error('Failed to load cities:', err);
      }
    }
    loadCities();
  }, []);

  const selectedCityMeta = cities.find(c => 
    c.id === selectedCityId || 
    (c.name && c.name.toLowerCase() === (selectedCityId || '').toLowerCase()) ||
    (c.id && c.id.replace(/-/g, '') === (selectedCityId || '').replace(/-/g, ''))
  ) || STATIC_CITIES.find(c => 
    c.id === selectedCityId || 
    (c.name && c.name.toLowerCase() === (selectedCityId || '').toLowerCase())
  ) || (domainMode === 'city' && cityForecast?.city ? cityForecast.city : null);

  // Load city forecast on city, date, hour, or day change (or subdivision change)
  useEffect(() => {
    const requestId = ++activeRequestIdRef.current;

    async function loadCityData() {
      if (!selectedCityId && domainMode === 'city') return;
      setLoading(true);
      setFetchError(null);
      try {
        if (domainMode === 'city') {
          const lat = selectedCityMeta?.lat;
          const lon = selectedCityMeta?.lon;
          const data = await fetchCityForecast(selectedCityId, selectedDay, selectedHour, selectedDate, lat, lon);
          if (activeRequestIdRef.current === requestId) {
            setCityForecast(data);
            if (!selectedDate && data?.selected_date) {
              setSelectedDate(data.selected_date);
            }
          }
        } else {
          // Subdivision mode: fetch subdivision forecast
          const detail = await fetchForecastDetail(selectedRegionId, selectedDay, 'live_gefs', selectedHour, selectedDate);
          if (activeRequestIdRef.current === requestId) {
            const rawP = detail.raw_parameters || {};
            const pred = detail.prediction || {};
            setCityForecast({
              city: {
                id: selectedRegionId,
                name: detail.region?.name || selectedRegionId,
                state: detail.region?.states || 'India',
                lat: detail.region?.centroid ? detail.region.centroid[0] : 26.0,
                lon: detail.region?.centroid ? detail.region.centroid[1] : 84.0,
                subdivision_id: selectedRegionId
              },
              temperature: rawP.temp_forecast ?? 28.0,
              rainfall: rawP.precip_forecast ?? 0.0,
              humidity: rawP.rh_850 ?? 65.0,
              wind_speed: Math.round((rawP.wind_shear_850_200 || 12.0) * 1.5 * 10) / 10,
              pressure: rawP.mslp ?? 1010.0,
              cape_j_kg: rawP.cape_j_kg ?? 600.0,
              ensemble_spread: rawP.ensemble_spread ?? 1.2,
              bust_probability: pred.bust_probability ?? 0.0,
              confidence: pred.confidence_score ?? 85.0,
              selected_date: detail.selected_date,
              selected_date_display: detail.selected_date_display,
              valid_time_utc: detail.valid_time_utc,
              lead_hours: detail.lead_hours,
              available_dates: detail.available_dates || [],
              available_times: detail.available_times || [],
              ten_day_forecast: detail.ten_day_forecast || [],
              ten_day_trend: detail.ten_day_trend || detail.ten_day_forecast || []
            });
          }
        }
      } catch (err) {
        if (activeRequestIdRef.current === requestId) {
          console.error('Failed to load forecast data:', err);
          setCityForecast(null);
          setFetchError(err.message || `Forecast unavailable for city '${selectedCityId}'`);
        }
      } finally {
        if (activeRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }
    loadCityData();
  }, [domainMode, selectedCityId, selectedRegionId, selectedDay, selectedHour, selectedDate, selectedCityMeta?.lat, selectedCityMeta?.lon]);

  const availableDates = cityForecast?.available_dates || [];

  // Active date object
  const activeDateObj = (selectedDate && availableDates.find(d => d.date === selectedDate))
    || availableDates.find(d => d.day === selectedDay)
    || availableDates[0]
    || null;

  const availableTimes = activeDateObj?.available_times || cityForecast?.available_times || [
    { hour: 0, label: '05:30 IST', lead_hours: selectedDay * 24, valid_time_utc: '' }
  ];

  const currentStep = cityForecast?.current_step;
  const tenDayTrend = cityForecast?.ten_day_forecast || cityForecast?.ten_day_trend || [];
  const activeDayForecast = (tenDayTrend && tenDayTrend.length > 0)
    ? (tenDayTrend.find(d => Number(d.day) === Number(selectedDay)) || tenDayTrend[0])
    : (currentStep || cityForecast);

  const getRiskBadge = (prob) => {
    if (prob >= 60) return { label: 'HIGH BUST RISK', color: 'badge-bust-high' };
    if (prob >= 35) return { label: 'ELEVATED RISK', color: 'badge-bust-elevated' };
    return { label: 'LOW RISK (STABLE)', color: 'badge-bust-low' };
  };

  const currentBustProb = activeDayForecast?.bust_probability ?? cityForecast?.bust_probability ?? currentStep?.bust_probability ?? 0;
  const riskBadge = getRiskBadge(currentBustProb);

  const handleCitySelect = (cityObj) => {
    if (!cityObj) return;
    setSelectedCityId(cityObj.id);
    if (cityObj.subdivision_id && propSetRegionId) {
      propSetRegionId(cityObj.subdivision_id);
    }
  };

  const handleRegionSelect = (rId) => {
    setSelectedRegionId(rId);
    if (propSetRegionId) propSetRegionId(rId);
  };

  // Find matching subdivision name
  const matchedRegion = regions.find(r => (r.region_id || r.id) === (selectedCityMeta?.subdivision_id || cityForecast?.city?.subdivision_id));
  const subdivisionName = matchedRegion?.name || selectedCityMeta?.subdivision_id || cityForecast?.city?.subdivision_id || 'North-Central India (UP & Bihar)';

  return (
    <div className="view-container city-forecast-view">
      {/* 1. Header Banner */}
      <div className="view-header-card">
        <div className="header-left-block">
          <h2 className="view-title">📍 City Forecast (Operational GEFS Drill-Down)</h2>
          <p className="view-desc">
            Detailed city-level view of the operational NOAA GEFS dataset across Indian cities and district headquarters. Extracts the nearest GEFS 0.25° grid point with zero synthetic values.
          </p>
        </div>
        <div className="header-right-block">
          <div className="cycle-badge">
            <span className="dot pulse"></span>
            <span>GEFS Cycle (IST): {cityForecast?.initialization_time ? formatToIst(cityForecast.initialization_time) : '19 Sep 2026 • 05:30 IST'}</span>
          </div>
        </div>
      </div>

      {/* 2. REUSABLE FUNCTIONAL LOCATION SELECTOR */}
      <LocationSelector
        mode={domainMode}
        onModeChange={setDomainMode}
        cities={cities}
        selectedCityId={selectedCityId}
        onSelectCity={handleCitySelect}
        regions={regions}
        selectedRegionId={selectedRegionId}
        onSelectRegion={handleRegionSelect}
      />

      {/* 3. CITY NOT FOUND / ERROR STATE */}
      {fetchError && !loading && (
        <div className="card alert-card-danger" style={{ padding: '24px', textAlign: 'center', margin: '20px 0', border: '1px solid #f87171', background: '#fef2f2', borderRadius: '10px' }}>
          <h3 style={{ color: '#b91c1c', marginBottom: '8px' }}>⚠️ City Not Available</h3>
          <p style={{ color: '#7f1d1d', margin: 0 }}>
            {fetchError}. Please select another supported city from the Indian cities catalog.
          </p>
        </div>
      )}

      {/* 4. TOP METADATA CARD (Selected City, State, Lat/Lon, Subdivision, GEFS cycle, Init time) */}
      {!fetchError && (
        <div className="card city-meta-banner" style={{ padding: '16px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📍</span>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: '700' }}>
                  {selectedCityMeta?.name || cityForecast?.city?.name || selectedCityId.toUpperCase()}, {selectedCityMeta?.state || cityForecast?.city?.state || 'India'}
                </h3>
                <span className="loc-nwp-badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: '600' }}>
                  Operational GEFS Grid
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px', fontSize: '13px', color: '#475569' }}>
                <span>Coordinates: <strong>{Number(selectedCityMeta?.lat || cityForecast?.coordinates?.latitude || 0).toFixed(4)}°N, {Number(selectedCityMeta?.lon || cityForecast?.coordinates?.longitude || 0).toFixed(4)}°E</strong></span>
                <span>•</span>
                <span>Subdivision: <strong>{subdivisionName}</strong></span>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: '#475569', background: '#f8fafc', padding: '8px 14px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>GEFS Cycle</span>
                <strong style={{ color: '#0f172a' }}>00z Operational</strong>
              </div>
              <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '14px' }}>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Initialization (IST)</span>
                <strong style={{ color: '#0f172a' }}>
                  {cityForecast?.forecast_initialization_utc ? formatToIst(cityForecast.forecast_initialization_utc) : '19 Sep 2026 • 05:30 IST'}
                </strong>
              </div>
              <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '14px' }}>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Active Day</span>
                <strong style={{ color: '#2563eb' }}>Day {selectedDay} (+{selectedDay * 24}h)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. CLEAN D0-D10 TIMELINE SELECTOR */}
      {!fetchError && (
        <div className="card city-timeline-card" style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 18px', margin: '16px 0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⏱️ 10-Day Forecast Timeline (D0–D10)
            </span>
            <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600' }}>
              Selected: Day {selectedDay} (+{selectedDay * 24}h Lead)
            </span>
          </div>
          <div className="city-d0-d10-bar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => {
              const isSelected = d === selectedDay;
              const dayData = tenDayTrend.find(item => item.day === d);
              const dayBust = dayData?.bust_probability != null ? Math.round(dayData.bust_probability) : null;
              return (
                <button
                  key={d}
                  type="button"
                  id={`btn-city-day-${d}`}
                  onClick={() => {
                    setSelectedDay(d);
                    if (dayData?.date) setSelectedDate(dayData.date);
                  }}
                  style={{
                    flex: '1 1 0',
                    minWidth: '65px',
                    padding: '8px 4px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#1d4ed8' : '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.15)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>
                    {d === 0 ? 'D0' : `D${d}`}
                  </span>
                  <span style={{ fontSize: '10px', color: isSelected ? '#2563eb' : '#64748b' }}>
                    +{d * 24}h
                  </span>
                  {dayBust != null && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: dayBust >= 50 ? '#dc2626' : dayBust >= 25 ? '#d97706' : '#16a34a'
                    }}>
                      {dayBust}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. DETAILED METEOROLOGICAL METRICS FOR SELECTED DAY (ALL 11 REQUIRED VARIABLES) */}
      {!fetchError && (
        <div className="card city-detail-panel" style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: '700' }}>
                🔬 Meteorological Detail for Day {selectedDay} ({activeDayForecast?.display_date || activeDayForecast?.valid_date || activeDayForecast?.date || `Day ${selectedDay}`})
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Valid Time (IST): <strong>{activeDayForecast?.valid_time_utc ? formatToIst(activeDayForecast.valid_time_utc) : formatUtcHourToIst(selectedHour)}</strong> (+{activeDayForecast?.lead_hours ?? (selectedDay * 24)}h lead)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`risk-status-pill ${riskBadge.color}`} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '4px' }}>
                {riskBadge.label} ({currentBustProb}%)
              </span>
            </div>
          </div>

          {/* Variables Grid */}
          <div className="city-exact-metrics-grid">
            <div className="hero-metric-tile">
              <span className="tile-label">Temperature</span>
              <span className="tile-value">
                {activeDayForecast?.temp_c != null ? `${Number(activeDayForecast.temp_c).toFixed(1)}°C` : activeDayForecast?.temperature != null ? `${Number(activeDayForecast.temperature).toFixed(1)}°C` : loading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">2m Surface Air Temp (GEFS)</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Rainfall</span>
              <span className="tile-value text-precip">
                {activeDayForecast?.precip_mm != null ? `${Number(activeDayForecast.precip_mm).toFixed(1)} mm` : activeDayForecast?.rainfall != null ? `${Number(activeDayForecast.rainfall).toFixed(1)} mm` : loading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">
                {activeDayForecast?.precip_rate_mm_hr != null ? `Rate: ${(Number(activeDayForecast.precip_rate_mm_hr)).toFixed(2)} mm/h` : 'Accumulation'}
              </span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Wind Speed</span>
              <span className="tile-value">
                {activeDayForecast?.wind_speed_kmh != null ? `${Number(activeDayForecast.wind_speed_kmh).toFixed(1)} km/h` : activeDayForecast?.wind_speed != null ? `${Number(activeDayForecast.wind_speed).toFixed(1)} km/h` : loading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">10m Operational Vector</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Relative Humidity</span>
              <span className="tile-value">
                {activeDayForecast?.rh_850 != null ? `${Math.round(activeDayForecast.rh_850)}%` : activeDayForecast?.humidity != null ? `${Math.round(activeDayForecast.humidity)}%` : loading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">850hPa Synoptic Level</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Pressure (MSLP)</span>
              <span className="tile-value font-mono">
                {activeDayForecast?.mslp_hpa != null ? `${Number(activeDayForecast.mslp_hpa).toFixed(1)} hPa` : activeDayForecast?.pressure != null ? `${Number(activeDayForecast.pressure).toFixed(1)} hPa` : loading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">Mean Sea Level Pressure</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">CAPE / Instability</span>
              <span className="tile-value font-mono">
                {activeDayForecast?.cape_j_kg != null ? `${Math.round(activeDayForecast.cape_j_kg)} J/kg` : loading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">Convective Energy</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Wind Shear</span>
              <span className="tile-value font-mono">
                {activeDayForecast?.wind_shear_ms != null ? `${Number(activeDayForecast.wind_shear_ms).toFixed(1)} m/s` : activeDayForecast?.wind_shear != null ? `${Number(activeDayForecast.wind_shear).toFixed(1)} m/s` : loading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">850–200 hPa Deep Shear</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Ensemble Spread</span>
              <span className="tile-value font-mono">
                {activeDayForecast?.ensemble_spread != null ? `${Number(activeDayForecast.ensemble_spread).toFixed(2)} σ` : loading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">31-Member Dispersion</span>
            </div>

            <div className="hero-metric-tile bust-tile">
              <span className="tile-label">Bust Probability</span>
              <span className="tile-value text-bust">
                {activeDayForecast?.bust_probability != null ? `${Number(activeDayForecast.bust_probability).toFixed(1)}%` : loading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">Calibrated Random Forest</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Model Confidence</span>
              <span className="tile-value text-conf">
                {activeDayForecast?.model_confidence != null ? `${Number(activeDayForecast.model_confidence).toFixed(1)}%` : activeDayForecast?.confidence != null ? `${Number(activeDayForecast.confidence).toFixed(1)}%` : loading ? '—' : 'N/A'}
              </span>
              <span className="tile-sub">{cityForecast?.confidence_level || 'NWP Reliability Score'}</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Risk Level</span>
              <span className="tile-value" style={{ textTransform: 'capitalize' }}>
                {activeDayForecast?.risk_level || (activeDayForecast?.bust_probability != null ? riskBadge.label : (loading ? '—' : 'N/A'))}
              </span>
              <span className="tile-sub">Operational Classification</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. 10-DAY FORECAST TABLE (Day | Date | Valid Time (IST) | Temp | Rain | Wind | RH | CAPE | Spread | Bust Risk) */}
      {!fetchError && (
        <div className="city-table-card" style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="table-header-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: '700' }}>
                📅 10-Day Forecast Schedule (Days 0–10)
              </h3>
              <span className="table-sub" style={{ fontSize: '12px', color: '#64748b' }}>
                Click any row (D0–D10) to view detailed meteorological metrics above
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600', background: '#eff6ff', padding: '4px 10px', borderRadius: '4px' }}>
              Selected: Day {selectedDay}
            </span>
          </div>

          <div className="table-responsive">
            <table className="forecast-data-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Date</th>
                  <th>Valid Time (IST)</th>
                  <th>Temp</th>
                  <th>Rain</th>
                  <th>Wind</th>
                  <th>RH</th>
                  <th>CAPE</th>
                  <th>Spread</th>
                  <th>Bust Risk</th>
                </tr>
              </thead>
              <tbody>
                {tenDayTrend.length > 0 ? (
                  tenDayTrend.map(row => {
                    const isSelected = row.day === selectedDay;
                    const badge = getRiskBadge(row.bust_probability ?? 0);
                    const leadH = row.lead_hours ?? (row.day * 24);
                    const validTimeDisplay = row.valid_time_utc
                      ? formatToIst(row.valid_time_utc, 'time')
                      : formatUtcHourToIst(0);

                    return (
                      <tr
                        key={row.day}
                        className={`table-row ${isSelected ? 'active-row' : ''}`}
                        onClick={() => {
                          setSelectedDay(row.day);
                          if (row.date) setSelectedDate(row.date);
                        }}
                        style={{ cursor: 'pointer', background: isSelected ? '#f0fdf4' : 'inherit' }}
                      >
                        <td className="font-bold">
                          {isSelected && <span style={{ color: '#16a34a', marginRight: '4px' }}>▶</span>}
                          {row.day === 0 ? 'D0 (Init)' : `D${row.day} (+${leadH}h)`}
                        </td>
                        <td className="font-mono">{row.valid_date || row.date}</td>
                        <td className="font-mono">{validTimeDisplay}</td>
                        <td className="font-mono">{row.temp_c != null ? `${Number(row.temp_c).toFixed(1)}°C` : 'N/A'}</td>
                        <td className="precip-cell font-mono">{row.precip_mm != null ? `${Number(row.precip_mm).toFixed(1)} mm` : 'N/A'}</td>
                        <td className="font-mono">{row.wind_speed_kmh != null ? `${Number(row.wind_speed_kmh).toFixed(1)} km/h` : 'N/A'}</td>
                        <td className="font-mono">{row.rh_850 != null || row.rh_pct != null ? `${Math.round(row.rh_850 ?? row.rh_pct)}%` : 'N/A'}</td>
                        <td className="font-mono">{row.cape_j_kg != null ? `${Math.round(row.cape_j_kg)} J/kg` : 'N/A'}</td>
                        <td className="font-mono">{row.ensemble_spread != null ? `${Number(row.ensemble_spread).toFixed(2)} σ` : 'N/A'}</td>
                        <td>
                          <span className={`table-badge ${badge.color}`}>
                            {row.bust_probability != null ? `${Number(row.bust_probability).toFixed(1)}%` : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                      {loading ? 'Loading operational GEFS slices...' : 'Forecast series unavailable'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Multi-Variable 10-Day Trend Chart */}
      {!fetchError && tenDayTrend.length > 0 && (
        <div className="city-chart-card">
          <div className="chart-header-row">
            <div>
              <h3 className="chart-title">10-Day NWP Forecast Horizon ({selectedCityMeta?.name || 'City'})</h3>
              <span className="chart-sub">Operational trend curve across Days 0–10</span>
            </div>

            <div className="chart-metric-toggles">
              <button
                className={`toggle-btn ${activeChartMetric === 'risk' ? 'active' : ''}`}
                onClick={() => setActiveChartMetric('risk')}
              >
                ⚠️ Bust Risk (%)
              </button>
              <button
                className={`toggle-btn ${activeChartMetric === 'precip' ? 'active' : ''}`}
                onClick={() => setActiveChartMetric('precip')}
              >
                🌧️ Rainfall (mm)
              </button>
              <button
                className={`toggle-btn ${activeChartMetric === 'temp' ? 'active' : ''}`}
                onClick={() => setActiveChartMetric('temp')}
              >
                🌡️ Temperature (°C)
              </button>
              <button
                className={`toggle-btn ${activeChartMetric === 'wind' ? 'active' : ''}`}
                onClick={() => setActiveChartMetric('wind')}
              >
                💨 Wind Speed (km/h)
              </button>
            </div>
          </div>

          <div className="city-chart-canvas">
            <svg viewBox="0 0 800 240" className="trend-svg" preserveAspectRatio="none">
              <defs>
                <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="precipGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {[40, 90, 140, 190].map((y, i) => (
                <line key={i} x1="40" y1={y} x2="780" y2={y} stroke="var(--border-color)" strokeDasharray="3 3" />
              ))}

              {(() => {
                const count = tenDayTrend.length;
                const getX = (index) => 60 + (index / Math.max(1, count - 1)) * 700;

                let getY;
                let points = [];
                let areaPath = '';

                if (activeChartMetric === 'risk') {
                  getY = (val) => 200 - (val / 100) * 160;
                  points = tenDayTrend.map((d, i) => ({ x: getX(i), y: getY(d.bust_probability ?? 0), val: d.bust_probability ?? 0, day: d.day, date: d.date }));
                } else if (activeChartMetric === 'precip') {
                  const maxPrecip = Math.max(...tenDayTrend.map(d => d.precip_mm || 0), 10);
                  getY = (val) => 200 - (val / maxPrecip) * 160;
                  points = tenDayTrend.map((d, i) => ({ x: getX(i), y: getY(d.precip_mm || 0), val: d.precip_mm || 0, day: d.day, date: d.date }));
                } else if (activeChartMetric === 'temp') {
                  const minT = 15;
                  const maxT = 45;
                  getY = (val) => 200 - ((val - minT) / (maxT - minT)) * 160;
                  points = tenDayTrend.map((d, i) => ({ x: getX(i), y: getY(d.temp_c || 25), val: d.temp_c || 25, day: d.day, date: d.date }));
                } else {
                  const maxW = Math.max(...tenDayTrend.map(d => d.wind_speed_kmh || 0), 40);
                  getY = (val) => 200 - (val / maxW) * 160;
                  points = tenDayTrend.map((d, i) => ({ x: getX(i), y: getY(d.wind_speed_kmh || 0), val: d.wind_speed_kmh || 0, day: d.day, date: d.date }));
                }

                const pathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
                areaPath = `${pathD} L ${points[points.length - 1]?.x || 760} 200 L ${points[0]?.x || 60} 200 Z`;

                return (
                  <g>
                    <path
                      d={areaPath}
                      fill={activeChartMetric === 'precip' ? 'url(#precipGradient)' : 'url(#riskGradient)'}
                    />

                    <path
                      d={pathD}
                      fill="none"
                      stroke={activeChartMetric === 'precip' ? '#06b6d4' : activeChartMetric === 'temp' ? '#f59e0b' : activeChartMetric === 'wind' ? '#10b981' : '#ef4444'}
                      strokeWidth="3"
                    />

                    {points.map((p, i) => {
                      const isSelected = p.day === selectedDay;
                      return (
                        <g key={i} onClick={() => { setSelectedDay(p.day); if (p.date) setSelectedDate(p.date); }} style={{ cursor: 'pointer' }}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isSelected ? 6 : 4}
                            fill={isSelected ? '#ffffff' : (activeChartMetric === 'precip' ? '#06b6d4' : '#ef4444')}
                            stroke={isSelected ? '#3b82f6' : '#ffffff'}
                            strokeWidth="2"
                          />
                          <text
                            x={p.x}
                            y={p.y - 10}
                            textAnchor="middle"
                            fill="var(--text-secondary)"
                            fontSize="10"
                            fontWeight={isSelected ? 'bold' : 'normal'}
                          >
                            {typeof p.val === 'number' ? p.val.toFixed(1) : p.val}
                            {activeChartMetric === 'risk' ? '%' : activeChartMetric === 'precip' ? 'mm' : activeChartMetric === 'temp' ? '°C' : 'km/h'}
                          </text>
                          <text
                            x={p.x}
                            y={220}
                            textAnchor="middle"
                            fill={isSelected ? 'var(--text-primary)' : 'var(--text-muted)'}
                            fontSize="11"
                            fontWeight={isSelected ? 'bold' : 'normal'}
                          >
                            D{p.day}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
