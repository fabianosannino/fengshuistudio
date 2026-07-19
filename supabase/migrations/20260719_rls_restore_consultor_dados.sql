-- ============================================================
-- Restauração de RLS — dados do consultor (achado da auditoria)
-- ============================================================
--
-- CONTEXTO
-- O advisor de segurança do Supabase e uma verificação direta no catálogo
-- (pg_policy) mostraram que várias tabelas centrais estavam com RLS LIGADO
-- porém SEM NENHUMA POLICY. Isso é deny-all: o papel `authenticated` (o
-- cliente do navegador, após login) não conseguia ler nem escrever as
-- próprias linhas. Efeitos observados:
--   • `diagnostico_criterios` sempre vazia — o INSERT batia no deny-all e
--     falhava em silêncio (o código não checava o erro). O diagnóstico só
--     sobrevivia no JSONB de `consultas.bagua_entrada`.
--   • Telas que leem/escrevem as tabelas direto (Ba Guá, detalhe da consulta,
--     relatório) ficavam bloqueadas; o dashboard só funcionava por acaso,
--     via views SECURITY DEFINER que furam o RLS.
--
-- ESCOPO DESTE ARQUIVO
-- Apenas as tabelas de dados do CONSULTOR, cuja regra de posse é inequívoca
-- (`consultor_id = auth.uid()` ou a cadeia até `consultas.consultor_id`).
-- Cada policy só concede ao dono acesso às PRÓPRIAS linhas (ou a um admin),
-- então não há como expor dado entre consultores.
--
-- FORA DE ESCOPO (ficam para um PR próprio, precisam de decisão de produto):
--   • `profiles` — o diretório de parceiros, a loja por slug e a lista de
--     consultores leem `profiles` direto pelo cliente anon; exige policy de
--     leitura pública restrita a colunas não-PII (ou uma view pública).
--   • Tabelas de admin (`activation_keys`, `conteudo_admin`, `weekly_reports`,
--     `admin_audit_log`, `audit_log`) — regra de acesso admin/serviço.
--
-- Escritas privilegiadas (webhooks, rotas de API) usam `service_role`, que
-- ignora RLS — estas policies não as afetam.

-- Helper de posse via consulta (evita repetir o EXISTS). SECURITY INVOKER:
-- roda com o RLS do chamador, então continua seguro.
create or replace function public.consulta_pertence_ao_usuario(p_consulta_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.consultas c
    where c.id = p_consulta_id
      and c.consultor_id = auth.uid()
  );
$$;

-- ── Tabelas com consultor_id direto ─────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['consultas','clientes','pagamentos','rituais','consultor_curas_custom','assinaturas']
  loop
    execute format('drop policy if exists "consultor_gerencia_%1$s" on public.%1$s', t);
    execute format($f$
      create policy "consultor_gerencia_%1$s" on public.%1$s
        for all to authenticated
        using (consultor_id = auth.uid() or public.is_admin())
        with check (consultor_id = auth.uid() or public.is_admin())
    $f$, t);
  end loop;
end $$;

-- ── notificacoes: posse por usuario_id ──────────────────────────────────────
drop policy if exists "usuario_gerencia_notificacoes" on public.notificacoes;
create policy "usuario_gerencia_notificacoes" on public.notificacoes
  for all to authenticated
  using (usuario_id = auth.uid() or public.is_admin())
  with check (usuario_id = auth.uid() or public.is_admin());

-- ── setores_bagua: posse via consulta ───────────────────────────────────────
drop policy if exists "consultor_gerencia_setores_bagua" on public.setores_bagua;
create policy "consultor_gerencia_setores_bagua" on public.setores_bagua
  for all to authenticated
  using (public.consulta_pertence_ao_usuario(consulta_id) or public.is_admin())
  with check (public.consulta_pertence_ao_usuario(consulta_id) or public.is_admin());

-- ── prescricoes / fotos_consulta / cronograma_lunar: posse via consulta ─────
do $$
declare t text;
begin
  foreach t in array array['prescricoes','fotos_consulta','cronograma_lunar']
  loop
    execute format('drop policy if exists "consultor_gerencia_%1$s" on public.%1$s', t);
    execute format($f$
      create policy "consultor_gerencia_%1$s" on public.%1$s
        for all to authenticated
        using (public.consulta_pertence_ao_usuario(consulta_id) or public.is_admin())
        with check (public.consulta_pertence_ao_usuario(consulta_id) or public.is_admin())
    $f$, t);
  end loop;
end $$;

-- ── diagnostico_criterios: posse via setor → consulta ───────────────────────
drop policy if exists "consultor_gerencia_diagnostico_criterios" on public.diagnostico_criterios;
create policy "consultor_gerencia_diagnostico_criterios" on public.diagnostico_criterios
  for all to authenticated
  using (
    exists (
      select 1 from public.setores_bagua s
      where s.id = diagnostico_criterios.setor_id
        and public.consulta_pertence_ao_usuario(s.consulta_id)
    ) or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.setores_bagua s
      where s.id = diagnostico_criterios.setor_id
        and public.consulta_pertence_ao_usuario(s.consulta_id)
    ) or public.is_admin()
  );
