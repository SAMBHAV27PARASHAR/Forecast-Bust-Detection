import React, { useState } from 'react';

export default function LeadTimeDegradationChart({
  curveData,
  selectedDay,
  onSelectDay,
  regionName
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const points = curveData?.curve || [];
  if (points.length === 0) {
    return (
      <div className="lead-chart-card empty-chart">
        <p>Loading lead-time degradation curve...</p>
      </div>
    );
  }

  // SVG Chart Dimensions
  const svgWidth = 620;
  const svgHeight = 240;
  const padding = { top: 25, right: 35, bottom: 42, left: 45 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Scale functions
  const getX = (day) => padding.left + ((day - 1) / 9) * graphWidth;
  const getY = (val) => padding.top + (1.0 - val / 100.0) * graphHeight;

  // Build SVG Path for Confidence Score
  const confPathD = points.reduce((acc, pt, idx) => {
    const x = getX(pt.day);
    const y = getY(pt.confidence_score);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Build Area Path under Confidence line
  const confAreaD = `${confPathD} L ${getX(10)} ${getY(0)} L ${getX(1)} ${getY(0)} Z`;

  // Build SVG Path for Bust Probability
  const bustPathD = points.reduce((acc, pt, idx) => {
    const x = getX(pt.day);
    const y = getY(pt.bust_probability);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // 50% Threshold Y position
  const y50 = getY(50);

  return (
    <div className="lead-chart-card">
      <div className="chart-header-row">
        <div>
          <h4>10-Day NWP Predictability & Bust Risk Horizon</h4>
          <p className="chart-sub">
            Confidence degradation curve for <strong>{regionName || 'Selected Region'}</strong> across Days 1–10
          </p>
        </div>
        <div className="chart-legend-row">
          <span className="legend-chip legend-conf">Confidence Score</span>
          <span className="legend-chip legend-bust">Bust Probability</span>
          <span className="legend-chip legend-thresh">50% Critical Boundary</span>
        </div>
      </div>

      <div className="svg-chart-wrapper">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="degradation-svg"
          aria-label="10-day forecast confidence degradation chart"
        >
          <defs>
            <linearGradient id="confGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((val) => (
            <g key={val}>
              <line
                x1={padding.left}
                y1={getY(val)}
                x2={svgWidth - padding.right}
                y2={getY(val)}
                stroke="#334155"
                strokeDasharray={val === 50 ? "4 3" : "2 4"}
                strokeWidth={val === 50 ? 1.2 : 0.8}
                opacity={val === 50 ? 0.7 : 0.4}
              />
              <text
                x={padding.left - 8}
                y={getY(val) + 3}
                fill="#94a3b8"
                fontSize="10"
                textAnchor="end"
              >
                {val}%
              </text>
            </g>
          ))}

          {/* 50% Threshold Warning Label */}
          <text
            x={svgWidth - padding.right}
            y={y50 - 5}
            fill="#f59e0b"
            fontSize="9"
            textAnchor="end"
            fontWeight="500"
          >
            Bust Alert Line (50%)
          </text>

          {/* Area Fill */}
          <path d={confAreaD} fill="url(#confGradient)" />

          {/* Confidence Curve */}
          <path
            d={confPathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Bust Probability Curve */}
          <path
            d={bustPathD}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2.0"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />

          {/* Day Vertical Active Marker */}
          <line
            x1={getX(selectedDay)}
            y1={padding.top}
            x2={getX(selectedDay)}
            y2={getY(0)}
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />

          {/* Data Points */}
          {points.map((pt) => {
            const x = getX(pt.day);
            const yConf = getY(pt.confidence_score);
            const isSelected = pt.day === selectedDay;

            return (
              <g
                key={pt.day}
                className="chart-point-group"
                onClick={() => onSelectDay(pt.day)}
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Confidence circle */}
                <circle
                  cx={x}
                  cy={yConf}
                  r={isSelected ? 6.5 : 4}
                  fill={isSelected ? '#38bdf8' : (pt.confidence_score >= 75 ? '#10b981' : pt.confidence_score >= 50 ? '#f59e0b' : '#ef4444')}
                  stroke="#0f172a"
                  strokeWidth="2"
                />

                {/* X Axis Labels */}
                <text
                  x={x}
                  y={getY(0) + 18}
                  fill={isSelected ? '#38bdf8' : '#94a3b8'}
                  fontWeight={isSelected ? '700' : '500'}
                  fontSize="11"
                  textAnchor="middle"
                >
                  D{pt.day}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Point Tooltip */}
        {hoveredPoint && (
          <div className="chart-floating-tooltip">
            <strong>Day {hoveredPoint.day} (+{hoveredPoint.day * 24}h)</strong>
            <span>Confidence: <strong>{hoveredPoint.confidence_score}%</strong></span>
            <span>Bust Risk: <strong>{hoveredPoint.bust_probability}%</strong></span>
            <span>Ensemble Spread: <strong>{hoveredPoint.ensemble_spread}σ</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
