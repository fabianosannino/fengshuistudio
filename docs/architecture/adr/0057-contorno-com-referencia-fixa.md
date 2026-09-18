# ADR 0057 — Contorno real sobre a referência fixa da análise

Status: aceito em 18/09/2026.

## Defeito e decisão

Os pontos brancos/verdes pertencem a `EditorPoligonoTaiJi`, não aos retângulos
de Marcar Falta/Excesso. O editor recalculava o bounding box do polígono e o
dividia em nove células a cada gesto. Acrescentar uma extensão mudava também
a posição e a largura das células ausentes já desenhadas. A bancada ao fundo
continuava usando `bagua_entrada.bordas`: havia duas referências sobrepostas.

Por solicitação do usuário, editar faltas/extensões não redefine a referência.
O editor e seu resumo usam as bordas e as divisórias `lh`/`lv` já escolhidas
na análise. Somente a ação explícita de ajustar Bordas muda esses limites.
No BTB, a ordem dos setores continua fixa conforme ADR 0018; não há rotação
por centroide, porta ou extensão. A mesma separação geométrica é usada na
bancada da Bússola, sem mudar sua orientação ou ordem de setores.

`contorno-na-grade.ts` calcula a cobertura interna em cada célula fixa. A
extensão externa é recortada pelo prolongamento das divisórias periféricas;
faixas disjuntas evitam duplicar os cantos. A sobreposição laranja mostra a
parte externa do polígono, sem alargar a grade. O centroide segue a geometria
real do imóvel e pode mudar de lugar, sem deslocar nenhum setor.

O resumo e o desenho consomem a mesma função pura. Restaurar o contorno usa
as bordas escolhidas, em vez da margem padrão da imagem. Os editores de
polígono e retângulos ficam mutuamente exclusivos; trocar de editor salva o
rascunho pelo caminho existente, que verifica erros de escrita. O rodapé do
polígono fica no fluxo abaixo da imagem, sem cobrir os controles seguintes.
No uso isolado do componente, a referência inicial também é mantida fixa.

## Escopo e limites

Trata-se de diagnóstico geométrico auxiliar. A sinalização de ausência
conserva a aproximação anterior por cobertura de área inferior a 2/3,
excluindo o centro. A indicação de extensão significa área fora da referência,
sem inferir reforço energético ou classificar uma regra tradicional linear.
As funções históricas de inferência de corpo principal em `poligono.ts` não
são alteradas; deixam de decidir a sobreposição que já tem referência explícita.
Homologação de domínio por escola continua em AC-06/D2.

Os percentuais e scores continuam vindo das marcações retangulares e de
Recalcular. Integrar o contorno semântico a esses resultados é uma etapa
separada; não somar duas representações da mesma falta/excesso. A interface
explica essa diferença. Formatos persistidos, motor/template do relatório,
políticas de acesso e PDFs históricos não mudam; não há migração ou backfill.

## Evidência

E-CONT-01 reproduziu a falha na página antes da correção: uma célula com
`x=300,w=200` passou a `x=366,67,w=266,67` após a extensão. Os testes agora
conferem os nove limites, eventos de mouse/toque, salvar/reabrir, restauração,
troca de editor, áreas externas dos quatro lados/cantos, divisórias salvas,
polígonos côncavos e entradas inválidas. Ver E-CONT-01–05 no
[registro de cenários](../../auditoria/2026-09-17-hardening/CENARIOS_DE_TESTE.md).
Eventos jsdom e geometria não substituem teste visual com dispositivo físico;
esse aceite permanece pendente.
