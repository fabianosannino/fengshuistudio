-- ============================================================
-- Restauração de constraints e índices (continuação do incidente)
-- ============================================================
--
-- CONTEXTO
-- Mesma regressão de schema do incidente 2026-07-19 (docs/auditoria/
-- 2026-07-19-incidente-schema-rls-defaults.md): além de policies e defaults,
-- o banco perdeu TODAS as constraints exceto as primary keys — zero FKs,
-- zero uniques, zero checks e zero índices secundários (verificado em
-- pg_constraint/pg_indexes).
--
-- EFEITOS
--   • `upsert(..., { onConflict: 'consulta_id,numero' })` do Ba Guá FALHA
--     (erro 42P10: sem unique não existe ON CONFLICT) — salvar setores
--     estava quebrado mesmo após a restauração de RLS/defaults.
--   • Sem integridade referencial: deletar cliente/consulta deixa órfãos
--     (setores, critérios, fotos, prescrições…).
--   • Idempotência dos webhooks (gateway_subscription_id/gateway_invoice_id)
--     sem unicidade garantida.
--
-- DESENHO
--   1. UNIQUEs críticos ao app (dados verificados: sem duplicatas).
--   2. FKs criadas como NOT VALID (valem para escritas novas sem travar em
--      eventuais órfãos legados) e validadas em seguida; se a validação
--      encontrar órfãos, a FK permanece NOT VALID e fica um NOTICE no log —
--      a migration não falha.
--   3. Índices nas colunas de FK (cascades e joins).
--
-- ON DELETE: CASCADE na cadeia de posse (dono some → dados somem, LGPD);
-- SET NULL em referências opcionais; NO ACTION onde a coluna é NOT NULL
-- sem semântica de cascade (plan_id, autor_id).

-- ── 1. UNIQUEs ───────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_constraint where conname='setores_bagua_consulta_id_numero_key') then
    alter table public.setores_bagua add constraint setores_bagua_consulta_id_numero_key unique (consulta_id, numero);
  end if;
  if not exists (select 1 from pg_constraint where conname='activation_keys_key_key') then
    alter table public.activation_keys add constraint activation_keys_key_key unique (key);
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_store_slug_key') then
    alter table public.profiles add constraint profiles_store_slug_key unique (store_slug);
  end if;
end $$;

-- Idempotência de webhooks: únicos quando presentes (colunas nullable).
create unique index if not exists subscriptions_gateway_subscription_id_key
  on public.subscriptions (gateway_subscription_id) where gateway_subscription_id is not null;
create unique index if not exists invoices_gateway_invoice_id_key
  on public.invoices (gateway_invoice_id) where gateway_invoice_id is not null;
create unique index if not exists store_orders_stripe_session_id_key
  on public.store_orders (stripe_session_id) where stripe_session_id is not null;

-- ── 2. FOREIGN KEYS (NOT VALID → VALIDATE) ───────────────────────────────────

do $$
declare
  fk record;
begin
  for fk in
    select * from (values
      ('profiles','id','auth','users','id','cascade'),
      ('profiles','consultor_id','public','profiles','id','set null'),
      ('clientes','consultor_id','public','profiles','id','cascade'),
      ('clientes','profile_id','public','profiles','id','set null'),
      ('consultas','consultor_id','public','profiles','id','cascade'),
      ('consultas','cliente_id','public','clientes','id','cascade'),
      ('setores_bagua','consulta_id','public','consultas','id','cascade'),
      ('diagnostico_criterios','setor_id','public','setores_bagua','id','cascade'),
      ('prescricoes','consulta_id','public','consultas','id','cascade'),
      ('prescricoes','setor_id','public','setores_bagua','id','set null'),
      ('fotos_consulta','consulta_id','public','consultas','id','cascade'),
      ('fotos_consulta','setor_id','public','setores_bagua','id','set null'),
      ('cronograma_lunar','consulta_id','public','consultas','id','cascade'),
      ('cronograma_lunar','prescricao_id','public','prescricoes','id','set null'),
      ('pagamentos','consultor_id','public','profiles','id','cascade'),
      ('pagamentos','cliente_id','public','clientes','id','set null'),
      ('pagamentos','consulta_id','public','consultas','id','set null'),
      ('rituais','consultor_id','public','profiles','id','cascade'),
      ('rituais','cliente_id','public','clientes','id','set null'),
      ('notificacoes','usuario_id','public','profiles','id','cascade'),
      ('assinaturas','consultor_id','public','profiles','id','cascade'),
      ('consultor_curas_custom','consultor_id','public','profiles','id','cascade'),
      ('subscriptions','user_id','public','profiles','id','cascade'),
      ('subscriptions','plan_id','public','plans','id','no action'),
      ('invoices','user_id','public','profiles','id','cascade'),
      ('invoices','subscription_id','public','subscriptions','id','set null'),
      ('invoices','plan_id','public','plans','id','set null'),
      ('payment_notifications','user_id','public','profiles','id','cascade'),
      ('payment_notifications','invoice_id','public','invoices','id','set null'),
      ('store_orders','seller_id','public','profiles','id','cascade'),
      ('activation_keys','used_by','public','profiles','id','set null'),
      ('activation_keys','created_by','public','profiles','id','set null'),
      ('admin_audit_log','performed_by','public','profiles','id','set null'),
      ('audit_log','usuario_id','public','profiles','id','set null'),
      ('conteudo_admin','autor_id','public','profiles','id','no action')
    ) as t(tbl, col, refschema, reftbl, refcol, ondelete)
  loop
    if not exists (select 1 from pg_constraint where conname = format('fk_%s_%s', fk.tbl, fk.col)) then
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references %I.%I(%I) on delete %s not valid',
        fk.tbl, format('fk_%s_%s', fk.tbl, fk.col), fk.col, fk.refschema, fk.reftbl, fk.refcol, fk.ondelete
      );
    end if;
    -- valida; se houver órfão legado, mantém NOT VALID e segue
    begin
      execute format('alter table public.%I validate constraint %I', fk.tbl, format('fk_%s_%s', fk.tbl, fk.col));
    exception when others then
      raise notice 'FK fk_%_% permanece NOT VALID (órfãos legados): %', fk.tbl, fk.col, sqlerrm;
    end;
  end loop;
end $$;

-- ── 3. ÍNDICES nas colunas de FK ─────────────────────────────────────────────

create index if not exists idx_clientes_consultor_id on public.clientes (consultor_id);
create index if not exists idx_consultas_consultor_id on public.consultas (consultor_id);
create index if not exists idx_consultas_cliente_id on public.consultas (cliente_id);
create index if not exists idx_setores_bagua_consulta_id on public.setores_bagua (consulta_id);
create index if not exists idx_diagnostico_criterios_setor_id on public.diagnostico_criterios (setor_id);
create index if not exists idx_prescricoes_consulta_id on public.prescricoes (consulta_id);
create index if not exists idx_prescricoes_setor_id on public.prescricoes (setor_id);
create index if not exists idx_fotos_consulta_consulta_id on public.fotos_consulta (consulta_id);
create index if not exists idx_fotos_consulta_setor_id on public.fotos_consulta (setor_id);
create index if not exists idx_cronograma_lunar_consulta_id on public.cronograma_lunar (consulta_id);
create index if not exists idx_pagamentos_consultor_id on public.pagamentos (consultor_id);
create index if not exists idx_pagamentos_cliente_id on public.pagamentos (cliente_id);
create index if not exists idx_rituais_consultor_id on public.rituais (consultor_id);
create index if not exists idx_rituais_cliente_id on public.rituais (cliente_id);
create index if not exists idx_notificacoes_usuario_id on public.notificacoes (usuario_id);
create index if not exists idx_assinaturas_consultor_id on public.assinaturas (consultor_id);
create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);
create index if not exists idx_invoices_user_id on public.invoices (user_id);
create index if not exists idx_payment_notifications_user_id on public.payment_notifications (user_id);
create index if not exists idx_store_orders_seller_id on public.store_orders (seller_id);
create index if not exists idx_profiles_stripe_customer_id on public.profiles (stripe_customer_id);
