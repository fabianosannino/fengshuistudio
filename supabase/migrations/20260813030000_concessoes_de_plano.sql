-- ═══════════════════════════════════════════════════════════════════════════
-- `concessoes_de_plano` — de onde vem o plano de cada usuário
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## O defeito que originou isto
--
-- Em 13/08/2026, o cancelamento de uma assinatura do Simples rebaixou para o
-- gratuito um perfil que tinha Profissional **por outra via** — chave de
-- ativação. A regra «assinatura cancelada rebaixa» está certa; o que faltava
-- era saber que aquele Profissional não vinha daquela assinatura.
--
-- `profiles.plano` guarda **o quê** sem guardar **de onde**. Com uma fonte só
-- isso funciona. Com quatro — assinatura, chave, cortesia, ajuste manual —
-- cada uma pode encerrar a outra, e a coluna não tem como recusar.
--
-- ## O desenho
--
-- Cada concessão é um fato com origem e prazo. O plano efetivo é **derivado**:
-- a maior concessão viva neste instante. É o ADR 0027 aplicado ao plano —
-- estado que muda com o tempo é calculado, não gravado.
--
-- Cancelar a assinatura encerra **aquela** concessão. A da chave continua de
-- pé, e o usuário não perde o que não vinha dali.
--
-- ## `profiles.plano` continua existindo
--
-- Como **projeção**, mantida por `recalcularPlanoDoPerfil`. Dezenas de telas
-- leem aquela coluna, e trocar todas de uma vez seria uma migração de risco
-- desnecessário. A verdade passa a viver aqui; a coluna é o cache dela.
--
-- Quem escrever em `profiles.plano` direto, sem passar por uma concessão,
-- recria o defeito. É por isso que o recálculo é função, e não `update` solto.
--
-- ## Vocabulário
--
-- Esta tabela fala o vocabulário do app (`free | simples | profissional`), não
-- o enum legado de `profiles.plano` (`freemium | starter | pro | agencia`).
-- É tabela nova, sem histórico a preservar — e herdar nomes de uma versão
-- anterior do produto só perpetuaria a tradução.

create table if not exists public.concessoes_de_plano (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- Vocabulário do app. Ver a nota acima.
  plano text not null check (plano in ('free', 'simples', 'profissional')),

  -- Quem concedeu. É o campo que faltava.
  origem text not null check (origem in ('assinatura', 'chave', 'cortesia', 'migracao')),

  -- O `sub_...`, o id da chave, o id do admin — conforme a origem.
  -- Permite encerrar exatamente a concessão certa quando o Stripe avisa.
  referencia text,

  valido_de timestamptz not null default now(),
  -- `null` = sem prazo. Cortesia com prazo preenche.
  valido_ate timestamptz,
  -- Encerramento antes do prazo: cancelamento, estorno, revogação.
  -- Separado de `valido_ate` porque «venceu» e «foi revogada» são fatos
  -- diferentes, e apagar a distinção perderia o motivo.
  encerrada_em timestamptz,

  motivo text,
  criada_em timestamptz not null default now(),
  criada_por uuid references public.profiles(id) on delete set null
);

-- A consulta quente: as concessões vivas de um usuário.
create index if not exists idx_concessoes_usuario
  on public.concessoes_de_plano (user_id, valido_de desc);

-- Encerrar a concessão de uma assinatura específica.
create index if not exists idx_concessoes_referencia
  on public.concessoes_de_plano (referencia)
  where referencia is not null;

alter table public.concessoes_de_plano enable row level security;

-- O titular lê as próprias concessões: «por que eu tenho este plano?» é uma
-- pergunta legítima dele. Escrita é só do `service_role` — conceder plano a si
-- mesmo seria o mesmo furo que o trigger de `profiles.plano` já fecha.
drop policy if exists "titular le as proprias concessoes" on public.concessoes_de_plano;
create policy "titular le as proprias concessoes"
  on public.concessoes_de_plano
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

comment on table public.concessoes_de_plano is
  'De onde vem o plano de cada usuário. O plano efetivo é derivado daqui; profiles.plano é projeção.';

-- ── Backfill ────────────────────────────────────────────────────────────────
--
-- Todo perfil que hoje tem plano pago ganha uma concessão de origem
-- `migracao`, sem prazo. Sem isto, o primeiro recálculo rebaixaria todo mundo
-- para o gratuito — a tabela estaria vazia, e vazio significa «nenhuma
-- concessão viva».
--
-- A tradução do enum legado é feita aqui, uma vez: `pro`/`agencia` viram
-- profissional, `starter` vira simples. `freemium` não gera concessão, porque
-- gratuito é a ausência de concessão, não uma concessão de nada.

insert into public.concessoes_de_plano (user_id, plano, origem, motivo)
select
  p.id,
  case
    when p.plano::text in ('pro', 'agencia') then 'profissional'
    when p.plano::text = 'starter' then 'simples'
  end,
  'migracao',
  'Concessão criada a partir de profiles.plano na adoção da tabela'
from public.profiles p
where p.plano::text in ('pro', 'agencia', 'starter')
  and not exists (
    select 1 from public.concessoes_de_plano c
    where c.user_id = p.id and c.origem = 'migracao'
  );
