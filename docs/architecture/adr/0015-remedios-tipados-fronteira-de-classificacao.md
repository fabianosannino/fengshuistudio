# ADR 0015 — Remédios tipados: o que o software pode classificar, e o que não

- **Status:** Aceito
- **Data:** 2026-07-26

## Contexto

A Parte IV de `docs/domain/fengshui-metodos-referencia.md` especifica uma
taxonomia de remédios (`Remedy`) em que **nenhuma recomendação sai sem método
de origem, força da evidência, custo estimado e reversibilidade**, e recomenda
que `evidenceStrength` seja obrigatório "desde o primeiro remédio codificado".

A ADR 0013 criou o tipo `Remedio` com esses campos não-opcionais, mas deixou
`src/lib/recomendacoes.ts` (o motor de texto usado por tela, detalhe e PDF)
intocado, registrando que migrá-lo era "refatoração de porte próprio".

Ao atacar essa migração, o levantamento do conteúdo revelou que o problema não
é de engenharia:

- **Fontes estruturadas** (3): conflitos cômodo×setor (14 regras em
  `comodo-setor.ts`), problemas geométricos da regra do terço, e a estratégia
  dos Cinco Elementos (`estrategiaElemental`). O código conhece a semântica de
  cada uma.
- **Texto livre** (117 strings): `SETOR_DICAS` (84) + `CRITERIO_DICAS` (33) —
  dicas como "Adicione cristais negros como obsidiana" ou "Use tons roxo, verde
  e dourado".

## Decisão

### Migrar só o que é honestamente classificável

`src/lib/remedios.ts` expõe `gerarRemedios(input): Remedio[]`, cobrindo
**apenas as três fontes estruturadas**, já ordenado por `ordenarRemedios`
("custo zero e reversível primeiro").

`gerarRecomendacoes` segue **intocado** — este módulo é aditivo. Os três call
sites de produção (tela, detalhe, PDF) não mudaram de comportamento, e há teste
de não-regressão garantindo isso.

### Por que as 117 dicas em texto livre NÃO foram classificadas

Atribuir `forcaEvidencia` a uma recomendação de Feng Shui é **julgamento de
literatura clássica por afirmação**. Decidir se "adicione cristais negros como
obsidiana" é consenso clássico, variante de escola ou tradição popular exige
conhecimento que este código não tem — e várias dessas dicas têm cara de
prática moderna, não de citação clássica.

Rotular errado seria **pior que não rotular**: colocaria selo de autoridade
clássica em conselho possivelmente moderno, num relatório que vai para cliente
pagante. Essa curadoria é tarefa de quem tem a formação, não do software. É a
mesma linha já adotada para as tabelas de San He, Xuan Kong Da Gua, Kong Wang e
os coeficientes WMM (ADR 0014): quando a fonte não sustenta a afirmação, o
sistema declara a lacuna em vez de preenchê-la.

O relatório diz isso ao consultor, no próprio texto impresso da seção — a
lacuna não fica escondida numa ADR.

### Como cada campo foi determinado (e o que ficou em branco de propósito)

**Conflitos cômodo×setor** — classificação uniforme, obtida **lendo as 14
curas**, não presumindo: todas são "feche porta/ralo" + acrescentar um objeto
pequeno de um elemento (planta, cerâmica, objeto metálico). Nenhuma exige obra
→ `custo: 'baixo'`, `reversibilidade: 'facil'`.
`forcaEvidencia: 'consenso-classico'` porque os próprios textos invocam
nomeadamente a regra clássica de drenagem e os ciclos Sheng.
`acaoWuXing: 'nenhuma'` **não** significa "sem ação elemental" — significa que
o ciclo específico varia por regra (a maioria gera, uma exaure) e a tabela de
origem não codifica isso. Inferir por heurística de texto seria chute.

**Geometria (regra do terço)** — `forcaEvidencia: 'variante-de-escola'`, e a
razão importa: o **diagnóstico** (setor ausente/extensão) é clássico e está
documentado em §1.7, mas a **cura** não tem forma canônica única na literatura.
Classificar pela força do que se recomenda, não pela do diagnóstico que
motivou. O excesso custa mais que a falta (divisória física vs. objeto).

**Cinco Elementos** — construído a partir do **retorno estruturado** de
`estrategiaElemental` (`fortalecer` / `evitar`), não das strings que ela gera.
Assim o ciclo Wu Xing de cada remédio é conhecido (`gerar` / `controlar`), não
inferido de texto. O remédio de "evitar o controlador" tem `custo: 'zero'` e
`reversibilidade: 'instantanea'` — é uma restrição, não uma compra.

### Consequência de UI: a seção "Plano de Ação" deixou de ser mentira

O relatório tinha um checkbox **"6. Plano de Ação"** no seletor de seções que
**nunca era lido** pelo corpo do relatório — marcar ou desmarcar não fazia
nada. A chave `plano_acao` existia no estado, no reset e em `allKeys`, mas não
em nenhum `&&` de render.

Essa seção agora existe de verdade: uma tabela dos remédios estruturados
ordenada do mais barato e reversível ao mais custoso, com colunas Custo /
Desfazer / Evidência — informação que a seção de Recomendações não fornece, e
por isso não é duplicação de conteúdo, é um recorte diferente.

## Consequências

- 16 testes novos (419 no total), incluindo um de **não-regressão** confirmando
  que `gerarRecomendacoes` segue funcionando igual, e um que trava a fronteira
  de escopo (todo remédio gerado tem prefixo de uma das 3 fontes estruturadas —
  se alguém tentar incluir texto livre sem classificar, o teste quebra).
- Verificado no navegador: os remédios de custo zero aparecem primeiro, antes
  de qualquer um que exija adquirir objeto. Zero erros de runtime.
- Remédios **geométricos não aparecem no relatório** — `faltaPct`/`excessoPct`
  dependem de medidas do canvas, que só existem na tela de diagnóstico. Não é
  bug: é o dado que não trafega até lá.
- **Pendente, e é tarefa de domínio, não de código:** classificar as 117 dicas
  de `SETOR_DICAS`/`CRITERIO_DICAS`. Quando essa curadoria existir, o encaixe
  está pronto — basta as dicas passarem a carregar os mesmos campos e entrarem
  em `gerarRemedios`. Enquanto não existir, elas continuam aparecendo no
  relatório como hoje, sem selo de evidência (o que é honesto).
- A migração completa de `recomendacoes.ts` para `Remedio` **não aconteceu** e
  não deve ser reivindicada: o motor de texto continua sendo a fonte das
  recomendações que o consultor vê nas seções de diagnóstico.
