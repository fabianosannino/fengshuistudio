# ADR 0002 — Pagamentos: Stripe Connect (loja) e assinaturas da plataforma

- **Status:** Aceito
- **Data:** 2026-07-19 (documenta decisão já em vigor)

## Contexto

O produto tem dois fluxos de dinheiro distintos:

1. **Assinatura da plataforma:** o consultor paga a FengShui Studio pelo acesso
   (planos `simples`/`profissional`).
2. **Loja do consultor:** o consultor vende serviços/produtos aos clientes
   dele; a plataforma retém uma taxa sobre cada venda.

Ambos precisam ser seguros contra manipulação de valores pelo cliente e
sincronizar estado (plano ativo, fatura paga) de forma confiável.

## Decisão

- **Assinaturas** usam **Stripe Checkout em modo `subscription`** na conta da
  plataforma (`/api/stripe/subscribe`). Os `price_id` dos planos vêm de
  variáveis de ambiente (`STRIPE_PRICE_*`), nunca do cliente.
- **Loja** usa **Stripe Connect com Direct Charges** (`/api/stripe/checkout`):
  a cobrança é criada na conta conectada do consultor (merchant of record) e a
  plataforma coleta `application_fee_amount`.
- **O preço NUNCA vem do cliente.** O checkout aceita apenas um `price_id` e lê
  o `unit_amount` real do Stripe no servidor (na conta conectada) antes de criar
  a sessão. Isso, ao mesmo tempo, valida que o `price_id` pertence àquela conta.
- **`account_id` é sempre derivado do perfil autenticado** nas rotas
  autenticadas (products, account-link) — nunca aceito do corpo da requisição.
- **Sincronização é feita por webhooks** (`/api/stripe/webhooks` e
  `/api/stripe/webhooks/subscriptions`), que verificam a assinatura do evento
  (`constructEvent`) e escrevem com `service_role` (ver ADR 0003).

## Consequências

- **Positivo:** impossível o comprador definir o próprio preço; a taxa da
  plataforma é calculada sobre o valor real.
- **Positivo:** PCI fica com o Stripe (Checkout hospedado).
- **Custo/atenção:** o funcionamento depende de os webhooks estarem
  configurados no painel do Stripe e de `SUPABASE_SERVICE_ROLE_KEY` estar
  presente no servidor. Sem isso, a sincronização de billing falha.
- **Atenção:** `resolvePlanSlug` NÃO concede um plano por padrão quando o preço
  não casa com nenhum plano — loga e não altera (evita conceder o plano mais
  alto por engano).

## Alternativas consideradas

- **Aceitar `unit_amount`/preço do cliente:** rejeitado — permite subvalorização
  (comprador paga R$0,01). Foi o achado crítico C5 da auditoria.
- **Destination Charges em vez de Direct:** possível, mas Direct Charges deixa o
  consultor como merchant of record (aparece no extrato do cliente dele), que é
  o comportamento desejado para a loja.
- **Sincronizar por polling em vez de webhooks:** rejeitado — mais lento, mais
  chamadas à API, e não captura eventos como falha de pagamento em tempo hábil.
