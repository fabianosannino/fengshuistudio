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
reabertas, passam a mostrar nomes diferentes dos do relatório já entregue.

**Decisão do proprietário (2026-07-26): não há migração a fazer — as consultas
existentes são de teste e podem ser descartadas.** Nenhum relatório real foi
entregue a cliente com o mapa espelhado, então o risco que motivou a cautela
não se materializou. Não foi escrito script de migração nem flag de aviso: para
o dado que existe hoje, seria código morto.

Se algum dia houver base real com esse problema, o caminho está mapeado acima —
é re-rotulamento por `numero` de célula, não recálculo de avaliação.

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

## Adendo — o alerta específico da Estrela 5 (mesma raiz, decisão simétrica)

A ADR 0017 deixou como trabalho visível "ligar a contraindicação da Estrela 5 ao
cálculo que já existe". Implementado agora, e a regra de escola desta ADR é
justamente o que torna a decisão limpa.

`alertaEstrela5(setor, anoSolar, escola)` só responde **na Escola da Bússola**,
onde o setor É a direção (Fama é sempre Sul). No BTB devolve `null` — e `null`
significa "não sei", nunca "não está". Lá o aviso genérico da curadoria continua
valendo, só não ganha precisão que o método não coletou.

Isso já era a convenção da casa: os painéis de Estrelas Voadoras e de estrela
anual só renderizam com `escola==='bussola'`. O alerta segue a mesma linha em
vez de abrir exceção.

**Descoberta ao implementar:** `PALACIO_DO_SETOR` é constante e **não depende
dos graus da fachada**. Os graus decidem qual setor cai em qual *célula da
planta* (`gridOrderBussola`); a direção que o setor *representa* é fixa por
definição da escola. A mudança de assinatura de `gerarRemedios` acabou sendo
muito menor que o previsto — `escola` e `anoSolar`, sem orientação.

**Escopo do alerta, e duas exclusões deliberadas:**

- Vale para **todo remédio de ativação do setor**, não só para a dica que
  carrega a contraindicação. `estrategiaElemental` gera "Ative com iluminação
  quente, velas, tons de vermelho" na Fama — mesmo risco da dica "adicione
  velas". Avisar num e calar no outro seria incoerente.
- **Não** vale para `layout`/`comportamental`/`bloqueio-de-forma`: a regra do Wu
  Huang é não ativar nem revolver o palácio; limpar e desobstruir seguem
  recomendados ali.
- **Não** vale para remédios de restrição (`acaoWuXing: 'controlar'`). Pego na
  conferência da saída, não em revisão de código: o alerta aparecia em "Evite
  Água em excesso neste setor" dizendo "adie ativações de Fogo aqui" — não há
  ativação nenhuma sendo proposta ali. Restringir já é o que o Wu Huang pede.

O ano é **solar** (Li Chun), nunca `getFullYear()`: em janeiro o ano solar ainda
é o anterior, e a estrela apontada seria a errada.
