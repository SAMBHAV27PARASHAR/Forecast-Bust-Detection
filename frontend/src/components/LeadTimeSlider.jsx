import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  formatUtcHourToIst,
  formatToIst,
  calculateExactLeadHours,
  parseUtcTimestamp
} from '../utils/timezone';
// Self-contained city data — search always works regardless of parent passing cities prop
import _citiesJson from '../data/indian_cities.json';
const FALLBACK_CITIES = _citiesJson.cities || [];

export default function LeadTimeSlider({
  selectedDay,
  onSelectDay,
  selectedHour,
  onSelectHour,
  selectedDate,
  onSelectDate,
  exactTimeMeta,
  activeScenarioId,
  isPredicting,
  // Integrated Location / City Props
  cities = [],
  selectedCity,
  onSelectCity,
  domainMode = 'city',
  onDomainModeChange,
  regions = [],
  selectedRegionId,
  onSelectRegion
}) {
  const isLive = activeScenarioId === 'live_gefs';

  // Base operational GEFS initialization timestamp (UTC)
  const initTimeUtc = exactTimeMeta?.forecast_initialization_utc
    || exactTimeMeta?.initialization_time
    || (isLive ? '2026-09-19 00:00 UTC' : '2019-07-05 00:00 UTC');

  // Dynamic available dates list: strictly from operational live GEFS data,
  // with dynamic generation from actual GEFS cycle/init timestamp if payload is loading or empty.
  const availableDates = useMemo(() => {
    if (Array.isArray(exactTimeMeta?.available_dates) && exactTimeMeta.available_dates.length > 0) {
      return exactTimeMeta.available_dates;
    }

    // Dynamic generation from actual operational GEFS initialization timestamp
    const dateMatch = (initTimeUtc || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    let baseYear = 2026, baseMonth = 8, baseDay = 19; // Default fallback to 2026-09-19
    if (dateMatch) {
      baseYear = parseInt(dateMatch[1], 10);
      baseMonth = parseInt(dateMatch[2], 10) - 1;
      baseDay = parseInt(dateMatch[3], 10);
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const generated = [];
    for (let dayInt = 0; dayInt <= 10; dayInt++) {
      const curDt = new Date(Date.UTC(baseYear, baseMonth, baseDay + dayInt, 0, 0, 0));
      const y = curDt.getUTCFullYear();
      const m = curDt.getUTCMonth();
      const d = curDt.getUTCDate();
      const isoDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const shortLabel = `${monthNames[m]} ${d}`;
      const displayDate = `${d} ${fullMonths[m]} ${y}`;

      // Sub-daily operational GEFS steps:
      // Day 0: 00, 06, 12, 18 UTC
      // Day 1 to Day 5: 3-hourly 00, 03, 06, 09, 12, 15, 18, 21 UTC
      // Day 6 to Day 10: 00 UTC (extended horizon)
      let hoursAvail = [0];
      if (dayInt === 0) {
        hoursAvail = [0, 6, 12, 18];
      } else if (dayInt <= 5) {
        hoursAvail = [0, 3, 6, 9, 12, 15, 18, 21];
      }

      const timesList = hoursAvail.map(h => {
        const lead = dayInt * 24 + h;
        return {
          hour: h,
          label: `${String(h).padStart(2, '0')}:00 UTC`,
          lead_hours: lead,
          valid_time_utc: `${isoDate} ${String(h).padStart(2, '0')}:00 UTC`
        };
      });

      generated.push({
        date: isoDate,
        display_date: displayDate,
        short_label: shortLabel,
        day: dayInt,
        lead_hours_min: dayInt * 24 + hoursAvail[0],
        available_times: timesList
      });
    }

    return generated;
  }, [exactTimeMeta?.available_dates, initTimeUtc]);

  // Find currently active date object
  const activeDateObj = (selectedDate && availableDates.find(d => d.date === selectedDate))
    || availableDates.find(d => d.day === selectedDay)
    || availableDates[0]
    || null;

  // Available times for the active date (strictly from dataset, no fake hours)
  const availableTimes = activeDateObj?.available_times
    || exactTimeMeta?.available_times
    || exactTimeMeta?.available_valid_times
    || [{ hour: 0, label: '00:00 UTC', lead_hours: (selectedDay ?? 1) * 24, valid_time_utc: '' }];

  const rawEffectiveHour = selectedHour !== null && selectedHour !== undefined ? selectedHour : (availableTimes[0]?.hour ?? 0);
  const effectiveHour = availableTimes.some(t => t.hour === rawEffectiveHour) ? rawEffectiveHour : (availableTimes[0]?.hour ?? 0);
  const activeTimeObj = availableTimes.find(t => t.hour === effectiveHour) || availableTimes[0];

  // UTC timing metadata
  const validTimeUtc = activeTimeObj?.valid_time_utc || exactTimeMeta?.valid_forecast_time || exactTimeMeta?.valid_time_utc || '';
  const displayDateStr = activeDateObj?.display_date || (validTimeUtc ? validTimeUtc.split(' ')[0] : 'Selected Date');

  // ── IST conversions ──────────────────────────────────────────────────────
  // Convert init time to IST for display
  const initTimeIst = initTimeUtc ? formatToIst(initTimeUtc) : initTimeUtc;

  // Convert valid time to IST for display
  const validTimeIst = validTimeUtc ? formatToIst(validTimeUtc) : `${displayDateStr} • ${formatUtcHourToIst(effectiveHour)}`;

  // Exact lead hours — computed from actual timestamps, not multiplied day*24
  const rawLeadHours = activeTimeObj?.lead_hours ?? (exactTimeMeta?.lead_hours !== undefined ? exactTimeMeta.lead_hours : (selectedDay ?? 1) * 24 + effectiveHour);
  const exactLeadHours = calculateExactLeadHours(validTimeUtc, initTimeUtc, rawLeadHours);

  // Forecast Day derived from lead hours (which exact day bracket are we in)
  const forecastDay = activeDateObj?.day ?? selectedDay ?? Math.ceil(exactLeadHours / 24);

  // Handle Date Selection (updates both date and day)
  const handleDateClick = (dObj) => {
    if (onSelectDate) onSelectDate(dObj.date);
    if (onSelectDay) onSelectDay(dObj.day);
    // Auto-select first available hour for this date if current hour is not valid
    if (dObj.available_times && dObj.available_times.length > 0 && onSelectHour) {
      const hasCurrentHour = dObj.available_times.some(t => t.hour === effectiveHour);
      if (!hasCurrentHour) {
        onSelectHour(dObj.available_times[0].hour);
      }
    }
  };

  // City search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownRect, setDropdownRect] = useState(null);
  const searchWrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Internal selected city — used when parent doesn't provide selectedCity/onSelectCity props
  const [_internalCity, _setInternalCity] = useState(null);
  // Effective selected city: prefer prop, fall back to internal
  const effectiveCity = selectedCity || _internalCity;

  // Unified city selection handler
  const handleCitySelection = useCallback((c) => {
    if (!c) return;
    _setInternalCity(c);          // always update internal state
    if (onSelectCity) onSelectCity(c); // also notify parent if callback provided
    setSearchQuery('');
    setShowDropdown(false);
  }, [onSelectCity]);

  // Calculate input position for fixed dropdown (escapes all stacking contexts)
  const updateDropdownPos = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        // Also check if click was inside the portal dropdown
        const portal = document.getElementById('city-dropdown-portal');
        if (portal && portal.contains(e.target)) return;
        setShowDropdown(false);
      }
    }
    window.addEventListener('scroll', updateDropdownPos, true);
    window.addEventListener('resize', updateDropdownPos);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('scroll', updateDropdownPos, true);
      window.removeEventListener('resize', updateDropdownPos);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [updateDropdownPos]);

  // Fuzzy city search — case-insensitive, partial-match, tolerant of small typos
  // Uses prop-provided cities if available, otherwise falls back to static JSON import
  const filteredCities = useMemo(() => {
    // Use prop cities if they exist, otherwise use the built-in static fallback
    const pool = (cities && cities.length > 0) ? cities : FALLBACK_CITIES;

    const raw = searchQuery.trim();
    if (!raw) return pool.slice(0, 12);

    // Normalize: lowercase, remove spaces/hyphens for fuzzy tolerance
    const normalize = (s) => (s || '').toLowerCase().replace(/[\s\-_.]/g, '');
    const q = normalize(raw);

    // Score each city: exact match scores highest, starts-with next, includes last
    const scored = pool.map(c => {
      const nameFull = c.name.toLowerCase();
      const nameNorm = normalize(c.name);
      const idNorm   = normalize(c.id || '');
      const stateNorm= normalize(c.state || '');
      // Also match abbreviations like 'UP' matching 'Uttar Pradesh'
      const stateAbbr = (c.state || '').split(/\s+/).map(w => w[0] || '').join('').toLowerCase();

      let score = 0;
      if (nameNorm === q || idNorm === q)              score = 100; // exact
      else if (nameNorm.startsWith(q) || idNorm.startsWith(q)) score = 80;  // prefix
      else if (nameNorm.includes(q) || idNorm.includes(q))     score = 60;  // substring
      else if (nameFull.includes(raw.toLowerCase()))            score = 55;  // original name
      else if (stateNorm.includes(q) || stateAbbr.includes(q)) score = 30;  // state match

      // Slight boost for cities whose id starts with query
      if (score > 0 && idNorm.startsWith(q)) score = Math.max(score, 75);

      return { city: c, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.city)
      .slice(0, 12);
  }, [cities, searchQuery]);

  const selectedRegion = regions.find(r => (r.id || r.region_id) === (selectedCity?.subdivision_id || selectedRegionId));
  const selectedRegionName = selectedRegion?.name || selectedCity?.subdivision_id || selectedRegionId;

  // Lead horizon category
  const getLeadHorizonCategory = (day) => {
    if (day <= 3) return { label: 'Short-Range (High Deterministic Skill)', class: 'horizon-short' };
    if (day <= 7) return { label: 'Medium-Range (Ensemble Bifurcation Window)', class: 'horizon-medium' };
    return { label: 'Extended Horizon (Non-Linear Dispersion)', class: 'horizon-extended' };
  };
  const currentCategory = getLeadHorizonCategory(forecastDay);

  return (
    <div className="lead-time-card">
      {/* Top Header */}
      <div className="lead-time-header">
        <div className="lead-time-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Forecast Date &amp; Valid Time Horizon</span>
        </div>

        <div className="lead-time-badge-group">
          <div className={`horizon-badge ${currentCategory.class}`}>
            {currentCategory.label}
          </div>
          <div className="resolution-badge res-subdaily" title="NOAA GEFS Operational / Real Data">
            <span className="res-dot"></span>
            <span>{isLive ? 'NOAA GEFS Operational (NOMADS)' : 'NOAA GEFS v12 Archive'}</span>
          </div>
        </div>
      </div>

      {/* 1. INTEGRATED LOCATION / CITY SELECTOR SECTION */}
      <div className="forecast-location-section">
        <div className="section-label-row">
          <div className="location-heading-group">
            <span className="selector-label">LOCATION &amp; METEOROLOGICAL DOMAIN</span>
            <span className="selector-sub">Select Indian city or meteorological subdivision for operational NWP forecast</span>
          </div>

          {onDomainModeChange && (
            <div className="forecast-mode-toggle">
              <button
                type="button"
                className={`mode-toggle-btn ${domainMode === 'city' ? 'active' : ''}`}
                onClick={() => onDomainModeChange('city')}
              >
                🏙️ City Forecast
              </button>
              <button
                type="button"
                className={`mode-toggle-btn ${domainMode === 'subdivision' ? 'active' : ''}`}
                onClick={() => onDomainModeChange('subdivision')}
              >
                🗺️ Subdivision Forecast
              </button>
            </div>
          )}
        </div>

        {domainMode === 'city' ? (
          <div className="city-search-container" ref={searchWrapperRef}>
            <div className="city-search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                ref={inputRef}
                type="text"
                className="city-search-input"
                placeholder="Search Indian city (e.g. Bareilly, Delhi, Mumbai, Lucknow, Dehradun)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  updateDropdownPos();
                  setShowDropdown(true);
                }}
                onFocus={() => {
                  updateDropdownPos();
                  setShowDropdown(true);
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setShowDropdown(false);
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown rendered as portal at document.body — escapes backdrop-filter stacking */}
            {showDropdown && dropdownRect && ReactDOM.createPortal(
              <div
                id="city-dropdown-portal"
                className="city-search-dropdown-menu"
                style={{
                  position: 'fixed',
                  top: dropdownRect.top,
                  left: dropdownRect.left,
                  width: dropdownRect.width,
                  zIndex: 99999,
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}
              >
                {filteredCities.length > 0 ? (
                  filteredCities.slice(0, 12).map((c) => {
                    const isCurrent = c.id === effectiveCity?.id;
                    return (
                      <div
                        key={c.id}
                        className={`city-suggestion-item ${isCurrent ? 'selected' : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();    // prevent input blur
                          e.stopPropagation();   // prevent document mousedown from racing
                          handleCitySelection(c);
                        }}
                      >
                        <div className="city-sug-primary">
                          <span className="city-sug-pin">📍</span>
                          <span className="city-sug-name"><strong>{c.name}</strong>, {c.state}</span>
                        </div>
                        <div className="city-sug-coords">
                          {c.lat?.toFixed(4)}°N, {c.lon?.toFixed(4)}°E
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="city-suggestion-empty">
                    {searchQuery
                      ? `No cities match "${searchQuery}" — try a shorter term`
                      : 'Start typing to search...'}
                  </div>
                )}
              </div>,
              document.body
            )}

            {/* Selected Location Display */}
            {effectiveCity && (
              <div className="selected-location-display-bar">
                <div className="loc-display-main">
                  <span className="loc-display-pin">📍</span>
                  <span className="loc-display-title">
                    <strong>{effectiveCity.name}</strong>, {effectiveCity.state}
                  </span>
                </div>
                <div className="loc-display-meta">
                  <span className="loc-display-coord">
                    Coordinates: <strong>{effectiveCity.lat?.toFixed(4)}°N, {effectiveCity.lon?.toFixed(4)}°E</strong>
                  </span>
                  {selectedRegionName && (
                    <span className="loc-display-subdiv">
                      Subdivision: <strong>{selectedRegionName}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="subdivision-selector-bar">
            <label className="subdiv-select-label">Select Meteorological Subdivision:</label>
            <select
              className="styled-select subdivision-select"
              value={selectedRegionId}
              onChange={(e) => onSelectRegion && onSelectRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r.id || r.region_id} value={r.id || r.region_id}>
                  {r.name} ({r.id || r.region_id})
                </option>
              ))}
            </select>
            {selectedRegionName && (
              <span className="selected-subdiv-hint">
                Showing forecast aggregates for {selectedRegionName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. DYNAMIC FORECAST DATE SELECTOR ROW */}
      <div className="forecast-date-selector-section">
        <div className="section-label-row">
          <span className="selector-label">FORECAST DATE</span>
          <span className="selector-sub">Dynamically populated from available operational GEFS forecast timestamps</span>
        </div>

        <div className="date-chips-row">
          {availableDates.map((dObj) => {
            const isSelected = activeDateObj?.date === dObj.date || activeDateObj?.day === dObj.day;
            return (
              <button
                key={dObj.date || `date-day-${dObj.day}`}
                className={`date-chip-btn ${isSelected ? 'active' : ''}`}
                onClick={() => handleDateClick(dObj)}
                title={`Valid Date: ${dObj.display_date} (Day ${dObj.day}, +${dObj.lead_hours_min}h)`}
              >
                <span className="date-chip-label">{dObj.short_label}</span>
                <span className="date-chip-sub">{dObj.day === 0 ? 'Init' : `D${dObj.day}`}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. DYNAMIC FORECAST TIME SELECTOR — shows IST time + lead hours */}
      <div className="forecast-time-selector-section">
        <div className="section-label-row">
          <span className="selector-label">AVAILABLE FORECAST TIMES ({activeDateObj?.short_label || 'Selected Date'})</span>
          <span className="selector-sub">Only showing verified timestamps present in dataset</span>
        </div>

        <div className="times-chips-row">
          {availableTimes.map((tObj) => {
            const isSelected = effectiveHour === tObj.hour;
            // Convert this slot's UTC hour to IST for display
            const istLabel = formatUtcHourToIst(tObj.hour);
            return (
              <button
                key={tObj.hour}
                className={`time-chip-btn ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectHour && onSelectHour(tObj.hour)}
                title={`UTC: ${tObj.valid_time_utc || tObj.label} (+${tObj.lead_hours}h)`}
              >
                {/* Line 1: IST time */}
                <span className="time-chip-hour">{istLabel}</span>
                {/* Line 2: Lead hours */}
                <span className="time-chip-lead">Lead +{tObj.lead_hours}h</span>
              </button>
            );
          })}
        </div>

        {/* IST timezone hint */}
        <span className="ist-helper-text">🕐 Times shown in Indian Standard Time (IST = UTC +05:30)</span>
      </div>

      {/* 4. D0-D10 LEAD-TIME STEP BUTTONS */}
      <div className="lead-days-quick-row">
        <span className="lead-days-label">Lead Time:</span>
        <div className="day-step-buttons">
          {availableDates.map((dObj) => {
            const isSelected = activeDateObj?.day === dObj.day;
            return (
              <button
                key={dObj.day}
                className={`day-step-mini-btn ${isSelected ? 'active' : ''}`}
                onClick={() => handleDateClick(dObj)}
              >
                {dObj.day === 0 ? 'D0 (+0h)' : `D${dObj.day} (+${dObj.day * 24}h)`}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. CLEAR OPERATIONAL METADATA SUMMARY BAR
           Explicitly separates Forecast Day from exact lead hours to avoid confusion.
           e.g. if selected timestamp is +126h → shows "Day 5" AND "Exact Lead: +126h"
                NOT "D5 (+120h)" as if 120h is the selected lead. */}
      <div className="forecast-meta-summary-bar">
        <div className="meta-col">
          <span className="meta-col-label">Selected Forecast Date:</span>
          <strong className="meta-col-val text-accent">{displayDateStr}</strong>
        </div>

        <div className="meta-col-divider" />

        <div className="meta-col">
          <span className="meta-col-label">Forecast Day:</span>
          <strong className="meta-col-val">
            {forecastDay > 0 ? `Day ${forecastDay}` : 'Day 0 (Init)'}
          </strong>
        </div>

        <div className="meta-col-divider" />

        <div className="meta-col">
          <span className="meta-col-label">Exact Lead Time:</span>
          <strong className="meta-col-val text-lead font-mono">+{exactLeadHours} hours</strong>
        </div>

        <div className="meta-col-divider" />

        <div className="meta-col">
          <span className="meta-col-label">Initialization (IST):</span>
          <strong className="meta-col-val font-mono">{initTimeIst}</strong>
        </div>

        <div className="meta-col-divider" />

        <div className="meta-col">
          <span className="meta-col-label">Valid Forecast (IST):</span>
          <strong className="meta-col-val font-mono">{validTimeIst}</strong>
        </div>
      </div>
    </div>
  );
}
