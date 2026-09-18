# 0043 — portabilidade e exclusão com posse e falhas verificadas

Status: implementado; 18/09/2026.

## Problema e decisão

A exportação podia terminar truncada pelo limite de linhas; leituras com erro
viravam listas vazias. A exclusão usava caminhos editáveis com service_role,
ignorava falhas e tentava apagar uma view somente de leitura. Um upload
concorrente podia sobreviver à remoção da última referência ao proprietário.

O servidor deriva o titular de getUser, pagina registros e restringe filhos às
consultas desse titular. Compras usam somente e-mail verificado. Qualquer erro
invalida a exportação inteira. O resumo da tela usa a mesma autorização; uma
contagem indisponível impede a confirmação, sem assumir zero. JSON inclui
registros e referências de arquivos, não os binários nem uma fotografia
transacional de todas as tabelas durante edições concorrentes.

Remoção valida a raiz de cada caminho, enumera também arquivos sem referência
nas pastas próprias e verifica cada resposta. Inventário é concluído antes de
remover uma página de objetos para não saltar arquivos. Falha preserva o que
ainda existe para nova tentativa; não há promessa de rollback dos arquivos já
removidos. A view pública é ocultada pela origem. Refresh tokens são revogados
globalmente antes da remoção de Auth; access tokens antigos só expiram no prazo
original e não autorizam recriar arquivos sem perfil/consulta existente.

Uma policy restritiva adicional mantém FOR KEY SHARE na referência de posse
durante INSERT/UPDATE autenticado de Storage. Triggers nas tabelas da aplicação
recusam remover consulta/perfil com objetos pendentes. As policies permissivas
anteriores continuam necessárias; leitura e remoção não ganham permissões.
Nenhum trigger é instalado nas tabelas gerenciadas de Storage.

## Vínculos comerciais

A admissão da exclusão bloqueia o perfil e grava intenção durável, acessível
somente ao servidor. Neste pacote, contas com Customer/Connect, produtos ou
cadastro de titular pertencente a outro consultor recebem 409 **antes** de
qualquer remoção. O encerramento comercial automático permanece pendente de
conciliação e teste financeiro isolado. Isso vale também para Customer antigo
sem assinatura atual: a presença do vínculo não prova dívida, mas impede a
remoção automática até que o encerramento coordenado seja implementado.

Após a admissão, um trigger impede anexar Customer/Connect. As rotas só
confirmam o vínculo se UPDATE devolve o perfil. Uma chamada externa já em
andamento pode criar um Customer/Connect vazio antes de falhar no vínculo;
reconciliação desse recurso externo pertence ao trabalho de cobrança durável.
Nenhuma cobrança é criada depois de falhar a confirmação do vínculo.

## Limites e evidências

32 verificações PostgreSQL 17 incluem uploads e exclusão em ambas as ordens,
JWT antigo, isolamento, ACL, preservação de produtos e corrida do vínculo
comercial. Testes de rotas cobrem paginação superior a mil linhas, falhas em
etapas, referência forjada e ID da sessão. A consulta Connect não aceita mais
accountId da URL para acessar dados de outra conta.

Os testes PostgreSQL exercitam policy e locks reais com schema mínimo, não a
API HTTP de Storage. service_role não participa da RLS; emissão de PDF usa as
reservas e prazos do ADR 0037. Operações privilegiadas fora desses fluxos
exigem coordenação própria. Objetos antigos cuja consulta já foi apagada antes
deste pacote precisam de inventário administrativo, sem inferir o dono pelo
nome. Produtos digitais preservam os direitos dos compradores.

Contas em exclusão podem retomar o processo; a intenção não expira para que um
retry tardio não reabra cobrança. Recuperação administrativa exige analisar o
inventário restante antes de remover essa intenção. Rollback da aplicação não
deve remover as proteções de banco nem apagar dados.

Fontes: [Storage e RLS](https://supabase.com/docs/guides/storage/security/access-control),
[revogação de sessões](https://supabase.com/docs/guides/auth/signout).
