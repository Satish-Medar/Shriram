create table if not exists public.app_user_roles (
  email text primary key,
  role text not null check (role in ('owner', 'report2', 'agent')),
  agent_name text,
  created_at timestamptz not null default now(),
  check ((role = 'agent') = (agent_name is not null))
);

insert into public.app_user_roles (email, role, agent_name)
values
  ('satishmedar5@gmail.com', 'owner', null),
  ('nutan@gmail.com', 'report2', null),
  ('surykanth@gmail.com', 'agent', 'Surykanth'),
  ('babupawne@gmail.com', 'agent', 'Babu Pawne'),
  ('akash@gmail.com', 'agent', 'Akash')
on conflict (email) do update set
  role = excluded.role,
  agent_name = excluded.agent_name;

alter table public.app_user_roles enable row level security;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.app_user_roles
      where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    ),
    'unassigned'
  );
$$;

create or replace function public.current_agent_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select agent_name
  from public.app_user_roles
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and role = 'agent';
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.current_agent_name() from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_agent_name() to authenticated;
revoke all on public.app_user_roles from anon, authenticated, public;
grant select on public.app_user_roles to authenticated;

drop policy if exists "Users can read their assigned role" on public.app_user_roles;
create policy "Users can read their assigned role"
  on public.app_user_roles for select to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.current_app_role() = 'owner'
  );

-- Customer files are shared for reading by the owner and agents. Agents can
-- create records only under their assigned agent name; only the owner edits.
alter table public.customer_files enable row level security;
drop policy if exists "Users can view their customer files" on public.customer_files;
drop policy if exists "Users can add their customer files" on public.customer_files;
drop policy if exists "Users can update their customer files" on public.customer_files;
drop policy if exists "Users can delete their customer files" on public.customer_files;

drop policy if exists "Owner and agents can view customer files" on public.customer_files;
create policy "Owner and agents can view customer files"
  on public.customer_files for select to authenticated
  using (public.current_app_role() in ('owner', 'agent'));

drop policy if exists "Owner and agents can add customer files" on public.customer_files;
create policy "Owner and agents can add customer files"
  on public.customer_files for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.current_app_role() = 'owner'
      or (
        public.current_app_role() = 'agent'
        and agent_name = public.current_agent_name()
      )
    )
  );

drop policy if exists "Owner can update customer files" on public.customer_files;
create policy "Owner can update customer files"
  on public.customer_files for update to authenticated
  using (public.current_app_role() = 'owner')
  with check (public.current_app_role() = 'owner');

drop policy if exists "Owner can delete customer files" on public.customer_files;
create policy "Owner can delete customer files"
  on public.customer_files for delete to authenticated
  using (public.current_app_role() = 'owner');

-- Report 1 remains accessible only to the owner account.
alter table public.daily_reports enable row level security;
do $$
declare existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'daily_reports'
  loop
    execute format(
      'drop policy if exists %I on public.daily_reports',
      existing_policy.policyname
    );
  end loop;
end;
$$;

create policy "Owner manages daily report 1"
  on public.daily_reports for all to authenticated
  using (public.current_app_role() = 'owner')
  with check (public.current_app_role() = 'owner');

-- Report 2 has its own table so the Report 2 editor cannot access Report 1.
create table if not exists public.daily_report2 (
  report_date date primary key,
  updated_by uuid not null references auth.users(id),
  new_tw_cases integer not null default 0,
  new_tw_amount numeric not null default 0,
  eh_tw_cases integer not null default 0,
  eh_tw_amount numeric not null default 0,
  used_tw_cases integer not null default 0,
  used_tw_amount numeric not null default 0,
  spl_cases integer not null default 0,
  spl_amount numeric not null default 0,
  cspl_cases integer not null default 0,
  cspl_amount numeric not null default 0,
  amount_breakdown jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.daily_report2 (
  report_date,
  updated_by,
  new_tw_cases,
  new_tw_amount,
  eh_tw_cases,
  eh_tw_amount,
  used_tw_cases,
  used_tw_amount,
  spl_cases,
  spl_amount,
  cspl_cases,
  cspl_amount,
  amount_breakdown,
  updated_at
)
select
  report.date,
  owner_user.id,
  coalesce(report.new_tw_cases, 0),
  coalesce(report.new_tw_amount, 0),
  coalesce(report.eh_tw_cases, 0),
  coalesce(report.eh_tw_amount, 0),
  coalesce(report.used_tw_cases, 0),
  coalesce(report.used_tw_amount, 0),
  coalesce(report.spl_cases, 0),
  coalesce(report.spl_amount, 0),
  coalesce(report.cspl_cases, 0),
  coalesce(report.cspl_amount, 0),
  jsonb_build_object(
    'newTwAmount', coalesce(report.amount_breakdown -> 'newTwAmount', jsonb_build_array(coalesce(report.new_tw_amount, 0)::text)),
    'ehTwAmount', coalesce(report.amount_breakdown -> 'ehTwAmount', jsonb_build_array(coalesce(report.eh_tw_amount, 0)::text)),
    'usedTwAmount', coalesce(report.amount_breakdown -> 'usedTwAmount', jsonb_build_array(coalesce(report.used_tw_amount, 0)::text)),
    'splAmount', coalesce(report.amount_breakdown -> 'splAmount', jsonb_build_array(coalesce(report.spl_amount, 0)::text)),
    'csplAmount', coalesce(report.amount_breakdown -> 'csplAmount', jsonb_build_array(coalesce(report.cspl_amount, 0)::text))
  ),
  coalesce(report.updated_at, now())
from public.daily_reports report
join auth.users owner_user on owner_user.id = report.user_id
join public.app_user_roles owner_role
  on lower(owner_role.email) = lower(owner_user.email)
  and owner_role.role = 'owner'
on conflict (report_date) do nothing;

alter table public.daily_report2 enable row level security;
revoke all on public.daily_report2 from anon, authenticated, public;
grant select, insert, update, delete on public.daily_report2 to authenticated;

drop policy if exists "Owner and Report 2 editor can read report 2" on public.daily_report2;
create policy "Owner and Report 2 editor can read report 2"
  on public.daily_report2 for select to authenticated
  using (public.current_app_role() in ('owner', 'report2'));

drop policy if exists "Owner and Report 2 editor can create report 2" on public.daily_report2;
create policy "Owner and Report 2 editor can create report 2"
  on public.daily_report2 for insert to authenticated
  with check (
    public.current_app_role() in ('owner', 'report2')
    and updated_by = auth.uid()
  );

drop policy if exists "Owner and Report 2 editor can update report 2" on public.daily_report2;
create policy "Owner and Report 2 editor can update report 2"
  on public.daily_report2 for update to authenticated
  using (public.current_app_role() in ('owner', 'report2'))
  with check (
    public.current_app_role() in ('owner', 'report2')
    and updated_by = auth.uid()
  );

drop policy if exists "Owner can delete report 2" on public.daily_report2;
create policy "Owner can delete report 2"
  on public.daily_report2 for delete to authenticated
  using (public.current_app_role() = 'owner');

create or replace function public.get_report2_gold(p_report_date date)
returns table (gold_cases integer, gold_amount numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare owner_id uuid;
begin
  if public.current_app_role() not in ('owner', 'report2') then
    raise exception 'Not authorized to read Report 2 GOLD values';
  end if;

  select u.id into owner_id
  from auth.users u
  join public.app_user_roles r on lower(r.email) = lower(u.email)
  where r.role = 'owner'
  limit 1;

  return query
  select
    coalesce((
      select count(*)::integer
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(dr.amount_breakdown -> 'freshBusiness') = 'array'
            then dr.amount_breakdown -> 'freshBusiness'
          else '[]'::jsonb
        end
      ) as amounts(value)
      where btrim(amounts.value) <> ''
    ), 0) as gold_cases,
    (coalesce(dr.fresh_business, 0) + coalesce(dr.renewal_business, 0))::numeric as gold_amount
  from public.daily_reports dr
  where dr.user_id = owner_id
    and dr.date = p_report_date
  union all
  select 0, 0
  where not exists (
    select 1 from public.daily_reports dr
    where dr.user_id = owner_id and dr.date = p_report_date
  )
  limit 1;
end;
$$;

revoke all on function public.get_report2_gold(date) from public;
grant execute on function public.get_report2_gold(date) to authenticated;
