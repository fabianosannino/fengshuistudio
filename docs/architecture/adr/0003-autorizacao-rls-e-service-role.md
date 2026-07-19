# ADR 0003 — Autorização: RLS, colunas privilegiadas e service_role

- **Status:** Aceito
- **Data:** 2026-07-19 (formaliza o modelo aplicado na migration `20260718_security_hardening.sql`)

## Contexto

A maior parte do CRUD de negócio é feita **direto do navegador** com a anon key
do Supabase (31 de 53 componentes). Isso significa que a segurança de dados
depende inteiramente do Row Level Security. A auditoria de 2026-07-18 encontrou
furos graves nesse modelo:

- RLS de `profiles` permitia `UPDATE ... SET role='admin'` pelo próprio usuário
  (RLS é por linha, não por coluna) — escalada de privilégio (C1).
- Tabelas de billing (`subscriptions`, `invoices`, `store_orders`,
  `payment_notifications`) permitiam o usuário escrever a própria linha —
  auto-assinatura, fatura auto-paga, taxa zerada (C3).
- `plans` sem RLS (C2); função de limpeza de audit log executável por qualquer
  um (C4).

## Decisão

Modelo de **defesa em profundidade**, sem confiar em nenhuma camada isolada:

1. **RLS obrigatório em toda tabela.** Isolamento por `consultor_id`/`user_id`.
2. **Colunas privilegiadas de `profiles`** (`role`, `plano`, `stripe_customer_id`,
   `stripe_account_id`) são protegidas por **trigger** `BEFORE UPDATE`: só podem
   mudar quando o autor é `service_role` ou um admin. RLS por linha não basta
   porque não restringe colunas.
3. **Escritas de billing** (`subscriptions`, `invoices`, `store_orders`,
   `payment_notifications`) são **admin/service_role only**. O usuário só **lê**
   o que é seu. As escritas legítimas vêm dos webhooks (service_role) e das
   rotas admin.
4. **Webhooks e escritas privilegiadas no servidor** usam
   `src/lib/supabase-admin.ts` — client com `SUPABASE_SERVICE_ROLE_KEY`,
   importando `server-only` para que o build falhe se vazar para o cliente.
5. **Funções `SECURITY DEFINER`** fixam `search_path` e têm `EXECUTE` revogado
   de `PUBLIC`/`anon`/`authenticated` quando não devem ser chamadas via API.
6. **Rotas `/api/admin/*`** re-verificam `role` no servidor, além do middleware.

## Consequências

- **Positivo:** o usuário não consegue se promover a admin nem forjar billing,
  mesmo chamando o PostgREST diretamente com a anon key.
- **Custo operacional:** `SUPABASE_SERVICE_ROLE_KEY` passa a ser obrigatória no
  servidor. Sem ela, webhooks e ativação de planos retornam erro (intencional —
  fail fast, não silencioso).
- **Atenção:** a chave `service_role` ignora RLS. Só pode ser usada em código
  `server-only`, após a autorização já ter sido verificada na rota.

## Alternativas consideradas

- **Column-level privileges (`REVOKE UPDATE (role) ...`)** em vez de trigger:
  válido e complementar, mas o trigger dá mensagem de erro clara e cobre a
  regra "admin ou service_role" num só lugar. Pode ser adotado como reforço.
- **Mover todo o CRUD para rotas `/api`** (sem acesso direto do cliente):
  arquiteturalmente mais limpo (não dependeria só de RLS), mas é um refactor
  grande — registrado como débito P2, não bloqueia este modelo.
- **Confiar só no RLS (status quo):** rejeitado — foi a origem de C1–C4.
