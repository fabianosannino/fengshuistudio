-- `clientes.ativo` é NOT NULL mas ficou sem DEFAULT — resíduo da restauração de
-- constraints pós-incidente de 24/07, que devolveu o NOT NULL e não o default.
-- Efeito: todo cadastro de cliente pela UI falhava com 23502 e o usuário via
-- «Erro ao cadastrar cliente.» sem pista do motivo (o detalhe ficava no logger).
--
-- Já aplicada em produção; versionada aqui para que reconstruir o banco a partir
-- das migrations não recrie o schema quebrado.
--
-- Cliente novo nasce ativo; inativar é ação deliberada depois.
alter table public.clientes
  alter column ativo set default true;
