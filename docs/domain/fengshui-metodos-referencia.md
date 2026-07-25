# FengShui Studio — Referência Técnica dos Métodos

Documento de domínio. Descreve, para cada escola/método: entradas necessárias, algoritmo de cálculo, regras de leitura, formas de visualização, diagnóstico e catálogo de remediações. Serve de base para os prompts de implementação (`fengshui-prompts-modulos.md`).

> **Nota de posicionamento do produto:** métodos clássicos (Luan Tou, Ba Zhai, Xuan Kong Fei Xing, San He, Xuan Kong Da Gua, Liu Fa) e métodos não-clássicos (BTB/Bagua ocidental) devem ser rotulados explicitamente na UI. Nunca misturar os dois num mesmo diagnóstico sem indicação de escola. Isso é uma invariante de honestidade do produto, no mesmo espírito do Method Advisor do Engine CollabZ.

> **Nota de revisão (2026-07-25):** este documento foi revisado antes de virar base de prompts de implementação. Duas classes de achado:
> 1. Um **erro de fórmula concreto e verificado** (Ming Gua, Método 2) — corrigido inline, com a divergência explicada.
> 2. Um **ponto que precisa de confirmação com fonte primária** (Kong Wang, seção 1.4) — sinalizado, não "corrigido" sem certeza suficiente.
>
> A seção final **"Anexo — Estado de Implementação"** mapeia cada parte deste documento ao que já existe em código (testado, em produção) versus o que ainda é escopo novo. Isso evita reconstruir o que já está pronto e testado, e ajuda a escrever prompts de implementação que partem do estado real do repositório, não de uma folha em branco.

---

## PARTE I — Fundamentos comuns a todos os métodos

Estes blocos são compartilhados. Devem viver num pacote de domínio único (`fengshui-domain`) e ser consumidos por todos os motores de método.

### 1.1 Os 5 Movimentos (Wu Xing)

| Movimento | Chinês | Cor | Forma | Materiais | Estação | Direção |
|---|---|---|---|---|---|---|
| Madeira | 木 Mu | verde, azul-esverdeado | colunar, vertical | madeira, plantas vivas, fibras | primavera | E, SE |
| Fogo | 火 Huo | vermelho, laranja, roxo | triangular, pontiaguda | velas, luz, couro, lã | verão | S |
| Terra | 土 Tu | amarelo, ocre, marrom | quadrada, baixa e larga | cerâmica, pedra, cristal, tijolo | intersazonal | SO, NE, centro |
| Metal | 金 Jin | branco, prata, dourado, cinza | redonda, esférica | metais, sinos, moedas, mármore branco | outono | O, NO |
| Água | 水 Shui | preto, azul-escuro | ondulada, irregular | água, espelho, vidro | inverno | N |

**Três ciclos** (todo remédio é derivado de um destes):

1. **Geração (生 Sheng):** Madeira → Fogo → Terra → Metal → Água → Madeira.
2. **Controle (剋 Ke):** Madeira → Terra → Água → Fogo → Metal → Madeira.
3. **Exaustão / drenagem (洩 Xie):** o inverso do ciclo de geração. É o filho drenando a mãe.

**Regra de ouro da remediação clássica:** para estrelas/energias **negativas**, use **exaustão**, não controle. Controlar gera conflito (o Qi "briga"); exaurir dissolve. Exceção reconhecida: 5 Amarelo e 2 Negro, que se tratam com Metal (exaustão de Terra) — o que é, de fato, exaustão e não controle.

Para energias **positivas**, use **geração** (alimenta) ou **ativação por movimento** (som, luz, água em movimento, uso frequente do espaço).

### 1.2 Bagua — 8 trigramas (arranjo do Céu Posterior / Hou Tian)

| Trigrama | Nome | Direção | Nº Lo Shu | Elemento | Família | Órgão/tema |
|---|---|---|---|---|---|---|
| ☰ | Qian 乾 | NO | 6 | Metal | pai | cabeça, patrocinadores, autoridade |
| ☱ | Dui 兌 | O | 7 | Metal | filha caçula | boca, alegria, romance, metal precioso |
| ☲ | Li 離 | S | 9 | Fogo | filha do meio | olhos, coração, fama, reconhecimento |
| ☳ | Zhen 震 | E | 3 | Madeira | filho mais velho | pés, fígado, crescimento, litígio |
| ☴ | Xun 巽 | SE | 4 | Madeira | filha mais velha | quadris, vesícula, riqueza, estudos |
| ☵ | Kan 坎 | N | 1 | Água | filho do meio | ouvidos, rins, carreira, sabedoria |
| ☶ | Gen 艮 | NE | 8 | Terra | filho caçula | mãos, baço, conhecimento, montanha |
| ☷ | Kun 坤 | SO | 2 | Terra | mãe | abdômen, estômago, mãe, relacionamentos |

Codificação binária das linhas (de baixo para cima, 1 = yang/inteira, 0 = yin/quebrada):

```
Qian 111 (6) | Dui 110 (7) | Li 101 (9) | Zhen 100 (3)
Xun  011 (4) | Kan 010 (1) | Gen 001 (8) | Kun  000 (2)
```

Essa codificação é o que torna Ba Zhai calculável (ver 2.2).

> ✅ **Confirmado por implementação:** o mapa direção→número Lo Shu já existe e está testado em `src/lib/oito-mansoes.ts` (`LO_SHU_POR_OCTANTE`) e `src/lib/estrelas-voadoras.ts`. O teste `oito-mansoes.test.ts` verifica a propriedade de quadrado mágico (soma 15 em toda linha/coluna/diagonal) — a mesma tabela desta seção.

### 1.3 Lo Shu — quadrado mágico e trajetória de voo

```
SE  4 | S  9 | SO 2
 E  3 | C  5 |  O 7
NE  8 | N  1 | NO 6
```

Soma 15 em qualquer linha, coluna ou diagonal.

**Trajetória de voo (Lo Shu path)** — sequência obrigatória para "voar" qualquer estrela:

```
Centro → NO → O → NE → S → N → SO → E → SE → (volta ao Centro)
   5      6     7    8     9    1     2    3     4
```

Implementação canônica: um array ordenado de 9 setores. Voo **para frente** (`+1` a cada passo, com wrap 9→1) e voo **reverso** (`−1` a cada passo, com wrap 1→9).

```ts
const LO_SHU_PATH = ['C','NW','W','NE','S','N','SW','E','SE'] as const;

function flyStars(centerStar: number, direction: 1 | -1): Record<Sector, number> {
  const result = {} as Record<Sector, number>;
  let star = centerStar;
  for (const sector of LO_SHU_PATH) {
    result[sector] = star;
    star = wrap9(star + direction);       // wrap9: 0→9, 10→1
  }
  return result;
}
```

> ✅ **Já implementado e testado.** `src/lib/estrelas-voadoras.ts` (`CAMINHO_VOO`, `construirGrid`, `normalizar1a9`) implementa exatamente este mecanismo. Antes de codificar, o caminho foi reconstruído à mão contra a carta do Período 8 amplamente publicada (4-9-2/3-5-7/8-1-6) — bateu exatamente, e isso virou teste automatizado (`estrelas-voadoras.test.ts`).

### 1.4 As 24 Montanhas (24 Shan)

Cada trigrama de 45° se divide em 3 montanhas de 15°. Base de tudo que envolve bússola.

| # | Montanha | Faixa (°) | Setor | Yuan Long | Polaridade |
|---|---|---|---|---|---|
| 1 | 壬 Ren | 337,5–352,5 | N | Terra (Di) | Yang |
| 2 | 子 Zi | 352,5–7,5 | N | Céu (Tian) | Yin |
| 3 | 癸 Gui | 7,5–22,5 | N | Humano (Ren) | Yin |
| 4 | 丑 Chou | 22,5–37,5 | NE | Terra | Yin |
| 5 | 艮 Gen | 37,5–52,5 | NE | Céu | Yang |
| 6 | 寅 Yin | 52,5–67,5 | NE | Humano | Yang |
| 7 | 甲 Jia | 67,5–82,5 | E | Terra | Yang |
| 8 | 卯 Mao | 82,5–97,5 | E | Céu | Yin |
| 9 | 乙 Yi | 97,5–112,5 | E | Humano | Yin |
| 10 | 辰 Chen | 112,5–127,5 | SE | Terra | Yin |
| 11 | 巽 Xun | 127,5–142,5 | SE | Céu | Yang |
| 12 | 巳 Si | 142,5–157,5 | SE | Humano | Yang |
| 13 | 丙 Bing | 157,5–172,5 | S | Terra | Yang |
| 14 | 午 Wu | 172,5–187,5 | S | Céu | Yin |
| 15 | 丁 Ding | 187,5–202,5 | S | Humano | Yin |
| 16 | 未 Wei | 202,5–217,5 | SO | Terra | Yin |
| 17 | 坤 Kun | 217,5–232,5 | SO | Céu | Yang |
| 18 | 申 Shen | 232,5–247,5 | SO | Humano | Yang |
| 19 | 庚 Geng | 247,5–262,5 | O | Terra | Yang |
| 20 | 酉 You | 262,5–277,5 | O | Céu | Yin |
| 21 | 辛 Xin | 277,5–292,5 | O | Humano | Yin |
| 22 | 戌 Xu | 292,5–307,5 | NO | Terra | Yin |
| 23 | 乾 Qian | 307,5–322,5 | NO | Céu | Yang |
| 24 | 亥 Hai | 322,5–337,5 | NO | Humano | Yang |

**Linhas vazias (空亡 Kong Wang) — validação obrigatória:**
- *Da Kong Wang* (vazio maior): 45°, 135°, 225°, 315° — fronteira entre dois trigramas. Tolerância de alerta: ±1,5°.
- *Xiao Kong Wang* (vazio menor): fronteira entre montanhas dentro do mesmo trigrama (ex.: 352,5°, 7,5°). Tolerância ±1,5°.
- Uma leitura dentro dessas faixas **não deve produzir carta**. Deve produzir um aviso: "medição em linha de fronteira — repita a medição em 3 pontos distintos".

> 🟡 **PRECISA DE VERIFICAÇÃO COM FONTE PRIMÁRIA.** Os graus citados para Da Kong Wang (45°, 135°, 225°, 315°) correspondem, pela tabela acima, aos **centros** dos trigramas intercardinais (NE, SE, SO, NO) — não a fronteiras entre trigramas. Fronteiras entre os 8 trigramas de 45° ficam, pela própria tabela das 24 Montanhas, em múltiplos de 22,5° (22,5°, 67,5°, 112,5°, 157,5°, 202,5°, 247,5°, 292,5°, 337,5° — exatamente os limites inferior/superior de cada faixa listada). Não tenho confiança suficiente para reescrever este valor sem uma fonte primária ou confirmação de um consultor formado em Xuan Kong — sinalizo em vez de "corrigir" às cegas. **Ação recomendada:** validar contra um Luo Pan físico ou uma referência primária antes de implementar a checagem de Kong Wang no código.

### 1.5 Períodos (Yun) — ciclos San Yuan de 180 anos

| Era | Período | Início | Fim |
|---|---|---|---|
| Superior | 1 | 1864 | 1883 |
| Superior | 2 | 1884 | 1903 |
| Superior | 3 | 1904 | 1923 |
| Média | 4 | 1924 | 1943 |
| Média | 5 | 1944 | 1963 |
| Média | 6 | 1964 | 1983 |
| Inferior | 7 | 1984 | 2003 |
| Inferior | 8 | 2004 | 2023 |
| Inferior | 9 | 2024 | 2043 |

Ciclo reinicia em 2044 (Período 1). **Estamos no Período 9** (início: Li Chun de 04/02/2024).

O período usado na carta natal é o da **construção** do imóvel (ou da última reforma estrutural relevante: troca de telhado, remoção/adição de paredes estruturais, mudança da fachada). Não é o período atual — isso é erro comum e deve ser bloqueado por regra de domínio.

> ✅ **Já implementado e testado**, como fórmula cíclica (não tabela hardcoded, para não precisar atualização manual a cada 20 anos): `periodoDaConstrucao()` em `src/lib/estrelas-voadoras.ts`. Fórmula: `periodo = floor((anoSolar − 1864) / 20) mod 9 + 1`. Testes cobrem as âncoras 2004→8, 2024→9, o início do ciclo (1864→1) e o wrap do ciclo (2044→1).

### 1.6 Calendário: ano solar chinês (Hsia)

Todos os cálculos de ano (Ming Gua, BaZi, estrela anual, Tai Sui) usam o **ano solar**, que começa em **Li Chun** (立春), por volta de 3–5 de fevereiro, e **não** no Ano Novo Chinês lunar.

- Uma pessoa nascida em 20/01/1990 pertence ao ano 1989 para fins de Feng Shui.
- Implementação: tabela de efemérides de Li Chun (precisão de minuto) ou biblioteca astronômica. **Nunca** aproximar por "4 de fevereiro" fixo — a diferença chega a ~1 dia.
- Mesma lógica vale para os 12 meses solares (Jie Qi), usados nas estrelas mensais.

> 🟡 **Débito técnico já conhecido.** `ming-gua.ts` e `estrelas-voadoras.ts` hoje usam a aproximação fixa "antes de 4/fev conta o ano anterior" — exatamente o que este documento diz para nunca fazer. Funciona para a esmagadora maioria dos casos (a data real de Li Chun varia entre 3 e 5 de fevereiro), mas há um punhado de dias por década em que a aproximação erra. Vale registrar como item de precisão futura (tabela de efemérides ou biblioteca astronômica), não bloqueia uso atual.

### 1.7 Determinação do centro (Tai Ji) e forma do imóvel

Antes de sobrepor qualquer grid, é preciso definir o centro. Regras:

1. Trabalhe com o **polígono da área construída fechada** (varandas cobertas e integradas contam; garagem separada não; jardim não).
2. Centro = **centróide geométrico do polígono** (não o centro do bounding box). Para plantas em L, U ou T o centróide pode cair fora da área construída — isso é diagnóstico em si.
3. **Setores ausentes vs. extensões** — regra do terço:
   - Se a "falta" em um dos lados for **≥ 1/3 da extensão daquele lado** → é um **setor ausente** (缺角 que gua). Diagnóstico negativo: o tema daquele trigrama está enfraquecido.
   - Se a projeção for **≤ 1/3 do lado** → é uma **extensão** (凸出). Diagnóstico positivo: aquele tema é reforçado.
4. Casas de múltiplos pavimentos: cada pavimento tem seu próprio Tai Ji, mas a orientação (sitting/facing) é do edifício, não do pavimento.
5. Apartamentos: existem duas escolas. (a) Usar a orientação do prédio; (b) usar a orientação da unidade. Prática mais defensável: **carta do edifício** para a estrutura + **Tai Ji da unidade** para setorização interna, e declarar isso ao usuário. O produto deve permitir os dois e registrar a escolha como premissa da análise.

> 🟡 **Gap real vs. o que existe hoje.** O app hoje usa o **centro do retângulo delimitador** da planta (bounding box), não o centróide geométrico do polígono real — funciona bem para plantas retangulares (a maioria), mas diverge do método correto para plantas em L/U/T, exatamente o caso que este documento aponta como "diagnóstico em si". A regra do terço (falta vs. extensão) também não está implementada — hoje o app só marca falta/excesso como retângulos livres, sem essa classificação automática. Escopo novo real, não coberto por nenhum PR até aqui.

---

## PARTE II — Captura de orientação (o motor de bússola)

Este é o componente crítico. Três modos de entrada, todos produzindo o mesmo objeto de domínio.

### 2.1 O objeto de saída

```ts
type OrientationReading = {
  facingDegrees: number;          // 0–360, norte magnético OU verdadeiro (ver reference)
  reference: 'magnetic' | 'true';
  declination: number | null;     // graus, E positivo
  source: 'manual' | 'device-compass' | 'map-alignment';
  confidence: 'high' | 'medium' | 'low';
  samples?: number[];             // leituras individuais, para modos automáticos
  spread?: number;                // desvio entre amostras
  capturedAt: Date;
  warnings: OrientationWarning[]; // KONG_WANG, HIGH_SPREAD, MAGNETIC_INTERFERENCE...
};
```

**Norte magnético vs. verdadeiro:** o Luo Pan é um instrumento magnético e a tradição clássica lê norte magnético. Leituras derivadas de mapa/GPS são norte verdadeiro. O sistema deve:
- Guardar sempre a leitura bruta + a referência.
- Calcular a declinação via modelo **WMM** ou **IGRF** (lat/long + data) e oferecer a conversão.
- Expor um toggle **"usar norte magnético (padrão clássico)"** ligado por padrão, com explicação. No Brasil a declinação varia de ~ −23° (RS) a ~ −8° (NE) — é diferença de **1 a 2 montanhas**. Ignorar isso invalida a carta.

> 🟡 **Gap real vs. o que existe hoje.** O app hoje captura só `orientacao_graus` (0–359°), sem distinguir magnético/verdadeiro e sem cálculo de declinação. Na prática, o consultor lê a bússola do celular ou converte mentalmente — a declinação não é corrigida automaticamente. Isso é uma imprecisão real e conhecida (documentada aqui pela primeira vez de forma explícita), não um bug: o campo sempre foi um valor único, o modelo `OrientationReading` completo (com `reference`/`declination`/`confidence`) é escopo novo.

### 2.2 Modo A — Entrada manual (obrigatório, é o fallback de tudo)

- Campo numérico 0–360 com uma casa decimal.
- Seletor de referência (magnético/verdadeiro) e campo opcional de local (para calcular declinação).
- Assistente de **3 leituras**: o usuário informa três medições feitas com Luo Pan/bússola física em pontos diferentes; o sistema calcula média circular, mostra o desvio e alerta se > 3°.
  - *Média circular* — não é média aritmética. Use `atan2(Σ sin θᵢ, Σ cos θᵢ)`, senão 359° e 1° dão 180°.
- Mostra em tempo real: montanha resultante, setor, e se está em Kong Wang.

> ✅ **Parcialmente implementado.** O app já tem entrada manual em graus inteiros (0–359°) com seletor de octante rápido (N/NE/E/SE/S/SW/W/NW), em `app/bagua-planta/page.tsx`. **Não implementado:** casa decimal, seletor de referência magnético/verdadeiro, assistente de 3 leituras com média circular, e detecção/aviso de Kong Wang (depende da verificação da seção 1.4 acima).

### 2.3 Modo B — Bússola virtual (magnetômetro do dispositivo)

- API: `DeviceOrientationEvent` (`webkitCompassHeading` no iOS, `alpha` + `absolute` no Android). Requer HTTPS e, no iOS, `requestPermission()` disparado por gesto do usuário.
- **Fluxo de calibração obrigatório** antes da leitura: animação do movimento em oito, verificação de que o desvio entre amostras caiu abaixo do limiar.
- **Amostragem:** coletar ~50 amostras em 5 s, descartar outliers (MAD), calcular média circular e desvio.
  - desvio ≤ 2° → `confidence: high`
  - 2–5° → `medium`, exibir aviso
  - \> 5° → `low`, **bloquear** a geração da carta e sugerir modo manual ou modo mapa.
- **Detecção de interferência:** se o dispositivo expuser a magnitude do campo magnético, comparar com o esperado para a latitude (~22–45 µT). Fora da faixa → provável interferência (estrutura metálica, eletrônicos, laje armada). Aviso explícito: "afaste-se de estruturas metálicas e faça a leitura na porta, do lado de fora".
- **Anti-padrão a evitar:** apresentar a bússola virtual como equivalente ao Luo Pan. A UI deve dizer que é uma aproximação e recomendar validação com instrumento físico para trabalho profissional.
- UI: rosa dos ventos com o anel das 24 montanhas girando, montanha corrente destacada, faixa de Kong Wang em vermelho.

> ⚪ **Decisão de produto já tomada, de propósito, na direção oposta.** No PR que introduziu a Bússola, optei deliberadamente por **não** usar o sensor do dispositivo no MVP — justamente pelo comportamento inconsistente entre navegadores/iOS que este documento também aponta. Este modo continua como melhoria futura documentada, não como pendência esquecida.

### 2.4 Modo C — Alinhamento sobre mapa/satélite (o mais confiável para o usuário leigo)

Este é o modo que resolve o problema real: o usuário não sabe medir, mas sabe reconhecer o próprio telhado numa imagem de satélite.

Fluxo:
1. Geocodificação do endereço ou seleção por GPS → centraliza o mapa em imagem de satélite.
2. O usuário faz upload da planta baixa (imagem ou PDF) ou desenha o polígono do imóvel diretamente sobre o satélite.
3. Camada da planta em cima do mapa, com controles de **mover, escalar (pinça) e rotacionar**, opacidade ajustável.
4. O usuário rotaciona/ajusta até coincidir com o contorno real do imóvel na imagem.
5. O sistema deriva o ângulo:
   - Ângulo de rotação aplicado pelo usuário + azimute do norte da projeção do mapa (Web Mercator: norte da tela = norte verdadeiro) → **facing verdadeiro**.
   - Converte para magnético usando WMM (lat/long do centróide + data atual).
6. O usuário marca **qual aresta é a fachada** (a face de maior Yang: mais luz, mais movimento, rua, vista aberta — não necessariamente a porta principal).
7. Precisão típica: ±2–3°, suficiente para determinar setor e, na maioria dos casos, montanha. Se o resultado cair a menos de 3° de uma fronteira, exibir alerta e pedir confirmação por outro modo.

Ganhos extras deste modo, que devem ser aproveitados no diagnóstico de Formas:
- Detecção automática de vias em T apontando para o imóvel, curvas de rua (arco favorável ou "faca de foice"), corpos d'água, edifícios altos vizinhos, topografia (via elevação), torres e viadutos.
- Mapa de sombra/insolação por horário (para leitura Yin/Yang).

> ⚪ **Escopo novo, não iniciado.** Nenhuma integração de mapa/satélite existe hoje no app. É provavelmente o modo de maior impacto de UX para o usuário leigo, como o documento já argumenta — bom candidato a próximo item de roadmap depois do Wu Zhai/Fei Xing base já entregues.

### 2.5 Sitting × Facing — a decisão que mais gera erro

O par 坐/向 (Zuo/Xiang) é sempre oposto exato (180°). Determinar **facing** (a frente) é uma decisão de julgamento, não uma medição. Hierarquia de critérios, do mais forte ao mais fraco:

1. Lado mais **Yang**: maior movimento, ruído, luz, vista aberta, rua principal.
2. Fachada arquitetônica principal / face com maior área envidraçada.
3. Face voltada para água ou espaço vazio (praça, campo, mar).
4. Porta principal — **último** critério, não o primeiro. Porta lateral ou de fundos é comum.
5. Em apartamentos: a sacada/face de maior abertura costuma ser o facing; a porta do corredor interno raramente é.

O produto deve conduzir um **questionário de determinação de facing** com essas perguntas, calcular um score e mostrar as duas hipóteses concorrentes quando o score for próximo, gerando as duas cartas para comparação. Isso é honestidade metodológica: praticantes divergem, e a divergência deve ser explícita, não escondida atrás de um número.

> ⚪ **Simplificação atual conhecida.** O app hoje assume que a orientação informada já É o facing (não há questionário de determinação nem hipóteses concorrentes). Para a maioria das casas isso é suficiente; o questionário de julgamento é um refinamento real para casos ambíguos (apartamentos, fachadas múltiplas).

---

## PARTE III — Os métodos

Cada método abaixo segue o mesmo template: entradas → cálculo → regras de leitura → visualização → diagnóstico → remediação.

---

## MÉTODO 1 — Escola das Formas (峦头 Luan Tou / Xing Shi)

A escola mais antiga e a que tem precedência hierárquica: **forma primeiro, bússola depois**. Uma carta de estrelas voadoras impecável num terreno com forma ruim não se sustenta. Regra de domínio: se o score de Formas for crítico, o relatório deve dizer isso antes de qualquer análise de compasso.

### Entradas
Foto de satélite, fotos do entorno (4 direções), planta baixa, altura relativa dos vizinhos, topografia, vias, água, vegetação, uso do solo.

### Cálculo
Não há fórmula numérica. É um **checklist ponderado por escalas**:

| Escala | Raio | O que avaliar |
|---|---|---|
| Macro | 1–5 km | cordilheiras, rios, mar, grandes eixos viários, aeroportos, plantas industriais |
| Meso | 100–500 m | quadra, ruas, prédios altos, praças, viadutos, torres, cemitérios, hospitais |
| Micro | < 50 m | vizinhos imediatos, muros, postes, transformadores, árvores, esquinas, telhados |
| Interno | dentro | circulação, alinhamento porta-porta, vigas, escadas, banheiros, cozinha |

**Os 4 Animais Celestiais** (referenciados ao facing):
- **Xuan Wu 玄武** (Tartaruga Negra, atrás): deve ser mais alto e sólido — morro, prédio maior, muro alto. Suporte, patrocínio, segurança. Ausente → falta de apoio.
- **Zhu Que 朱雀** (Fênix Vermelha, à frente): deve ser aberto e mais baixo — *Ming Tang* (明堂, salão brilhante). Espaço para o Qi se acumular antes de entrar. Bloqueado → oportunidades travadas.
- **Qing Long 青龙** (Dragão Azul, à esquerda de quem olha de dentro para fora): ligeiramente mais alto que o tigre. Masculino, ativo, carreira.
- **Bai Hu 白虎** (Tigre Branco, à direita): mais baixo e quieto. Se dominar o dragão → agressividade, litígio, acidentes.

**Sha Qi (煞氣) — catálogo de formas agressivas:**

| Nome | Descrição | Severidade |
|---|---|---|
| 穿心煞 Chuan Xin | via em T ou Y apontando para a fachada | crítica |
| 天斬煞 Tian Zhan (corte celestial) | fresta estreita entre dois prédios altos apontando para a casa | crítica |
| 尖角煞 Jian Jiao | quina de edifício apontando para a porta/janela | alta |
| 反弓煞 Fan Gong (arco reverso) | rua/rio curvando *afastando-se* da casa | alta |
| 鐮刀煞 Lian Dao (foice) | viaduto ou via elevada curvando contra | alta |
| 壓煞 Ya Sha | prédio muito maior imediatamente à frente, esmagando | alta |
| 孤峰煞 Gu Feng | edifício isolado sem apoio nos lados nem atrás | média |
| 白虎煞 Bai Hu | construção pesada/alta à direita | média |
| 聲煞 Sheng Sha | ruído constante (via expressa, obra, bar) | média |
| 味煞 Wei Sha | odor (lixo, esgoto, indústria) | média |
| 光煞 Guang Sha | reflexo de fachada espelhada ou luminoso incidindo | média |
| 電磁煞 | transformador, antena, linha de alta tensão próxima | alta |
| 陰煞 Yin Sha | cemitério, hospital, funerária, presídio, templo em frente | contexto |

**Sha interno:**
- 穿堂煞 porta principal alinhada com porta/janela dos fundos (Qi entra e sai sem circular).
- Viga exposta sobre cama, mesa de trabalho ou fogão.
- Escada de frente para a porta principal.
- Banheiro no centro da casa (posição Tai Ji) ou sobre/adjacente à cozinha.
- Cama com pés apontando diretamente para a porta ("posição do caixão").
- Cabeceira sem parede sólida, ou contra parede de banheiro.
- Fogão e pia adjacentes sem separação (Fogo × Água), ou fogão sob janela.
- Espelho de frente para a cama.
- Pé-direito irregular, teto inclinado sobre a cama.

> ✅ **Sobreposição real com o que já existe.** Boa parte do catálogo de "Sha interno" já tem um lar no app: o checklist **Fluxo de Chi** (`CHI_ITEMS` em `app/consultas/[id]/relatorio/page.tsx`) já cobre porta que abre completamente, ausência de corredor longo, ausência de portas alinhadas (isso é literalmente 穿堂煞), ausência de escada de frente para a porta, banheiro fora do centro, ausência de vigas expostas, espelhos que não refletem a porta, ausência de cantos agressivos, fluxo suave e iluminação natural — 9 dos itens desta lista, sob outro nome. **Não implementado:** o catálogo de Sha EXTERNO (via em T, corte celestial, quina de prédio, arco reverso etc.) — que depende do Modo C (satélite) da Parte II — e a classificação por escala (macro/meso/micro).

### Visualização
- Imagem de satélite anotada com setas vetoriais de Sha Qi, indicando origem, direção e distância.
- Sobreposição dos 4 animais como zonas coloridas em torno do polígono.
- Mapa de calor de "pressão externa" por face.
- Planta baixa com marcadores de Sha interno e linhas de fluxo de Qi (path de circulação do ar/pessoas da porta principal até cada cômodo).

### Diagnóstico
Score composto 0–100 por escala, com peso maior para Micro e Interno (é o que o morador pode mudar). Achados classificados em **crítico / alto / médio / observação**, cada um com o tema afetado (saúde, riqueza, relacionamento, carreira, reputação).

### Remediação — os 4 verbos
1. **Bloquear (擋)** — muro, cerca viva densa, painel, biombo, cortina pesada. Para Sha direcional forte.
2. **Defletir (化/擋)** — vegetação, água, superfície convexa, mudança de ângulo de entrada. Redireciona sem confrontar.
3. **Absorver (吸)** — massa, plantas, pedra, terra, elementos densos.
4. **Dissolver (化)** — mudar a função do cômodo, reposicionar mobiliário, alterar a rota de circulação. **É o remédio mais barato e mais eficaz e o produto deve priorizá-lo.**

*Nota de produto:* espelhos Ba Gua convexos são o remédio mais pedido e o mais controverso. Se incluir, marcar como "tradicional popular, sem consenso clássico" e nunca recomendar apontar para a casa do vizinho — há implicação ética e social. Priorize sempre soluções físicas e de layout.

---

## MÉTODO 2 — Ba Zhai (八宅, Oito Mansões)

Método de compatibilidade direcional entre pessoa e edificação. Simples, popular, e frequentemente mal aplicado. É um método de **direções**, não de setores de tempo.

### Entradas
- Sitting do imóvel (para determinar o Gua da casa).
- Data de nascimento (ano solar) e sexo de cada morador → Ming Gua.
- Posição de: porta principal, cama (direção da cabeceira), fogão (direção da "boca"), mesa de trabalho, cadeira principal.

### Cálculo — Gua da casa
O Gua da casa é dado pela **direção do sitting** (坐山). Casa que senta ao Norte e olha ao Sul = casa **Kan**.

> ✅ **Já implementado e testado**, como `calcularKuaDaCasa()` em `src/lib/oito-mansoes.ts` — usa a direção da FACHADA (facing), não do sitting, para chegar ao mesmo Gua da casa (facing e sitting são trigramas opostos; usar um ou outro como ponto de partida é equivalente porque a busca é pelo TRIGRAMA da casa, não pela direção específica de leitura). Testado com a propriedade de quadrado mágico Lo Shu.

### Cálculo — Ming Gua (número pessoal)

```
soma = reduzir_a_um_digito(ano_solar_de_nascimento)   // 1989 → 1+9+8+9=27 → 2+7=9

Homem  nascido 1900–1999: gua = 10 − soma
Homem  nascido 2000+    : gua =  9 − soma
Mulher nascida 1900–1999: gua = soma + 5
Mulher nascida 2000+    : gua = soma + 6

se gua > 9 → gua −= 9;  se gua == 0 → gua = 9
gua == 5  → homem usa 2 (Kun); mulher usa 8 (Gen)
```

> 🔴 **ERRO ENCONTRADO E CORRIGIDO.** A fórmula acima soma **todos os dígitos do ano completo** (`1989 → 1+9+8+9=27 → 9`). O padrão clássico amplamente publicado — e já implementado/testado em `src/lib/ming-gua.ts` — soma apenas os **dois últimos dígitos** do ano: `1989 → 8+9=17 → 1+7=8`. **8 ≠ 9: são fórmulas diferentes, a divergência é real, não um erro de digitação no exemplo.**
>
> Prova da divergência: a raiz digital do ano completo só coincide com a raiz digital dos dois últimos dígitos quando a parte "século" (os dois primeiros dígitos do ano) já reduz a um múltiplo de 9 — o que não é o caso geral (ex.: "19" reduz a 1, não a 0/9). Um segundo exemplo confirma: para o ano 2000, a fórmula do ano completo dá soma=2 (dígitos "2000"→2), enquanto a fórmula dos dois últimos dígitos dá X=0 ("00"→0) — resultados de Kua diferentes (gua=9−2=7 vs. gua=9−0=9).
>
> Evidência a favor de "dois últimos dígitos": apliquei a sequência de mutação de linhas definida logo abaixo (seção "Cálculo — as 8 direções") à casa Kan e comparei com `DIRECOES_POR_KUA` (tabela já em produção desde o PR #84, usada por milhares de leituras de Ming Gua neste app). **As quatro direções favoráveis bateram exatamente** (Sheng Chi=Sudeste, Tian Yi=Leste, Yan Nian=Sul, Fu Wei=Norte) — confirmando que a tabela de RESULTADOS deste documento está correta; o erro está isolado no passo de derivar `soma`/X a partir do ano.
>
> **Fórmula corrigida** (a que já está em produção):
> ```
> X = reduzir_a_um_digito(dois últimos dígitos do ano solar)   // 1989 → 8+9=17 → 1+7=8
> ```
> O restante do algoritmo (homem/mulher, antes/depois de 2000, gua==5 vira 2/8) está correto como escrito e bate com a implementação testada.

### Cálculo — as 8 direções (transformação de linhas, 遊年)
Partindo do trigrama base (Gua da casa ou Ming Gua), aplique a sequência cumulativa de mutação de linhas. Cada passo parte do resultado do passo anterior:

| Passo | Linha mutada | Resultado |
|---|---|---|
| 1 | superior | 生氣 Sheng Qi |
| 2 | média | 五鬼 Wu Gui |
| 3 | inferior | 延年 Yan Nian |
| 4 | média | 六煞 Liu Sha |
| 5 | superior | 禍害 Huo Hai |
| 6 | média | 天醫 Tian Yi |
| 7 | inferior | 絕命 Jue Ming |
| 8 | média | 伏位 Fu Wei (volta ao original) |

```ts
const MUTATION_SEQUENCE = [2, 1, 0, 1, 2, 1, 0, 1]; // índice do bit: 0=inferior, 1=média, 2=superior
const OUTCOMES = ['SHENG_QI','WU_GUI','YAN_NIAN','LIU_SHA','HUO_HAI','TIAN_YI','JUE_MING','FU_WEI'];

function baZhaiMap(baseTrigram: Bits3): Record<Trigram, Outcome> {
  let current = baseTrigram;
  const map = {} as Record<Trigram, Outcome>;
  MUTATION_SEQUENCE.forEach((bit, i) => {
    current = flipBit(current, bit);
    map[toTrigram(current)] = OUTCOMES[i];
  });
  return map;
}
```

Verificação (casa Kan, 010): topo→011 Xun = Sheng Qi (SE); média→001 Gen = Wu Gui (NE); inferior→101 Li = Yan Nian (S); média→111 Qian = Liu Sha (NO); topo→110 Dui = Huo Hai (O); média→100 Zhen = Tian Yi (E); inferior→000 Kun = Jue Ming (SO); média→010 Kan = Fu Wei (N). ✔

> ✅ **Reconstruído e cross-validado passo a passo** contra a tabela de trigramas da seção 1.2 (as formas ☴☶☲ batem com os bits declarados) e contra `DIRECOES_POR_KUA` já implementada — ver nota na fórmula do Ming Gua acima. Este algoritmo (a mutação de linhas em si) está correto; **não está implementado como função separada** no código — hoje `DIRECOES_POR_KUA` é uma tabela estática de resultados (equivalente ao resultado final desta função, para os 8 Gua possíveis), não o algoritmo generativo. Implementar `baZhaiMap` teria valor se o produto precisar derivar outras leituras (ex.: 8 direções de um trigrama arbitrário fora do catálogo pessoa/casa) — hoje não é necessário porque só há 8 Gua possíveis e a tabela estática já cobre todos.

### Regras de leitura

**4 direções auspiciosas:**
| Direção | Peso | Tema | Uso ideal |
|---|---|---|---|
| 生氣 Sheng Qi | +90 | prosperidade, vitalidade, progresso | porta principal, sala, escritório |
| 天醫 Tian Yi | +80 | saúde, cura, benfeitores | quarto, cabeceira, cozinha |
| 延年 Yan Nian | +70 | relacionamentos, longevidade, harmonia | quarto do casal, sala de jantar |
| 伏位 Fu Wei | +60 | estabilidade, clareza, foco | estudo, meditação |

**4 direções inauspiciosas:**
| Direção | Peso | Manifestação | Uso ideal (sacrificar) |
|---|---|---|---|
| 禍害 Huo Hai | −60 | contratempos, atrasos, discussões pequenas | depósito, lavanderia |
| 六煞 Liu Sha | −70 | conflitos, processos, relações ilícitas | banheiro, garagem |
| 五鬼 Wu Gui | −80 | roubo, incêndio, traição, instabilidade | banheiro, despensa |
| 絕命 Jue Ming | −90 | perdas graves, saúde severa | banheiro, corredor, escada |

**Regra estrutural "sentar no mal, olhar para o bem" (坐凶向吉):**
- **Localização** de coisas ruins (banheiro, fogão, depósito) → nos setores ruins.
- **Direção** para a qual a pessoa/objeto se volta → sempre nas direções boas.
- Fogão: o corpo do fogão fica em setor inauspicioso; a "boca" (entrada de gás/energia, ou o lado de onde vem a alimentação) aponta para direção auspiciosa do chefe da família. Adaptar para fogão elétrico/indução: a face frontal do painel de controle.
- Cama: **cabeceira** apontando para direção auspiciosa do ocupante (mede-se pela linha perpendicular à cabeceira, saindo da cabeça).
- Mesa: a pessoa senta olhando para direção auspiciosa; costas contra parede sólida.

**Grupos:** Leste (Kan 1, Li 9, Zhen 3, Xun 4) e Oeste (Qian 6, Kun 2, Gen 8, Dui 7). Pessoa do grupo Leste é compatível com casa do grupo Leste. Conflito de grupos entre moradores é o caso mais comum e o produto deve ter uma **política explícita de resolução** (ver Remediação).

> ✅ **Grupos Leste/Oeste já implementados e testados** — `GRUPO_LESTE` em `ming-gua.ts`, reaproveitado por `oito-mansoes.ts` (`compatibilidadeMoradorCasa`). ⚪ **Não implementado:** posicionamento de fogão/cama/mesa por direção pessoal (o app não modela a posição de mobiliário dentro do cômodo, só o setor do Ba Guá) nem a política de resolução de conflito entre moradores.

### Visualização
- Roseta de 8 setores de 45° sobreposta à planta, colorida por Sheng Qi / Tian Yi / Yan Nian / Fu Wei (verdes) e Huo Hai / Liu Sha / Wu Gui / Jue Ming (âmbar → vermelho).
- Camadas empilháveis: uma por morador + uma da casa, com toggle.
- Painel de conflito: matriz morador × direção mostrando onde os moradores divergem.
- Setas de direção sobre os móveis-chave (cama, fogão, mesa).

### Diagnóstico
Score por morador (0–100) = média ponderada das posições/direções dos elementos-chave, ponderada por tempo de permanência (cama pesa mais que corredor). Lista de conflitos casa×morador e morador×morador.

### Remediação
Ba Zhai é essencialmente **método de alocação**, então os remédios são quase todos de layout:
1. Trocar quartos entre moradores para casar cada um com seu setor.
2. Girar a cama para a direção pessoal favorável (a mais barata e mais efetiva).
3. Reposicionar a mesa de trabalho.
4. Reorientar a boca do fogão.
5. Usar porta secundária como entrada habitual quando a principal cai em setor ruim.
6. Reforço elementar sutil no setor problemático (exaustão do elemento do trigrama), quando não houver alternativa de layout.
7. **Política de conflito entre moradores:** prioridade para (a) quem sustenta financeiramente, (b) quem tem problema de saúde ativo, (c) idosos e crianças. Nunca "resolver" ignorando um morador — o relatório deve declarar quem foi priorizado e por quê.

---

## MÉTODO 3 — Xuan Kong Fei Xing (玄空飛星, Estrelas Voadoras)

O método clássico dominante para Yang Zhai. Combina espaço e tempo. É o núcleo do produto.

### Entradas
- Período de construção → estrela do período.
- Graus exatos de facing → montanha de facing (e, por oposição, de sitting).
- Ano e mês corrente → estrelas anuais e mensais.
- Planta com centro definido.

### Cálculo — carta natal (宅運盤)

**Passo 1 — Estrela do período no centro.** Período 9 → 9 no centro.

**Passo 2 — Voo do período.** Voe 9 para frente pela trajetória Lo Shu:
```
C=9, NO=1, O=2, NE=3, S=4, N=5, SO=6, E=7, SE=8
```
Isso gera o **Di Pan** (地盤, plano da terra). É a base.

**Passo 3 — Identificar as estrelas de montanha e de água do centro.**
- Olhe o setor onde está o **sitting**: o número do Di Pan nesse setor vira a **estrela de montanha (山星)** do centro.
- Olhe o setor do **facing**: o número do Di Pan ali vira a **estrela de água (向星)** do centro.

**Passo 4 — Determinar a direção de voo de cada uma (a parte que erra-se mais).**
Para cada estrela (montanha e água), localize no Di Pan **em qual montanha das 24 ela cairia**, considerando o *Yuan Long* (Terra/Céu/Humano) da montanha original de sitting/facing:
- A montanha de sitting/facing tem um Yuan Long (Terra, Céu ou Humano — coluna da tabela 1.4).
- No setor do trigrama correspondente à estrela, pegue a montanha **do mesmo Yuan Long**.
- Se essa montanha for **Yang** → voo **para frente** (+1). Se **Yin** → voo **reverso** (−1).

**Regra de substituição (替卦 Ti Gua):** quando a leitura de facing cai na faixa de ~±3° em torno da fronteira entre montanhas, aplica-se a fórmula de substituição, que troca a estrela por outra segundo uma tabela fixa. Implementação: manter a tabela Ti Gua e, ao detectar borda, gerar **as duas cartas** (normal e substituída) e apresentá-las lado a lado. Não escolher silenciosamente.

**Passo 5 — Montar a grade.** Cada um dos 9 setores fica com três números:

```
 山  向          (montanha à esquerda, água à direita)
   運            (período embaixo/centro)
```

> ✅ **Já implementado e testado** — com um recorte de escopo deliberado, explicado no próprio código e na UI. `src/lib/estrelas-voadoras.ts` implementa os Passos 1, 2, 3 e uma versão SIMPLIFICADA do Passo 4: em vez de determinar Yuan Long/montanha-das-24 e depois checar Yin/Yang dessa montanha específica, usa a regra (também clássica e amplamente citada) de **par/ímpar do próprio número-semente**: número ímpar na estrela semente → voo para frente; par → voo reverso. Isso é uma simplificação real em relação ao procedimento completo de 24 montanhas descrito aqui — funciona corretamente para a carta natal na resolução de 8 setores (45°) que o app usa hoje, mas diverge do procedimento de precisão de 15° (24 montanhas) quando a leitura fica perto de uma fronteira de trigrama.
>
> **Não implementado:** a Regra de substituição (Ti Gua) — o código hoje arredonda a orientação para o octante mais próximo e não gera cartas alternativas para leituras de borda. Isso está documentado como limitação conhecida no próprio código-fonte e na interface do usuário (aviso explícito no painel de Estrelas Voadoras e no relatório).
>
> **Verificação de correção feita antes de codificar:** reconstruí o mecanismo à mão contra a carta do Período 8 amplamente publicada — bateu exatamente — e contra um caso clássico de livro-texto ("Período 8, sentado Norte, fachada Sul") calculando estrela de montanha e de fachada linha a linha. Os testes automatizados (`estrelas-voadoras.test.ts`) travam esses dois resultados.

### Regras de leitura — estruturas da carta

| Estrutura | Chinês | Condição | Significado |
|---|---|---|---|
| Montanha próspera, água próspera | 旺山旺水 | estrela de montanha corrente no sitting **e** estrela de água corrente no facing | melhor configuração possível: saúde e riqueza |
| Montanha sobe, água desce | 上山下水 | invertido: água atrás, montanha na frente | pior: perde gente e dinheiro; exige remédio estrutural (água atrás, massa na frente) |
| Estrelas duplas na frente | 雙星到向 | ambas no facing | bom para dinheiro, ruim para saúde/relacionamento; requer água na frente + montanha virtual atrás |
| Estrelas duplas atrás | 雙星到坐 | ambas no sitting | bom para pessoas, fraco para dinheiro |
| Soma 10 | 合十 | período + montanha (ou + água) = 10 em todos os setores | carta excepcionalmente harmoniosa |
| Três eras / cordão dos pais | 父母三般卦 | todos os setores com combinações 1-4-7, 2-5-8 ou 3-6-9 | conecta os três períodos; muito auspiciosa |
| Cordão de pérolas | 連珠三般卦 | combinações consecutivas (1-2-3, 4-5-6, 7-8-9) | fluidez, progresso contínuo |

> ⚪ **Não implementado.** O app hoje mostra a grade de 3 números por palácio, mas não classifica automaticamente nenhuma dessas estruturas (旺山旺水, 上山下水, etc.). É uma camada de interpretação sobre dados que já existem — escopo de "leitura", não de "cálculo novo".

### Regras de leitura — natureza das estrelas (Período 9)

| Estrela | Elemento | Status no P9 | Tema positivo | Tema negativo |
|---|---|---|---|---|
| 1 Branca | Água | futura próspera | carreira, sabedoria, fama tardia | isolamento, problemas renais |
| 2 Negra | Terra | morta / doentia | — | doença, tumores, problemas abdominais, viuvez |
| 3 Jade | Madeira | morta | — | litígio, roubo, discussões, problemas de fígado |
| 4 Verde | Madeira | morta | romance, estudos, escrita | escândalo romântico, indecisão |
| 5 Amarelo | Terra | morta / desastre | — | calamidade, doença grave, acidentes — **a mais perigosa** |
| 6 Branca | Metal | morta | autoridade, poder, patrocínio | rigidez, problemas de cabeça/pulmão |
| 7 Vermelha | Metal | morta / violenta | — | roubo, violência, ferimentos por lâmina, fofoca |
| 8 Branca | Terra | recém-passada, ainda benéfica | riqueza acumulada, imóveis, jovens | — |
| **9 Púrpura** | **Fogo** | **próspera (corrente)** | **prosperidade, reconhecimento, celebração, expansão** | amplifica o que estiver junto, inclusive o ruim |

**Combinações notáveis (montanha+água ou anual+base):**
- 2-5 ou 5-2 → doença grave. A combinação mais temida.
- 2-3 ou 3-2 → 鬥牛煞 "touros brigando": conflito familiar, processos.
- 5-9 ou 9-5 → 9 (Fogo) alimenta 5 (Terra) → amplifica desastre. Crítica no Período 9.
- 9-7 ou 7-9 → risco de incêndio.
- 1-4 ou 4-1 → estudos, escrita, romance (positiva).
- 6-8, 8-6, 1-6, 8-9, 9-8 → riqueza (positivas).
- 3-7 ou 7-3 → roubo, assalto, ferimentos.
- 4-9 → fertilidade, criatividade, mas também vaidade.

> 🟡 **A cautela com a Estrela 5 já está implementada** (`temEstrela5` em `estrelas-voadoras.ts`, exibida com aviso na UI) — é a única leitura de combinação/natureza incluída de propósito, por ser a mais universalmente aceita entre escolas. **As demais combinações desta tabela (2-5, 2-3, 5-9, etc.) NÃO estão implementadas** — decisão deliberada, documentada no cabeçalho do arquivo, por ser exatamente a área de maior variação entre autores/escolas. Implementar exigiria decidir uma fonte de referência única e aceitar o risco de divergência que este próprio documento adverte na Parte IV.

### Estrelas anuais e mensais (紫白 Zi Bai)

**Estrela anual (século XXI):**
```
soma = reduzir_a_um_digito(ano)
estrela_anual = 11 − soma   (se > 9, −9)
```
Verificação: 2024 → 8 → 3 ✔ | 2025 → 9 → 2 ✔ | 2026 → 1 → 10 → **1** ✔ | 2027 → 2 → 9 ✔
(Para o século XX a constante é 10 em vez de 11.)

A estrela anual vai ao centro e voa **sempre para frente**.

> ✅ **Fórmula conferida e consistente** — ao contrário da fórmula de Ming Gua acima, esta usa a soma de todos os dígitos do ano (não dos últimos dois), e a conferi de forma independente pela propriedade "a estrela anual decresce 1 a cada ano, com wrap 9→1" — as quatro verificações do próprio documento (2024→3, 2025→2, 2026→1, 2027→9) são mutuamente consistentes com essa propriedade. Diferente da Ming Gua, aqui a fórmula do ano completo parece correta — são convenções de sub-sistemas distintos, não uma inconsistência do documento. ⚪ **Não implementado no código** — `estrelas-voadoras.ts` hoje só calcula a carta natal (período), não a estrela anual/mensal.

**Estrela mensal:** depende do ramo terrestre do ano solar:
| Grupo do ramo do ano | Estrela do 1º mês (Yin, ~4/fev) |
|---|---|
| 子 Zi, 午 Wu, 卯 Mao, 酉 You | 8 |
| 辰 Chen, 戌 Xu, 丑 Chou, 未 Wei | 5 |
| 寅 Yin, 申 Shen, 巳 Si, 亥 Hai | 2 |

A cada mês solar seguinte, **decresce 1** (wrap 1→9), e voa para frente a partir do centro. Meses solares delimitados pelos Jie Qi, não pelo calendário civil.

**Aflições anuais** (recalcular a cada Li Chun):
- **太歲 Tai Sui** (Grão-Duque): setor do ramo do ano. Não se deve "atacar" (obra, escavação, demolição) esse setor, nem sentar-se de costas para ele. 2026 = ano do Cavalo 午 → Tai Sui ao Sul.
- **歲破 Sui Po**: setor oposto ao Tai Sui (2026: Norte). Evitar obras.
- **三煞 San Sha** (Três Mortes): trio de montanhas oposto ao trio de afinidade do ramo. Não se deve ter as **costas** para o San Sha nem fazer obra ali. Para ano do Cavalo (grupo Fogo Yin-Wu-Xu) → San Sha no **Norte** (Hai-Zi-Chou).
- **五黃 Wu Huang** (5 Amarelo anual): setor onde a estrela anual 5 pousa. Sem obras, sem barulho, sem reformas.

> ⚪ **Nenhuma sobreposição temporal implementada.** Estrelas anuais/mensais, Tai Sui, Sui Po, San Sha e Wu Huang anual são todos escopo novo — nenhum recalcula hoje. Confirma a exclusão já declarada no cabeçalho de `estrelas-voadoras.ts` ("sobreposição temporal" listada como fora de escopo).

### Visualização
- **Grade 3×3** clássica sobre a planta, cada célula com montanha/água/período + anel externo com anual e mensal (o "Fei Xing Pan" completo, 5 números por setor).
- **Roseta de 24 montanhas** sobreposta à planta com o ângulo real — mais precisa que a grade, e obrigatória quando a planta for irregular.
- Alternância entre grade quadrada e setores em pizza (as duas convenções existem; o produto deve oferecer ambas e declarar qual está em uso).
- **Timeline** deslizante: arrastar o ano/mês e ver as estrelas anuais/mensais mudando sobre a carta natal, com alertas surgindo e desaparecendo. Essa é a funcionalidade de maior valor percebido.
- Sobreposição de cômodos: cada cômodo herda a leitura do setor onde está seu centróide, com aviso quando um cômodo cruza dois setores.

> ✅ **A grade 3×3 com 3 números por palácio (Montanha/Período/Fachada) já existe**, tanto na tela do Ba Guá quanto no relatório PDF. ⚪ Anel externo com anual/mensal, roseta de 24 montanhas, e timeline deslizante são escopo novo — a timeline em particular é citada aqui como "funcionalidade de maior valor percebido", vale considerar como próximo passo depois que a camada de estrelas anuais/mensais existir.

### Diagnóstico
Para cada setor: (a) estrutura da carta, (b) combinação montanha+água, (c) interação com anual/mensal, (d) uso real do cômodo, (e) presença de ativadores (porta, água, movimento, fogão, cama).

Regras de agravamento a codificar como invariantes:
- Estrela negativa + **porta** = ativada, severidade sobe um nível.
- Estrela negativa + **água em movimento / máquina / ruído** = ativada, sobe dois níveis.
- 5 Amarelo ou 2 Negro + obra/reforma naquele setor = severidade crítica, recomendação de adiar.
- Estrela positiva sem ativação = potencial não realizado (recomendação, não problema).

### Remediação

| Estrela / condição | Remédio | Evitar |
|---|---|---|
| 5 Amarelo | Metal pesado e quieto (sinos de metal de 6 tubos, objetos metálicos maciços, cor branca/dourada); manter o setor imóvel e silencioso | vermelho, luz forte, fogo, obra, ruído, água |
| 2 Negro | Metal (mesma lógica); cabaça Wu Lou (tradicional); manter arejado e limpo | fogo, terra, cerâmica, cores amarelas/terrosas |
| 3 Jade | Fogo (vermelho, luz, velas) para exaurir a Madeira | água, verde, plantas |
| 7 Vermelha | Água quieta, azul; guardar objetos cortantes | metal, vermelho |
| 9 Púrpura (próspera) | **Ativar**: luz, uso frequente, cores vibrantes, movimento | deixar o setor inutilizado |
| 8 Branca | Ativar com Terra/cristal, uso frequente | — |
| 6 Branca | Ativar com Metal/Terra quando se busca autoridade | — |
| 1 Branca | Ativar com Água/Metal (investimento de longo prazo) | — |
| 上山下水 estrutural | água/vazio no sitting virtual e massa/altura no facing; ou usar entrada alternativa | ignorar |
| Tai Sui / San Sha / Wu Huang anuais | não iniciar obra; se inevitável, seleção de data (Ze Ri) | escavação, demolição, barulho continuado |

**Regras de honestidade que devem ser invariantes do domínio:**
- Nunca recomendar aquário/fonte apenas porque "água traz dinheiro". Água ativa a estrela de água **daquele setor** — se ela for negativa, água piora.
- Nunca recomendar espelho sem verificar o setor e o que ele reflete.
- Todo remédio deve declarar: qual estrela ele trata, por qual ciclo (geração/exaustão), e o que acontece se for aplicado no setor errado.

---

## MÉTODO 4 — San He (三合, Três Harmonias)

Escola de formas + bússola voltada a **paisagem e água**. Historicamente usada em Yin Zhai (sepulturas) e em grandes terrenos. Em Yang Zhai urbano, é usada sobretudo para a análise de **entrada e saída de água** e de dragões de montanha.

### Entradas
Topografia, direção de fluxo de água (rios, canais, ruas — rua funciona como "água virtual"), ponto de saída de água visível do imóvel, direção do dragão de montanha.

### Cálculo

**Os três anéis do Luo Pan San He:**
- 地盤 **Di Pan** (agulha correta, 正針): as 24 montanhas na posição padrão. Usado para sitting/facing.
- 人盤 **Ren Pan** (agulha central, 中針): deslocado **7,5° no sentido anti-horário**. Usado para avaliar montanhas, edifícios e "areia" (sha).
- 天盤 **Tian Pan** (agulha costurada, 縫針): deslocado **7,5° no sentido horário**. Usado para medir **água** — entrada e saída.

Implementação: são apenas três offsets sobre o mesmo anel de 24 montanhas. Um único componente com parâmetro `offset: -7.5 | 0 | +7.5`.

**Trigos de afinidade (三合局):**
| Combinação | Elemento | Nascimento (長生) | Auge (帝旺) | Tumba (墓庫) |
|---|---|---|---|---|
| 申 Shen – 子 Zi – 辰 Chen | Água | Shen (SO) | Zi (N) | Chen (SE) |
| 寅 Yin – 午 Wu – 戌 Xu | Fogo | Yin (NE) | Wu (S) | Xu (NO) |
| 巳 Si – 酉 You – 丑 Chou | Metal | Si (SE) | You (O) | Chou (NE) |
| 亥 Hai – 卯 Mao – 未 Wei | Madeira | Hai (NO) | Mao (E) | Wei (SO) |

**Os 12 estágios do ciclo de vida (十二長生):** 長生 nascimento → 沐浴 banho → 冠帶 coroação → 臨官 posse → 帝旺 auge → 衰 declínio → 病 doença → 死 morte → 墓 tumba → 絕 extinção → 胎 concepção → 養 nutrição. Percorridos em ordem a partir do 長生 do elemento do local, no sentido horário (yang) ou anti-horário (yin).

**Regra fundamental de água (水法):** a água deve **entrar** por uma direção de estágio favorável (長生, 帝旺, 臨官) e **sair** (水口, boca de água) por uma direção de estágio de fechamento (墓 tumba). Água entrando pela "morte" ou saindo pela "prosperidade" = perda de riqueza.

> 🟡 **Não implementado; tabelas não verificadas de forma independente.** San He não tem sobreposição com nenhum código existente hoje. As correspondências de trigo/elemento/estágio desta seção (tabela de 4 combinações e os 12 estágios) são um nível de detalhe onde não tenho confiança suficiente para validar de cabeça com o mesmo rigor que apliquei às seções 1.2–1.3 e ao Método 3 — recomendo checagem por um consultor San He antes de virar código, especialmente a atribuição de qual trigrama/ramo cai em qual das 12 posições do ciclo de vida.

### Visualização
- Anel triplo (Di/Ren/Tian) girando sobre a planta/satélite, com toggle de qual anel está ativo.
- Vetores de fluxo de água desenhados sobre a imagem de satélite, com marcação do ponto de saída.
- Diagrama circular do ciclo de 12 estágios projetado sobre as 24 montanhas.

### Diagnóstico
Classificação da configuração de água (auspiciosa / neutra / destrutiva), qualidade do "dragão" (relevo atrás), qualidade da "areia" (proteção lateral), e do Ming Tang.

### Remediação
Predominantemente **paisagística**: redirecionar drenagem, posicionar espelho d'água ou piscina no setor correto, plantar barreira vegetal para simular montanha, criar berma/talude, reposicionar portão de entrada da propriedade para captar a direção de água correta. Em apartamento urbano, San He entra sobretudo como leitura de vias e não gera remédio próprio — o produto deve dizer isso em vez de forçar recomendações.

---

## MÉTODO 5 — Xuan Kong Da Gua (玄空大卦, 64 Hexagramas)

O método mais preciso e mais técnico. Divide o círculo em **64 hexagramas de 5,625°** (subdivididos em 384 linhas de ~0,9375°). Usado para portas, saídas de água, orientação de sepulturas e seleção de datas.

### Entradas
Graus com precisão de **décimo de grau** — este método é inviável com bússola de celular. O produto deve exigir entrada manual de leitura de Luo Pan e recusar leituras com `confidence != high`.

### Cálculo
1. Mapear grau → hexagrama (64 setores de 5,625°, na sequência do arranjo circular de Fu Xi / Céu Anterior).
2. Cada hexagrama tem um **número He Tu** e um **número de época (元運)**.
3. Regras principais:
   - **合十 He Shi (soma 10):** hexagrama do facing + hexagrama da porta/água somam 10 → harmonia.
   - **合十五 (soma 15)** e **合生成 (soma He Tu: 1-6, 2-7, 3-8, 4-9, 5-10)** — combinações válidas.
   - **父母三般卦** (cordão dos pais) — a combinação mais forte.
   - **出卦 Chu Gua (fora do gua):** a orientação cruza a fronteira de um grupo de hexagramas → energia dispersa. Deve ser evitado.
4. O hexagrama corrente do período determina quais posições são prósperas.

> 🟡 **Não implementado; nível de detalhe fora da minha capacidade de verificação independente.** A tabela completa dos 64 hexagramas com número He Tu e mapeamento de grau é um dado extenso e altamente técnico que eu não tenho como conferir com confiança sem uma fonte primária estruturada (ex.: uma tabela publicada de referência). **Recomendação explícita:** não implementar Da Gua a partir de memória/recall de um LLM (nem o meu, nem de outro) — esta é exatamente a classe de conteúdo onde um erro é caro e difícil de detectar, e onde a "Regra de ouro" da Parte IV deste próprio documento (força da evidência declarada) deveria se aplicar com o nível mais alto de exigência: buscar uma tabela de referência publicada e auditável antes de codificar.

### Visualização
Anel de 64 hexagramas de alta resolução, com zoom, cada setor rotulado com nome, número He Tu e período. Sobreposto ao mesmo canvas de planta usado nos demais métodos.

### Diagnóstico
Aplicado a poucos pontos (porta principal, portão, saída de água, cabeceira). Não é um método de setorização de cômodos.

### Remediação
Ajuste angular físico: reposicionar a porta ou o portão em alguns graus, mudar o eixo de abertura, reposicionar a saída de drenagem. Se a estrutura não pode ser alterada, o método essencialmente diz "não é remediável" — e o produto deve ter a coragem de exibir isso em vez de sugerir um cristal.

---

## MÉTODO 6 — Xuan Kong Liu Fa (玄空六法, Seis Métodos)

Escola San Yuan alternativa às Estrelas Voadoras. Seis camadas:

1. **玄空 Xuan Kong** — Zheng Shen (正神, direção prosperante do período, que quer **montanha/solidez**) e Ling Shen (零神, direção oposta, que quer **água/vazio**). No **Período 9**: Zheng Shen = **Sul (Li)**; Ling Shen = **Norte (Kan)**. Ou seja, no período atual, água ao Norte e solidez ao Sul. Regra simples e de altíssimo valor prático.
2. **雌雄 Ci Xiong** — casamento de opostos no He Tu.
3. **金龍 Jin Long** (Dragão Dourado) — determina se a água está "viva" ou "morta" em função do período.
4. **挨星 Ai Xing** — atribuição de estrelas, diferente da do Fei Xing.
5. **城門 Cheng Men** (Porta da Cidade) — uma direção secundária, adjacente ao facing, capaz de "abrir" o Qi próspero quando há água/abertura ali. Excelente remédio para cartas 上山下水.
6. **太歲 Tai Sui** — camada temporal anual.

**Uso recomendado no produto:** implementar Liu Fa como **camada complementar**, não como método principal. O maior valor é Zheng Shen/Ling Shen e Cheng Men, que geram recomendações objetivas e simples e frequentemente resolvem cartas ruins de Fei Xing.

> ✅ **Zheng Shen/Ling Shen do Período 9 conferido, de graça, pela minha própria tabela.** "Zheng Shen = Sul, Ling Shen = Norte no Período 9" é exatamente Sul=trigrama Li=número 9 (a estrela do período em si) e Norte=trigrama Kan=número 1 (o oposto) — consistente com a grade do Período 9 que se obtém aplicando a mesma fórmula já testada em `estrelas-voadoras.ts` (basta trocar o período de 8 para 9 no teste existente). Não é coincidência: Zheng Shen é, por definição, a direção onde a estrela do período corrente pousa. ⚪ Nenhuma das 6 camadas está implementada — é escopo novo, mas a nota acima mostra que a camada 1 (a de "maior valor prático" segundo o próprio documento) é praticamente gratuita de derivar a partir do que já existe.

---

## MÉTODO 7 — BaZi do morador (八字, Quatro Pilares)

Não é Feng Shui, é astrologia — mas é a camada que **personaliza** os remédios. Sem ela, o produto recomenda o mesmo aquário para todo mundo.

### Cálculo
Converter data/hora/local de nascimento em quatro pares Tronco Celeste + Ramo Terrestre (ano, mês, dia, hora), usando ano e mês **solares** e hora local verdadeira (corrigir por longitude e horário de verão histórico — no Brasil, isso é uma armadilha real: o DST brasileiro mudou muitas vezes e foi extinto em 2019).

Derivar:
- **日主 Ri Zhu / Day Master** — o tronco do dia, que representa a pessoa.
- Força do Day Master (forte/fraco) pela estação e pelo suporte dos demais pilares.
- **用神 Yong Shen** — elemento favorável.
- **忌神 Ji Shen** — elemento desfavorável.

### Uso no diagnóstico
- Escolher **entre remédios válidos** aquele cujo elemento é favorável ao morador.
- Priorizar quartos e setores cujo elemento apoie o Yong Shen.
- Ajustar paleta de cores e materiais por pessoa.
- Ler os anos difíceis do morador (choque com Tai Sui) e antecipar recomendações.

*Aviso de produto:* BaZi produz afirmações sobre destino pessoal. O produto deve manter linguagem descritiva e não determinista, e nunca fazer afirmações sobre saúde, morte, gravidez ou finanças de forma prescritiva. Isso é tanto uma questão ética quanto de exposição jurídica.

> 🟡 **Não implementado; complexidade real subestimada pela extensão da seção.** BaZi completo (troncos/ramos dos 4 pilares, força do Day Master, Yong Shen/Ji Shen) é, na prática, um sistema tão grande quanto os Métodos 1–3 juntos — a tabela de conversão data→tronco/ramo, a determinação de força do Day Master (que depende de tabelas de suporte sazonal) e a derivação de Yong Shen têm tanto ou mais espaço para erro que Estrelas Voadoras. Recomendo tratá-lo como um projeto próprio (não um "método a mais" na lista), com o mesmo nível de rigor de verificação que apliquei a Estrelas Voadoras antes de codificar qualquer linha — e concordo integralmente com o aviso do próprio documento sobre linguagem não-determinista.

---

## MÉTODO 8 — Ze Ri (擇日, Seleção de Datas)

Usado para instalar remédios, iniciar obra, mudar de casa, inaugurar. Sem seleção de data, um remédio estrutural pode ativar exatamente o que deveria neutralizar.

Camadas mínimas:
- Evitar dias que **choquem** com o ramo do ano do morador (冲, oposição 180°).
- Evitar dias que choquem com o **sitting** do imóvel.
- **12 Oficiais do Dia (建除十二神):** 建 Jian, 除 Chu, 滿 Man, 平 Ping, 定 Ding, 執 Zhi, 破 Po, 危 Wei, 成 Cheng, 收 Shou, 開 Kai, 閉 Bi — cada um favorável a certas atividades. Po (破) e Wei (危) são evitados para quase tudo.
- **28 Constelações (二十八宿)**.
- Evitar 楊公忌日 e dias 四絕/四離 (véspera dos solstícios/equinócios e das mudanças de estação).

Entrega: um calendário com dias verdes/amarelos/vermelhos para uma atividade específica e um imóvel/pessoa específicos.

> 🟡 **Não implementado; depende de um calendário chinês perpétuo (Tong Shu) que este documento não fornece.** Ze Ri não é calculável isoladamente — precisa do calendário sexagenário completo (troncos/ramos do dia, que dependem de uma contagem contínua desde uma data de referência) e dos 12 Oficiais/28 Constelações derivados dele. Escopo real, mas o pré-requisito (motor de calendário chinês) não está descrito aqui e precisaria ser especificado à parte.

---

## MÉTODO 9 — BTB / Bagua ocidental (não-clássico)

Escola do Chapéu Preto (Black Sect Tantric Buddhism), popularizada no Ocidente nos anos 1980. **Não usa bússola.** O mapa Bagua é alinhado à parede da porta principal, com a porta sempre na faixa inferior.

```
Riqueza      | Fama         | Relacionamentos
Família      | Saúde/Centro | Criatividade/Filhos
Conhecimento | Carreira     | Amigos/Viagem
              ↑ parede da porta principal ↑
```

Remédios são simbólicos e intencionais (cores, objetos, afirmações), não elementares-direcionais.

**Posição de produto recomendada:** incluir como método opcional, claramente rotulado como não-clássico, com aviso de que seus resultados **não são comparáveis** aos dos métodos de bússola e que os dois não devem ser combinados numa mesma recomendação. Ele existe porque uma parcela grande do mercado brasileiro o conhece e o procura — mas o valor diferencial do FengShui Studio está no rigor dos métodos clássicos.

> ✅ **Já implementado e é o método original do produto** (`gridOrderBTB` em `src/lib/bagua-grid.ts`, presente desde antes deste ciclo de melhorias). A rotulagem explícita ("BTB" vs. "Bússola") já existe na tela de seleção de metodologia (`METODOLOGIAS` em `src/lib/metodologias.ts`) — a invariante de honestidade que este documento pede na abertura já está estruturalmente garantida pelo desenho do seletor: o consultor escolhe uma escola por vez, nunca as duas ao mesmo tempo.

---

## PARTE IV — Motor de síntese e conflitos

O problema mais difícil do produto não é calcular cada método. É o que fazer quando **dois métodos discordam** — e eles discordam o tempo todo. Sem uma política explícita, o software vira gerador de recomendações contraditórias.

### Hierarquia de precedência (decisão de domínio a registrar em ADR)

1. **Formas (Luan Tou)** — precede tudo. Sha Qi crítico invalida otimizações de compasso.
2. **Xuan Kong Fei Xing** — camada de tempo/espaço principal.
3. **Ba Zhai** — camada de compatibilidade pessoal; resolve empates dentro do que Fei Xing permite.
4. **Liu Fa (Cheng Men / Ling Shen)** — camada de resgate, aplicada quando Fei Xing dá estrutura ruim.
5. **BaZi** — escolhe entre remédios já validados; nunca cria recomendação sozinho.
6. **Da Gua / San He** — aplicados a pontos específicos, não à casa toda.
7. **BTB** — isolado, nunca combinado.

### Regras de conflito
- Se Ba Zhai diz "bom" e Fei Xing diz "5 Amarelo com porta", **Fei Xing vence** e o setor é marcado como perigoso.
- Se dois moradores têm necessidades opostas, o sistema **não** escolhe silenciosamente: apresenta o trade-off, a política aplicada e quem foi priorizado.
- Nenhuma recomendação sai sem: método de origem, força da evidência (clássica consolidada / variante de escola / popular sem consenso), custo estimado e reversibilidade.
- **Invariante de honestidade:** o relatório deve conter uma seção "onde as escolas divergem neste imóvel". Um produto que esconde divergência está mentindo por omissão — e num campo sem falseabilidade experimental, transparência metodológica é o único diferencial defensável.

> ✅ **Esta Parte IV é, na minha avaliação, a contribuição mais valiosa do documento inteiro** — nenhuma parte dela está implementada hoje (o produto atual não tem noção de "hierarquia entre métodos" porque só uma metodologia de grid roda por vez), mas é exatamente a peça que falta para os métodos aditivos (Oito Mansões, Estrelas Voadoras) crescerem sem virar um gerador de conselhos contraditórios. Recomendo que a "força da evidência" (`evidenceStrength` no modelo de dados abaixo) seja obrigatória desde o primeiro remédio codificado, não adicionada depois — é mais barato nascer com o campo do que migrar dados depois.

### Taxonomia de remédios (modelo de dados)

```ts
type Remedy = {
  id: string;
  method: FengShuiMethod;           // qual escola gerou
  targetSector: Sector;
  targetIssue: DiagnosisFinding;
  mechanism: 'layout' | 'element' | 'form-blocking' | 'activation' | 'behavioral' | 'timing';
  wuXingAction: 'generate' | 'exhaust' | 'control' | 'none';
  cost: 'zero' | 'low' | 'medium' | 'high' | 'structural';
  reversibility: 'instant' | 'easy' | 'hard' | 'permanent';
  evidenceStrength: 'classical-consensus' | 'school-variant' | 'popular-tradition';
  contraindications: string[];      // "não aplicar se o setor tiver estrela 9"
  requiresDateSelection: boolean;
  personalizedFor?: OccupantId;     // via BaZi
};
```

Ordenação padrão das recomendações: **custo zero e reversível primeiro**. Reposicionar uma cama antes de vender um cristal. Isso protege a credibilidade do produto e a do consultor.

> ⚪ **Compatível com o motor já existente, mas não integrado.** `src/lib/recomendacoes.ts` (o motor único de recomendação do app, usado por tela/detalhe/PDF) hoje gera texto livre por bloco (urgente/melhoria/manutenção), sem esta estrutura de dados tipada. Migrar para algo próximo de `Remedy` seria uma refatoração de valor real quando houver 2+ métodos aditivos gerando recomendações conflitantes de verdade (hoje só Cinco Elementos e cômodo×setor alimentam o motor — nenhum conflito real surgiu ainda porque não há uma segunda fonte de "remédio" concorrente).

---

## PARTE V — Checklist de dados de entrada (o que o app precisa perguntar)

**Imóvel**
- Endereço / coordenadas
- Tipo (casa, apartamento, sala comercial, terreno)
- Ano de construção; ano da última reforma estrutural
- Facing em graus + modo de captura + referência (magnético/verdadeiro)
- Planta baixa (imagem, PDF ou desenho no app)
- Pavimentos; pavimento da unidade
- Área construída, número de cômodos e uso de cada um

**Elementos internos posicionados** (coordenada + direção quando aplicável)
- Porta principal e portas secundárias, janelas grandes
- Cama de cada quarto (posição + direção da cabeceira)
- Fogão (posição + direção da boca)
- Pia, banheiros, ralos principais
- Mesa de trabalho e cadeira
- Aquário, fonte, piscina
- Escada, vigas expostas, pilares

**Moradores**
- Data (e hora, se possível) de nascimento, sexo, papel na casa
- Quem sustenta financeiramente, quem tem questão de saúde ativa
- Quarto de cada um; horas por dia em cada ambiente

**Entorno**
- Fotos das 4 faces; imagem de satélite
- Vias, água, relevo, edifícios altos, torres, transformadores
- Uso do solo vizinho

**Objetivos do cliente**
- Prioridade (saúde, renda, relacionamento, estudos, carreira, sono)
- Orçamento e disposição a fazer obra
- Restrições (aluguel, condomínio, tombamento, animais, crianças)

Esse último bloco é o que transforma um relatório genérico em consultoria. O motor de priorização de remédios deve ser ponderado pelo objetivo declarado.

> ✅/⚪ **Já capturado hoje:** endereço não, tipo de imóvel sim (`tipo_imovel`), ano de construção sim (`bagua_entrada.data_construcao`, PR #90), facing em graus sim (`orientacao_graus`, sem referência magnético/verdadeiro), planta baixa sim, área construída sim, moradores (data de nascimento + gênero do cliente) sim (PR #84), objetivo do cliente não. **Não capturado:** coordenadas/endereço estruturado, pavimentos, posição de cama/fogão/mesa/aquário (o app marca falta/excesso geométrico mas não mobiliário específico), fotos do entorno por direção, uso do solo vizinho, orçamento/restrições, prioridade declarada do cliente. O checklist deste documento é um bom roteiro para o formulário de nova consulta evoluir.

---

## Anexo — Estado de Implementação (resumo)

| Parte/Método | Estado |
|---|---|
| 1.1 Wu Xing (5 movimentos, 3 ciclos) | ✅ Implementado — `src/lib/cinco-elementos.ts` (os 3 ciclos: Geração, Controle e, desde o shared kernel P0, Exaustão/`elementoQueExaure`) |
| 1.2 Bagua/trigramas, Lo Shu (direção→número) | ✅ Implementado — `oito-mansoes.ts`, `estrelas-voadoras.ts`, e agora também como value object dedicado em `src/lib/trigramas.ts` (shared kernel P0, ADR 0007) |
| 1.3 Trajetória de voo Lo Shu | ✅ Implementado e testado contra carta publicada — canonicamente em `src/lib/lo-shu.ts` (shared kernel P0), reaproveitado por `estrelas-voadoras.ts` |
| 1.4 24 Montanhas / Kong Wang | 🟡 Tabela de montanhas (faixa/setor/Yuan Long/polaridade) implementada em `src/lib/montanhas.ts` (shared kernel P0); Kong Wang **não** implementado — segue pendente de verificação de fonte primária |
| 1.5 Períodos San Yuan | ✅ Implementado como fórmula cíclica — canonicamente em `src/lib/periodo-sanyuan.ts` (shared kernel P0), `estrelas-voadoras.ts` reexporta `periodoDaConstrucao` |
| 1.6 Ano solar / Li Chun | 🟡 Implementado com aproximação (4/fev fixo), agora consolidado numa única fonte (`src/lib/data-solar.ts`, shared kernel P0) em vez de duplicado; precisão real (efeméride) pendente — ver ADR 0007 |
| 1.7 Tai Ji / centróide / regra do terço | 🟡 App usa bounding box, não centróide; regra do terço não implementada |
| 2.1–2.5 Captura de orientação | 🟡 Modo A agora aceita grau decimal, mostra a Montanha das 24 ao vivo (`montanhas.ts`) e tem o assistente de 3 leituras com média/desvio circular (`graus.ts`) em `app/bagua-planta/page.tsx`. Ainda faltam: referência magnético/verdadeiro (declinação WMM/IGRF), detecção de Kong Wang (pendente de fonte primária), Modo B (bússola virtual), Modo C (mapa) e o questionário de facing |
| Método 1 — Formas | 🟡 Sha interno em boa parte coberto pelo checklist Fluxo de Chi; Sha externo e classificação por escala não |
| Método 2 — Ba Zhai (Oito Mansões) | ✅ Kua da casa + compatibilidade implementados; **fórmula de Ming Gua corrigida nesta revisão**; posicionamento de mobiliário não implementado |
| Método 3 — Estrelas Voadoras | ✅ Carta natal base implementada e testada, com simplificação documentada (par/ímpar em vez de Yuan Long completo); Ti Gua, estruturas da carta, combinações além da Estrela 5, e camada anual/mensal não implementados |
| Método 4 — San He | ⚪ Não implementado; tabelas não verificadas de forma independente |
| Método 5 — Xuan Kong Da Gua | ⚪ Não implementado; recomendação explícita de não codificar de memória, buscar fonte publicada |
| Método 6 — Liu Fa | ⚪ Não implementado; Zheng Shen/Ling Shen do Período 9 conferido e é de baixo custo para implementar primeiro |
| Método 7 — BaZi | ⚪ Não implementado; recomendo tratar como projeto próprio, não item de lista |
| Método 8 — Ze Ri | ⚪ Não implementado; depende de motor de calendário chinês não especificado aqui |
| Método 9 — BTB | ✅ Implementado — é o método original do produto |
| Parte IV — Síntese/conflitos | ⚪ Não implementado; maior valor do documento, ainda sem uso real porque só há uma fonte de remédio hoje |
| Parte V — Checklist de entrada | 🟡 Parcialmente capturado; ver detalhamento acima |
