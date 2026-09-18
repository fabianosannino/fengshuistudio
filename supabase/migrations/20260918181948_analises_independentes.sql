begin;

-- Uma leitura MVCC reúne a fonte completa; allowlists excluem segredos e
-- colunas futuras. Invoker preserva RLS; serviço ainda precisa indicar o dono.
create function public.ler_fonte_analise(p_consulta uuid, p_consultor uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'consulta', (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(c)) where key=any(array[
   'id','consultor_id','cliente_id','nome_imovel','tipo_imovel','area_total_m2','endereco_imovel','porta_posicao',
   'bagua_imagem','foto_geral_url','fotos_comodos','fotos_antes','fotos_depois','bagua_entrada','mobiliario',
   'num_moradores','ano_construcao','ano_reforma_estrutural','historico_imovel','observacoes_topograficas',
   'dados_adicionais','status','roda_da_vida','checklist_chi','posicao_comando','modelo_pontuacao','peso_geo','criado_em']))
   || jsonb_build_object('clientes',(select jsonb_object_agg(key,value) from public.clientes cl,
      lateral jsonb_each(to_jsonb(cl)) where cl.id=c.cliente_id and cl.consultor_id=p_consultor
      and key=any(array['nome_completo','email','telefone','cidade','estado','data_nascimento','genero']))),
  'perfil',(select jsonb_object_agg(key,value) from public.profiles pr, lateral jsonb_each(to_jsonb(pr))
    where pr.id=p_consultor and key=any(array['id','nome_completo','plano','tipo_usuario','role','nome_empresa','telefone','profissao','registro_profissional','site','instagram'])),
  'setores',coalesce((select jsonb_agg(s.dados order by s.numero,s.id) from (
    select sb.id, to_jsonb(sb)->>'numero' as numero,
     (select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(sb)) where key=any(array['id','consulta_id','nome','numero','elemento','cor_associada','posicao_grid','score_percentual','recomendacoes_custom','comodo_tipo','comodos']))
     || jsonb_build_object('diagnostico_criterios',coalesce((select jsonb_agg(d.dados order by d.criterio,d.id) from (
       select dc.id,to_jsonb(dc)->>'criterio' as criterio,(select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(dc)) where key=any(array['criterio','score','notas','setor_id'])) as dados
       from public.diagnostico_criterios dc where dc.setor_id=sb.id) d),'[]'::jsonb)) as dados
    from public.setores_bagua sb where sb.consulta_id=c.id) s),'[]'::jsonb),
  'evolucao',coalesce((select jsonb_agg(e.dados order by e.instante,e.id) from (
    select ds.id,to_jsonb(ds)->>'criado_em' as instante,(select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(ds)) where key=any(array['tipo','scores','criado_em'])) as dados
    from public.diagnostico_snapshots ds where ds.consulta_id=c.id) e),'[]'::jsonb),
  'chi_custom',coalesce((select jsonb_agg(jsonb_build_object('id',to_jsonb(ch)->'item_id','label',to_jsonb(ch)->'label') order by to_jsonb(ch)->>'criado_em',to_jsonb(ch)->>'item_id')
    from public.consultor_checklist_chi_custom ch where ch.consultor_id=p_consultor),'[]'::jsonb)
 ) from public.consultas c where c.id=p_consulta and c.consultor_id=p_consultor
   and (p_consultor=(select auth.uid()) or current_user='service_role');
$$;
revoke all on function public.ler_fonte_analise(uuid,uuid) from public,anon;
grant execute on function public.ler_fonte_analise(uuid,uuid) to authenticated,service_role;

create table public.analises_execucoes (
 id uuid primary key,
 consulta_id uuid not null references public.consultas(id) on delete cascade,
 consultor_id uuid not null references public.profiles(id) on delete restrict,
 criado_em timestamptz not null default now(),
 metodo text not null check(metodo in ('btb','bussola')),
 variante text not null check(variante in ('btb-porta','bussola-octantes')),
 versao_motor text not null,
 fonte_sha256 text not null check(fonte_sha256 ~ '^[a-f0-9]{64}$'),
 fonte jsonb not null check(jsonb_typeof(fonte)='object' and octet_length(fonte::text)<=2097152),
 resultado jsonb not null check(jsonb_typeof(resultado)='object' and octet_length(resultado::text)<=262144),
 unique(id,consulta_id,consultor_id)
);
create index analises_execucoes_historico on public.analises_execucoes(consulta_id,criado_em desc,id desc);
create index analises_execucoes_titular on public.analises_execucoes(consultor_id);
alter table public.analises_execucoes enable row level security;
revoke all on public.analises_execucoes from public,anon,authenticated,service_role;
grant select on public.analises_execucoes to authenticated;
grant select,insert,delete on public.analises_execucoes to service_role;
create policy titular_le_analises on public.analises_execucoes for select to authenticated
 using(consultor_id=(select auth.uid()) and exists(select 1 from public.consultas c where c.id=consulta_id and c.consultor_id=(select auth.uid())));

create function public.proteger_analise_execucao() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Analise imutavel; registre nova execucao' using errcode='42501'; end;
$$;
revoke all on function public.proteger_analise_execucao() from public,anon,authenticated;
create trigger analise_imutavel before update on public.analises_execucoes for each row execute function public.proteger_analise_execucao();

-- Apenas o servidor calcula o resultado. Lock serializa a cota e retries;
-- comparar a fonte inteira recusa inclusive alterações concorrentes dos setores.
create function public.registrar_analise(p_id uuid,p_consulta uuid,p_consultor uuid,p_hash text,p_fonte jsonb,p_resultado jsonb,p_motor text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare anterior public.analises_execucoes; metodo_atual text;
begin
 perform 1 from public.profiles where id=p_consultor for update;
 if exists(select 1 from public.exclusoes_de_conta where user_id=p_consultor) then
  raise exception 'Conta em exclusao' using errcode='PT409';
 end if;
 perform 1 from public.consultas where id=p_consulta and consultor_id=p_consultor for update;
 if not found then raise exception 'Consulta indisponivel' using errcode='42501'; end if;
 select * into anterior from public.analises_execucoes where id=p_id;
 if found then
  if anterior.consulta_id=p_consulta and anterior.consultor_id=p_consultor and anterior.fonte_sha256=p_hash and anterior.versao_motor=p_motor then return anterior.id; end if;
  raise exception 'Identificador ja utilizado' using errcode='PT409';
 end if;
 if public.ler_fonte_analise(p_consulta,p_consultor) is distinct from p_fonte then
  raise exception 'Fonte alterada; recarregue' using errcode='PT409';
 end if;
 if (select count(*) from public.analises_execucoes where consulta_id=p_consulta)>=100 then
  raise exception 'Limite de 100 analises por consulta' using errcode='PT409';
 end if;
 metodo_atual:=p_fonte#>>'{consulta,bagua_entrada,escola}';
 insert into public.analises_execucoes(id,consulta_id,consultor_id,metodo,variante,versao_motor,fonte_sha256,fonte,resultado)
 values(p_id,p_consulta,p_consultor,metodo_atual,case when metodo_atual='btb' then 'btb-porta' else 'bussola-octantes' end,p_motor,p_hash,p_fonte,p_resultado);
 return p_id;
end;
$$;
revoke all on function public.registrar_analise(uuid,uuid,uuid,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.registrar_analise(uuid,uuid,uuid,text,jsonb,jsonb,text) to service_role;

alter table public.relatorio_emissoes add column analise_id uuid;
alter table public.relatorio_emissoes add constraint relatorio_analise_mesmo_dono
 foreign key(analise_id,consulta_id,consultor_id) references public.analises_execucoes(id,consulta_id,consultor_id) on delete restrict;
create index relatorio_emissoes_analise on public.relatorio_emissoes(analise_id,consulta_id,consultor_id);
comment on table public.analises_execucoes is 'Fontes/resultados imutaveis por metodo; sem backfill. Dados pessoais e referencias privadas exportados e excluidos com a consulta; relatorios devem ser removidos antes.';
notify pgrst,'reload schema';
commit;
