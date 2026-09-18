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

## Varredura local do histórico e gate contínuo — 18/09/2026

Gitleaks 8.30.1, regras padrão, checkout completo e `--all --full-history
--diff-merges=first-parent`. A segunda passagem incluiu diffs de merges:
667 commits alcançáveis, 656 commits com conteúdo processados pelo scanner,
aproximadamente 29,05 MB. A primeira passagem sem diffs de merges havia coberto
467 commits; ela não foi apresentada como prova de toda a cobertura pretendida.

Dois achados eram a mesma documentação, na introdução e no merge: uma variável
NEXT_PUBLIC_SUPABASE_ANON_KEY com apenas cabeçalho JWT e reticências (39
caracteres, sem payload ou assinatura). Classificados como exemplos truncados,
sem credencial utilizável. `.gitleaksignore` contém apenas os dois fingerprints
exatos (commit, arquivo, regra e linha); nenhuma regra ou arquivo foi excluído
genericamente. Não houve rotação sem evidência nem reescrita de histórico.

`npm run test:secrets` usa imagem Docker fixada por digest, rede desabilitada,
montagens somente leitura e limites de CPU/memória/processos/tempo. Antes da
varredura Git, um valor sintético aleatório em stdin precisa ser detectado e
ocultado no relatório; esse controle nunca é credencial nem commit. O programa
não imprime relatórios brutos. Falha de Docker, timeout, saída/JSON inesperados,
checkout raso ou achado não classificado impedem sucesso.

O teste local do gate confirmou controle positivo e zero achados restantes
nas regras aplicadas, com 668 commits alcançáveis naquele instante. O CI passa
a executar esse teste no check obrigatório `Dependency Security`, preservando
as proteções existentes e buscando histórico completo. Não depende de action
externa adicional nem envia achados a serviços de validação de credenciais.

Limites: detecção por padrões/entropia não prova ausência universal de segredos.
Não alcança arquivos ignorados, outros serviços ou referências Git indisponíveis;
não abre arquivos compactados/binários como uma auditoria documental. Relatórios
locais ocultam valores e ficam ignorados. Um novo achado exige classificação e,
se real, contenção/rotação coordenada. O controle não substitui push protection.

Fonte: [Gitleaks — documentação e opções](https://github.com/gitleaks/gitleaks).

Não estão encerrados por esta alteração: restore de banco e Storage, RPO/RTO
medidos, preview com serviços realmente isolados e jornadas autenticadas.

Fontes: [proteção de branches](https://docs.github.com/en/rest/branches/branch-protection)
e [configuração de repositório](https://docs.github.com/en/rest/repos/repos).
