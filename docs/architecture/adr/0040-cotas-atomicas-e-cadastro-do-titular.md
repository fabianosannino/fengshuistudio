# ADR 0040 — Cotas atômicas e cadastro do titular

Status: aceito para implementação — 18/09/2026.

Contar registros numa rota antes de inserir permite que duas requisições
ocupem a mesma última vaga. O caminho direto do Supabase e a reativação também
precisam respeitar os direitos. O contrato permanece Free 3 imóveis/0 clientes
externos, Simples 10/25 e Profissional (inclusive enum legado `agencia`) sem
esses limites. Arquivados/excluídos e clientes inativos não ocupam vaga.

Triggers de admissão verificam inserção e reativação no banco. Uma linha
privada por proprietário, atualizada na mesma transação, serializa a contagem
e a admissão. Atualizar a linha, em vez de apenas um advisory lock, impede que
REPEATABLE READ use uma contagem antiga: a transação conflitante aborta com
erro de serialização. Operações entre proprietários não compartilham o lock.
Registros ativos anteriores acima da cota seguem editáveis; nenhum é removido.
As mesmas regras alcançam `service_role` para impedir bypass acidental.

`plans.features` projeta a matriz tipada de `plano-utils`, com versão explícita
e teste de igualdade de todos os recursos. Não se altera preço, assinatura ou
concessão. Configuração sem versão reconhecida falha fechada. Alterações
futuras da matriz exigem nova migration e atualização coordenada do contrato.

Um cliente pessoal identificado por `titular_id` não conta como cliente externo.
A constraint vincula titular e proprietário; índice único permite apenas um.
O backfill marca no máximo um cadastro cujo email corresponda ao Auth, sem
apagar duplicatas ou alterar contatos. A RPC sem parâmetros deriva a identidade
de `auth.uid()`, busca nome/email no banco e cria/reativa sob o mesmo lock.
Triggers impedem transferir o vínculo ou reaproveitá-lo como contato de outra
pessoa. A inserção antiga com nome/email exatos do titular continua compatível
durante o deploy. Outros dados pessoais continuam editáveis.

Funções privilegiadas têm `search_path` vazio e ficam no schema privado.
Somente a operação de obter o próprio cadastro é concedida a `authenticated`;
o wrapper público usa `SECURITY INVOKER`. RLS existente continua valendo, e
novas consultas só podem referenciar clientes do mesmo proprietário.

Não há novo arquivo de Storage. Exportação já seleciona as colunas de clientes;
a exclusão do perfil remove por cascata a linha técnica de serialização.
Ela não concede direitos nem contém conteúdo de consulta.

Validação: PostgreSQL 17 isolado, enums/FKs/políticas reais do escopo, reprodução
da corrida anterior, concorrência em READ COMMITTED e REPEATABLE READ,
reativação, isolamento, RPC pessoal, acesso privilegiado e preservação legada.
O runner não usa banco nem credenciais de produção.

Reversão: manter a migration aditiva e corrigir adiante. Aplicação anterior
continua compatível no cadastro pessoal; remover a guarda para restaurar um
bypass não é rollback aceitável.

Referências: [isolamento no PostgreSQL 17](https://www.postgresql.org/docs/17/transaction-iso.html)
e [funções no Supabase](https://supabase.com/docs/guides/database/functions).
