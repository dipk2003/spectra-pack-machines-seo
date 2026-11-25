begin;

create table if not exists public.crm_lead_email_notifications (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent')),
  attempts integer not null default 0,
  claim_token uuid,
  locked_until timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.crm_lead_email_notifications enable row level security;
revoke all on public.crm_lead_email_notifications from public, anon, authenticated;
grant select, insert, update on public.crm_lead_email_notifications to service_role;

create or replace function public.queue_crm_lead_email()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.crm_lead_email_notifications(lead_id) values(new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.queue_crm_lead_email() from public, anon, authenticated;
drop trigger if exists queue_crm_lead_email on public.leads;
create trigger queue_crm_lead_email after insert on public.leads
for each row execute function public.queue_crm_lead_email();

create or replace function public.claim_crm_lead_notifications(p_lead_id uuid default null, p_limit integer default 10)
returns setof public.crm_lead_email_notifications
language sql security definer set search_path = public, pg_temp as $$
  with candidates as (
    select lead_id from public.crm_lead_email_notifications
    where status <> 'sent' and (locked_until is null or locked_until < now())
      and (p_lead_id is null or lead_id = p_lead_id)
    order by created_at limit greatest(1, least(coalesce(p_limit, 10), 20))
    for update skip locked
  )
  update public.crm_lead_email_notifications n
    set status = 'processing', attempts = attempts + 1,
        claim_token = gen_random_uuid(), locked_until = now() + interval '5 minutes'
    from candidates c where n.lead_id = c.lead_id returning n.*;
$$;
revoke all on function public.claim_crm_lead_notifications(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_crm_lead_notifications(uuid, integer) to service_role;

-- Future leads only: do not email historical customers during deployment.
notify pgrst, 'reload schema';
commit;
