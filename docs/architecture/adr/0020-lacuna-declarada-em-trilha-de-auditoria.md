# ADR 0020 — Lacuna declarada em trilha de auditoria

- **Status:** Aceito
- **Data:** 2026-07-27
- **Relaciona-se com:** ADR 0019 (erro genérico ≠ erro enganoso)

## Contexto

A varredura tela a tela de 27/07 encontrou `/admin/auditoria` mostrando dois
registros datados de **01/01/1970, 00:00:00**.

A causa tem três camadas, e todas eram silenciosas:

1. `admin_audit_log.performed_at` não tinha `default` e era nullable.
2. Os três `insert` (`chaves` ×2, `promover`) não preenchiam a coluna — e não
   checavam `error`, contra o que o CLAUDE.md exige.
3. A tela renderizava `new Date(log.performed_at)`, e `new Date(null)` é a
   época Unix.

O resultado não era um erro visível: era uma **data plausível**. Alguém lendo a
tela concluiria que a chave foi gerada em 1970, não que o horário não foi
gravado.

## Decisão

`performed_at` ganha `default now()`, e os três `insert` passam a preenchê-la
explicitamente e a checar `error`.

As **linhas legadas continuam NULL**. Não há backfill.

A tela usa `dataDeAuditoria()`, que devolve «data não registrada» para nulo ou
data inválida — e formata normalmente uma época Unix *explícita*, porque `null`
é «não sei» e um `1970-01-01` gravado é um dado.

## Consequências

Backfillar seria escrever um horário que ninguém observou dentro do registro
cuja função é dizer o que aconteceu e quando. Numa trilha de auditoria isso não
é conveniência, é adulteração: o dado inventado fica indistinguível do medido.
Duas linhas com a lacuna explícita valem mais do que duas linhas com um horário
inventado — mesmo que a tela fique menos bonita.

É a ADR 0019 aplicada a dado em vez de mensagem: o problema nunca foi *não
saber*, foi **afirmar com confiança algo falso**. Ali era «senha incorreta» para
uma falha de rede; aqui é «01/01/1970» para um carimbo ausente.

## Achado irmão, mesma raiz

Na mesma varredura, `/produtos` disparava **404** a cada carregamento: consultava
`produtos_afiliados`, tabela que nunca existiu. O erro era engolido
(`const { data } = ...` sem `error`), e o catálogo estático assumia — a tela
parecia certa. A tabela foi criada com RLS (leitura para autenticados, escrita
só para admin) e a leitura passou a registrar falha no logger.

`/planos` devolvia **406** em `subscriptions`: `.single()` numa consulta que
legitimamente não tem linha para quem nunca assinou. Trocado por
`.maybeSingle()`.

O padrão comum aos três: **o erro estava sendo descartado, então o sintoma
aparecia como dado plausível em vez de falha.** É exatamente o que o CLAUDE.md
já proibia — a varredura só mostrou onde a regra não estava sendo seguida.

## Verificação

Varredura de 19 rotas × 2 viewports (1440×900 e 390×844), autenticada, contra o
banco de produção. Antes: 3 requests ≥400 e 3 erros de console. Depois: **zero**
em ambos. `/admin/auditoria` passou a exibir «data não registrada».
