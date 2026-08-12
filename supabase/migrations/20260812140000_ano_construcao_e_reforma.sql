-- ============================================================================
-- Ano de construção e ano da última reforma estrutural na consulta
--
-- ## O que muda
--
-- O período (Yun 運) da carta natal de Estrelas Voadoras vinha de um campo
-- `<input type="date">` guardado dentro do JSONB `bagua_entrada`
-- (`data_construcao`), só na escola bússola. Dois problemas:
--
-- 1. **Pedia um dado que ninguém tem.** O consultor sabe que o prédio é «de
--    2024»; o dia da conclusão da obra, quase nunca. Preencher 01/01 para
--    satisfazer o campo muda a carta: o período usa o **ano solar**, que começa
--    no Li Chun (≈4 de fevereiro), então 2024-01-01 cai no Período 8, não no 9.
--    O campo obrigava a inventar, e o inventado alterava o resultado.
--
-- 2. **Não distinguia construção de reforma estrutural.** O documento-mestre
--    (§1.5) diz que a carta usa o período da construção *ou o da última reforma
--    estrutural relevante* — troca de telhado, remoção/adição de paredes
--    estruturais, mudança da fachada. Um campo só não guarda os dois, e a
--    Parte V lista ambos como entrada obrigatória do levantamento.
--
-- Colunas, e não mais uma chave no JSONB, porque isto é dado estruturado do
-- imóvel, entra em cálculo e precisa de CHECK.
--
-- ## O que NÃO muda
--
-- `bagua_entrada->>'data_construcao'` continua sendo lido: as consultas
-- existentes têm o valor lá e ele é a única fonte para elas. O backfill abaixo
-- copia o ano dessas datas, mas a data original é preservada — nada é apagado.
-- ============================================================================

alter table public.consultas
  add column if not exists ano_construcao integer,
  add column if not exists ano_reforma_estrutural integer;

-- 1864 é o início do ciclo San Yuan que sabemos calcular (ver
-- src/lib/periodo-sanyuan.ts). O teto é folgado de propósito: obra em andamento
-- com entrega prevista é caso real, e um limite apertado viraria bug em 2027.
alter table public.consultas
  drop constraint if exists consultas_ano_construcao_plausivel;
alter table public.consultas
  add constraint consultas_ano_construcao_plausivel
  check (ano_construcao is null or (ano_construcao between 1864 and 2200));

alter table public.consultas
  drop constraint if exists consultas_ano_reforma_plausivel;
alter table public.consultas
  add constraint consultas_ano_reforma_plausivel
  check (ano_reforma_estrutural is null or (ano_reforma_estrutural between 1864 and 2200));

-- Reforma anterior à construção **não** é bloqueada por constraint. É dado
-- incoerente, mas quem descobre isso é o consultor no meio do levantamento, e
-- travar o save faria ele perder o resto do formulário. A tela cobra a
-- incoerência (`reformaIncoerente`) e o cálculo ignora a reforma nesse caso.

comment on column public.consultas.ano_construcao is
  'Ano civil da construção. O período San Yuan sai daqui — ver src/lib/periodo-do-imovel.ts.';
comment on column public.consultas.ano_reforma_estrutural is
  'Ano da última reforma estrutural relevante (telhado, paredes estruturais, fachada). Quando posterior à construção, substitui o período da construção na carta natal (§1.5 do documento-mestre).';

-- ── Backfill ────────────────────────────────────────────────────────────────
--
-- Só o **ano** das datas já gravadas. O dia/mês dessas datas é, na maioria dos
-- casos, o 01/01 que o campo obrigava a inventar — copiá-lo para uma coluna
-- nova propagaria a invenção. O ano é a parte que o consultor de fato sabia.
--
-- `where ano_construcao is null` para ser reexecutável sem sobrescrever o que
-- alguém já tiver informado no campo novo.
update public.consultas
set ano_construcao = nullif(substring(bagua_entrada->>'data_construcao' from 1 for 4), '')::integer
where ano_construcao is null
  and bagua_entrada->>'data_construcao' ~ '^\d{4}-\d{2}-\d{2}$'
  and substring(bagua_entrada->>'data_construcao' from 1 for 4)::integer between 1864 and 2200;

-- ── Verificação ─────────────────────────────────────────────────────────────
--
--   select count(*) filter (where ano_construcao is not null) as com_ano,
--          count(*) filter (where bagua_entrada->>'data_construcao' is not null) as com_data
--   from public.consultas;
--
-- `com_ano` deve ser >= `com_data` menos as datas fora do intervalo plausível.
