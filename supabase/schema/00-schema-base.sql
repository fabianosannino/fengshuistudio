-- ============================================================================
-- SCHEMA BASE — snapshot do banco de produção
--
-- Gerado em 2026-08-12 a partir do catálogo do projeto `airijuazookdnstyfady`.
--
-- ## Por que este arquivo existe
--
-- Achado A8 da auditoria de 2026-07-18: **nenhuma migration cria as tabelas
-- centrais** deste sistema. Elas foram criadas à mão, pelo SQL Editor, ao longo
-- do tempo — e por isso viviam só no banco vivo, sem cópia em lugar nenhum.
--
-- Isso não é hipótese. Em julho um restore reconstruiu a estrutura a partir de
-- uma fonte incompleta e levou junto **todos os defaults, todas as policies e
-- todas as constraints exceto as primary keys** — 35 chaves estrangeiras, zero
-- uniques, zero checks. As telas seguiram "funcionando" porque liam por views
-- `SECURITY DEFINER` que furavam o RLS, e os writes falhavam em silêncio porque
-- ninguém checava o `error`. O incidente está descrito em
-- `docs/auditoria/2026-07-19-incidente-schema-rls-defaults.md`.
--
-- As migrations de 19–20/07 recuperaram o que quebrou naquele dia. Este arquivo
-- fecha o resto: se o banco precisar ser reconstruído, as tabelas e os tipos
-- saem daqui.
--
-- ## O que este arquivo NÃO é
--
-- **Não é uma migration.** Não está em `supabase/migrations/` de propósito: ele
-- não deve ser aplicado num banco que já existe. É um retrato, para leitura e
-- para reconstrução do zero.
--
-- **Não cobre tudo sozinho.** A ordem de uma reconstrução completa é:
--
--   1. este arquivo (tipos e tabelas)
--   2. `migrations/20260720_restore_constraints.sql` (PKs, FKs, uniques, checks)
--   3. as demais migrations em ordem (policies, triggers, defaults, índices)
--
-- ## Como regerar
--
-- Os tipos saem de `pg_type`/`pg_enum` e as tabelas de `pg_attribute` +
-- `pg_attrdef` — as mesmas consultas estão em `scripts/schema/README.md`.
-- Regerar depois de qualquer mudança estrutural aplicada fora de migration.
-- ============================================================================

-- ── Tipos enumerados ────────────────────────────────────────────────────────

create type public.account_status as enum ('pendente', 'ativo', 'suspenso', 'cancelado');
create type public.audit_acao as enum ('login', 'login_falha', 'logout', 'cadastro', 'senha_alterada', 'senha_recuperada', 'consulta_criada', 'consulta_finalizada', 'relatorio_gerado', 'relatorio_acessado', 'pdf_exportado', 'cliente_criado', 'cliente_atualizado', 'cliente_excluido', 'ritual_concluido', 'plano_alterado', 'pagamento_realizado', 'admin_acao');
create type public.consulta_status as enum ('rascunho', 'em_andamento', 'finalizada', 'arquivada', 'deletada', 'sem_analise');
create type public.conteudo_categoria as enum ('novidades', 'tecnicas', 'rituais', 'negocios', 'treinamento', 'geral');
create type public.fase_lunar as enum ('nova', 'crescente', 'cheia', 'minguante');
create type public.plano_tipo as enum ('freemium', 'starter', 'pro', 'agencia');
create type public.porta_posicao as enum ('centro_frente', 'esquerda_frente', 'direita_frente');
create type public.ritual_status as enum ('pendente', 'concluido', 'adiado');
create type public.user_role as enum ('admin', 'consultor', 'cliente');

-- ── Tabelas ─────────────────────────────────────────────────────────────────
--
-- Em ordem alfabética. As chaves estrangeiras entre elas ficam no passo 2 da
-- reconstrução, então a ordem de criação aqui não importa.

create table if not exists public.activation_keys (
  id uuid default gen_random_uuid() not null,
  key text not null,
  plan_type text not null,
  status text not null,
  created_at timestamp with time zone,
  expires_at timestamp with time zone,
  used_at timestamp with time zone,
  used_by uuid,
  note text,
  created_by uuid,
  billing_cycle text,
  duration_months integer,
  discount_percent integer
);

create table if not exists public.admin_audit_log (
  id uuid default gen_random_uuid() not null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  performed_by uuid,
  performed_at timestamp with time zone default now()
);

create table if not exists public.assinaturas (
  id uuid default gen_random_uuid() not null,
  consultor_id uuid not null,
  plano plano_tipo not null,
  status text not null,
  ciclo text not null,
  valor numeric not null,
  inicio timestamp with time zone default now() not null,
  fim timestamp with time zone,
  proximo_vencimento timestamp with time zone,
  gateway text,
  subscription_id text,
  customer_id text,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null
);

create table if not exists public.audit_log (
  id bigint not null,
  usuario_id uuid,
  acao audit_acao not null,
  tabela text,
  registro_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  ip text,
  user_agent text,
  session_id text,
  criado_em timestamp with time zone default now() not null
);

create table if not exists public.clientes (
  id uuid default gen_random_uuid() not null,
  consultor_id uuid not null,
  profile_id uuid,
  nome_completo text not null,
  email text,
  telefone text,
  cpf text,
  data_nascimento date,
  endereco text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  ativo boolean default true not null,
  notas text,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null,
  rua text,
  numero text,
  pais text,
  foto_url text,
  genero text
);

create table if not exists public.consultas (
  id uuid default gen_random_uuid() not null,
  consultor_id uuid not null,
  cliente_id uuid not null,
  nome_imovel text not null,
  tipo_imovel text,
  area_total_m2 numeric,
  endereco_imovel text,
  planta_url text,
  porta_posicao porta_posicao default 'centro_frente'::porta_posicao not null,
  bagua_notas text,
  status consulta_status not null,
  token_cliente uuid,
  relatorio_gerado_em timestamp with time zone,
  relatorio_url text,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null,
  finalizada_em timestamp with time zone,
  roda_da_vida jsonb,
  checklist_chi jsonb,
  posicao_comando jsonb,
  bagua_entrada jsonb,
  bagua_imagem text,
  foto_geral_url text,
  fotos_comodos jsonb,
  num_moradores integer,
  historico_imovel text,
  observacoes_topograficas text,
  dados_adicionais text,
  fotos_antes jsonb,
  fotos_depois jsonb,
  relatorio_pdf_path text,
  modelo_pontuacao text,
  peso_geo numeric(3,2),
  ano_construcao integer,
  ano_reforma_estrutural integer
);

create table if not exists public.consultor_checklist_chi_custom (
  id uuid default gen_random_uuid() not null,
  consultor_id uuid not null,
  item_id text not null,
  label text not null,
  categoria text not null,
  criado_em timestamp with time zone default now() not null
);

create table if not exists public.consultor_curas_custom (
  id uuid default gen_random_uuid() not null,
  consultor_id uuid not null,
  setor_id text not null,
  tipo text not null,
  nome text not null,
  descricao text,
  como_utilizar text,
  created_at timestamp with time zone
);

create table if not exists public.conteudo_admin (
  id uuid default gen_random_uuid() not null,
  autor_id uuid not null,
  titulo text not null,
  resumo text,
  corpo text,
  categoria conteudo_categoria not null,
  arquivo_url text,
  arquivo_nome text,
  arquivo_tipo text,
  arquivo_tamanho integer,
  planos_acesso text[],
  publicado boolean,
  publicado_em timestamp with time zone,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null
);

create table if not exists public.cronograma_lunar (
  id uuid default gen_random_uuid() not null,
  consulta_id uuid not null,
  prescricao_id uuid,
  semana integer not null,
  data_ritual date not null,
  hora_sugerida time without time zone,
  fase_lunar fase_lunar,
  titulo text not null,
  instrucoes text,
  status ritual_status not null,
  concluido_em timestamp with time zone,
  notas_cliente text,
  notificado boolean,
  notificado_em timestamp with time zone,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null
);

create table if not exists public.diagnostico_criterios (
  id uuid default gen_random_uuid() not null,
  setor_id uuid not null,
  criterio text not null,
  score integer not null,
  notas text,
  criado_em timestamp with time zone default now() not null
);

create table if not exists public.diagnostico_snapshots (
  id uuid default gen_random_uuid() not null,
  consulta_id uuid not null,
  tipo text not null,
  scores jsonb not null,
  criado_em timestamp with time zone default now() not null
);

create table if not exists public.fotos_consulta (
  id uuid default gen_random_uuid() not null,
  consulta_id uuid not null,
  setor_id uuid,
  url text not null,
  descricao text,
  tipo text,
  enviado_por text,
  criado_em timestamp with time zone default now() not null
);

create table if not exists public.invoices (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  subscription_id uuid,
  plan_id uuid,
  amount numeric not null,
  discount numeric,
  amount_paid numeric,
  status text not null,
  billing_cycle text,
  due_date date not null,
  paid_at timestamp with time zone,
  paid_manually boolean,
  paid_method text,
  paid_by_admin uuid,
  gateway_invoice_id text,
  payment_url text,
  description text,
  installments integer,
  installment_number integer,
  notes text,
  refunded_at timestamp with time zone,
  refund_amount numeric,
  created_at timestamp with time zone,
  stripe_refund_id text
);

create table if not exists public.notificacoes (
  id uuid default gen_random_uuid() not null,
  usuario_id uuid not null,
  titulo text not null,
  mensagem text not null,
  tipo text,
  lida boolean,
  lida_em timestamp with time zone,
  link text,
  criado_em timestamp with time zone default now() not null
);

create table if not exists public.pagamentos (
  id uuid default gen_random_uuid() not null,
  consultor_id uuid not null,
  cliente_id uuid,
  consulta_id uuid,
  descricao text not null,
  valor numeric not null,
  status character varying(20) not null,
  data_vencimento date not null,
  data_pagamento date,
  metodo_pagamento character varying(30),
  observacoes text,
  criado_em timestamp with time zone,
  atualizado_em timestamp with time zone
);

create table if not exists public.payment_notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  invoice_id uuid,
  type text not null,
  channel text not null,
  sent_at timestamp with time zone,
  read_at timestamp with time zone,
  content text,
  created_at timestamp with time zone
);

create table if not exists public.plans (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  price_monthly numeric not null,
  price_yearly numeric not null,
  description text,
  features jsonb,
  is_active boolean,
  created_at timestamp with time zone
);

create table if not exists public.prescricoes (
  id uuid default gen_random_uuid() not null,
  consulta_id uuid not null,
  setor_id uuid,
  titulo text not null,
  descricao text,
  elemento text,
  objeto text,
  cor text,
  mudra text,
  mantra text,
  visualizacao text,
  custo_min numeric,
  custo_max numeric,
  prioridade integer not null,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null
);

create table if not exists public.produtos_afiliados (
  id uuid default gen_random_uuid() not null,
  categoria text not null,
  nome text not null,
  descricao text,
  tag text,
  preco text,
  link_afiliado text,
  ativo boolean default true not null,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null
);

create table if not exists public.profiles (
  id uuid not null,
  role user_role not null,
  status account_status not null,
  plano plano_tipo not null,
  nome_completo text not null,
  telefone text,
  cpf text,
  avatar_url text,
  nome_empresa text,
  cnpj text,
  especialidade text,
  bio text,
  site text,
  logo_url text,
  cor_primaria text,
  cor_secundaria text,
  trial_inicio timestamp with time zone,
  trial_fim timestamp with time zone,
  plano_inicio timestamp with time zone,
  plano_fim timestamp with time zone,
  consultor_id uuid,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null,
  ultimo_acesso timestamp with time zone,
  cidade text,
  estado text,
  profissao text,
  area_atuacao text,
  registro_profissional text,
  linkedin text,
  instagram text,
  parceiro_visivel boolean,
  tipo_usuario text,
  stripe_account_id text,
  stripe_customer_id text,
  store_slug text
);

create table if not exists public.rituais (
  id uuid default gen_random_uuid() not null,
  consultor_id uuid not null,
  cliente_id uuid,
  titulo text not null,
  descricao text,
  fase_lunar text not null,
  data_ritual date not null,
  horario time without time zone,
  status text,
  tipo text,
  criado_em timestamp with time zone
);

create table if not exists public.setores_bagua (
  id uuid default gen_random_uuid() not null,
  consulta_id uuid not null,
  numero integer not null,
  nome text not null,
  elemento text,
  cor_associada text,
  posicao_grid text,
  area_m2 numeric,
  tem_falta boolean,
  tem_excesso boolean,
  notas text,
  score_percentual numeric,
  criado_em timestamp with time zone default now() not null,
  atualizado_em timestamp with time zone default now() not null,
  recomendacoes_custom jsonb,
  comodo_tipo text,
  comodos jsonb
);

create table if not exists public.store_orders (
  id uuid default gen_random_uuid() not null,
  seller_id uuid not null,
  buyer_email text,
  buyer_name text,
  product_name text not null,
  amount numeric not null,
  platform_fee numeric,
  status text not null,
  stripe_session_id text,
  stripe_payment_intent text,
  created_at timestamp with time zone
);

create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  plan_id uuid not null,
  billing_cycle text not null,
  status text not null,
  price_paid numeric,
  started_at timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  next_billing_date timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancel_at_period_end boolean,
  payment_method_id text,
  gateway_subscription_id text,
  activated_by_key uuid,
  gratuidade_motivo text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);

create table if not exists public.weekly_reports (
  id uuid default gen_random_uuid() not null,
  week_start date not null,
  week_end date not null,
  generated_at timestamp with time zone,
  data jsonb not null,
  is_manual boolean,
  sent_to text[],
  created_at timestamp with time zone
);
