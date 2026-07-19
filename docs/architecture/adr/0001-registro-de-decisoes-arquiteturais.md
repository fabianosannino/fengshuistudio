# ADR 0001 — Registro de Decisões Arquiteturais (ADR)

- **Status:** Aceito
- **Data:** 2026-07-19

## Contexto

O FengShui Studio nasceu como MVP e cresceu sem registro das decisões
arquiteturais. A auditoria de 2026-07-18
(`docs/auditoria/2026-07-18-auditoria-arquitetura-seguranca.md`) apontou a
ausência de ADRs como débito: decisões relevantes (modelo de pagamentos,
autorização, CSP, storage) estavam só na cabeça de quem as tomou ou implícitas
no código, o que dificulta manutenção e onboarding.

## Decisão

Adotar **Architecture Decision Records** em `docs/architecture/adr/`, numerados
sequencialmente (`NNNN-titulo.md`). Toda decisão arquiteturalmente relevante
(troca de banco, novo provedor de pagamento/LLM, mudança de padrão de auth,
biblioteca crítica) vira um ADR novo. ADRs são imutáveis; para reverter uma
decisão, cria-se um novo ADR que **supersede** o anterior (referenciando-o).

Template obrigatório: **Contexto → Decisão → Consequências → Alternativas.**

Este conjunto inicial documenta retroativamente as decisões já em vigor
(0002–0005).

## Consequências

- **Positivo:** decisões passam a ter rastro e justificativa; revisões de PR
  podem apontar "isso contraria o ADR 000X".
- **Positivo:** onboarding mais rápido.
- **Custo:** disciplina de escrever um ADR antes de decisões grandes.

## Alternativas consideradas

- **Não documentar (status quo):** rejeitado — foi justamente o débito apontado.
- **Documentar em wiki externa:** rejeitado — versionar junto ao código mantém
  a decisão sincronizada com o commit que a implementa.
