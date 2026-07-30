# ADR 0021 — Modelos de pontuação escolhidos pelo consultor

- **Status:** Aceito
- **Data:** 2026-07-28
- **Severidade:** alta — número impresso no relatório do cliente estava errado
- **Relaciona-se com:** ADR 0019 (erro genérico ≠ enganoso), ADR 0020 (lacuna declarada)

## Contexto

O teste ponta a ponta de 27/07 encontrou `score_percentual = 102` num setor.

A causa, em `bagua-planta`:

```ts
const FISICO_MAP=[-2,-1,0,1,2]
function scoreFisico(c){ return c.reduce((s,v)=>s+(FISICO_MAP[v]??0),0) }   // −16..+16
function scoreTotal(sc){ return Math.round(geoEfetivo(sc)+scoreFisico(sc.criterios)) }
```

`geo` já era uma nota completa: `100 − faltaPct − excessoPct`. A função somava um
**desvio** (−16 a +16) a um **nível** (0–100). Erro de categoria — como somar
«+3 °C» a «72%».

| Avaliação | Conta antiga | Resultado |
|---|---|---|
| Tudo «Neutro» | 100 + 0 | **100%** |
| Um pouco acima do neutro | 100 + 2 | **102%** |
| Tudo «Crítico» | 100 − 16 | 84% |

Sem `clamp`, e preso na faixa ~84–116. As faixas do relatório (`< 40` urgente,
`40–70` atenção) eram **inalcançáveis**: um imóvel com os oito critérios em
«Crítico» saía como 84%, faixa «MANTER».

Havia dois agravantes na mesma raiz:

- `criterios: Array(8).fill(2)` — todo setor nascia com os oito critérios em
  «Neutro». O banco não distinguia «o consultor avaliou como neutro» de «ninguém
  olhou», e salvar **um** setor gravava 72 linhas para os nove.
- `criteriosAvaliados(c) = c.some(v => v !== 2)` — a tela adivinhava «avaliado»
  por diferença do default. Quem marcasse tudo como «Neutro» de propósito
  aparecia como não avaliado. O código já sabia que precisava da distinção e
  estava simulando-a.
- No relatório, `(score_percentual ?? 100) >= 80` classificava setor **sem
  avaliação** como «MANTER».

## O que a tradição diz — e o que ela não diz

Nenhuma escola de Feng Shui quantifica setor em percentual. Ba Zhai qualifica por
posição, Xuan Kong por combinação de estrelas, o BTB por leitura qualitativa.
**O percentual é instrumento do produto, não leitura clássica.**

O que a tradição *sim* informa, e que decidiu o desenho: falta/excesso geométrico
e estado físico são categorias diferentes. Setor ausente é problema estrutural —
remédio arquitetônico, caro, às vezes impossível. Bagunça e lâmpada queimada se
resolvem no sábado. Fundir os dois num número apaga a distinção que comanda o
Plano de Ação.

## Decisão

`src/lib/modelos-pontuacao.ts` normaliza cada dimensão a 0–100 antes de agregar
(POMP — *percent of maximum possible*) e oferece **quatro modelos que o consultor
escolhe**:

| Modelo | Fórmula |
|---|---|
| Estado físico | média dos critérios avaliados |
| Geométrico | `100 − falta% − excesso%` |
| Composto ponderado | `w·geo + (1−w)·físico`, com `w` ajustável |
| Composto conservador *(padrão)* | `√(geo × físico)` |

O conservador é o padrão porque a média geométrica **não deixa geometria boa
mascarar conservação ruim** — comportamento desejável num diagnóstico.

Tudo «Neutro» passa a dar **50%**, que é o ponto médio de uma escala bipolar.
Chamar isso de perfeito era o defeito.

### `null` é «não sei», em toda parte

- critério não avaliado é `null`, não 2, e **não é persistido** — ausência de
  linha é a única representação de «não avaliado»;
- geometria não finita devolve `null`, não 0 (responder 0 afirmaria «urgente» a
  partir de lixo);
- modelo composto sem estado físico devolve `null` em vez de cair no `geo`;
- faixa de valor nulo é nula — nunca «manter»;
- a UI ganhou um sexto botão «—» e mostra «Não avaliado» em cinza, sem cor de
  julgamento.

### A escolha fica gravada na consulta

`consultas.modelo_pontuacao` e `consultas.peso_geo`, com `CHECK` para os quatro
modelos conhecidos e peso em 0–1. **Não** no perfil do consultor: reabrir uma
análise antiga não pode repontuá-la sob o padrão vigente hoje — o relatório já
entregue ao cliente precisa continuar reproduzível. Mesma lição da ADR 0018.

### Procedência impressa

Cada cálculo devolve uma linha para o relatório:

> Composto conservador — √(geometria × estado físico) · geometria 87% · estado
> físico 62% · 7 de 8 critérios avaliados

É isso que torna a configurabilidade aceitável em vez de arbitrária. Dois
consultores **podem** reportar números diferentes para o mesmo imóvel; com a
procedência, a divergência é auditável.

### Faixas unificadas

Os cortes `40 / 70` foram **herdados** do relatório, não inventados. Havia um
segundo conjunto contraditório na mesma tela (`60 / 80`); agora há um só, em
`CORTE_URGENTE` e `CORTE_ATENCAO`.

## Consequências

Consultas antigas têm `score_percentual` calculado pela fórmula velha e
`modelo_pontuacao` nulo (lido como o padrão). Os valores gravados **não foram
recalculados**: são o que o relatório entregue dizia. Reabrir e salvar a análise
repontua com o modelo escolhido.

Não houve migração de dados por decisão já registrada na ADR 0018 — as consultas
existentes são de teste.

O design visual foi preservado: os controles novos seguem o padrão dos botões de
método que já existiam. O que mudou de texto mudou porque a **unidade** mudou —
o estado físico exibia «+3 pts» numa escala ±16 e agora exibe «62%».

## Verificação

Ciclo completo pela UI contra o banco de produção, com dados descartáveis:

| | Antes | Depois |
|---|---|---|
| Setor avaliado (4 de 8 critérios) | 72 linhas nos 9 setores | **4 linhas**, só as avaliadas |
| Os outros 8 setores | `score_percentual = 100` | **`null`**, zero critérios |
| Escolha do modelo | inexistente | `composto-conservador`, `peso_geo 0.50` |
| Tudo «Crítico» | 84% → «MANTER» | **0% → «Urgente»** |

26 testes no módulo, cobrindo os quatro modelos, a propagação de `null`, os
limites da faixa e a higiene da linha de procedência (não cita arquivo de código
nem jargão interno, porque é impressa para o cliente).
