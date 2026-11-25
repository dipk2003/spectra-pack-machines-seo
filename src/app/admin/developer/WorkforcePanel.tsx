'use client';
import { useCallback, useEffect, useState } from 'react';
import { MapPin, Monitor, RefreshCw, Smartphone } from 'lucide-react';
import { locationIsFresh } from '@/lib/crm-work-policy';
import styles from './WorkforcePanel.module.css';

type Device = {actor_id:string;device_id:string;actor_name:string;actor_email:string;role:string;platform:string;app_version:string;foreground:boolean;last_seen_at:string;last_path:string;latitude:number|null;longitude:number|null;accuracy_m:number|null;location_captured_at:string|null};
type EventRow = {id:string;actor_id:string;actor_name:string;event_type:string;platform:string;channel:string;outcome:string;evidence:string;created_at:string};
type WorkRow = {id:string;lead_id:string;actor_id:string;actor_name:string;activity_type:string;body:string;outcome:string;metadata:Record<string,unknown>|null;created_at:string};
type Report = {generatedAt:string;devices:Device[];events:EventRow[];activities:WorkRow[]};
const date = (value:string) => new Date(value).toLocaleString('en-IN', {dateStyle:'medium',timeStyle:'short'});
export default function WorkforcePanel() {
  const [data,setData] = useState<Report|null>(null),[error,setError] = useState(''),[busy,setBusy] = useState(false),[actor,setActor] = useState('all');
  const [view,setView] = useState<'work'|'devices'>('work');
  const refresh = useCallback(async () => {
    setBusy(true);
    try { const response = await fetch('/api/admin/developer/workforce', {cache:'no-store',credentials:'same-origin'});const result = await response.json();if (!response.ok) { if (response.status===403 || response.status===423) setData(null); throw new Error(result.error || 'Work visibility is unavailable.'); }setData(result);setError(''); }
    catch(error){setError(error instanceof Error ? error.message : 'Could not refresh work visibility.');}finally{setBusy(false);}
  },[]);
  useEffect(()=>{void refresh();const tick=window.setInterval(()=>{if(!document.hidden)void refresh();},30000);return()=>window.clearInterval(tick);},[refresh]);
  const names=new Map<string,string>();data?.devices.forEach(item=>names.set(item.actor_id,item.actor_name));data?.events.forEach(item=>names.set(item.actor_id,item.actor_name));
  const devices=(data?.devices||[]).filter(item=>actor==='all'||item.actor_id===actor);
  const recent=(value:string)=>Date.now()-Date.parse(value)<90000;
  return <section className={styles.panel} aria-labelledby="workforce-heading"><header><div><h2 id="workforce-heading">Team work & device visibility</h2><p>Admin and employee CRM activity on desktop and mobile. Only the latest consented foreground location is shown.</p></div><button onClick={()=>void refresh()} disabled={busy} aria-label="Refresh work visibility"><RefreshCw size={18}/></button></header>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.controls}><label>Account<select value={actor} onChange={event=>setActor(event.target.value)}><option value="all">All CRM accounts</option>{Array.from(names,([id,name])=><option key={id} value={id}>{name||id}</option>)}</select></label><p>{data?`Updated ${date(data.generatedAt)}`:'Loading work visibility…'}</p></div>
    <div className={styles.devices}>{devices.map(device=>{const fix=device.latitude!==null&&device.longitude!==null&&locationIsFresh(device.location_captured_at,device.last_seen_at)&&device.foreground;return <article key={`${device.actor_id}:${device.device_id}`}><div className={styles.deviceTitle}>{device.platform==='android'?<Smartphone size={20}/>:<Monitor size={20}/>}<div><strong>{device.actor_name}</strong><small>{device.role} · {device.platform.replace('_',' ')}{device.app_version?` · v${device.app_version}`:''}</small></div><span data-active={device.foreground&&recent(device.last_seen_at)}>{device.foreground&&recent(device.last_seen_at)?'App open':device.foreground?'Not reporting':'Background / closed'}</span></div><small>{device.actor_email}<br/>Last report {date(device.last_seen_at)} · {device.last_path||'CRM'}</small>{fix?<p className={styles.location}><MapPin size={16}/><span>{device.latitude?.toFixed(5)}, {device.longitude?.toFixed(5)} · ±{Math.round(device.accuracy_m||0)} m<br/><small>Device-reported fix · {date(device.location_captured_at!)}</small></span><a href={`https://www.google.com/maps?q=${device.latitude},${device.longitude}`} target="_blank" rel="noreferrer">Open map</a></p>:<p className={styles.noLocation}>No current shared location</p>}</article>;})}</div>
    {data&&!devices.length&&<p>No devices have reported yet. Accounts appear after they open the updated CRM.</p>}
    <div className={styles.switch}><button aria-pressed={view==='work'} onClick={()=>setView('work')}>Lead work history</button><button aria-pressed={view==='devices'} onClick={()=>setView('devices')}>Login & device events</button></div>
    <div className={styles.timeline}>{view==='work'?(data?.activities||[]).filter(item=>actor==='all'||item.actor_id===actor).map(item=><article key={item.id}><div><strong>{item.actor_name}</strong><span>{item.metadata?.source==='employee_report'?'Employee reported':item.activity_type==='communication_launch'?'Launch requested':'CRM record'}</span><time>{date(item.created_at)}</time></div><p>{item.body}</p>{item.outcome&&<small>Outcome: {item.outcome}</small>}<a href={`/admin/mobile?lead=${item.lead_id}`}>Open lead</a></article>):(data?.events||[]).filter(item=>actor==='all'||item.actor_id===actor).map(item=><article key={item.id}><div><strong>{item.actor_name}</strong><span>{item.platform} · {item.evidence==='server_auth'?'Server authentication':'Client reported'}</span><time>{date(item.created_at)}</time></div><p>{item.event_type.replace(/_/g,' ')}{item.channel?` · ${item.channel}`:''}</p>{item.outcome&&<small>{item.outcome}</small>}</article>)}</div>
    <p className={styles.help}>Opening the dialer, WhatsApp or an email app confirms a launch attempt only. Conversation results are employee reports unless a provider confirms them. Location stops when the company app leaves the foreground; stale fixes are hidden. There is no background location or phone call-log access.</p>
  </section>;
}
