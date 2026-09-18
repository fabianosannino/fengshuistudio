# A2 — controles remotos do GitHub

Em 18/09/2026, leitura da API confirmou que master estava sem proteção e
secret scanning/push protection estavam desativados. As configurações foram
alteradas pela API oficial e conferidas novamente em leitura.

## Estado aplicado

- Master exige PR, atualizado com a base, e três checks: `Typecheck, Tests &
  Build`, `Authorization & catalog (PostgreSQL + PostgREST)` e `Dependency
  Security`. Emissor fixado no GitHub Actions, app 15368, identificado nos
  check-runs reais; um status de outro app não satisfaz o gate.
- Regras aplicadas também a administradores. Force push e exclusão de master
  desativados; histórico linear exigido.
- Zero aprovações manuais exigidas, em conformidade com o fluxo autorizado
  nesta sessão. Alterações continuam sendo revisáveis em PR, com CI obrigatório.
- Secret scanning e secret scanning push protection ativados. Padrões não
  associados a provedores e verificação de validade permanecem desativados.
  Não se ativou recurso pago nem atualização automática de dependências.

Configuração aplicada antes do merge do PR de cálculos, permitindo verificar
o fluxo normal sob as novas regras. Snapshot declarativo em
`GITHUB_CONTROLS.json`; não é um arquivo executado automaticamente pelo GitHub.

Nenhum segredo foi impresso, enviado a verificador externo manualmente ou
incluído em um commit de teste. Habilitar varredura não prova ausência de
segredos históricos; alertas requerem análise restrita e eventual rotação.
Uma leitura imediata sem alertas também não prova conclusão da varredura.

Não estão encerrados por esta alteração: restore de banco e Storage, RPO/RTO
medidos, preview com serviços realmente isolados e jornadas autenticadas.

Fontes: [proteção de branches](https://docs.github.com/en/rest/branches/branch-protection)
e [configuração de repositório](https://docs.github.com/en/rest/repos/repos).
