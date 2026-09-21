import React, { useState, useEffect, useRef } from 'react';

// Complete list of Indian States and Union Territories
export const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

export default function LocationSelector({
  mode = 'city', // 'subdivision' | 'city'
  onModeChange,
  cities = [],
  selectedCityId = 'bareilly',
  onSelectCity,
  regions = [],
  selectedRegionId = 'IND-UP-BIH',
  onSelectRegion
}) {
  // Mode state if uncontrolled
  const [internalMode, setInternalMode] = useState(mode);
  const currentMode = onModeChange ? mode : internalMode;

  const handleModeToggle = (newMode) => {
    if (onModeChange) {
      onModeChange(newMode);
    } else {
      setInternalMode(newMode);
    }
  };

  // Find currently selected city - do NOT silently fallback to cities[0] or Bareilly if an unknown city is provided
  const selectedCity = cities.find(c => 
    c.id === selectedCityId || 
    (c.name && c.name.toLowerCase() === (selectedCityId || '').toLowerCase()) ||
    (c.id && c.id.replace(/-/g, '') === (selectedCityId || '').replace(/-/g, ''))
  ) || null;

  // State selection: defaults to selected city's state or first available
  const [selectedState, setSelectedState] = useState(selectedCity?.state || (cities[0]?.state || 'Uttar Pradesh'));
  const [searchQuery, setSearchQuery] = useState('');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Sync state when selectedCityId changes externally
  useEffect(() => {
    if (selectedCity && selectedCity.state) {
      setSelectedState(selectedCity.state);
    }
  }, [selectedCityId, selectedCity]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsCityDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter cities by selected state
  const citiesInState = cities.filter(c => {
    const cState = (c.state || '').toLowerCase();
    const selState = (selectedState || '').toLowerCase();
    if (selState === 'delhi' && (cState.includes('delhi') || cState.includes('ncr'))) return true;
    if (selState.includes('punjab') && cState.includes('punjab')) return true;
    if (selState.includes('haryana') && cState.includes('haryana')) return true;
    return cState === selState;
  });

  // Filter cities: If user is actively typing a query, search all cities across all Indian states
  const isSearching = searchQuery.trim().length > 0;
  const searchableCities = isSearching
    ? cities.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.state && c.state.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : citiesInState;

  // Handle state change: automatically pick the first city of that state if available
  const handleStateChange = (e) => {
    const newState = e.target.value;
    setSelectedState(newState);
    setSearchQuery('');

    // Find cities in new state
    const matches = cities.filter(c => {
      const cState = (c.state || '').toLowerCase();
      const selState = newState.toLowerCase();
      if (selState === 'delhi' && (cState.includes('delhi') || cState.includes('ncr'))) return true;
      if (selState.includes('punjab') && cState.includes('punjab')) return true;
      if (selState.includes('haryana') && cState.includes('haryana')) return true;
      return cState === selState;
    });

    if (matches.length > 0 && onSelectCity) {
      onSelectCity(matches[0]);
    }
  };

  // Handle city selection
  const handleCitySelect = (city) => {
    if (city.state) {
      setSelectedState(city.state);
    }
    setIsCityDropdownOpen(false);
    setSearchQuery('');
    if (onSelectCity) {
      onSelectCity(city);
    }
  };

  // Find currently selected subdivision
  const selectedRegion = regions.find(r => (r.region_id || r.id) === selectedRegionId) || regions[0] || {
    id: 'IND-UP-BIH',
    name: 'Middle Gangetic Plains',
    states: 'Eastern UP, Bihar',
    centroid: [26.0, 84.0]
  };

  const handleSubdivisionChange = (e) => {
    const rId = e.target.value;
    if (onSelectRegion) {
      onSelectRegion(rId);
    }
  };

  return (
    <div className="location-selector-card">
      <div className="location-selector-top-row">
        <div className="selector-title-block">
          <span className="location-pin-icon">🌐</span>
          <div>
            <h3 className="location-selector-heading">Operational Forecast Domain</h3>
            <p className="location-selector-subtitle">
              Select target spatial resolution: IMD Meteorological Subdivision or Exact City Coordinates
            </p>
          </div>
        </div>

        {/* 1. Mode Switch: [Subdivision] [City] */}
        <div className="location-mode-switch" role="group" aria-label="Forecast Domain Mode Switch">
          <button
            type="button"
            className={`mode-switch-btn ${currentMode === 'subdivision' ? 'active' : ''}`}
            onClick={() => handleModeToggle('subdivision')}
            id="btn-mode-subdivision"
          >
            <span className="mode-icon">🗺️</span>
            <span>Subdivision</span>
          </button>
          <button
            type="button"
            className={`mode-switch-btn ${currentMode === 'city' ? 'active' : ''}`}
            onClick={() => handleModeToggle('city')}
            id="btn-mode-city"
          >
            <span className="mode-icon">🏙️</span>
            <span>City</span>
          </button>
        </div>
      </div>

      {/* 2. Controls Row */}
      <div className="location-controls-row">
        {currentMode === 'city' ? (
          <>
            {/* State Dropdown */}
            <div className="control-group state-control-group">
              <label htmlFor="state-select" className="control-label">
                STATE / UT:
              </label>
              <div className="select-wrapper">
                <select
                  id="state-select"
                  className="location-select"
                  value={selectedState}
                  onChange={handleStateChange}
                >
                  {INDIAN_STATES_AND_UTS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <span className="select-arrow">▼</span>
              </div>
            </div>

            {/* City Dropdown with Typeahead Search */}
            <div className="control-group city-control-group" ref={dropdownRef}>
              <label htmlFor="city-search-input" className="control-label">
                CITY / LOCATION:
              </label>
              <div className="typeahead-input-container">
                <input
                  id="city-search-input"
                  type="text"
                  className="location-typeahead-input"
                  placeholder={selectedCity ? `${selectedCity.name} (Type to search...)` : 'Search city...'}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsCityDropdownOpen(true);
                  }}
                  onFocus={() => setIsCityDropdownOpen(true)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="typeahead-toggle-btn"
                  onClick={() => setIsCityDropdownOpen(prev => !prev)}
                  title="Toggle City List"
                >
                  ▼
                </button>

                {/* Dropdown Menu */}
                {isCityDropdownOpen && (
                  <div className="typeahead-dropdown-menu">
                    <div className="dropdown-section-header">
                      {isSearching
                        ? `Search Results (${searchableCities.length})`
                        : citiesInState.length > 0
                        ? `Cities in ${selectedState} (${searchableCities.length})`
                        : `No cities listed for ${selectedState}`}
                    </div>

                    {searchableCities.length > 0 ? (
                      searchableCities.map((c) => {
                        const isSelected = c.id === selectedCity?.id;
                        return (
                          <div
                            key={c.id}
                            className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleCitySelect(c)}
                          >
                            <span className="item-name">
                              {c.name} {isSearching && c.state ? <small style={{ color: '#64748b', marginLeft: '6px' }}>({c.state})</small> : null}
                            </span>
                            <span className="item-coords">
                              {c.lat?.toFixed(2)}°N, {c.lon?.toFixed(2)}°E
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="dropdown-no-results">
                        No city matching "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Subdivision Dropdown */
          <div className="control-group subdivision-control-group">
            <label htmlFor="subdivision-select" className="control-label">
              METEOROLOGICAL SUBDIVISION (14 REGIONS):
            </label>
            <div className="select-wrapper">
              <select
                id="subdivision-select"
                className="location-select"
                value={selectedRegionId}
                onChange={handleSubdivisionChange}
              >
                {regions.map((r) => {
                  const rId = r.region_id || r.id;
                  return (
                    <option key={rId} value={rId}>
                      {r.name} ({r.zone || 'India'})
                    </option>
                  );
                })}
              </select>
              <span className="select-arrow">▼</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Clear Selected Location Display Banner (Requirement 6) */}
      <div className="selected-location-hero-card" id="selected-location-display">
        <div className="location-hero-badge">
          <span className="hero-status-dot pulse"></span>
          <span>{currentMode === 'city' ? 'POINT EXTRACTION' : 'SUBDIVISION AGGREGATE'}</span>
        </div>

        <div className="location-hero-content">
          <div className="location-hero-primary-text">
            <span className="hero-pin">📍</span>
            <span className="hero-name">
              {currentMode === 'city'
                ? `${selectedCity.name}, ${selectedCity.state}`
                : `${selectedRegion.name}`}
            </span>
          </div>

          <div className="location-coordinates-bar">
            {currentMode === 'city' ? (
              <>
                <div className="coord-chip">
                  <span className="coord-label">Latitude:</span>
                  <span className="coord-value font-mono">
                    {selectedCity.lat !== undefined ? `${selectedCity.lat.toFixed(4)}°N` : 'N/A'}
                  </span>
                </div>
                <div className="coord-chip">
                  <span className="coord-label">Longitude:</span>
                  <span className="coord-value font-mono">
                    {selectedCity.lon !== undefined ? `${selectedCity.lon.toFixed(4)}°E` : 'N/A'}
                  </span>
                </div>
                {selectedCity.subdivision_id && (
                  <div className="coord-chip sub-chip">
                    <span className="coord-label">Subdivision:</span>
                    <span className="coord-value">{selectedCity.subdivision_id}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="coord-chip">
                  <span className="coord-label">Latitude:</span>
                  <span className="coord-value font-mono">
                    {selectedRegion.centroid ? `${selectedRegion.centroid[0].toFixed(2)}°N` : 'N/A'}
                  </span>
                </div>
                <div className="coord-chip">
                  <span className="coord-label">Longitude:</span>
                  <span className="coord-value font-mono">
                    {selectedRegion.centroid ? `${selectedRegion.centroid[1].toFixed(2)}°E` : 'N/A'}
                  </span>
                </div>
                <div className="coord-chip sub-chip">
                  <span className="coord-label">States:</span>
                  <span className="coord-value">{selectedRegion.states || 'Multiple'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
