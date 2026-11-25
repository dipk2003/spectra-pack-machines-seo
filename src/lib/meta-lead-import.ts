import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase';
import { dispatchLeadNotifications } from '@/lib/lead-notifications';

type MetaField = { name?: unknown; values?: unknown };
type MetaLead = { id?: unknown; form_id?: unknown; ad_id?: unknown; created_time?: unknown; field_data?: unknown };
type MetaPage = { id: string; name: string; accessToken: string };
type MetaFormRef = { pageId: string; pageAccessToken: string; formId: string; formName: string };

const text = (value: unknown, limit = 500) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit) : '';

function fieldMap(input: unknown) {
  const fields = new Map<string, string>();
  if (!Array.isArray(input)) return fields;
  for (const raw of input as MetaField[]) {
    const name = text(raw?.name, 100).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const value = Array.isArray(raw?.values) ? text(raw.values[0], 1000) : '';
    if (name && value) fields.set(name, value);
  }
  return fields;
}

function graphErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return 'Meta lead sync failed.';
  const record = error as Record<string, unknown>;
  const code = Number(record.code);
  const subcode = Number(record.error_subcode);
  if (code === 190 || subcode === 460) return 'Meta lead access token is invalid or expired. Generate a fresh System User token with leads_retrieval and access to the Facebook Page, then update META_LEADS_ACCESS_TOKEN.';
  if (code === 10 || code === 200) return 'Meta denied lead access. Give the System User leads_retrieval permission and assign the Facebook Page, then generate a new token.';
  return 'Meta could not return leads. Check the token, Page access, leads_retrieval permission, and Graph API version.';
}

async function graphGet(version: string, path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${version}/${path.replace(/^\/+/, '')}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(graphErrorMessage(body.error));
  return body;
}

async function listPages(version: string, token: string, configuredPageId: string) {
  const pages: MetaPage[] = [];
  let after = '';
  const seen = new Set<string>();
  for (let count = 0; count < 20; count++) {
    // Lead forms and lead details need a Page access token. A System User token
    // can mint these through /me/accounts when it has access to the Page.
    const result = await graphGet(version, 'me/accounts', token, { fields: 'id,name,access_token', limit: '100', ...(after ? { after } : {}) });
    if (!Array.isArray(result.data)) throw new Error('Meta returned an unexpected Page list.');
    for (const page of result.data as Array<Record<string, unknown>>) {
      const id = text(page.id, 40);
      const accessToken = text(page.access_token, 10000);
      if (/^\d{1,40}$/.test(id) && accessToken && (!configuredPageId || configuredPageId === id)) pages.push({ id, name: text(page.name, 200), accessToken });
    }
    after = text((result.paging as Record<string, unknown> | undefined)?.cursors && ((result.paging as Record<string, unknown>).cursors as Record<string, unknown>).after, 500);
    if (!result.paging || !after) {
      if (!pages.length && configuredPageId) throw new Error('Meta did not return a Page access token for META_LEAD_PAGE_ID. Assign the Page to the System User and grant leads_retrieval, then generate a fresh token.');
      return pages;
    }
    if (seen.has(after)) throw new Error('Meta Page pagination repeated; sync stopped safely.');
    seen.add(after);
  }
  throw new Error('Meta returned too many Pages to sync in one request.');
}

async function listForms(version: string, pages: MetaPage[]) {
  const forms: MetaFormRef[] = [];
  for (const page of pages) {
    let after = '';
    const seen = new Set<string>();
    for (let count = 0; count < 20; count++) {
      const result = await graphGet(version, `${page.id}/leadgen_forms`, page.accessToken, { fields: 'id,name', limit: '100', ...(after ? { after } : {}) });
      if (!Array.isArray(result.data)) throw new Error('Meta returned an unexpected lead form list.');
      for (const form of result.data as Array<Record<string, unknown>>) {
        const formId = text(form.id, 40);
        if (/^\d{1,40}$/.test(formId)) forms.push({ pageId: page.id, pageAccessToken: page.accessToken, formId, formName: text(form.name, 200) });
      }
      after = text((result.paging as Record<string, unknown> | undefined)?.cursors && ((result.paging as Record<string, unknown>).cursors as Record<string, unknown>).after, 500);
      if (!result.paging || !after) break;
      if (seen.has(after)) throw new Error('Meta form pagination repeated; sync stopped safely.');
      seen.add(after);
      if (count === 19) throw new Error('Meta returned too many lead forms for one sync run.');
    }
  }
  return forms;
}

type Cursor = { formIndex: number; after: string };
const decodeCursor = (value: unknown): Cursor => {
  if (value == null || value === '') return { formIndex: 0, after: '' };
  if (typeof value !== 'string' || value.length > 2000) throw new Error('Invalid Meta lead sync cursor.');
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (!Number.isSafeInteger(cursor.formIndex) || (cursor.formIndex ?? -1) < 0 || typeof cursor.after !== 'string' || cursor.after.length > 500) throw new Error();
    return cursor as Cursor;
  } catch { throw new Error('Invalid Meta lead sync cursor.'); }
};
const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64url');

async function ingest(lead: MetaLead, form: MetaFormRef): Promise<'created' | 'duplicate' | 'skipped'> {
  const leadId = text(lead.id, 200);
  if (!/^\d{1,40}$/.test(leadId)) return 'skipped';
  const fields = fieldMap(lead.field_data);
  const name = fields.get('full_name') || [fields.get('first_name'), fields.get('last_name')].filter(Boolean).join(' ');
  const email = fields.get('email') || fields.get('email_address') || '';
  const phone = fields.get('phone_number') || fields.get('phone') || '';
  if (!name || (!email && !phone)) return 'skipped';

  const adId = text(lead.ad_id, 100);
  const productDetails = Array.from(fields.entries())
    .filter(([key]) => /(product|machine|interest)/.test(key) && !['interest_level', 'machine_interest'].includes(key))
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`);
  const machineInterest = fields.get('machine_interest') || productDetails.join('; ').slice(0, 300);
  const excluded = new Set(['full_name', 'first_name', 'last_name', 'email', 'email_address', 'phone', 'phone_number', 'company_name', 'company', 'machine_interest']);
  const extra = Array.from(fields.entries()).filter(([key]) => !excluded.has(key)).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`);
  const db = getSupabaseAdmin();
  const { data: existing, error: lookupError } = await db.from('crm_external_leads')
    .select('external_id').eq('provider', 'meta-ads').eq('external_id', leadId).maybeSingle();
  if (lookupError) throw new Error('Meta lead deduplication check failed. Ensure the CRM ad lead ingestion migration is installed.');
  if (existing) return 'duplicate';
  const { data: savedLeadId, error } = await db.rpc('crm_ingest_external_lead', {
    p_provider: 'meta-ads', p_external_id: leadId,
    p_lead: {
      name, email, phone, company: fields.get('company_name') || fields.get('company') || '', machineInterest,
      formId: form.formId,
      message: [
        `Meta lead form ${form.formName || form.formId}; submitted ${text(lead.created_time, 100) || 'date unavailable'}; ad ${adId || 'unresolved'}.`,
        ...extra,
      ].join('\n').slice(0, 4000),
    },
  });
  if (error) throw new Error('Meta lead storage failed. Check that the CRM ad lead ingestion migration is installed.');
  if (savedLeadId) await dispatchLeadNotifications(String(savedLeadId));
  return 'created';
}

/** Imports a small resumable page of historical Meta leads; provider IDs deduplicate webhook overlap. */
export async function syncMetaLeadBatch(cursorValue: unknown) {
  const token = process.env.META_LEADS_ACCESS_TOKEN?.trim() || '';
  const version = process.env.META_GRAPH_VERSION?.trim() || '';
  if (!token || !/^v\d+\.\d+$/.test(version)) throw new Error('Meta Lead Ads needs META_LEADS_ACCESS_TOKEN and META_GRAPH_VERSION.');
  const cursor = decodeCursor(cursorValue);
  const configuredPageId = process.env.META_LEAD_PAGE_ID?.trim() || '';
  const businessId = process.env.META_BUSINESS_ID?.replace(/\s/g, '') || '';
  if (businessId && !/^\d{1,40}$/.test(businessId)) throw new Error('META_BUSINESS_ID must contain only the numeric Meta business ID.');
  const pages = await listPages(version, token, configuredPageId);
  if (!pages.length) throw new Error('Meta returned no Pages for this token. Assign the Facebook Page to the System User and grant pages_show_list and leads_retrieval; set META_BUSINESS_ID or META_LEAD_PAGE_ID if needed, then generate a new token.');
  const forms = await listForms(version, pages);
  if (!forms.length) return { imported: 0, skipped: 0, done: true, nextCursor: null };
  if (cursor.formIndex >= forms.length) return { imported: 0, skipped: 0, done: true, nextCursor: null };

  let imported = 0;
  let skipped = 0;
  let duplicates = 0;
  let remaining = 30;
  let formIndex = cursor.formIndex;
  let after = cursor.after;
  while (formIndex < forms.length && remaining > 0) {
    const form = forms[formIndex];
    const result = await graphGet(version, `${form.formId}/leads`, form.pageAccessToken, {
      fields: 'id,created_time,field_data,ad_id,form_id', limit: String(remaining), ...(after ? { after } : {}),
    });
    if (!Array.isArray(result.data)) throw new Error('Meta returned an unexpected lead list.');
    for (const lead of result.data as MetaLead[]) {
      const outcome = await ingest(lead, form);
      if (outcome === 'created') imported++;
      else if (outcome === 'duplicate') duplicates++;
      else skipped++;
      remaining--;
    }
    const paging = result.paging as Record<string, unknown> | undefined;
    const nextAfter = text((paging?.cursors as Record<string, unknown> | undefined)?.after, 500);
    if (paging?.next && nextAfter) {
      after = nextAfter;
      break;
    }
    formIndex++;
    after = '';
  }
  const done = formIndex >= forms.length;
  return { imported, skipped, duplicates, done, nextCursor: done ? null : encodeCursor({ formIndex, after }) };
}
