begin;

create table public.relatorio_emissoes (
  id uuid primary key,
  consulta_id uuid not null references public.consultas(id) on delete restrict,
  consultor_id uuid not null references public.profiles(id) on delete restrict,
  estado text not null check (estado in ('preparada', 'concluida', 'legado')),
  revisao_de uuid,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  versao_entrada text,
  versao_motor text,
  versao_template text,
  entrada jsonb,
  entrada_sha256 text check (entrada_sha256 ~ '^[a-f0-9]{64}$'),
  pdf_path text not null unique,
  pdf_sha256 text check (pdf_sha256 ~ '^[a-f0-9]{64}$'),
  pdf_bytes integer check (pdf_bytes > 12 and pdf_bytes <= 20971520),
  unique (id, consulta_id),
  foreign key (revisao_de, consulta_id) references public.relatorio_emissoes(id, consulta_id),
  check (revisao_de is distinct from id),
  check (
    (estado='legado' and pdf_path=consulta_id::text||'/relatorio.pdf' and entrada is null and entrada_sha256 is null
      and versao_entrada is null and versao_motor is null and versao_template is null)
    or
    (estado in ('preparada','concluida') and entrada is not null and jsonb_typeof(entrada)='object'
      and octet_length(entrada::text) <= 2097152 and entrada_sha256 is not null
      and versao_entrada is not null and versao_motor is not null and versao_template is not null
      and pdf_path=consulta_id::text||'/emissoes/'||id::text||'.pdf')
  ),
  check (estado<>'concluida' or (pdf_sha256 is not null and pdf_bytes is not null and concluido_em is not null)),
  check (estado<>'preparada' or (pdf_sha256 is null and pdf_bytes is null and concluido_em is null))
);
create index relatorio_emissoes_consulta_historico on public.relatorio_emissoes(consulta_id, criado_em desc, id);
create index relatorio_emissoes_consultor on public.relatorio_emissoes(consultor_id);
create index relatorio_emissoes_revisao on public.relatorio_emissoes(revisao_de, consulta_id);
alter table public.relatorio_emissoes enable row level security;
revoke all on public.relatorio_emissoes from public, anon, authenticated;
grant select on public.relatorio_emissoes to authenticated;
grant select, insert, update, delete on public.relatorio_emissoes to service_role;
create policy titular_le_emissoes on public.relatorio_emissoes for select to authenticated
  using (consultor_id=(select auth.uid()) and public.consulta_pertence_ao_usuario(consulta_id));

-- O arquivo legado não é reescrito nem recebe entradas inventadas. "legado"
-- indica procedência desconhecida, não uma confirmação retroativa de integridade.
insert into public.relatorio_emissoes(id, consulta_id, consultor_id, estado, pdf_path, concluido_em)
  select gen_random_uuid(), id, consultor_id, 'legado', relatorio_pdf_path, relatorio_gerado_em
  from public.consultas where relatorio_pdf_path=id::text||'/relatorio.pdf';

create function public.proteger_emissao_relatorio() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if old.estado <> 'preparada' or new.estado <> 'concluida'
    or (to_jsonb(new)-array['estado','concluido_em','pdf_sha256','pdf_bytes'])
       is distinct from (to_jsonb(old)-array['estado','concluido_em','pdf_sha256','pdf_bytes']) then
    raise exception 'Emissão imutável; gere uma revisão' using errcode='42501';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='relatorios' and name=new.pdf_path) then
    raise exception 'Arquivo ainda não disponível' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_emissao_relatorio() from public,anon,authenticated;
create trigger proteger_emissao_relatorio before update on public.relatorio_emissoes
  for each row execute function public.proteger_emissao_relatorio();

-- Chamada somente pelo servidor depois de verificar ownership e bytes do PDF.
-- O lock torna uma repetição da confirmação idempotente e recusa outro arquivo.
create function public.concluir_emissao_relatorio(p_id uuid,p_consultor uuid,p_sha256 text,p_bytes integer)
returns timestamptz language plpgsql security invoker set search_path=pg_catalog,public as $$
declare e public.relatorio_emissoes; instante timestamptz := clock_timestamp();
begin
  select * into e from public.relatorio_emissoes where id=p_id and consultor_id=p_consultor for update;
  if not found then raise exception 'Emissão indisponível' using errcode='42501'; end if;
  if e.estado='concluida' and e.pdf_sha256=p_sha256 and e.pdf_bytes=p_bytes then return e.concluido_em; end if;
  if e.estado<>'preparada' then raise exception 'Emissão já encerrada' using errcode='23514'; end if;
  if e.criado_em < now()-interval '15 minutes' then raise exception 'Preparação expirada' using errcode='23514'; end if;
  if not exists(select 1 from storage.objects where bucket_id='relatorios' and name=e.pdf_path) then
    raise exception 'Arquivo ainda não disponível' using errcode='23514';
  end if;
  update public.relatorio_emissoes set estado='concluida',pdf_sha256=p_sha256,pdf_bytes=p_bytes,concluido_em=instante where id=e.id;
  update public.consultas set relatorio_gerado_em=greatest(relatorio_gerado_em,instante) where id=e.consulta_id and consultor_id=p_consultor;
  return instante;
end;
$$;
revoke all on function public.concluir_emissao_relatorio(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.concluir_emissao_relatorio(uuid,uuid,text,integer) to service_role;

-- Uma instrução para todas as revisões: excluir em lotes por ID pode tentar
-- remover o pai antes dos filhos. Arquivos precisam ter saído pela Storage API.
create function public.excluir_emissoes_relatorio(p_consultor uuid,p_ids uuid[])
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if exists(select 1 from public.relatorio_emissoes e join storage.objects o
    on o.bucket_id='relatorios' and o.name=e.pdf_path
    where e.consultor_id=p_consultor and e.id=any(p_ids)) then
    raise exception 'Remova os arquivos antes do histórico' using errcode='23514';
  end if;
  delete from public.relatorio_emissoes where consultor_id=p_consultor and id=any(p_ids);
end;
$$;
revoke all on function public.excluir_emissoes_relatorio(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.excluir_emissoes_relatorio(uuid,uuid[]) to service_role;

comment on table public.relatorio_emissoes is
  'Entradas e PDFs versionados. Preparada não é emissão concluída. Legado não é reproduzível. Exclusão de dados exige remover arquivos antes das linhas.';
commit;
