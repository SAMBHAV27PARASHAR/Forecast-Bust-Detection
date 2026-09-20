import React from 'react';

export default function ScenarioSelector({
  scenarios,
  activeScenarioId,
  onSelectScenario
}) {
  return (
    <div className="scenario-selector-bar">
      <div className="scenario-label-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span className="selector-title">Operational Case Study:</span>
      </div>

      <div className="scenario-chips-row">
        {scenarios.map((sc) => {
          const isActive = sc.id === activeScenarioId;
          return (
            <button
              key={sc.id}
              id={`scenario-chip-${sc.id}`}
              className={`scenario-chip ${isActive ? 'active' : ''}`}
              onClick={() => onSelectScenario(sc.id)}
              title={sc.description}
            >
              <span className="chip-type">{sc.type}</span>
              <span className="chip-name">{sc.name.split('(')[0].trim()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
