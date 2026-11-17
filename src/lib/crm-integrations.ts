import 'server-only';
import { getSupabaseAdmin } from './supabase';
import { fetchAds, fetchAdCampaigns, fetchMetaSpendCap, integrationConnections } from './ad-connectors';
import { reportRange, type AdAccountSpend, type AdAlert, type AdCampaign, type AdMetric, type AdProvider, type IntegrationReport, type ProviderEvent } from './integration-types';
import { sendEmail, isEmailConfigured } from './email';

const alertRecipient = (process.env.OWNER_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || '').trim();
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[character]);

function campaignAlerts(provider: AdProvider, account: string, previous: Array<{ campaign_id: string; campaign_name: string; status: string }>, current: AdCampaign[]): Array<Omit<AdAlert, 'id' | 'created_at'>> {
  const alerts: Array<Omit<AdAlert, 'id' | 'created_at'>> = [];
  const currentById = new Map(current.map(campaign => [campaign.campaign_id, campaign]));
  const previousById = new Map(previous.map(campaign => [campaign.campaign_id, campaign]));
  const wasRunning = (status: string) => ['ACTIVE', 'ENABLED', 'ELIGIBLE', 'LIMITED_BY_BUDGET'].includes(status.toUpperCase());
  for (const campaign of previous) {
    const next = currentById.get(campaign.campaign_id);
    if (wasRunning(campaign.status) && (!next || !wasRunning(next.status))) {
      const name = next?.campaign_name || campaign.campaign_name;
      alerts.push({ provider, account_id: account, campaign_id: campaign.campaign_id, campaign_name: name, alert_type: 'campaign_stopped', severity: 'critical', message: `${name} ${next ? `changed from active to ${next.status}` : 'is no longer present in the active campaign inventory'}. Check the ad account and billing.` });
    }
  }
  for (const campaign of current) {
    const previousStatus = previousById.get(campaign.campaign_id)?.status.toUpperCase() || '';
    if (campaign.status.toUpperCase().includes('LIMITED_BY_BUDGET') && !previousStatus.includes('LIMITED_BY_BUDGET')) {
      alerts.push({ provider, account_id: account, campaign_id: campaign.campaign_id, campaign_name: campaign.campaign_name, alert_type: 'budget_limited', severity: 'warning', message: `${campaign.campaign_name} is limited by its budget in the ad platform.` });
    }
    // The Google Ads API provides a primary status for campaigns limited by budget.
    // This is a platform signal; it is not an account-balance measurement.
  }
  return alerts.map(alert => ({ ...alert, message: alert.message.slice(0, 1000) }));
}

async function dispatchAdAlerts(db: ReturnType<typeof getSupabaseAdmin>) {
  if (!alertRecipient || !isEmailConfigured()) return;
  const { data, error } = await db.from('crm_ad_alerts').select('*').is('notified_at', null).order('created_at').limit(20);
  if (error || !data?.length) return;
  for (const alert of data as AdAlert[]) {
    const title = alert.alert_type === 'campaign_stopped' ? 'Ad campaign stopped'
      : alert.alert_type === 'account_limit_reached' ? 'Ad account spending cap reached'
        : alert.alert_type === 'account_limit_near' ? 'Ad account spending cap nearly reached' : 'Ad campaign budget warning';
    try {
      const result = await sendEmail({
        to: alertRecipient,
        subject: `[Sales CRM] ${title}: ${alert.campaign_name}`,
        text: `${title}\n${alert.provider.toUpperCase()} · ${alert.campaign_name} · ${alert.campaign_id}\n${alert.message}\nDetected: ${alert.created_at}`,
        html: `<h2>${title}</h2><p><strong>${alert.provider.toUpperCase()} · ${escapeHtml(alert.campaign_name)}</strong></p><p>${escapeHtml(alert.message)}</p><p>Detected: ${escapeHtml(alert.created_at)}</p>`,
      });
      if (result.sent) await db.from('crm_ad_alerts').update({ notified_at: new Date().toISOString() }).eq('id', alert.id).is('notified_at', null);
    } catch {
      // Keep it pending. The next sync can retry the owner notification.
    }
  }
}

export async function syncAdReports(since?: string, until?: string) {
  const range = reportRange(since, until);
  const db = getSupabaseAdmin();
  const results = [];
  for (const provider of ['google', 'meta'] as AdProvider[]) {
    if (!integrationConnections().find(item => item.name === provider)?.configured) {
      results.push({ provider, status: 'not_connected', message: 'Provider credentials are not configured.' });
      continue;
    }
    try {
      const report = await fetchAds(provider, range.since, range.until);
      const inventory = await fetchAdCampaigns(provider);
      const { data: previous, error: previousError } = await db.from('crm_ad_campaigns').select('campaign_id,campaign_name,status').eq('provider', provider).eq('account_id', inventory.account);
      if (previousError) throw new Error('Could not read saved campaign inventory. Apply the campaign catalog migration.');
      const alerts = campaignAlerts(provider, inventory.account, previous || [], inventory.campaigns);
      const { error } = await db.rpc('crm_replace_ad_report', { p_provider: provider, p_account: report.account, p_since: range.since, p_until: range.until, p_rows: report.rows });
      if (error) throw new Error('Could not save report. Check the integration migration.');
      const { error: campaignError } = await db.rpc('crm_replace_ad_campaigns', { p_provider: provider, p_account: inventory.account, p_campaigns: inventory.campaigns });
      if (campaignError) throw new Error('Could not save campaign inventory. Apply the campaign catalog migration.');
      if (alerts.length) {
        const { error: alertError } = await db.from('crm_ad_alerts').upsert(alerts.map(alert => ({ ...alert, alert_key: `${provider}:${inventory.account}:${alert.campaign_id}:${alert.alert_type}:${range.until}` })), { onConflict: 'alert_key', ignoreDuplicates: true });
        if (alertError) throw new Error('Could not save ad alerts. Apply the CRM ad alerts migration.');
      }
      if (provider === 'meta') {
        const accountSpend = await fetchMetaSpendCap();
        if (accountSpend) {
          const snapshot: AdAccountSpend = { provider, account_id: accountSpend.account, account_name: accountSpend.name, currency: accountSpend.currency, spend_cap: accountSpend.cap, amount_spent: accountSpend.spent, balance_due: accountSpend.balanceDue, synced_at: new Date().toISOString() };
          const { data: previousStatus, error: previousStatusError } = await db.from('crm_ad_account_status').select('spend_cap,amount_spent').eq('provider', 'meta').eq('account_id', accountSpend.account).maybeSingle();
          if (previousStatusError) throw new Error('Could not read the prior Meta spend-cap status. Apply the CRM ad alerts migration.');
          const { error: snapshotError } = await db.from('crm_ad_account_status').upsert(snapshot, { onConflict: 'provider,account_id' });
          if (snapshotError) throw new Error('Could not save account billing status. Apply the CRM ad alerts migration.');
          if (accountSpend.cap > 0) {
            const threshold = Number(process.env.META_SPEND_CAP_ALERT_PERCENT || '10');
            const safeThreshold = Number.isFinite(threshold) ? Math.max(1, Math.min(threshold, 50)) : 10;
            const remaining = Math.max(0, accountSpend.cap - accountSpend.spent);
            const alertType = remaining <= 0 ? 'account_limit_reached' : remaining / accountSpend.cap * 100 <= safeThreshold ? 'account_limit_near' : null;
            const previousCap = Number(previousStatus?.spend_cap || 0);
            const previousSpent = Number(previousStatus?.amount_spent || 0);
            const previousRemaining = Math.max(0, previousCap - previousSpent);
            const wasNear = previousCap > 0 && previousRemaining / previousCap * 100 <= safeThreshold;
            if (alertType && !(alertType === 'account_limit_near' && wasNear) && !(alertType === 'account_limit_reached' && previousRemaining <= 0)) {
              const alertDay = new Date().toISOString().slice(0, 10);
              const accountAlert = { provider, account_id: accountSpend.account, campaign_id: 'account', campaign_name: accountSpend.name, alert_type: alertType, severity: remaining <= 0 ? 'critical' : 'warning', message: remaining <= 0 ? `The Meta account spending cap has been reached. Meta may stop delivery until billing or the cap is changed.` : `Only ${((remaining / accountSpend.cap) * 100).toFixed(1)}% of the Meta account spending cap remains. Check the ad account billing before delivery stops.`, alert_key: `meta:${accountSpend.account}:account:${alertType}:${alertDay}` };
              const { error: alertError } = await db.from('crm_ad_alerts').upsert(accountAlert, { onConflict: 'alert_key', ignoreDuplicates: true });
              if (alertError) throw new Error('Could not save account spending alerts. Apply the CRM ad alerts migration.');
            }
          }
        }
      }
      await dispatchAdAlerts(db);
      results.push({ provider, status: 'ok', rows: report.rows.length, campaigns: inventory.campaigns.length });
    } catch (error) {
      // Internal errors are not logged with URLs/tokens or provider payloads.
      const message = error instanceof Error && !/fetch failed|timeout/i.test(error.message) ? error.message : 'Provider connection failed; previous report retained.';
      await db.from('crm_integration_syncs').upsert({ provider, status: 'error', message: message.slice(0, 300), range_start: range.since, range_end: range.until, completed_at: new Date().toISOString() });
      results.push({ provider, status: 'error', message });
    }
  }
  return results;
}

export async function readIntegrationReport(since?: string, until?: string): Promise<IntegrationReport> {
  const range = reportRange(since, until);
  const db = getSupabaseAdmin();
  const [events, syncs, savedAlerts, accountStatus] = await Promise.all([
    db.from('crm_provider_events').select('*').order('received_at', { ascending: false }).limit(100),
    db.from('crm_integration_syncs').select('*'),
    db.from('crm_ad_alerts').select('id,provider,account_id,campaign_id,campaign_name,alert_type,severity,message,created_at').order('created_at', { ascending: false }).limit(100),
    db.from('crm_ad_account_status').select('*').order('provider').order('account_id'),
  ]);
  const rows: AdMetric[] = [];
  const campaignResult = await db.from('crm_ad_campaigns').select('*').order('provider').order('campaign_name').limit(10000);
  let databaseReady = !events.error && !syncs.error && !campaignResult.error && !savedAlerts.error && !accountStatus.error;
  const campaigns: AdCampaign[] = databaseReady ? (campaignResult.data || []).map(row => ({
    provider: row.provider as AdProvider, account_id: row.account_id, campaign_id: row.campaign_id,
    campaign_name: row.campaign_name, status: row.status, objective: row.objective,
    channel: row.channel, start_date: row.start_date || '', end_date: row.end_date || '',
  })) : [];
  for (let offset = 0; databaseReady; offset += 1000) {
    const page = await db.from('crm_ad_daily').select('*').gte('day', range.since).lte('day', range.until)
      .order('provider').order('account_id').order('campaign_id').order('day').range(offset, offset + 999);
    if (page.error) { databaseReady = false; break; }
    rows.push(...(page.data || []).map(row => ({ ...row, spend: Number(row.spend), impressions: Number(row.impressions), clicks: Number(row.clicks), conversions: Number(row.conversions), conversion_value: Number(row.conversion_value) })) as AdMetric[]);
    if ((page.data || []).length < 1000) break;
    if (offset >= 99000) throw new Error('Report too large; choose a shorter period.');
  }
  return { ...range, connections: integrationConnections(), databaseReady, metrics: databaseReady ? rows : [], campaigns, events: events.data || [], syncs: syncs.data || [], alerts: databaseReady ? savedAlerts.data as AdAlert[] : [], accountSpend: databaseReady ? accountStatus.data as AdAccountSpend[] : [] };
}

export async function ingestProviderEvents(events: ProviderEvent[]) {
  const db = getSupabaseAdmin();
  for (const event of events) {
    const { error } = await db.rpc('crm_ingest_provider_event', { p_event: event });
    if (error) throw new Error('Provider event persistence failed.');
  }
}
