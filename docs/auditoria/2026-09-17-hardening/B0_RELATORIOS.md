# B0 — Execução de relatórios preservados

Base: `a8dae3b` (PR #190). Branch: `codex/relatorios-imutaveis-b0`.
Escopo: preservar entradas/versões/PDF antes das correções de domínio B1/C1.

## Pré-voo e implementação

- Produção consultada sem ler conteúdo de clientes: zero referências legadas,
  zero objetos em `relatorios`, bucket privado, tabela nova ainda ausente.
- Migração `20260918021029_immutable_report_emissions.sql` criada via CLI,
  testada em banco descartável com grants/RLS e restore.
- Snapshot no servidor, versão explícita, preparação e confirmação separadas,
  arquivos por UUID, hashes e revisões. UI só baixa depois da confirmação.
- Exclusão/portabilidade incluem os novos dados; FKs impedem perda de referências.
- Preview desta branch desabilitado: os serviços do projeto são reais.
- Decisão e limites: [ADR 0037](../../architecture/adr/0037-emissoes-imutaveis-de-relatorio.md).

## Evidência local

- 59 testes direcionados passaram: contrato, API, retenção, inventário e tela.
- Runner PostgreSQL/PostgREST: 156 verificações passaram; sete falhas antigas
  reproduzidas antes das correções; restore em banco descartável aprovado.
- Typecheck aprovado; suíte completa com 1.292 testes em 100 arquivos aprovada.
  Lint: zero erros e 115 avisos. Catálogo: 31 verificações aprovadas.
  Build de produção aprovado com variáveis fictícias, sem credenciais reais.
- Este registro antecede a publicação. Resultado final de CI, migração e deploy:
  [PR #191](https://github.com/fabianosannino/fengshuistudio/pull/191).
- Testes de UI usam mocks de renderização: aparência/captura real do PDF com
  uma sessão autenticada permanece sem atestado visual nesta execução.

## Ordem de publicação

1. Verificações locais e CI verdes no PR.
2. Repetir pré-voo, aplicar somente a migração B0, conferir grants/RLS/advisors.
3. Merge squash e deploy; confirmar SHA e readiness de produção.
4. Smoke anônimo: endpoints autenticados negam acesso e catálogo continua
   disponível. Não criar consultas ou relatórios de pessoas reais para testar.

Não foram alteradas fórmulas ou medições de consultas existentes. A próxima
etapa é B1: orientação explícita, ausência distinta de zero e sitting/facing,
com testes de referência e escopo separado.
