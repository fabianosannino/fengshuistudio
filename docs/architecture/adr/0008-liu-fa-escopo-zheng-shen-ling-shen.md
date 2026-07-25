# ADR 0008 — Xuan Kong Liu Fa: escopo limitado a Zheng Shen/Ling Shen

- **Status:** Aceito
- **Data:** 2026-07-25

## Contexto

`docs/domain/fengshui-prompts-modulos.md` (P6) pede a implementação de
"apenas as duas camadas de maior valor prático" do Xuan Kong Liu Fa:

1. Zheng Shen (正神) / Ling Shen (零神) por período.
2. Cheng Men (Porta da Cidade).

E instrui explicitamente: "As demais camadas (CiXiong, JinLong, AiXing)
ficam fora do MVP; registre em ADR."

## Decisão

Implementado **apenas** Zheng Shen/Ling Shen (`src/lib/liu-fa.ts`) neste
incremento. As demais três camadas do método — **Cheng Men incluído** —
ficam fora de escopo por ora:

- **Cheng Men** exige localizar a montanha secundária adjacente ao facing
  (resolução de 24 montanhas) e cruzar isso com a estrela de água do Xuan
  Kong Fei Xing *naquele* setor específico. Hoje a carta natal
  (`estrelas-voadoras.ts`) opera na resolução de 8 setores (45°), não 24
  montanhas (15°) — implementar Cheng Men corretamente exigiria primeiro
  estender a carta natal para a resolução de 24 montanhas, que é um
  trabalho maior e mais arriscado (ver `fengshui-metodos-referencia.md`
  §3, nota sobre a simplificação par/ímpar do Passo 4). Não faz sentido
  implementar Cheng Men sobre uma base de 8 setores só para "ter algo".
- **Ci Xiong, Jin Long, Ai Xing** — o próprio documento já as lista como
  fora do MVP.

Zheng Shen/Ling Shen, por outro lado, são deriváveis inteiramente do
shared kernel já existente (`trigramas.ts`, PR #92): Zheng Shen é o setor
cujo número Lo Shu **fixo** (arranjo estático do Bagua, não a grade
voadora) é igual ao número do período. Isso foi conferido durante a
revisão do documento de referência (nota já presente em
`fengshui-metodos-referencia.md`, Método 6): "Zheng Shen = Sul, Ling Shen
= Norte" no Período 9 é exatamente Sul=Li=9 e Norte=Kan=1 (oposto) no
arranjo fixo — sem precisar de nenhum dado novo ou não verificado.

**Período 5** não tem setor próprio (é o Centro, não uma das 8 direções).
`zhengShenLingShen(5)` devolve `null` em vez de adivinhar uma convenção —
textos clássicos divergem sobre a substituição do Período 5 (alguns usam
o trigrama do período anterior, outros o seguinte), e essa ambiguidade
não é resolvida aqui.

## Consequências

- Cheng Men fica bloqueado até a carta natal ganhar resolução de 24
  montanhas (dependência explícita registrada para quando esse trabalho
  entrar em pauta).
- O uso prático de Zheng Shen/Ling Shen hoje é informativo (exibido no
  painel de Estrelas Voadoras) — a aplicação real como remédio
  ("reforçar Zheng Shen, deixar Ling Shen aberto/com água") depende do
  motor de síntese/recomendações (P8), ainda não implementado.
