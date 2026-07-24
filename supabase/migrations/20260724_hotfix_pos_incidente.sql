-- ============================================================
-- Hotfix pós-incidente — 3 perdas descobertas em teste real de uso
-- ============================================================
--
-- Testes de ponta a ponta do dono revelaram mais três restos do incidente
-- de schema (docs/auditoria/2026-07-19-incidente-schema-rls-defaults.md):
--
-- 1. `consultas.porta_posicao` é NOT NULL e perdeu o DEFAULT — o app não
--    envia o campo na criação, então TODA criação de consulta falhava
--    (23502). Restaura o default 'centro_frente' (Escola BTB: porta na
--    base do mapa; o ajuste fino é feito no fluxo do Ba Guá).
--
-- 2. Os buckets de storage sumiram (só sobrou 'relatorios', criado por
--    nós): o upload da planta (imoveis-fotos) e da foto do cliente
--    (clientes-fotos) falhavam com "bucket não existe". Recria os dois
--    como eram (públicos — ADR 0005 registra o débito de migrá-los para
--    privados), com MIME alinhado à whitelist do servidor (validation.ts)
--    e policies de storage.objects escopadas por dono:
--      imoveis-fotos  → path {consultaId}/…  (posse via consultas)
--      clientes-fotos → path {userId}/…      (pasta do próprio usuário)
--
-- 3. As FKs restauradas em 20260720 usaram nomes `fk_<tabela>_<coluna>`,
--    mas o PostgREST resolve joins embutidos pelo NOME da constraint — e o
--    código usa os nomes originais na convenção do Postgres
--    (`profiles!activation_keys_used_by_fkey`, `admin_audit_log_performed_by_fkey`).
--    Resultado: a listagem de chaves e a auditoria admin quebraram.
--    Renomeia TODAS as FKs para `<tabela>_<coluna>_fkey` (a convenção que
--    o schema original tinha).

-- ── 1. Default de porta_posicao ─────────────────────────────────────────────
alter table public.consultas
  alter column porta_posicao set default 'centro_frente';

-- ── 2. Buckets + policies de storage ────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('imoveis-fotos', 'imoveis-fotos', true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('clientes-fotos', 'clientes-fotos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- imoveis-fotos: dono da consulta (primeira pasta do path é o id da consulta)
do $$
declare op text;
begin
  foreach op in array array['select','insert','update','delete'] loop
    execute format('drop policy if exists "consultor_%s_imoveis_fotos" on storage.objects', op);
    execute format($f$
      create policy "consultor_%1$s_imoveis_fotos" on storage.objects
        for %1$s to authenticated
        %2$s (
          bucket_id = 'imoveis-fotos' and exists (
            select 1 from public.consultas c
            where c.id::text = (storage.foldername(name))[1]
              and c.consultor_id = auth.uid()
          )
        )
    $f$, op, case when op = 'insert' then 'with check' else 'using' end);
  end loop;
end $$;

-- clientes-fotos: pasta do próprio usuário (primeira pasta = auth.uid())
do $$
declare op text;
begin
  foreach op in array array['select','insert','update','delete'] loop
    execute format('drop policy if exists "usuario_%s_clientes_fotos" on storage.objects', op);
    execute format($f$
      create policy "usuario_%1$s_clientes_fotos" on storage.objects
        for %1$s to authenticated
        %2$s (
          bucket_id = 'clientes-fotos'
          and (storage.foldername(name))[1] = auth.uid()::text
        )
    $f$, op, case when op = 'insert' then 'with check' else 'using' end);
  end loop;
end $$;

-- UPDATE também precisa de WITH CHECK (upsert reescreve a linha)
do $$ begin
  execute $f$alter policy "consultor_update_imoveis_fotos" on storage.objects
    with check (bucket_id = 'imoveis-fotos' and exists (
      select 1 from public.consultas c
      where c.id::text = (storage.foldername(name))[1] and c.consultor_id = auth.uid()))$f$;
  execute $f$alter policy "usuario_update_clientes_fotos" on storage.objects
    with check (bucket_id = 'clientes-fotos' and (storage.foldername(name))[1] = auth.uid()::text)$f$;
end $$;

-- ── 3. Renomeia as FKs para a convenção original (<tabela>_<coluna>_fkey) ───
do $$
declare r record; novo text;
begin
  for r in
    select con.conname,
           con.conrelid::regclass::text as tbl,
           (select a.attname from pg_attribute a
             where a.attrelid = con.conrelid and a.attnum = con.conkey[1]) as col
    from pg_constraint con
    where con.contype = 'f'
      and con.connamespace = 'public'::regnamespace
      and con.conname like 'fk\_%' escape '\'
  loop
    novo := format('%s_%s_fkey', replace(r.tbl, 'public.', ''), r.col);
    if not exists (select 1 from pg_constraint where conname = novo) then
      execute format('alter table %s rename constraint %I to %I', r.tbl, r.conname, novo);
    end if;
  end loop;
end $$;
