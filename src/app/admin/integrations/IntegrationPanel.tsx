'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { reportRange, summarizeAds, type AdMetric, type IntegrationReport } from '@/lib/integration-types';
import styles from './page.module.css';

const names: Record<string, string> = { google: 'Google Ads', meta: 'Meta Ads', 'meta-leads': 'Meta Lead Ads', whatsapp: 'WhatsApp Business API', twilio: 'Phone provider (Twilio)' };
const setup: Record<string, string> = {
  google: 'Connect OAuth access from a Google Cloud project approved for Google Ads API access. The website AW tag alone cannot read spend.',
  meta: 'Connect an ad account with an access token permitted to read advertising insights. Add ads_management to the system-user token to let CRM owners pause or resume campaigns. A Pixel ID alone cannot read spend. Reading the account spending cap also needs ad account billing access.',
  'meta-leads': 'Receive native Facebook and Instagram lead form submissions in the CRM. The Meta app must subscribe its Page to the leadgen webhook event and have the permissions needed to retrieve those leads.',
  whatsapp: 'Use the official WhatsApp Business Platform Cloud API. New inbound messages create CRM leads; a unique existing phone match is added to that lead, and duplicate phone matches remain for staff review. CRM sends outside the 24-hour window need an approved Meta template and an active payment method.',
  twilio: 'No calling service is connected. This receiver supports provider call status and optional provider-generated transcripts; it does not start calls or record audio.',
};
const format = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function IntegrationPanel() {
  const [dates, setDates] = useState(() => reportRange());
  const [data, setData] = useState<IntegrationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [leadIds, setLeadIds] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState('');
  const [metaLeadCursor, setMetaLeadCursor] = useState<string | null>(null);
  const [metaLeadProgress, setMetaLeadProgress] = useState<{ imported: number; skipped: number; duplicates: number } | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const campaignPerformance = useMemo(() => {
    const grouped = new Map<string, AdMetric>();
    for (const row of data?.metrics || []) {
      const key = [row.provider, row.account_id, row.campaign_id, row.currency].join(':');
      const current = grouped.get(key);
      if (current) {
        current.spend += row.spend;
        current.impressions += row.impressions;
        current.clicks += row.clicks;
        current.conversions += row.conversions;
        current.conversion_value += row.conversion_value;
      } else grouped.set(key, { ...row });
    }
    return Array.from(grouped.values()).sort((left, right) => right.spend - left.spend);
  }, [data?.metrics]);
  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`/api/crm/integrations?${new URLSearchParams(dates)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load integrations.');
      setData(result);
    } catch (cause) { setData(null); setError(cause instanceof Error ? cause.message : 'Connection failed.'); }
  }, [dates]);
  useEffect(() => { void load(); }, [load]);

  const act = async (body: Record<string, string>) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/crm/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Action failed.');
      setNotice(result.results ? result.results.map((item: { provider: string; status: string; message?: string }) => `${names[item.provider]}: ${item.status}${item.message ? ` — ${item.message}` : ''}`).join(' • ') : 'Event linked to lead.');
      if (result.campaignId) setNotice(`Meta campaign ${result.status === 'PAUSED' ? 'paused' : 'resumed'}. Sync to confirm the latest platform status.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Connection failed.'); }
    finally { setBusy(false); }
  };

  const syncMetaLeads = async () => {
    setBusy(true); setError(''); setNotice(''); setMetaLeadProgress({ imported: 0, skipped: 0, duplicates: 0 });
    let cursor = metaLeadCursor;
    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    try {
      // Keep each request small enough for serverless limits; repeat from the returned cursor.
      for (let batch = 0; batch < 100; batch++) {
        const response = await fetch('/api/crm/integrations/meta-leads', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cursor ? { cursor } : {}),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not import Meta leads.');
        imported += Number(result.imported || 0);
        skipped += Number(result.skipped || 0);
        duplicates += Number(result.duplicates || 0);
        cursor = typeof result.nextCursor === 'string' ? result.nextCursor : null;
        setMetaLeadCursor(cursor);
        setMetaLeadProgress({ imported, skipped, duplicates });
        if (result.done) {
          setNotice(`Meta lead import complete: ${imported} added; ${duplicates} already in CRM; ${skipped} skipped because the form did not provide a name and phone/email.`);
          return;
        }
        if (batch % 3 === 2) setNotice(`Importing Meta history… ${imported} added so far.`);
      }
      setNotice(`Imported ${imported} leads; ${duplicates} were already in CRM. Click “Continue import” to resume from the saved cursor.`);
    } catch (cause) {
      setMetaLeadCursor(cursor);
      setError(cause instanceof Error ? cause.message : 'Could not import Meta leads.');
    } finally { setBusy(false); }
  };

  return <div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Sales CRM</p><h1>Ads & Conversations</h1><p>Campaign reports and messages received from connected providers.</p></div><Link href="/admin/leads" className="btn btn-outline">Open sales CRM</Link></header>
    {error && <p className={styles.warning} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {!data && !error && <p role="status">Loading connections…</p>}
    {data && <>
      {!data.databaseReady && <p className={styles.warning}>Database setup pending. Apply the CRM integration, ad campaign catalog, ad alert, ad form lead ingestion and WhatsApp lead capture migrations before syncing campaigns or receiving provider leads. Existing website enquiries remain available in Sales CRM.</p>}
      <section className={styles.connections} aria-label="Provider connections">{data.connections.map(connection => <article className={styles.card} key={connection.name}>
        <div className={styles.cardTitle}><h2>{names[connection.name]}</h2><span className={connection.configured ? styles.ready : styles.pending}>{connection.configured ? 'Configured • verification needed' : 'Not connected'}</span></div>
        <p>{setup[connection.name]}</p>
        {connection.missing.length > 0 && <details><summary>Connection requirements</summary><p>Set these server credentials in hosting environment settings; do not paste secrets into messages.</p><ul>{connection.missing.map(key => <li key={key}><code>{key}</code></li>)}</ul></details>}
        {connection.name === 'whatsapp' && <p className={styles.endpoint}>Webhook: <code>/api/webhooks/whatsapp</code></p>}
        {connection.name === 'meta-leads' && <p className={styles.endpoint}>Webhook: <code>/api/webhooks/meta-leads</code> · Meta Page event: <code>leadgen</code></p>}
      </article>)}</section>
      <section className={styles.card}>
        <div className={styles.cardTitle}><div><h2>Spend cap & delivery alerts</h2><p>Checked whenever ad reports sync. Owner notifications use the configured email channel.</p></div></div>
        {!data.accountSpend.length ? <p className={styles.empty}>Meta account spend-cap data is not available yet. Sync Meta Ads with an access token that can read billing fields; accounts without a spend cap will not show a cap remaining.</p> : <div className={styles.totals}>{data.accountSpend.map(account => {
          const remaining = account.spend_cap > 0 ? Math.max(0, account.spend_cap - account.amount_spent) : null;
          return <article key={`${account.provider}:${account.account_id}`}><h3>{account.account_name} · {names[account.provider]}</h3><dl><dt>Currency</dt><dd>{account.currency}</dd><dt>Spending cap</dt><dd>{account.spend_cap > 0 ? format(account.spend_cap) : 'No cap set'}</dd><dt>Spent against cap</dt><dd>{format(account.amount_spent)}</dd><dt>Cap remaining</dt><dd>{remaining === null ? 'Not applicable' : format(remaining)}</dd><dt>Balance due</dt><dd>{format(account.balance_due)}</dd></dl><p className={styles.muted}>Meta billing units are shown as returned by the platform. Balance due is an invoice amount, not prepaid wallet funds.</p></article>;
        })}</div>}
        <p>Alerts appear here when a previously active campaign stops, Google marks a campaign limited by budget, or Meta spend-cap remaining falls below <code>META_SPEND_CAP_ALERT_PERCENT</code> (default 10%). A report sync runs daily; connect provider credentials and owner email to receive notifications.</p>
        {!data.alerts.length ? <p className={styles.empty}>No campaign or spend-cap alerts recorded.</p> : data.alerts.map(alert => <article className={styles.event} key={alert.id}><div className={styles.cardTitle}><strong>{alert.alert_type.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())} · {alert.campaign_name}</strong><span className={alert.severity === 'critical' ? styles.pending : styles.ready}>{alert.severity}</span></div><p>{alert.message}</p><p className={styles.muted}>{names[alert.provider]} · Account {alert.account_id} · {new Date(alert.created_at).toLocaleString()}</p></article>)}
      </section>
      <section className={styles.card}>
        <h2>Ad campaigns and lead capture</h2>
        <p>Native lead forms can create CRM leads without sending the customer to your website. Configure these webhook URLs and their server-only verification credentials in your hosting environment.</p>
        <div className={styles.event}><strong>Google Ads lead-form webhook</strong><p><code>{origin}/api/webhooks/google-ads/leads</code></p><p>Requires <code>GOOGLE_ADS_LEAD_WEBHOOK_KEY</code> to match the key set on the Google lead form.</p></div>
        <div className={styles.event}><strong>Meta Lead Ads webhook</strong><p><code>{origin}/api/webhooks/meta-leads</code></p><p>Subscribe the Meta app to the Page <code>leadgen</code> event. Requires <code>META_LEAD_WEBHOOK_VERIFY_TOKEN</code>, <code>META_APP_SECRET</code>, and a valid <code>META_LEADS_ACCESS_TOKEN</code> with Page access and <code>leads_retrieval</code>. For a System User token, set <code>META_BUSINESS_ID</code> or <code>META_LEAD_PAGE_ID</code> to target the owned Page.</p>
          <button className="btn btn-outline" disabled={busy || !data.connections.find(item => item.name === 'meta-leads')?.configured || !data.databaseReady} onClick={() => void syncMetaLeads()}>{busy ? 'Importing Meta leads…' : metaLeadCursor ? 'Continue import' : 'Import existing Meta leads'}</button>
          {metaLeadProgress && <p className={styles.muted} role="status">This run: {metaLeadProgress.imported} added; {metaLeadProgress.duplicates} already in CRM; {metaLeadProgress.skipped} skipped for missing contact details. Safe to retry: CRM deduplicates Meta lead IDs.</p>}
        </div>
        <div className={styles.event}><strong>WhatsApp Click-to-Chat referrals</strong><p><code>{origin}/api/webhooks/whatsapp</code></p><p>Subscribe the WhatsApp Business Account to the <code>messages</code> webhook field. Inbound messages are captured; Meta Click-to-WhatsApp referrals keep their ad ID and referral details. New sender numbers become CRM leads automatically after the migration is applied.</p></div>
        <p>Meta and Google webhook receivers validate requests and deduplicate lead submissions. Campaign ID and form/ad details are kept with the CRM lead where the source provides them.</p>
      </section>
      <section className={styles.card}>
        <div className={styles.cardTitle}><div><h2>Connected ad campaigns</h2><p>Current inventory, including campaigns without delivery in the selected period.</p></div></div>
        {!data.campaigns.length ? <p className={styles.empty}>No campaign inventory saved yet. Connect an ad account and sync reports.</p> : <><p>Owners can pause or resume Meta campaigns here. Resuming a campaign may restart ad delivery and spend.</p><div className={styles.tableWrap}><table><caption>Meta and Google Ads campaign status</caption><thead><tr><th>Campaign</th><th>Platform / account</th><th>Status</th><th>Objective / channel</th><th>Start</th><th>End</th><th>Admin action</th></tr></thead><tbody>{data.campaigns.map(campaign => <tr key={`${campaign.provider}:${campaign.account_id}:${campaign.campaign_id}`}><td>{campaign.campaign_name}<small>{campaign.campaign_id}</small></td><td>{names[campaign.provider]}<small>{campaign.account_id}</small></td><td>{campaign.status.replace(/_/g, ' ').toLowerCase()}</td><td>{campaign.objective || campaign.channel || '-'}</td><td>{campaign.start_date || '-'}</td><td>{campaign.end_date || '-'}</td><td>{campaign.provider === 'meta' && campaign.status.toUpperCase() === 'ACTIVE' ? <button className="btn btn-outline" disabled={busy} onClick={() => void act({ action: 'set-meta-campaign-status', campaignId: campaign.campaign_id, status: 'PAUSED' })}>Pause</button> : campaign.provider === 'meta' && campaign.status.toUpperCase() === 'PAUSED' ? <button className="btn btn-outline" disabled={busy} onClick={() => { if (window.confirm(`Resume “${campaign.campaign_name}”? Meta may start delivering ads and spending again.`)) void act({ action: 'set-meta-campaign-status', campaignId: campaign.campaign_id, status: 'ACTIVE' }); }}>Resume</button> : '—'}</td></tr>)}</tbody></table></div></>}
      </section>
      <section className={styles.card}>
        <h2>Advertising performance</h2>
        <div className={styles.controls}><label>From<input type="date" value={dates.since} onChange={event => setDates({ ...dates, since: event.target.value })} /></label><label>To<input type="date" value={dates.until} onChange={event => setDates({ ...dates, until: event.target.value })} /></label>
          <button className="btn btn-primary" disabled={busy || !data.databaseReady || !data.connections.some(item => ['google', 'meta'].includes(item.name) && item.configured)} onClick={() => void act({ action: 'sync', ...dates })}>{busy ? 'Syncing…' : 'Sync reports'}</button>
          <button className="btn btn-outline" disabled={busy} onClick={() => void load()}>Refresh saved data</button></div>
        <p>Daily sync refreshes the previous 30 completed days when credentials and the scheduler are configured. Dates follow each ad account&apos;s reporting timezone. Today&apos;s data may be incomplete.</p>
        <p><strong>Value / spend is platform-reported, not verified sales ROAS.</strong> Google uses its configured conversion values; Meta uses reported purchase value. Lead estimates are not counted as revenue. Platforms may credit the same sale, so currencies and providers stay separate.</p>
        {data.syncs.map(sync => <p key={sync.provider} className={sync.status === 'error' ? styles.warning : styles.muted}>{names[sync.provider]} · {sync.status} · {new Date(sync.completed_at).toLocaleString()} · {sync.range_start}–{sync.range_end} · {sync.message}</p>)}
        {!data.metrics.length ? <p className={styles.empty}>No saved report for this period. Connect an ad account and run a successful sync; missing data is not zero spend.</p> : <>
          <div className={styles.totals}>{summarizeAds(data.metrics).map(group => <article key={`${group.provider}:${group.currency}`}><h3>{names[group.provider]} · {group.currency}</h3><dl><dt>Spend</dt><dd>{format(group.spend)}</dd><dt>Impressions</dt><dd>{format(group.impressions)}</dd><dt>Clicks</dt><dd>{format(group.clicks)}</dd><dt>{group.provider === 'meta' ? 'Reported leads' : 'Reported conversions'}</dt><dd>{format(group.conversions)}</dd><dt>Reported value</dt><dd>{format(group.conversionValue)}</dd><dt>Value / spend</dt><dd>{group.valuePerSpend === null ? '—' : `${format(group.valuePerSpend)}×`}</dd></dl></article>)}</div>
          <div className={styles.tableWrap}><table><caption>Campaign performance · selected date range</caption><thead><tr><th>Campaign</th><th>Platform / account</th><th>Currency</th><th>Spend</th><th>Impressions</th><th>Clicks</th><th>Conversions / leads</th><th>Reported value</th></tr></thead><tbody>{campaignPerformance.map(row => <tr key={`${row.provider}:${row.account_id}:${row.campaign_id}`}><td>{row.campaign_name}<small>{row.campaign_id}</small></td><td>{names[row.provider]}<small>{row.account_id}</small></td><td>{row.currency}</td><td>{format(row.spend)}</td><td>{format(row.impressions)}</td><td>{format(row.clicks)}</td><td>{format(row.conversions)}</td><td>{format(row.conversion_value)}</td></tr>)}</tbody></table></div>
          <div className={styles.tableWrap}><table><caption>Daily campaign reporting</caption><thead><tr><th>Date</th><th>Campaign</th><th>Platform / account</th><th>Currency</th><th>Spend</th><th>Impressions</th><th>Clicks</th><th>Conversions / leads</th><th>Reported value</th></tr></thead><tbody>{data.metrics.map(row => <tr key={`${row.provider}:${row.account_id}:${row.campaign_id}:${row.day}`}><td>{row.day}</td><td>{row.campaign_name}<small>{row.campaign_id}</small></td><td>{names[row.provider]}<small>{row.account_id}</small></td><td>{row.currency}</td><td>{format(row.spend)}</td><td>{format(row.impressions)}</td><td>{format(row.clicks)}</td><td>{format(row.conversions)}</td><td>{format(row.conversion_value)}</td></tr>)}</tbody></table></div>
        </>}
      </section>
      <section className={styles.card}><h2>Conversation inbox</h2><p>Latest 100 received events, across all dates. New inbound WhatsApp messages create leads; unique phone matches are added to existing leads, and ambiguous matches stay here for owner review. Meta Click-to-WhatsApp referral details are retained when supplied with the first inbound message. Old WhatsApp Business app history is not imported; staff can send replies from a lead when the Cloud API is configured.</p>
        {!data.events.length && <p className={styles.empty}>No provider events received. Connect WhatsApp Business API or a supported phone provider to start automatic sync.</p>}
        {data.events.map(event => <article className={styles.event} key={event.id}><div className={styles.cardTitle}><strong>{names[event.provider]} · {event.direction} · {event.kind.replace(/_/g, ' ')}</strong><span>{event.status}</span></div><p className={styles.muted}>{event.phone ? `+${event.phone}` : 'Phone not supplied'} · {new Date(event.occurred_at).toLocaleString()}</p><p className={styles.body}>{event.body}</p>
          {event.lead_id ? <p>Linked lead: <Link href="/admin/leads">{event.lead_id}</Link></p> : <div className={styles.controls}><label>Link to an existing lead ID<input placeholder="CRM lead UUID" value={leadIds[event.id] || ''} onChange={e => setLeadIds({ ...leadIds, [event.id]: e.target.value })} /></label><button className="btn btn-outline" disabled={busy || !leadIds[event.id]} onClick={() => void act({ action: 'link', eventId: event.id, leadId: leadIds[event.id] })}>Link event</button></div>}
        </article>)}
      </section>
    </>}
  </div>;
}
