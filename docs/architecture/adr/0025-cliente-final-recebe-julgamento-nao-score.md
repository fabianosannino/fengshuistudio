# ADR 0025 — O cliente final recebe julgamento, não score

- **Status:** Aceito
- **Data:** 2026-08-12
- **Relaciona-se com:** ADR 0021 (modelos de pontuação escolhidos pelo consultor), ADR 0024 (papel do usuário)

## Contexto

O score de um setor é a **média de oito notas de 1 a 5** dadas por uma pessoa
numa visita, convertida para 0–100. É uma boa ferramenta de trabalho: o
consultor compara setores dentro do imóvel, compara imóveis entre si e calibra
o próprio olho ao longo do tempo.

Exibido ao morador, o mesmo número faz outra coisa. «62%» sugere uma precisão
que a medida não tem — dois dígitos para o que veio de oito julgamentos
subjetivos — e convida a comparações que ela não sustenta. «62 contra 64 no mês
passado» pode ser a mesma casa, outro dia e outro humor de quem avaliou.

E o morador não age sobre o número. Ele age sobre o setor.

O site institucional prometia «72% em harmonia» na página do cliente final,
contradizendo o que a tela agora entrega.

## Decisão

**Mesma régua, duas leituras.**

`src/lib/leitura-do-cliente.ts` traduz o score em quatro estados —
`em harmonia`, `pede atenção`, `precisa de cuidado`, `ainda não avaliado` —
usando os **mesmos** `LIMIAR_SCORE_BOM` e `LIMIAR_SCORE_CRITICO` do resto do
produto.

Um segundo conjunto de cortes só para o cliente faria a mesma casa ser «boa» na
tela do consultor e «ruim» na do morador. A leitura muda; a régua, não.

O consultor continua vendo o número inteiro, porque é ele quem calibra.

### O denominador não esconde lacuna

«Sua casa está em harmonia em 7 dos 9 setores» só é dito quando os nove foram
avaliados. Com lacunas, o denominador é o que foi olhado — «7 dos 7 setores já
avaliados». Dizer «7 de 9» com dois setores nunca avaliados transformaria
ausência em aprovação, que é o defeito que o ADR 0020 nomeia.

Casa intocada diz «Sua casa ainda não foi avaliada», não «0 de 9».

## Consequências

- As páginas institucionais (`/` e `/minha-casa`) passaram a prometer «7 dos 9
  setores em harmonia» em vez de «72% em harmonia» — promessa que a tela cumpre.
- «Não avaliado» é o quarto estado e tem aparência própria. Não é «ruim»: a casa
  que ninguém olhou não pode ser apresentada ao morador como casa com problema.
- Se um dia o produto expuser o percentual ao cliente final, esta é a decisão a
  reverter, e o lugar é um só.
