# C1/C2 — ano solar e geometria

Entregas e limitações técnicas no ADR 0044. Nova versão exige revisão das
plantas antes de emitir novamente as seções dependentes, preservando PDFs.

Datas inválidas não geram resultado. Fronteiras sem hora/fuso ficam
indeterminadas. Tabela astronômica reproduzível, 237 anos, dependência MIT
fixada e quatro âncoras independentes HKO. Ciclo anual contínuo, inclusive
1999/2000. Geometria usa células reais e união das marcações, com entradas
inválidas recusadas e teste independente de área em L.

Pendências de aceite: revisão por especialista da variante tradicional,
jornada autenticada visual, coleta de hora/fuso e dados de plantas reais
autorizados para piloto. Não se afirma que testes aritméticos resolvem essas
pendências. Etapa E (planta semântica, acessibilidade e desempenho de uso
completo) permanece separada.

Validação local: 1.528 testes em 116 arquivos, typecheck, build sintético e
lint (zero erros, 105 avisos anteriores). Gerador reproduziu os 237 anos
exatamente. A revisão React manteve o cálculo fora dos componentes e a
biblioteca astronômica fora do bundle cliente; avisos são derivados da entrada.
