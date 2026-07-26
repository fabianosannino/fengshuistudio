# ADR 0014 — Referência de Norte explícita; declinação informada, não calculada

- **Status:** Aceito
- **Data:** 2026-07-26

## Contexto

`docs/domain/fengshui-metodos-referencia.md` §2.1 exige que o sistema guarde
sempre a leitura bruta **mais a referência** (magnético ou verdadeiro),
calcule a declinação via WMM/IGRF e ofereça a conversão, alertando que no
Brasil a declinação varia de ~−23° (RS) a ~−8° (NE) — diferença de **1 a 2
Montanhas das 24** — e que "ignorar isso invalida a carta".

O app tinha um problema mais básico e mais urgente que o modelo geomagnético:
**misturava as duas referências sem declarar qual era qual.** O campo
`orientacao_graus` guardava um número solto. Os Modos A e B (entrada manual e
bússola do dispositivo) produzem Norte **magnético**; o Modo C (satélite,
entregue na ADR 0012) produz Norte **verdadeiro**. Os três escreviam no mesmo
campo. Quem reabrisse a consulta depois não tinha como saber qual era —
inclusive o próprio sistema, ao recalcular a carta.

Essa perda de informação existe independentemente de haver modelo de
declinação, e é ela que efetivamente invalida a carta.

## Decisão

### 1. A referência passa a ser dado de primeira classe

`ReferenciaNorte = 'magnetico' | 'verdadeiro'` em
`src/lib/declinacao-magnetica.ts`, persistida em
`bagua_entrada.orientacao_referencia`, exibida em toda parte da UI que mostra
graus (o rótulo do campo, o resumo do passo "resultado"), e **declarada na
origem** por cada modo de captura: o Modo B marca `magnetico` (magnetômetro lê
como o Luo Pan), o Modo C marca `verdadeiro` (Web Mercator).

Retrocompatibilidade explícita: consultas anteriores a este campo assumem
`magnetico`, porque era o que o rótulo do campo dizia na época ("direção
magnética que a fachada encara"). É uma leitura do que a UI prometia ao
consultor, não uma suposição nova.

### 2. A declinação é **informada**, não calculada — e por quê

**Não implementei WMM/IGRF.** O núcleo desses modelos é uma tabela oficial de
~90 coeficientes harmônicos esféricos de Gauss, revisada a cada 5 anos, e as
fontes primárias (NOAA/NGDC) estão inacessíveis deste ambiente de
desenvolvimento — verificado, não presumido.

Reproduzir esses coeficientes de memória seria exatamente o erro que o
documento de referência alerta para as tabelas de San He e Xuan Kong Da Gua
("não codificar de memória, buscar fonte publicada"), com um agravante que
torna o caso pior: um coeficiente errado **não falha de forma visível**. Ele
devolve um número plausível e errado, que desloca a Montanha silenciosamente —
precisamente o dano que esta ADR existe para evitar. Um modelo geomagnético
falso é pior que nenhum modelo.

Então: o consultor informa a declinação do local, obtida na calculadora
oficial do NOAA (link direto na UI), e o módulo faz a conversão — que é
aritmética trivial e inequívoca:

```
verdadeiro = magnético + declinação      (declinação positiva = Leste, padrão IGRF)
magnético  = verdadeiro − declinação
```

### 3. Fail-closed em vez de assumir zero

`converterLeitura` devolve `null` quando a declinação é desconhecida ou
implausível — **nunca assume zero**. Assumir zero é o erro exato que este
módulo existe para impedir: no Brasil equivaleria a errar de 1 a 2 Montanhas
enquanto exibe um resultado de aparência normal.

`declinacaoPlausivel` barra valores fora de ±60°. O limite físico real chega a
±180° perto dos polos magnéticos, mas para imóveis habitados ±60° é folgado (o
Brasil inteiro cabe em −23°..−8°) e pega o erro de digitação realista — teclar
`180` em vez de `-18` giraria a carta meio círculo.

### 4. Aviso ativo de troca de Montanha

Quando a leitura convertida cai numa Montanha diferente da original, a UI
avisa explicitamente ("As duas referências caem em Montanhas diferentes:
Gui vs Ren — confirme qual referência sua medição usou"). Não é um número
escondido num tooltip: é o ponto em que a carta pode estar errada.

## Consequências

- Nenhuma migração de banco: `bagua_entrada` é JSONB, os dois campos novos
  (`orientacao_referencia`, `declinacao_magnetica`) entram sem DDL.
- 17 testes novos, incluindo dois de **impacto de domínio** que não testam a
  aritmética mas a consequência: uma leitura de 10° em São Paulo (declinação
  −21°) é a Montanha **Ren** em Norte verdadeiro e **Gui** se a referência for
  ignorada. É o bug concreto, virado teste.
- Verificado no navegador (Playwright, página temporária depois removida): a
  conversão nos dois sentidos, a simetria (10° magnético → 349° verdadeiro;
  10° verdadeiro → 31° magnético), o aviso de troca de Montanha, e os dois
  caminhos fail-closed (sem declinação e com declinação implausível).
- **O encaixe para o WMM está pronto.** Quando a tabela oficial estiver
  disponível, basta preencher `declinacao` a partir de lat/long/data em vez de
  vir do formulário — `converterLeitura` e todo o resto seguem iguais.
- **Não resolvido, e não escondido:** a carta continua sendo calculada com o
  grau na referência que o consultor escolheu, sem forçar uma canônica. O
  clássico é magnético; deixar essa escolha explícita e visível é melhor que
  converter silenciosamente por trás, mas significa que duas consultas podem
  usar referências diferentes. Padronizar exigiria decidir uma política de
  produto e migrar dados existentes.

## Atualização (2026-07-26) — o WMM entrou, e o critério NÃO mudou

Esta ADR recusou calcular a declinação a partir de lat/long/data, porque a
tabela de ~90 coeficientes harmônicos de Gauss não estava disponível de fonte
primária, e **um coeficiente errado não falha de forma visível — devolve um
número plausível e errado**.

Esse critério continua valendo. O que mudou é que a fonte apareceu: o pacote
npm **`geomagnetism`** embute os arquivos oficiais de coeficientes do NOAA/NGDC
(`data/wmm-2025.json`, epoch 2025, `num_terms: 90` — exatamente a contagem que
esta ADR citou). Não estamos transcrevendo números; estamos usando a tabela
oficial. É a diferença entre citar uma fonte e chutar, que é a linha desta ADR
desde o começo.

O "encaixe para o WMM" prometido acima foi usado como estava: `converterLeitura`
e todo o resto seguem iguais. Só a origem do campo `declinacao` mudou.

### Como ficou

- **`src/lib/declinacao-automatica.ts`** — `declinacaoAutomatica(lat, lon, data)`
  devolve um resultado discriminado (`{ok:true, declinacao, modelo, validoAte}`
  ou `{ok:false, motivo}`). Nunca devolve zero como padrão.
- **`app/api/declinacao/route.ts`** — rota autenticada e com rate limit. É
  servidor, não cliente, porque o pacote é CJS e carrega ~4 arquivos JSON de
  coeficientes; no bundle de uma página que já tem canvas, mapa e PDF seria peso
  morto. Devolve **422** (não 500) quando o modelo não atende: a entrada é
  válida, o modelo é que não cobre — e o cliente deve cair para a entrada manual.
- **UI (`bagua-planta`)** — botão "Calcular pela minha localização" ao lado do
  campo manual, que **continua existindo**. O link para a calculadora do NOAA
  também continua.

### A armadilha que isto fecha: modelo expirado

Cada ciclo WMM vale ~5 anos (o vigente vai até **2029-11-13**). Fora da janela,
o campo real já divergiu do modelo. `geomagnetism` **lança** nesse caso em vez
de extrapolar, e o wrapper preserva isso devolvendo `ok:false`.

Consequência deliberada: quando o WMM2025 expirar, o cálculo automático **para
de funcionar** e a entrada manual volta a ser o caminho — não degrada em
silêncio. Para reativar basta atualizar o pacote; o `end_date` vem do arquivo de
dados, não está hardcoded. Um teste usa data de 2040 justamente para travar isso.

### Proveniência aparece na tela

A UI mostra qual modelo produziu o número e até quando ele vale. E `declinacaoAuto`
é **limpo** quando o consultor digita à mão ou quando o valor vem do banco: o app
nunca atribui ao WMM um número que não saiu dele. Foi por isso que a restauração
de consulta salva também limpa esse estado — o banco guarda o número, não a sua
origem.

### O que este módulo continua NÃO sendo

**Não é conteúdo de Feng Shui**, e não deve ser citado como tal: é geofísica
aplicada, pré-processamento do dado de entrada. Nenhuma obra de Feng Shui traz
(nem deveria trazer) coeficientes de campo geomagnético — conferido no corpus de
`docs/Books` e corroborado por auditoria independente de um segundo acervo.

### Erro encontrado durante a implementação

A primeira versão lia os metadados do modelo em `m.model.name` / `m.model.end_date`.
Esse sub-objeto **não existe** — os campos ficam no próprio objeto retornado
(`m.name`, e `m.end_date` como `Date`, não string). O resultado era nome caindo
num fallback `'WMM'` e `validoAte` vazio virando `Invalid Date` na tela. Pego pelo
teste de proveniência, não por leitura de código: o teste exigia que
`validoAte` fosse uma data no futuro, e `NaN` não é.

### Fora de escopo, e agora com fontes nomeadas

Kong Wang, San He e Xuan Kong Da Gua continuam sem implementação. Uma auditoria
independente de um segundo acervo (cursos e manuais em português) chegou à mesma
conclusão por caminho diferente, e acrescentou duas referências que resolvem os
gaps, além das já citadas (Skinner, *Guide to the Feng Shui Compass*; *Shen Shi
Xuan Kong Xue* 沈氏玄空學):

- **San He / Fórmulas da Água:** *Di Li Wu Jue* (地理五訣, Zhao Jiufeng) — apontado
  como a referência-padrão moderna para as fórmulas completas; alternativa
  clássica: *Shui Long Jing* (水龍經).
- **Da Gua:** a ordenação dos 64 hexagramas no círculo (Fu Xi vs. King Wen vs.
  ordenação própria do Da Gua) muda o resultado e não está em nenhum dos dois
  acervos. Dividir 360°/64 = 5,625° sem a ordenação correta produziria uma
  tabela precisa e errada.
