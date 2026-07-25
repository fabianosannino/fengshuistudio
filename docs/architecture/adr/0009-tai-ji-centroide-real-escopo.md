# ADR 0009 — Tai Ji: centróide geométrico real implementado; regra do terço e desenho de polígono adiados

- **Status:** Aceito
- **Data:** 2026-07-25

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

**Ficam fora deste incremento:**

1. **A regra do terço** (setor ausente ≥1/3 do lado vs. extensão ≤1/3).
   A descrição do método é qualitativa ("falta no lado", "projeção")
   e não se traduz de forma inequívoca num algoritmo puramente
   geométrico sem uma decisão de design adicional (ex.: como comparar
   o polígono real contra um retângulo de referência por lado/célula
   de forma que corresponda ao que um consultor classificaria à mão).
   Implementar uma interpretação própria aqui sem fonte mais precisa
   seria o mesmo risco que já foi sinalizado para Kong Wang (ADR
   anterior) — prefiro não inventar a regra.
2. **A ferramenta de desenho de polígono na UI.** Hoje a captura da
   planta é um retângulo ajustável; desenhar um polígono arbitrário
   (com handles por vértice, tratamento de polígono com furo, etc.) é
   um projeto de interação de UI por si só, maior e com riscos
   próprios (não é "trocar uma fórmula", é uma ferramenta nova).

## Consequências

- `calcularTaiJi` já está pronto para uso assim que existir uma forma de
  capturar o polígono real (hoje seria chamado com os 4 cantos do
  `Bounds` atual — o que devolve exatamente o mesmo resultado que o
  bounding box já usa, então **não há ganho prático até a ferramenta de
  desenho existir**). Não foi conectado à UI neste PR por esse motivo.
- Quando o desenho de polígono for implementado, a regra do terço deve
  ser revisitada com uma especificação mais precisa (idealmente validada
  contra exemplos de um consultor) antes de codificar.
