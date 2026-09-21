import React, { useState, useMemo } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { formatToIst } from '../utils/timezone';
import indiaGeoData from '../data/india_states.json';

// Subdivision short codes for tactical map badges
const REGION_SHORT_CODES = {
  'IND-NW-HIM': 'HIM',
  'IND-NW-PLN': 'PLN',
  'IND-RAJ': 'RAJ',
  'IND-GUJ': 'GUJ',
  'IND-UP-BIH': 'UP-BIH',
  'IND-NE': 'NE',
  'IND-WB-ODI': 'WB-ODI',
  'IND-CEN-MP': 'MP',
  'IND-MAH-DESH': 'MAH',
  'IND-KON-GOA': 'GOA',
  'IND-TEL-AP': 'AP-TEL',
  'IND-KAR': 'KAR',
  'IND-KER': 'KER',
  'IND-TN': 'TN'
};

// Continuous color gradient stops:
// 0% (Light Mint Green) -> 20% (Fresh Green) -> 35% (Lime) -> 50% (Amber / Yellow-Orange) -> 65% (Orange) -> 80% (Red) -> 90% (Deep Red) -> 100% (Dark Maroon / Crimson)
const COLOR_STOPS = [
  { p: 0,   rgb: [167, 243, 208] }, // 0%: Light Mint Green (#a7f3d0) - Lightest
  { p: 20,  rgb: [75, 217, 164] },  // 20%: Fresh Green (#4bd9a4)
  { p: 35,  rgb: [132, 204, 22] },  // 35%: Lime / Yellow-Green (#84cc16)
  { p: 50,  rgb: [238, 163, 12] },  // 50%: Warm Amber / Yellow-Orange (#eea30c)
  { p: 65,  rgb: [249, 115, 22] },  // 65%: Bright Orange (#f97316)
  { p: 80,  rgb: [220, 38, 38] },   // 80%: Strong Red (#dc2626)
  { p: 90,  rgb: [185, 28, 28] },   // 90%: Deep Red (#b91c1c)
  { p: 100, rgb: [127, 29, 29] }    // 100%: Dark Crimson / Maroon (#7f1d1d) - Darkest
];

function getContinuousBustColor(bustProb) {
  if (bustProb === undefined || bustProb === null || isNaN(bustProb)) {
    return '#334155'; // Fallback neutral slate
  }
  const p = Math.max(0, Math.min(100, Number(bustProb)));
  
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const s1 = COLOR_STOPS[i];
    const s2 = COLOR_STOPS[i + 1];
    if (p >= s1.p && p <= s2.p) {
      const factor = (p - s1.p) / (s2.p - s1.p);
      const r = Math.round(s1.rgb[0] + factor * (s2.rgb[0] - s1.rgb[0]));
      const g = Math.round(s1.rgb[1] + factor * (s2.rgb[1] - s1.rgb[1]));
      const b = Math.round(s1.rgb[2] + factor * (s2.rgb[2] - s1.rgb[2]));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return 'rgb(127, 29, 29)';
}

export default function IndiaRiskMap({
  regionsData,
  riskMapData,
  selectedRegionId,
  onSelectRegion,
  selectedDay,
  selectedCity
}) {
  // The city's meteorological subdivision (may differ from the general selectedRegionId)
  const citySubdivisionId = selectedCity?.subdivision_id || null;
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Interactive Zoom & Pan Controls
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => setZoomLevel(prev => Math.min(3.5, Number((prev + 0.35).toFixed(2))));
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const next = Math.max(1, Number((prev - 0.35).toFixed(2)));
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMapMouseDown = (e) => {
    if (zoomLevel > 1 && e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMapMouseMove = (e) => {
    if (isDragging && zoomLevel > 1) {
      const maxPan = (zoomLevel - 1) * 220;
      const newX = Math.max(-maxPan, Math.min(maxPan, e.clientX - dragStart.x));
      const newY = Math.max(-maxPan, Math.min(maxPan, e.clientY - dragStart.y));
      setPanOffset({ x: newX, y: newY });
    }
  };

  const handleMapMouseUp = () => {
    setIsDragging(false);
  };

  // Map region metadata by ID
  const regionsById = useMemo(() => {
    const map = {};
    if (regionsData) {
      regionsData.forEach((r) => {
        map[r.id] = r;
      });
    }
    return map;
  }, [regionsData]);

  // Map dynamic risk info by subdivision ID
  const riskLookup = useMemo(() => {
    const map = {};
    if (riskMapData?.regions) {
      riskMapData.regions.forEach((r) => {
        map[r.region_id] = r;
      });
    }
    return map;
  }, [riskMapData]);

  // SVG Coordinate canvas dimensions
  const svgWidth = 580;
  const svgHeight = 660;

  // Geographic Mercator projection fitted strictly to India's GeoJSON bounds
  const projection = useMemo(() => {
    return geoMercator().fitExtent(
      [
        [20, 24],
        [svgWidth - 20, svgHeight - 24]
      ],
      indiaGeoData
    );
  }, [svgWidth, svgHeight]);

  const pathGenerator = useMemo(() => {
    return geoPath().projection(projection);
  }, [projection]);

  // Pre-calculate projected SVG paths for all 36 state/UT boundary features
  const projectedFeatures = useMemo(() => {
    return indiaGeoData.features.map((f, idx) => {
      const stateName = f.properties.ST_NM;
      const regionId = f.properties.region_id;
      const pathD = pathGenerator(f);
      const centroid = pathGenerator.centroid(f);
      return {
        id: `${regionId}-${stateName}-${idx}`,
        stateName,
        regionId,
        pathD,
        centroid
      };
    });
  }, [pathGenerator]);

  // Calculate subdivision centroid coordinates for acronym labels
  const subdivisionCentroids = useMemo(() => {
    const centers = {};
    const counts = {};
    projectedFeatures.forEach((item) => {
      const regId = item.regionId;
      const [cx, cy] = item.centroid;
      if (!isNaN(cx) && !isNaN(cy)) {
        if (!centers[regId]) {
          centers[regId] = [0, 0];
          counts[regId] = 0;
        }
        centers[regId][0] += cx;
        centers[regId][1] += cy;
        counts[regId] += 1;
      }
    });

    const result = {};
    Object.keys(centers).forEach((regId) => {
      const count = counts[regId] || 1;
      result[regId] = [
        Math.round(centers[regId][0] / count),
        Math.round(centers[regId][1] / count)
      ];
    });
    return result;
  }, [projectedFeatures]);

  // Continuous percentage-based fill color dynamically derived from bust_probability
  const getRegionFillColor = (regionId) => {
    const risk = riskLookup[regionId];
    if (!risk) return '#334155';
    return getContinuousBustColor(risk.bust_probability);
  };

  const handleMouseMove = (e, item) => {
    const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    const risk = riskLookup[item.regionId];
    const regionMeta = regionsById[item.regionId];

    setTooltipPos({
      x: e.clientX - rect.left + 16,
      y: e.clientY - rect.top - 20
    });

    setHoveredItem({
      stateName: item.stateName,
      regionId: item.regionId,
      regionMeta,
      risk
    });
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  const isRealFeed = riskMapData?.is_demo_mode === false;

  return (
    <div className="map-card-container">
      <div className="map-header">
        <div className="map-title-row">
          <div className="title-with-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            <h3>Geographic India Weather-Risk Heatmap</h3>
          </div>
          <div className="map-header-badges">
            <div className="map-zoom-toolbar">
              <button
                type="button"
                className="map-zoom-btn"
                onClick={handleZoomIn}
                title="Zoom In (+)"
                aria-label="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                className="map-zoom-btn"
                onClick={handleZoomOut}
                title="Zoom Out (−)"
                aria-label="Zoom Out"
              >
                −
              </button>
              <button
                type="button"
                className="map-zoom-btn reset-btn"
                onClick={handleResetZoom}
                title="Reset Zoom & Pan"
                aria-label="Reset Zoom"
              >
                ⟲ {Math.round(zoomLevel * 100)}%
              </button>
            </div>

            <span className={`map-feed-pill ${isRealFeed ? 'real-feed' : 'demo-feed'}`}>
              <span className="dot"></span>
              {isRealFeed ? 'NOAA GEFS OPERATIONAL' : 'DEMO / SAMPLE SIMULATION'}
            </span>
            <span className="map-day-indicator">
              Lead Time: <strong>Day {selectedDay} (+{(riskMapData?.forecast_day === selectedDay && riskMapData?.lead_hours !== undefined) ? riskMapData.lead_hours : (selectedDay * 24)}h)</strong>
              {riskMapData?.forecast_day === selectedDay && riskMapData?.valid_time_utc && (
                <span style={{ marginLeft: '6px', color: '#94a3b8', fontWeight: 500 }}>
                  • Valid (IST): <span style={{ color: '#38bdf8' }}>{formatToIst(riskMapData.valid_time_utc)}</span>
                </span>
              )}
            </span>
          </div>
        </div>
        <p className="map-instruction">
          Continuous gradient heatmap: Color continuously reflects 0% to 100% bust probability. Click any subdivision to inspect ML explainability. Drag to pan when zoomed.
        </p>
      </div>

      <div className="svg-map-wrapper">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="india-svg-map"
          aria-label="Geographic Meteorological Reliability Heatmap of India"
          onMouseDown={handleMapMouseDown}
          onMouseMove={handleMapMouseMove}
          onMouseUp={handleMapMouseUp}
          onMouseLeave={handleMapMouseUp}
          style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <defs>
            <filter id="glow-danger" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ef4444" floodOpacity="0.8" />
            </filter>
            <filter id="glow-active" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38bdf8" floodOpacity="0.95" />
            </filter>
            <filter id="glow-city-pin" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#0ea5e9" floodOpacity="0.9" />
            </filter>
            <filter id="glow-city-subdiv" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#06b6d4" floodOpacity="0.7" />
            </filter>
          </defs>

          <g
            className="map-zoomable-container"
            transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}
            style={{
              transformOrigin: '290px 330px',
              transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
            }}
          >
            {/* Latitude / Longitude Graticule lines */}
          <g className="tactical-grid" opacity="0.12">
            <line x1="30" y1="120" x2="550" y2="120" stroke="#94a3b8" strokeDasharray="3 4" />
            <line x1="30" y1="240" x2="550" y2="240" stroke="#94a3b8" strokeDasharray="3 4" />
            <line x1="30" y1="360" x2="550" y2="360" stroke="#94a3b8" strokeDasharray="3 4" />
            <line x1="30" y1="480" x2="550" y2="480" stroke="#94a3b8" strokeDasharray="3 4" />
            <line x1="30" y1="600" x2="550" y2="600" stroke="#94a3b8" strokeDasharray="3 4" />
            <line x1="140" y1="30" x2="140" y2="630" stroke="#94a3b8" strokeDasharray="3 4" />
            <line x1="260" y1="30" x2="260" y2="630" stroke="#94a3b8" strokeDasharray="3 4" />
            <line x1="380" y1="30" x2="380" y2="630" stroke="#94a3b8" strokeDasharray="3 4" />
            <line x1="500" y1="30" x2="500" y2="630" stroke="#94a3b8" strokeDasharray="3 4" />
          </g>

          {/* Continuous percentage-colored boundary polygons */}
          <g className="regions-layer">
            {projectedFeatures.map((item) => {
              const risk = riskLookup[item.regionId];
              const isSelected = item.regionId === selectedRegionId;
              const isHovered = hoveredItem?.regionId === item.regionId;
              // City's subdivision gets a special highlight ring when a city is selected
              const isCitySubdiv = selectedCity && item.regionId === citySubdivisionId;
              const fillColor = getRegionFillColor(item.regionId);
              const isSevere = (risk?.bust_probability || 0) >= 75.0;

              return (
                <path
                  key={item.id}
                  d={item.pathD}
                  fill={fillColor}
                  fillOpacity={isSelected || isCitySubdiv ? 0.97 : isHovered ? 0.92 : 0.84}
                  stroke={
                    isCitySubdiv
                      ? '#06b6d4'        // Bright cyan for city's subdivision
                      : isSelected
                        ? '#38bdf8'
                        : isHovered
                          ? '#ffffff'
                          : '#0b1120'
                  }
                  strokeWidth={isCitySubdiv ? 3.2 : isSelected ? 2.5 : isHovered ? 1.8 : 0.9}
                  strokeLinejoin="round"
                  strokeDasharray={isCitySubdiv && !isSelected ? '6 3' : 'none'}
                  filter={
                    isCitySubdiv
                      ? 'url(#glow-city-subdiv)'
                      : isSelected
                        ? 'url(#glow-active)'
                        : isSevere
                          ? 'url(#glow-danger)'
                          : 'none'
                  }
                  className={`geographic-region ${isSelected ? 'selected' : ''} ${isCitySubdiv ? 'city-subdiv-highlight' : ''} ${isSevere ? 'severe-pulse' : ''}`}
                  onClick={() => onSelectRegion(item.regionId)}
                  onMouseMove={(e) => handleMouseMove(e, item)}
                  onMouseLeave={handleMouseLeave}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}
          </g>

          {/* Centroid Subdivision Acronym Badges */}
          <g className="subdivision-markers" pointerEvents="none">
            {Object.entries(subdivisionCentroids).map(([regId, [cx, cy]]) => {
              const isSelected = regId === selectedRegionId;
              const code = REGION_SHORT_CODES[regId] || regId.replace('IND-', '');
              const risk = riskLookup[regId];
              const bustProb = risk?.bust_probability !== undefined ? Math.round(risk.bust_probability) : null;
              const isSevere = (risk?.bust_probability || 0) >= 75.0;

              return (
                <g key={regId} transform={`translate(${cx}, ${cy})`}>
                  <rect
                    x="-18"
                    y="-11"
                    width="36"
                    height="22"
                    rx="4"
                    fill={isSelected ? 'rgba(56, 189, 248, 0.95)' : isSevere ? 'rgba(127, 29, 29, 0.9)' : 'rgba(15, 23, 42, 0.82)'}
                    stroke={isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.25)'}
                    strokeWidth={isSelected ? 1.2 : 0.7}
                  />
                  <text
                    textAnchor="middle"
                    y="-1"
                    dominantBaseline="central"
                    fill={isSelected ? '#020617' : '#f8fafc'}
                    fontSize="8.5"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {code}
                  </text>
                  {bustProb !== null && (
                    <text
                      textAnchor="middle"
                      y="7"
                      dominantBaseline="central"
                      fill={isSelected ? '#020617' : '#94a3b8'}
                      fontSize="7"
                      fontWeight="600"
                      fontFamily="monospace"
                    >
                      {bustProb}%
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Selected City Geographic Marker — point pin + pulsing halo + label */}
          {selectedCity && selectedCity.lat && selectedCity.lon && (() => {
            const coords = projection([selectedCity.lon, selectedCity.lat]);
            if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return null;
            const [cx, cy] = coords;

            // Dynamic label width based on city name length
            const cityLabel = selectedCity.name || '';
            const labelW = Math.max(72, cityLabel.length * 6.8 + 20);
            const labelH = 30;
            const labelX = -labelW / 2;
            // Offset label above the pin so it doesn't overlap the halo
            const labelOffsetY = -26;

            // Coordinate sub-label
            const coordText = `${selectedCity.lat?.toFixed(2)}°N ${selectedCity.lon?.toFixed(2)}°E`;

            return (
              <g className="map-selected-city-pin" pointerEvents="none">
                {/* Stem line from pin dot up to label bottom */}
                <line
                  x1={cx} y1={cy - 8}
                  x2={cx} y2={cy + labelOffsetY + labelH}
                  stroke="#0ea5e9"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                  opacity="0.7"
                />

                {/* Outer pulsing halo ring */}
                <circle
                  cx={cx} cy={cy}
                  r="8"
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2"
                  opacity="0.9"
                >
                  <animate attributeName="r" values="8;26;8" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0;0.9" dur="2.4s" repeatCount="indefinite" />
                </circle>

                {/* Secondary smaller halo */}
                <circle
                  cx={cx} cy={cy}
                  r="5"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  opacity="0.6"
                >
                  <animate attributeName="r" values="5;16;5" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
                </circle>

                {/* Pin dot — bright filled center */}
                <circle
                  cx={cx} cy={cy}
                  r="6"
                  fill="#0284c7"
                  stroke="#ffffff"
                  strokeWidth="2"
                  filter="url(#glow-city-pin)"
                />
                <circle
                  cx={cx} cy={cy}
                  r="2.5"
                  fill="#e0f2fe"
                />

                {/* Label callout box */}
                <g transform={`translate(${cx}, ${cy + labelOffsetY})`}>
                  {/* Shadow rect for depth */}
                  <rect
                    x={labelX + 2}
                    y={2}
                    width={labelW}
                    height={labelH}
                    rx="5"
                    fill="rgba(0,0,0,0.35)"
                  />
                  {/* Main label bg */}
                  <rect
                    x={labelX}
                    y={0}
                    width={labelW}
                    height={labelH}
                    rx="5"
                    fill="rgba(2, 26, 60, 0.95)"
                    stroke="#0ea5e9"
                    strokeWidth="1.4"
                  />
                  {/* City name */}
                  <text
                    x="0"
                    y="11"
                    textAnchor="middle"
                    fill="#e0f2fe"
                    fontSize="9.5"
                    fontWeight="800"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    letterSpacing="0.3"
                  >
                    📍 {cityLabel}
                  </text>
                  {/* Coordinate sub-label */}
                  <text
                    x="0"
                    y="22"
                    textAnchor="middle"
                    fill="#7dd3fc"
                    fontSize="7"
                    fontWeight="500"
                    fontFamily="monospace"
                  >
                    {coordText}
                  </text>
                </g>
              </g>
            );
          })()}
          </g>
        </svg>

        {/* Floating Tooltip */}
        {hoveredItem && (
          <div
            className="map-tooltip"
            style={{
              left: `${Math.min(320, Math.max(10, tooltipPos.x))}px`,
              top: `${Math.min(480, Math.max(10, tooltipPos.y))}px`
            }}
          >
            <div className="tooltip-header">
              <div className="tooltip-top-row">
                <span className="tooltip-zone">{hoveredItem.regionMeta?.zone || 'India'}</span>
                <span className="tooltip-state">{hoveredItem.stateName}</span>
              </div>
              <strong className="tooltip-subdivision">{hoveredItem.regionMeta?.name || hoveredItem.regionId}</strong>
            </div>

            <div className="tooltip-body">
              {/* Bust Probability (Primary Heatmap Metric) */}
              <div className="tooltip-row bust-highlight-row">
                <span className="row-label">Bust Probability:</span>
                <div
                  className="tooltip-bust-badge"
                  style={{
                    backgroundColor: getContinuousBustColor(hoveredItem.risk?.bust_probability),
                    color: (hoveredItem.risk?.bust_probability || 0) >= 55 ? '#ffffff' : '#020617'
                  }}
                >
                  <strong>{hoveredItem.risk?.bust_probability !== undefined ? `${hoveredItem.risk.bust_probability}%` : '--'}</strong>
                </div>
              </div>

              {/* Confidence Score */}
              <div className="tooltip-row">
                <span className="row-label">Confidence Score:</span>
                <strong className={hoveredItem.risk?.confidence_score >= 75 ? 'text-green' : hoveredItem.risk?.confidence_score >= 50 ? 'text-amber' : 'text-red'}>
                  {hoveredItem.risk?.confidence_score !== undefined ? `${hoveredItem.risk.confidence_score}%` : 'Evaluating...'}
                </strong>
              </div>

              {/* Risk Level */}
              <div className="tooltip-row">
                <span className="row-label">Risk Level:</span>
                <span className={`risk-pill badge-${(hoveredItem.risk?.risk_level || 'low').toLowerCase()}`}>
                  {hoveredItem.risk?.risk_level || 'Low'}
                </span>
              </div>

              <div className="tooltip-row">
                <span>24h Rain Forecast:</span>
                <span>{hoveredItem.risk?.precip_forecast !== undefined ? `${hoveredItem.risk.precip_forecast} mm` : '--'}</span>
              </div>

              <div className="tooltip-row">
                <span>Ensemble Spread:</span>
                <span>{hoveredItem.risk?.ensemble_spread !== undefined ? `${hoveredItem.risk.ensemble_spread} σ` : '--'}</span>
              </div>

              <div className="tooltip-row">
                <span>Dominant Sensitivity:</span>
                <span className="tooltip-trigger">{hoveredItem.risk?.dominant_factor || 'Atmospheric Balance'}</span>
              </div>

              {hoveredItem.risk?.simulated_actual && (
                <div className="tooltip-verification-box">
                  <div className="verif-title">Verification (ERA5 / Actual):</div>
                  <div className="verif-detail">
                    Rain: {hoveredItem.risk.simulated_actual.precip_actual} mm
                    ({hoveredItem.risk.simulated_actual.rain_delta >= 0 ? '+' : ''}{hoveredItem.risk.simulated_actual.rain_delta} mm delta)
                  </div>
                  {hoveredItem.risk.simulated_actual.is_bust === 1 && (
                    <div className="verif-bust-tag">VERIFIED BUST: {hoveredItem.risk.simulated_actual.bust_trigger}</div>
                  )}
                </div>
              )}
            </div>

            <div className="tooltip-footer">
              <span>Click to lock region analysis</span>
            </div>
          </div>
        )}
      </div>

      {/* Continuous 0% -> 100% Heatmap Legend */}
      <div className="continuous-heatmap-legend">
        <div className="legend-title-row">
          <span className="legend-title">Continuous Bust Probability Scale (0% → 100%)</span>
          <span className="legend-subtitle">Calculated dynamically from NWP ensemble bifurcation & convective energy</span>
        </div>

        {/* Continuous Gradient Bar */}
        <div className="gradient-bar-wrapper">
          <div className="gradient-bar" />
          <div className="gradient-ticks-row">
            <span className="tick-point" style={{ left: '0%' }}>0%</span>
            <span className="tick-point" style={{ left: '25%' }}>25%</span>
            <span className="tick-point" style={{ left: '50%' }}>50%</span>
            <span className="tick-point" style={{ left: '75%' }}>75%</span>
            <span className="tick-point" style={{ left: '100%' }}>100%</span>
          </div>
        </div>

        {/* Gradient Spectrum Descriptive Labels */}
        <div className="gradient-spectrum-labels">
          <span className="spec-left">0% Low Risk (Light Green)</span>
          <span className="spec-center">50% Moderate Risk (Yellow-Orange)</span>
          <span className="spec-right">100% Severe Bust (Dark Red)</span>
        </div>

        {/* Percentage Comparison Swatches Demonstrating Continuous Monotonic Darkening */}
        <div className="percentage-swatches-grid">
          {[
            { p: 10, label: '10%' },
            { p: 30, label: '30%' },
            { p: 50, label: '50%' },
            { p: 70, label: '70%' },
            { p: 90, label: '90%' }
          ].map((item) => (
            <div key={item.p} className="swatch-item">
              <span
                className="swatch-color"
                style={{ backgroundColor: getContinuousBustColor(item.p) }}
              />
              <span className="swatch-label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="map-footer-meta">
        <span>Continuous Heatmap Interpolation (Mint Green → Emerald → Lime → Amber → Orange → Red → Dark Maroon)</span>
      </div>
    </div>
  );
}
