# ADR 0037 — Cada emissão preserva entradas e PDF

Status: aceita. Data: 2026-09-17. Etapa B0 da auditoria de setembro.

## Problema

O upload sobrescrevia `consulta/relatorio.pdf` com `upsert: true`. O relatório
era reconstruído a partir dos dados atuais, sem identificar o motor ou o
template que produziram o documento anterior. O download local acontecia
antes de confirmar a persistência; uma falha podia deixar a entrega sem arquivo.

## Decisão

`relatorio_emissoes` guarda uma emissão por UUID. O estado inicial é
`preparada`, que **não significa PDF salvo**. O servidor lê as entradas sob
RLS e ownership e grava o snapshot, seu SHA-256 e versões explícitas. A prévia
recebe a mesma fonte; se os dados mudarem ou a página usar versões antigas,
a preparação é recusada com 409. Textos e seções escolhidos pelo consultor
são validados e incluídos no snapshot. O servidor não aceita uma fonte
completa enviada pelo navegador.

Entram consulta, cliente necessário ao relatório, identificação profissional,
setores/critérios, evolução, checklist personalizado, textos, seções, referência
temporal/fuso, método, variante e orientação. A seleção de colunas é explícita:
não inclui tokens de compartilhamento ou credenciais de pagamento. Valores
legados de orientação, inclusive zero, ficam `nao_confirmada`; ausência fica
`ausente`. Nenhuma medição ou proveniência é inventada.

O PDF vai para `consulta/emissoes/uuid.pdf`, em bucket privado e com
`upsert: false`. O servidor confere tamanho, MIME, marcadores básicos do PDF e
SHA-256. Uma RPC exclusiva de `service_role`, com lock da emissão, confirma
o estado e a data da consulta na mesma transação, somente após o objeto existir.
Um trigger recusa modificações de entrada, versões, caminho e emissão concluída.
`anon` não tem acesso à tabela; o titular pode apenas ler suas linhas.

A repetição com os mesmos bytes é idempotente. Se o upload ou a confirmação
falhar, a tela não baixa nem apresenta a emissão como concluída. Guarda o mesmo
Blob/UUID em memória para repetir. Um timeout após o commit não remove o objeto:
a tentativa seguinte confere o hash e recupera a confirmação. Preparações
expiram em 15 minutos. Ao perder a aba, é possível baixar uma emissão que
chegou a concluir; uma preparação sem confirmação exige uma nova emissão.

Uma nova emissão aponta para a anterior concluída ou legada com `revisao_de`.
A FK exige a mesma consulta. Emissões concorrentes podem compartilhar o mesmo
antecessor; o vínculo não promete uma sequência linear. Histórico e download
por UUID preservam acesso a cada versão. A leitura confere o hash do objeto e
emite URL assinada por 60 segundos, após verificar a posse da consulta.

## Legado e retenção

A migração é aditiva. Referências no caminho canônico antigo são importadas como
`legado`, sem alterar seus objetos e sem inventar entrada, versão ou hash.
O pré-voo deve detectar referências fora desse formato e investigá-las antes de
aplicar. Na execução de setembro havia zero referências e zero objetos.
O backend novo recusa o upload antigo sem UUID; não reabre a sobrescrita.

Imutabilidade não impede a exclusão solicitada pelo titular. O inventário de
arquivos inclui a nova tabela; a portabilidade inclui snapshots. Exclusão de
consulta/conta remove PDFs pela Storage API **antes** dos registros. Falhas
interrompem esse trecho e preservam o inventário para nova tentativa. Os IDs
inventariados são removidos numa única instrução para respeitar a cadeia de
revisões. FKs `RESTRICT` evitam apagar consulta/perfil com emissões restantes.
Uma preparação recente bloqueia a limpeza por 30 minutos, acima dos 15 minutos
de validade e dos 60 segundos máximos da função de upload. Não há expurgo
automático de preparações: elas saem na exclusão explícita dos dados.

## Limites e consequências

- O motor `fengshui-legado-2026.09` identifica o comportamento atual. B0 não
  corrige fórmulas, orientação ou diferenças entre escolas; essas são B1/C1.
- O PDF é renderizado no navegador. Hash confirma a integridade dos bytes
  recebidos, **não** uma assinatura digital ou prova de que o navegador executou
  corretamente o motor. A checagem básica não é sanitização completa de PDFs.
- Fontes, viewport e imagens externas podem mudar. O snapshot permite
  inspecionar as entradas; reprodução visual idêntica exige o PDF preservado.
  Não se promete recomputação determinística de imagens externas.
- `jsPDF` usa compressão sem perda. Novos uploads são limitados a 4 MiB,
  deixando margem para o multipart diante do [limite de 4,5 MB da Vercel](https://vercel.com/docs/functions/limitations#request-body-size).
  O cliente barra o arquivo maior antes de enviar e orienta reduzir seções.
  Bucket e banco mantêm 20 MiB para compatibilidade legada.
- “Imprimir prévia (sem histórico)” permanece disponível com texto selecionável.
  Somente “Emitir e salvar PDF” cria o documento preservado; sua saída é imagem.
- O histórico é paginado na Data API para não perder registros após mil linhas.
  A portabilidade completa continua síncrona; exportações muito grandes precisam
  de tratamento próprio na etapa C3. B0 não encerra a revisão completa de
  privacidade/exclusão anterior, inclusive imagens fora do bucket de relatórios.
- Storage e PostgreSQL não compartilham transação. A estratégia é conservar
  referências, permitir repetição e recusar sucesso parcial. Exclusão concorrente
  pode exigir nova tentativa; não se apagam metadados silenciosamente.
- Operações administrativas com `service_role` continuam sendo fronteira de
  confiança. O aplicativo não substitui retenção WORM ou backup operacional.

## Validação e publicação

Testes de contrato, rotas, retenção e interação da página cobrem sucesso, falhas,
repetição, dados/versões desatualizados, tamanho e fotos indisponíveis. O runner
de segurança usa PostgreSQL 17 e PostgREST 16.1 para testar a migração real,
RLS/grants, imutabilidade, RPCs, vínculos e exclusão, além de ensaiar restore.
Mocks de canvas no jsdom verificam sequência e mensagens, não fidelidade visual.

Aplicar a migração validada antes do deploy. Manter as tabelas e objetos ao
reverter aplicação; não usar DROP/TRUNCATE como rollback. Reverter para código
anterior a B0 reabre o caminho legado de upload e exige bloqueá-lo primeiro.
Em qualquer mudança futura de motor/template/entrada, incrementar a versão
correspondente e manter os documentos já emitidos.
