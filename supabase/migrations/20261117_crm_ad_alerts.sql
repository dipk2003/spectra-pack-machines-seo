-- Ad delivery and account spend-cap notifications for the Sales CRM.
-- Apply after the campaign catalogue migration.
begin;

create table if not exists public.crm_ad_alerts (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google','meta')),
  account_id text not null,
  campaign_id text not null,
  campaign_name text not null,
  alert_type text not null check (alert_type in ('campaign_stopped','budget_limited','account_limit_near','account_limit_reached')),
  severity text not null check (severity in ('warning','critical')),
  message text not null default '',
  alert_key text not null unique,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create index if not exists crm_ad_alerts_created on public.crm_ad_alerts(created_at desc);
alter table public.crm_ad_alerts enable row level security;
revoke all on public.crm_ad_alerts from public, anon, authenticated;
grant select, insert, update on public.crm_ad_alerts to service_role;

create table if not exists public.crm_ad_account_status (
  provider text not null check (provider in ('google','meta')),
  account_id text not null,
  account_name text not null default '',
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  spend_cap numeric not null default 0,
  amount_spent numeric not null default 0,
  balance_due numeric not null default 0,
  synced_at timestamptz not null default now(),
  primary key (provider, account_id)
);
alter table public.crm_ad_account_status enable row level security;
revoke all on public.crm_ad_account_status from public, anon, authenticated;
grant select, insert, update on public.crm_ad_account_status to service_role;

-- Durable request IDs keep browser retries from submitting a WhatsApp message twice.
create table if not exists public.crm_whatsapp_outbound (
  request_id uuid primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id text not null,
  recipient text not null check (recipient ~ '^[1-9][0-9]{7,14}$'),
  body text not null check (length(body) between 1 and 4000),
  status text not null default 'reserved' check (status in ('reserved','sent','failed','uncertain')),
  provider_id text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.crm_whatsapp_outbound enable row level security;
revoke all on public.crm_whatsapp_outbound from public, anon, authenticated;
grant select, insert, update on public.crm_whatsapp_outbound to service_role;

create or replace function public.crm_reserve_whatsapp(
  p_request_id uuid, p_lead_id uuid, p_actor_id text, p_owner_access boolean, p_recipient text, p_body text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare current_row public.crm_whatsapp_outbound; lead_owner text;
begin
  perform public.crm_assert_actor_access(p_actor_id, p_owner_access);
  if p_recipient !~ '^[1-9][0-9]{7,14}$' or length(p_body) not between 1 and 4000 then raise exception 'Invalid WhatsApp message'; end if;
  select assigned_to into lead_owner from public.leads where id=p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if not p_owner_access and lead_owner is distinct from p_actor_id then raise exception 'Lead access denied'; end if;
  select * into current_row from public.crm_whatsapp_outbound where request_id=p_request_id for update;
  if found then
    if current_row.lead_id is distinct from p_lead_id or current_row.actor_id is distinct from p_actor_id
      or current_row.recipient is distinct from p_recipient or current_row.body is distinct from p_body then
      raise exception 'WhatsApp request does not match the reserved message';
    end if;
    return jsonb_build_object('created',false,'status',current_row.status,'provider_id',current_row.provider_id);
  end if;
  insert into public.crm_whatsapp_outbound(request_id,lead_id,actor_id,recipient,body)
    values(p_request_id,p_lead_id,p_actor_id,p_recipient,p_body);
  return jsonb_build_object('created',true,'status','reserved','provider_id',null);
end; $$;

create or replace function public.crm_finish_whatsapp(
  p_request_id uuid, p_actor_id text, p_status text, p_provider_id text
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_status not in ('sent','failed','uncertain') or length(coalesce(p_provider_id,'')) > 200 then raise exception 'Invalid WhatsApp result'; end if;
  update public.crm_whatsapp_outbound set status=p_status, provider_id=nullif(p_provider_id,''), finished_at=now()
    where request_id=p_request_id and actor_id=p_actor_id and status='reserved';
  if not found then raise exception 'WhatsApp request not found or already finalized'; end if;
end; $$;

revoke all on function public.crm_reserve_whatsapp(uuid,uuid,text,boolean,text,text), public.crm_finish_whatsapp(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.crm_reserve_whatsapp(uuid,uuid,text,boolean,text,text), public.crm_finish_whatsapp(uuid,text,text,text) to service_role;

commit;
