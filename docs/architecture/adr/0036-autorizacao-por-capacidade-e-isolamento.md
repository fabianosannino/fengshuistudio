# ADR 0036 — Autoridade administrativa no servidor e isolamento no banco

Data: 2026-09-17. Status: aceito. Complementa ADRs 0003, 0033 e 0034.

## Problema

Policies permissivas se combinam com OR. As regras antigas baseadas somente em
`is_admin()` anulavam a exigência posterior de capacidades. O próprio perfil
podia ser apagado e recriado com privilégios, pois a proteção só cobria UPDATE.
O catálogo privado também falhava por configuração de credencial do servidor.

## Decisão

- O cliente autenticado só lê e altera seu perfil comum. Criação pertence ao
  trigger de Auth; exclusão e campos de sistema pertencem às rotas autorizadas.
- O trigger usa SECURITY INVOKER e identifica o papel SQL, sem transformar
  ausência de JWT em service_role. Campos novos ficam protegidos por padrão.
- Leitura administrativa direta exige perfil ativo, AAL2 e a capacidade
  específica. Escritas e consultas entre proprietários passam pelas rotas que
  validam a sessão antes de criar o cliente de serviço.
- O papel admin sozinho não dá acesso direto a dados de outros consultores.
  Administração não altera a titularidade dos dados.
- MFA é obrigatório em produção, inclusive com o interruptor antigo desligado.
  A exceção de ambiente do ADR 0033 fica limitada a desenvolvimento e testes.
- Retornos de pagamento aceitam apenas origens configuradas e o host da preview
  fornecido pela plataforma. Cabeçalhos arbitrários não escolhem o destino.

## Implantação e recuperação

Primeiro publicar o código compatível com as novas permissões; depois aplicar
as duas migrations de autorização, que não reescrevem dados. Manter os grants
do service_role. Em regressão, restringir a operação afetada e corrigir adiante;
não restaurar as permissões vulneráveis para recuperar uma tela.

`npm run test:security` reproduz cinco falhas em identidades sintéticas e
exercita as migrations reais em PostgreSQL/PostgREST. Inclui edição comum,
cadastro, separação de proprietários, capacidades, AAL2, notificações e gravação
de sistema. O dump/restauração do banco descartável verifica linhas, grants,
RLS e trigger. Isso não equivale a restaurar o backup completo de produção nem
a testar uma sessão real de administrador no navegador.

Chaves modernas permanecem sob os nomes de variáveis existentes por
compatibilidade. Nenhuma credencial secreta deve chegar ao CI ou a uma preview
que use dados de produção.
