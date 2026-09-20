/**
 * SIH 26079: Frontend API Client
 * Communicates with FastAPI backend with graceful error handling and local fallback
 */

const API_BASE = '/api';

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend health check error:', err);
    return { status: 'offline', model_loaded: false };
  }
}

export async function fetchScenarios() {
  const res = await fetch(`${API_BASE}/scenarios`);
  if (!res.ok) throw new Error('Failed to fetch scenarios');
  return await res.json();
}

export async function fetchRegions() {
  const res = await fetch(`${API_BASE}/regions`);
  if (!res.ok) throw new Error('Failed to fetch regions');
  return await res.json();
}

export async function fetchRiskMap(day = 5, scenario = 'monsoon_depression_bust', validHour = null, date = null) {
  let url = `${API_BASE}/risk-map?day=${day}&scenario=${scenario}`;
  if (validHour !== null && validHour !== undefined) {
    url += `&valid_hour=${validHour}`;
  }
  if (date) {
    url += `&date=${encodeURIComponent(date)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch risk map for Day ${day}`);
  return await res.json();
}

export async function fetchForecastDetail(regionId, day = 5, scenario = 'monsoon_depression_bust', validHour = null, date = null) {
  let url = `${API_BASE}/forecast/${regionId}?day=${day}&scenario=${scenario}`;
  if (validHour !== null && validHour !== undefined) {
    url += `&valid_hour=${validHour}`;
  }
  if (date) {
    url += `&date=${encodeURIComponent(date)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch forecast detail for ${regionId}`);
  return await res.json();
}

export async function fetchLeadTimeCurve(regionId, scenario = 'monsoon_depression_bust') {
  const res = await fetch(`${API_BASE}/lead-time-curve?region_id=${regionId}&scenario=${scenario}`);
  if (!res.ok) throw new Error(`Failed to fetch lead-time curve for ${regionId}`);
  return await res.json();
}

export async function postCustomPrediction(payload) {
  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to compute custom prediction');
  return await res.json();
}

export async function fetchForecastStability(regionId, day = 5, scenario = 'real_gefs_july2019', validHour = null, leadHours = null) {
  let url = `${API_BASE}/intelligence/stability?region_id=${regionId}&day=${day}&scenario=${scenario}`;
  if (validHour !== null && validHour !== undefined) {
    url += `&valid_hour=${validHour}`;
  }
  if (leadHours !== null && leadHours !== undefined) {
    url += `&lead_hours=${leadHours}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch forecast stability for ${regionId}`);
  return await res.json();
}

export async function fetchWhatChanged(regionId, day = 5, scenario = 'real_gefs_july2019', validHour = null, leadHours = null) {
  let url = `${API_BASE}/intelligence/what-changed?region_id=${regionId}&day=${day}&scenario=${scenario}`;
  if (validHour !== null && validHour !== undefined) {
    url += `&valid_hour=${validHour}`;
  }
  if (leadHours !== null && leadHours !== undefined) {
    url += `&lead_hours=${leadHours}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch what changed data for ${regionId}`);
  return await res.json();
}

export async function fetchLiveStatus() {
  try {
    const res = await fetch(`${API_BASE}/live/status`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Live status check error:', err);
    return { available: false, error: err.message };
  }
}

export async function refreshLiveForecast() {
  const res = await fetch(`${API_BASE}/live/refresh`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to refresh live NOAA GEFS forecast');
  return await res.json();
}

export async function fetchCities() {
  const res = await fetch(`${API_BASE}/cities`);
  if (!res.ok) throw new Error('Failed to fetch cities');
  const data = await res.json();
  return Array.isArray(data) ? data : (data.cities || []);
}

export async function fetchCityForecast(cityId, day = 1, validHour = 0, date = null, lat = null, lon = null) {
  let url = `${API_BASE}/city-forecast/${cityId}?day=${day}`;
  if (validHour !== null && validHour !== undefined) {
    url += `&valid_hour=${validHour}`;
  }
  if (date) {
    url += `&date=${encodeURIComponent(date)}`;
  }
  if (lat !== null && lat !== undefined) {
    url += `&lat=${lat}`;
  }
  if (lon !== null && lon !== undefined) {
    url += `&lon=${lon}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch forecast for city ${cityId}`);
  return await res.json();
}

export async function fetchModelPerformance() {
  const res = await fetch(`${API_BASE}/model-performance`);
  if (!res.ok) throw new Error('Failed to fetch model performance metrics');
  return await res.json();
}

export async function fetchRetrospectiveVerification({ cityId, regionId, day = 0, validHour = 0, date = null, lat = null, lon = null } = {}) {
  let url = `${API_BASE}/verification/retrospective?day=${day}&valid_hour=${validHour}`;
  if (cityId) url += `&city_id=${encodeURIComponent(cityId)}`;
  if (regionId) url += `&region_id=${encodeURIComponent(regionId)}`;
  if (date) url += `&date=${encodeURIComponent(date)}`;
  if (lat !== null && lat !== undefined) url += `&lat=${lat}`;
  if (lon !== null && lon !== undefined) url += `&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch retrospective verification');
  return await res.json();
}

