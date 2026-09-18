# ADR 0053 — Publicar imagens somente após validação no servidor

Status: aceito em 18/09/2026.

## Problema

As APIs decodificam e normalizam imagens, mas as permissões de Storage ainda
aceitavam escrita direta do usuário autenticado. Conhecer o próprio prefixo
bastava para contornar limites, decoder, remoção de metadados e preservação de
versões. Marcadores ou hashes enviados nos metadados pelo cliente não seriam
prova da validação dos bytes.

## Decisão

Os endpoints continuam autenticando a pessoa, consultando a linha com posse
explícita e validando o corpo inteiro. Só os bytes normalizados são enviados
ao Storage com o cliente privilegiado, restrito ao servidor. Caminhos continuam
derivados do titular/consulta e UUID aleatório; não se aceita destino livre.
As gravações de vínculos mantêm a sessão do usuário e suas verificações de erro.

Políticas restritivas recusam INSERT, UPDATE e DELETE de anon/authenticated nos
três buckets de imagens, mesmo que exista uma política permissiva adicional.
A remoção permitida passa pelas APIs que conferem posse e tipo de arquivo;
uma chamada direta não pode apagar plantas históricas. SELECT e assinatura de
imagens privadas permanecem com as regras de posse existentes. Fotos públicas
de produtos continuam públicas, sem tornar os outros buckets públicos.

Como service_role ignora RLS, um trigger de Storage protege as raízes privadas
na mesma transação dos metadados. Bloqueia primeiro o perfil, depois a consulta,
recusa intenção de exclusão e relê a posse após adquirir os locks. Se a exclusão
venceu a corrida, o arquivo não é registrado; se o upload venceu, a exclusão
encontra o objeto antes de apagar a última referência. A proteção alcança também
os PDFs que já usavam service_role.

## Publicação

Duas migrations permitem a expansão sem interromper o caminho anterior:

1. Aplicar `validated_storage_writes` após os gates: instala a proteção das
   raízes, compatível com os endpoints antigos.
2. Publicar os endpoints com gravação privilegiada dos bytes validados e
   conferir o SHA READY em produção.
3. Aplicar `require_validated_image_endpoints`: fechar escritas diretas e
   conferir políticas, trigger, contagens e recusas sem sessão.

Não muda objetos existentes, donos, buckets, URLs ou conteúdo. Reversão não
deve reabrir escrita sem decoder: manter a recusa e corrigir o endpoint adiante.
Erros de upload/remoção continuam explícitos e não confirmam uma escrita falha.

## Verificação e limites

O runner PostgreSQL primeiro demonstra a escrita direta com a política antiga,
depois verifica a recusa após a migração, inclusive upsert, renomeação, troca de
bucket e política permissiva futura. Confere leitura preservada, upload de
serviço, raiz ausente e concorrência nas duas ordens com exclusão de conta ou
consulta. Testes de API usam decoder Sharp real, distinguem cliente de sessão
e de serviço e preservam recusas por ausência de posse, limite ou bytes inválidos.

O ensaio SQL cobre autorização e concorrência dos metadados, não o protocolo
HTTP completo do Storage e seu backend de objetos. Não foi feita exclusão ou
substituição de arquivo real para simular testes. Homologação autenticada com
Storage, política de retenção, restauração, análise de PDF e distribuição de
arquivos digitais maiores permanecem pendentes. service_role é a fronteira
confiável; não se declara que o PostgreSQL decodifica ou inspeciona os bytes.
