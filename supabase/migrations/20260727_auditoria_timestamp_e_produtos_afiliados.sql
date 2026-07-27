-- Achados da varredura tela a tela de 2026-07-27 (ver ADR 0020).
-- Já aplicada em produção via MCP; versionada aqui para o histórico.

-- 1) Trilha de auditoria sem carimbo de tempo não é trilha de auditoria.
--    A coluna não tinha default e os inserts não a preenchiam: as linhas
--    existentes ficaram com performed_at NULL, e a tela renderizava
--    «01/01/1970, 00:00:00» — plausível o bastante para passar por verdade.
--    As linhas legadas seguem NULL de propósito: inventar um horário numa
--    trilha de auditoria é pior do que declarar a lacuna.
alter table public.admin_audit_log
  alter column performed_at set default now();

-- 2) A tela /produtos consultava produtos_afiliados, que nunca existiu:
--    404 a cada carregamento, silenciado porque o erro não era checado.
create table if not exists public.produtos_afiliados (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  nome text not null,
  descricao text,
  tag text,
  preco text,
  link_afiliado text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists produtos_afiliados_categoria_ativo_idx
  on public.produtos_afiliados (categoria, nome) where ativo;

alter table public.produtos_afiliados enable row level security;

-- Catálogo é vitrine: qualquer usuário autenticado lê os ativos.
drop policy if exists produtos_afiliados_leitura on public.produtos_afiliados;
create policy produtos_afiliados_leitura on public.produtos_afiliados
  for select to authenticated using (ativo);

-- Escrita é curadoria: só admin, verificado no servidor.
drop policy if exists produtos_afiliados_escrita on public.produtos_afiliados;
create policy produtos_afiliados_escrita on public.produtos_afiliados
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
