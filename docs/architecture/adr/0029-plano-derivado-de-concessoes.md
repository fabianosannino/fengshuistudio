# ADR 0029 — O plano é derivado de concessões, não gravado

**Data:** 2026-08-13
**Status:** aceito
**Relacionado:** ADR 0024 (papel ≠ plano), ADR 0027 (estado derivado)

## O incidente

Em 13/08/2026, o dono da plataforma cancelou no Stripe uma assinatura do plano
Simples — sobra de um teste de pagamento. O webhook processou corretamente e
rebaixou o perfil para o gratuito.

Só que aquele perfil tinha **Profissional por chave de ativação**, concedido em
abril. O Profissional sumiu junto.

A regra «assinatura cancelada rebaixa» está certa. O que faltava era saber que
aquele Profissional não vinha daquela assinatura.

## O diagnóstico

`profiles.plano` guarda **o quê** sem guardar **de onde**.

Com uma fonte só, isso funciona. O produto tem quatro:

| origem | exemplo |
|---|---|
| assinatura | compra no Stripe |
| chave | chave de ativação resgatada |
| cortesia | acesso concedido pelo admin |
| ajuste manual | `update` direto no banco |

Cada uma pode encerrar a outra, e a coluna não tem como recusar — ela não sabe
quem escreveu o valor que está lá.

É a mesma forma dos defeitos que o projeto vem corrigindo: «atrasado» gravado
em vez de derivado da data, a etapa da consulta gravada em vez de derivada dos
dados. Aqui a informação que faltava é a **procedência**.

## A decisão

**Cada concessão é um fato com origem e prazo.** O plano efetivo é a maior
concessão viva neste instante.

```
concessoes_de_plano
  user_id | plano | origem | referencia | valido_de | valido_ate | encerrada_em
```

- `referencia` é o `sub_...`, o id da chave, o id do admin. É o que permite
  encerrar **exatamente** a concessão certa.
- `valido_ate` nulo é «sem prazo», não «vencida».
- `encerrada_em` é separado de `valido_ate` porque «venceu» e «foi revogada»
  são fatos diferentes; fundir os dois perderia o motivo.

Cancelar a assinatura encerra a concessão dela. A da chave continua de pé.

### Gratuito é a ausência de concessão

Não existe concessão de `free`. Por isso o backfill não criou linha para quem
já era gratuito, e por isso `planoDasConcessoes([])` devolve `free` sem que
isso seja omissão — é a resposta correta.

### `profiles.plano` vira projeção

Dezenas de telas leem aquela coluna. Trocar todas de uma vez seria risco sem
ganho. Ela continua existindo, mantida por `recalcularPlanoDoPerfil`, que é o
**único** lugar autorizado a escrevê-la.

Um `update` solto em qualquer outro ponto recria o defeito: um valor sem
procedência, que a próxima mudança de qualquer fonte apaga sem saber o que
apagou.

### Quando o cálculo falha, não escreve

`recalcularPlanoDoPerfil` devolve `null` e **não grava** se não conseguir ler as
concessões. Rebaixar por causa de uma consulta que falhou tiraria acesso de
quem paga — o pior desfecho possível nesta função.

## O que isto destrava

- **Responder «por que tenho este plano?»** — a política de RLS deixa o titular
  ler as próprias concessões.
- **Cortesia com prazo** sem gambiarra: `valido_ate` preenchido, e ela cai
  sozinha.
- **Auditoria**: quando o acesso mudou, por qual origem, e por quê.
- **Afiliados**, que vêm depois: comissão também é um direito com origem,
  prazo e possibilidade de estorno. A forma é a mesma.

## Alternativa descartada

«Manter a coluna e fazer o webhook recalcular a partir do que sobrou.» Não
funciona: *o que sobrou* não existe em lugar nenhum sem registrar a origem.
Essa alternativa precisa da tabela do mesmo jeito — ela só adiaria quanto do
app passaria a ler dela.

## Custo da adoção

Feita com três perfis e uma concessão. Com clientes pagando, seria migração de
dados com janela. Foi o argumento para fazer agora.
