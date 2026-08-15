# Pendências de pré-lançamento

**Criado em:** 2026-08-15
**Estado:** aberto

O que ficou decidido para ser feito **antes do lançamento**, com a razão de cada
item e o que muda se ele não for feito. Não é lista de desejos: é o conjunto de
coisas que já têm decisão tomada e data, faltando execução.

---

## P1 — Rotacionar os segredos expostos

**Decisão do dono (15/08): fica para antes do lançamento.**

### O que aconteceu

Durante o desenvolvimento, dois segredos de produção foram colados numa
conversa de chat:

- a **chave secreta viva do Stripe** (`sk_live_…`);
- a **`service_role` do Supabase**.

Nenhum dos dois foi para o repositório — e isso importa, porque o repositório é
**público**. O que houve foi saída do limite pretendido: eles existem hoje fora
do cofre de variáveis onde deveriam viver sozinhos.

### O que cada um permite a quem tiver

| segredo | o que abre |
|---|---|
| `sk_live_` | criar cobranças, emitir reembolsos, ler o cadastro de todos os clientes pagantes, movimentar dinheiro da conta |
| `service_role` | ignorar RLS por completo: ler e escrever **toda** tabela, incluindo dados pessoais de clientes, endereços e caminhos de fotos de interiores de casas |

O segundo é o mais grave em termos de LGPD: a base tem endereço residencial e
fotos do interior da casa de clientes de consultoria.

### A ressalva registrada

«Antes do lançamento» é um marco que, para a superfície de pagamento, **já
passou**: a loja está no ar e processou cobranças reais em 13, 14 e 15/08 —
R$ 13,00 em quatro pedidos, com cartão de verdade. O risco não é hipotético
esperando o lançamento; ele corre desde a primeira cobrança.

Um gatilho mais honesto do que «lançamento» seria **antes do primeiro cliente
que não seja você**. Fica anotado como ressalva, não como objeção: a decisão é
do dono e está tomada.

### O procedimento, quando for a hora

Um de cada vez, com redeploy no meio — as duas erradas ao mesmo tempo derrubam
pagamento e webhook juntos.

1. Stripe → Desenvolvedores → Chaves de API → **Roll key** na `sk_live_`
2. Vercel → `STRIPE_SECRET_KEY` = nova → **Redeploy**
3. Supabase → Project Settings → API → **service_role** → gerar nova
4. Vercel → `SUPABASE_SERVICE_ROLE_KEY` = nova → **Redeploy**

Depois de cada troca, conferir que o webhook do Stripe volta a entregar
(`eventos_stripe` recebendo linhas) e que uma leitura autenticada qualquer
continua funcionando.

---

## P2 — `RESEND_API_KEY` com domínio verificado

Sem isso o comprador **não recebe o link do pedido**, e como ele não tem conta,
esse link é o único acesso que ele tem. Hoje a loja depende de o comprador não
fechar a aba.

Conferido em 15/08: `confirmacao_enviada_em` está nulo nos seis pedidos.

Decisão de 15/08: o domínio verificado será **`collabz.com.br`**, com endereço
por produto (`fengshui@…`, `ervatorio@…`), porque um domínio verificado cobre
infinitos endereços e o plano gratuito do Resend dá um domínio só. Ver a nota
sobre `EMAIL_REMETENTE` em `src/lib/email.ts`.

---

## P3 — Upstash para o rate limit

Sem `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`, `rate-limit.ts`
degrada para memória local — e em serverless cada requisição pode cair numa
instância nova, então na prática não limita. A degradação é declarada
(ADR 0023), o que não a torna suficiente para produção com dinheiro.

---

## P4 — Pix

Pausado em 15/08 por decisão do dono, para estudo. Não é bloqueio: é economia de
tarifa. A medição, agora com quatro pedidos reais, é **3,99% + R$ 0,39** — em
venda de R$ 1,00 a parte fixa sozinha é 43%.

O passo anterior já foi feito em código (PR #158): a capacidade `pix_payments`
passou a ser pedida na criação da conta conectada e no `account-link`. Falta
apenas alguém clicar em continuar o onboarding, e ligar o Pix no painel da
conta da plataforma.

Pendente junto: acrescentar `checkout.session.async_payment_succeeded` e
`checkout.session.async_payment_failed` ao destino das **contas conectadas**
(`we_1U3ro5…`) — o destino da conta da plataforma já os tem.

---

## P5 — Estornar os pedidos de teste

R$ 13,00 em cinco pedidos de teste com cartão real. Um deles
(`P260814-09F9B7`) tem **devolução solicitada e não estornada** — é obrigação
registrada no próprio sistema, e a mais antiga.

Mantidos por ora, por decisão de 15/08, como medida da tarifa em valores
diferentes.
