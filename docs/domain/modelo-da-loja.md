# Modelo da loja — documento de trabalho

**Estado:** modelo fechado nas três decisões de produto (seção 10). A **fase 0
está implementada** — ver ADR 0030 e a migration `20260813050000`. As fases 1 a
5 seguem como plano.

Este documento existe porque a loja é a próxima coisa a nascer, e porque o
projeto passou o dia 13/08 consertando defeitos de uma forma só: **um fato
guardado sem a informação que permite interpretá-lo depois**. Escrever o pedido
como um campo `status` sobrescrito seria reencenar isso em três meses, com
dinheiro de terceiro no meio.

---

## 0. O que estava quebrado (corrigido na fase 0)

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

## 10. Decisões tomadas (13/08/2026)

1. **Bem próprio inclui físico.** Espelho, cristal, sino — não só digital.
2. **Bem de terceiro pode ser dos dois jeitos, produto a produto.** Alguns por
   indicação (o terceiro vende, nós ganhamos comissão), outros por marketplace
   (o dinheiro passa por aqui).
3. **Afiliado pode ser qualquer pessoa — desde que tenha conta Connect.**

A terceira merece a justificativa, porque não era uma das opções oferecidas.

O que torna «qualquer pessoa» perigoso não é o alcance: é guardar dado bancário
e fazer verificação de identidade por conta própria. Exigir conta Connect tira
os dois do nosso banco — a verificação é do Stripe, o dado bancário nunca chega
aqui, e o repasse é transferência, não TED disparado na mão.

E o código fica **um só**: consultor afiliado e estranho afiliado andam pelo
mesmo trilho. Abrir para consultores primeiro é custo zero, porque eles já têm
conta; abrir para o resto depois é liberar cadastro, não escrever subsistema.

**Fora de arquitetura, mas real:** comissão a pessoa física tem retenção na
fonte; a PJ, não do mesmo jeito. Isso muda quanto se paga de verdade, e precisa
de contador antes de anunciar percentual.

### Atribuição do afiliado — proposta

Não foi perguntado e precisa de um padrão: **último clique, janela de 30 dias.**
É o mais comum no mercado e o mais fácil de explicar a quem vai divulgar. O
clique vira linha em `indicacoes` com prazo; a comissão nasce da indicação viva
no instante da compra — de novo, a forma da concessão.

---

## 11. O que «físico» traz junto

A decisão 1 é a mais cara do documento, e a maior parte do custo **não é
código**:

- **Emissão de NF-e** exige inscrição estadual, regime tributário definido,
  certificado digital e um emissor (próprio ou API). Cada produto precisa de
  **NCM**, e conforme o estado, **CEST** e substituição tributária.
- **ICMS interestadual** muda com o destino. Vender para outro estado não é a
  mesma conta que vender para o seu.
- **Arrependimento com bem físico é logística reversa.** Os sete dias do
  CDC art. 49 contam do recebimento, e o frete da devolução é do vendedor. Não
  basta estornar: alguém precisa receber a caixa de volta.
- **Estoque** é o clássico número que dá errado sem deixar rastro. Vai pelo
  mesmo desenho de tudo aqui: `movimentos_de_estoque` append-only como verdade,
  saldo como projeção mantida por uma função só. Sem isso, «sumiram três
  espelhos» é uma pergunta sem resposta.

Nada disso impede começar. Impede começar **por aqui** — ver a seção 14.

---

## 12. O que «marketplace» traz junto

Quando o dinheiro passa por nós, deixamos de ser vitrine e passamos a ser
intermediário. A consequência prática é que **o comprador cobra de nós** quando
o terceiro não entrega — o CDC trata a cadeia de fornecimento como solidária, e
o cliente escolhe de quem cobrar.

Por isso o modo de venda mora **no produto**, com constraint, e não na cabeça de
quem cadastrou:

- `indicacao` **exige** link externo e **proíbe** pedido deste lado;
- `marketplace` **proíbe** link externo e **exige** vendedor identificado.

Deixar isso implícito significaria descobrir de qual tipo era o produto no meio
de uma reclamação — que é tarde.

---

## 12-A. Arrependimento, frete e devolução integral

Requisito do dono, 13/08: **todo pedido de devolução em até 7 dias é devolvido
integralmente.** É o CDC art. 49, e o parágrafo único é a parte que decide o
esquema:

> «os valores eventualmente pagos, **a qualquer título**, durante o prazo de
> reflexão, serão devolvidos, de imediato, monetariamente atualizados.»

«A qualquer título» inclui **o frete de ida**. E o entendimento consolidado é
que o **frete de volta é do vendedor**. Ou seja, no arrependimento o comprador
sai inteiro, e o custo fica na cadeia de fornecimento.

### Três consequências que não são opinião

1. **O comprador sempre recebe 100%.** O que se discute não é quanto ele
   recebe — é **quem banca**. Isso é decisão de negócio, e por isso precisa
   estar registrada como fato, não resolvida no impulso de quem clica.
2. **A tarifa do gateway não volta.** O Stripe fica com a dele mesmo em
   reembolso integral. Na venda de teste isso foi R$ 0,59 num pedido de R$ 5:
   **12% do valor**, que alguém paga sem ter vendido nada. Em bem físico, com
   frete no meio, uma devolução pode custar mais do que a margem da venda.
   Isso precisa aparecer na tela do consultor **antes** de ele achar que
   devolução é neutra.
3. **«De imediato» não é «depois que a caixa voltar».** Condicionar o estorno
   ao recebimento da devolução é prática comum e é onde mora o risco. O padrão
   conservador — devolver ao registrar o pedido de devolução — é o que este
   documento adota até haver orientação jurídica em contrário.

### Decisão: a plataforma devolve a comissão (13/08)

No arrependimento, **a plataforma estorna os 10% junto**. Não fica com comissão
de venda desfeita.

Isso resolve quem banca **a maior parte**, e é importante ser exato sobre o que
sobra:

| parte | como fica |
|---|---|
| comprador | inteiro — produto e frete de ida de volta |
| plataforma | zero a zero — devolve o que reteve |
| consultor | **perde a tarifa do gateway**, e o frete de volta |

A tarifa do Stripe não volta, e numa cobrança direta ela saiu do saldo do
consultor, porque é ele o vendedor. Na venda de teste foram R$ 0,59 num pedido
de R$ 5. **Não existe configuração que evite isso** — só a plataforma
compensá-lo por fora, o que seria outra decisão e não está tomada.

A consequência de produto é que o consultor precisa **ver esse número antes de
vender**, não descobri-lo no extrato. Em item barato com frete, a devolução
pode custar mais do que a venda rendia.

### A regra só é real quando o app estorna

Hoje o estorno é feito no painel do Stripe, onde devolver a comissão depende de
alguém marcar uma caixa. **Regra que depende de lembrar não é regra** — é a
mesma forma dos defeitos que este projeto vem corrigindo o tempo todo.

Ela passa a valer de fato quando o estorno sair da tela de vendas, chamando o
Stripe sempre com o estorno da comissão junto, e gravando os lançamentos
correspondentes. Até lá, é convenção escrita, e convenção escrita falha.

### O prazo é derivado, e a origem depende do que foi vendido

| o que | conta a partir de |
|---|---|
| bem físico | `entregue_em` — recebimento |
| bem digital | `pago` |
| serviço | a contratação |

Nunca um booleano `pode_devolver`. É `origem + 7 dias`, calculado na leitura,
como todo o resto neste documento. O serviço já prestado tem nuance que precisa
de advogado, não de decisão de arquitetura — e o campo derivado não impede
nenhuma das leituras.

**Evento novo:** `devolucao_solicitada`. É o fato que dispara a obrigação e
inicia a contagem do «de imediato». Sem ele, a única data disponível seria a do
estorno — que é o efeito, não a causa.

### O dinheiro precisa de razão, não de colunas

Frete de ida, frete de volta, comissão, estorno de comissão e tarifa do gateway
são **fatos financeiros diferentes**, com regras de reversão diferentes e partes
diferentes. Somar tudo em `total_centavos` e depois tentar desmontar é
impossível: a soma perdeu a informação.

```
pedido_lancamentos                  -- append-only, como pedido_eventos
  id | pedido_id
     | tipo       -- produto | frete | comissao_plataforma | tarifa_gateway
                  -- | reembolso | frete_devolucao | estorno_comissao
     | valor_centavos          -- sempre positivo; o sentido está nas partes
     | pagador    -- comprador | consultor | plataforma | gateway
     | recebedor  -- comprador | consultor | plataforma | gateway
     | origem | referencia | ocorrido_em | motivo
```

Com `pagador` e `recebedor` em vez de sinal, a pergunta «quem ficou com o
prejuízo desta devolução?» vira uma soma, para qualquer combinação de frete,
comissão e tarifa. Com um campo de sinal, vira interpretação — e interpretação
diverge entre a tela do consultor e a do admin.

`pedidos.frete_centavos` continua existindo, porque o checkout precisa cobrar o
frete. Ele é a projeção; o lançamento é o fato.

---

## 12-B. O comprador precisa ver o próprio pedido

Requisito do dono, 13/08: **o status das compras, pagamentos e devoluções tem
que estar dentro do FengShui Studio**, para o cliente acompanhar.

São **duas telas**, não uma, porque são dois sujeitos com direitos diferentes:

| quem | onde | como é protegido |
|---|---|---|
| consultor | página autenticada de vendas | RLS, que já existe |
| comprador | página pública do pedido | **link assinado com prazo** |

O comprador **não tem conta** — a rota de checkout já assume isso. Não existe
`auth.uid()` para comparar, então nenhuma policy o alcança. Ver o próprio
pedido exige um token assinado, com validade, enviado no e-mail de confirmação.

Duas armadilhas a evitar aqui:

- **Não identificar o comprador por e-mail digitado.** «Digite seu e-mail para
  ver seu pedido» entrega o histórico de compras de qualquer pessoa a quem
  souber o e-mail dela. O token é o que prova posse.
- **Não usar o número do pedido como chave de acesso.** `P260813-F0FD73` é
  legível de propósito, para o suporte falar dele — e o que é legível é
  adivinhável.

O que a tela do comprador mostra é a mesma verdade derivada de
`pedido_eventos`, com os lançamentos traduzidos: o que pagou, o que já voltou,
e — quando o prazo estiver correndo — **até quando pode se arrepender**. Essa
data é o item que mais evita atrito no suporte, e ela sai do cálculo, não de um
campo que alguém precisa manter.

---

## 13. Esquema proposto

Nomes em português, vocabulário do app, como em `concessoes_de_plano`.
`store_orders` fica onde está: vazia, sem nada a preservar, e substituída.

```sql
produtos
  id | tipo            -- bem_proprio_digital | bem_proprio_fisico | bem_de_terceiro
     | modo_de_venda   -- marketplace | indicacao
     | vendedor_perfil_id
     | nome | descricao | preco_centavos | ativo
     | link_externo    -- obrigatório em indicacao, nulo em marketplace
     | ncm | cest      -- fiscal, só em físico
     | peso_g | dimensoes
  check (modo_de_venda = 'marketplace' or tipo = 'bem_de_terceiro')
  check ((modo_de_venda = 'indicacao') = (link_externo is not null))

pedidos
  id | numero          -- humano, para o suporte conseguir falar dele
     | tipo | vendedor_tipo   -- consultor | plataforma | terceiro
     | vendedor_perfil_id     -- nulo quando quem vende é a plataforma
     | comprador_email | comprador_nome
     | stripe_session_id (unique) | stripe_payment_intent | stripe_account_id
     | total_centavos | frete_centavos | taxa_plataforma_centavos
     | endereco jsonb  -- só quando há remessa
  -- NÃO tem coluna `status`. Ver pedido_eventos. A ausência é a decisão.

pedido_itens
  id | pedido_id | produto_id (nulo quando o serviço vem do Stripe)
     -- fotografia do instante da compra, não FK para preço vivo:
     | nome | descricao | preco_unitario_centavos | quantidade | ncm | cest

pedido_eventos                      -- append-only, com trigger que recusa
  id | pedido_id                    -- update e delete
     | evento        -- iniciado | pago | cancelado | preparando | enviado
                     -- | entregue | reembolsado | contestado | disputa_resolvida
     | ocorrido_em | origem         -- webhook_stripe | vendedor | comprador
     | referencia | motivo | dados  -- | admin | sistema

remessas                            -- não existe para serviço nem para digital
  id | pedido_id | transportadora | rastreio | enviada_em | entregue_em

movimentos_de_estoque               -- append-only; saldo é projeção
  id | produto_id | delta | origem | referencia | ocorrido_em

comissoes                           -- mesma forma de concessoes_de_plano
  id | pedido_id | beneficiario_perfil_id
     | origem      -- plataforma | afiliado
     | base_centavos | percentual | valor_centavos
     | vence_em    -- quando a janela de reembolso/disputa fecha
     | paga_em | estornada_em | motivo

indicacoes                          -- clique de afiliado, último clique/30 dias
  id | afiliado_perfil_id | codigo | visitante_hash | criada_em | expira_em
```

Duas ausências são deliberadas e precisam sobreviver a revisão:

- **`pedidos` não tem `status`.** É o ponto inteiro do documento.
- **`comissoes` não tem `paga` booleano.** Tem `vence_em`, `paga_em` e
  `estornada_em` — três fatos com data, porque «ainda não venceu», «venceu e
  não paguei» e «paguei e estornei» não são o mesmo estado.

---

## 14. Sequência

Ordem escolhida para que cada fase entregue algo e nenhuma dependa de coisa que
não é código:

| fase | o que | por que aqui |
|---|---|---|
| **0** ✅ | registrar a venda que já acontece: webhook `checkout.session.completed` da conta conectada → `pedidos` + `pedido_eventos` | conserta o defeito da seção 0. Não dependia de decisão nenhuma. **Feito** — ADR 0030 |
| **1** | reconciliação da loja; `pedido_lancamentos`; painel de vendas do consultor; página do pedido para o comprador com link assinado; `devolucao_solicitada` e o prazo derivado | é a venda que já existe, mais os requisitos de 12-A e 12-B. Sem frete, sem NF-e nossa |
| **2** | bem próprio **digital** | testa o trilho «plataforma é a vendedora» sem esbarrar em fiscal |
| **3** | bem próprio **físico** | aqui entram emissor de NF-e, estoque, frete e logística reversa |
| **4** | terceiro: indicação primeiro, marketplace depois | indicação é barata; marketplace traz a responsabilidade solidária |
| **5** | afiliados | usa `comissoes`, que já existe desde a fase 1 |

A fase 3 é a única que trava em coisa de fora — inscrição estadual e emissor
fiscal. Colocá-la no fim não é adiar: é não deixar o resto da loja esperando um
certificado digital.
