# Instruções para agentes

Leia e siga [CLAUDE.md](CLAUDE.md), que contém as regras de engenharia,
segurança, arquitetura, validação e publicação deste repositório.

Antes de propor ou executar uma etapa, consulte a lista canônica
[STATUS_E_PROXIMAS_ETAPAS.md](docs/auditoria/2026-09-17-hardening/STATUS_E_PROXIMAS_ETAPAS.md).
Atualize a lista na mesma entrega; uma pendência externa permanece aberta até
existir evidência de seu aceite, mesmo que o código relacionado esteja pronto.

Toda funcionalidade, correção ou melhoria precisa de um cenário de validação
rastreável: contexto/dados, ação, resultado esperado, forma de execução e
evidência/limitação. Corrigir um defeito exige cobrir sua reprodução. Preferir
testes automatizados para comportamento; para mudanças documentais ou visuais
não cobertas pela automação, registrar a revisão manual apropriada. Não declarar
um teste como executado só porque seu cenário foi escrito.
