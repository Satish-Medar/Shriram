drop policy if exists "Owner and agents can view customer files"
  on public.customer_files;

create policy "Owner sees all and agents see their own customer files"
  on public.customer_files for select to authenticated
  using (
    public.current_app_role() = 'owner'
    or (
      public.current_app_role() = 'agent'
      and user_id = auth.uid()
      and agent_name = public.current_agent_name()
    )
  );
