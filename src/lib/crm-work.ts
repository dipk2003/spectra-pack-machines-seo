import 'server-only';
import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from './supabase';
import type { CrmViewer } from './crm-types';
import { canAccessCrmLead, isCrmUuid } from './crm-policy';
import { CrmAccessError, CrmValidationError } from './crm';
import { cleanWorkPath, locationIsFresh, validLocation, WORK_EVENTS, workPlatform } from './crm-work-policy';

const clearLocation = { latitude: null, longitude: null, accuracy_m: null, location_captured_at: null };

export async function writeCrmWork(viewer: CrmViewer, input: Record<string, unknown>, agent: string) {
  const db = getSupabaseAdmin();
  if (!isCrmUuid(input.deviceId)) throw new CrmValidationError('Invalid work device.');
  const deviceId = input.deviceId;
  const platform = workPlatform(agent);
  const identity = { actor_id: viewer.userId, actor_name: viewer.displayName, actor_email: viewer.email, role: viewer.role };
  const filter = () => db.from('crm_work_devices').select('*').eq('actor_id', viewer.userId).eq('device_id', deviceId).maybeSingle();
  if (input.kind === 'location') {
    const { data: device, error } = await filter();
    if (error) throw new Error('Work device lookup failed.');
    if (!device || platform !== 'android' || device.platform !== 'android' || !device.foreground || !device.location_consent
      || Date.now() - Date.parse(device.last_seen_at) > 120000) throw new CrmAccessError('Foreground location sharing is not enabled for this device.');
    let point;
    try { point = validLocation(input); } catch { throw new CrmValidationError('Location is stale or invalid.'); }
    const result = await db.from('crm_work_devices').update(point).eq('actor_id', viewer.userId).eq('device_id', deviceId)
      .eq('foreground', true).eq('location_consent', true);
    if (result.error) throw new Error('Location could not be saved.');
    return { received: true };
  }
  if (input.kind !== 'heartbeat' && input.kind !== 'event') throw new CrmValidationError('Unsupported work update.');
  if (typeof input.foreground !== 'boolean') throw new CrmValidationError('Foreground state is required.');
  const observed = typeof input.observedAt === 'string' ? Date.parse(input.observedAt) : Date.now();
  if (!Number.isFinite(observed) || Math.abs(Date.now() - observed) > 120000) throw new CrmValidationError('Work update timestamp is invalid.');
  const consent = platform === 'android' && input.locationConsent === true;
  const leadId = input.leadId;
  if (input.kind === 'event') {
    if (!(WORK_EVENTS as readonly unknown[]).includes(input.eventType) || !isCrmUuid(input.requestId)) throw new CrmValidationError('Invalid work event.');
    if (leadId !== undefined) {
      if (!isCrmUuid(leadId)) throw new CrmValidationError('Invalid lead reference.');
      const { data: lead, error } = await db.from('leads').select('id,assigned_to').eq('id', leadId).maybeSingle();
      if (error || !lead || !canAccessCrmLead(viewer, lead)) throw new CrmAccessError();
    }
  }
  const device = await db.rpc('crm_touch_work_device', { p_actor: viewer.userId, p_device: deviceId, p_identity: identity, p_state: {
    platform,
    app_version: typeof input.appVersion === 'string' ? input.appVersion.slice(0, 30) : '',
    last_path: cleanWorkPath(input.path), foreground: input.foreground,
    location_consent: consent, observed_at: new Date(observed).toISOString(),
  } });
  if (device.error) throw new Error('Work reporting is temporarily unavailable.');
  if (input.kind === 'heartbeat') return { received: true };
  const event = await db.from('crm_work_events').upsert({
    ...identity, request_id: input.requestId, device_id: deviceId, platform,
    event_type: input.eventType, path: cleanWorkPath(input.path), lead_id: leadId || null,
    channel: ['call','whatsapp','email'].includes(String(input.channel)) ? input.channel : '',
    outcome: typeof input.outcome === 'string' ? input.outcome.replace(/[\u0000-\u001f]/g, ' ').slice(0, 500) : '',
    evidence: 'client_reported',
  }, { onConflict: 'actor_id,request_id', ignoreDuplicates: true });
  if (event.error) throw new Error('Work event could not be recorded.');
  return { received: true };
}

export async function recordCrmAuthEvent(viewer: Pick<CrmViewer,'userId'|'email'|'displayName'|'role'>, event: 'sign_in'|'sign_out', agent = '') {
  try {
    await getSupabaseAdmin().from('crm_work_events').insert({
      request_id: randomUUID(), actor_id: viewer.userId, actor_email: viewer.email,
      actor_name: viewer.displayName, role: viewer.role, event_type: event,
      platform: agent ? workPlatform(agent) : 'unknown', evidence: 'server_auth',
    });
  } catch { /* Audit availability must not prevent a valid login/logout. */ }
}

export async function getCrmWorkReport() {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [devices, events, activities] = await Promise.all([
    db.from('crm_work_devices').select('*').gte('last_seen_at', since).order('last_seen_at', { ascending: false }).limit(100),
    db.from('crm_work_events').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(150),
    db.from('lead_activities').select('id,lead_id,actor_id,actor_name,activity_type,body,outcome,metadata,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(100),
  ]);
  if (devices.error || events.error || activities.error) throw new Error('Work visibility setup is unavailable.');
  return {
    generatedAt: new Date().toISOString(),
    devices: (devices.data || []).map(device => ({ ...device,
      ...(!device.foreground || !device.location_consent || !locationIsFresh(device.location_captured_at, device.last_seen_at) ? clearLocation : {}),
    })),
    events: events.data || [], activities: activities.data || [],
  };
}
