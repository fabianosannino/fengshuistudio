# ADR 0013 — Hierarquia de precedência entre métodos e motor de síntese

- **Status:** Aceito
- **Data:** 2026-07-26

## Contexto

A Parte IV de `docs/domain/fengshui-metodos-referencia.md` argumenta que o
problema mais difícil do produto não é calcular cada método, mas decidir o
que fazer **quando dois métodos discordam** — e que sem uma política
explícita o software vira um gerador de recomendações contraditórias. O
próprio documento pede que a hierarquia de precedência seja "registrada em
ADR". Este é esse registro.

O documento também trazia uma ressalva de escopo, escrita numa revisão
anterior: a migração para uma taxonomia tipada de remédios só valeria a
pena "quando houver 2+ métodos aditivos gerando recomendações conflitantes
de verdade (hoje só Cinco Elementos e cômodo×setor alimentam o motor)".

**Essa condição agora é satisfeita.** Depois dos incrementos recentes
existem, simultaneamente: Ba Zhai com direções favoráveis por Ming Gua
(`posicionamento-mobiliario.ts`), Estrelas Voadoras com carta natal
(`estrelas-voadoras.ts`) e estrela anual (`estrela-anual.ts`). O conflito
que o documento usa como exemplo canônico — "Ba Zhai diz bom, Fei Xing diz
5 Amarelo" — deixou de ser hipotético e passou a ser computável com dados
reais. Foi o gatilho para implementar agora.

## Decisão

### A hierarquia (implementada em `PERFIS_METODOS`, `sintese-metodos.ts`)

| # | Método | Papel |
|---|---|---|
| 1 | Formas (Luan Tou) | Precede tudo. Sha Qi crítico invalida otimização de compasso. |
| 2 | Xuan Kong Fei Xing | Camada de tempo/espaço principal. |
| 3 | Ba Zhai | Compatibilidade pessoal; resolve empates dentro do que Fei Xing permite. |
| 4 | Liu Fa | Camada de resgate, quando Fei Xing dá estrutura ruim. |
| 5 | BaZi | Escolhe entre remédios já validados; **nunca cria recomendação sozinho**. |
| 6 | Da Gua / San He | Aplicados a pontos específicos, não à casa toda. |
| 7 | BTB | **Isolado, nunca combinado.** |

Duas dessas linhas não são apenas ordem, e por isso viraram propriedades
explícitas no código em vez de comentário:

- `podeCriarRecomendacao: false` para o BaZi — ele pode discordar e ser
  reportado, mas nunca decide sozinho. Testado: BaZi isolado devolve
  `neutro`, sem vencedor.
- `isolado: true` para o BTB — ele usa um mapeamento de setores
  incompatível com os métodos de bússola. Se aparecer junto de um método
  de bússola, é **descartado da decisão com aviso explícito**, porque
  misturar os dois produz um resultado que não é válido em escola alguma.
  Sozinho, decide normalmente (uma análise BTB pura é legítima — é o
  método original do produto).

### Invariante de honestidade

`resolverConflito` **sempre** devolve, junto do vencedor, a lista completa
de veredictos perdedores com a razão da perda (`divergencias`). Não existe
caminho no código que silencie uma divergência. Isso é o que permite ao
relatório ter a seção "onde as escolas divergem neste imóvel" que a Parte
IV chama de invariante — um produto que esconde divergência mente por
omissão, e num campo sem falseabilidade experimental a transparência
metodológica é o único diferencial defensável.

Detalhe de modelagem que importa: divergência é discordância de
**direção** (bom vs. ruim), não de grau. `desfavoravel` e `perigoso` são o
mesmo lado — não geram uma falsa "divergência entre escolas" quando as
duas escolas concordam que o setor é problemático.

### Taxonomia de remédios

`Remedio` implementa o modelo da Parte IV com **todos os campos de
proveniência obrigatórios** — `metodo`, `forcaEvidencia`, `custo`,
`reversibilidade`. O documento recomenda explicitamente que
`evidenceStrength` seja obrigatório desde o primeiro remédio codificado
("é mais barato nascer com o campo do que migrar dados depois"), e a
recomendação foi seguida à risca: são campos não-opcionais do tipo, então
é impossível criar um remédio sem declarar sua proveniência.

`ordenarRemedios` implementa "custo zero e reversível primeiro"
(reposicionar uma cama antes de vender um cristal). O desempate por força
de evidência, quando custo e reversibilidade empatam, é **escolha própria
declarada**, não citação do documento.

### Escopo dos veredictos hoje (`avaliacao-setor.ts`)

A ponte entre métodos e motor só emite veredictos que os cálculos
existentes realmente sustentam:

- **Fei Xing**: só a Estrela 5 (Wu Huang) gera veredicto negativo —
  consistente com o escopo já documentado (`temEstrela5` é "cautela
  universal, sem exceção entre escolas"; as outras combinações seguem
  não implementadas). Ausência de Estrela 5 devolve `neutro`, **nunca
  `favoravel`**: afirmar "favorável" só porque não há Estrela 5 seria
  inventar um veredicto que nenhum cálculo sustenta.
- **Ba Zhai**: veredicto completo, porque a divisão 4 favoráveis / 4
  desfavoráveis do Ming Gua é bem definida e já testada.
- **Formas, Liu Fa, BaZi, Da Gua/San He**: sem ponte ainda. O motor já os
  conhece e passa a considerá-los assim que alguém produzir
  `AvaliacaoMetodo` para eles — **nada no motor precisa mudar**. Para
  Formas e BaZi isso depende de dados que o app não captura de forma
  estruturada.

## Consequências

- O motor é puro e não tem nenhum call site na UI ainda. Isso é
  deliberado: a hierarquia é uma decisão de domínio que vale registrar e
  testar antes de mudar o que o consultor vê. `src/lib/recomendacoes.ts`
  (motor de texto usado por tela/detalhe/PDF) **não foi tocado** — é um
  caminho de produção que atende clientes pagantes, e reescrevê-lo para
  `Remedio` é uma refatoração de porte próprio, não um efeito colateral
  desta ADR.
- Consequência prática imediata disponível: qualquer tela pode chamar
  `sintetizarSetor` e obter, para um setor, o veredicto final + a lista de
  divergências, já com a hierarquia aplicada.
- Verificado com 32 testes, incluindo o conflito canônico do documento com
  dados reais (carta do Período 8 + grade anual de 2026) e uma checagem
  anti-vacuidade confirmando que a carta usada de fato contém Estrela 5 —
  sem ela, o teste de integração passaria sem exercitar o conflito.
- **Não resolvido, e não escondido:** a regra da Parte IV sobre moradores
  com necessidades opostas ("o sistema não escolhe silenciosamente:
  apresenta o trade-off e quem foi priorizado") não está implementada.
  Depende de um modelo de morador-por-cômodo que o schema não tem — a
  mesma lacuna já registrada para a calculadora de mobiliário do Método 2.

## Atualização (2026-07-26) — motor conectado ao relatório

A consequência registrada acima ("o motor é puro e não tem nenhum call site na
UI ainda") deixou de valer no mesmo dia. `src/lib/sintese-imovel.ts` agrega
`sintetizarSetor` sobre os 8 setores e alimenta a seção **"Onde as escolas
divergem neste imóvel"** em `app/consultas/[id]/relatorio/page.tsx` — a
invariante de honestidade da Parte IV agora chega ao cliente final, não só ao
código.

A seção mostra, por setor divergente: qual método prevaleceu e por quê, qual
discordou e com que argumento, e a razão explícita da perda (a posição na
hierarquia). Setores com veredicto `perigoso` ganham um bloco próprio de
cautela antes das divergências. É registrável/desmarcável no seletor de seções
do relatório (chave `divergencias`).

Detalhes que exigiram atenção:

- **Ano solar, não civil.** A sobreposição anual usa `dataSolar(new Date())
  .anoSolar`, não `getFullYear()` — a estrela anual muda no Li Chun (~4/fev),
  então o ano civil daria a estrela errada em janeiro. Mesmo padrão já usado
  em `bagua-planta`; a primeira versão desta seção tinha o erro e foi corrigida
  antes de mesclar.
- **Só a Escola da Bússola.** A seção não aparece em BTB: não há segunda fonte
  para conflitar, e o BTB é isolado por decisão desta própria ADR.
- **Escopo declarado na própria seção.** O texto do relatório diz quais
  métodos participaram, quais faltaram e por quê (falta data de construção,
  falta data de nascimento do cliente), que só a Estrela 5 é classificada, e em
  que referência de Norte a orientação foi lida (ADR 0014).

Verificado com dados sintéticos reais (Período 8, fachada Sul, Kua 1) num
harness isolado com Playwright: o Setor S sai como divergente — Estrela 5
natal + anual contra uma direção favorável do Ba Zhai — com a frase de
precedência correta, enquanto o Setor SW sai como perigoso **sem** divergência
(ambos os métodos concordam que é ruim). Zero erros de runtime.

Continua fora de escopo: migrar `src/lib/recomendacoes.ts` para o tipo
`Remedio`.
