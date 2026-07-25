# FengShui Studio — Prompts de Implementação por Módulo

Prompts para Claude Code, um por bounded context. Todos assumem as regras da skill `collabz-craftsmanship` (R1–R16). Ordem de execução recomendada: **P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9**.

Convenções aplicadas em todos:
- Stack: Next.js (App Router) + TypeScript + Supabase (RLS obrigatório) + Vercel.
- Estrutura `apps/web/` + `packages/<context>-domain|application|infrastructure/`.
- Domínio **sem framework**. Nada de `@supabase/*` ou `next` em `*-domain`.
- Ubiquitous language: termos clássicos em **pinyin** (`ShengQi`, `XuanKongChart`, `MingGua`, `SanSha`), nunca traduzidos para genérico. Rótulos em pt/en/es ficam na camada de i18n, jamais no domínio.
- Toda decisão arquitetural → ADR em `docs/architecture/adr/`.
- `Result<T, E>`, sem `null` como erro. Sem números mágicos.

---

## P0 — Bootstrap e Shared Kernel

```
Crie o bootstrap do FengShui Studio seguindo a skill collabz-craftsmanship.

CONTEXTO
Produto SaaS de consultoria de Feng Shui que implementa métodos clássicos chineses
(Luan Tou, Ba Zhai, Xuan Kong Fei Xing, San He, Xuan Kong Da Gua, Liu Fa) e um método
não-clássico (BTB), com cálculo, visualização sobre planta baixa, diagnóstico e
catálogo de remediações. Multi-tenant: consultores atendem múltiplos clientes.

ESCOPO DESTE PROMPT
Apenas estrutura + shared kernel. Nenhum método ainda.

ENTREGÁVEIS
1. Estrutura Next.js standalone conforme R15, com packages/ para os domínios.
2. packages/fengshui-shared-kernel com value objects imutáveis e testados:
   - Degrees        — 0–360 exclusivo, normalização, distância circular, média circular
                      via atan2(Σsinθ, Σcosθ). NUNCA média aritmética.
   - Mountain        — as 24 montanhas com faixa, setor, YuanLong e polaridade Yin/Yang
                      (tabela em fengshui-metodos-referencia.md §1.4)
   - Sector          — N, NE, E, SE, S, SW, W, NW, CENTER
   - Trigram         — 8 trigramas com codificação de bits (inferior→superior),
                       número Lo Shu, elemento, direção, membro da família
   - WuXing          — 5 elementos + ciclos generate/control/exhaust como funções puras
   - LoShuGrid       — grade de 9 setores + trajetória de voo
                       ['C','NW','W','NE','S','N','SW','E','SE'] com flyForward/flyReverse
   - Period          — 1..9 com intervalos de datas; periodOf(date); currentPeriod()
   - SolarDate       — ano/mês solar chinês (Li Chun e Jie Qi), NUNCA ano civil
3. packages/fengshui-shared-kernel/calendar: efemérides de Li Chun e dos 24 Jie Qi
   com precisão de minuto, de 1900 a 2100. Nada de aproximar por "4 de fevereiro".
   Escolha entre tabela pré-computada versionada ou biblioteca astronômica e registre
   a decisão em ADR (precisão vs. tamanho de bundle).
4. Schema Supabase inicial: tenants, users, clients, properties, occupants, analyses.
   RLS habilitada em todas, isolamento por tenant_id. Migrations numeradas.
5. docs/domain/glossary.md com todos os termos pinyin, caractere chinês, tradução
   pt/en/es e definição operacional.
6. ADR 0001 (bootstrap), 0002 (calendário solar), 0003 (multi-tenant + RLS).

REGRAS
- Value objects imutáveis, validados no construtor, com testes de propriedade para
  aritmética circular (359° + 2° = 1°).
- Zero dependência de framework em packages/*-domain.
- Nenhum literal mágico: 15°, 45°, 7.5°, 337.5° viram constantes nomeadas.

NÃO FAÇA
Não implemente nenhum método de Feng Shui neste prompt. Não crie utils.ts.
```

---

## P1 — Motor de Orientação (bússola, GPS e mapa)

Este é o módulo de maior risco técnico e o que o usuário mais percebe. Faça-o como tracer bullet completo antes de qualquer método.

```
Implemente o bounded context Orientation do FengShui Studio.

OBJETIVO
Capturar a orientação (facing/sitting) de um imóvel por três modos independentes,
produzindo sempre o mesmo objeto de domínio com nível de confiança explícito.

DOMÍNIO (packages/orientation-domain)
type OrientationReading = {
  facingDegrees: Degrees;
  reference: 'magnetic' | 'true';
  declination: Degrees | null;
  source: 'manual' | 'device-compass' | 'map-alignment';
  confidence: 'high' | 'medium' | 'low';
  samples?: Degrees[];
  spreadDegrees?: number;
  capturedAt: Date;
  warnings: OrientationWarning[];
}
- sitting = facing + 180° sempre (invariante, não campo editável).
- toMountain(): Mountain — deriva a montanha das 24.
- Detecção de Kong Wang: DA_KONG_WANG em 45/135/225/315 e XIAO_KONG_WANG nas demais
  fronteiras de montanha, tolerância ±1.5°. Se detectado, a leitura NÃO pode gerar carta:
  retorne Result.err(KongWangError) com a instrução de repetir a medição.
- Detecção de borda para Ti Gua: se a leitura estiver a ≤3° de uma fronteira, marque
  a flag requiresReplacementStar.

MODO A — MANUAL (implementar primeiro; é o fallback de tudo)
- Input numérico 0–360 com 1 decimal + seletor magnetic/true.
- Assistente de 3 leituras: média circular, spread, alerta se spread > 3°.
- Preview em tempo real: montanha, setor, YuanLong, status Kong Wang.

MODO B — BÚSSOLA VIRTUAL
- DeviceOrientationEvent; iOS exige requestPermission() a partir de gesto do usuário.
  Trate o caso de permissão negada e de dispositivo sem magnetômetro degradando
  para o Modo A com mensagem clara, nunca com tela quebrada.
- Fluxo de calibração obrigatório (figura-8) antes de habilitar a captura.
- Amostragem: ~50 leituras em 5s, descarte de outliers por MAD, média circular.
  spread ≤2° → high | 2–5° → medium com aviso | >5° → low e BLOQUEIA a geração de carta.
- Se a API expuser magnitude de campo, alerte quando fora de 22–45 µT (interferência).
- A UI deve declarar que é aproximação e recomendar Luo Pan físico para trabalho
  profissional. Isso é requisito, não copy opcional.

MODO C — ALINHAMENTO SOBRE MAPA/SATÉLITE
- Mapa satélite (avalie MapLibre + provedor de tiles; registre a escolha em ADR
  considerando custo por tile e termos de uso — este é o item de maior risco de custo).
- Upload de planta (PNG/JPG/PDF) OU desenho do polígono direto sobre o satélite.
- Camada da planta com mover / escalar por pinça / rotacionar / opacidade.
- Derivar facing: rotação aplicada + norte da projeção (Web Mercator → norte da tela é
  norte verdadeiro) → converter para magnético via WMM com lat/long e data.
- Passo explícito "marque qual aresta é a fachada".
- Se o resultado ficar a <3° de uma fronteira, exija confirmação por outro modo.

DECLINAÇÃO MAGNÉTICA
- Implemente WMM (ou IGRF) como serviço em orientation-infrastructure.
- Toggle "usar norte magnético (padrão clássico)", LIGADO por padrão.
- Mostre sempre os dois valores e a declinação usada. No Brasil a variação é de ~-8° a
  ~-23°, o que muda de 1 a 2 montanhas — nunca esconda essa conversão do usuário.

DETERMINAÇÃO DE FACING (questionário)
Implemente um assistente que pontua candidatos a fachada com estes critérios,
em ordem de peso: lado mais Yang (movimento/luz/ruído/vista aberta) > fachada
arquitetônica > face voltada para água ou vazio > porta principal (último critério).
Quando os dois melhores candidatos ficarem a menos de 15% de score um do outro,
apresente AS DUAS hipóteses e permita gerar as duas cartas em paralelo.
Nunca escolha silenciosamente.

UI
Rosa dos ventos com anel das 24 montanhas girando, montanha corrente destacada,
faixas de Kong Wang em vermelho, badge de confiança sempre visível.

TESTES
- Aritmética circular nas bordas (0/360, 337.5, 352.5).
- Média circular com amostras cruzando 0°.
- Cada uma das 24 montanhas nos limites inferior, central e superior.
- Kong Wang em todas as 24 fronteiras.
- Conversão magnético↔verdadeiro com declinação positiva e negativa.
```

---

## P2 — Motor de Planta Baixa e Tai Ji

```
Implemente o bounded context FloorPlan do FengShui Studio.

OBJETIVO
Transformar uma planta baixa em um polígono georreferenciado e orientado, com centro
(Tai Ji) calculado, setores sobrepostos e elementos internos posicionados.

FUNCIONALIDADES
1. Entrada da planta: upload de imagem/PDF com traçado assistido do perímetro, OU
   desenho direto de polígono, OU importação de DXF (avalie e registre em ADR).
2. Definição de escala por referência conhecida (uma parede medida pelo usuário).
3. Tai Ji: centróide geométrico do POLÍGONO (não do bounding box). Trate polígonos
   côncavos: se o centróide cair fora da área construída, marque como achado
   diagnóstico CENTROID_OUTSIDE.
4. Detecção de setores ausentes e extensões pela regra do terço:
   falta ≥ 1/3 do lado → MISSING_SECTOR (que gua);
   projeção ≤ 1/3 do lado → EXTENSION.
   Retorne quais trigramas foram afetados.
5. Sobreposição de grids, todos ancorados no Tai Ji e girados pelo facing:
   - grade 3×3 Lo Shu
   - pizza de 8 setores de 45°
   - pizza de 24 montanhas de 15°
   - pizza de 64 hexagramas de 5,625° (para Da Gua)
   Toggle entre grade quadrada e pizza — as duas convenções existem na prática e o
   sistema deve declarar na UI qual está em uso.
6. Cômodos: polígonos filhos com uso (quarto, cozinha, banheiro, sala, escritório...).
   Cada cômodo herda o setor do seu centróide. Se cruzar dois ou mais setores, emita
   ROOM_SPANS_SECTORS e mostre a proporção de área em cada um. Não escolha um só.
7. Elementos posicionados com coordenada e, quando aplicável, direção:
   porta principal, portas secundárias, janelas, cama (direção da cabeceira),
   fogão (direção da boca), pia, banheiro, ralo, mesa+cadeira, escada, viga, pilar,
   aquário, fonte, espelho.
8. Multi-pavimento: cada pavimento tem seu Tai Ji; a orientação é do edifício.
   Para apartamento, ofereça as duas escolas (orientação do prédio vs. da unidade),
   registre a escolha como premissa da análise e imprima essa premissa no relatório.

MODELO
Renderize em canvas vetorial (SVG ou Canvas 2D) com transformações compostas.
Guarde o polígono em coordenadas locais + a transformação (origem, escala, rotação),
nunca em pixels da imagem.

TESTES
Polígono em L, U, T e cruz; polígono com furo (pátio interno); polígono girado 37°;
cômodo exatamente na fronteira entre dois setores.
```

---

## P3 — Escola das Formas (Luan Tou)

```
Implemente o bounded context LuanTou (Escola das Formas) do FengShui Studio.

PRECEDÊNCIA
Este método precede todos os outros. Se o score de Formas for crítico, o relatório
final deve exibir isso ANTES de qualquer análise de compasso. Codifique isso como
invariante do motor de síntese, não como convenção de UI.

AVALIAÇÃO EM 4 ESCALAS
Macro (1–5 km) | Meso (100–500 m) | Micro (<50 m) | Interna
Cada escala tem seu próprio checklist ponderado. Micro e Interna têm peso maior:
são o que o morador consegue mudar.

QUATRO ANIMAIS CELESTIAIS (referenciados ao facing)
XuanWu (atrás, deve ser alto e sólido) | ZhuQue (frente, deve ser aberto — MingTang)
QingLong (esquerda vista de dentro, levemente mais alto) | BaiHu (direita, mais baixo)
Avalie altura relativa e solidez de cada um; gere achados quando o padrão se inverte
(ex.: BaiHu dominando QingLong → conflito, litígio, acidentes).

CATÁLOGO DE SHA QI (externo)
Implemente como entidades com detecção parcialmente automática a partir do satélite
e do polígono: ChuanXinSha (via em T/Y na fachada), TianZhanSha (fresta entre prédios),
JianJiaoSha (quina apontando), FanGongSha (arco reverso de via/rio), LianDaoSha
(viaduto em foice), YaSha (edifício esmagando), GuFengSha (isolamento), BaiHuSha,
ShengSha (ruído), WeiSha (odor), GuangSha (reflexo), eletromagnético (torre,
transformador, alta tensão), YinSha (cemitério, hospital, funerária, presídio).
Cada um com: origem, vetor, distância, ângulo de incidência, severidade.

CATÁLOGO DE SHA INTERNO
Alinhamento porta-porta/janela (ChuanTangSha), viga sobre cama/mesa/fogão, escada de
frente para a porta, banheiro no Tai Ji, banheiro sobre/junto à cozinha, pés da cama
apontando para a porta, cabeceira sem parede sólida ou contra parede de banheiro,
fogão adjacente à pia sem separação, fogão sob janela, espelho de frente para a cama,
teto inclinado sobre a cama.
Detecte geometricamente a partir do modelo de FloorPlan sempre que possível
(alinhamentos, adjacências, sobreposições verticais entre pavimentos).

DETECÇÃO ASSISTIDA
Sobre a imagem de satélite: detectar vias em T, curvatura de vias (favorável vs.
reversa), corpos d'água, edificações mais altas por sombra, torres.
Use visão computacional apenas como SUGESTÃO com confiança; toda detecção automática
deve ser confirmável ou descartável pelo consultor. Nunca gere achado automático
irrevisável — falso positivo aqui destrói a confiança no laudo.

VISUALIZAÇÃO
Satélite anotado com setas vetoriais de Sha Qi; zonas coloridas dos 4 animais;
mapa de calor de pressão externa por face; planta com marcadores internos e linhas
de fluxo de Qi (rota da porta principal a cada cômodo).

REMEDIAÇÃO — 4 MECANISMOS
block | deflect | absorb | dissolve
Ordene SEMPRE priorizando 'dissolve' (mudar função do cômodo, reposicionar mobiliário,
alterar rota de circulação): custo zero e reversível.
Espelhos Ba Gua, se incluídos, entram como evidenceStrength: 'popular-tradition' e
JAMAIS com recomendação de apontar para imóvel de terceiros.

SAÍDA
Score 0–100 por escala + achados classificados em critical/high/medium/observation,
cada um com tema afetado (saúde, riqueza, relacionamento, carreira, reputação).
```

---

## P4 — Ba Zhai (Oito Mansões)

```
Implemente o bounded context BaZhai do FengShui Studio.

CÁLCULO 1 — GUA DA CASA
Derivado da direção do SITTING. Casa que senta ao Norte = casa Kan.

CÁLCULO 2 — MING GUA (número pessoal)
Use ANO SOLAR (Li Chun), nunca ano civil nem lunar.
  soma = reduzir_a_um_dígito(ano_solar)
  homem 1900–1999: 10 − soma | homem 2000+: 9 − soma
  mulher 1900–1999: soma + 5 | mulher 2000+: soma + 6
  se > 9 subtrai 9; se 0 → 9
  gua 5 → homem usa 2 (Kun), mulher usa 8 (Gen)
Teste obrigatório com nascidos em janeiro (devem cair no ano anterior).

CÁLCULO 3 — AS 8 DIREÇÕES (transformação cumulativa de linhas, 遊年)
Partindo do trigrama base, aplique em sequência, cada passo sobre o resultado anterior:
  MUTATION_SEQUENCE = [superior, média, inferior, média, superior, média, inferior, média]
  OUTCOMES          = [ShengQi, WuGui, YanNian, LiuSha, HuoHai, TianYi, JueMing, FuWei]
Bits do trigrama: 0=inferior, 1=média, 2=superior; 1=yang(inteira), 0=yin(quebrada).
Qian 111 | Dui 110 | Li 101 | Zhen 100 | Xun 011 | Kan 010 | Gen 001 | Kun 000

TESTE DE VERIFICAÇÃO OBRIGATÓRIO (casa Kan, 010):
  SE=ShengQi, NE=WuGui, S=YanNian, NO=LiuSha, O=HuoHai, E=TianYi, SO=JueMing, N=FuWei
Escreva os 8 casos (um por trigrama base) como tabela de teste. Se algum divergir,
o algoritmo está errado — não "ajuste" a tabela esperada.

PESOS
ShengQi +90 | TianYi +80 | YanNian +70 | FuWei +60
HuoHai −60 | LiuSha −70 | WuGui −80 | JueMing −90
Grupos: Leste {Kan 1, Li 9, Zhen 3, Xun 4} | Oeste {Qian 6, Kun 2, Gen 8, Dui 7}

REGRA ESTRUTURAL "SENTAR NO MAL, OLHAR PARA O BEM" (坐凶向吉)
Distinga LOCALIZAÇÃO de DIREÇÃO no modelo — são coisas diferentes e confundi-las é
o erro clássico deste método:
- localização de coisas ruins (banheiro, fogão, depósito) → setores inauspiciosos
- direção para a qual pessoa/objeto se volta → sempre direções auspiciosas
- fogão: corpo em setor ruim, boca apontando para direção boa do chefe da família
  (para fogão elétrico/indução, use a face do painel de controle)
- cama: direção medida pela perpendicular à cabeceira, saindo da cabeça
- mesa: pessoa olha para direção boa, costas contra parede sólida

SCORE
Por morador, 0–100, ponderado por TEMPO DE PERMANÊNCIA no ambiente. Cama pesa mais
que corredor. Peça as horas/dia por ambiente no cadastro do morador.

VISUALIZAÇÃO
Roseta de 8 setores de 45° sobre a planta; camadas empilháveis (uma por morador +
uma da casa) com toggle; matriz de conflito morador × direção; setas de direção
sobre cama, fogão e mesa.

REMEDIAÇÃO
Método de ALOCAÇÃO: quase todos os remédios são de layout e custo zero.
trocar quartos > girar cama > reposicionar mesa > reorientar boca do fogão >
usar porta secundária > reforço elementar (último recurso).

POLÍTICA DE CONFLITO ENTRE MORADORES (obrigatória, não opcional)
Prioridade: (a) quem sustenta financeiramente, (b) quem tem questão de saúde ativa,
(c) idosos e crianças. O relatório DEVE declarar quem foi priorizado e por quê.
Nunca resolver o conflito ignorando silenciosamente um morador.
```

---

## P5 — Xuan Kong Fei Xing (Estrelas Voadoras)

Núcleo do produto. É o prompt mais longo e o que exige mais testes.

```
Implemente o bounded context XuanKongFeiXing do FengShui Studio.

CARTA NATAL (宅運盤) — ALGORITMO
1. Estrela do período (construção ou última reforma estrutural) ao centro.
   REGRA DE DOMÍNIO: é o período da CONSTRUÇÃO, não o atual. Bloqueie o uso do
   período corrente por engano com validação explícita e mensagem clara.
2. Voe o período para frente pela trajetória Lo Shu
   ['C','NW','W','NE','S','N','SW','E','SE'] → gera o DiPan.
3. Estrela de montanha do centro = número do DiPan no setor de SITTING.
   Estrela de água do centro   = número do DiPan no setor de FACING.
4. Direção de voo de cada uma: localize, no setor do trigrama correspondente àquela
   estrela, a montanha de MESMO YuanLong (Terra/Céu/Humano) da montanha original de
   sitting/facing. Se essa montanha for Yang → voo para frente (+1); Yin → reverso (−1).
5. Grade final: 3 números por setor (montanha, água, período).

REGRA DE SUBSTITUIÇÃO (替卦 Ti Gua)
Se o facing estiver a ≤3° de fronteira entre montanhas, aplique a tabela Ti Gua e
gere AS DUAS cartas (normal e substituída), apresentadas lado a lado com explicação.
Não escolha silenciosamente. Mantenha a tabela Ti Gua como dado versionado, não
como código, e cite a fonte no ADR.

ESTRUTURAS DA CARTA (detectar e nomear)
WangShanWangShui (montanha próspera + água próspera) — ótima
ShangShanXiaShui (invertida) — pior caso, exige remédio estrutural
ShuangXingDaoXiang (duplas na frente) — dinheiro sim, saúde/relação não
ShuangXingDaoZuo (duplas atrás) — pessoas sim, dinheiro fraco
HeShi (soma 10 em todos os setores) — excepcional
FuMuSanBanGua (1-4-7 / 2-5-8 / 3-6-9 em todos os setores)
LianZhuSanBanGua (consecutivas: 1-2-3, 4-5-6, 7-8-9)

ESTRELAS ANUAIS E MENSAIS (紫白 Zi Bai)
Anual (séc. XXI): estrela = 11 − reduzir_a_um_dígito(ano); se >9, −9.
  Verificações obrigatórias em teste: 2024→3, 2025→2, 2026→1, 2027→9.
  (Século XX usa constante 10.)
Vai ao centro e voa SEMPRE para frente.
Mensal: estrela do 1º mês solar conforme o ramo do ano —
  Zi/Wu/Mao/You → 8 | Chen/Xu/Chou/Wei → 5 | Yin/Shen/Si/Hai → 2
Decresce 1 a cada mês solar (wrap 1→9); voa para frente. Meses delimitados por Jie Qi.

AFLIÇÕES ANUAIS (recalcular a cada Li Chun)
TaiSui (setor do ramo do ano) | SuiPo (oposto ao TaiSui) |
SanSha (trio oposto ao trio de afinidade do ramo) | WuHuang anual (onde pousa o 5)
Regra: não iniciar obra/escavação/demolição nesses setores; não sentar de costas
para TaiSui nem para SanSha.

NATUREZA DAS ESTRELAS — PERÍODO 9 (2024–2043)
9 Púrpura (Fogo) = PRÓSPERA CORRENTE — ativar
8 Branca (Terra) = recém-passada, ainda benéfica
1 Branca (Água)  = futura próspera
2 Negra, 3 Jade, 4 Verde, 5 Amarelo, 6 Branca, 7 Vermelha = mortas/decadentes
Modele isso como TABELA POR PERÍODO, não hardcoded para o 9. Em 2044 o produto não
pode precisar de deploy para continuar correto.

COMBINAÇÕES A DETECTAR
Negativas: 2-5/5-2 (doença grave), 2-3/3-2 (DouNiuSha, litígio), 5-9/9-5 (Fogo
alimenta desastre — crítica no P9), 9-7/7-9 (incêndio), 3-7/7-3 (roubo, ferimento)
Positivas: 1-4/4-1 (estudos, romance), 6-8, 8-6, 1-6, 8-9, 9-8 (riqueza), 4-9 (criação)

REGRAS DE AGRAVAMENTO (invariantes do domínio, não heurísticas de UI)
- estrela negativa + porta → severidade +1 nível
- estrela negativa + água em movimento / máquina / ruído → +2 níveis
- 5 Amarelo ou 2 Negro + obra naquele setor → CRITICAL, recomendar adiar
- estrela positiva sem ativação → oportunidade não realizada (recomendação, não problema)

VISUALIZAÇÃO
- FeiXingPan completo: 5 números por setor (montanha, água, período, anual, mensal)
- Alternar entre grade 3×3 e pizza de 24 montanhas (obrigatória em planta irregular)
- TIMELINE DESLIZANTE de ano/mês com as camadas anual/mensal mudando sobre a carta
  natal e alertas surgindo e desaparecendo. É a feature de maior valor percebido —
  faça-a fluida, com transição animada e histórico de alertas por período.
- Sobreposição por cômodo, com aviso quando o cômodo cruza setores.

REMEDIAÇÃO (tabela completa em fengshui-metodos-referencia.md, Método 3)
Princípio: para estrelas negativas use EXAUSTÃO, não controle.
5 Amarelo e 2 Negro → Metal pesado e quieto; setor imóvel e silencioso; sem vermelho,
fogo, obra ou ruído.  3 Jade → Fogo.  7 Vermelha → Água quieta.
9 e 8 → ATIVAR (luz, uso, movimento).

INVARIANTES DE HONESTIDADE (implementar como regras testáveis do domínio)
- Proibido recomendar aquário/fonte por "água traz dinheiro". Água ativa a estrela de
  água DAQUELE setor; se ela for negativa, água piora. O motor deve recusar a
  recomendação e registrar o motivo.
- Proibido recomendar espelho sem avaliar setor e reflexo.
- Todo remédio carrega: qual estrela trata, por qual ciclo WuXing, e o efeito adverso
  se aplicado no setor errado.

TESTES
Cartas conhecidas de referência para cada período × cada uma das 24 montanhas de
facing (216 casos). Gere a matriz completa e congele como golden test. Qualquer
refactor futuro que altere uma célula é regressão até prova em contrário.
```

---

## P6 — San He, Da Gua e Liu Fa (métodos complementares)

```
Implemente os bounded contexts SanHe, XuanKongDaGua e XuanKongLiuFa.
Escopo menor e deliberadamente contido: são camadas complementares, não substituem
o Fei Xing. Não invente recomendações onde o método não tem o que dizer.

SAN HE
- Três anéis como UM componente parametrizado por offset:
  DiPan (0°, sitting/facing) | RenPan (−7,5°, montanhas e edificações) |
  TianPan (+7,5°, ÁGUA — entrada e saída)
- Trigos de afinidade: Shen-Zi-Chen (Água), Yin-Wu-Xu (Fogo), Si-You-Chou (Metal),
  Hai-Mao-Wei (Madeira), com ChangSheng / DiWang / MuKu de cada.
- 12 estágios do ciclo de vida percorridos a partir do ChangSheng do elemento local,
  horário para yang, anti-horário para yin.
- Regra de água: entrada por ChangSheng/DiWang/LinGuan; saída (ShuiKou) por Mu (tumba).
  Entrada pela "morte" ou saída pela prosperidade = perda de riqueza.
- Em contexto urbano de apartamento, San He frequentemente NÃO gera remédio próprio.
  Nesse caso o módulo deve dizer isso explicitamente em vez de forçar recomendação.

XUAN KONG DA GUA
- 64 hexagramas de 5,625° (384 linhas de ~0,9375°), arranjo circular Fu Xi.
- EXIJA precisão de décimo de grau: recuse leituras com confidence != 'high'.
  Bússola de celular é insuficiente para este método — bloqueie e explique.
- Regras: HeShi (soma 10), soma 15, HeTu (1-6, 2-7, 3-8, 4-9, 5-10),
  FuMuSanBanGua, e detecção de ChuGua (fora do gua) como condição a evitar.
- Aplicado a POUCOS pontos: porta principal, portão, saída de água, cabeceira.
  Não é método de setorização de cômodos — não gere leitura por cômodo.
- Remediação é angular e física (reposicionar porta/portão/drenagem). Se a estrutura
  não pode mudar, o módulo deve dizer "não remediável por este método" em vez de
  sugerir um objeto decorativo.

XUAN KONG LIU FA
Implemente apenas as duas camadas de maior valor prático:
- ZhengShen / LingShen por período. No Período 9: ZhengShen = Sul (quer solidez),
  LingShen = Norte (quer água/vazio). Tabela por período, não hardcoded.
- ChengMen (Porta da Cidade): direção secundária adjacente ao facing que, com água ou
  abertura, "abre" o Qi próspero. É o principal remédio de resgate para cartas
  ShangShanXiaShui — conecte-o explicitamente ao módulo P5.
As demais camadas (CiXiong, JinLong, AiXing) ficam fora do MVP; registre em ADR.
```

---

## P7 — BaZi do morador e Ze Ri (seleção de datas)

```
Implemente os bounded contexts BaZi e ZeRi.

BAZI (Quatro Pilares) — camada de PERSONALIZAÇÃO, nunca geradora autônoma
- Converter data/hora/local de nascimento em 4 pares Tronco+Ramo (ano, mês, dia, hora).
- Ano e mês SOLARES (Li Chun / Jie Qi).
- Hora local verdadeira: corrija por longitude e por horário de verão histórico.
  ARMADILHA REAL: o DST brasileiro mudou de regra várias vezes e foi extinto em 2019.
  Use uma base tzdata histórica; não presuma o fuso atual. Escreva testes com
  nascimentos em datas de transição.
- Derivar Day Master, força (forte/fraco), YongShen (elemento favorável) e
  JiShen (desfavorável).

USO NO SISTEMA
- BaZi NÃO cria recomendações. Ele ESCOLHE entre remédios já validados por outro
  método aquele cujo elemento favorece o morador, e ajusta cores e materiais.
- Prioriza a alocação de quartos e setores que apoiem o YongShen.
- Implemente essa restrição como regra do domínio, não como convenção: uma
  recomendação cuja única origem seja BaZi deve ser rejeitada pelo motor de síntese.

LINGUAGEM (requisito, não copy)
Descritiva e não determinista. Proibido gerar afirmações prescritivas sobre saúde,
morte, gravidez ou finanças. Mantenha uma lista de termos bloqueados e teste-a.
Há exposição ética e jurídica real aqui.

ZE RI (seleção de datas)
Camadas mínimas: choque (冲) com o ramo do ano do morador; choque com o sitting do
imóvel; 12 Oficiais do Dia (evitar Po e Wei para quase tudo); 28 Constelações;
excluir YangGong JiRi e dias SiJue/SiLi.
ENTREGA: calendário verde/amarelo/vermelho para UMA atividade específica
(instalar remédio, iniciar obra, mudar-se, inaugurar) e UM imóvel/morador específico.
Genérico não serve — a data boa para o vizinho pode ser péssima para o cliente.
```

---

## P8 — Motor de Síntese, Conflitos e Relatório

Este módulo é o que separa um gerador de tabelas de um produto de consultoria.

```
Implemente o bounded context Synthesis do FengShui Studio.

PROBLEMA
Os métodos discordam entre si o tempo todo. Sem política explícita, o software gera
recomendações contraditórias e perde credibilidade.

HIERARQUIA DE PRECEDÊNCIA (registrar em ADR, implementar como regra testável)
1. LuanTou (Formas) — precede tudo; Sha crítico invalida otimização de compasso
2. XuanKongFeiXing — camada tempo/espaço principal
3. BaZhai — compatibilidade pessoal; resolve empates dentro do que o Fei Xing permite
4. LiuFa (ChengMen / LingShen) — camada de resgate
5. BaZi — escolhe entre remédios já validados; nunca cria recomendação sozinho
6. DaGua / SanHe — pontos específicos, não a casa toda
7. BTB — isolado, NUNCA combinado com os demais

REGRAS DE CONFLITO
- BaZhai diz "bom" e FeiXing diz "5 Amarelo com porta" → FeiXing vence, setor marcado
  como perigoso.
- Moradores com necessidades opostas → NÃO escolher silenciosamente: expor o trade-off,
  a política aplicada e quem foi priorizado.
- Nenhuma recomendação sai sem: método de origem, evidenceStrength, custo estimado,
  reversibilidade e contraindicações.

MODELO DE REMÉDIO
type Remedy = {
  id, method, targetSector, targetIssue,
  mechanism: 'layout'|'element'|'form-blocking'|'activation'|'behavioral'|'timing',
  wuXingAction: 'generate'|'exhaust'|'control'|'none',
  cost: 'zero'|'low'|'medium'|'high'|'structural',
  reversibility: 'instant'|'easy'|'hard'|'permanent',
  evidenceStrength: 'classical-consensus'|'school-variant'|'popular-tradition',
  contraindications: string[],
  requiresDateSelection: boolean,
  personalizedFor?: OccupantId
}

ORDENAÇÃO PADRÃO
Custo zero e reversível PRIMEIRO. Reposicionar uma cama antes de sugerir comprar
qualquer objeto. Isso protege a credibilidade do produto e a do consultor, e deve
ser o comportamento default, não uma preferência configurável.

INVARIANTE DE HONESTIDADE
Todo relatório contém uma seção "Onde as escolas divergem neste imóvel", listando os
pontos em que os métodos deram leituras diferentes e o que foi decidido. Num campo
sem falseabilidade experimental, transparência metodológica é o único diferencial
defensável. Implemente isso como teste: relatório sem essa seção não é válido.

PONDERAÇÃO POR OBJETIVO
O cliente declara prioridade (saúde, renda, relacionamento, estudos, carreira, sono),
orçamento, disposição a obra e restrições (aluguel, condomínio, tombamento, crianças,
animais). O ranking de remédios é ponderado por isso. Remédio que viola uma restrição
declarada não entra na lista — vai para um apêndice "não aplicável no seu contexto".

RELATÓRIO
Geração em PDF e web, com: premissas assumidas (facing, escola escolhida para
apartamento, período de construção), plantas anotadas por método, achados por
severidade, plano de ação priorizado com custo e reversibilidade, calendário Ze Ri
para os remédios que exigem data, e a seção de divergências.
Multi-idioma: pt, en, es (i18n na apresentação; domínio permanece em pinyin).
```

---

## P9 — BTB (opcional, isolado)

```
Implemente o bounded context BTB (Bagua ocidental / Black Sect) — ISOLADO.

MÉTODO
Mapa Bagua de 9 células alinhado à PAREDE DA PORTA PRINCIPAL, sem bússola.
Porta sempre na faixa inferior:
  Riqueza      | Fama         | Relacionamentos
  Família      | Saúde/Centro | Criatividade/Filhos
  Conhecimento | Carreira     | Amigos/Viagem

REQUISITOS DE ISOLAMENTO (não negociáveis)
- Rotulado na UI como método NÃO-CLÁSSICO, com explicação da diferença.
- Os resultados NÃO são comparáveis aos métodos de bússola.
- O motor de síntese (P8) deve RECUSAR combinar achados de BTB com achados clássicos
  no mesmo bloco de recomendação. Implemente como regra testável, não como aviso.
- Relatório de BTB é um documento separado, nunca uma seção do laudo clássico.

JUSTIFICATIVA DE PRODUTO
Uma parcela relevante do mercado brasileiro conhece e procura este método, então ele
tem valor comercial. Mas o diferencial do FengShui Studio é o rigor dos métodos
clássicos — misturar as duas coisas destruiria exatamente aquilo que o produto vende.
```

---

## Ordem de construção sugerida (tracer bullet, R10)

1. **P0** shared kernel + calendário solar — sem isso tudo o mais fica errado por dentro.
2. **P1 Modo A** (manual) + **P2** planta e Tai Ji + **P5** carta natal básica + uma tela que mostra a grade 3×3. Fatia vertical completa e funcionando.
3. **P1 Modo C** (mapa) — é o que torna o produto usável por leigo.
4. **P4** Ba Zhai — cálculo simples, alto valor percebido, remédios de custo zero.
5. **P5** timeline anual/mensal — a feature de maior encantamento.
6. **P3** Luan Tou — muito trabalho, mas é o que dá autoridade ao laudo.
7. **P8** síntese e relatório.
8. **P1 Modo B** (bússola virtual), **P7**, **P6**, **P9**.

## Riscos a vigiar

- **Custo de tiles de mapa** — pode virar o maior item de custo variável. Decida cedo e registre em ADR.
- **Precisão do magnetômetro** — a tentação de aceitar leituras ruins para não frustrar o usuário é grande. Não ceda: uma carta errada é pior que nenhuma carta.
- **Tabelas Ti Gua e efemérides** — dados versionados com fonte citada, nunca hardcoded sem procedência.
- **Divergência entre escolas** — resolvida por política explícita e ADR, nunca por escolha silenciosa no código.
- **Linguagem prescritiva** — o maior risco reputacional e jurídico do produto está em afirmações sobre saúde, dinheiro e destino. Lista de termos bloqueados, testada em CI.
