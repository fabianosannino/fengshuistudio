# B2 — cobrança e contrato dos planos

## Entrega de aplicação (18/09/2026)

Checkout estrito, validação compartilhada de catálogo, proteção contra recriar
Customer em erro transitório, Price como fundamento da concessão, consulta ao
estado atual no webhook, falhas de escrita propagadas e preservação de
concessões independentes. Telas de planos derivam direitos da matriz efetiva.
O cadastro/callback conserva plano e ciclo, com redirecionamento validado.

Verificação local: typecheck, build com variáveis sintéticas, 1.367 testes em
104 arquivos e lint (0 erros, 115 avisos preexistentes). Há casos de corpo
inválido, configuração ausente, moeda/valor/recorrência/modo incompatíveis,
timeout de Customer, chave idempotente, assinatura existente, metadata falsa,
evento atrasado, estado não elegível, concessão de outra origem e falha de
persistência. A jornada de preços testa o link real e o total anual.

## Catálogo real conferido em leitura

Stripe MCP ainda exige reautenticação. A leitura foi possível com
`vercel env run --environment production --project <projeto verificado>`,
usando a configuração existente somente na memória de um processo Node
temporário. Nenhum `.env` foi gravado, nenhuma credencial foi impressa e
nenhuma sessão/cobrança foi criada. Seis variáveis sensíveis indisponíveis
para pull não eram necessárias a essa leitura.

| Plano/ciclo | Produto | Valor total | Moeda/intervalo | Resultado |
|---|---|---|---|---|
| Simples mensal | Plano Simples | R$ 20,00 | BRL / mês | OK live |
| Simples anual | Plano Simples | R$ 168,00 | BRL / ano | OK live |
| Profissional mensal | Professional | R$ 49,90 | BRL / mês | OK live |
| Profissional anual | Professional | R$ 411,60 | BRL / ano | OK live |

Preços e produtos ativos, cobrança fixa por unidade, intervalo de uma unidade,
dois ciclos no mesmo produto e produtos distintos entre planos conferidos.
Banco real contém uma assinatura gratuita e uma concessão de migração; ambas
preservadas. A projeção `plans.features` ainda diverge da matriz efetiva.

## Continuação B2

- Cotas e reativação sob concorrência, incluindo cadastro do próprio titular.
- Projeção de direitos no banco sem remover dados ou direitos existentes.
- Coordenação durável dos retries de checkout e eventos; unicidade de concessões.
- Ensaio financeiro no modo teste e jornada autenticada real. Testes locais
  com mocks e leitura live não são equivalentes a esses ensaios.

## B1 após deploy

PR #192 integrado em `c014cba940ac18ab4089428ba57c3e6186d24316`.
Vercel `dpl_FPpbmV5DNZavsNL6jV4tu4oQq2XS` READY, produção no mesmo SHA.
Smoke anônimo: catálogo 200 (`produtos: []`), entrada de relatório 401 e
preparação 401. Inventário sem dados pessoais: 17 consultas, 3 de bússola com
orientação legada e nenhuma confirmação retroativa. Não foram reemitidas.
