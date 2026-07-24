-- ============================================================
-- Ming Gua (número Kua) — coluna genero em clientes
-- ============================================================
--
-- O cálculo clássico do Ming Gua usa ano de nascimento (ajustado ao ano
-- solar) e GÊNERO — fórmulas diferentes para masculino/feminino.
-- `clientes.data_nascimento` já existe (nunca foi usada pela UI até aqui);
-- esta migration adiciona o que falta.
--
-- Nullable de propósito: dado opcional (LGPD — coletar só o necessário,
-- com finalidade clara: personalizar o diagnóstico). Sem enum novo para
-- não travar evolução; validação fica na camada de domínio (fail-closed:
-- valor desconhecido → Ming Gua simplesmente não é calculado).

alter table public.clientes
  add column if not exists genero text;

comment on column public.clientes.genero is
  'Opcional; usado apenas para o cálculo do Ming Gua (masculino/feminino).';
