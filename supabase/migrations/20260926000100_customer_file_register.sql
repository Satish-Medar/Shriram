create table if not exists public.customer_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_name text not null,
  customer_name text not null,
  file_date date not null,
  documents jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.customer_files enable row level security;

drop policy if exists "Users can view their customer files" on public.customer_files;
create policy "Users can view their customer files"
  on public.customer_files for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add their customer files" on public.customer_files;
create policy "Users can add their customer files"
  on public.customer_files for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their customer files" on public.customer_files;
create policy "Users can update their customer files"
  on public.customer_files for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their customer files" on public.customer_files;
create policy "Users can delete their customer files"
  on public.customer_files for delete
  using (auth.uid() = user_id);
