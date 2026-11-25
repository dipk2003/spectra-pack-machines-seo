import 'server-only';
import { getSupabaseAdmin } from './supabase';
import { isEmailConfigured } from './email';
import { sendLeadOwnerNotificationEmail } from './notifications';

/** New leads are queued transactionally by the DB trigger, including native ad forms. */
export async function dispatchLeadNotifications(leadId?: string) {
  const result = { sent: 0, failed: 0 };
  if (!isEmailConfigured()) return result;
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc('claim_crm_lead_notifications', {
    p_lead_id: leadId || null, p_limit: leadId ? 1 : 10,
  });
  if (error) {
    console.error('CRM notification queue unavailable; lead remains stored.');
    return { sent: 0, failed: 1 };
  }
  for (const job of data || []) {
    try {
      const { data: lead, error: leadError } = await db.from('leads').select('*').eq('id', job.lead_id).single();
      if (leadError || !lead) throw new Error('Lead unavailable');
      const delivery = await sendLeadOwnerNotificationEmail({
        name: lead.name, email: lead.email || '', phone: lead.phone || '',
        company: lead.company || '', machineInterest: lead.machine_interest || '',
        message: lead.message || '', source: lead.source || '', leadId: lead.id,
        attribution: lead,
      });
      if (!delivery.sent) throw new Error('Email not configured');
      const { error: ackError } = await db.from('crm_lead_email_notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString(), locked_until: null, last_error: null })
        .eq('lead_id', job.lead_id).eq('claim_token', job.claim_token).eq('status', 'processing');
      if (ackError) throw new Error('Delivery acknowledgement unavailable');
      result.sent++;
    } catch {
      result.failed++;
      // Do not log contact details, SMTP credentials, or upstream response bodies.
      console.error('CRM admin notification delivery failed; queued for retry.');
      await db.from('crm_lead_email_notifications').update({
        status: 'pending', last_error: 'Email delivery failed; check SMTP configuration and delivery logs.',
        locked_until: new Date(Date.now() + Math.min(60, 2 ** Math.min(job.attempts, 6)) * 60000).toISOString(),
      }).eq('lead_id', job.lead_id).eq('claim_token', job.claim_token).eq('status', 'processing');
    }
  }
  return result;
}
