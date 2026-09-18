# Cadastro de mobiliário — inventário e controles

- Origem: `consultas.mobiliario`, JSONB versionado, pertencente ao consultor da consulta.
- Conteúdo: ambiente, móvel, setor, posição na planta, direção e referência/origem.
  Nome curto/apelido, data completa de nascimento e parâmetro sexual da fórmula
  são opcionais; necessários somente para a leitura pessoal quando informados.
- Finalidade: registrar posicionamentos e comparar direções ao Ming Gua escolhido.
  Nenhuma inferência automática de sexo, pessoa, Norte ou nascimento.
- Acesso: sessão autenticada, ownership no servidor e RLS de consultas. RPC invoker
  sem grants anon/PUBLIC. Respostas privadas/no-store; sem dados de cadastro nos logs.
- Concorrência: revisão otimista e geometria original comparadas no UPDATE atômico.
  A planta e o cadastro possuem colunas independentes.
- Portabilidade: exportação paginada do titular inclui a coluna somente em suas
  consultas; cenário em `tests/api/conta-dados.test.ts`.
- Exclusão: acompanha a consulta/conta. Não há upload ou tabela filha nova. Teste
  PostgreSQL descarta a consulta sintética e verifica ausência do conteúdo.
- Relatórios: fonte de novas emissões guarda o cadastro na versão privada;
  nenhuma data de morador é acrescentada automaticamente ao PDF. Emissões antigas
  seguem a política de histórico/retencão já existente, sem reescrita.
- Homologação: isolamento real e jornada física permanecem nos critérios A–C;
  os testes locais não certificam retenção comercial ou revisão de domínio.
