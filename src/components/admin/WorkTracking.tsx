'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { MapPin, MapPinOff } from 'lucide-react';
import type { NativeState } from '@/lib/crm-native';
import styles from './WorkTracking.module.css';

type EventInput = { eventType: string; leadId?: string; channel?: string; outcome?: string };
type Tracking = { native: NativeState | null; reporting: boolean; error: string; consent: boolean; setLocation: (enabled: boolean) => void; event: (input: EventInput) => Promise<void> };
const TrackingContext = createContext<Tracking>({ native: null, reporting: false, error: '', consent: false, setLocation: () => undefined, event: async () => undefined });
export const useWorkTracking = () => useContext(TrackingContext);

export function WorkTrackingProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [native, setNative] = useState<NativeState | null>(null);
  const [consent, setConsent] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState('');
  const state = useRef({ deviceId: '', foreground: false, consent: false, path: '', appVersion: '' });
  const ready = useRef<Promise<unknown>>(Promise.resolve());
  const post = useCallback(async (input: Record<string, unknown>, keepalive = false) => {
    if (status !== 'authenticated' || !state.current.deviceId) return;
    const response = await fetch('/api/crm/work', { method: 'POST', credentials: 'same-origin', keepalive,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...state.current, observedAt: new Date().toISOString(), locationConsent: state.current.consent, ...input }) });
    if (!response.ok) {
      if (response.status === 401) { window.SpectraCRM?.request({ type: 'location_stop' }).catch(() => undefined); setReporting(false); }
      throw new Error('Work sync is unavailable. CRM changes can still be saved.');
    }
    setReporting(true); setError('');
  }, [status]);
  const event = useCallback(async (input: EventInput) => {
    try { await ready.current; await post({ kind: 'event', requestId: crypto.randomUUID(), ...input }); }
    catch { setError('Activity sync is currently unavailable.'); }
  }, [post]);
  const setLocation = useCallback((enabled: boolean) => {
    if (!session?.user?.id || !window.SpectraCRM) return;
    localStorage.setItem(`crm-location:${session.user.id}`, enabled ? 'on' : 'off');
    state.current.consent = enabled; setConsent(enabled);
    ready.current = post({ kind: 'heartbeat' }).catch(() => undefined);
    void ready.current.then(() => window.SpectraCRM?.request({ type: enabled ? 'location_start' : 'location_stop' })).catch(() => setError('Location could not be enabled. Check phone permissions.'));
    void event({ eventType: enabled ? 'location_enabled' : 'location_disabled' });
  }, [event, post, session?.user?.id]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) { window.SpectraCRM?.request({ type: 'location_stop' }).catch(() => undefined); return; }
    const key = `crm-device:${session.user.id}`;
    let fallback = localStorage.getItem(key);
    if (!fallback) { fallback = crypto.randomUUID(); localStorage.setItem(key, fallback); }
    const setup = () => {
      const app = window.SpectraCRM?.state || null;
      setNative(app);
      state.current.deviceId = app?.deviceId || fallback!;
      state.current.appVersion = app?.version || '';
      state.current.foreground = app ? app.foreground : !document.hidden;
      state.current.consent = !!app && localStorage.getItem(`crm-location:${session.user.id}`) === 'on';
      setConsent(state.current.consent);
      ready.current = post({ kind: 'heartbeat' }).catch(() => setError('Activity sync is currently unavailable.'));
      if (app && state.current.consent && app.foreground) void ready.current.then(() => window.SpectraCRM?.request({ type: 'location_start' })).catch(() => undefined);
    };
    const foreground = () => {
      const app = window.SpectraCRM?.state || null;
      setNative(app ? { ...app } : null);
      if (app?.location === 'denied') {
        state.current.consent = false; setConsent(false); localStorage.setItem(`crm-location:${session.user.id}`, 'off');
      }
      state.current.foreground = app ? app.foreground : !document.hidden;
      void post({ kind: 'heartbeat' }, true).catch(() => undefined);
    };
    const location = (raw: Event) => {
      if (!state.current.foreground || !state.current.consent || document.hidden) return;
      const point = (raw as CustomEvent).detail;
      void ready.current.then(() => post({ kind: 'location', ...point })).catch(() => setError('Location sync is currently unavailable.'));
    };
    setup();
    window.addEventListener('spectra-native-ready', setup);
    window.addEventListener('spectra-native-state', foreground);
    window.addEventListener('spectra-native-location', location);
    document.addEventListener('visibilitychange', foreground);
    const interval = window.setInterval(() => { if (state.current.foreground) void post({ kind: 'heartbeat' }).catch(() => setError('Activity sync is currently unavailable.')); }, 45000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('spectra-native-ready', setup); window.removeEventListener('spectra-native-state', foreground);
      window.removeEventListener('spectra-native-location', location); document.removeEventListener('visibilitychange', foreground);
      window.SpectraCRM?.request({ type: 'location_stop' }).catch(() => undefined);
    };
  }, [post, session?.user?.id, status]);
  useEffect(() => { state.current.path = pathname; if (status === 'authenticated' && state.current.deviceId) void event({ eventType: 'page_view' }); }, [event, pathname, status]);
  return <TrackingContext.Provider value={{ native, reporting, error, consent, setLocation, event }}>{children}</TrackingContext.Provider>;
}

export function WorkTrackingStatus({ detailed = false }: { detailed?: boolean }) {
  const work = useWorkTracking();
  const on = work.consent && work.native?.location === 'on' && work.native.foreground;
  return <div className={styles.status}>
    <span className={styles.label}>{on ? <MapPin size={15} /> : <MapPinOff size={15} />}{on ? 'Location sharing on' : work.native ? 'Location sharing off' : 'CRM activity logged'}</span>
    {work.native && <button type="button" className={styles.toggle} onClick={() => work.setLocation(!work.consent)}>{work.consent ? 'Turn off' : 'Enable location'}</button>}
    {detailed && <p>CRM actions are recorded for this work account. Location is shared with the developer only while this app is open, with your permission. It stops when you leave the app. Calls and WhatsApp launches do not confirm a conversation.</p>}
    {work.error && <small role="status">{work.error}</small>}
    {work.native?.location === 'denied' && <small role="status">Location permission was not granted. CRM work remains available.</small>}
  </div>;
}
