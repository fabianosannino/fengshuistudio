-- ADR 0040. Additive: existing records remain readable/editable, even above quota.
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

-- Updating this row serializes admissions even at REPEATABLE READ: a stale
-- transaction gets a serialization failure instead of admitting an extra row.
create table app_private.cotas_serializacao (
  titular_id uuid primary key references public.profiles(id) on delete cascade,
  revisao bigint not null default 0
);
alter table app_private.cotas_serializacao enable row level security;
revoke all on app_private.cotas_serializacao from public, anon, authenticated;

alter table public.clientes add column titular_id uuid references public.profiles(id) on delete cascade;
alter table public.clientes add constraint cliente_titular_e_proprietario
  check (titular_id is null or titular_id = consultor_id);
create unique index clientes_um_titular on public.clientes(titular_id) where titular_id is not null;

-- Existing own-house registrations: at most one verified email match per owner.
-- No merging, deletion or alteration of contact details.
with candidatos as (
  select distinct on (c.consultor_id) c.id, c.consultor_id
  from public.clientes c join auth.users u on u.id = c.consultor_id
  where c.email is not null and lower(c.email) = lower(u.email)
  order by c.consultor_id, c.criado_em, c.id
)
update public.clientes c set titular_id = x.consultor_id from candidatos x where c.id = x.id;

-- Versioned projection of src/lib/plano-utils.ts; CI compares every feature.
update public.plans set features = coalesce(features, '{}'::jsonb) || v.direitos
from (values
  ('free', '{"versao":"2026-09-18.1","imoveis":3,"clientes":0,"pdf":"marca_dagua","calendario":false,"parceiros":"bloqueado","multiplasAnalises":false,"historico":false}'::jsonb),
  ('simples', '{"versao":"2026-09-18.1","imoveis":10,"clientes":25,"pdf":"marca_dagua","calendario":true,"parceiros":"visualizar","multiplasAnalises":false,"historico":false}'::jsonb),
  ('profissional', '{"versao":"2026-09-18.1","imoveis":null,"clientes":null,"pdf":"limpo","calendario":true,"parceiros":"completo","multiplasAnalises":true,"historico":true}'::jsonb)
) v(slug, direitos) where plans.slug = v.slug;

create index if not exists clientes_cota_ativos on public.clientes(consultor_id) where ativo and titular_id is null;
create index if not exists consultas_cota_ativas on public.consultas(consultor_id) where status not in ('arquivada', 'deletada');

create function app_private.direitos_com_cota_serializada(proprietario uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare direitos jsonb;
begin
  insert into app_private.cotas_serializacao(titular_id, revisao) values (proprietario, 1)
  on conflict (titular_id) do update set revisao = cotas_serializacao.revisao + 1;
  select p.features into direitos from public.profiles u join public.plans p on p.slug =
    case u.plano::text when 'starter' then 'simples' when 'pro' then 'profissional'
      when 'agencia' then 'profissional' else 'free' end where u.id = proprietario;
  if direitos is null or direitos->>'versao' is distinct from '2026-09-18.1'
    or not (direitos ?& array['imoveis','clientes']) then
    raise exception using errcode = 'P0001', message = 'direitos_indisponiveis';
  end if;
  return direitos;
end;
$$;
revoke all on function app_private.direitos_com_cota_serializada(uuid) from public, anon, authenticated;

create function app_private.validar_cota_cliente()
returns trigger language plpgsql security definer set search_path = '' as $$
declare direitos jsonb; limite integer; quantidade bigint; nome_titular text; email_titular text;
begin
  if tg_op = 'UPDATE' and (new.consultor_id is distinct from old.consultor_id or new.titular_id is distinct from old.titular_id) then
    raise exception using errcode = '42501', message = 'proprietario_imutavel';
  end if;
  -- Compatibility with the previous own-house UI during rolling deployment.
  if tg_op = 'INSERT' and new.titular_id is null then
    if exists(select 1 from auth.users u join public.profiles p on p.id=u.id
      where u.id=new.consultor_id and new.email=u.email
      and new.nome_completo=coalesce(nullif(p.nome_completo,''),u.email)) then
      new.titular_id := new.consultor_id;
    end if;
  end if;
  if tg_op = 'INSERT' and new.titular_id is not null then
    select coalesce(nullif(p.nome_completo,''), u.email), u.email into nome_titular, email_titular
      from auth.users u join public.profiles p on p.id=u.id where u.id=new.consultor_id;
    if new.titular_id <> new.consultor_id or new.nome_completo is distinct from nome_titular
      or new.email is distinct from email_titular then
      raise exception using errcode = '42501', message = 'titular_invalido';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.titular_id is not null
    and (new.nome_completo is distinct from old.nome_completo or new.email is distinct from old.email) then
    if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id
      where u.id=new.consultor_id and new.email=u.email
      and new.nome_completo=coalesce(nullif(p.nome_completo,''),u.email)) then
      raise exception using errcode = '42501', message = 'contato_do_titular_vem_do_perfil';
    end if;
  end if;
  if not new.ativo or new.titular_id is not null then return new; end if;
  if tg_op = 'UPDATE' and old.ativo then return new; end if;
  direitos := app_private.direitos_com_cota_serializada(new.consultor_id);
  limite := (direitos->>'clientes')::integer;
  if limite is not null then
    select count(*) into quantidade from public.clientes where consultor_id=new.consultor_id and ativo and titular_id is null;
    if quantidade >= limite then raise exception using errcode = 'P0001', message = 'cota_clientes_excedida'; end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.validar_cota_cliente() from public, anon, authenticated;
create trigger validar_cota_cliente before insert or update on public.clientes
  for each row execute function app_private.validar_cota_cliente();

create function app_private.validar_cota_consulta()
returns trigger language plpgsql security definer set search_path = '' as $$
declare direitos jsonb; limite integer; quantidade bigint;
begin
  if tg_op = 'UPDATE' and new.consultor_id is distinct from old.consultor_id then
    raise exception using errcode = '42501', message = 'proprietario_imutavel';
  end if;
  if tg_op = 'INSERT' or new.cliente_id is distinct from old.cliente_id then
    if not exists(select 1 from public.clientes where id=new.cliente_id and consultor_id=new.consultor_id) then
      raise exception using errcode = '42501', message = 'cliente_indisponivel';
    end if;
  end if;
  if new.status in ('arquivada','deletada') then return new; end if;
  if tg_op = 'UPDATE' and old.status not in ('arquivada','deletada') then return new; end if;
  direitos := app_private.direitos_com_cota_serializada(new.consultor_id);
  limite := (direitos->>'imoveis')::integer;
  if limite is not null then
    select count(*) into quantidade from public.consultas where consultor_id=new.consultor_id and status not in ('arquivada','deletada');
    if quantidade >= limite then raise exception using errcode = 'P0001', message = 'cota_imoveis_excedida'; end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.validar_cota_consulta() from public, anon, authenticated;
create trigger validar_cota_consulta before insert or update on public.consultas
  for each row execute function app_private.validar_cota_consulta();

-- No owner parameter, fixed search_path, no arbitrary SQL. The definer is
-- necessary only to derive contact details from auth.users and serialize.
create function app_private.obter_cliente_titular()
returns uuid language plpgsql security definer set search_path = '' as $$
declare proprietario uuid := auth.uid(); cliente uuid;
begin
  if proprietario is null then raise exception using errcode='42501', message='nao_autenticado'; end if;
  perform app_private.direitos_com_cota_serializada(proprietario);
  select id into cliente from public.clientes where titular_id=proprietario;
  if cliente is not null then
    update public.clientes set ativo=true where id=cliente and not ativo;
    return cliente;
  end if;
  insert into public.clientes(consultor_id, titular_id, nome_completo, email, ativo)
    select proprietario, proprietario, coalesce(nullif(p.nome_completo,''), u.email), u.email, true
      from auth.users u join public.profiles p on p.id=u.id where u.id=proprietario
    returning id into cliente;
  if cliente is null then raise exception using errcode='42501', message='titular_indisponivel'; end if;
  return cliente;
end;
$$;
revoke all on function app_private.obter_cliente_titular() from public, anon;
grant execute on function app_private.obter_cliente_titular() to authenticated;

create function public.obter_cliente_titular()
returns uuid language sql security invoker set search_path = '' as $$
  select app_private.obter_cliente_titular();
$$;
revoke all on function public.obter_cliente_titular() from public, anon;
grant execute on function public.obter_cliente_titular() to authenticated;
