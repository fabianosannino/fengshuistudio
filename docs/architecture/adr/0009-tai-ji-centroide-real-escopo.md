# ADR 0009 — Tai Ji: centróide geométrico real implementado; regra do terço e desenho de polígono adiados

- **Status:** Aceito
- **Data:** 2026-07-25 (atualizado no mesmo dia com o lado "setor ausente" da regra do terço)

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
- **O lado da "extensão" (凸出) CONTINUA fora.** Diferente do "setor
  ausente" (que só precisa do próprio bounding box do polígono), detectar
  uma projeção/protrusão exige uma referência de "corpo principal do
  imóvel" que não é o bounding box (por definição nada se projeta além do
  seu próprio retângulo delimitador) — isso é um problema de geometria
  computacional genuinamente mais ambíguo (ex.: maior retângulo inscrito?
  moda de largura/profundidade?) e não foi resolvido aqui.

**Continua fora deste incremento:**

1. **O lado "extensão" da regra do terço** — ver justificativa acima.
2. **A ferramenta de desenho de polígono na UI.** Hoje a captura da
   planta é um retângulo ajustável; desenhar um polígono arbitrário
   (com handles por vértice, tratamento de polígono com furo, etc.) é
   um projeto de interação de UI por si só, maior e com riscos
   próprios (não é "trocar uma fórmula", é uma ferramenta nova).

## Consequências

- `calcularTaiJi`, `coberturaPorCelula` e `setoresAusentes` já estão
  prontos para uso assim que existir uma forma de capturar o polígono
  real (hoje seriam chamados com os 4 cantos do `Bounds` atual — o que
  devolve exatamente o mesmo resultado que o bounding box já usa, então
  **não há ganho prático até a ferramenta de desenho existir**). Nenhum
  foi conectado à UI neste PR por esse motivo.
- Mapear célula da grade (linha, coluna) → setor cardeal (N/NE/E…) é
  responsabilidade de quem chamar essas funções, pois depende do
  facing/rotação do imóvel — mesma separação de responsabilidade já usada
  em `calcularGridOrder` (`bagua-grid.ts`).
- Quando o desenho de polígono for implementado, o lado "extensão" deve
  ser revisitado com uma especificação mais precisa (idealmente validada
  contra exemplos de um consultor) antes de codificar.
