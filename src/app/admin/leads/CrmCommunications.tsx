'use client';

import { FormEvent, useState } from 'react';
import { ExternalLink, Mail, MessageCircle, Phone, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CrmActivity, CrmLead } from '@/lib/crm-types';
import { crmCommunicationUrl } from '@/lib/crm-policy';
import { openNativeContact } from '@/lib/crm-native';
import { useWorkTracking } from '@/components/admin/WorkTracking';
import styles from './page.module.css';

type Channel = 'call' | 'whatsapp' | 'email';
type CommunicationResult = {
  activity?: CrmActivity;
  launchUrl?: string;
  status: string;
  notice?: string;
};

export default function CrmCommunications({
  lead,
  emailSending,
  whatsappSending,
  whatsappTemplateSending,
  whatsappTemplateName,
  phoneCalling,
  onActivity,
  requestIds,
  initialChannel,
  mobile = false,
}: {
  lead: CrmLead;
  emailSending: boolean;
  whatsappSending: boolean;
  whatsappTemplateSending: boolean;
  whatsappTemplateName: string | null;
  phoneCalling: boolean;
  onActivity: (activity: CrmActivity) => void;
  requestIds: Map<string, string>;
  initialChannel?: Channel;
  mobile?: boolean;
}) {
  const work = useWorkTracking();
  const [channel, setChannel] = useState<Channel>(initialChannel || (lead.phone ? 'whatsapp' : 'email'));
  const [subject, setSubject] = useState(`Your ${lead.machineInterest || 'packaging machine'} enquiry — Spectra Pack`);
  const [body, setBody] = useState(`Hello ${lead.name}, thank you for your enquiry about ${lead.machineInterest || 'packaging machines'}. Could you share your product, pack size and required production capacity so we can help you choose a suitable machine?`);
  const [emailMode, setEmailMode] = useState<'app' | 'crm' | 'gmail' | 'outlook'>(mobile ? 'app' : emailSending ? 'crm' : 'gmail');
  // Prefer the API only when a template is configured for leads outside the
  // service window. Otherwise, let staff open WhatsApp with a safe draft.
  const [whatsappMode, setWhatsappMode] = useState<'app' | 'crm'>(!mobile && whatsappSending && whatsappTemplateSending ? 'crm' : 'app');
  const [whatsappMessageType, setWhatsappMessageType] = useState<'text' | 'template'>(whatsappTemplateSending ? 'template' : 'text');
  const [template, setTemplate] = useState('requirements');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [launchUrl, setLaunchUrl] = useState('');
  const [callMode, setCallMode] = useState<'device' | 'crm'>(!mobile && phoneCalling ? 'crm' : 'device');
  const [outcomeChannel, setOutcomeChannel] = useState<Channel | null>(null);
  const [outcomeSaved, setOutcomeSaved] = useState(false);
  const reportOutcome = async (completed: boolean) => {
    if (!outcomeChannel || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/crm/leads/${encodeURIComponent(lead.id)}/activities`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityType: outcomeChannel, body: `${outcomeChannel === 'call' ? 'Phone call' : outcomeChannel === 'whatsapp' ? 'WhatsApp message' : 'Email'} outcome reported by employee: ${completed ? 'completed' : 'not completed / no response'}.`, contactStatus: completed ? 'completed' : 'attempted', outcome: completed ? 'Employee reported completed' : 'Employee reported not completed' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save the outcome.');
      if (data.activity) onActivity(data.activity);
      await work.event({ eventType: 'contact_outcome', leadId: lead.id, channel: outcomeChannel, outcome: completed ? 'Employee reported completed' : 'Employee reported not completed' });
      setOutcomeSaved(true); toast.success('Outcome saved');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save the outcome.'); }
    finally { setBusy(false); }
  };
  const [callRequested, setCallRequested] = useState(false);
  const callFingerprint = JSON.stringify({ leadId: lead.id, recipient: lead.phone, channel: 'call', action: 'send' });

  const applyTemplate = (template: string) => {
    setTemplate(template);
    if (template === 'requirements') {
      setSubject(`Your ${lead.machineInterest || 'packaging machine'} enquiry — Spectra Pack`);
      setBody(`Hello ${lead.name}, thank you for your enquiry about ${lead.machineInterest || 'packaging machines'}. Could you share your product, pack size and required production capacity so we can help you choose a suitable machine?`);
    } else if (template === 'quotation') {
      setSubject(`Following up on your machine enquiry — Spectra Pack`);
      setBody(`Hello ${lead.name}, I am following up on your ${lead.machineInterest || 'packaging machine'} enquiry. Do you have any questions about the specification, quotation or installation requirements? Please let me know a convenient time to discuss.`);
    } else if (template === 'demo') {
      setSubject(`Arrange a machine discussion — Spectra Pack`);
      setBody(`Hello ${lead.name}, would you like to arrange a discussion about ${lead.machineInterest || 'your packaging requirement'}? Please share a convenient date and time, your location and any product samples you would like us to review.`);
    }
    setNotice('');
    setLaunchUrl('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const action = (channel === 'email' && emailMode === 'crm') || (channel === 'call' && callMode === 'crm') || (channel === 'whatsapp' && whatsappMode === 'crm') ? 'send' : 'launch';
    const fingerprint = channel === 'call' && action === 'send' ? callFingerprint : JSON.stringify({ leadId: lead.id, recipient: channel === 'email' ? lead.email : lead.phone, channel, action, subject, body, whatsappMessageType });
    // The page owns these IDs so switching channels or reopening a lead cannot
    // turn a retry of an uncertain email into a second SMTP submission.
    let requestId = action === 'send' ? requestIds.get(fingerprint) : undefined;
    if (!requestId) {
      requestId = crypto.randomUUID();
      if (action === 'send') requestIds.set(fingerprint, requestId);
    }
    // Reserve a browsing context during the click so the provider launch is not blocked after the API response.
    const webmail = channel === 'email' && (emailMode === 'gmail' || emailMode === 'outlook');
    const popup = !window.SpectraCRM && ((channel === 'whatsapp' && whatsappMode === 'app') || webmail) ? window.open('about:blank', '_blank') : null;
    if (popup) popup.opener = null;
    setBusy(true);
    setNotice('');
    setLaunchUrl('');
    try {
      const response = await fetch(`/api/crm/leads/${encodeURIComponent(lead.id)}/communications`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, action, subject, body, requestId, whatsappMessageType }),
      });
      const result = await response.json().catch(() => null) as (CommunicationResult & { error?: string }) | null;
      if (response.status === 401) {
        window.location.assign('/admin/login?callbackUrl=/admin/leads');
        throw new Error('Please sign in again.');
      }
      if (!response.ok || !result) throw new Error(result?.error || 'Could not prepare this communication.');
      if (result.activity) onActivity(result.activity);
      if (action === 'send' && channel === 'call') {
        setCallRequested(true);
        setNotice(result.notice || 'Call requested. Check your registered mobile.');
        if (result.status === 'queued') toast.success('Calling your mobile');
        else if (result.status === 'failed') toast.error('Call request rejected');
      } else if (action === 'send' && channel === 'whatsapp') {
        setNotice(result.notice || (result.status === 'sent' ? 'Accepted by WhatsApp; delivery is not confirmed yet.' : 'Check WhatsApp and the CRM activity before retrying.'));
        if (result.status === 'sent') toast.success('WhatsApp accepted by provider');
        else if (result.status === 'failed') { requestIds.delete(fingerprint); toast.error(result.notice || 'WhatsApp message was rejected'); }
        else toast('WhatsApp result needs checking', { icon: '⚠️' });
      } else if (action === 'send') {
        setNotice(result.notice || (result.status === 'accepted' ? 'Accepted by the email server. Delivery is not confirmed.' : 'The email result is not confirmed. Check the activity history before starting another email.'));
        if (result.status === 'accepted') toast.success('Email accepted by server');
        else if (result.status === 'failed') { requestIds.delete(fingerprint); toast.error('Email submission failed'); }
        else toast('Email result needs checking', { icon: 'ℹ️' });
        // Keep the request ID for this exact message so a second click cannot send it twice.
      } else if (result.launchUrl) {
        const valid = channel === 'whatsapp'
          ? /^https:\/\/wa\.me\/\d+\?/.test(result.launchUrl)
          : channel === 'call' ? /^tel:\+?\d+$/.test(result.launchUrl) : /^mailto:[^\r\n]+$/.test(result.launchUrl);
        if (!valid) throw new Error('The contact link is invalid. Please check the customer details.');
        const destination = webmail
          ? emailMode === 'gmail'
            ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
            : `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(lead.email)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
          : result.launchUrl;
        setLaunchUrl(destination);
        setOutcomeChannel(channel); setOutcomeSaved(false);
        setNotice(channel === 'call'
          ? 'If no calling app opened, use the direct dial link below or call this number from your mobile. A call connection has not been confirmed.'
          : 'App launch requested. Complete the message in the app, then record the result below.');
        if (window.SpectraCRM) {
          await openNativeContact(destination);
          await work.event({ eventType: 'client_opened', leadId: lead.id, channel });
        } else if (channel === 'whatsapp' || webmail) {
          if (popup) popup.location.replace(destination);
        } else {
          window.location.assign(result.launchUrl);
        }
      }
    } catch (error) {
      popup?.close();
      if (action === 'launch') void work.event({ eventType: 'client_open_failed', leadId: lead.id, channel });
      toast.error(error instanceof Error ? error.message : 'Communication failed.');
    } finally {
      setBusy(false);
    }
  };

  const missingContact = channel === 'email' ? !lead.email : !lead.phone;
  let directPhoneUrl = '';
  try { directPhoneUrl = crmCommunicationUrl('call', lead, '', ''); } catch { /* Invalid contacts are handled by the server. */ }

  return (
    <section className={styles.communications} aria-labelledby="communication-title">
      <div className={styles.drawerSectionTitle}><MessageCircle size={17} /><strong id="communication-title">Contact customer</strong></div>
      <div className={styles.quickActions} aria-label="Contact channel">
        {([{ value: 'call', label: 'Phone', icon: Phone }, { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }, { value: 'email', label: 'Email', icon: Mail }] as const).map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" aria-pressed={channel === value} disabled={busy} onClick={() => { setChannel(value); setNotice(''); setLaunchUrl(''); }}><Icon size={17} /> {label}</button>
        ))}
      </div>
      <form onSubmit={submit} className={styles.communicationForm}>
        <p className={styles.contactRecipient}>To: <strong>{channel === 'email' ? lead.email || 'Email not added' : lead.phone || 'Phone not added'}</strong></p>
        {channel === 'call' && <>
          <label><span>Call using</span><select value={callMode} disabled={busy} onChange={event => { setCallMode(event.target.value as 'device' | 'crm'); setNotice(''); setLaunchUrl(''); }}><option value="device">My device dialer</option><option value="crm" disabled={!phoneCalling}>CRM callback (Plivo){!phoneCalling ? ' — setup required' : ''}</option></select></label>
          {!phoneCalling && !mobile && <p className={styles.communicationHint}>Use the device dialer to call from this phone.</p>}
        </>}
        {channel === 'whatsapp' && <label><span>Send using</span><select value={whatsappMode} onChange={(event) => { setWhatsappMode(event.target.value as typeof whatsappMode); setNotice(''); setLaunchUrl(''); }} disabled={busy}><option value="app">WhatsApp app with draft</option>{whatsappSending && <option value="crm">WhatsApp Cloud API</option>}</select></label>}
        {channel === 'whatsapp' && whatsappMode === 'crm' && <label><span>WhatsApp message type</span><select value={whatsappMessageType} onChange={event => setWhatsappMessageType(event.target.value as 'text' | 'template')} disabled={busy}><option value="text">Free-form reply (24-hour window)</option><option value="template" disabled={!whatsappTemplateSending}>Approved template{whatsappTemplateSending ? '' : ' - awaiting template setup'}</option></select></label>}
        {channel === 'whatsapp' && whatsappMode === 'crm' && whatsappMessageType === 'template' && <p className={styles.communicationHint}>Using approved template <code>{whatsappTemplateName || 'not configured'}</code>. Meta supplies the template text; the editable draft is not sent.</p>}
        {channel !== 'call' && !(channel === 'whatsapp' && whatsappMode === 'crm' && whatsappMessageType === 'template') && <>
          <label><span>Message template</span><select value={template} onChange={(event) => applyTemplate(event.target.value)} disabled={busy}><option value="requirements">Ask about requirements</option><option value="quotation">Enquiry follow-up</option><option value="demo">Arrange a discussion</option><option value="custom">Custom message</option></select></label>
          {channel === 'email' && <>
            <label><span>Send using</span><select value={emailMode} onChange={(event) => { setEmailMode(event.target.value as typeof emailMode); setNotice(''); setLaunchUrl(''); }} disabled={busy}><option value="gmail">Gmail in browser</option><option value="outlook">Outlook in browser</option><option value="app">My email app</option>{emailSending && <option value="crm">CRM email server</option>}</select></label>
            <label><span>Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} required disabled={busy} /></label>
          </>}
          <label><span>Message</span><textarea rows={5} value={body} onChange={(event) => { setBody(event.target.value); setTemplate('custom'); }} maxLength={4000} required disabled={busy} /></label>
        </>}
        <p className={styles.communicationHint}>{channel === 'call'
          ? callMode === 'crm' ? 'The CRM calls your registered mobile first. Answer to connect to this customer; provider call charges apply.' : 'Use your mobile or an installed calling app. On a desktop without a calling app, the dialer cannot place a call.'
          : channel === 'whatsapp'
            ? whatsappMode === 'crm' ? whatsappMessageType === 'template' ? 'Sends the configured WhatsApp template. It must be approved and active in Meta; business-initiated messaging also needs account payment setup.' : 'Sends a free-form reply through WhatsApp Cloud API. This only works within 24 hours of the customer’s last message.' : 'Opens WhatsApp with your draft. Review and send the message in WhatsApp.'
            : emailMode === 'crm'
              ? 'Sends this email through the configured company email server. Server acceptance does not confirm delivery.'
              : `Opens ${emailMode === 'gmail' ? 'Gmail' : emailMode === 'outlook' ? 'Outlook' : 'your email app'} with this draft. Review and send it there.`}</p>
        {channel === 'call' && directPhoneUrl && <div className={styles.quickActions}><a className="btn btn-outline btn-sm" href={directPhoneUrl}>Dial directly</a><button type="button" onClick={() => void navigator.clipboard.writeText(directPhoneUrl.slice(4)).then(() => toast.success('Phone number copied')).catch(() => toast.error('Please copy the number shown above.'))}>Copy number</button></div>}
        {missingContact && <p className={styles.inlineWarning}>Add and save the customer’s {channel === 'email' ? 'email address' : 'phone number with country code'} first.</p>}
        <button className="btn btn-primary btn-sm" disabled={busy || missingContact}>{(channel === 'email' && emailMode === 'crm') || (channel === 'whatsapp' && whatsappMode === 'crm') ? <Send size={15} /> : <ExternalLink size={15} />}{busy ? 'Preparing…' : channel === 'call' ? callMode === 'crm' ? 'Call from CRM' : 'Open dialer' : channel === 'whatsapp' ? whatsappMode === 'crm' ? 'Send WhatsApp from CRM' : 'Open WhatsApp' : emailMode === 'crm' ? 'Send email from CRM' : emailMode === 'gmail' ? 'Open Gmail draft' : emailMode === 'outlook' ? 'Open Outlook draft' : 'Open email app'}</button>
        {channel === 'call' && callMode === 'crm' && callRequested && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { requestIds.delete(callFingerprint); setCallRequested(false); setNotice('Ready for a new call. Make sure the previous call has ended before clicking Call from CRM.'); }}>Prepare a new call</button>}
        {notice && <p className={styles.communicationNotice} role="status">{notice}</p>}
        {launchUrl && <a className={styles.continueLink} href={launchUrl} target={launchUrl.startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer">{channel === 'call' ? 'Open dialer again' : channel === 'whatsapp' ? 'Continue to WhatsApp' : 'Continue to email'} <ExternalLink size={13} /></a>}
      </form>
      {outcomeChannel && !outcomeSaved && <div className={styles.communicationForm} role="group" aria-label="Record contact outcome">
        <strong>How did it go?</strong><p className={styles.communicationHint}>This is your reported result. Opening an app alone does not confirm a call or sent message.</p>
        <div className={styles.quickActions}><button type="button" disabled={busy} onClick={() => void reportOutcome(true)}>{outcomeChannel === 'call' ? 'Connected' : 'Message sent'}</button><button type="button" disabled={busy} onClick={() => void reportOutcome(false)}>{outcomeChannel === 'call' ? 'No answer / cancelled' : 'Not sent'}</button></div>
      </div>}
    </section>
  );
}
