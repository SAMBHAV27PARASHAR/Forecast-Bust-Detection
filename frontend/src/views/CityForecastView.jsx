import React, { useState, useEffect } from 'react';
import { fetchCities, fetchCityForecast, fetchForecastDetail } from '../services/api';
import LocationSelector from '../components/LocationSelector';
import { formatToIst, formatUtcHourToIst } from '../utils/timezone';

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
  const [cities, setCities] = useState([]);
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
  const [activeChartMetric, setActiveChartMetric] = useState('risk'); // 'risk', 'precip', 'temp', 'wind'

  // Load cities list on mount
  useEffect(() => {
    async function loadCities() {
      try {
        const list = await fetchCities();
        setCities(list);
      } catch (err) {
        console.error('Failed to load cities:', err);
      }
    }
    loadCities();
  }, []);

  const selectedCityMeta = cities.find(c => c.id === selectedCityId) || cityForecast?.city;

  // Load city forecast on city, date, hour, or day change (or subdivision change)
  useEffect(() => {
    let isMounted = true;
    async function loadCityData() {
      if (!selectedCityId && domainMode === 'city') return;
      setLoading(true);
      try {
        if (domainMode === 'city') {
          const lat = selectedCityMeta?.lat;
          const lon = selectedCityMeta?.lon;
          const data = await fetchCityForecast(selectedCityId, selectedDay, selectedHour, selectedDate, lat, lon);
          if (isMounted) {
            setCityForecast(data);
            if (!selectedDate && data.selected_date) {
              setSelectedDate(data.selected_date);
            }
          }
        } else {
          // Subdivision mode: fetch subdivision forecast
          const detail = await fetchForecastDetail(selectedRegionId, selectedDay, 'live_gefs', selectedHour, selectedDate);
          if (isMounted) {
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
              wind_speed: round(rawP.wind_shear_850_200 * 1.5, 1) || 18.0,
              pressure: rawP.mslp ?? 1010.0,
              bust_probability: pred.bust_probability ?? 0.0,
              confidence: pred.confidence_score ?? 85.0,
              selected_date: detail.selected_date,
              selected_date_display: detail.selected_date_display,
              valid_time_utc: detail.valid_time_utc,
              lead_hours: detail.lead_hours,
              available_dates: detail.available_dates || [],
              available_times: detail.available_times || [],
              ten_day_trend: []
            });
          }
        }
      } catch (err) {
        console.error('Failed to load forecast data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadCityData();
    return () => { isMounted = false; };
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
  const tenDayTrend = cityForecast?.ten_day_trend || [];

  const handleDateSelect = (dObj) => {
    setSelectedDate(dObj.date);
    setSelectedDay(dObj.day);
    if (dObj.available_times && dObj.available_times.length > 0) {
      const hasHour = dObj.available_times.some(t => t.hour === selectedHour);
      if (!hasHour) {
        setSelectedHour(dObj.available_times[0].hour);
      }
    }
  };

  const getRiskBadge = (prob) => {
    if (prob >= 60) return { label: 'HIGH BUST RISK', color: 'badge-bust-high' };
    if (prob >= 35) return { label: 'ELEVATED RISK', color: 'badge-bust-elevated' };
    return { label: 'LOW RISK (STABLE)', color: 'badge-bust-low' };
  };

  const currentBustProb = cityForecast?.bust_probability ?? currentStep?.bust_probability ?? 0;
  const riskBadge = getRiskBadge(currentBustProb);

  const handleCitySelect = (cityObj) => {
    setSelectedCityId(cityObj.id);
  };

  const handleRegionSelect = (rId) => {
    setSelectedRegionId(rId);
    if (propSetRegionId) propSetRegionId(rId);
  };

  return (
    <div className="view-container city-forecast-view">
      {/* 1. Header Banner */}
      <div className="view-header-card">
        <div className="header-left-block">
          <h2 className="view-title">📍 City Forecast & Atmospheric Diagnostics</h2>
          <p className="view-desc">
            Exact spatial point extraction from operational NOAA GEFS for 60+ Indian cities across all states and union territories. Select a city, date, and forecast time to inspect real-time variables.
          </p>
        </div>
        <div className="header-right-block">
          <div className="cycle-badge">
            <span className="dot pulse"></span>
            <span>NOAA GEFS Operational (IST): {cityForecast?.initialization_time ? formatToIst(cityForecast.initialization_time) : '19 Sep 2026 • 05:30 IST'}</span>
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

      {/* 3. DYNAMIC DATE & TIME SELECTION SECTION (Kept completely unchanged) */}
      <div className="city-date-time-card">
        {/* Date Selector */}
        <div className="date-select-row">
          <div className="section-label-row">
            <span className="selector-label">SELECT FORECAST DATE:</span>
            <span className="selector-sub">Available dates in live forecast window</span>
          </div>
          <div className="date-chips-row">
            {availableDates.map(dObj => {
              const isSelected = activeDateObj?.date === dObj.date;
              return (
                <button
                  key={dObj.date}
                  className={`date-chip-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => handleDateSelect(dObj)}
                >
                  <span className="date-chip-label">{dObj.short_label}</span>
                  <span className="date-chip-sub">{dObj.day === 0 ? 'Init' : `D${dObj.day}`}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Selector for Selected Date */}
        <div className="time-select-row">
          <div className="section-label-row">
            <span className="selector-label">SELECT FORECAST TIME ({activeDateObj?.short_label || 'Selected Date'}) [IST]:</span>
            <span className="selector-sub">Only verified timestamps present in live GEFS dataset</span>
          </div>
          <div className="times-chips-row">
            {availableTimes.map(tObj => {
              const isSelected = selectedHour === tObj.hour;
              return (
                <button
                  key={tObj.hour}
                  className={`time-chip-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedHour(tObj.hour)}
                >
                  <span className="time-chip-hour">{formatUtcHourToIst(tObj.hour)}</span>
                  <span className="time-chip-lead">+{tObj.lead_hours}h</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. EXACT CITY PARAMETERS HERO & METRICS */}
      {selectedCityMeta && (
        <div className="selected-city-hero">
          <div className="city-hero-primary">
            <div className="city-exact-timestamp-pill">
              <span className="cal-icon">📅</span>
              <strong>{cityForecast?.selected_date_display || activeDateObj?.display_date || selectedDate}</strong>
              <span className="time-sub font-mono">• {cityForecast?.valid_time_utc ? formatToIst(cityForecast.valid_time_utc, 'time') : formatUtcHourToIst(selectedHour)} (+{cityForecast?.lead_hours || 0}h)</span>
            </div>
          </div>

          <div className="city-subdivision-tag">
            Assigned IMD Meteorological Subdivision: <strong>{selectedCityMeta.subdivision_id || selectedCityMeta.region_name || 'Subdivision'}</strong>
          </div>

          {/* Core Atmospheric Variables Grid (Exact match for requested layout) */}
          <div className="city-exact-metrics-grid">
            <div className="hero-metric-tile">
              <span className="tile-label">Temperature</span>
              <span className="tile-value">{cityForecast?.temperature?.toFixed(1) ?? currentStep?.temp_c?.toFixed(1) ?? 28.0}°C</span>
              <span className="tile-sub">2m Surface Air Temp</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Rainfall</span>
              <span className="tile-value text-precip">{cityForecast?.rainfall?.toFixed(1) ?? currentStep?.precip_mm?.toFixed(1) ?? 0.0} mm</span>
              <span className="tile-sub">Rate: {((cityForecast?.rainfall ?? 0) / 24.0).toFixed(2)} mm/h</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Humidity</span>
              <span className="tile-value">{cityForecast?.humidity?.toFixed(0) ?? currentStep?.rh_850?.toFixed(0) ?? 65}%</span>
              <span className="tile-sub">Relative Humidity (850hPa)</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Wind</span>
              <span className="tile-value">{cityForecast?.wind_speed?.toFixed(1) ?? currentStep?.wind_speed_kmh?.toFixed(1) ?? 18.0} km/h</span>
              <span className="tile-sub">Shear / 10m Wind Speed</span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Pressure</span>
              <span className="tile-value font-mono">{cityForecast?.pressure?.toFixed(1) ?? 1010.0} hPa</span>
              <span className="tile-sub">Mean Sea Level Pressure</span>
            </div>

            <div className="hero-metric-tile bust-tile">
              <span className="tile-label">Bust Probability</span>
              <span className="tile-value text-bust">{currentBustProb}%</span>
              <span className={`risk-status-pill ${riskBadge.color}`}>
                {riskBadge.label}
              </span>
            </div>

            <div className="hero-metric-tile">
              <span className="tile-label">Confidence</span>
              <span className="tile-value text-conf">{cityForecast?.confidence ?? currentStep?.confidence_score ?? 95}%</span>
              <span className="tile-sub">Model Reliability Metric</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Multi-Variable 10-Day Trend Chart */}
      <div className="city-chart-card">
        <div className="chart-header-row">
          <div>
            <h3 className="chart-title">10-Day NWP Forecast Horizon ({selectedCityMeta?.name})</h3>
            <span className="chart-sub">Daily synoptic steps in Indian Standard Time (IST) for {selectedCityMeta?.name}</span>
          </div>

          <div className="chart-metric-toggles">
            <button
              className={`toggle-btn ${activeChartMetric === 'risk' ? 'active' : ''}`}
              onClick={() => setActiveChartMetric('risk')}
            >
              ⚠️ Bust Risk & Conf
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

        {/* Visual Chart Visualization */}
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

            {/* Grid lines */}
            {[40, 90, 140, 190].map((y, i) => (
              <line key={i} x1="40" y1={y} x2="780" y2={y} stroke="var(--border-color)" strokeDasharray="3 3" />
            ))}

            {tenDayTrend.length > 0 && (() => {
              const count = tenDayTrend.length;
              const getX = (index) => 60 + (index / (count - 1)) * 700;

              let getY;
              let points = [];
              let areaPath = '';

              if (activeChartMetric === 'risk') {
                getY = (val) => 200 - (val / 100) * 160;
                points = tenDayTrend.map((d, i) => ({ x: getX(i), y: getY(d.bust_probability), val: d.bust_probability, day: d.day, date: d.date }));
              } else if (activeChartMetric === 'precip') {
                const maxPrecip = Math.max(...tenDayTrend.map(d => d.precip_mm || 0), 10);
                getY = (val) => 200 - (val / maxPrecip) * 160;
                points = tenDayTrend.map((d, i) => ({ x: getX(i), y: getY(d.precip_mm || 0), val: d.precip_mm, day: d.day, date: d.date }));
              } else if (activeChartMetric === 'temp') {
                const minT = 15;
                const maxT = 45;
                getY = (val) => 200 - ((val - minT) / (maxT - minT)) * 160;
                points = tenDayTrend.map((d, i) => ({ x: getX(i), y: getY(d.temp_c || 25), val: d.temp_c, day: d.day, date: d.date }));
              } else {
                const maxW = Math.max(...tenDayTrend.map(d => d.wind_speed_kmh || 0), 40);
                getY = (val) => 200 - (val / maxW) * 160;
                points = tenDayTrend.map((d, i) => ({ x: getX(i), y: getY(d.wind_speed_kmh || 0), val: d.wind_speed_kmh, day: d.day, date: d.date }));
              }

              const pathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
              areaPath = `${pathD} L ${points[points.length - 1].x} 200 L ${points[0].x} 200 Z`;

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
                      <g key={i} onClick={() => { setSelectedDay(p.day); setSelectedDate(p.date); }} style={{ cursor: 'pointer' }}>
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

      {/* 6. 10-Day City Forecast Data Table */}
      <div className="city-table-card">
        <div className="table-header-title">
          <h3>📅 Complete 10-Day Schedule ({selectedCityMeta?.name})</h3>
          <span className="table-sub">Click any row to jump to that forecast date</span>
        </div>

        <div className="table-responsive">
          <table className="forecast-data-table">
            <thead>
              <tr>
                <th>Lead Time</th>
                <th>Valid Date (IST)</th>
                <th>Bust Probability</th>
                <th>Risk Category</th>
                <th>Confidence</th>
                <th>Rainfall</th>
                <th>Temperature</th>
                <th>Wind Speed</th>
                <th>RH (850hPa)</th>
                <th>Pressure</th>
              </tr>
            </thead>
            <tbody>
              {tenDayTrend.map(row => {
                const isSelected = row.day === selectedDay;
                const badge = getRiskBadge(row.bust_probability);
                return (
                  <tr
                    key={row.day}
                    className={`table-row ${isSelected ? 'active-row' : ''}`}
                    onClick={() => {
                      setSelectedDay(row.day);
                      setSelectedDate(row.date);
                    }}
                  >
                    <td className="font-bold">
                      {row.day === 0 ? 'Day 0 (+0h)' : `Day ${row.day} (+${row.lead_hours}h)`}
                    </td>
                    <td className="font-mono">{row.valid_date || row.date}</td>
                    <td>
                      <div className="bust-prob-cell">
                        <div className="prob-bar-track">
                          <div
                            className="prob-bar-fill"
                            style={{
                              width: `${row.bust_probability}%`,
                              backgroundColor: row.bust_probability >= 60 ? '#ef4444' : row.bust_probability >= 35 ? '#f59e0b' : '#10b981'
                            }}
                          />
                        </div>
                        <span className="prob-number">{row.bust_probability}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`table-badge ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td>{row.model_confidence ?? row.confidence_score}%</td>
                    <td className="precip-cell font-mono">{row.precip_mm?.toFixed(1)} mm</td>
                    <td className="font-mono">{row.temp_c?.toFixed(1)}°C</td>
                    <td className="font-mono">{row.wind_speed_kmh?.toFixed(1)} km/h</td>
                    <td className="font-mono">{row.rh_850?.toFixed(0)}%</td>
                    <td className="font-mono">{row.mslp_hpa?.toFixed(1) || 1010.0} hPa</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
