-- ═══════════════════════════════════════════════════════════════════════════
-- `loja_ativa`, catálogo público e a vitrine de serviços
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Três decisões de 13/08, e cada uma resolve uma coisa diferente.

-- ── 1. A loja do consultor nasce fechada ────────────────────────────────────
--
-- Decisão: a loja fica pronta, mas **desabilitada por vendedor** até o dono da
-- plataforma liberar.
--
-- Por consultor, e não por interruptor global, porque o próprio dono precisa
-- da loja dele funcionando para testar enquanto as demais ficam fechadas. Um
-- flag global desligaria a dele junto.
--
-- E é **coluna conferida no servidor**, não item escondido do menu: a rota de
-- checkout é pública, e quem tiver o link `/store/acct_...` compra mesmo sem
-- ver botão nenhum. Esconder da tela não desabilita nada.
--
-- De brinde, isto é a curadoria que o produto vai querer de qualquer jeito:
-- ninguém vende antes de ser aprovado. Mesma forma do `parceiro_visivel`.

alter table public.profiles
  add column if not exists loja_ativa boolean not null default false;

comment on column public.profiles.loja_ativa is
  'Libera a loja deste consultor. Conferida no checkout; escondê-la da tela não bastaria.';

-- A coluna entra na lista de privilegiadas.
--
-- Sem isto, o consultor abriria a própria loja com um update no perfil — a
-- aprovação viraria enfeite. É o mesmo raciocínio de `role` e `plano`.
create or replace function public.protect_profile_privileged_columns()
returns trigger as $$
begin
  if (
       new.role               is distinct from old.role
    or new.plano              is distinct from old.plano
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_account_id  is distinct from old.stripe_account_id
    or new.loja_ativa         is distinct from old.loja_ativa
  )
  and coalesce(auth.role(), 'service_role') not in ('service_role')
  and not public.is_admin()
  then
    raise exception 'Alteração de coluna privilegiada de profiles não permitida'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security definer
   set search_path = public, pg_catalog;

-- ── 2. O catálogo de curadoria passa a ser visível sem login ────────────────
--
-- A policy de leitura exigia `authenticated`. O efeito era uma vitrine que
-- ninguém de fora enxergava: quem chegasse pela home via uma loja vazia, e só
-- descobria o que ela tem depois de criar conta — pedindo cadastro antes de
-- mostrar o motivo para se cadastrar.
--
-- Continua valendo o filtro `ativo`: item desativado some para todo mundo.

drop policy if exists produtos_afiliados_leitura on public.produtos_afiliados;
create policy produtos_afiliados_leitura on public.produtos_afiliados
  for select to anon, authenticated
  using (ativo);

-- ── 3. A vitrine de serviços do parceiro ────────────────────────────────────
--
-- Decisão: **vitrine informativa**, separada da loja.
--
-- O serviço aqui não tem botão de comprar. Ele diz o que o consultor faz e em
-- que faixa de preço, para o visitante decidir com quem falar. Quando o preço
-- fecha, aí vira produto na loja dele.
--
-- É por isso que existe tabela separada em vez de reaproveitar o catálogo: com
-- checkout, a vitrine **seria** a loja com outro nome, e manter as duas faria
-- duas fontes discordarem sobre o preço. Sem checkout, são coisas de natureza
-- diferente — uma é conteúdo, a outra é comércio.
--
-- `preco_a_partir_de_centavos` é nulo quando o consultor prefere «sob
-- consulta». Nulo é ausência de faixa declarada, não preço zero: a tela mostra
-- «sob consulta», nunca «R$ 0,00».

create table if not exists public.servicos_do_parceiro (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.profiles(id) on delete cascade,

  nome text not null check (length(trim(nome)) > 0),
  descricao text,

  modalidade text not null default 'presencial'
    check (modalidade in ('presencial', 'online', 'hibrido')),

  duracao_minutos integer check (duracao_minutos is null or duracao_minutos > 0),
  preco_a_partir_de_centavos integer
    check (preco_a_partir_de_centavos is null or preco_a_partir_de_centavos >= 0),

  ativo boolean not null default true,
  ordem integer not null default 0,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.servicos_do_parceiro is
  'Vitrine informativa: o que o consultor faz. Sem checkout — isso é a loja.';

create index if not exists idx_servicos_do_parceiro
  on public.servicos_do_parceiro (perfil_id, ordem)
  where ativo;

alter table public.servicos_do_parceiro enable row level security;

-- Leitura pública, e é o ponto da vitrine: quem ainda não tem conta precisa
-- ver o que o consultor faz para decidir procurá-lo.
--
-- Só de quem optou por aparecer. O `exists` amarra a visibilidade do serviço à
-- do perfil — sem ele, desmarcar «visível como parceiro» esconderia o
-- consultor e deixaria os serviços dele expostos.
drop policy if exists "servicos visiveis de parceiros visiveis" on public.servicos_do_parceiro;
create policy "servicos visiveis de parceiros visiveis"
  on public.servicos_do_parceiro for select to anon, authenticated
  using (
    ativo and exists (
      select 1 from public.profiles p
      where p.id = servicos_do_parceiro.perfil_id and p.parceiro_visivel = true
    )
  );

-- O dono cuida dos próprios, inclusive dos desativados — que a policy de
-- leitura pública não devolve.
drop policy if exists "dono gerencia os proprios servicos" on public.servicos_do_parceiro;
create policy "dono gerencia os proprios servicos"
  on public.servicos_do_parceiro for all to authenticated
  using (auth.uid() = perfil_id or public.is_admin())
  with check (auth.uid() = perfil_id or public.is_admin());
