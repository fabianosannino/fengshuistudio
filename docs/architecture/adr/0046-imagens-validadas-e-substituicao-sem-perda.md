# 0046 — imagens validadas e substituição sem perda

18/09/2026. Escopo: rotas de imagens de cliente, consulta, planta e produto.

## Decisão

MIME declarado e extensão não provam conteúdo. As quatro rotas usam o mesmo
decoder real, Sharp 0.35.4, agora dependência direta fixada. Antes de decodificar,
aceitam somente assinaturas JPEG/PNG/WebP coerentes com o MIME. Depois conferem
formato, dimensões, número de páginas e decodificam os pixels com failOn warning.
APNG e WebP animado são recusados. O reencode aplica orientação EXIF e remove
metadados. PNG/WebP preservam pixels sem perdas; JPEG é recodificado em qualidade
95 e 4:4:4. Não há redimensionamento automático da planta. Não é um antivírus.

Entrada e saída limitadas a 4 MiB, ou 2 MiB para foto de produto; até 24 milhões
de pixels, 8192 por lado, timeout de processamento de 10 segundos por imagem.
O multipart inteiro tem teto de 4 MiB + 64 KiB, abaixo dos 4,5 MB da hospedagem.
O leitor contabiliza o stream mesmo sem Content-Length. Lotes têm no máximo
dez imagens e são validados integralmente antes da primeira escrita. Interface
informa o limite agregado e não promete mais envio de 5/10 MB por essa rota.

Planta e foto de cliente recebem UUID por versão com upsert false. Substituir
não apaga o objeto anterior antes de confirmar o novo vínculo. A foto do cliente
usa comparação do valor anterior e verificação da linha atualizada; alteração
concorrente devolve 409. Falha ambígua no vínculo não apaga o objeto recém-enviado,
pois o banco pode ter confirmado sem a resposta chegar. Plantas anteriores são
preservadas para os registros de análise; a rota genérica de remover foto não
as remove. O editor só muda de imagem depois de confirmar upload e vínculo.

## Retenção e fronteiras

Não surgem buckets nem colunas novas. O inventário mantém foto_url, imagens
da consulta e bagua_entrada.planta_url. A exclusão da conta/consulta enumera
raízes recursivamente, incluindo as versões e órfãos nas mesmas raízes.
Substituição individual pode conservar versões até a exclusão do titular;
limpeza seletiva por referências e prazo continua pendente. Remover foto do
perfil com falha física informa 503; o inventário do titular alcança o órfão.

O pacote valida **as rotas do app**. As permissões autenticadas de Storage
continuam vinculadas ao dono por RLS, mas ainda permitem chamadas diretas de
um proprietário à API de Storage, fora do decoder. Tornar a normalização uma
condição de toda escrita exige uma fronteira própria entre upload, validação
e publicação, preservando os locks de exclusão. Não declarar a validação
do conteúdo como uma garantia global do bucket nesta etapa.

Arquivos de produtos digitais e PDFs de relatórios têm contratos distintos;
este pacote não anuncia varredura antimalware, upload grande por partes nem
normalização de arquivos históricos. Storage + linha ainda não são uma única
transação. Falha parcial de lote tenta remover apenas objetos dessa tentativa;
falha de limpeza é registrada e continua coberta pela exclusão do titular.

## Verificação

Testes Node usam multipart, File e Sharp reais: conteúdo falsificado, truncado,
animação, dimensões, metadados privados, orientação, transparência e limite do
stream sem tamanho confiável. Testes de rota usam decoder real e simulação de
Storage/banco para posse, falhas e concorrência. Teste de inventário alcança as
duas versões de foto e planta. Não equivale a ensaio autenticado de Storage HTTP
ou a validação visual completa do editor.

Referências: [construtor Sharp](https://sharp.pixelplumbing.com/api-constructor/),
[saída e metadados](https://sharp.pixelplumbing.com/api-output/),
[limites da hospedagem](https://vercel.com/docs/functions/limitations).
