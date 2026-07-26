# Curadoria das dicas — planilha de trabalho

> Gerado a partir de `src/lib/constants.ts`. Se as dicas mudarem, regenere.

São **94 dicas** (70 por setor + 24 por critério). O software **não** as
classifica por conta própria — ver ADR 0015. Esta planilha existe para a
curadoria ser feita por quem tem a formação em Feng Shui, uma dica por vez.

## Como usar

Para cada dica que você classificar, acrescente uma entrada em
`src/lib/dicas-classificadas.ts` usando **o texto exato** como chave:

```ts
'Mantenha o caminho até a porta livre': {
  custo: 'zero', reversibilidade: 'instantanea',
  forcaEvidencia: 'consenso-classico', mecanismo: 'layout',
},
```

A dica passa automaticamente a aparecer na seção **"Plano de Ação"** do
relatório, ordenada por custo/reversibilidade. Não é preciso classificar todas
para ver benefício — funciona incrementalmente.

## Valores possíveis

| Campo | Valores |
|---|---|
| `custo` | `zero` · `baixo` · `medio` · `alto` · `estrutural` |
| `reversibilidade` | `instantanea` · `facil` · `dificil` · `permanente` |
| `forcaEvidencia` | `consenso-classico` · `variante-de-escola` · `tradicao-popular` |
| `mecanismo` | `layout` · `elemento` · `bloqueio-de-forma` · `ativacao` · `comportamental` · `temporal` |

**`forcaEvidencia` é o campo que exige seu julgamento.** `custo`,
`reversibilidade` e `mecanismo` geralmente saem da leitura do texto; a força da
evidência depende de saber se a recomendação é consenso na literatura clássica,
variante de uma escola específica, ou tradição popular sem consenso.

---

## Dicas por setor

### Carreira

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Adicione elemento água: aquário, fonte ou imagem de rio |  |  |  |  |
| Use tons pretos, azul escuro e ondulados |  |  |  |  |
| Coloque espelho estrategicamente para ampliar o espaço |  |  |  |  |
| Mantenha o caminho até a porta livre |  |  |  |  |
| Adicione cristais negros como obsidiana |  |  |  |  |

### Conhecimento

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Crie espaço de estudo ou leitura tranquilo |  |  |  |  |
| Use tons azul-escuro, verde e preto |  |  |  |  |
| Adicione livros, mapas ou objetos de aprendizado |  |  |  |  |
| Iluminação focada e direta para concentração |  |  |  |  |
| Elimine distrações e eletrônicos desnecessários |  |  |  |  |

### Espiritualidade

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Crie um espaço de meditação ou altar pessoal |  |  |  |  |
| Use tons roxo, azul escuro e branco |  |  |  |  |
| Adicione objetos sagrados e significativos |  |  |  |  |
| Iluminação suave com velas ou luz indireta |  |  |  |  |
| Mantenha silêncio e tranquilidade neste setor |  |  |  |  |

### Família

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Use tons verdes e azuis para harmonia familiar |  |  |  |  |
| Coloque fotos da família em momentos felizes |  |  |  |  |
| Adicione plantas de madeira como bambu da sorte |  |  |  |  |
| Mantenha a área livre de objetos de conflito |  |  |  |  |
| Use madeira natural na decoração |  |  |  |  |

### Prosperidade

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Adicione plantas saudáveis e viçosas |  |  |  |  |
| Use tons roxo, verde e dourado |  |  |  |  |
| Coloque símbolos de abundância como moedas ou peixes |  |  |  |  |
| Mantenha este setor sempre limpo e iluminado |  |  |  |  |
| Ative com fonte de água pequena ou aquário |  |  |  |  |

### Centro

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Adicione cristais amarelos ou cerâmicas |  |  |  |  |
| Mantenha sempre limpo — centro irradia para todos os setores |  |  |  |  |
| Use tons terrosos: amarelo, ocre, marrom |  |  |  |  |
| Este setor influencia todos os demais |  |  |  |  |
| Coloque uma tigela de cristal ou pedras naturais |  |  |  |  |

### Centro/Saúde

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Adicione cristais amarelos ou cerâmicas |  |  |  |  |
| Mantenha sempre limpo — centro irradia para todos os setores |  |  |  |  |
| Use tons terrosos: amarelo, ocre, marrom |  |  |  |  |
| Este setor influencia todos os demais |  |  |  |  |
| Coloque uma tigela de cristal ou pedras naturais |  |  |  |  |

### Pessoas Uteis

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Adicione objetos metálicos e brancos |  |  |  |  |
| Use tons cinza, prata e branco |  |  |  |  |
| Coloque imagens de mentores ou pessoas admiradas |  |  |  |  |
| Mantenha uma lista de contatos importantes visível |  |  |  |  |
| Adicione sinos ou móbiles metálicos |  |  |  |  |

### Pessoas Úteis

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Adicione objetos metálicos e brancos |  |  |  |  |
| Use tons cinza, prata e branco |  |  |  |  |
| Coloque imagens de mentores ou pessoas admiradas |  |  |  |  |
| Mantenha uma lista de contatos importantes visível |  |  |  |  |
| Adicione sinos ou móbiles metálicos |  |  |  |  |

### Filhos

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Use tons brancos, cinza e pastéis |  |  |  |  |
| Adicione elementos metálicos e circulares |  |  |  |  |
| Exponha projetos criativos e expressão artística |  |  |  |  |
| Adicione cristais brancos como selenita |  |  |  |  |
| Crie espaço para brincadeira e criatividade |  |  |  |  |

### Criatividade

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Adicione elementos brancos e metálicos |  |  |  |  |
| Use tons brancos, cinza e pastéis |  |  |  |  |
| Coloque objetos circulares ou em arco |  |  |  |  |
| Exponha trabalhos criativos e projetos em andamento |  |  |  |  |
| Adicione cristais brancos como selenita |  |  |  |  |

### Relacionamentos

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Use tons rosa, vermelho e branco em pares |  |  |  |  |
| Coloque objetos em duplas: velas, porta-retratos |  |  |  |  |
| Adicione cristais de quartzo rosa |  |  |  |  |
| Exponha fotos felizes com pessoas amadas |  |  |  |  |
| Remova imagens de solidão ou objetos únicos |  |  |  |  |

### Fama

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Adicione elementos de fogo: velas ou luz vermelha |  |  |  |  |
| Use tons vermelhos e laranja na decoração |  |  |  |  |
| Exponha diplomas, prêmios e reconhecimentos |  |  |  |  |
| Adicione objetos triangulares ou em forma de chama |  |  |  |  |
| Coloque imagens de animais com força e presença |  |  |  |  |

### Fama/Reputação

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Adicione elementos de fogo: velas ou luz vermelha |  |  |  |  |
| Use tons vermelhos e laranja na decoração |  |  |  |  |
| Exponha diplomas, prêmios e reconhecimentos |  |  |  |  |
| Adicione objetos triangulares ou em forma de chama |  |  |  |  |
| Coloque imagens de animais com força e presença |  |  |  |  |

## Dicas por critério físico

### 0 — Limpeza e organizacao

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Faça limpeza profunda e reorganize completamente este setor |  |  |  |  |
| Descarte objetos desnecessários — desordem bloqueia fluxo de energia |  |  |  |  |
| Elimine poeira e sujeira acumulada nos cantos e sob móveis |  |  |  |  |

### 1 — Iluminacao adequada

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Aumente iluminação com luminárias adicionais ou spots direcionados |  |  |  |  |
| Substitua lâmpadas fracas ou queimadas por equivalentes mais potentes |  |  |  |  |
| Adicione espelhos estratégicos para refletir e ampliar a luz natural |  |  |  |  |

### 2 — Ventilacao e ar fresco

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Abra janelas diariamente para renovar o ar pelo menos 15 minutos |  |  |  |  |
| Adicione plantas purificadoras como espada-de-são-jorge ou lírio-da-paz |  |  |  |  |
| Considere um purificador de ar ou difusor de óleos essenciais |  |  |  |  |

### 3 — Cores harmonicas

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Introduza a cor dominante do elemento deste setor na decoração |  |  |  |  |
| Substitua cores dissonantes por tons neutros ou do elemento correto |  |  |  |  |
| Use almofadas, quadros ou tapetes nas cores indicadas para ativação |  |  |  |  |

### 4 — Mobiliario posicionado

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Reposicione o móvel principal para ficar de costas para parede sólida |  |  |  |  |
| Afaste móveis de cantos mortos e garanta passagem de pelo menos 60cm |  |  |  |  |
| Remova móveis que bloqueiam portas, janelas ou o fluxo de circulação |  |  |  |  |

### 5 — Plantas e elementos naturais

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Adicione uma planta saudável e viçosa com folhas arredondadas |  |  |  |  |
| Substitua plantas murchas ou secas — plantas doentes geram energia negativa |  |  |  |  |
| Coloque um vaso com terra ou elemento natural representando o ciclo vital |  |  |  |  |

### 6 — Ausencia de objetos quebrados

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Remova imediatamente objetos quebrados, lascados ou sem funcionalidade |  |  |  |  |
| Conserte ou substitua itens danificados — simbolizam situações inacabadas |  |  |  |  |
| Verifique equipamentos elétricos com mau funcionamento e conserte-os |  |  |  |  |

### 7 — Fluxo de energia livre

| Dica | Custo | Desfazer | Evidência | Mecanismo |
|---|---|---|---|---|
| Reorganize a disposição dos móveis para criar fluxo em curvas suaves |  |  |  |  |
| Elimine corredores longos e estreitos usando plantas ou biombos |  |  |  |  |
| Certifique-se que a porta principal abre completamente sem obstruções |  |  |  |  |
