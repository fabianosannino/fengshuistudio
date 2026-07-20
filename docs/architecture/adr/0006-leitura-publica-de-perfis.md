# ADR 0006 — Leitura pública de perfis via view não-PII

- **Status:** Aceito
- **Data:** 2026-07-20 (formaliza a migration `20260720_perfis_publicos_view.sql`)

## Contexto

Três telas são públicas (ou lidas por anon) e precisam de dados de `profiles`:

- `/parceiros` — diretório de parceiros (`parceiro_visivel = true`).
- `/consultores` — consultores com loja publicada.
- `/loja/[slug]` — vitrine pública de uma loja (por `store_slug`).

Depois de restaurar o RLS de `profiles` (ADR 0003 / incidente 2026-07-19),
`profiles` ficou deny-all para anon e essas telas quebraram.

Uma policy de `SELECT` para anon em `profiles` **não** resolve com segurança:
o RLS é por **linha**, não por **coluna** — qualquer policy exporia todas as
colunas (`cpf`, `cnpj`, `telefone`, `role`, `plano`, `stripe_customer_id`…)
das linhas visíveis. É um risco de LGPD (ADR 0005 trata da mesma preocupação
para fotos).

## Decisão

Expor um **subconjunto não-PII** de `profiles` através de uma **view**
dedicada `public.perfis_publicos`:

- Roda com o privilégio do dono (`security_invoker = false`), então bypassa o
  RLS de `profiles` de forma **controlada e limitada às colunas do SELECT**.
- Filtra apenas perfis públicos: `parceiro_visivel = true OR store_slug IS NOT NULL`.
- `SELECT` concedido a `anon` e `authenticated`; `profiles` continua deny-all
  para anon.
- As telas públicas passam a ler `perfis_publicos` (não `profiles`).

### Colunas expostas

Identificação/vitrine: `id`, `nome_completo`, `nome_empresa`, `bio`,
`profissao`, `especialidade`, `area_atuacao`, `registro_profissional`,
`cidade`, `estado`, `site`, `instagram`, `linkedin`, `avatar_url`,
`logo_url`, `cor_primaria`, `cor_secundaria`, `tipo_usuario`, `store_slug`,
`parceiro_visivel`, `stripe_account_id`.

**Nunca expostas:** `cpf`, `cnpj`, `telefone`, `role`, `plano`,
`stripe_customer_id`, datas de trial/plano, `ultimo_acesso`, `consultor_id`.

## Consequências

- O advisor do Supabase lista a view como `security_definer_view`. É
  **intencional** — é justamente o mecanismo que limita as colunas expostas.
- `stripe_account_id` (id de conta Connect `acct_…`, não é segredo) fica
  legível para perfis públicos/com loja, pois a vitrine precisa dele para
  listar os produtos da conta. **Melhoria futura:** mover essa busca para uma
  rota de API com `service_role`, removendo `stripe_account_id` da view.
- Ao adicionar novas colunas sensíveis em `profiles`, a view **não** as expõe
  por padrão (o SELECT é explícito) — falha fechada.
