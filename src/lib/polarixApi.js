const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `POLARIX API request failed (${response.status})`);
  }
  return response.json();
}

export const apiGet = (path) => apiRequest(path);
export const apiPost = (path, body) => apiRequest(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
export const apiPatch = (path, body) => apiRequest(path, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function lightCurvePoints(lightcurve) {
  if (!lightcurve?.time || !lightcurve?.flux) return [];
  const events = lightcurve.events || [];
  return lightcurve.time.map((time, index) => {
    const pointEvents = events.filter((event) => {
      const eventX = lightcurve.folded ? event.phase : event.event_time_btjd;
      return eventX != null && Math.abs(Number(eventX) - time) < (lightcurve.folded ? 0.015 : 0.003);
    });
    return {
      time,
      flux: lightcurve.flux[index],
      isFlare: pointEvents.some((event) => String(event.event_type).includes('flare')),
      isDip: pointEvents.some((event) => String(event.event_type).includes('dip')),
      qualityFlag: lightcurve.quality_good ? !lightcurve.quality_good[index] : false
    };
  });
}
