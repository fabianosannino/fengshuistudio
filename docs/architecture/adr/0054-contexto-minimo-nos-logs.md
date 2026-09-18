# ADR 0054 — Contexto de log por lista de campos e valores permitidos

Status: aceito em 18/09/2026.

## Problema e decisão

O logger serializava qualquer contexto e permitia sobrescrever nível, instante
e mensagem pelo spread. Erros de banco, Stripe e Auth podiam conter SQL, URLs,
dados pessoais ou credenciais. As telas de erro também enviavam o Error inteiro
ao console. A inspeção de 212 chamadas existentes encontrou mensagens literais,
mas 93 campos `error` e 20 campos `erro` no contexto.

A saída usa um schema explícito: rotas conhecidas sem query/fragmento, ações e
estados enumerados, códigos técnicos conhecidos e contagens inteiras. Causas de
Auth e códigos do catálogo são preservados por enumeração; texto bruto é
descartado. Nomes, e-mails, dados de consulta, userId, caminhos, objetos de
provedor, stack, payloads e campos não aprovados não passam. A presença do erro
pode ser registrada sem seu conteúdo.

Correlação conserva eventId Stripe verificado, ID técnico de emissão e digest
numérico do framework. Checkout de assinatura e leitura/emissão de PDF recebem
um UUID novo por requisição, devolvido em X-Request-ID e disponível nos logs de
falha; nunca é copiado do header do cliente. Não é identificador de pessoa nem
cookie persistente. Não adiciona serviço externo de analytics ou telemetria.

Objetos e arrays recebidos não são serializados diretamente nem têm getters ou
toJSON executados. Campos reservados do registro são definidos pelo logger. Um
teste de contrato percorre os chamadores do produto: mensagens devem ser
literais, e console bruto deve ficar restrito ao logger. Campo novo exige decisão
explícita; valores desconhecidos são omitidos em vez de liberados como fallback.

## Verificação e limites

Testes cobrem mensagens de provedor com dados sensíveis, envelope imutável,
query strings, nomes arbitrários, estruturas cíclicas, BigInt, acessores, limites
de listas, códigos e contagens preservados. A correlação é diferente entre duas
requisições simultâneas e preserva status/corpo/Retry-After da resposta.

Os testes antigos que exigiam erro bruto ou userId foram atualizados pelo novo
contrato de minimização, conservando a classificação de Auth e evidência de
falha antes do lançamento de exceção. A revisão React das duas telas afetadas
mantém hooks, conteúdo e fluxo; altera somente a emissão no console.

O filtro alcança o logger da aplicação. Logs próprios de Vercel, Supabase,
Stripe, framework e bibliotecas têm configurações/retencão separadas. IDs
técnicos ainda são correlacionáveis por operadores autorizados; não se declara
anonimização jurídica. Campos omitidos reduzem detalhe de diagnóstico; ampliar
o schema exige revisão. O pacote não cria alertas externos, tracing distribuído
completo, política de retenção ou validação de recuperação de backup.
