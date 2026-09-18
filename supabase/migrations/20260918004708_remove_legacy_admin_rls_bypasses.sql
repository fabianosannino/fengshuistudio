-- Administrative cross-tenant operations belong to capability-guarded server
-- routes. An admin JWT alone never grants direct access to another owner.
begin;

do $$
declare rule record;
begin
  for rule in select * from (values
    ('clientes', 'consultor_gerencia_clientes', 'consultor_id = (select auth.uid())'),
    ('consultas', 'consultor_gerencia_consultas', 'consultor_id = (select auth.uid())'),
    ('consultor_checklist_chi_custom', 'consultor_gerencia_checklist_chi_custom', 'consultor_id = (select auth.uid())'),
    ('consultor_curas_custom', 'consultor_gerencia_consultor_curas_custom', 'consultor_id = (select auth.uid())'),
    ('pagamentos', 'consultor_gerencia_pagamentos', 'consultor_id = (select auth.uid())'),
    ('rituais', 'consultor_gerencia_rituais', 'consultor_id = (select auth.uid())'),
    ('notificacoes', 'usuario_gerencia_notificacoes', 'usuario_id = (select auth.uid())'),
    ('servicos_do_parceiro', 'dono gerencia os proprios servicos', 'perfil_id = (select auth.uid())'),
    ('cronograma_lunar', 'consultor_gerencia_cronograma_lunar', 'public.consulta_pertence_ao_usuario(consulta_id)'),
    ('diagnostico_snapshots', 'consultor_gerencia_diagnostico_snapshots', 'public.consulta_pertence_ao_usuario(consulta_id)'),
    ('fotos_consulta', 'consultor_gerencia_fotos_consulta', 'public.consulta_pertence_ao_usuario(consulta_id)'),
    ('prescricoes', 'consultor_gerencia_prescricoes', 'public.consulta_pertence_ao_usuario(consulta_id)'),
    ('setores_bagua', 'consultor_gerencia_setores_bagua', 'public.consulta_pertence_ao_usuario(consulta_id)'),
    ('diagnostico_criterios', 'consultor_gerencia_diagnostico_criterios',
      'exists (select 1 from public.setores_bagua s where s.id = diagnostico_criterios.setor_id and public.consulta_pertence_ao_usuario(s.consulta_id))')
  ) as rules(tab, policy_name, owner_expression)
  loop
    execute format('drop policy if exists %I on public.%I', rule.policy_name, rule.tab);
    execute format('create policy %I on public.%I for all to authenticated using (%s) with check (%s)',
      rule.policy_name, rule.tab, rule.owner_expression, rule.owner_expression);
    -- RLS does not apply to TRUNCATE. Keep only ordinary owner CRUD grants.
    execute format('revoke truncate, references, trigger, maintain on public.%I from anon, authenticated', rule.tab);
  end loop;
end $$;

drop policy if exists "vendedor le os proprios pedidos" on public.pedidos;
create policy "vendedor le os proprios pedidos" on public.pedidos for select to authenticated
  using (vendedor_perfil_id = (select auth.uid()));

do $$
declare rule record;
begin
  for rule in select * from (values
    ('pedido_eventos','vendedor le os eventos dos proprios pedidos'),
    ('pedido_itens','vendedor le os itens dos proprios pedidos'),
    ('pedido_lancamentos','vendedor le os lancamentos dos proprios pedidos')
  ) as rules(tab, policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', rule.policy_name, rule.tab);
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.pedidos p where p.id = pedido_id and p.vendedor_perfil_id = (select auth.uid())))', rule.policy_name, rule.tab);
  end loop;
end $$;

revoke all on public.pedidos, public.pedido_eventos, public.pedido_itens,
  public.pedido_lancamentos from anon, authenticated;
grant select on public.pedidos, public.pedido_eventos, public.pedido_itens,
  public.pedido_lancamentos to authenticated;

drop policy if exists "Admin gerencia planos" on public.plans;
drop policy if exists produtos_afiliados_escrita on public.produtos_afiliados;
revoke insert, update, delete, truncate, references, trigger, maintain
  on public.plans, public.produtos_afiliados from anon, authenticated;

drop policy if exists "Admin cria payment_notifications" on public.payment_notifications;
drop policy if exists "Admin deleta payment_notifications" on public.payment_notifications;
drop policy if exists "Usuário atualiza próprias notificações" on public.payment_notifications;
drop policy if exists "Usuário lê próprias notificações" on public.payment_notifications;
create policy payment_notifications_select_own on public.payment_notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy payment_notifications_update_own on public.payment_notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.payment_notifications from anon, authenticated;
grant select, update(read_at) on public.payment_notifications to authenticated;

-- Keep the legacy predicate safe for any remaining uses outside these tables.
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select coalesce(auth.jwt()->>'aal' = 'aal2', false) and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'ativo'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

commit;
