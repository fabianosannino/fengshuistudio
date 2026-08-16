-- ═══════════════════════════════════════════════════════════════════════════
-- Atribuição de afiliado — a primeira fatia da fase 5
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Registra **de quem veio** o comprador. Não calcula comissão, não repassa
-- dinheiro, não tem tela de afiliado.
--
-- ## Por que esta parte primeiro
--
-- O percentual e a forma de pagar dependem de decisão comercial e de contador
-- (retenção na fonte muda entre PF e PJ). Isso pode esperar sem custo: quando
-- existir, aplica-se sobre pedidos já gravados.
--
-- O clique não. **Visita não registrada é atribuição perdida para sempre** —
-- não há como saber amanhã de onde veio quem comprou hoje. Então a parte que
-- urge é justamente a que não depende de ninguém decidir nada.
--
-- ## Entrada, não saída (seção 8 do modelo da loja)
--
-- Isto é afiliado **de entrada**: alguém traz um comprador e ganha percentual
-- do que passou pela nossa conta. Não confundir com `produtos_afiliados` e
-- `cliques_de_indicacao`, que são de **saída** — link para loja de fora, onde
-- nenhum dinheiro nosso circula. Mesmo nome, naturezas opostas, e por isso
-- tabelas separadas.

-- ── 1. O código que identifica o afiliado ──────────────────────────────────
--
-- Mora em `profiles` porque afiliado **é** um perfil: a decisão de 13/08 diz
-- que qualquer pessoa pode ser afiliada desde que tenha conta Connect, e o
-- consultor já tem. Uma tabela `afiliados` separada duplicaria identidade para
-- não guardar nada além de um código.
--
-- `null` é o estado normal: quase ninguém é afiliado.

alter table public.profiles
  add column if not exists codigo_de_afiliado text;

-- Único entre os não-nulos. O código vai em link divulgado publicamente, então
-- dois perfis com o mesmo código seriam atribuição ambígua — e a ambiguidade
-- só apareceria na hora de pagar.
create unique index if not exists profiles_codigo_de_afiliado_unico
  on public.profiles (lower(codigo_de_afiliado))
  where codigo_de_afiliado is not null;

-- Forma conferida no banco, não só na rota: o código entra em URL e em
-- material de divulgação. Letras, números e hífen, 4 a 32 — o suficiente para
-- ser legível ao telefone e curto o bastante para caber num impresso.
alter table public.profiles
  drop constraint if exists profiles_codigo_de_afiliado_forma;
alter table public.profiles
  add constraint profiles_codigo_de_afiliado_forma
  check (codigo_de_afiliado is null or codigo_de_afiliado ~ '^[a-zA-Z0-9-]{4,32}$');

comment on column public.profiles.codigo_de_afiliado is
  'Código público do afiliado, usado no link de divulgação. Coluna '
  'privilegiada: quem a escreve escolhe para quem vai comissão, então só '
  'service_role. Ver trg_protect_profile_privileged_columns.';

-- ── 2. O clique ────────────────────────────────────────────────────────────

create table if not exists public.indicacoes (
  id uuid primary key default gen_random_uuid(),

  -- Resolvido na hora do clique. Se o afiliado perder o código depois, a
  -- indicação já registrada continua apontando para quem trouxe o comprador.
  afiliado_perfil_id uuid not null references public.profiles(id) on delete cascade,

  -- Fotografia do código usado. Redundante com `profiles` **de propósito**: é
  -- o que estava no link naquele momento, e é o que responde «por qual peça de
  -- divulgação essa pessoa chegou» se o afiliado trocar de código.
  codigo text not null,

  /*
   * Quem é o visitante — sem saber quem ele é.
   *
   * O comprador da loja não tem conta, então não há `auth.uid()` para amarrar.
   * O que existe é um identificador aleatório em cookie primário, e aqui fica
   * apenas o **hash** dele.
   *
   * O hash não é cerimônia: guardar o valor cru permitiria que quem lesse esta
   * tabela forjasse o cookie e reivindicasse a atribuição de outro. E, como o
   * valor é aleatório e sem significado, o banco não passa a conter nada que
   * identifique uma pessoa — o que mantém esta tabela fora do inventário de
   * dado pessoal.
   */
  visitante_hash text not null,

  criada_em timestamptz not null default now(),

  /*
   * Último clique, janela de 30 dias.
   *
   * A data fica gravada em vez de calculada na consulta porque a janela é uma
   * promessa feita ao afiliado no momento da divulgação. Mudar a regra amanhã
   * não pode reescrever o que foi prometido ontem — mesma razão de
   * `concessoes_de_plano` guardar o próprio prazo.
   */
  expira_em timestamptz not null
);

-- A consulta que importa: «qual indicação viva deste visitante é a mais
-- recente?». Ordenada por `criada_em` desc, filtrando por hash e validade.
create index if not exists indicacoes_visitante_recente
  on public.indicacoes (visitante_hash, criada_em desc);

create index if not exists indicacoes_afiliado
  on public.indicacoes (afiliado_perfil_id, criada_em desc);

comment on table public.indicacoes is
  'Clique de afiliado de ENTRADA — quem trouxe o comprador. Não confundir com '
  'cliques_de_indicacao, que é de saída (link para loja de terceiro). '
  'Atribuição: último clique, janela de 30 dias.';

-- ── 3. O vínculo com a venda ───────────────────────────────────────────────
--
-- `on delete set null`: apagar o perfil de um afiliado (direito do titular)
-- não pode apagar o pedido, que é registro fiscal. O pedido perde de quem
-- veio, e é o desfecho certo — a pessoa sumiu, a venda não.

alter table public.pedidos
  add column if not exists indicacao_id uuid
  references public.indicacoes(id) on delete set null;

create index if not exists pedidos_indicacao on public.pedidos (indicacao_id)
  where indicacao_id is not null;

comment on column public.pedidos.indicacao_id is
  'De qual indicação veio este pedido, resolvida no início do checkout. '
  'Null é o normal: a maioria das vendas não vem de afiliado.';

-- ── 4. RLS ─────────────────────────────────────────────────────────────────
--
-- Ligada e **sem policy**, como `produtos` e `cliques_de_indicacao`. Ninguém
-- lê sem `service_role`: a tabela diz quem trouxe quem, e um afiliado poder
-- consultar as indicações dos outros seria entregar a lista de quem divulga o
-- quê. O que o afiliado precisa ver sai por rota, com recorte.

alter table public.indicacoes enable row level security;

-- ── 5. A coluna nova entra na proteção de `profiles` ───────────────────────
--
-- `codigo_de_afiliado` decide **para quem vai dinheiro**. Deixá-la fora do
-- trigger permitiria a qualquer usuário autenticado se apropriar do código de
-- outro por um PATCH no PostgREST, e passar a receber a comissão dele.
--
-- Vai junto de `role`, `plano` e `stripe_*` — e, como `capacidades_admin`,
-- **sem** a saída por `is_admin()`: conceder código é ato de servidor, com
-- rastro, não algo que se faz editando o próprio perfil.

-- A função abaixo é a de hoje, com `codigo_de_afiliado` acrescentado ao bloco
-- que só `service_role` atravessa. O resto é idêntico ao que está no banco —
-- conferido com `pg_get_functiondef` antes de escrever, e não reconstituído de
-- memória: a saída `COALESCE(auth.role(), 'service_role')` é o que permite ao
-- servidor gravar `plano`, e omiti-la derrubaria `recalcularPlanoDoPerfil` sem
-- que nenhum teste daqui percebesse.

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
BEGIN
  -- Colunas privilegiadas "clássicas": admin ou service_role passam.
  IF (
       NEW.role               IS DISTINCT FROM OLD.role
    OR NEW.plano              IS DISTINCT FROM OLD.plano
    OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
    OR NEW.stripe_account_id  IS DISTINCT FROM OLD.stripe_account_id
  )
  AND COALESCE(auth.role(), 'service_role') NOT IN ('service_role')
  AND NOT public.is_admin()
  THEN
    RAISE EXCEPTION 'Alteração de coluna privilegiada de profiles não permitida'
      USING ERRCODE = '42501';
  END IF;

  -- `capacidades_admin`: SÓ service_role. Sem a saída por is_admin(),
  -- senão qualquer admin se autoconcederia o que lhe faltasse.
  IF NEW.capacidades_admin IS DISTINCT FROM OLD.capacidades_admin
     AND COALESCE(auth.role(), 'service_role') NOT IN ('service_role')
  THEN
    RAISE EXCEPTION 'capacidades_admin só pode ser alterado via service_role'
      USING ERRCODE = '42501';
  END IF;

  -- `codigo_de_afiliado`: mesma régua, e pela mesma razão levada um passo
  -- adiante. Quem escreve este campo escolhe para quem vai comissão; um admin
  -- podendo editá-lo se apropriaria da audiência de qualquer afiliado sem
  -- deixar rastro fora da própria linha.
  IF NEW.codigo_de_afiliado IS DISTINCT FROM OLD.codigo_de_afiliado
     AND COALESCE(auth.role(), 'service_role') NOT IN ('service_role')
  THEN
    RAISE EXCEPTION 'codigo_de_afiliado só pode ser alterado via service_role'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
