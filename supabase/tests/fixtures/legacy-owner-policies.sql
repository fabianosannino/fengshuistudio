-- Synthetic owner relations matching the policy graph (not a full schema).
create table public.consultas(id uuid primary key, consultor_id uuid);
create function public.consulta_pertence_ao_usuario(p_consulta_id uuid)
returns boolean language sql stable set search_path=public as $$
  select exists(select 1 from public.consultas where id=p_consulta_id and consultor_id=auth.uid());
$$;
create table public.setores_bagua(id uuid primary key, consulta_id uuid);
create table public.diagnostico_criterios(id uuid primary key, setor_id uuid);
create table public.pedidos(id uuid primary key, vendedor_perfil_id uuid);
create table public.payment_notifications(id uuid primary key, user_id uuid, read_at timestamptz, content text);
create table public.plans(id uuid primary key, slug text);
create table public.produtos_afiliados(id uuid primary key, nome text);
do $$ declare tab text; begin
  foreach tab in array array['clientes','consultor_checklist_chi_custom','consultor_curas_custom','pagamentos','rituais'] loop
    execute format('create table public.%I(id uuid primary key, consultor_id uuid)',tab);
  end loop;
  foreach tab in array array['cronograma_lunar','diagnostico_snapshots','fotos_consulta','prescricoes'] loop
    execute format('create table public.%I(id uuid primary key, consulta_id uuid)',tab);
  end loop;
  foreach tab in array array['pedido_eventos','pedido_itens','pedido_lancamentos'] loop
    execute format('create table public.%I(id uuid primary key, pedido_id uuid)',tab);
  end loop;
end $$;
create table public.notificacoes(id uuid primary key, usuario_id uuid);
create table public.servicos_do_parceiro(id uuid primary key, perfil_id uuid);
do $$ declare tab text; begin
  foreach tab in array array['clientes','consultas','consultor_checklist_chi_custom','consultor_curas_custom','pagamentos','rituais','notificacoes','servicos_do_parceiro','cronograma_lunar','diagnostico_snapshots','fotos_consulta','prescricoes','setores_bagua','diagnostico_criterios','pedidos','pedido_eventos','pedido_itens','pedido_lancamentos','payment_notifications','plans','produtos_afiliados'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('grant all on public.%I to anon, authenticated, service_role',tab);
  end loop;
end $$;
create policy consultor_gerencia_clientes on public.clientes for all to authenticated
  using(consultor_id=auth.uid() or public.is_admin()) with check(consultor_id=auth.uid() or public.is_admin());
create policy "Admin gerencia planos" on public.plans for all to authenticated using(public.is_admin());
create policy public_read_plans on public.plans for select using(true);
create policy produtos_afiliados_escrita on public.produtos_afiliados for all to authenticated using(public.is_admin());
create policy public_read_affiliates on public.produtos_afiliados for select using(true);
