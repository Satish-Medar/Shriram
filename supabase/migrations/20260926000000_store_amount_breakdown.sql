alter table public.daily_reports
add column if not exists amount_breakdown jsonb not null default '{}'::jsonb;