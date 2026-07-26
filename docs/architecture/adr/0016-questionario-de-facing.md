# ADR 0016 — Questionário de determinação de Facing: julgamento explícito e ambiguidade declarada

- **Status:** Aceito
- **Data:** 2026-07-26

## Contexto

§2.5 de `docs/domain/fengshui-metodos-referencia.md` trata do par Sitting/Facing
(坐/向) e o chama de **"a decisão que mais gera erro"**. O ponto central: o par é
sempre oposto exato (180°), mas determinar **qual face é a frente** não é uma
medição — é um julgamento, com uma hierarquia de critérios do mais forte ao mais
fraco, em que a **porta principal é o ÚLTIMO critério, não o primeiro**.

O documento pede um questionário que pontue os critérios e, quando o score for
próximo, **mostre as duas hipóteses concorrentes** em vez de esconder a
divergência: "praticantes divergem, e a divergência deve ser explícita, não
escondida atrás de um número".

Estado anterior, registrado no próprio documento: o app assumia que a orientação
informada **já era** o facing. Não havia julgamento nem hipóteses concorrentes.

## Decisão

`src/lib/facing.ts` (puro, testado) + `app/components/QuestionarioFacing.tsx`
(só UI), acessível como painel retrátil no modo Bússola de `bagua-planta`, ao
lado dos outros assistentes de orientação.

O consultor descreve as faces candidatas (rótulo + graus) e marca, para cada
uma, quais critérios valem. O módulo pontua, ranqueia e decide se o caso é
ambíguo.

### Os pesos são escolha própria declarada

O documento dá a **ordem**, não os números. Os pesos escolhidos —
Yang 5, fachada arquitetônica 4, sacada/maior abertura 4, água/vazio 3,
**porta principal 1** — preservam duas propriedades que a ordem sozinha não
garante, e ambas estão travadas por teste:

1. **A porta principal vale menos que qualquer outro critério isolado.** Não é
   só "a última da lista": é fraca o bastante para perder de um único critério
   mais forte. Tratá-la como decisiva é exatamente o erro que §2.5 alerta.
2. **Nenhum critério isolado vence os dois mais fortes somados** — evita que um
   único sinal domine o julgamento inteiro.

`LIMIAR_AMBIGUIDADE = 2` também é escolha própria: é menor que o peso de
qualquer critério exceto a porta, ou seja, duas faces só "empatam" quando a
diferença entre elas cabe num único sinal secundário.

### Três comportamentos que são o ponto do módulo, não detalhes

- **Ambiguidade declarada.** Quando os dois primeiros scores ficam dentro do
  limiar, o resultado devolve **as duas hipóteses**, a UI mostra "Hipótese 1" e
  "Hipótese 2" (cada uma com seus graus e sua Montanha das 24), oferece botão
  para usar qualquer uma, e avisa para gerar as duas cartas e comparar. A dúvida
  fica visível.
- **Alerta do erro clássico.** Se a face vencedora ganhou **apenas** por ter a
  porta principal, um aviso explícito dispara lembrando que porta lateral/de
  fundos é comum e que em apartamento a porta do corredor raramente é o facing.
- **Fail-closed.** Sem nenhum critério marcado, devolve `principal: null` em vez
  de eleger a primeira face por padrão. "Não sei" é resposta melhor que um chute
  com cara de resultado.

## Consequências

- Sem mudança de schema: o facing aceito escreve no mesmo `orientacaoGraus` que
  os Modos A/B/C já usam. O questionário decide **qual face** é a frente, não em
  que referência de Norte o grau foi medido — por isso **não** toca
  `orientacaoReferencia` (ADR 0014): quem informou os graus das faces já os
  informou na referência corrente.
- 20 testes novos (439 no total), incluindo os que travam as duas propriedades
  dos pesos acima, a fronteira inclusiva do limiar de ambiguidade, e o cenário
  realista de apartamento (sacada vence a porta do corredor).
- Verificado no navegador nos quatro estados: nada marcado (fail-closed), só
  porta principal (alerta do erro clássico), ambíguo (as duas hipóteses + botão
  para a segunda), e caso claro (uma hipótese, sem avisos). Sitting confirmado
  como oposto exato, com Montanhas distintas nas duas hipóteses. Zero erros de
  runtime.
- **Fora de escopo, explícito:** o documento sugere "gerando as duas cartas para
  comparação". O questionário entrega as duas hipóteses e permite alternar entre
  elas, mas **não renderiza duas cartas lado a lado** — isso exigiria duplicar
  todo o pipeline de diagnóstico (grid, Estrelas Voadoras, Ba Zhai, síntese) num
  modo comparativo, que é um projeto de UI por si só. Alternar e recalcular é a
  aproximação entregue, e está declarada como aproximação.
- As faces candidatas **não são persistidas** — só o facing aceito. Guardar o
  julgamento inteiro (quais critérios levaram àquela decisão) seria valioso para
  auditoria do laudo, e é o próximo passo natural se isso virar necessidade.
