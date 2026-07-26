# Curadoria das dicas — planilha de trabalho

> **Gerado** a partir de `src/lib/constants.ts` + `src/lib/dicas-classificadas.ts`.
> Não editar à mão: regenere se as dicas mudarem.

## O que falta você fazer

São 94 dicas no total, mas apenas **77 textos únicos** (17 são cópias literais
entre setores duplicados — Centro/Centro-Saúde, Pessoas Uteis/Úteis,
Fama/Fama-Reputação e algumas repetidas entre Filhos e Criatividade). Como o
catálogo é indexado pelo texto, as repetidas compartilham uma classificação.

Dessas 77, **1 não é acionável** (ver o fim deste documento), então restam
**76 dicas** para curar.

**Custo, Desfazer e Mecanismo já vêm preenchidos como sugestão** — saem da
leitura do texto, não de Feng Shui. Revise e corrija o que discordar.

**Só a coluna "Evidência" depende de você.** Para cada dica, decida:

| Valor | Quando usar |
|---|---|
| `consenso-classico` | A recomendação é consolidada na literatura clássica, sem divergência relevante entre escolas |
| `variante-de-escola` | É praticada, mas é característica de uma escola/linhagem específica |
| `tradicao-popular` | Uso popular difundido, sem respaldo clássico claro |

## Como registrar

Acrescente **uma linha** em `src/lib/dicas-classificadas.ts`, dentro de
`CURADORIA_EVIDENCIA`, usando o texto exato como chave:

```ts
'Mantenha o caminho até a porta livre': 'consenso-classico',
```

Pronto — a dica passa a aparecer na seção **"Plano de Ação"** do relatório,
ordenada por custo/reversibilidade. Funciona incrementalmente: cure 5 e já
verá 5 no relatório.

Se discordar de uma sugestão mecânica, edite `SUGESTOES_MECANICAS` no mesmo
arquivo.

---

## Dicas por setor

### Carreira

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Adicione elemento água: aquário, fonte ou imagem de rio | baixo | facil | elemento | |
| Use tons pretos, azul escuro e ondulados | baixo | facil | elemento | |
| Coloque espelho estrategicamente para ampliar o espaço | baixo | facil | ativacao | |
| Mantenha o caminho até a porta livre | zero | instantanea | layout | |
| Adicione cristais negros como obsidiana | baixo | facil | elemento | |

### Conhecimento

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Crie espaço de estudo ou leitura tranquilo | medio | facil | layout | |
| Use tons azul-escuro, verde e preto | baixo | facil | elemento | |
| Adicione livros, mapas ou objetos de aprendizado | baixo | facil | ativacao | |
| Iluminação focada e direta para concentração | baixo | facil | ativacao | |
| Elimine distrações e eletrônicos desnecessários | zero | instantanea | comportamental | |

### Espiritualidade

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Crie um espaço de meditação ou altar pessoal | medio | facil | layout | |
| Use tons roxo, azul escuro e branco | baixo | facil | elemento | |
| Adicione objetos sagrados e significativos | baixo | facil | ativacao | |
| Iluminação suave com velas ou luz indireta | baixo | facil | ativacao | |
| Mantenha silêncio e tranquilidade neste setor | zero | instantanea | comportamental | |

### Família

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Use tons verdes e azuis para harmonia familiar | baixo | facil | elemento | |
| Coloque fotos da família em momentos felizes | baixo | facil | ativacao | |
| Adicione plantas de madeira como bambu da sorte | baixo | facil | elemento | |
| Mantenha a área livre de objetos de conflito | zero | instantanea | comportamental | |
| Use madeira natural na decoração | medio | facil | elemento | |

### Prosperidade

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Adicione plantas saudáveis e viçosas | baixo | facil | elemento | |
| Use tons roxo, verde e dourado | baixo | facil | elemento | |
| Coloque símbolos de abundância como moedas ou peixes | baixo | facil | ativacao | |
| Mantenha este setor sempre limpo e iluminado | zero | instantanea | comportamental | |
| Ative com fonte de água pequena ou aquário | baixo | facil | elemento | |

### Centro

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Adicione cristais amarelos ou cerâmicas | baixo | facil | elemento | |
| Mantenha sempre limpo — centro irradia para todos os setores | zero | instantanea | comportamental | |
| Use tons terrosos: amarelo, ocre, marrom | baixo | facil | elemento | |
| Coloque uma tigela de cristal ou pedras naturais | baixo | facil | elemento | |

### Centro/Saúde

_Repetidas de setores anteriores (já cobertas acima): 4._

### Pessoas Uteis

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Adicione objetos metálicos e brancos | baixo | facil | elemento | |
| Use tons cinza, prata e branco | baixo | facil | elemento | |
| Coloque imagens de mentores ou pessoas admiradas | baixo | facil | ativacao | |
| Mantenha uma lista de contatos importantes visível | zero | instantanea | comportamental | |
| Adicione sinos ou móbiles metálicos | baixo | facil | elemento | |

### Pessoas Úteis

_Repetidas de setores anteriores (já cobertas acima): 5._

### Filhos

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Use tons brancos, cinza e pastéis | baixo | facil | elemento | |
| Adicione elementos metálicos e circulares | baixo | facil | elemento | |
| Exponha projetos criativos e expressão artística | zero | facil | ativacao | |
| Adicione cristais brancos como selenita | baixo | facil | elemento | |
| Crie espaço para brincadeira e criatividade | medio | facil | layout | |

### Criatividade

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Adicione elementos brancos e metálicos | baixo | facil | elemento | |
| Coloque objetos circulares ou em arco | baixo | facil | elemento | |
| Exponha trabalhos criativos e projetos em andamento | zero | facil | ativacao | |

_Repetidas de setores anteriores (já cobertas acima): 2._

### Relacionamentos

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Use tons rosa, vermelho e branco em pares | baixo | facil | elemento | |
| Coloque objetos em duplas: velas, porta-retratos | baixo | facil | ativacao | |
| Adicione cristais de quartzo rosa | baixo | facil | elemento | |
| Exponha fotos felizes com pessoas amadas | baixo | facil | ativacao | |
| Remova imagens de solidão ou objetos únicos | zero | instantanea | comportamental | |

### Fama

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Adicione elementos de fogo: velas ou luz vermelha | baixo | facil | elemento | |
| Use tons vermelhos e laranja na decoração | baixo | facil | elemento | |
| Exponha diplomas, prêmios e reconhecimentos | zero | facil | ativacao | |
| Adicione objetos triangulares ou em forma de chama | baixo | facil | elemento | |
| Coloque imagens de animais com força e presença | baixo | facil | ativacao | |

### Fama/Reputação

_Repetidas de setores anteriores (já cobertas acima): 5._

## Dicas por critério físico

### 0 — Limpeza e organizacao

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Faça limpeza profunda e reorganize completamente este setor | zero | instantanea | comportamental | |
| Descarte objetos desnecessários — desordem bloqueia fluxo de energia | zero | instantanea | comportamental | |
| Elimine poeira e sujeira acumulada nos cantos e sob móveis | zero | instantanea | comportamental | |

### 1 — Iluminacao adequada

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Aumente iluminação com luminárias adicionais ou spots direcionados | medio | facil | ativacao | |
| Substitua lâmpadas fracas ou queimadas por equivalentes mais potentes | baixo | facil | ativacao | |
| Adicione espelhos estratégicos para refletir e ampliar a luz natural | baixo | facil | ativacao | |

### 2 — Ventilacao e ar fresco

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Abra janelas diariamente para renovar o ar pelo menos 15 minutos | zero | instantanea | comportamental | |
| Adicione plantas purificadoras como espada-de-são-jorge ou lírio-da-paz | baixo | facil | elemento | |
| Considere um purificador de ar ou difusor de óleos essenciais | medio | facil | ativacao | |

### 3 — Cores harmonicas

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Introduza a cor dominante do elemento deste setor na decoração | baixo | facil | elemento | |
| Substitua cores dissonantes por tons neutros ou do elemento correto | medio | dificil | elemento | |
| Use almofadas, quadros ou tapetes nas cores indicadas para ativação | baixo | facil | elemento | |

### 4 — Mobiliario posicionado

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Reposicione o móvel principal para ficar de costas para parede sólida | zero | facil | layout | |
| Afaste móveis de cantos mortos e garanta passagem de pelo menos 60cm | zero | facil | layout | |
| Remova móveis que bloqueiam portas, janelas ou o fluxo de circulação | zero | facil | layout | |

### 5 — Plantas e elementos naturais

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Adicione uma planta saudável e viçosa com folhas arredondadas | baixo | facil | elemento | |
| Substitua plantas murchas ou secas — plantas doentes geram energia negativa | baixo | facil | elemento | |
| Coloque um vaso com terra ou elemento natural representando o ciclo vital | baixo | facil | elemento | |

### 6 — Ausencia de objetos quebrados

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Remova imediatamente objetos quebrados, lascados ou sem funcionalidade | zero | instantanea | comportamental | |
| Conserte ou substitua itens danificados — simbolizam situações inacabadas | medio | facil | comportamental | |
| Verifique equipamentos elétricos com mau funcionamento e conserte-os | medio | facil | comportamental | |

### 7 — Fluxo de energia livre

| Dica | Custo *(sug.)* | Desfazer *(sug.)* | Mecanismo *(sug.)* | **Evidência ← você** |
|---|---|---|---|---|
| Reorganize a disposição dos móveis para criar fluxo em curvas suaves | zero | facil | layout | |
| Elimine corredores longos e estreitos usando plantas ou biombos | medio | facil | bloqueio-de-forma | |
| Certifique-se que a porta principal abre completamente sem obstruções | zero | instantanea | layout | |

---

## Textos que não são ações

Achado ao classificar: os textos abaixo aparecem na lista de "dicas" mas são
afirmações informativas, não recomendações acionáveis. Não podem virar remédio.
Talvez devessem sair de `SETOR_DICAS` em `constants.ts`, já que o consultor os vê
como se fossem conselhos:

- "Este setor influencia todos os demais"
