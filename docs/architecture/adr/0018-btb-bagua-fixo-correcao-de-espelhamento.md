# ADR 0018 — BTB: o Ba Guá é fixo (correção de espelhamento no método padrão)

- **Status:** Aceito
- **Data:** 2026-07-26
- **Severidade:** alta — cálculo de domínio errado no **método padrão** do produto

## Contexto

`gridOrderBTB` tratava a posição da porta como uma **transformação da grade**:

```ts
export function gridOrderBTB(lado: string): number[] {
  if (lado === 'direita') return [2, 1, 0, 5, 4, 3, 8, 7, 6]
  return [0, 1, 2, 3, 4, 5, 6, 7, 8]
}
```

O comentário chamava isso de "gira o grid" e o teste, de "comportamento
histórico preservado". Nenhuma das duas descrições estava correta.

`[2,1,0, 5,4,3, 8,7,6]` **inverte cada linha** — é um espelhamento horizontal,
não uma rotação. E `lado` não é "qual parede tem a porta": é derivado do terço
horizontal onde o consultor clicou a entrada, ao longo da **mesma** parede:

```ts
const newLado = ex < largura*0.33 ? 'esquerda' : ex > largura*0.67 ? 'direita' : 'centro'
```

## A doutrina, e por que ela decide

O BTB (Black Hat / Chapéu Preto, linhagem de Lin Yun) alinha o Ba Guá à parede
da **entrada**, e o mapa é **fixo**. A figura canônica (Karen Rauch Carter,
*Move Your Stuff, Change Your Life*, Figura 2) traz a legenda:

> "THIS SIDE OF THE BAGUA **ALWAYS** HAS THE MAIN DOOR OF THE HOME OR ROOM
> LOCATED ON IT."

E o layout:

```
Prosperidade | Fama         | Relacionamentos     ← fundo
Família      | Saúde/Centro | Criatividade
Conhecimento | Carreira     | Pessoas Úteis       ← PAREDE DA ENTRADA
```

Duas outras descrições independentes da escola dizem o mesmo, em outras
palavras: *"in every situation the door is positioned along the 'knowledge',
'career' or 'helpful people' area"* e *"the back left-hand corner of **every**
floor plan is a supposed 'wealth corner'"*.

O "every" é o ponto. A porta define **qual parede vai para a base** — o que se
resolve girando a planta, não remexendo no mapa. Onde a porta cai *nessa*
parede é leitura diagnóstica ("a porta está no guá da Carreira"), não uma
transformação.

Um Ba Guá espelhado é quiralmente invertido; nenhuma escola usa isso. Se a
intenção original fosse tratar outra parede de entrada, o correto seria
**girar** — e a UI já oferece isso desde sempre: botões ↺/↻ de 90°, presets
0/90/180/270 e slider livre de 0–359° para ângulos quebrados.

## Decisão

`gridOrderBTB` devolve **sempre** a identidade. O parâmetro `lado` permanece na
assinatura (compatibilidade com os call sites) mas é ignorado, com o motivo
escrito no módulo.

O `lado` continua sendo capturado e passa a ter o uso correto: `guaDaPorta(lado)`
diz em qual dos três guás frontais a porta caiu — Conhecimento (esquerda),
Carreira (centro) ou Pessoas Úteis (direita). Isso agora aparece na tela, que é
informação que o consultor usa de verdade.

## Consequências

### O que estava errado, e para quem

O BTB é o **método padrão** (`METODOLOGIA_PADRAO = 'btb'`). Toda consulta em que
a entrada foi marcada no terço direito da planta saiu com três pares trocados:

| Deveria ser | Estava |
|---|---|
| Prosperidade (fundo-esq.) | Relacionamentos |
| Relacionamentos (fundo-dir.) | Prosperidade |
| Família (meio-esq.) | Criatividade |
| Criatividade (meio-dir.) | Família |
| Conhecimento (frente-esq.) | Pessoas Úteis |
| Pessoas Úteis (frente-dir.) | Conhecimento |

Diagnóstico, recomendações e Plano de Ação saíram invertidos, sem nenhum sinal
de erro. Fama, Carreira e Centro ficavam certos (são a coluna do meio), o que
tornava o resultado plausível o bastante para não levantar suspeita.

### Dados já gravados: a boa notícia

`setores_bagua` grava `numero` = **índice da célula** e `nome` = setor
calculado. A avaliação do consultor (os 8 critérios, o score) fica presa à
**área física** da planta; só o rótulo veio errado.

Ou seja: a correção é um **re-rotulamento**, não uma perda. O que o consultor
observou naquele canto da casa continua válido — estava com o nome errado.

Consequência prática: consultas antigas com `lado='direita'`, ao serem
reabertas, passam a mostrar nomes diferentes dos do relatório já entregue. Isso
**não foi migrado automaticamente** nesta ADR: mexer em registro de cliente é
decisão do proprietário, não do código. As opções levantadas foram recalcular
em silêncio, marcar as afetadas com aviso, ou congelar as antigas.

### Como isto passou

Quando a Escola da Bússola foi implementada (`05e15a5`), preservei o
comportamento do BTB deliberadamente, para não alterar o método existente — e
escrevi um teste que travava `[2,1,0,...]` como "comportamento histórico". Foi
erro de julgamento: preservar comportamento legado é correto para
*refatoração*, não quando o legado é a regra de domínio que ninguém auditou. O
teste, em vez de proteger, congelou o bug e deu aparência de intencional.

O bug só apareceu quando o proprietário forneceu a figura canônica e pediu
verificação explícita. Nenhuma leitura de código o teria pego, porque o código
estava coerente consigo mesmo — faltava a fonte.

### Testes

O teste que travava o espelhamento foi **substituído**, não removido: agora há
um de regressão que falha se `[2,1,0,5,4,3,8,7,6]` voltar, e um que reproduz o
layout da figura de Carter célula a célula, por nome de setor em vez de índice —
para a próxima pessoa conferir contra a fonte, não contra um array.
