# B1 — orientação e classificação da casa

Data: 18/09/2026. Base: master após PR #191.

- Fachada e assento separados no Ba Zhai; oito vetores, bordas e grupos documentados no ADR 0038.
- Ausência, leitura legada e Norte confirmado tratados separadamente. Sem fallback BTB ou zero nos consumidores de bússola.
- Confirmação explícita de direção e referência; edição invalida confirmação. Entrada numérica, ponteiro e teclado disponíveis.
- Referência versionada da análise; API e relatório bloqueiam seções dependentes quando dados mudam ou a bússola legada não foi revisada.
- Narrativa por escola; Estrelas Voadoras declarado experimental e simplificado.
- PDFs anteriores preservados no histórico B0. Nenhuma migration, alteração em massa ou reemissão automática.

## Verificação

`npx tsc --noEmit`, suíte completa (1.332 testes em 102 arquivos), lint
(0 erros, 115 avisos preexistentes) e build de produção com variáveis públicas
sintéticas passaram. Um teste adicional do bloqueio na tela de relatório
passou junto dos seis testes anteriores dessa tela (total esperado no CI:
1.333). A cobertura verifica cálculos, legado, obsolescência, preparação sob
ownership e fluxo de captura/salvamento, além da entrada por teclado.

Os testes jsdom não atestam layout do PDF nem sensores reais. Não há revisão
humana de domínio ou piloto de usabilidade registrado. A revisão documental
de Ba Zhai delimita esta correção; não certifica o restante dos métodos.
Preview desta branch desabilitado porque ainda compartilha serviços reais.

## Próximas entregas

B2: checkout estrito, validação de preço e preservação de concessões;
B3: comunicação comercial; C: calendário, geometria, privacidade e uploads;
D–F: execuções independentes, planta semântica e conteúdo/IA sob os gates
de evidência do plano. Stripe MCP continua exigindo reautenticação na leitura
de contas; catálogo real e ensaios financeiros não foram atestados.
