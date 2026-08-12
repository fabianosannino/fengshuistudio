-- ============================================================================
-- Pontos personalizados do Fluxo de Chi saem do navegador para o banco
--
-- ## O que muda
--
-- Os pontos que o consultor acrescenta ao checklist viviam em `localStorage`
-- (`usePreferenciaLista(PREFERENCIA_ITENS_CHI)`). Consequências:
--
-- - somem ao trocar de aparelho ou limpar o navegador;
-- - não chegam ao relatório do cliente, que é o entregável;
-- - e, ainda assim, **entravam no denominador do score** — um ponto que só
--   existe no navegador do consultor derrubava a pontuação do imóvel.
--
-- Este é o mesmo padrão de `consultor_curas_custom`, que já existe e resolve o
-- mesmo problema para as curas: tabela por consultor, RLS pela posse.
--
-- Nomeada com timestamp (YYYYMMDDHHMMSS) conforme a convenção adotada hoje —
-- ver CLAUDE.md, achado A9.
-- ============================================================================

create table if not exists public.consultor_checklist_chi_custom (
  id uuid primary key default gen_random_uuid(),
  consultor_id uuid not null references public.profiles(id) on delete cascade,
  -- `item_id` é o identificador usado no `checklist_chi` da consulta. Ele é
  -- gerado no cliente e precisa ser estável, porque é a chave que liga o ponto
  -- ao estado gravado em cada consulta.
  item_id text not null,
  label text not null,
  categoria text not null,
  criado_em timestamptz not null default now(),
  -- Dois pontos com o mesmo id no mesmo consultor quebrariam o vínculo com o
  -- estado gravado nas consultas.
  unique (consultor_id, item_id)
);

create index if not exists idx_checklist_chi_custom_consultor
  on public.consultor_checklist_chi_custom (consultor_id);

alter table public.consultor_checklist_chi_custom enable row level security;

-- Mesma policy de `consultor_curas_custom`: o dono gerencia o que é dele, e o
-- admin enxerga para suporte. `to authenticated` porque anon não tem
-- `auth.uid()` e não casaria com nada — ver a migration do advisor de 11/08.
drop policy if exists "consultor_gerencia_checklist_chi_custom"
  on public.consultor_checklist_chi_custom;
create policy "consultor_gerencia_checklist_chi_custom"
  on public.consultor_checklist_chi_custom
  for all to authenticated
  using (consultor_id = auth.uid() or public.is_admin())
  with check (consultor_id = auth.uid() or public.is_admin());

-- ── Verificação ─────────────────────────────────────────────────────────────
--
--   select policyname, roles from pg_policies
--   where tablename = 'consultor_checklist_chi_custom';
--
-- Como o dado vivia só no navegador, não há backfill possível: o que estava no
-- localStorage de cada consultor continua lá e não é alcançável daqui. Os
-- pontos precisam ser recriados uma vez — são poucos, e a alternativa seria
-- inventar linhas que ninguém pode conferir.
