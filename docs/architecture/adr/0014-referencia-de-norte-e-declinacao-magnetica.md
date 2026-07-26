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
