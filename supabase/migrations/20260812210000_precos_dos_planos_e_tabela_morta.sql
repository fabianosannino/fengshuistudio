-- ═══════════════════════════════════════════════════════════════════════════
-- Preço dos planos alinhado ao Stripe, e a tabela `assinaturas` removida
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## 1. `plans` guardava preços que ninguém cobra
--
-- A tabela dizia Simples R$ 97/mês e Profissional R$ 247/mês. O catálogo de
-- produção do Stripe cobra R$ 20,00 e R$ 49,90 — conferido com
-- `scripts/stripe/conferir-precos.mts`. Cinco vezes acima do real.
--
-- O estrago não é cosmético. `/api/admin/relatorios` e `/api/admin/subscriptions`
-- calculam o MRR somando `plans.price_monthly` por assinante, então o painel
-- reportaria cinco vezes a receita que existe. E `resolvePlanSlug`, no webhook,
-- usa esses valores para descobrir o plano quando a assinatura não traz
-- metadata — comparação que nunca casaria, e o plano ficaria nulo.
--
-- Os valores vêm de `PRECOS_DOS_PLANOS` em `src/lib/plano-utils.ts`, que é a
-- fonte única desde a correção anterior. Aqui eles são espelho, não origem:
-- ao mudar preço, mude no Stripe, depois no código, e só então aqui.
--
-- ## 2. `assinaturas` é tabela morta
--
-- Criada em `20260404_billing_system.sql` e nunca usada: zero linhas e zero
-- referências no código da aplicação — nenhum `from('assinaturas')` em `app/`
-- ou `src/`. Quem faz o trabalho é `subscriptions`, com seis chamadas.
--
-- Duas tabelas para o mesmo conceito é um convite a escrever na errada. Com
-- zero linhas, remover custa nada; depois da primeira venda, custa migração.
--
-- A definição continua em `supabase/schema/00-schema-base.sql`, então recriar
-- é possível se algum dia fizer sentido.

-- ── 1. Preços ───────────────────────────────────────────────────────────────

update public.plans set price_monthly = 0,     price_yearly = 0      where slug = 'free';
update public.plans set price_monthly = 20.00, price_yearly = 168.00 where slug = 'simples';
update public.plans set price_monthly = 49.90, price_yearly = 411.60 where slug = 'profissional';

-- ── 2. Tabela morta ─────────────────────────────────────────────────────────

drop table if exists public.assinaturas;
