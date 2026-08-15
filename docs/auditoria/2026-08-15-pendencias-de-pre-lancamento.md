# Pendências de pré-lançamento

**Criado em:** 2026-08-15
**Estado:** aberto

O que ficou decidido para ser feito **antes do lançamento**, com a razão de cada
item e o que muda se ele não for feito. Não é lista de desejos: é o conjunto de
coisas que já têm decisão tomada e data, faltando execução.

---

## ~~P1 — Rotacionar os segredos expostos~~ — FEITO em 15/08

Adiado de manhã, executado à noite. Os dois segredos que vazaram estão mortos:

| segredo | o que foi feito |
|---|---|
| `sk_live_…VTf5` | encerrada, depois de a nova entrar e ser conferida |
| `sk_live_…ofRf` | encerrada — existia viva e **nunca tinha sido usada** |
| `service_role` legada | desabilitada, junto com o resto do sistema de chaves JWT |

### O que quase deu errado

**A tela do Supabase não desabilita a `service_role` sozinha.** «Disable
JWT-based API keys» desliga o par — `service_role` **e** `anon` — e a `anon`
estava em uso em três lugares (`supabase.ts`, `supabase-server.ts`,
`supabase-route.ts`), que sustentam login e toda leitura autenticada. Clicar
antes de migrar teria derrubado o app inteiro.

O caminho que funcionou foi migrar as duas para o formato novo
(`sb_secret_…` e `sb_publishable_…`), que são revogáveis individualmente e não
exigem tocar no segredo JWT — o que teria derrubado todas as sessões ativas.

**Um deploy falhou no meio**, por `next/font/google` não resolver a fonte
Fraunces em tempo de build. Nada a ver com as chaves, mas o sintoma era «quebrou
logo depois de eu mexer nisso». Se tivesse levado à conclusão errada, a
correção teria sido no lugar errado. Segunda ocorrência no dia; a primeira foi
no merge do #159.

### O procedimento, para a próxima vez

Vale para qualquer segredo, e a ordem é a lição: **criar → migrar → conferir →
revogar**. Nunca revogar primeiro. Enquanto a chave velha existe, desfazer é um
redeploy; depois de revogada, não é.

Conferido com quatro compras reais de R$ 1,00 — a última já com as chaves
legadas desabilitadas.

---

<details>
<summary>O registro original, mantido</summary>

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

</details>

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
não; o que se paga por usuário no provedor é a caixa que **recebe**.

Decisão de 15/08: o domínio verificado é **`collabz.com.br`**, porque um
domínio verificado cobre infinitos endereços e o plano gratuito do Resend dá um
domínio só.

**Correção do mesmo dia:** o remetente passou de `nao-responda@` para
`fsannino@collabz.com.br`, que é a única caixa que existe de verdade. O motivo
não é o que parece — `nao-responda@` enviaria normalmente. É que ele obrigava a
manter um `Reply-To` separado, ou seja, uma segunda variável cuja falha é
invisível: com ela errada, a resposta do comprador cai numa caixa que ninguém
lê, sem erro e sem log. Com um endereço só, não há parte que possa envelhecer
sozinha. O `Reply-To` continua no código, e agora é **omitido** quando aponta
para o próprio remetente.

Está tudo verificado e no ar: domínio desde 24/07, chave desde 14/08, e a
entrega conferida em pedido real (`P260815-B1D533`).

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
