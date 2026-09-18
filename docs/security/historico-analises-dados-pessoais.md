# Histórico de análises — inventário e controles

- Origem: `analises_execucoes.fonte` e `resultado`, pertencentes ao consultor da
  consulta; `relatorio_emissoes.analise_id` identifica uma versão desse titular.
- Finalidade: comparar métodos/revisões e reproduzir a fonte de um relatório.
- Conteúdo: dados cadastrais permitidos do cliente/perfil, nascimento/parâmetro
  sexual quando informados, planta, orientação, mobiliário, avaliação dos setores,
  anotações e referências a fotos já existentes. A fonte usa allowlist; segredos
  e identificadores de cobrança não são copiados. Resultados não inferem identidade.
- Acesso: sessão e ownership na API, RLS no banco, SELECT autenticado; escrita
  somente pelo servidor, atualização proibida, respostas privadas/no-store.
  A listagem usa metadados e não envia todas as fontes pessoais de uma vez.
- Portabilidade: tabela incluída em `portabilidade-titular.ts`, paginação por
  `consultor_id`, teste com duas identidades em `tests/api/conta-dados.test.ts`.
- Exclusão: CASCADE a partir da consulta. Relatórios vinculados devem ser
  removidos pelo fluxo existente, depois dos respectivos arquivos. A remoção de
  conta percorre as raízes privadas do titular, inclusive objetos que só restam
  referenciados em snapshots; depois remove consultas e perfil. A RPC bloqueia
  novas versões após intenção de exclusão. Os testes SQL exercitam vínculo,
  restrição e limpeza na ordem correta, sem operar dados reais.
- Arquivos: nenhuma origem de upload ou bucket novo. As referências históricas
  apontam para os mesmos caminhos privados já cobertos por `dados-do-titular.ts`
  e pela varredura da raiz em `portabilidade-titular.ts`. Não copiar para bucket
  público nem usar uma URL histórica como autorização de acesso.
- Retenção: acompanha a consulta/conta e os critérios existentes para relatórios;
  limite de 100 versões e fonte de 2 MiB por versão. Política comercial completa
  continua pendente em AC-06; este inventário não substitui seu aceite.
- Evidência: D1-03/05/06; CI descartável PostgreSQL/PostgREST comprova permissões
  reais. Jornada Auth/Storage real permanece em AC-02/AC-04.
