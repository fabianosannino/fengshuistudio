-- ============================================================================
-- Prescrição: quando a cura foi aplicada
--
-- ## Por que
--
-- `prescricoes` existe desde a restauração de constraints de 20/07 e **nunca
-- foi escrita por ninguém**: `/curas` era um catálogo por elemento, sem ligação
-- com o diagnóstico, e o que o consultor escolhia não ficava gravado em lugar
-- nenhum. O relatório, o ritual e a loja não sabiam de nada disso.
--
-- Com a tela de prescrição (onda 3d) a tabela passa a ser escrita. Falta o
-- estado que fecha o ciclo: a cura foi aplicada ou não.
--
-- `aplicada_em timestamptz` em vez de `aplicada boolean` porque a data responde
-- as duas perguntas — se foi e quando — e um booleano só responde a primeira.
-- «Aplicada em 09/08» é o que a tela do cliente mostra.
--
-- Nulo é «ainda não aplicada», que é o estado da esmagadora maioria das linhas
-- no momento em que são criadas. Não há DEFAULT: uma prescrição nasce pendente.
-- ============================================================================

alter table public.prescricoes
  add column if not exists aplicada_em timestamptz;

comment on column public.prescricoes.aplicada_em is
  'Quando o morador aplicou a cura. Nulo = ainda não aplicada. Ver src/lib/prescricao.ts.';

-- `objeto` passa a guardar «<setor>|<chave-da-biblioteca>» — a ligação estável
-- entre a linha gravada e o item de `src/lib/curas.ts`. O nome do item muda
-- quando alguém revisa o texto; a chave não.
comment on column public.prescricoes.objeto is
  'Chave da cura na biblioteca, no formato «<nome do setor>|<tipo:indice>». Ver montarPrescricao em src/lib/prescricao.ts.';

create index if not exists idx_prescricoes_aplicada
  on public.prescricoes (consulta_id, aplicada_em);

-- ── Verificação ─────────────────────────────────────────────────────────────
--
--   select count(*) filter (where aplicada_em is null) as pendentes,
--          count(*) filter (where aplicada_em is not null) as aplicadas
--   from public.prescricoes;
--
-- Logo após aplicar, `aplicadas` é 0 e `pendentes` é o total — não há backfill
-- possível nem desejável: ninguém registrou aplicação de cura até hoje, e
-- inventar datas produziria um histórico que nunca aconteceu.
