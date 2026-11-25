export const WORK_EVENTS = ['page_view','lead_open','foreground','background','location_enabled','location_disabled','client_opened','client_open_failed','contact_outcome'] as const;
export const locationIsFresh = (captured: string | null, seen: string, now = Date.now()) =>
  !!captured && now - Date.parse(captured) >= -60000 && now - Date.parse(captured) <= 120000 && now - Date.parse(seen) <= 120000;
export const workPlatform = (agent: string): 'android' | 'desktop' | 'mobile_web' =>
  /SpectraCRM\//i.test(agent) ? 'android' : /Android|iPhone|iPad|Mobile/i.test(agent) ? 'mobile_web' : 'desktop';

export function validLocation(value: Record<string, unknown>, now = Date.now()) {
  const { latitude, longitude, accuracy, capturedAt } = value;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90
    || typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180
    || typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 10000
    || typeof capturedAt !== 'string' || !Number.isFinite(Date.parse(capturedAt))
    || now - Date.parse(capturedAt) > 120000 || Date.parse(capturedAt) - now > 60000) {
    throw new Error('A fresh device location with a valid accuracy is required.');
  }
  return { latitude, longitude, accuracy_m: accuracy, location_captured_at: new Date(capturedAt).toISOString() };
}

export const cleanWorkPath = (value: unknown) => {
  const path = typeof value === 'string' ? value.split(/[?#]/, 1)[0].slice(0, 160) : '';
  return /^\/admin(?:\/|$)/.test(path) && !path.includes('..') && !path.includes('\\') ? path : '';
};
