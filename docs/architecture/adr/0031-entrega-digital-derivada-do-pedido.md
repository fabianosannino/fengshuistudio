# ADR 0031 — A entrega do bem digital é derivada do pedido, não liberada por flag

**Data:** 2026-08-14
**Status:** aceito
**Relacionado:** ADR 0022 (fotos por URL assinada), ADR 0027 (estado derivado),
ADR 0028 (projeção pública), ADR 0030 (pedido como máquina de estados)
**Modelo completo:** `docs/domain/modelo-da-loja.md`, fase 2

## O contexto

A fase 2 da loja abre o segundo trilho de venda: a **plataforma** como
vendedora do próprio bem, começando pelo digital. Cobrança na nossa conta, sem
conta conectada, sem comissão a reter — e, pela primeira vez, uma obrigação de
**entrega** deste lado.

Entregar arquivo levanta uma pergunta que serviço não levantava: *quem pode
baixar, e até quando?*

## A resposta óbvia, e por que ela é a errada

O caminho natural seria uma coluna: `download_liberado`, escrita quando o
pagamento confirma. A rota de download leria a coluna e pronto.

Seria a terceira encarnação do mesmo defeito que este projeto vem desfazendo:

| onde | o que era gravado | o que envelhecia |
|---|---|---|
| ADR 0027 | «atrasado» no pagamento | a data de vencimento passava sozinha |
| ADR 0029 | `profiles.plano` | cancelar assinatura apagava plano vindo de chave |
| aqui | `download_liberado` | reembolso, cancelamento e disputa não a desfariam |

Um reembolso é um evento que chega **de fora**, pelo webhook, e não passa por
onde a coluna seria escrita. O comprador continuaria baixando o produto que já
teve o dinheiro de volta — e nada quebraria, que é o pior formato de erro.

## A decisão

**O direito de baixar é calculado na hora, de duas coisas que já existem:**

1. **posse do token público do pedido** — o comprador não tem conta, então não
   há `auth.uid()` para o RLS comparar (seção 9 do modelo da loja);
2. **`pedidoRendeuReceita(eventos)`** — o dinheiro entrou e não voltou,
   derivado da precedência entre os eventos.

Nenhuma coluna nova. Reembolso encerra o acesso porque muda o estado derivado,
não porque alguém lembrou de revogar.

### Consequência declarada: devolução solicitada ainda baixa

`devolucao_solicitada` tem precedência **abaixo** de `reembolsado`, então o
acesso continua até o estorno. É deliberado: o pedido de devolução é uma
pendência do vendedor, não o fim da compra. Enquanto o dinheiro não voltou, o
comprador tem o que pagou.

### O arquivo mora em bucket privado, e a URL nasce no clique

O bucket `produtos-digitais` é privado e não tem policy em `storage.objects`:
nem `anon` nem `authenticated` alcançam o objeto. O download sai por URL
assinada de **cinco minutos**, emitida depois da conferência e nunca gravada.

A diferença para as fotos (ADR 0022) é de grau e importa: lá o bucket público
vazava dado pessoal; aqui vazaria **a mercadoria**. Por isso a validade é de
minutos, e não da hora que as imagens usam — um link de horas viraria endereço
repassável.

### O tipo do pedido passou a distinguir digital de físico

`pedidos.tipo` tinha `bem_proprio`. Passou a ter `bem_proprio_digital` e
`bem_proprio_fisico`, porque o prazo do art. 49 conta de marcos diferentes:
físico da entrega, digital do pagamento.

Com um `bem_proprio` só, um e-book cairia no ramo do físico e esperaria um
evento `entregue` que nunca acontece: o prazo ficaria `null` para sempre e o
comprador **nunca** conseguiria pedir devolução. O direito existiria no CDC e
não existiria no app.

A troca foi segura porque a coluna nunca recebeu esse valor — as quatro linhas
em produção eram todas `servico`, conferido antes da migration.

### O razão ganhou a parte «quem vendeu»

`registrarLancamentosDaVenda` escrevia `recebedor: 'consultor'` fixo. Numa
venda nossa isso diria que o dinheiro foi para um consultor que não existe no
pedido. O saldo continuaria fechando — ele fecha por construção —, e a resposta
a «quanto os consultores receberam?» é que ficaria errada, em silêncio.

Agora o vendedor é parâmetro, tirado de `pedidos.vendedor_tipo`.

## O que isto custa

- **Uma consulta por download.** O pedido e os eventos são lidos a cada clique,
  em vez de uma leitura de coluna. É o preço de a resposta ser sempre atual.
- **Nenhum link permanente.** Quem quiser guardar o arquivo precisa baixá-lo; o
  link não sobrevive. É o comportamento certo para mercadoria, e precisa estar
  claro na tela para não parecer defeito.

## Alternativa considerada

**Token de download próprio, de longa duração, enviado por e-mail.** Recusada:
seria um segundo segredo com ciclo de vida próprio, que precisaria ser revogado
no reembolso — e revogação que depende de lembrar é o defeito de novo, agora em
duplicidade.
