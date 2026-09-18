# Cenários e evidências de validação

Regra adotada em 18/09/2026: toda mudança tem cenário, resultado esperado e
evidência. Os IDs não são reciclados. Atualize estado e evidência no mesmo PR;
um teste manual pendente não vira aprovado por existir um teste unitário.

## D0 — primeira base de execução por método

| ID / mudança | Dado / quando | Então | Verificação |
|---|---|---|---|
| D0-01 — contrato versionado | Norte 0° confirmado, referência/origem/data válidas, imóvel de 2011 e cliente masculino nascido em 15/06/1990; executar os adaptadores | Casa Kua 9 por assento Sul, Ming Gua 1, Fei Xing experimental do período 8, variantes/versões/limites presentes; repetir é determinístico e alterar um resultado não muda o seguinte | `src/lib/__tests__/execucao-metodos.test.ts` com motores reais; inclui orientação incompleta, anos NaN/infinito/fracionário/fora do intervalo, reforma anterior/posterior, legado inválido, data civil impossível e Li Chun indeterminado |
| D0-02 — disponibilidade e apresentação | Campos completos porém inválidos, apenas um setor avaliado, método BTB ou Fei Xing calculável; abrir diagnóstico/relatório | Indeterminado não conta como disponível; levantamento parcial e lacunas aparecem; experimental tem identificação e não entra no total sustentado | `sustentacao-do-diagnostico.test.ts` e `tests/relatorio-emissao-ui.test.tsx`; DOM/jsdom não verifica layout/canvas |
| D0-03 — snapshot de novas emissões | Fonte autorizada da consulta e resultado forjado no pedido; preparar emissão, depois emitir revisão | Servidor grava seu próprio resultado, o hash inclui o registro e a emissão anterior fica intacta; página com versão antiga recebe 409; consulta alheia não usa privilégio | `tests/api/relatorio-emissoes.test.ts` e `relatorio-emissao.test.ts`; doubles de I/O não substituem Auth/Storage reais |
| D0-04 — experimento não determina recomendação | Ba Zhai favorável versus Estrela 5 experimental; também testar somente carta experimental e carta com anual | Ba Zhai permanece elegível, divergência e motivo experimental preservados; experimento sozinho não gera vencedor ou classificação final de perigo | `avaliacao-setor.test.ts`, `sintese-imovel.test.ts`, `tests/relatorio-emissao-ui.test.tsx`; valida política do produto, não a tradição inteira |
| D0-05 — continuidade e obrigação de testar | Revisar cada mudança deste PR e a lista de próximos passos | Cada mudança tem cenário; A–C mantêm responsáveis, bloqueios e aceite; D1+ não aparece concluído; regras de agentes e template de PR exigem a rastreabilidade | Revisão documental manual dos links, IDs e conteúdo de AGENTS/CLAUDE/template/roadmap/ADR 0056 |

Evidência local em 18/09/2026: D0-01–04 executados com Vitest (motores reais e
interfaces/I/O simulados conforme a tabela); TypeScript/build aprovados e lint
sem erros, com 102 avisos anteriores. D0-05 revisado manualmente: IDs, links,
responsabilidades e limitações conferidos. O PR registra a execução remota do
commit final. Homologação de navegador permanece em AC-02; estes cenários não
a encerram. Suíte local final: 1.798 testes aprovados em 131 arquivos.

## E — criação e edição de marcações da planta

Relato de 18/09/2026, confirmado pelo usuário com mouse e toque: desenhar falta
ou excesso parecia exigir mudar o retângulo-base, perdendo a referência visual.
Reprodução anterior à correção, na página real com I/O simulado: criar em espaço
livre passou; começar dentro da marca existente falhou (esperadas duas marcas,
obtida uma). O handler priorizava mover/redimensionar a marca anterior e não
tratava toque. O canto superior direito também dividia espaço com a exclusão.

Fixture sintética: imagem 1.000 × 800 px, bordas `(100,100,600,600)`, falta
original `(150,150,300,300)`, BTB, 90 m². Nenhuma consulta real é alterada.

| ID / mudança | Dado / quando | Então | Verificação |
|---|---|---|---|
| E-MARC-01 — nova marca independente | Com a fixture, desenhar outra falta em espaço livre e sobre a existente | Duas marcas; a anterior, `planta_url` e as bordas ficam iguais | `tests/bagua-marcacoes-ui.test.tsx`; a segunda ação reproduziu a falha antes da correção |
| E-MARC-02 — mouse/toque/caneta | Desenhar excesso cruzando a borda, inverter o sentido, soltar sem evento intermediário, mudar escala/posição CSS e usar tela cheia | Coordenadas da imagem preservadas, só 10.000 px² externos contam como excesso no exemplo; liberar o ponteiro conclui uma marca | Mesmo teste de página; usa eventos PointerEvent sintéticos, não dispositivo físico |
| E-MARC-03 — interrupção | Cancelar pelo sistema, Esc ou perda de captura; sair do canvas durante o arraste; enviar outro ponteiro | Cancelamento descarta o gesto; sair não conclui antecipadamente; outro ponteiro não move/finaliza; nenhum salvamento parcial | Mesmo teste de página; captura nativa continua pendente |
| E-MARC-04 — edição explícita | Selecionar/mover, redimensionar pelo canto superior direito, cruzar a âncora, cancelar, selecionar uma marca coberta e excluir pelo botão; ajustar Bordas | Só o alvo muda, cancelamento restaura, não há dimensão negativa/colapso, exclusão não disputa o canto; somente Bordas muda a referência | Teste de página e `src/lib/__tests__/edicao-marcacoes.test.ts`; seleção por lista mantém acesso às sobrepostas |
| E-MARC-05 — comparação e salvamento | Ocultar/reexibir as sobreposições; salvar a análise enquanto a comparação está ligada | Imagem e bordas permanecem; marcas continuam nos dados; snapshot da análise inclui sobreposições e a comparação volta após a captura | Teste de página verifica chamadas de desenho e payload; não verifica pixels reais ou PDF no navegador |
| E-MARC-06 — interpretação e continuidade | Marcar excesso totalmente interno; revisar controles, instruções, configuração de preview e roadmap | Aviso de efeito zero, sem modificar limites automaticamente; cenários e pendências permanecem explícitos; preview desta branch desativada | Teste de página para aviso/limites; revisão manual de textos, IDs e `vercel.json` |

Implementação usa [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
e [captura de ponteiro](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture).
Controles com texto, estado pressionado, seleção por lista e exclusão explícita
não dependem apenas da cor. A fórmula de união geométrica, o formato persistido
e o motor/template do relatório não mudam; nenhuma emissão anterior é reescrita.

Evidência local em 18/09/2026: **1.827 testes em 133 arquivos aprovados**,
incluindo 29 casos novos; execução final `npm test -- --maxWorkers=2` em 181 s,
sem aumentar timeouts ou remover asserções. Duas repetições com paralelismo
padrão excederam o limite de 5 s no primeiro caso de duas páginas; a execução
com dois workers passou integralmente. TypeScript e build aprovados; lint sem
erros, com 94 avisos (antes 102). E-MARC-06 também revisado documentalmente.
CI do commit final é obrigatório e fica vinculado no PR.

**Homologação manual pendente:** no ambiente autorizado, com uma planta sintética
contendo recuo e extensão, repetir criação sobre outra marca, edição, exclusão,
cancelamento, comparação, Recalcular, salvar/reabrir e comparar a imagem salva.
Executar com mouse no desktop e toque no celular/tablet, em bancada/tela cheia,
inclusive rolagem, redimensionamento da janela e arraste para fora do canvas.
Registrar navegador, dispositivo e resultado visual. O bloqueio anterior do
servidor local descrito em AC-02 não foi contornado. Automação de jsdom não
encerra esse aceite nem AC-02/AC-06.

## E — contorno real com referência fixa (pontos brancos/verdes)

O relato seguinte identificou outro editor: os pontos brancos acrescentam
vértices verdes ao contorno real. Não eram os retângulos do PR #215.
Reprodução na página antes da correção: com bordas `(100,100,600,600)`, criar
um recuo pelo ponto branco superior e uma extensão pelo ponto branco direito
mudou a célula ausente superior-central de `x=300,w=200` para
`x=366,67,w=266,67`. O editor usava um bounding box dinâmico diferente das
bordas da análise. ADR 0057 define uma única referência para essa sobreposição.

| ID / mudança | Dado / quando | Então | Execução / limites |
|---|---|---|---|
| E-CONT-01 — reprodução e persistência | BTB, imagem 1.000 × 800, bordas definidas; inserir ponto branco superior, puxar para dentro; inserir ponto direito, puxar para fora; concluir e reabrir | Os nove limites permanecem iguais, a falta não se desloca, a extensão fica externa, bordas/divisórias/polígono são preservados | `tests/bagua-marcacoes-ui.test.tsx`, eventos mouse e touch; falha reproduzida antes da correção e aprovada depois; I/O simulado |
| E-CONT-02 — geometria independente | Recuo 100 × 100 e extensão 60 × 100 em referência 300 × 300; contorno côncavo, quatro lados/cantos, vértices invertidos, divisórias não uniformes e dados inválidos | Falta original permanece; 6.000 px² externos no setor direito; cantos contados uma vez; centroide pode mudar sem mover a grade; dados inválidos não produzem números enganosos | `src/lib/__tests__/contorno-na-grade.test.ts`; vetores geométricos analíticos, não aceite da regra tradicional por escola |
| E-CONT-03 — restaurar | Alterar o contorno e acionar Restaurar contorno às bordas definidas | Retorna às quatro coordenadas escolhidas, sem usar a margem da imagem ou mudar as bordas | Teste de página e payload de rascunho |
| E-CONT-04 — editores exclusivos | Abrir contorno, inserir vértice, selecionar Marcar Excesso, desenhar; voltar ao contorno e ligar comparação | Sobreposição encerra ao trocar de ferramenta, ambos os desenhos são preservados, comparação oculta o editor; sem disputa de gestos | Teste de página; não comprova rolagem/captura/posição visual do rodapé em navegador real |
| E-CONT-05 — comunicação, arquitetura e continuidade | Revisar instruções, resumo, ADR, estado dos métodos, preview e roadmap | Referência fixa e distinção entre centroide/grade claras; contorno auxiliar não se apresenta como pontuação; A–C e homologação física continuam abertos | Revisão manual dos documentos e correspondência com código/testes; preview da branch desativada |

Evidência local em 18/09/2026: 1.841 testes em 134 arquivos aprovados,
incluindo 14 novos casos (`npm test -- --maxWorkers=2`, 151 s); TypeScript
aprovado e lint sem erros, com os mesmos 94 avisos anteriores. E-CONT-05
revisado manualmente nos documentos/código. Build e CI do commit final são
registrados no PR, sem confundir estes resultados com homologação física.

Homologação física permanece pendente: repetir E-CONT-01 em desktop e celular,
conferir sobreposição após resize/rolagem e posição do rodapé, mudar entre
contorno/marcações/Bordas/comparação/tela cheia e salvar/reabrir. Registrar
navegador/dispositivo e imagens sintéticas. O bloqueio anterior do servidor
local descrito em AC-02 não foi contornado.

## A–C — pendências de aceite que não podem ser esquecidas

Todos os cenários abaixo permanecem **pendentes de execução completa**. Usar
somente identidades e dados sintéticos em ambiente isolado nas ações destrutivas
ou financeiras. Não publicar credenciais ou dados pessoais na evidência.

| ID | Dado / quando | Então / evidência necessária |
|---|---|---|
| AC-01 — isolamento | Projetos Supabase e Stripe test separados; conferir configuração e executar um smoke sintético | IDs dos recursos de teste documentados; nenhum segredo live ou recurso de produção usado; sem transação real |
| AC-02 — jornada | Duas identidades de teste e admin com/sem AAL2; percorrer cadastro, plano, consulta, ambos os métodos, upload, PDF, reabertura, troca de método e exclusão | Usuário só acessa seus dados; gates negam o indevido; PDF salvo reabre idêntico; nova emissão não muda a anterior; registrar navegador/dispositivo, resultados e comparação visual |
| AC-03 — finanças | Quatro preços test e eventos Stripe duplicados/atrasados/assíncronos; compra, cancelamento, reembolsos parcial/integral, disputa e Connect | Razão, concessão, comissão e download convergem sem duplicação; vincular IDs sintéticos/eventos/evidências e conciliação; nenhum backfill real como ensaio |
| AC-04 — restauração | Backup isolado de banco, Auth e Storage com falha simulada; restaurar em destino descartável | Dados e arquivos recuperados, acesso e integridade conferidos, RPO/RTO medidos e procedimento reproduzível |
| AC-05 — documentos/CSP/observabilidade | PDFs malformados, excessivos ou com conteúdo ativo, imagens extremas e jornadas Maps/Auth/PDF sob CSP candidata | Limites de recursos e erros seguros comprovados; fluxos legítimos funcionam; violações/alertas conferidos antes de enforcement; registros sem conteúdo sensível |
| AC-06 — legado/retencão/domínio | Evidência de posse das duas imagens órfãs, casos de encerramento comercial e corpus de cálculo independente; executar os procedimentos e piloto | Destinação comprovada sem atribuir dono por suposição; retenção definida/testada; vetores e tolerâncias por variante revisados; medir acessibilidade e desempenho em dispositivo declarado |

## Próximas entregas de cálculo — cenário mínimo antes de implementar

| ID | Cenário de aceite previsto |
|---|---|
| D1 | Salvar execuções BTB e Bússola na mesma consulta, repetir a requisição, editar entrada, comparar/reabrir; histórico anterior permanece igual, nova entrada fica distinguível, idempotência/concorrência funcionam e outra conta não lê/altera; exportação/exclusão inclui execuções |
| D2 | Fachadas nos limites de octantes, incerteza de medição, referências magnética/verdadeira e múltiplos moradores/comodos/móveis; resultados e desenho coincidem com casos independentes da variante, sem presumir referência ou morador |
| D3 | Cartas de referência por período/24 Montanhas, fronteiras angulares, polaridade e casos de substituição/virada temporal; resultados completos conferidos com fonte/licença e especialista antes de promover Fei Xing |
| D4 | Selecionar separadamente cada novo módulo (Liu Fa, San He, Da Gua; BaZi como complemento), fornecer seus dados mínimos e comparar |

Para D4, o esperado é que cada módulo declare requisitos, fonte, versão e limites,
recuse entrada insuficiente e preserve diferenças de escola; método não implementado
nunca deve parecer disponível. Expandir os casos por módulo antes de iniciá-lo.
