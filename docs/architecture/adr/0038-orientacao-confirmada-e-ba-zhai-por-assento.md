# ADR 0038 — Orientação confirmada e Ba Zhai por assento

Data: 2026-09-18. Status: aceito para a correção delimitada B1.

## Problema e decisão

A fachada era usada diretamente para classificar a casa. No Ba Zhai, a
classificação parte do assento oposto. Valores ausentes também podiam virar
0° ou uma grade BTB silenciosamente. Leituras legadas não têm procedência
suficiente para concluir que zero foi efetivamente medido.

`lerOrientacao` conserva o número legado, mas exige estado, origem,
referência de Norte e instante de confirmação para disponibilizá-lo aos
cálculos. Zero confirmado é válido. Ângulos finitos são normalizados em
[0, 360); não finitos não produzem resultado. A tela pede confirmação
expressa, que é invalidada ao editar a leitura ou a referência.

Somente `calcularKuaDaCasa` deriva assento = fachada + 180°. Intervalos de
45° têm início inclusivo; 22,5° pertence ao próximo octante. Não há
inversão adicional da grade ou do experimento de Estrelas Voadoras.

## Evidência de domínio e vetores

[Joey Yap, Location and Direction in Eight Mansions (2006)](https://www.joeyyap.com/tutorial/tutorial-details.asp?tid=333)
identifica Kan para fachada Sul e Zhen para fachada Oeste, distinguindo casa
de Life Gua. A [Mastery Academy](https://masteryacademy.com/NewsEvent/content.asp?nid=140)
explicita a classificação pelo sitting. A [resposta de Joey Yap](https://www.joeyyap.com/askjoey-details.asp?aid=3063)
explica a oposição e fornece exemplos adicionais.

| Fachada | Assento | Kua | Grupo |
|---|---|---|---|
| 0° | 180° | 9 | Leste |
| 45° | 225° | 2 | Oeste |
| 90° | 270° | 7 | Oeste |
| 135° | 315° | 6 | Oeste |
| 180° | 0° | 1 | Leste |
| 225° | 45° | 8 | Oeste |
| 270° | 90° | 3 | Leste |
| 315° | 135° | 4 | Leste |

Os testes usam esses vetores, fronteiras ±epsilon, periodicidade e grupos.
A propriedade de quadrado mágico isolada não prova essa regra. A conferência
documental não substitui revisão humana da variante e das prescrições.

## Obsolescência e preservação

`analise_referencia` guarda versão e entradas espaciais canônicas da
finalização. O estado atual/legado/desatualizada é derivado. Planta, método,
orientação, referência, rotação, divisórias, contorno, marcações e escala
entram nessa comparação. Não há recálculo em massa nem confirmação retroativa.

O relatório e a API de preparação recusam seções dependentes de análise
obsoleta ou bússola legada/não confirmada. Relatórios gerais continuam
possíveis, assim como BTB sem bússola; BTB legado permanece compatível porque
sua grade não mudou nesta entrega. PDFs anteriores são acessados pelo
histórico imutável do ADR 0037. A nova emissão usa motor e template próprios.

A narrativa acompanha a escola selecionada. Estrelas Voadoras fica
explicitamente experimental e simplificado; a implementação em octantes
não é apresentada como carta clássica completa.

## Limites e reversão

Sem mudança de schema ou backfill. A confirmação é declaração do consultor,
não certificação metrológica. Ainda não há execução espacial transacional
independente: isso pertence à etapa D. Uma falha ao gravar setor impede
marcar a finalização como concluída. Em regressão, bloquear novas emissões
afetadas e corrigir adiante, preservando os relatórios e as entradas.
