'use client';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CrmLead } from '@/lib/crm-types';
import styles from './mobile.module.css';
import { useMobileDialog } from './useMobileDialog';
export default function NewLead({ onClose,onAdded }: { onClose:()=>void;onAdded:(lead:CrmLead)=>void }) {
  const [busy,setBusy] = useState(false);
  const dialog = useMobileDialog();
  return <section ref={dialog} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="new-mobile-lead" data-crm-dialog><header className={styles.sheetHeader}><button onClick={onClose} aria-label="Close"><ArrowLeft /></button><h2 id="new-mobile-lead">Add a lead</h2></header><form className={styles.sheetContent} onSubmit={async event => {
    event.preventDefault(); if (busy) return; const fields = Object.fromEntries(new FormData(event.currentTarget)); setBusy(true);
    try { const response = await fetch('/api/crm', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,source:'staff-phone'}) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not add lead.'); onAdded(data.lead); }
    catch(error){toast.error(error instanceof Error ? error.message : 'Could not add lead.');}finally{setBusy(false);}
  }}><section className={styles.panel}><label>Customer name<input name="name" required autoComplete="name" /></label><label>Phone<input name="phone" type="tel" inputMode="tel" autoComplete="tel" /></label><label>Email<input name="email" type="email" autoComplete="email" /></label><label>Company<input name="company" autoComplete="organization" /></label><label>Machine requirement<input name="machineInterest" /></label><label>Enquiry details<textarea name="message" rows={4} required /></label><p className={styles.help}>Add at least a phone number or email address.</p><button className={styles.primary} disabled={busy}>{busy?'Adding…':'Add lead'}</button></section></form></section>;
}
