# ADR 0058 — Edição confirmada, saldo de áreas e cadastro de mobiliário

Status: aceito em 18/09/2026.

## Decisão de produto

O usuário pediu um fluxo único: editar → bordas → OK → polígonos de falta e
excesso → OK em cada etapa → recalcular. Pediu também que o saldo entre falta
e excesso determine o estado de cada setor, e que mobiliário tenha tela e
cadastro próprios. Essa regra de área é uma convenção do aplicativo solicitada
pelo usuário; não é apresentada como validação universal das escolas.

`EditorMarcacoesPlanta` mantém o rascunho de cada etapa isolado. Bordas anteriores
aparecem tracejadas durante sua revisão. Confirmação explícita, com horário,
é necessária mesmo quando o usuário aceita a posição anterior sem arrastar.
Trocar de ferramenta com etapa aberta pede OK ou Cancelar, sem esconder os pontos.
Falhas de escrita mantêm o rascunho, e cancelar não modifica o confirmado.
Polígonos possuem pontos editáveis por ponteiro ou campos numéricos; inserir e
remover pontos não depende de duplo clique. Mouse, toque e caneta usam o mesmo
contrato de Pointer Events com captura e cancelamento.

## Geometria e compatibilidade

`marcacoes` conserva id/tipo/bounding box e aceita `pontos`. Ausência de
`geometria_regra` mantém `descontos-v1` para retângulos legados. Confirmar uma
etapa ativa `saldo-v2` explicitamente e preserva as marcas anteriores. Os PDFs
já emitidos não são alterados. O hash da análise inclui a regra quando nova;
entradas, motor e template de novas emissões são versionados.

A união por tipo, interseção com a base e diferença externa usam
`polygon-clipping` 0.15.7 fixado no lockfile, segundo sua
[API oficial](https://github.com/mfogel/polygon-clipping). Polígonos simples,
finitos e limitados são validados antes de calcular. Sobreposições contam uma
vez; orientação dos vértices não muda a área. Falta é recortada dentro da base;
excesso é distribuído no prolongamento dos setores periféricos, nunca no centro.
A grade e suas divisórias não se expandem quando surgem extensões.

Para cada setor: `saldo = excessoArea - faltaArea`; a nota geométrica é
`clamp(100 - abs(excessoPct - faltaPct), 0, 100)`. Falta e excesso brutos continuam
visíveis quando se compensam. Ajuste manual existente continua explicitamente
separado. Nova marca precisa compartilhar um segmento da borda; contato apenas
em um ponto, áreas isoladas, cruzamentos e geometria degenerada são recusados.
Pátios internos não são suportados por essa ferramenta de recuos/extensões.

O antigo contorno auxiliar Tai Ji fica preservado no JSON. Não é convertido
automaticamente nem somado às marcas, para evitar dupla contagem ou inventar
faltas aceitas pelo usuário. Seu diagnóstico auxiliar não substitui as áreas
confirmadas. A UI deixa de oferecer os dois editores simultâneos.

## Mobiliário e acesso

`/consultas/[id]/mobiliario` cadastra até 150 itens, inclusive vários móveis do
mesmo ambiente/setor. A coluna `consultas.mobiliario` é independente de
`bagua_entrada`, evitando que salvar geometria sobrescreva móveis. Cada item
tem UUID, setor, ambiente, tipo/identificação, posição opcional, direção,
referência de Norte/origem e dados pessoais opcionais para Ming Gua.

A API autentica a sessão e filtra o consultor, além das policies existentes.
A RPC `salvar_mobiliario_consulta` é **security invoker**, com search_path vazio,
sem acesso de anon/PUBLIC. UPDATE atômico compara revisão e geometria lidas;
um concorrente recebe conflito. JSON grande vai no corpo, não no filtro da URL.
A migração é aditiva, sem backfill e sem alteração de registros de negócio.
O contrato da Data API/RLS foi conferido na
[documentação oficial](https://supabase.com/docs/guides/api/securing-your-api).

Exportação do titular já inclui todas as colunas de suas consultas; teste
comprova a inclusão exclusiva do mobiliário próprio. Exclusão da consulta
remove a coluna junto, sem arquivos ou tabela órfã. Novas emissões arquivam
esse cadastro na fonte privada; não imprimem automaticamente datas pessoais.
Logs de falha não contêm corpo, nascimento ou identificadores dos moradores.

Mudança da planta suspende a leitura anterior até revisão. Direção gráfica
exige fachada confirmada com origem e Norte; a fachada corresponde à base da
imagem rotacionada. Campos vazios não viram 0°. Direção verdadeira precisa de
declinação para a comparação magnética pessoal. Nomes BTB não viram direções
cardinais. A avaliação informa a direção favorável/desfavorável ao Ming Gua,
sem certificar posição física nem aplicar indiscriminadamente a regra do fogão
a camas e mesas. Ba Zhai, Ming Gua e a expressão chinesa têm explicações.

## Validação e limites

E-POL-01–06 e D-MOB-01–06 no registro de cenários. Unitários verificam vetores
analíticos; React/jsdom verifica a jornada e payloads; PostgreSQL/PostgREST do
CI verifica grants, RLS, concorrência, revisão e exclusão com dados sintéticos.
Jsdom não comprova rasterização, conforto, rolagem ou captura nativa em aparelhos.
AC-02/AC-06 e o piloto de domínio continuam abertos. Não se contorna o bloqueio
anterior do servidor local nem se usa dados reais para simular casos de teste.
