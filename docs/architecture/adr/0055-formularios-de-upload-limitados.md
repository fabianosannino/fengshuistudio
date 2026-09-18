# ADR 0055 — Limitar o formulário antes de interpretar arquivos

Status: aceito em 18/09/2026.

## Problema

As APIs de PDF e arquivo digital chamavam `request.formData()` antes de limitar
o tamanho. A validação posterior não limitava a memória gasta pelo parser. O
arquivo digital admitia 100 MiB, incompatíveis com o teto de 4,5 MB do corpo de
requisição da hospedagem. A substituição de arquivo também declarava sucesso
quando o UPDATE não encontrava produto e podia perder uma alteração concorrente.

## Decisão

Reutilizar um leitor limitado nas imagens, PDFs e arquivos digitais. Conferir
Content-Length quando excessivo, mas contar os bytes efetivamente recebidos
mesmo quando o header estiver ausente, incorreto ou subestimar o corpo. Cancelar
a leitura assim que exceder o teto, sem transformar falha de cancelamento em
aceitação. Um buffer único evita reter um objeto por fragmento de transporte.
Somente a região preenchida é entregue ao parser. Erros externos não são
propagados ao cliente.

Cada arquivo digital ou PDF admite até 4 MiB; o envelope multipart recebe mais
64 KiB para campos e cabeçalhos. Imagens conservam seus limites anteriores. O
total fica abaixo do limite documentado da hospedagem. A infraestrutura pode
recusar um corpo antes de chamar a aplicação; a interface previne o caso
comum conferindo o arquivo e exibindo o limite antes do envio.

O produto precisa existir antes do upload. O vínculo novo usa comparação com
o caminho anterior, inclusive quando nulo, e exige uma linha retornada. Uma
substituição/exclusão concorrente resulta em 409. Erros de leitura, Storage ou
gravação resultam em indisponibilidade, sem retornar sucesso ou apagar um objeto
potencialmente vinculado por uma escrita cujo retorno falhou. Objetos anteriores
continuam preservados; retenção/limpeza é um processo separado.

## Verificação e limites

Testes exercitam multipart real, tamanho exato, pequenos fragmentos, limite
distribuído entre fragmentos, header falso/ausente, cancelamento que falha,
transporte interrompido, produto ausente, autorização, indisponibilidade,
substituições concorrentes e falha ambígua de gravação. As APIs de PDF e imagens
mantêm seus testes de posse, confirmação imutável e decoder.

Não há migration nem alteração do teto do bucket ou dos arquivos existentes.
Downloads de arquivos antigos conservam as regras atuais. Arquivos acima de
4 MiB exigem outro fluxo autenticado de upload e validação; não se abre escrita
direta no Storage para contornar este limite.

Este pacote limita a entrada, não constitui antivírus nem validação completa
de PDF/EPUB/ZIP/áudio/vídeo. A lista de MIME de produto permanece. A conferência
básica de assinatura do PDF não prova número de páginas, ausência de conteúdo
ativo ou custo de descompressão. Um processamento de documentos isolado e
limitado continua necessário antes de afirmar esses controles como completos.

Fonte: [limites de Vercel Functions](https://vercel.com/docs/functions/limitations).
