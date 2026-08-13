# Modelo da loja — documento de trabalho

**Estado:** em modelagem. Não é ADR ainda; vira ADR quando as decisões abertas
da última seção estiverem fechadas.

Este documento existe porque a loja é a próxima coisa a nascer, e porque o
projeto passou o dia 13/08 consertando defeitos de uma forma só: **um fato
guardado sem a informação que permite interpretá-lo depois**. Escrever o pedido
como um campo `status` sobrescrito seria reencenar isso em três meses, com
dinheiro de terceiro no meio.

---

## 0. O que já existe — e o que está quebrado agora

`store_orders` existe desde `20260407_store_slug_and_sales.sql`. Tem RLS, tem
índice único em `stripe_session_id`, tem FK para `profiles`. E tem **zero
linhas** — porque nada, em lugar nenhum do código, escreve nela.

O caminho real de uma compra na loja hoje:

1. `/loja/[slug]` lê os produtos direto do Stripe da conta conectada;
2. `POST /api/stripe/checkout` cria a sessão como *direct charge* com
   `application_fee_amount` de 10% e devolve a URL;
3. o comprador paga;
4. **fim.**

Não há tratamento de `checkout.session.completed` em lugar nenhum. O webhook de
contas conectadas (`/api/stripe/webhooks`) trata `account.updated` e mais nada.

Três consequências, todas presentes:

- **Uma venda real move dinheiro e não deixa registro deste lado.** O fato
  existe no Stripe e não existe aqui — a mesma forma do defeito da assinatura,
  antes da reconciliação.
- **A tela «Minhas vendas» em `/stripe/onboard` lê `store_orders`** e vai
  mostrar vazio para sempre, independentemente de quanto o consultor venda.
- **A taxa de 10% é retida sem registro.** Reter comissão é prestar serviço de
  intermediação ao consultor, e serviço prestado pede documento fiscal. Hoje
  não há nem o número para conferir.

Isso não é dívida futura da loja: é defeito da loja que já está no ar. O modelo
abaixo é também o conserto.

---

## 1. Três vendas diferentes, não uma venda com um campo `tipo`

| o que | quem é o vendedor | entrega | documento fiscal |
|---|---|---|---|
| serviço do consultor | o consultor | a consulta acontece | NFS-e do consultor |
| bem próprio | a plataforma | download ou envio | da plataforma |
| bem de terceiro | o terceiro | dele | dele |

Não são três variações de uma coisa. Têm vendedor diferente, obrigação
diferente e imposto diferente. Uma tabela só com um `tipo` e tudo o mais
anulável significa que metade das colunas está sempre vazia e nenhuma
constraint consegue dizer qual metade — é o mesmo problema de `profiles.plano`,
em maior escala.

**O que é comum entre as três não é o pedido. É o dinheiro.**

---

## 2. Um pedido não mistura vendedores

Regra: **um pedido tem exatamente um vendedor e um tipo.** Comprar uma consulta
e um incenso na mesma visita produz **dois pedidos**, não um pedido com dois
itens de naturezas diferentes.

Isso não é preferência de modelagem — é imposição do meio de pagamento. Um
*direct charge* acontece **numa** conta conectada. Não existe cobrança única
dividida entre dois vendedores no desenho atual. Modelar um pedido que mistura
vendedores criaria um objeto que o Stripe não consegue pagar.

O ganho: o estado do pedido passa a significar uma coisa só. Um pedido de
serviço nunca fica «aguardando envio».

---

## 3. O pedido nasce antes do pagamento

O pedido é criado como `iniciado` **na rota de checkout, antes do redirecionamento**,
com o `session_id` e com o `pedido_id` no `metadata` da sessão do Stripe.

Duas razões:

- **O webhook precisa achar onde escrever.** Se o pedido só nascer quando o
  pagamento confirmar, o webhook tem que reconstruir a venda a partir do que o
  Stripe devolve — e passa a existir um caminho em que a reconstrução falha e a
  venda some.
- **Carrinho abandonado vira dado, não vira nada.** Um `iniciado` sem `pago` é
  informação de produto.

E a contrapartida, que é a regra mais importante daqui:

> **`pago` só é escrito pelo webhook. Nunca pela tela de sucesso.**

A `success_url` é onde o comprador cai, não onde o dinheiro confirma. Marcar
pago ali significa que fechar o navegador perde a venda e que uma URL montada à
mão fabrica uma. É a mesma lição que a assinatura já ensinou neste projeto,
paga com um cartão de verdade.

---

## 4. O preço é fotografia, não referência

O item do pedido guarda **nome, descrição e preço como estavam no instante da
compra** — não uma FK para o catálogo.

O vendedor edita o produto amanhã; o que o comprador pagou hoje não pode mudar
junto. Um pedido que lê o preço atual do catálogo é um recibo que reescreve o
passado — e é justamente o tipo de coisa que só se descobre numa contestação,
que é o pior momento possível.

Vale para o valor, para a taxa da plataforma e para o nome do produto.

---

## 5. O estado sai dos eventos (ADR 0027)

`pedido_eventos` é **append-only**. Cada linha traz o que aconteceu, **quando**,
**por qual origem** (`webhook_stripe | vendedor | comprador | admin | sistema`)
e o motivo. O estado corrente é o último evento — derivado, não gravado.

| evento | quem produz |
|---|---|
| `iniciado` | a rota de checkout |
| `pago` | webhook (`checkout.session.completed`) |
| `cancelado` | comprador ou vendedor, antes do pagamento |
| `preparando` | vendedor |
| `enviado` | vendedor, com rastreio |
| `entregue` | vendedor, transportadora ou comprador |
| `reembolsado` | webhook (`charge.refunded`) |
| `contestado` / `disputa_resolvida` | webhook de disputa |

E dois estados que **não são eventos**, porque são ausência:

- **`abandonado`** — `iniciado` há mais de N sem `pago`. Ninguém abandona um
  carrinho ativamente; gravar isso seria inventar um ato que não houve.
- **`concluido`** — entregue **e** prazo de arrependimento vencido. Sai de duas
  datas, e por isso muda sozinho com o relógio.

Guardar qualquer um dos dois criaria a segunda verdade, e seria a gravada que
envelheceria.

### O prazo de arrependimento é derivado

Venda a distância tem sete dias de arrependimento a contar do recebimento
(CDC art. 49). Isso é `data_de_entrega + 7`, calculado na leitura — nunca um
booleano `pode_devolver` que alguém precisa lembrar de virar.

---

## 6. Remessa não existe para serviço

`remessas` é entidade separada, e um pedido de serviço simplesmente **não tem
nenhuma**. Não tem uma remessa vazia, não tem `enviado_em = null` esperando ser
preenchido.

É a regra de «ausência ≠ zero» aplicada à logística: um pedido sem remessa não
é um pedido com envio pendente. Colar as colunas de envio dentro de `pedidos`
faria todo pedido de consulta carregar um endereço vazio e um rastreio nulo, e
faria qualquer painel de «pendentes de envio» precisar de um `where tipo <>` que
alguém vai esquecer.

---

## 7. A comissão é um direito com origem e prazo

A taxa da plataforma e a comissão de afiliado têm a **mesma forma** da concessão
de plano (ADR 0029): um direito, com origem, referência, prazo e possibilidade
de reversão.

Não é coincidência. Comissão é reversível — reembolso e disputa perdida a
desfazem —, e desfazer exige saber **de qual venda** ela veio. Uma coluna
`comissao_paga` sofreria exatamente o que `profiles.plano` sofreu: um valor sem
procedência, que o próximo evento apaga sem saber o que apagou.

Consequência prática: **comissão não vence no ato da compra.** Ela vence quando
a janela de reembolso e contestação fecha. Antes disso é direito registrado e
não sacável — que é o que `valido_de` no futuro já sabe expressar.

---

## 8. Afiliado de saída ≠ afiliado de entrada

Duas coisas com o mesmo nome, e que não podem compartilhar tabela:

- **Saída** — o que `produtos_afiliados` já é hoje: link para loja de fora.
  Nenhum dinheiro passa por aqui, nenhum pedido existe deste lado, e a
  plataforma não tem obrigação nenhuma com a entrega. É conteúdo, não comércio.
- **Entrada** — o programa de afiliados: alguém traz um comprador ou um
  assinante e ganha percentual do que passou **pela nossa conta**. Aqui há
  dinheiro nosso, apuração e repasse.

O nome colide, a natureza não. Juntar as duas numa tabela de «afiliados» faria a
primeira herdar obrigações que ela não tem, e a segunda herdar um campo
`link_afiliado` que não faz sentido.

---

## 9. O comprador não tem conta

A rota de checkout já assume isso: «compradores da loja não são usuários da
plataforma». Duas consequências que precisam de decisão consciente:

- **RLS não protege o comprador**, porque não há `auth.uid()` para comparar.
  Ver o próprio pedido exige link assinado com prazo, não uma policy.
- **O e-mail do comprador é dado pessoal** e chega pela sessão do Stripe. Entra
  no inventário do `docs/security/threat-model.md` e precisa de prazo de
  retenção declarado — guardar para sempre «porque pode ser útil» é o padrão
  que a LGPD não aceita.

---

## 10. Decisões abertas

Estas mudam o modelo, e não têm resposta técnica:

1. **O bem próprio é digital ou físico?** Digital pede quase nada além do que
   está acima. Físico traz estoque, endereço, frete, NF-e e ICMS — outra ordem
   de grandeza, e a maior parte dela não é código.
2. **No bem de terceiro, o dinheiro passa pela plataforma?** Se passa, somos
   marketplace, com as obrigações de quem intermedeia. Se não passa, é
   indicação, e nem pedido existe deste lado.
3. **Quem pode ser afiliado de entrada?** Se for só consultor, o repasse anda
   pela conta Connect que já existe. Se for qualquer pessoa, é trilho de
   pagamento novo, com cadastro, validação e retenção.

Enquanto não houver resposta, o que está das seções 0 a 9 vale — e a seção 0 é
conserto, não espera.
