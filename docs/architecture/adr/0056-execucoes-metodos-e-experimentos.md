# ADR 0056 — Resultados versionados por método e limites de experimentos

Status: aceito em 18/09/2026.

## Problema

Tela, disponibilidade e relatório faziam avaliações separadas. Uma data inválida
com gênero preenchido aparecia como Ming Gua disponível, embora o motor retornasse
null. A mesma divergência existia para anos de construção. O mapa simplificado
Fei Xing se dizia experimental, mas herdava a precedência da escola completa na
recomendação final. A emissão guardava a fonte, sem o resultado de cada adaptador.

## Decisão

`execucao-metodos.ts` executa os motores existentes e identifica método, variante,
versão e limitações. Os estados são calculado, experimental, incompleto,
indeterminado e não aplicável. Calculado significa execução com o escopo declarado,
não homologação integral da escola. Ming Gua registra também a versão da efeméride.
Direções e outros resultados são copiados, sem referência mutável às tabelas globais.

A bancada e o relatório consomem o mesmo adaptador. Na preparação da emissão, o
servidor calcula novamente a partir da fonte autorizada, já conferida por hash;
ignora resultados enviados pelo cliente e armazena o registro no snapshot imutável
existente. Incrementar entrada/motor/template preserva os PDFs anteriores e recusa
páginas antigas. Não existe nova tabela, grant, endpoint ou origem de dado pessoal.

O painel de disponibilidade deriva do resultado, preserva pendências e separa
experimentais da contagem de métodos sustentados. Anos inválidos ou reforma anterior
à construção não produzem carta. O ano de virada ainda permite visualizar um
experimento, com a ambiguidade explícita. Não foi implementada captura da data exata
da obra nem se mudou a fórmula tradicional. O legado conserva apenas o ano de uma
data civil válida; não usa seu dia como comprovação da conclusão da obra.

Na síntese, avaliações experimentais podem aparecer como divergência, com razão
explícita, mas nunca vencer a decisão. A ponte atual Fei Xing (incluindo sua
interpretação combinada com a anual) é sempre experimental. Não existe parâmetro
de interface para promover essa implementação. A política de precedência do ADR
0013 continua aplicável aos métodos elegíveis; esta decisão limita elegibilidade.

## Limites e continuação

Esta é D0: registro dos adaptadores no snapshot de **novas emissões**. Não é ainda
um histórico independente de execuções por consulta, comparação BTB/Bússola ou
seleção de todas as linhagens. A seleção atual BTB/Bússola permanece. Formas, planta
semântica, múltiplos moradores, 24 Montanhas completas, Liu Fa, San He e Da Gua têm
etapas próprias. A convenção de Norte é conservada, sem conversão automática nova.

As atribuições tradicionais e fórmulas existentes não recebem certificação por
estes testes. Casos independentes e revisão de especialista continuam necessários.
O roadmap A–C permanece obrigatório, sem impedir desenvolvimento local independente.

## Validação

[Cenários D0-01 a D0-05](../../auditoria/2026-09-17-hardening/CENARIOS_DE_TESTE.md):
motores reais, dados inválidos/ausentes, referência confirmada, isolamento de
objetos, tela do relatório, fonte do servidor/hash e comparação experimental.
Jornada autenticada e aparência do PDF em navegador continuam pendentes.
