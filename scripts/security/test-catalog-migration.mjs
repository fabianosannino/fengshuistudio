/** Catalog migration regression against a disposable PostgreSQL database.
 * Synthetic rows only; no production URL, credentials, or host database port.
 * Storage tables model the columns/policies used here, not the Storage API.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

const container = `fss-catalog-${randomBytes(5).toString('hex')}`
const postgresImage = 'postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'
const migration = readFileSync(new URL('../../supabase/migrations/20260816150000_foto_e_promocao_do_produto.sql', import.meta.url), 'utf8')
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const sql = statement => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], {
  input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
}).trim()
let checks = 0
function equal(actual, expected, name) {
  assert.deepEqual(actual, expected, name)
  checks++
}
function rejects(statement, constraint) {
  assert.throws(() => sql(statement), error => error.stderr?.includes(constraint))
  checks++
}
async function waitForDatabase() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if (docker('exec', container, 'pg_isready', '-U', 'postgres').includes('accepting')) return
    } catch { /* Disposable database is starting. */ }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('Disposable database did not become ready')
}

try {
  docker('run', '-d', '--name', container, '--network', 'none', '-e', 'POSTGRES_PASSWORD=local-test-only', postgresImage)
  await waitForDatabase()
  sql(`
    create role anon;
    create role authenticated;
    create table public.produtos (
      id uuid primary key default gen_random_uuid(), tipo text not null,
      modo_de_venda text not null, vendedor_perfil_id uuid,
      nome text not null, descricao text, preco_centavos integer not null,
      ativo boolean not null, arquivo_path text, arquivo_nome text,
      arquivo_mime text, arquivo_bytes integer,
      criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
      link_externo text, parceiro text
    );
    alter table public.produtos enable row level security;
    grant select on public.produtos to anon, authenticated;
    insert into public.produtos (tipo, modo_de_venda, nome, preco_centavos, ativo, arquivo_path)
      values ('bem_proprio_digital', 'marketplace', 'Synthetic product', 10000, true, 'private/fixture.pdf');
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
    insert into storage.buckets (id, name, public)
      select name, name, false from unnest(array['relatorios', 'imoveis-fotos', 'clientes-fotos', 'produtos-digitais']) name;
    insert into storage.objects (bucket_id) values ('clientes-fotos'), ('produtos-digitais');
  `)
  const before = sql('select to_jsonb(p) from public.produtos p')
  // Reproduce the production outage before applying the actual migration.
  rejects('select imagem_path from public.produtos', 'does not exist')
  sql(`begin;\n${migration}\ncommit;`)
  equal(sql("select to_jsonb(p) - array['imagem_path','promocao_preco_centavos','promocao_inicio','promocao_fim'] from public.produtos p"), before, 'existing product data preserved')
  equal(sql("select count(*) from information_schema.columns where table_schema='public' and table_name='produtos' and column_name in ('imagem_path','promocao_preco_centavos','promocao_inicio','promocao_fim') and is_nullable='YES'"), '4', 'additive nullable columns')
  equal(sql("select imagem_path is null and promocao_preco_centavos is null and promocao_inicio is null and promocao_fim is null from public.produtos"), 't', 'no fabricated image or promotion')
  equal(sql("select count(*) from pg_constraint where conrelid='public.produtos'::regclass and conname like 'produtos_promocao_%' and convalidated"), '4', 'validated constraints')
  equal(sql("select to_regclass('public.idx_produtos_promocao_aberta') is not null"), 't', 'promotion index exists')
  equal(sql("select public and file_size_limit=2097152 and allowed_mime_types=array['image/jpeg','image/png','image/webp'] from storage.buckets where id='produtos-imagens'"), 't', 'public image bucket with restricted size and formats')
  equal(sql("select count(*) from storage.buckets where id <> 'produtos-imagens' and public=false"), '4', 'customer photos and deliverables remain private')
  equal(sql("select relrowsecurity from pg_class where oid='public.produtos'::regclass"), 't', 'catalog RLS remains enabled')
  equal(sql("select count(*) from pg_policies where schemaname='public' and tablename='produtos'"), '0', 'no direct public catalog policy')
  sql("insert into storage.objects(bucket_id) values ('produtos-imagens');")
  for (const role of ['anon', 'authenticated']) {
    equal(sql(`set role ${role}; select count(*) from public.produtos;`), '0', `${role} cannot read private product fields`)
    equal(sql(`set role ${role}; select bucket_id from storage.objects;`), 'produtos-imagens', `${role} sees only marketing images`)
    rejects(`set role ${role}; insert into storage.objects(bucket_id) values ('produtos-imagens');`, 'row-level security')
    equal(sql(`set role ${role}; with changed as (delete from storage.objects returning id) select count(*) from changed;`), '0', `${role} cannot delete images`)
    equal(sql(`set role ${role}; with changed as (update storage.objects set bucket_id='clientes-fotos' returning id) select count(*) from changed;`), '0', `${role} cannot move images`)
  }
  rejects('update public.produtos set promocao_preco_centavos=9000;', 'produtos_promocao_completa')
  const promotion = "promocao_inicio='2026-10-01Z', promocao_fim='2026-10-02Z'"
  for (const price of [0, -1, 10000, 11000]) {
    rejects(`update public.produtos set ${promotion}, promocao_preco_centavos=${price};`, 'produtos_promocao_desconta')
  }
  rejects("update public.produtos set promocao_preco_centavos=9000, promocao_inicio='2026-10-02Z', promocao_fim='2026-10-01Z';", 'produtos_promocao_janela')
  rejects("update public.produtos set promocao_preco_centavos=9000, promocao_inicio='2026-10-01Z', promocao_fim='2026-10-01Z';", 'produtos_promocao_janela')
  rejects(`update public.produtos set ${promotion}, promocao_preco_centavos=9000, modo_de_venda='indicacao';`, 'produtos_promocao_so_no_que_vendemos')
  sql(`update public.produtos set ${promotion}, promocao_preco_centavos=9000;`)
  equal(sql('select preco_centavos=10000 and promocao_preco_centavos=9000 from public.produtos'), 't', 'valid promotion preserves base price')
  const promoted = sql('select to_jsonb(p) from public.produtos p')
  sql(`begin;\n${migration}\ncommit;`)
  equal(sql('select to_jsonb(p) from public.produtos p'), promoted, 'reapplication preserves valid campaign')
  equal(sql("select count(*) from pg_policies where schemaname='storage' and tablename='objects' and cmd='SELECT'"), '1', 'reapplication does not duplicate image policy')
  process.stdout.write(`${JSON.stringify({ passed: checks, reproducedMissingColumn: true, database: 'PostgreSQL 17', storageApiTested: false })}\n`)
} finally {
  try { docker('rm', '-f', '-v', container) } catch { /* Only this random task-owned container. */ }
}
