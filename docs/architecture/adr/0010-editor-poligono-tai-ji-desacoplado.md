# ADR 0010 — Editor de polígono do Tai Ji: componente desacoplado, sem integração com a foto ainda

- **Status:** Aceito
- **Data:** 2026-07-26

## Contexto

`src/lib/poligono.ts` (PR #95/#96) já calcula o centróide geométrico real
e a cobertura por célula de um polígono, mas não estava conectado a
nenhuma UI — faltava uma forma do consultor desenhar o contorno real do
imóvel.

Antes de implementar, investiguei `app/bagua-planta/page.tsx` (a tela
onde isso naturalmente entraria) e encontrei um risco real: a interação
de arrastar hoje é uma única máquina de estado (`dragRef`) que já cobre
mover/redimensionar o retângulo E mover/redimensionar marcações de
falta/excesso, **duplicada inteira** entre a visualização normal e a tela
cheia, operando em pixels absolutos da imagem rotacionada. É uma feature
em produção, usada por clientes pagantes. Enxertar edição de vértices de
polígono diretamente nela teria risco real de regressão que eu não
conseguiria validar por completo neste ambiente (sem um projeto Supabase
real, o fluxo de "abrir consulta → arrastar sobre foto real" não é
testável de ponta a ponta aqui).

Apresentei essa avaliação ao usuário antes de prosseguir; a decisão foi
construir o editor como peça independente primeiro.

## Decisão

`app/components/EditorPoligonoTaiJi.tsx` — componente novo, autocontido:

- **Espaço de coordenadas próprio** (SVG, viewBox 0–400), não alinhado à
  foto real da planta nem ao espaço de pixels do canvas existente.
- **Não importa nem toca** em `dragRef`, `onMD/onMM/onMU` ou qualquer
  código de `app/bagua-planta/page.tsx`.
- Interações: arrastar vértice (ponteiro), adicionar vértice (clique no
  meio de uma aresta), remover vértice (duplo clique, respeitando o
  mínimo de 3), restaurar ao retângulo padrão.
- Usa `calcularTaiJi` (shared kernel) para mostrar o centro real e o
  aviso visual quando ele cai fora da área construída.
- **Não está importado em nenhuma página ainda** — mesmo padrão já usado
  para `src/lib/poligono.ts` em si (ADR 0009): entregar a peça testada
  primeiro, sem forçar uma integração arriscada só para "ter algo visível".

## Consequências

- Zero risco para o fluxo de consulta existente — nenhum arquivo tocado
  além da criação deste componente novo.
- **Trabalho de integração pendente, explícito:** sobrepor este editor (ou
  a lógica equivalente) com precisão de pixel sobre a foto real da planta,
  no mesmo espaço de coordenadas de `bounds`/`marcacoes`, e persistir o
  polígono resultante em `bagua_entrada`. Isso exige entender/tocar a
  máquina de arrastar existente — recomendo, quando essa etapa entrar em
  pauta, avaliar primeiro se vale a pena refatorar `dragRef` (a duplicação
  normal/tela-cheia já é um sinal de risco por si só) antes de estender.
- Até essa integração acontecer, o componente é utilizável em qualquer
  contexto que só precise do diagnóstico de Tai Ji sobre uma forma
  desenhada à mão (não necessariamente a planta real).
