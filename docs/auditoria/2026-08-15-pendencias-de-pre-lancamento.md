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

## ~~P2 — `RESEND_API_KEY` com domínio verificado~~ — FEITO em 15/08

O diagnóstico inicial estava errado, e vale registrar por quê: eu supunha que
faltavam a chave e a verificação do domínio. **As duas já existiam** —
`collabz.com.br` verificado desde 24/07 e a chave «FengShui» criada em 14/08.

O que faltava era só o **remetente**: o código pedia envio de
`@fengshuistudio.com.br`, que não é o domínio verificado, e o Resend recusava
com 403 em toda venda:

```
"The fengshuistudio.com.br domain is not verified"
```

Como o envio é best-effort declarado, a recusa virava linha de log e o
comprador ficava sem o link do pedido — o único acesso que ele tem. Corrigido
no PR #161 (remetente padrão) e no #162 (`Reply-To`).

**Nota que evita o próximo engano:** endereço de envio **não é** caixa postal.
O Resend manda de qualquer endereço no domínio verificado, exista caixa ou
não; o que se paga por usuário no provedor é a caixa que **recebe**. Por isso o
remetente pode ser `nao-responda@` sem custo, e o `Reply-To` aponta para a
única caixa real (`fsannino@collabz.com.br`).

Decisão de 15/08: o domínio verificado será **`collabz.com.br`**, com endereço
por produto (`fengshui@…`, `ervatorio@…`), porque um domínio verificado cobre
infinitos endereços e o plano gratuito do Resend dá um domínio só.

O `REMETENTE_PADRAO` de `src/lib/email.ts` já aponta para lá — assim, esquecer
o `EMAIL_REMETENTE` no Vercel deixa de quebrar a entrega em silêncio.

**Falta:** verificar o domínio no Resend (DNS), criar a chave e pôr
`RESEND_API_KEY` em Production. Sem domínio verificado o Resend só entrega para
o e-mail dono da conta — o teste passa e o cliente real não recebe nada.

---

## ~~P3 — Upstash para o rate limit~~ — FEITO

`UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` já estão no Vercel
(informado pelo dono em 15/08, e conferido).

**Como foi conferido:** 36 requisições contra `/api/pedidos/publico` em
produção, com os logs confirmando a chegada das 37 (36 minhas + 1 de fundo) — e
**nenhuma ocorrência** do `logger.warn` «Rate limit sem store compartilhado».
Esse aviso dispara em produção sempre que uma das duas variáveis falta, uma vez
por instância. Silêncio com tráfego passando é a confirmação de que o store
compartilhado está em uso.

**O que este teste NÃO prova:** o bloqueio em si. Nenhuma das 36 recebeu 429,
apesar do limite de 30/min — quase certamente porque as chamadas saíram por um
proxy de IP variável, e `ipDaRequisicao` deriva a chave do IP. Exercitar o
limite de verdade pede requisições de um IP fixo. Fica registrado como lacuna
declarada, não como aprovação.

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
