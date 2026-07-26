# ADR 0009 — Tai Ji: centróide geométrico real implementado; regra do terço e desenho de polígono adiados

- **Status:** Aceito
- **Data:** 2026-07-25 (atualizado no mesmo dia com "setor ausente"; atualizado em 2026-07-26 com "extensão")

## Contexto

`docs/domain/fengshui-metodos-referencia.md` §1.7 e
`fengshui-prompts-modulos.md` (P2) especificam o Tai Ji (centro do imóvel)
como o **centróide geométrico do polígono real** da área construída — não
o centro do retângulo delimitador (bounding box), que é o que o app usa
hoje. Também pedem a "regra do terço" (setor ausente vs. extensão) e uma
ferramenta de desenho de polígono na planta.

Hoje `app/bagua-planta/page.tsx` captura a planta como um **retângulo**
ajustável (`Bounds = {x,y,w,h}`), não um polígono arbitrário — "marcações"
de falta/excesso são desenhadas manualmente pelo consultor como retângulos
livres por cima, sem classificação automática.

## Decisão

Implementado neste incremento **apenas** a matemática do centróide real
(`src/lib/poligono.ts`): `areaPoligono`, `centroidePoligono` (fórmula
padrão de centroide de polígono por decomposição triangular/shoelace —
geometria de livro-texto, sem ambiguidade), `pontoDentroDoPoligono` e
`calcularTaiJi` (combina os dois para o diagnóstico `centroForaDaArea`).
Testado com os casos que o próprio documento cita como críticos: formato
em L e em U, com os centróides conferidos por decomposição manual em
retângulos antes de virar teste automatizado (mesmo método de verificação
cruzada usado em ADRs anteriores).

**Atualização (mesmo dia):** implementado o lado "setor ausente" da regra
do terço, com uma escolha de design explícita e documentada no código
(`coberturaPorCelula`, `setoresAusentes` em `src/lib/poligono.ts`):

- O documento descreve a regra em termos de "falta na extensão do LADO"
  (uma medida linear/1D). Aqui ela é aproximada por **cobertura de ÁREA**
  de cada célula de uma grade 3×3 derivada do bounding box do próprio
  polígono: célula com menos de 2/3 de área coberta (limiar padrão 1/3)
  → setor ausente. `recortarPoligono` (Sutherland-Hodgman contra
  retângulo, geometria de livro-texto) faz o recorte real; `coberturaPorCelula`
  soma a área recortada por célula.
- Isso é uma **aproximação declarada**, não uma citação literal da regra
  — testada com casos hand-verified (quadrado com corte alinhado à grade,
  e um triângulo diagonal para confirmar cobertura fracionária correta:
  0, 0,5 e 1 nas células certas).
**Atualização (2026-07-26):** implementado também o lado "extensão"
(凸出) — `setoresExtensao` em `src/lib/poligono.ts`. Esta é a peça que a
atualização anterior desta ADR classificava como "genuinamente mais
ambígua" (precisa de uma referência de "corpo principal" que não é o
próprio bounding box). Resolvida com um **algoritmo próprio, declarado**,
não uma citação de fonte clássica:

1. Marca cada célula da grade 3×3 como "cheia" (mesmo limiar/complemento
   exato de "ausente" — nunca as duas coisas ao mesmo tempo).
2. Encontra a maior área possível entre os sub-retângulos da grade
   (alinhados aos eixos) que contêm o Centro e são inteiramente "cheios"
   — o tamanho do "corpo principal".
3. Faz a **união de todos** os retângulos que atingem essa área máxima,
   não um escolhido arbitrariamente. Isso importa: um L simples tem dois
   retângulos de área máxima empatada (as duas "pernas" do L); escolher
   só um trataria a outra perna como "extensão" por engano — bug real que
   apareceu ao testar e foi corrigido antes de mesclar (o teste do L
   pegou exatamente isso).
4. Toda célula "cheia" fora dessa união é extensão.

Testado com dois casos hand-verified: um L simples não gera nenhuma
extensão (confirma o ponto 3 acima); e um corpo principal nas 2/3
superiores da grade com uma saliência sólida na célula inferior-central —
o algoritmo aponta exatamente essa célula, e as duas vazias ao lado dela
saem como "ausente", nunca as duas categorias ao mesmo tempo (verificado
para as 3 formas de teste do arquivo).

**Continua fora deste incremento:**

1. **A ferramenta de desenho de polígono na UI**, e sua integração
   pixel-perfeita com a foto real da planta. Hoje a captura é um
   retângulo ajustável; existe um editor desacoplado (ADR 0010) mas
   ainda não conectado à foto real — desenhar/mover vértices sobre a
   imagem exige tocar a máquina de arrastar já existente, um projeto de
   interação por si só.

## Consequências

- `calcularTaiJi`, `coberturaPorCelula`, `setoresAusentes` e
  `setoresExtensao` já estão prontos para uso assim que existir uma forma
  de capturar o polígono real (hoje seriam chamados com os 4 cantos do
  `Bounds` atual — o que devolve exatamente o mesmo resultado que o
  bounding box já usa para o centróide, e nenhuma extensão/ausência para
  um retângulo puro, então **não há ganho prático até a ferramenta de
  desenho existir**). Nenhum foi conectado à UI por esse motivo.
- Mapear célula da grade (linha, coluna) → setor cardeal (N/NE/E…) é
  responsabilidade de quem chamar essas funções, pois depende do
  facing/rotação do imóvel — mesma separação de responsabilidade já usada
  em `calcularGridOrder` (`bagua-grid.ts`).
- `setoresExtensao` é O(3^4) na resolução 3×3 (81 combinações de
  sub-retângulo, cada uma varrendo até 9 células) — trivial nesse
  tamanho; não escala a uma grade maior sem repensar o algoritmo, mas a
  regra do terço nunca pediu resolução além de 3×3.
