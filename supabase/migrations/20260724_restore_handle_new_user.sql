-- ============================================================
-- Restauração do trigger de signup (handle_new_user)
-- ============================================================
--
-- Mais uma perda do incidente de schema: auth.users estava com ZERO
-- triggers e a função handle_new_user não existia. Consequência: todo
-- cadastro novo criava o usuário no Auth **sem linha em profiles** —
-- quebrando o resgate de chave de ativação (FK activation_keys_used_by_fkey),
-- a detecção de plano e qualquer fluxo que leia o perfil.
-- Descoberto nos logs de produção: "violates foreign key constraint
-- activation_keys_used_by_fkey" ao queimar a chave.
--
-- A função reconstrói o profile a partir do user_metadata que o cadastro
-- envia (app/login/page.tsx: nome_completo, tipo_usuario, role e campos
-- profissionais). Enums respeitados: user_role (admin|consultor|cliente),
-- account_status, plano_tipo (freemium|starter|pro|agencia).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, nome_completo, role, status, plano, tipo_usuario,
    profissao, area_atuacao, registro_profissional, linkedin, instagram
  )
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome_completo', ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data->>'role' = 'consultor' then 'consultor'::user_role
         else 'cliente'::user_role end,
    'ativo'::account_status,
    'freemium'::plano_tipo,
    coalesce(nullif(new.raw_user_meta_data->>'tipo_usuario', ''), 'pessoal'),
    nullif(new.raw_user_meta_data->>'profissao', ''),
    nullif(new.raw_user_meta_data->>'area_atuacao', ''),
    nullif(new.raw_user_meta_data->>'registro_profissional', ''),
    nullif(new.raw_user_meta_data->>'linkedin', ''),
    nullif(new.raw_user_meta_data->>'instagram', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Função de trigger não deve ser chamável via RPC (advisor 0028/0029).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: cria o profile dos usuários cadastrados enquanto o trigger
-- não existia (mesma lógica do trigger).
insert into public.profiles (
  id, nome_completo, role, status, plano, tipo_usuario,
  profissao, area_atuacao, registro_profissional, linkedin, instagram
)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'nome_completo', ''), split_part(u.email, '@', 1)),
  case when u.raw_user_meta_data->>'role' = 'consultor' then 'consultor'::user_role
       else 'cliente'::user_role end,
  'ativo'::account_status,
  'freemium'::plano_tipo,
  coalesce(nullif(u.raw_user_meta_data->>'tipo_usuario', ''), 'pessoal'),
  nullif(u.raw_user_meta_data->>'profissao', ''),
  nullif(u.raw_user_meta_data->>'area_atuacao', ''),
  nullif(u.raw_user_meta_data->>'registro_profissional', ''),
  nullif(u.raw_user_meta_data->>'linkedin', ''),
  nullif(u.raw_user_meta_data->>'instagram', '')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
