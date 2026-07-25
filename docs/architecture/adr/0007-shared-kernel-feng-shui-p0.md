# ADR 0007 — Shared kernel de Feng Shui (P0) adaptado à estrutura standalone

- **Status:** Aceito
- **Data:** 2026-07-25

## Contexto

`docs/domain/fengshui-prompts-modulos.md` (P0) especifica o bootstrap de um
shared kernel de domínio Feng Shui como parte de um monorepo novo:
`packages/fengshui-shared-kernel/` + um schema Supabase novo
(`tenants, users, clients, properties, occupants, analyses`).

Isso conflita com o estado real do repositório:

- `CLAUDE.md` é explícito: *"Não é monorepo — estrutura standalone"*.
- O schema já em produção usa outro modelo, com dados reais de clientes
  pagantes via Stripe Connect: `profiles`, `clientes`, `consultas`,
  `setores_bagua` (ver `docs/domain/glossary.md`).
- `src/lib/` já implementa parte do domínio (`cinco-elementos.ts`,
  `ming-gua.ts`, `oito-mansoes.ts`, `estrelas-voadoras.ts`, `bagua-grid.ts`),
  com nomenclatura em português, testado e em produção.

Executar o P0 ao pé da letra criaria uma estrutura de pastas e um schema
paralelos e incompatíveis com o que já está no ar.

## Decisão

1. **Sem monorepo, sem `packages/`.** O shared kernel vive em `src/lib/`,
   como os demais módulos de domínio já existentes — arquivos novos,
   `kebab-case`, sem dependência de framework (nenhum import de `next` ou
   `@supabase/*`), funções puras testadas.
2. **Sem schema novo.** Nenhuma tabela `tenants/users/clients/properties/
   occupants/analyses` foi criada. O multi-tenant já existe via
   `consultor_id` em `clientes`/`consultas`, com RLS (ADR 0003).
3. **Nomenclatura em português, não pinyin.** O prompt P0 pede identificadores
   em pinyin (`Degrees`, `Mountain`, `WuXing`...). Mantivemos o padrão já
   estabelecido pelo glossário (`docs/domain/glossary.md`) e pelos arquivos
   vizinhos (`cinco-elementos.ts`, `oito-mansoes.ts`): termos técnicos em
   português, para consistência com o código já em produção.
4. **Calendário solar de precisão fica pendente.** O P0 exige efemérides de
   Li Chun/Jie Qi com precisão de minuto (1900–2100). Isso já está sinalizado
   como débito conhecido em `fengshui-metodos-referencia.md` §1.6: hoje
   `ming-gua.ts` e `estrelas-voadoras.ts` usam a aproximação fixa "antes de
   4/fev conta o ano anterior". Esta ADR **consolida** essa aproximação numa
   única função (`src/lib/data-solar.ts`, `dataSolar()`) em vez de deixá-la
   duplicada em dois arquivos, mas **não** implementa a efeméride real —
   fabricar uma tabela astronômica sem fonte verificada seria pior do que a
   aproximação atual. A escolha entre tabela pré-computada versionada e
   biblioteca astronômica fica para uma ADR futura, quando for necessária
   (ex.: estrela mensal do Método 3, que depende dos 24 Jie Qi).

## O que foi criado

| Arquivo | Papel |
|---|---|
| `src/lib/graus.ts` | Aritmética circular de graus: `normalizarGraus`, `distanciaCircular`, `mediaCircular` (atan2), `desvioCircular`. |
| `src/lib/trigramas.ts` | Os 8 trigramas (bits, número Lo Shu, elemento, direção, família) — cross-validado contra `LO_SHU_POR_OCTANTE` já implementado. |
| `src/lib/montanhas.ts` | As 24 Montanhas (faixa, setor, Yuan Long, polaridade). **Não** inclui detecção de Kong Wang — os graus citados no documento de referência para isso seguem pendentes de verificação com fonte primária. |
| `src/lib/lo-shu.ts` | Trajetória de voo do Lo Shu (`CAMINHO_VOO`, `construirGridVoo`) — extraída de `estrelas-voadoras.ts` para ser reaproveitada por métodos futuros (estrela anual/mensal, San He). |
| `src/lib/data-solar.ts` | `dataSolar()` — ano civil + ano solar (Li Chun aproximado), fonte única antes duplicada em `ming-gua.ts` e `estrelas-voadoras.ts`. |
| `src/lib/periodo-sanyuan.ts` | Período San Yuan (1-9) a partir do ano solar — extraído de `estrelas-voadoras.ts`, que agora reexporta `periodoDaConstrucao` como alias. |
| `src/lib/cinco-elementos.ts` | Adicionado `elementoQueExaure` (ciclo Xie/exaustão) — faltava o terceiro ciclo dos três descritos em `fengshui-metodos-referencia.md` §1.1. |

Nenhum call site existente mudou de comportamento: `periodoDaConstrucao` e
`calcularMingGua`/`calcularKuaDaCasa` continuam com a mesma assinatura e os
mesmos resultados (cobertos pelos testes existentes, que passaram sem
alteração).

## Consequências

- P1 (motor de orientação) pode agora construir `OrientationReading` sobre
  `graus.ts` + `montanhas.ts` em vez de reinventar a aritmética circular.
- A resolução de 24 montanhas (15°) fica disponível para quando P1/P5
  precisarem dela; o app continua operando em 8 setores (45°) até que a UI
  de captura de orientação seja refeita (P1) — isso é uma limitação de UI/
  captura, não do shared kernel.
- Débito técnico do calendário solar permanece documentado e rastreável,
  não escondido atrás de uma "correção" não verificada.
