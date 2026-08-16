# ADR 0035 — A foto de produto é pública; o preço promocional é derivado da janela

**Data:** 2026-08-16
**Status:** aceito
**Relacionado:** ADR 0022 (fotos por URL assinada), ADR 0027 (estado derivado em
vez de status gravado), ADR 0030 (pedido como máquina de estados), ADR 0032
(indicação diz quem vende)
**Modelo completo:** `docs/domain/modelo-da-loja.md`

## O contexto

A vitrine do catálogo próprio nasceu com cartões só de texto, e a tela de admin
só sabia cadastrar e publicar. Duas consequências que apareceram juntas quando a
loja ficou achável a partir da home:

1. **Não havia foto de produto** — nem coluna, nem bucket, nem campo. O único
   bucket de produto (`produtos-digitais`) recusa `image/*` no próprio Postgres,
   porque guarda o entregável.
2. **Não havia edição** — corrigir um preço obrigava a criar produto novo, e
   produto novo com o mesmo nome polui o histórico de vendas, que é exatamente
   onde se olha quando um preço parece errado. A rota `PATCH` aceitava os campos
   desde a fase 2; nunca houve tela que os enviasse.

Sobre isso veio o pedido de **promoção por prazo definido**.

---

## Decisão 1 — a foto de produto mora em bucket público

O ADR 0022 fechou `clientes-fotos` e `imoveis-fotos` e mandou tudo por URL
assinada de uma hora. Esta decisão **não** estende aquela, e a diferença não é
conveniência: é a finalidade do objeto.

| | fotos de cliente e imóvel | foto de produto |
|---|---|---|
| o que é | o interior da casa de alguém | material de vitrine |
| quem deve ver | o consultor e o titular | **qualquer pessoa**, de preferência muitas |
| se vazar | dado pessoal exposto, incidente LGPD | nada — era esse o objetivo |

A regra que o ADR 0022 escreveu é «URL pública é permanente e adivinhável, e
isso é errado para dado pessoal». A foto de produto não é dado pessoal, e
permanente e adivinhável é a descrição do que se quer.

**URL assinada aqui custaria e não defenderia nada.** Ela expira, então nenhum
CDN a guarda; cada visitante da vitrine faria o servidor assinar cada imagem de
novo. Defesa de um segredo inexistente, paga em latência na página que existe
para converter visitante em comprador.

Bucket: `produtos-imagens`, público, 2 MB, `image/jpeg`, `image/png` e
`image/webp`. Policy de `select` para todos; **nenhuma** policy de escrita — quem
grava é a rota de admin com `service_role`.

**`image/svg+xml` fica de fora**, e num bucket público a razão é mais forte do
que em qualquer outro lugar do app: SVG é documento com script, e servido do
nosso domínio ele executa como se fosse nossa página.

O que **não** muda: a coluna guarda **path**, nunca URL. Foi o que o ADR 0022
aprendeu caro — a URL gravada amarra a linha ao bucket em que nasceu, e quando
`imoveis-fotos` precisou fechar, cada linha virou um 404 e desfazer custou um
backfill.

---

## Decisão 2 — a promoção é uma janela, e «em promoção» é derivado

Não existe coluna `em_promocao`. Existem três:

```sql
promocao_preco_centavos integer
promocao_inicio         timestamptz
promocao_fim            timestamptz
```

com constraint de tudo-ou-nada entre elas.

Um booleano gravado precisaria de alguém — pessoa ou rotina — para virá-lo
quando o prazo acabasse. Enquanto esse alguém não rodasse, o banco afirmaria uma
campanha encerrada, e quem lê a afirmação é o **checkout**: o comprador pagaria o
preço de uma promoção que terminou ontem, e nada avisaria, porque a venda
acontece normalmente.

É o ADR 0027 com outro substantivo. Lá, «atrasado» sai da data de vencimento e
nunca de `pagamentos.status`. Aqui, «em promoção» sai da janela.

### Uma função só decide o preço

`precoVigente(produto, agora)` em `src/lib/promocao-do-produto.ts`. Ela é usada
pela vitrine **e** pelo checkout, e essa é a decisão, não um detalhe de
organização.

O preço aparece em dois lugares que precisam concordar: o número no cartão e o
`unit_amount` que vai ao Stripe. Com duas implementações, a janela de
divergência é «alguém esqueceu de mudar os dois lados». Com uma, ela é o
intervalo real entre carregar a página e clicar — e o servidor decide por
último, então o cobrado é o do instante em que o dinheiro se move.

`agora` é parâmetro, não `new Date()` interno: a resposta depende do instante, e
um cálculo que consulta o relógio por dentro não pode ser testado nas bordas —
que é onde ele erra.

### A promoção não entra na consulta SQL

Seria tentador filtrar com `promocao_fim.gt.now()` e ter o preço resolvido pelo
banco. Isso criaria a segunda implementação da mesma regra, no dialeto do
Postgres, e ela divergiria na borda. O banco devolve colunas; quem decide o
preço é sempre a mesma função.

Pelo mesmo motivo `/api/loja/produtos` responde com `Cache-Control: no-store`:
um cache de borda serviria a campanha encerrada a quem chegasse depois, e a
vitrine anunciaria um valor que o checkout recusaria a cobrar.

### O pedido guarda o que foi pago

`pedido_itens.preco_unitario_centavos` recebe o preço **vigente**, e a tabela já
era fotografia do instante da compra desde a fase 0. Quando a campanha acabar, o
recibo continua dizendo o que a pessoa pagou — um pedido que lesse o catálogo
vivo seria um recibo que reescreve o passado.

### Promoção só no que vendemos

```sql
check (promocao_preco_centavos is null or modo_de_venda = 'marketplace')
```

Na indicação quem vende é o parceiro (ADR 0032), e o preço da nossa linha é
referência — a vitrine já diz «a partir de», porque pode ter mudado lá. Uma
promoção nossa sobre esse valor anunciaria um desconto que não damos, num preço
que não cobramos, numa loja que não é nossa. O comprador chegaria ao site do
parceiro e encontraria outro número, com o nosso nome no anúncio.

### Três estados, não dois

`situacaoDaPromocao` devolve `agendada`, `rodando` ou `encerrada`. Na vitrine as
duas últimas se parecem — nas duas o preço é o cheio e não há selo. Sem
distingui-las na tela de admin, o admin recadastra uma campanha que já está no ar
para semana que vem.

### O que o servidor recusa e o banco aceitaria

`recusaDaPromocao` rejeita uma campanha cuja janela **inteira** está no passado.
O banco aceitaria: as três colunas estão preenchidas e coerentes entre si. Só
que ela não valeria em momento nenhum, e o admin sairia da tela achando que
valeria — defeito que só aparece quando alguém compra pelo preço cheio e reclama
do anúncio.

Agendar para o futuro continua valendo: é o caso de uso, não o engano.

## As consequências

- Um bucket público no projeto, e ele precisa continuar sendo o único. A regra
  que o mantém legítimo é «só foto de vitrine entra aqui» — qualquer outra coisa
  reabre o que o ADR 0022 fechou.
- O preço da vitrine deixa de ser cacheável na borda. É custo aceito: a
  alternativa é a vitrine e o checkout discordarem.
- Órfãos no bucket. Trocar a foto grava o path novo e deixa o objeto anterior,
  como já acontece com o arquivo entregável. Limpeza é trabalho de rotina;
  misturá-la ao caminho do upload é o que faz uma troca falhar pela metade.
- Fuso horário passa a importar na tela de admin. `datetime-local` fala no fuso
  do browser e o banco guarda UTC; as duas conversões ficam juntas num lugar só,
  porque separadas uma seria esquecida e o sintoma — campanha começando três
  horas fora do combinado — não se atribui a fuso.
