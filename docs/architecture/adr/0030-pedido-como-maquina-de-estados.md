# ADR 0030 — O pedido é uma máquina de estados, não um campo `status`

**Data:** 2026-08-13
**Status:** aceito
**Relacionado:** ADR 0027 (estado derivado), ADR 0029 (plano derivado de concessões)
**Modelo completo:** `docs/domain/modelo-da-loja.md`

## O que estava quebrado

`store_orders` existia desde abril de 2026 — com RLS, índice único em
`stripe_session_id` e FK para `profiles`. E tinha **zero linhas**, porque nada
em lugar nenhum escrevia nela.

O caminho real de uma compra na loja era: `/loja/[slug]` lia os produtos do
Stripe, `POST /api/stripe/checkout` criava a sessão como *direct charge* com
10% de `application_fee_amount`, o comprador pagava, **fim**. Não havia
tratamento de `checkout.session.completed` em canto nenhum; o webhook de contas
conectadas tratava `account.updated` e mais nada.

Três consequências:

- a venda movia dinheiro e **não deixava registro deste lado**;
- «Vendas Recentes» lia `store_orders` e mostraria vazio para sempre;
- a taxa de 10% era retida sem número para conferir nem para documentar.

Nenhum consultor tinha concluído o onboarding do Connect ainda, então o defeito
foi corrigido **antes** da primeira venda — não depois.

## Por que não bastava passar a escrever em `store_orders`

Porque ela guardava o estado numa coluna `status` sobrescrita, e é a forma de
defeito que este projeto vinha desfazendo: «atrasado» gravado em vez de
derivado da data (ADR 0027), plano gravado sem a procedência que permite
desfazer só a parte certa (ADR 0029).

Um pedido muda por caminhos **independentes** — pagamento, envio, reembolso,
contestação — cada um chegando por uma origem diferente, às vezes fora de
ordem. Uma coluna que guarda só o último valor não sabe dizer quem escreveu,
quando, nem o que havia antes.

## A decisão

`pedido_eventos` é **append-only**. Cada linha é um fato com `ocorrido_em`,
`origem` e `motivo`. O estado corrente é **derivado** por `estadoDoPedido`.

```
pedidos          → quem comprou de quem, por quanto  (sem coluna `status`)
pedido_itens     → o que foi comprado, fotografado no instante da compra
pedido_eventos   → o que aconteceu, quando, por qual origem
```

### O estado sai da precedência, não da ordem de chegada

`estadoDoPedido` devolve o **maior** estado já alcançado, numa ordem de
irreversibilidade — não o último evento a chegar.

O efeito é a propriedade que justifica o desenho: **entrega fora de ordem
deixa de corromper**. Um `pago` que chega depois de um `reembolsado` não desfaz
o reembolso. Com coluna sobrescrita, desfaria — e ninguém saberia, porque não
sobraria histórico para comparar.

`cancelado` fica acima de `entregue` de propósito. Na prática ele só existe
antes do pagamento e nunca disputa com os de cima; ficar alto garante que, se
algum dia disputar, o desfecho negativo prevaleça — o erro barato dos dois.

### `pago` é escrito pelo webhook, e só por ele

Nunca pela `success_url`. Aquela é a tela onde o comprador **cai**, não onde o
dinheiro confirma. Marcar ali significaria que fechar o navegador perde a
venda, e que uma URL montada à mão fabrica uma.

É a mesma lição que a assinatura já tinha ensinado neste projeto, paga com um
cartão de verdade.

### O pedido nasce antes do pagamento

Criado como `iniciado` na rota de checkout, **antes** do redirecionamento, com
o `pedido_id` no `metadata` da sessão. O webhook precisa de onde escrever; se o
pedido só nascesse na confirmação, o handler teria que reconstruir a venda a
partir do que o Stripe devolve — e existiria um caminho em que a reconstrução
falha e a venda some.

O webhook procura pelo `metadata` primeiro e pelo `stripe_session_id` depois: o
`metadata` é gravado junto com a sessão, enquanto o `session_id` depende de um
`update` posterior que pode ter falhado. O caminho mais confiável vem antes.

### Se o pedido não puder ser gravado, o checkout falha

Devolve 503 e não cria a sessão. É deliberado, e é o ponto onde alguém vai
querer «melhorar» depois: seguir com a cobrança sabendo que o registro falhou
reintroduziria exatamente o defeito que este ADR conserta.

Quando a fase 1 trouxer reconciliação da loja — que recupera a venda a partir
do Stripe, como já existe para assinaturas —, isto pode virar best-effort.
**Sem ela, não.**

### O preço é fotografia

`pedido_itens` guarda nome e valor como estavam na compra, sem FK para catálogo
vivo. Um pedido que lê o preço atual é um recibo que reescreve o passado — e
isso só aparece numa contestação, que é o pior momento.

### Append-only é trigger, não convenção

`update` e `delete` em `pedido_eventos` são recusados pelo banco. Sem isso,
«append-only» é um comentário que a próxima pessoa com `service_role` desfaz
sem perceber. Corrigir um evento errado é **acrescentar** o que corrige.

Duas consequências que ficam escritas em vez de descobertas:

1. **`delete from pedidos` falha**, porque o cascade esbarra no trigger. É o
   desfecho certo: venda registrada é documento com prazo de guarda fiscal.
2. **Apagar dado pessoal é anonimizar, não deletar.** O PII do comprador mora
   em `pedidos`, que não tem o trigger. O pedido continua; quem comprou deixa
   de constar.

## O que fica de fora, e é conhecido

- **O comprador não tem conta**, então RLS não o alcança: `auth.uid()` não
  existe para ele. Ver o próprio pedido vai exigir link assinado com prazo. Não
  é esquecimento — é o que RLS não resolve.
- **Não há reconciliação da loja ainda.** A da assinatura existe; a da loja é
  fase 1. Até lá, o checkout fail-closed é o que garante o registro.
- **A taxa de 10% é registrada, mas não documentada fiscalmente.** Ter o número
  é pré-requisito para isso, não substituto.

## Alternativa descartada

«Manter `store_orders` e acrescentar uma tabela de histórico ao lado.» Cria
duas verdades sobre o mesmo pedido — e, pela terceira vez neste projeto, a que
envelheceria seria a gravada. `store_orders` tinha zero linhas: não havia
sequer o argumento de custo de migração.
