# ADR 0027 — Estado que muda com o tempo é derivado, não gravado

- **Status:** Aceito
- **Data:** 2026-08-12
- **Relaciona-se com:** ADR 0020 (lacuna declarada), ADR 0019 (erro genérico ≠ erro enganoso)

## Contexto

Três lugares do produto guardavam, numa coluna, um estado que **muda sozinho com
a passagem do tempo** — e nenhum deles tinha quem o atualizasse.

**Pagamentos.** `status` aceita `pendente | pago | atrasado | cancelado`. Nada
roda um job diário virando `pendente` em `atrasado`. A lista mostrava
«Pendente» numa parcela vencida havia três semanas, e os totais contavam a mesma
parcela duas vezes: a soma de pendentes incluía todo `status = 'pendente'` e a
de atrasados somava por cima os pendentes com data vencida. `pendente +
atrasado` dava mais que o contratado.

**Etapa da consulta.** `status` (`rascunho | em_andamento | finalizada`) não
dizia em que ponto do método a consulta estava. Uma consulta com só um nome e
outra a que faltava apenas o PDF eram ambas «em andamento».

**Pendências do consultor.** Não existiam. Um relatório concluído e nunca
emitido ficava invisível até alguém lembrar de procurar.

## Decisão

**Fato registrado por alguém fica gravado; consequência do tempo é derivada.**

| Coisa | Fonte | Por quê |
|---|---|---|
| `pago`, `cancelado` | coluna `status` | alguém registrou o fato |
| `atrasado`, `a vencer` | `data_vencimento` × hoje | a data sabe, o status não |
| Etapa do diagnóstico | dados presentes na consulta | `src/lib/etapa-do-diagnostico.ts` |
| Pendências | consultas, pagamentos e rituais | `src/lib/pendencias.ts` |

Nenhum dos três cria tabela nova ou coluna de estado. Um campo de etapa gravado
seria mais uma coisa para desincronizar do dado real — a leitura de fachada
estar lá e a etapa dizer que não é o tipo de divergência que ninguém percebe até
o relatório sair errado.

### O caso inverso também conta

`estadoDoPagamento` ignora `status = 'atrasado'` gravado numa parcela cuja data
foi renegociada para o futuro. Não é só o pendente-vencido que estava errado: o
atrasado-renegociado também.

### A etapa é a primeira pendente, não a última cumprida

Quem mediu a fachada e já prescreveu curas sem fechar o Ba Guá está **devendo o
Ba Guá** — não está na etapa Curas. «Última cumprida + 1» diria o contrário e
esconderia justamente o buraco.

## Consequências

- `totaisFinanceiros` tem uma invariante testável: `recebido + a receber +
  vencido === contratado`. Era ela que falhava.
- A coluna `status` de `pagamentos` continua existindo e continua sendo escrita
  ao dar baixa. O que deixou de existir é `'atrasado'` **como fonte de verdade**.
  Linhas antigas com esse valor gravado não precisam de migração: são ignoradas.
- A régua da parcela tem três marcos, não cinco. «Enviado» e «aberto» exigem
  link de cobrança com rastreio; desenhá-los apagados sugeriria que o produto
  sabe se o cliente abriu a cobrança, e ele não sabe.
