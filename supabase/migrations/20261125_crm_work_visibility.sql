begin;
create table if not exists public.crm_work_devices (
  actor_id text not null, device_id uuid not null,
  actor_name text not null default '', actor_email text not null default '', role text not null,
  platform text not null check(platform in ('android','desktop','mobile_web')),
  app_version text not null default '', last_path text not null default '',
  foreground boolean not null default false, location_consent boolean not null default false,
  last_seen_at timestamptz not null default now(),
  observed_at timestamptz not null default now(),
  latitude double precision, longitude double precision, accuracy_m double precision,
  location_captured_at timestamptz,
  primary key(actor_id,device_id),
  check(latitude is null or latitude between -90 and 90),
  check(longitude is null or longitude between -180 and 180),
  check(accuracy_m is null or accuracy_m between 0 and 10000)
);
create table if not exists public.crm_work_events (
  id bigint generated always as identity primary key,
  request_id uuid not null, actor_id text not null, device_id uuid,
  actor_name text not null default '', actor_email text not null default '', role text not null,
  platform text not null check(platform in ('android','desktop','mobile_web','unknown')),
  event_type text not null, path text not null default '', lead_id uuid references public.leads(id) on delete set null,
  channel text not null default '', outcome text not null default '',
  evidence text not null check(evidence in ('server_auth','client_reported')),
  created_at timestamptz not null default now(),
  unique(actor_id,request_id)
);
create index if not exists crm_work_events_recent on public.crm_work_events(created_at desc);
create index if not exists crm_work_events_actor on public.crm_work_events(actor_id,created_at desc);
alter table public.crm_work_devices enable row level security;
alter table public.crm_work_events enable row level security;
revoke all on public.crm_work_devices,public.crm_work_events from public,anon,authenticated;
grant select,insert,update,delete on public.crm_work_devices,public.crm_work_events to service_role;
grant usage,select on sequence public.crm_work_events_id_seq to service_role;

-- Late requests cannot switch a paused device back to foreground.
create or replace function public.crm_touch_work_device(p_actor text,p_device uuid,p_identity jsonb,p_state jsonb) returns void
language sql security definer set search_path=public,pg_temp as $$
  insert into public.crm_work_devices(actor_id,device_id,actor_name,actor_email,role,platform,app_version,last_path,foreground,location_consent,last_seen_at,observed_at)
  values(p_actor,p_device,p_identity->>'actor_name',p_identity->>'actor_email',p_identity->>'role',p_state->>'platform',p_state->>'app_version',p_state->>'last_path',(p_state->>'foreground')::boolean,(p_state->>'location_consent')::boolean,now(),(p_state->>'observed_at')::timestamptz)
  on conflict(actor_id,device_id) do update set actor_name=excluded.actor_name,actor_email=excluded.actor_email,role=excluded.role,platform=excluded.platform,
    app_version=excluded.app_version,last_path=excluded.last_path,foreground=excluded.foreground,location_consent=excluded.location_consent,last_seen_at=now(),observed_at=excluded.observed_at,
    latitude=case when excluded.foreground and excluded.location_consent then crm_work_devices.latitude else null end,
    longitude=case when excluded.foreground and excluded.location_consent then crm_work_devices.longitude else null end,
    accuracy_m=case when excluded.foreground and excluded.location_consent then crm_work_devices.accuracy_m else null end,
    location_captured_at=case when excluded.foreground and excluded.location_consent then crm_work_devices.location_captured_at else null end
  where crm_work_devices.observed_at <= excluded.observed_at;
$$;
revoke all on function public.crm_touch_work_device(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.crm_touch_work_device(text,uuid,jsonb,jsonb) to service_role;

-- Only latest foreground fix is kept; there is no location-history table.
create or replace function public.crm_prune_work_visibility() returns void
language sql security definer set search_path=public,pg_temp as $$
  update public.crm_work_devices set latitude=null,longitude=null,accuracy_m=null,location_captured_at=null
  where location_captured_at < now()-interval '3 minutes';
  delete from public.crm_work_events where created_at < now()-interval '30 days';
$$;
revoke all on function public.crm_prune_work_visibility() from public,anon,authenticated;
grant execute on function public.crm_prune_work_visibility() to service_role;
commit;
