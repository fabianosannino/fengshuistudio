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
