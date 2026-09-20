import React from 'react';
import { formatToIst } from '../utils/timezone';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', category: 'Operational Overview' },
  { id: 'live_10day', label: 'Live 10-Day Forecast', icon: '⏱️', category: 'Operational Overview' },
  { id: 'city_forecast', label: 'City Forecast', icon: '📍', category: 'Operational Overview', badge: 'New' },
  { id: 'risk_map', label: 'India Risk Map', icon: '🗺️', category: 'Spatial & Model Analysis' },
  { id: 'bust_detection', label: 'Forecast Bust Detection', icon: '⚠️', category: 'Spatial & Model Analysis' },
  { id: 'stability', label: 'Forecast Stability', icon: '📈', category: 'Diagnostic Intelligence' },
  { id: 'what_changed', label: 'What Changed?', icon: '🔄', category: 'Diagnostic Intelligence' },
  { id: 'nwp_predictability', label: 'NWP Predictability', icon: '📉', category: 'Diagnostic Intelligence' },
  { id: 'verification', label: 'Forecast Verification', icon: '✅', category: 'Verification & Quality' },
  { id: 'what_if', label: 'What-If Simulator', icon: '🎛️', category: 'Verification & Quality' },
  { id: 'historical_2019', label: 'Historical 2019 Case', icon: '📁', category: 'Scientific Audit' },
  { id: 'model_performance', label: 'Model Performance', icon: '🏆', category: 'Scientific Audit' },
  { id: 'settings', label: 'Settings', icon: '⚙️', category: 'System' }
];

export default function Sidebar({ isOpen, onClose, activeView, onSelectView, isLiveMode, liveInitTime }) {
  // Group nav items by category
  const categories = {};
  NAV_ITEMS.forEach(item => {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
  });

  return (
    <>
      {/* Backdrop for mobile / drawer mode */}
      <div 
        className={`sidebar-backdrop ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`app-sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-icon">🌪️</span>
            <div>
              <div className="brand-title">SIH 26079</div>
              <div className="brand-subtitle">Forecast Bust System</div>
            </div>
          </div>
          <button 
            className="sidebar-close-btn" 
            onClick={onClose}
            title="Close navigation menu"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Operational Cycle Status Pill */}
        <div className="sidebar-status-banner">
          <div className="status-row">
            <span className={`status-dot ${isLiveMode ? 'pulse' : ''}`} />
            <span className="status-mode-name">
              {isLiveMode ? 'LIVE OPERATIONAL GEFS' : 'HISTORICAL ARCHIVE'}
            </span>
          </div>
          <div className="status-cycle-time">
            Cycle (IST): {liveInitTime ? formatToIst(liveInitTime) : '19 Sep 2026 • 05:30 IST'}
          </div>
        </div>

        <nav className="sidebar-nav" role="navigation">
          {Object.entries(categories).map(([category, items]) => (
            <div key={category} className="nav-category-group">
              <div className="nav-category-label">{category}</div>
              <ul className="nav-items-list">
                {items.map(item => {
                  const isActive = activeView === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        className={`nav-item-btn ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          onSelectView(item.id);
                          onClose();
                        }}
                      >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                        {item.badge && <span className="nav-badge">{item.badge}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-text">
            <span>MoES / IMD Prototype</span>
            <span className="version-pill">v2.4 Live</span>
          </div>
        </div>
      </aside>
    </>
  );
}
