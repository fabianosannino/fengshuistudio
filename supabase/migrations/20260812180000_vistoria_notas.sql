-- ============================================================================
-- Notas por ponto do checklist de Chi (modo vistoria)
--
-- ## Por que uma coluna nova
--
-- `checklist_chi` guarda item → estado (`conforme` | `problema`). Enfiar a nota
-- lá dentro transformaria o valor de cada item num objeto e quebraria
-- `normalizarChecklist`, que hoje só aceita string. Coluna separada mantém o
-- checklist com uma forma só.
--
-- O formato é `{ "<item_id>": "texto da nota" }` — o mesmo `item_id` do
-- checklist, para as duas coisas casarem sem tabela de ligação.
--
-- ## O que a nota é
--
-- O que o consultor observou naquele ponto, escrito na hora, andando pela casa
-- («porta raspa no batente», «espelho reflete a porta pela metade»). É o
-- detalhe que se perde entre a visita e o relatório.
-- ============================================================================

alter table public.consultas
  add column if not exists vistoria_notas jsonb;

comment on column public.consultas.vistoria_notas is
  'Notas por ponto do checklist de Chi: { "<item_id>": "texto" }. Mesmo item_id de checklist_chi.';
