// Run against a local or deployed build using an existing company test account.
// CRM_TEST_EMAIL and CRM_TEST_PASSWORD must be supplied privately in the environment.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
nextEnv.loadEnvConfig(process.cwd());
const base = process.env.CRM_TEST_URL || 'http://localhost:3011';
const email = process.env.CRM_TEST_EMAIL, password = process.env.CRM_TEST_PASSWORD;
assert(email && password, 'Supply an existing company test login privately.');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(url, secret, {auth:{persistSession:false,autoRefreshToken:false}});
const jar = new Map();
const agent = 'SpectraCRM/1.1 Android contract-test';
async function request(path, options = {}) {
  const response = await fetch(base + path, {...options, redirect:'manual', headers:{'User-Agent':agent, Cookie:Array.from(jar,([k,v])=>`${k}=${v}`).join('; '), ...options.headers}});
  for(const cookie of response.headers.getSetCookie()) {const [pair] = cookie.split(';');const split = pair.indexOf('=');jar.set(pair.slice(0,split),pair.slice(split+1));}
  return response;
}
const csrf = await (await request('/api/auth/csrf')).json();
await request('/api/auth/callback/credentials', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:csrf.csrfToken,email,password,json:'true',callbackUrl:base+'/admin/mobile'})});
const session = await (await request('/api/auth/session')).json();
assert(session.user?.id, 'Existing company test login must succeed.');
const actor = session.user.id, device = randomUUID(), otherDevice = randomUUID();
const work = async (body, ua=agent) => request('/api/crm/work',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'User-Agent':ua},body:JSON.stringify({deviceId:device,foreground:true,locationConsent:true,path:'/admin/mobile?private=removed',appVersion:'contract-test',observedAt:new Date().toISOString(),...body})});
const check = async (response,status) => assert.equal(response.status,status,`Unexpected response status: ${await response.text()}`);
const row = async () => {const result=await db.from('crm_work_devices').select('*').eq('actor_id',actor).eq('device_id',device).single();assert.ifError(result.error);return result.data;};
try {
  assert.equal((await fetch(base+'/api/crm/work',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'})).status,401);
  assert.equal((await request('/api/admin/developer/workforce')).status,403,'Ordinary CRM account cannot read developer telemetry');
  await check(await work({kind:'heartbeat',actor_id:'forged',actor_name:'forged'}),200);
  assert.equal((await row()).actor_id,actor);assert.notEqual((await row()).actor_name,'forged');assert.equal((await row()).last_path,'/admin/mobile');
  const point={kind:'location',latitude:0,longitude:0,accuracy:25,capturedAt:new Date().toISOString()}; // Synthetic point, never a real employee fix.
  await check(await work(point),200);assert.equal((await row()).latitude,0);
  await check(await work({...point,deviceId:otherDevice}),403);
  await check(await work(point,'Mozilla/5.0 desktop contract-test'),403);
  await check(await work({...point,latitude:91}),400);
  await check(await work({...point,capturedAt:new Date(Date.now()-180000).toISOString()}),400);
  const beforePause=new Date(Date.now()-1000).toISOString();
  await check(await work({kind:'heartbeat',foreground:false}),200);
  assert.equal((await row()).latitude,null);assert.equal((await row()).foreground,false);
  await check(await work({kind:'heartbeat',observedAt:beforePause}),200);
  assert.equal((await row()).foreground,false,'A late foreground request cannot reopen a paused device');
  await check(await work(point),403);
  await check(await work({kind:'heartbeat',locationConsent:false}),200);
  await check(await work(point),403);
  const eventId=randomUUID();
  await check(await work({kind:'event',eventType:'page_view',requestId:eventId}),200);
  await check(await work({kind:'event',eventType:'page_view',requestId:eventId}),200);
  const events=await db.from('crm_work_events').select('id',{count:'exact'}).eq('actor_id',actor).eq('request_id',eventId);
  assert.ifError(events.error);assert.equal(events.count,1,'Retry must not duplicate work event');
  const foreign=await db.from('leads').select('id').neq('assigned_to',actor).limit(1).maybeSingle();
  if(session.user.role==='staff' && foreign.data) await check(await work({kind:'event',eventType:'lead_open',leadId:foreign.data.id,requestId:randomUUID()}),403);
  const page=await request('/admin/mobile');assert.equal(page.status,200);assert.match(page.headers.get('cache-control')||'',/no-store/);
  const anonKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(anonKey){const anon=createClient(url,anonKey,{auth:{persistSession:false}});for(const table of ['crm_work_devices','crm_work_events'])assert((await anon.from(table).select('*').limit(1)).error,'Public direct access must fail');}
  console.log('Passed: company login, mobile route, actor binding, private path, consent/foreground checks, pause race, coordinates, deduplication, RLS and developer-only access.');
} finally {
  // Only this run's newly created synthetic device data is disposable.
  const events=await db.from('crm_work_events').delete().eq('actor_id',actor).eq('device_id',device);assert.ifError(events.error);
  const devices=await db.from('crm_work_devices').delete().eq('actor_id',actor).eq('device_id',device);assert.ifError(devices.error);
}
