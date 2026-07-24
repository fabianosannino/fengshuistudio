-- ============================================================
-- Snapshots do diagnóstico — comparativo antes/depois
-- ============================================================
--
-- Fecha o ciclo de efetividade do produto: ao finalizar o diagnóstico do
-- Ba Guá, os scores por setor são registrados como snapshot. Quando o
-- consultor revisa a análise mais tarde (após o cliente aplicar as curas)
-- e finaliza de novo, nasce um snapshot de reavaliação — e o relatório
-- passa a mostrar a EVOLUÇÃO (antes → depois) por setor, a prova de que o
-- trabalho funcionou.
--
-- Regras:
--   • 1º snapshot da consulta = 'inicial'; os demais = 'reavaliacao'.
--   • Snapshots idênticos consecutivos não são gravados (re-finalizar sem
--     mudar nada não gera histórico falso) — deduplicação na aplicação.
--   • RLS por posse da consulta (mesmo padrão da cadeia do consultor).

create table if not exists public.diagnostico_snapshots (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references public.consultas(id) on delete cascade,
  tipo text not null check (tipo in ('inicial', 'reavaliacao')),
  -- array de { numero, nome, score } por setor no momento da finalização
  scores jsonb not null,
  criado_em timestamptz not null default now()
);

alter table public.diagnostico_snapshots enable row level security;

drop policy if exists "consultor_gerencia_diagnostico_snapshots" on public.diagnostico_snapshots;
create policy "consultor_gerencia_diagnostico_snapshots" on public.diagnostico_snapshots
  for all to authenticated
  using (public.consulta_pertence_ao_usuario(consulta_id) or public.is_admin())
  with check (public.consulta_pertence_ao_usuario(consulta_id) or public.is_admin());

create index if not exists idx_diagnostico_snapshots_consulta_id
  on public.diagnostico_snapshots (consulta_id, criado_em);
