# ADR 0017 — Curadoria de evidência das dicas, com proveniência obrigatória

- **Status:** Aceito
- **Data:** 2026-07-26
- **Relacionada:** ADR 0013 (hierarquia de precedência), ADR 0015 (fronteira de
  classificação dos remédios)

## Contexto

A ADR 0015 criou `CURADORIA_EVIDENCIA` **vazia de propósito**, com o argumento
de que atribuir `forcaEvidencia` a uma recomendação é julgamento de literatura,
e que rotular errado seria pior que não rotular: poria selo de autoridade
clássica em conselho possivelmente moderno, num relatório que vai para cliente
pagante.

O efeito prático era que **nenhuma** das 76 dicas acionáveis de `SETOR_DICAS` /
`CRITERIO_DICAS` virava `Remedio`. A seção "Plano de Ação" do relatório
mostrava só os remédios estruturados (conflitos cômodo×setor e estratégia dos
Cinco Elementos), e o texto impresso dizia ao consultor que as demais dicas não
tinham classificação.

O proprietário do repositório disponibilizou um corpus de obras em
`docs/Books` e confirmou explicitamente que a curadoria deveria ser feita a
partir delas. Com fonte disponível, a lacuna deixa de ser "não temos base" e
passa a ser "não fizemos o trabalho".

## Decisão

### 1. O tipo exige proveniência — não é convenção, é compilação

`CURADORIA_EVIDENCIA` passou de `Record<string, ForcaEvidencia>` para
`Record<string, EntradaCuradoria>`, e `EntradaCuradoria` obriga:

```ts
interface EntradaCuradoria {
  forca: ForcaEvidencia
  fonte: FonteId      // chave de FONTES_CURADORIA — obra nomeada
  local: string       // verbete, capítulo ou página
  citacao: string     // trecho LITERAL da obra
  contraindicacao?: string
  contestadaPor?: Referencia
  nota?: string
}
```

Não é possível acrescentar uma classificação sem escrever de onde ela veio. Foi
essa a resposta ao problema da ADR 0015: em vez de deixar o campo vazio para
sempre, tornar o palpite **impossível de digitar**.

### 2. As citações são conferidas por máquina, não afirmadas

`scripts/citacoes/` extrai o texto das obras e confere que **toda** `citacao`
existe de fato na obra declarada em `fonte`:

```bash
pip install pypdf
python3 scripts/citacoes/extrair-corpus.py      # gera .corpus-txt/ (fora do git)
python3 scripts/citacoes/verificar-citacoes.py  # 83 citações conferidas
```

Duas verificações, com rigor diferente de propósito:

- **`citacao:`** — casada contra o texto da obra em `fonte:`. Atribuição errada
  de autoria é o erro grave, então a fonte importa aqui.
- **trechos entre aspas duplas em `nota:`/`contraindicacao:`** — casados contra
  o corpus inteiro, porque a autoria já vem nomeada na própria prosa.

Convenção que caiu daí: aspas duplas são reservadas a citação de obra; para
citar texto do próprio app usa-se «guilemetes». O verificador pegou duas frases
minhas em aspas duplas e cobrou-as como se fossem dos livros — corretamente.

Não roda no `npm test`: depende de `docs/Books` e de `pypdf`, ausentes no CI.

### 3. Os três tiers, definidos operacionalmente

- `consenso-classico` — âncora **explícita** num construto clássico nomeado
  (ciclo Wu Xing, Ba Guá do Céu Posterior/trigramas, Sheng/Shar Chi, Escola das
  Formas) **e** presença em mais de uma fonte, sem contradição encontrada.
- `variante-de-escola` — atribuível a uma convenção de escola (Oito Aspirações,
  BTB, simbolismo), ou as fontes divergem, ou a fonte sustenta o princípio mas
  **não o detalhe que a dica acrescenta**.
- `tradicao-popular` — aparece na literatura consultada, sem âncora clássica
  localizável.

### 4. O limite do que isto vale — dito no código, não escondido aqui

**`consenso-classico` significa "consenso nas fontes deste corpus".** O corpus
é majoritariamente literatura introdutória ocidental; nenhuma obra é edição
crítica de texto clássico chinês. Isso está escrito no cabeçalho de
`curadoria-evidencia.ts`, no `tier` de cada fonte e na planilha gerada — não só
nesta ADR, porque quem lê o código precisa ver a ressalva junto do dado.

Reivindicar verificação contra fonte primária seria a mesma desonestidade que a
ADR 0015 recusou, com um passo a mais de trabalho por cima.

## O corpus: o que serve e o que não serve

Das 13 obras em `docs/Books`, **7 têm camada de texto utilizável**:

| Obra | Ano | Tier |
|---|---|---|
| Lillian Too, *The Feng Shui Dictionary* (HarperCollins) | 2013 | `referencia` |
| Joey Yap, *Work From Home Feng Shui Guide* (`feng-1.pdf`) | 2020 | `linhagem-classica` |
| Michael Erlewine, *The Art of Feng Shui* | 2007 | `popular` |
| Nicolas Tchikovani, *The Feng Shui House Book* | 2020 | `popular` |
| Susannah L. Williams, *Feng Shui For Beginners* (2ª ed.) | 2012 | `popular` |
| Virginia Alba, *Feng Shui Book For Beginners* | 2021 | `popular` |
| Bonnie Morawa, *Feng Shui for Attracting Wealth* | 2015 | `popular` |

As 6 restantes **não são fonte de citação nenhuma**, e o motivo importa:

- **Skinner, *Feng Shui Before & After*** e **Harvey, *Feng Shui Guide Book***
  — são varreduras de página (imagens) empacotadas como PDF/EPUB. 12 MB e 8 MB
  que rendem 1.115 e 563 caracteres de texto. Exigiriam OCR. É perda real: o
  Skinner é a obra de maior autoridade do conjunto.
- **Shido, *Feng Shui Professional Practice*** — `.mobi` com PalmDOC
  comprimido; a extração sai como binário.
- **Zhao, *Zang shu / 葬書*** — varredura em chinês, sem camada de texto.
- **Gallagher, *The Feng-Shui Junkie*** — **é um romance**, não obra técnica.
  Extraiu 712 KB de texto perfeitamente legível, o que a tornava a fonte mais
  "rica" do corpus por volume. Excluída explicitamente no script, com o motivo
  escrito, para ninguém a reincluir por acidente.

## Resultado

**68 das 76 dicas acionáveis curadas**, com 83 citações conferidas:

| Força de evidência | Dicas |
|---|---|
| `consenso-classico` | 36 |
| `variante-de-escola` | 23 |
| `tradicao-popular` | 9 |

### 8 dicas ficaram SEM classificação — e isso é resultado, não pendência

`DICAS_SEM_FONTE_LOCALIZADA` lista as que foram buscadas por termo no corpus
inteiro e **não encontradas**: fotos de família, diplomas/prêmios, lista de
contatos visível, expor projetos criativos (duas variantes), objetos de
conflito, imagens de solidão, equipamento elétrico com defeito.

Não viram `Remedio`. Continuam aparecendo no relatório como texto, sem selo —
o mesmo comportamento honesto de antes. A diferença é que agora se sabe
**quais** e **por quê**.

## O que a pesquisa revelou, e que o app não estava dizendo

Este é o ganho que justificou o trabalho — não o selo, os achados.

### 3 dicas são contestadas por outra fonte do corpus

`contestadaPor` é obrigatoriamente uma fonte **diferente** da que sustenta
(teste trava isso), e uma dica contestada **nunca** recebe
`consenso-classico` — "há consenso" e "há fonte que contradiz" não podem valer
ao mesmo tempo.

1. **"Coloque espelho estrategicamente para ampliar o espaço"** — Too registra
   a prática como "one of the most common mistakes in modern bedroom interior
   design"; Erlewine (p. 269) diz que "most experts would not recommend it".
   Note a distinção que caiu daí: **espelho-para-LUZ tem apoio** (Alba
   recomenda para cantos escuros, Erlewine usa prismas no peitoril) e
   **espelho-para-ESPAÇO não tem**. São duas dicas diferentes no catálogo e
   agora têm classificações diferentes.
2. **"Adicione cristais negros como obsidiana"** (Carreira) — cristal é remédio
   de **Terra** (Erlewine, p. 483: "Crystals of all kinds belong to the Earth
   element"), e Terra **controla** Água no ciclo Wu Xing. A dica põe objeto de
   Terra no setor de Água. Alba reforça: no Norte, "avoid placing materials that
   represent the earth such as clay and rocks". A cor preta confere; o material
   contraria o ciclo.
3. **"Elimine distrações e eletrônicos desnecessários"** — Too é explícita:
   "Computers do not cause bad Feng Shui. When placed in the west or northwest
   they can become energizers in these corners." A restrição da dica é de foco,
   não de Feng Shui.

### Contraindicações documentadas que o relatório não mostrava

Levantadas na mesma leitura que sustentou a classificação, e agora entregues em
`Remedio.contraindicacoes` — visíveis na tabela do Plano de Ação, embaixo da
ação, em ⚠:

- **Plantas** (bambu da sorte, plantas viçosas) — Too: plantas no quarto de um
  casal e eles "will quarrel frequently"; e nada de espinhos ("Cacti and any
  other types of prickly plants create tiny slivers of poisonous energy").
- **Objetos triangulares / em forma de chama** — Too: "arrows and triangles:
  these represent the fire element, which is very bad for the bedroom", e
  simbolizam flechas envenenadas apontadas para quem dorme.
- **Elementos de fogo (velas, luz vermelha)** — Morawa: onde estiver a Estrela 5
  anual (Wu Huang), "no fires, flames, candles or red objects here". O app **já
  calcula** a Estrela 5 em `estrela-anual.ts`; a ligação entre os dois é
  trabalho futuro óbvio, e está registrada abaixo.
- **Aquário / fonte de água** — Too: não à direita da porta de entrada, visto de
  dentro para fora.
- **Livros e objetos de aprendizado** — Too: estantes abertas "represent knives
  cutting into you and are bad Feng Shui"; fechar com portas.
- **Imagens de animais** — uma por vez (Williams: "one piece of an animal at a
  time"), e Too alerta que no sul o cavalo pode trazer Yang em excesso.

### Onde a dica vai além da fonte

Registrado em `nota` e na planilha. Cada um é uma decisão de produto pendente,
não um bug:

- **Números que o app inventou** — "pelo menos 15 minutos" de janela aberta e
  "passagem de pelo menos 60cm" não têm fonte: nenhuma obra do corpus quantifica.
- **Cores que não fecham com o ciclo** — "roxo, verde e dourado" para
  Prosperidade (Sudeste = Madeira): só o verde confere; roxo é Fogo e dourado é
  Metal, e **Metal corta Madeira**. É convenção das Oito Aspirações, não Wu
  Xing. Mesmo caso em Espiritualidade ("roxo, azul escuro e branco" mistura
  Fogo + Água + Metal) e em "laranja" para Fama (o segundo tom do Fogo nas
  tabelas é roxo, não laranja).
- **Divergência de setor** — Too coloca o altar no **Noroeste** (trigrama
  Chien); Alba coloca espiritualidade no **Nordeste**, que é o setor usado pelo
  app. As duas leituras existem na literatura; a do app é uma delas, não a
  única.
- **Remédio que a fonte não dá** — "elimine corredores longos usando plantas ou
  biombos": Too recomenda biombo/divisória e diz explicitamente que bambu,
  flautas e sinos "can only do so much". Planta não aparece como remédio de
  corredor em fonte nenhuma. O biombo tem apoio; a planta, não.

## Consequências

- **`nota` NÃO vai para o relatório.** Correção feita durante a implementação:
  a primeira versão jogava `contraindicacao`, `contestadaPor` **e** `nota` em
  `Remedio.contraindicacoes`. Discussão de curadoria ("os 15 minutos são
  precisão do app") não tem lugar num documento que vai para cliente pagante.
  Ressalva de uso, sim; metadado de curadoria, não. Teste trava isso.
- **A planilha é gerada, não transcrita** —
  `npx vite-node scripts/citacoes/gerar-planilha.mts` reescreve
  `docs/domain/curadoria-dicas.md` a partir de `constants.ts` +
  `dicas-classificadas.ts` + `curadoria-evidencia.ts`, e **estoura** se alguma
  dica única ficar fora das três listas (curada / sem fonte / não acionável).
  Foi a lição da ADR 0015, onde um número transcrito à mão ("117 dicas") ficou
  errado por três documentos.
- **O texto de rodapé do Plano de Ação foi corrigido.** Dizia que as demais
  dicas "ainda não têm classificação de evidência" — passou a ser falso no
  momento em que a curadoria entrou. Agora explica os três tiers e diz que só
  ficam de fora as recomendações cuja origem não foi localizada.
- **A fronteira do teste mudou de lugar, não desapareceu.** O teste da ADR 0015
  afirmava "nenhuma dica de texto livre vira remédio" — verdadeiro só enquanto a
  curadoria estava vazia. Reescrito para afirmar o que ainda importa: **só vira
  remédio a dica com fonte nomeada**, e passar uma dica sem fonte junto de uma
  curada produz exatamente um remédio.
- 461 testes (de 460), todos passando; `npx tsc --noEmit` limpo.

## Trabalho que isto deixou visível (e não fez)

1. **Ligar a contraindicação da Estrela 5 ao cálculo que já existe.** Hoje o
   aviso "não use velas onde estiver a Estrela 5" é texto fixo na
   contraindicação; `estrela-anual.ts` sabe **onde** ela está neste ano solar.
   Cruzar os dois transformaria um aviso genérico em alerta específico do
   imóvel. Não foi feito porque muda a assinatura de `gerarRemedios` (passaria a
   depender de orientação e data) e merece decisão própria.
2. **OCR do Skinner.** É a obra de maior autoridade do corpus e está inacessível
   por falta de camada de texto. Resolveria parte das 8 dicas sem fonte.
3. **As 8 dicas sem fonte** — ou aparece a fonte, ou é decisão de produto se
   continuam no catálogo. Não é tarefa de código.
4. **`'Este setor influencia todos os demais'`** — segue em
   `DICAS_NAO_ACIONAVEIS`, apresentada ao consultor como se fosse conselho.
   Pendência da ADR 0015, ainda em pé.
5. **Kong Wang, San He, Xuan Kong Da Gua e os coeficientes WMM** continuam
   **fora de escopo** (ADR 0014). Este corpus não os sustenta: são obras
   introdutórias, e nenhuma traz tabelas de graus, de combinações triplas ou de
   hexagramas. Conferido, não presumido.
