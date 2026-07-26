# Curadoria das dicas — proveniência por dica

> **GERADO** por `scripts/citacoes/gerar-planilha.mts` a partir de
> `constants.ts`, `dicas-classificadas.ts` e `curadoria-evidencia.ts`.
> Não editar à mão — regenere. Para conferir as citações contra as obras:
> `python3 scripts/citacoes/extrair-corpus.py && python3 scripts/citacoes/verificar-citacoes.py`.

## Estado

- 94 dicas no catálogo, **77 textos únicos** (as repetidas entre setores duplicados compartilham classificação).
- 1 não é ação, e sim afirmação informativa → nunca vira remédio.
- **68 curadas com fonte nomeada, localizador e citação literal.**
- **8 sem fonte localizável** no corpus — seguem aparecendo como texto no relatório, sem selo de evidência.

| Força de evidência | Dicas |
|---|---|
| `consenso-classico` | 36 |
| `variante-de-escola` | 23 |
| `tradicao-popular` | 9 |

## O que cada tier significa

- `consenso-classico` — âncora explícita num construto clássico nomeado
  (ciclo Wu Xing, Ba Guá do Céu Posterior, Sheng/Shar Chi, Escola das Formas)
  **e** presente em mais de uma fonte, sem contradição encontrada.
- `variante-de-escola` — atribuível a uma convenção de escola, ou as fontes
  divergem, ou a fonte sustenta o princípio mas não o detalhe que a dica acrescenta.
- `tradicao-popular` — aparece na literatura consultada, sem âncora clássica localizável.

> **Limite honesto:** `consenso-classico` aqui é consenso *deste corpus*,
> que é majoritariamente literatura introdutória ocidental. Não é verificação
> contra fonte primária chinesa — nenhuma obra do corpus é edição crítica de
> texto clássico. Ver ADR 0017.

## Fontes usadas

| Obra | Ano | Tier |
|---|---|---|
| Lillian Too, *The Feng Shui Dictionary* | 2013 | `referencia` |
| Michael Erlewine, *The Art of Feng Shui* | 2007 | `popular` |
| Joey Yap, *Work From Home Feng Shui Guide* | 2020 | `linhagem-classica` |
| Nicolas Tchikovani, *The Feng Shui House Book* | 2020 | `popular` |
| Susannah L. Williams, *Feng Shui For Beginners (2ª ed.)* | 2012 | `popular` |
| Virginia Alba, *Feng Shui Book For Beginners* | 2021 | `popular` |
| Bonnie Morawa, *Feng Shui for Attracting Wealth and Abundance* | 2015 | `popular` |

## Dicas curadas

| Dica | Custo | Desfazer | Mecanismo | Evidência | Fonte |
|---|---|---|---|---|---|
| Adicione elemento água: aquário, fonte ou imagem de rio | baixo | facil | elemento | `consenso-classico` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Arrowana" |
| Use tons pretos, azul escuro e ondulados | baixo | facil | elemento | `consenso-classico` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), tabela dos Cinco Elementos, p. 27 |
| Coloque espelho estrategicamente para ampliar o espaço ⚠️ | baixo | facil | ativacao | `tradicao-popular` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Bedrooms" |
| Mantenha o caminho até a porta livre | zero | instantanea | layout | `consenso-classico` | Michael Erlewine, The Art of Feng Shui (2007), Entranceway: Pillar in Hallway, p. 273 |
| Adicione cristais negros como obsidiana ⚠️ | baixo | facil | elemento | `tradicao-popular` | Bonnie Morawa, Feng Shui for Attracting Wealth and Abundance (2015), Gems and crystals in feng shui |
| Crie espaço de estudo ou leitura tranquilo | medio | facil | layout | `variante-de-escola` | Virginia Alba, Feng Shui Book For Beginners (2021), House areas — The Northeast |
| Use tons azul-escuro, verde e preto | baixo | facil | elemento | `variante-de-escola` | Virginia Alba, Feng Shui Book For Beginners (2021), Feng Shui Bedroom Colors — zona da sabedoria |
| Adicione livros, mapas ou objetos de aprendizado | baixo | facil | ativacao | `variante-de-escola` | Virginia Alba, Feng Shui Book For Beginners (2021), House areas — The Northeast |
| Iluminação focada e direta para concentração | baixo | facil | ativacao | `variante-de-escola` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Lights" |
| Elimine distrações e eletrônicos desnecessários ⚠️ | zero | instantanea | comportamental | `tradicao-popular` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), Children Rooms |
| Crie um espaço de meditação ou altar pessoal | medio | facil | layout | `variante-de-escola` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Altar" |
| Use tons roxo, azul escuro e branco | baixo | facil | elemento | `tradicao-popular` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), tabela dos Cinco Elementos, p. 27 |
| Adicione objetos sagrados e significativos | baixo | facil | ativacao | `variante-de-escola` | Virginia Alba, Feng Shui Book For Beginners (2021), House areas — The Northeast |
| Iluminação suave com velas ou luz indireta | baixo | facil | ativacao | `variante-de-escola` | Nicolas Tchikovani, The Feng Shui House Book (2020), Feng Shui of a Bathroom in the Center of a Home |
| Mantenha silêncio e tranquilidade neste setor | zero | instantanea | comportamental | `variante-de-escola` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Quiet Areas" |
| Use tons verdes e azuis para harmonia familiar | baixo | facil | elemento | `consenso-classico` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), tabela dos Cinco Elementos, p. 28 |
| Adicione plantas de madeira como bambu da sorte | baixo | facil | elemento | `consenso-classico` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Bamboo" |
| Use madeira natural na decoração | medio | facil | elemento | `consenso-classico` | Michael Erlewine, The Art of Feng Shui (2007), Wood Remedies, p. 486 |
| Adicione plantas saudáveis e viçosas | baixo | facil | elemento | `consenso-classico` | Michael Erlewine, The Art of Feng Shui (2007), Wood Remedies, p. 486 |
| Use tons roxo, verde e dourado | baixo | facil | elemento | `variante-de-escola` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), tabela dos Cinco Elementos, p. 28 |
| Coloque símbolos de abundância como moedas ou peixes | baixo | facil | ativacao | `variante-de-escola` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Coins" |
| Mantenha este setor sempre limpo e iluminado | zero | instantanea | comportamental | `consenso-classico` | Joey Yap, Work From Home Feng Shui Guide (2020), Step 3 — Observe and Activate, p. 15 |
| Ative com fonte de água pequena ou aquário | baixo | facil | elemento | `consenso-classico` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Aquarium" |
| Adicione cristais amarelos ou cerâmicas | baixo | facil | elemento | `consenso-classico` | Michael Erlewine, The Art of Feng Shui (2007), Earth Remedies, p. 480–481 |
| Mantenha sempre limpo — centro irradia para todos os setores | zero | instantanea | comportamental | `consenso-classico` | Virginia Alba, Feng Shui Book For Beginners (2021), House areas — zona tai chi |
| Use tons terrosos: amarelo, ocre, marrom | baixo | facil | elemento | `consenso-classico` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), tabela dos Cinco Elementos, p. 28 |
| Coloque uma tigela de cristal ou pedras naturais | baixo | facil | elemento | `variante-de-escola` | Michael Erlewine, The Art of Feng Shui (2007), Earth Remedies, p. 480 |
| Adicione objetos metálicos e brancos | baixo | facil | elemento | `consenso-classico` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), tabela dos Cinco Elementos, p. 29 |
| Use tons cinza, prata e branco | baixo | facil | elemento | `consenso-classico` | Virginia Alba, Feng Shui Book For Beginners (2021), Feng Shui Bedroom Colors — zona de ajuda/amizade |
| Coloque imagens de mentores ou pessoas admiradas | baixo | facil | ativacao | `consenso-classico` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Offices" — arte de escritório |
| Adicione sinos ou móbiles metálicos | baixo | facil | elemento | `consenso-classico` | Michael Erlewine, The Art of Feng Shui (2007), Wind Chimes, p. 497 |
| Use tons brancos, cinza e pastéis | baixo | facil | elemento | `consenso-classico` | Virginia Alba, Feng Shui Book For Beginners (2021), Feng Shui Bedroom Colors — zona da criatividade |
| Adicione elementos metálicos e circulares | baixo | facil | elemento | `consenso-classico` | Michael Erlewine, The Art of Feng Shui (2007), The Metal Environment, p. 415 |
| Adicione cristais brancos como selenita | baixo | facil | elemento | `tradicao-popular` | Bonnie Morawa, Feng Shui for Attracting Wealth and Abundance (2015), Choose gem colors by your wish |
| Crie espaço para brincadeira e criatividade | medio | facil | layout | `variante-de-escola` | Nicolas Tchikovani, The Feng Shui House Book (2020), How to Create Good Feng Shui in Your Garden |
| Adicione elementos brancos e metálicos | baixo | facil | elemento | `consenso-classico` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), tabela dos Cinco Elementos, p. 29 |
| Coloque objetos circulares ou em arco | baixo | facil | elemento | `consenso-classico` | Michael Erlewine, The Art of Feng Shui (2007), The Metal Environment, p. 415 |
| Use tons rosa, vermelho e branco em pares | baixo | facil | elemento | `variante-de-escola` | Virginia Alba, Feng Shui Book For Beginners (2021), Feng Shui Bedroom Colors — zona de associação |
| Coloque objetos em duplas: velas, porta-retratos | baixo | facil | ativacao | `variante-de-escola` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), Bedroom |
| Adicione cristais de quartzo rosa | baixo | facil | elemento | `tradicao-popular` | Bonnie Morawa, Feng Shui for Attracting Wealth and Abundance (2015), Gems and crystals in feng shui |
| Exponha fotos felizes com pessoas amadas | baixo | facil | ativacao | `tradicao-popular` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), What Do People Accept With Most Difficulty? |
| Adicione elementos de fogo: velas ou luz vermelha | baixo | facil | elemento | `consenso-classico` | Michael Erlewine, The Art of Feng Shui (2007), Fire Remedies, p. 474 |
| Use tons vermelhos e laranja na decoração | baixo | facil | elemento | `consenso-classico` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), tabela dos Cinco Elementos, p. 27 |
| Adicione objetos triangulares ou em forma de chama | baixo | facil | elemento | `consenso-classico` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), tabela dos Cinco Elementos, p. 27 |
| Coloque imagens de animais com força e presença | baixo | facil | ativacao | `variante-de-escola` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Horses" |
| Faça limpeza profunda e reorganize completamente este setor | zero | instantanea | comportamental | `consenso-classico` | Nicolas Tchikovani, The Feng Shui House Book (2020), Where Do You Begin? |
| Descarte objetos desnecessários — desordem bloqueia fluxo de energia | zero | instantanea | comportamental | `consenso-classico` | Bonnie Morawa, Feng Shui for Attracting Wealth and Abundance (2015), How does clutter affect you |
| Elimine poeira e sujeira acumulada nos cantos e sob móveis | zero | instantanea | comportamental | `variante-de-escola` | Joey Yap, Work From Home Feng Shui Guide (2020), Step 3 — Observe and Activate, p. 15 |
| Aumente iluminação com luminárias adicionais ou spots direcionados | medio | facil | ativacao | `consenso-classico` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Lights" |
| Substitua lâmpadas fracas ou queimadas por equivalentes mais potentes | baixo | facil | ativacao | `variante-de-escola` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Lights" |
| Adicione espelhos estratégicos para refletir e ampliar a luz natural | baixo | facil | ativacao | `variante-de-escola` | Virginia Alba, Feng Shui Book For Beginners (2021), Feng Shui Life Mirror |
| Abra janelas diariamente para renovar o ar pelo menos 15 minutos | zero | instantanea | comportamental | `variante-de-escola` | Joey Yap, Work From Home Feng Shui Guide (2020), Step 3 — Observe and Activate, p. 15 |
| Adicione plantas purificadoras como espada-de-são-jorge ou lírio-da-paz | baixo | facil | elemento | `tradicao-popular` | Nicolas Tchikovani, The Feng Shui House Book (2020), Feng Shui of a Bathroom in the Center of a Home |
| Considere um purificador de ar ou difusor de óleos essenciais | medio | facil | ativacao | `tradicao-popular` | Nicolas Tchikovani, The Feng Shui House Book (2020), Feng Shui of a Bathroom in the Center of a Home |
| Introduza a cor dominante do elemento deste setor na decoração | baixo | facil | elemento | `consenso-classico` | Lillian Too, The Feng Shui Dictionary (2013), lista de antídotos ("Antidotes") |
| Substitua cores dissonantes por tons neutros ou do elemento correto | medio | dificil | elemento | `consenso-classico` | Lillian Too, The Feng Shui Dictionary (2013), lista de antídotos ("Antidotes") |
| Use almofadas, quadros ou tapetes nas cores indicadas para ativação | baixo | facil | elemento | `consenso-classico` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), tabela dos Cinco Elementos, p. 27–29 |
| Reposicione o móvel principal para ficar de costas para parede sólida | zero | facil | layout | `consenso-classico` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), Bedroom, p. 30 |
| Afaste móveis de cantos mortos e garanta passagem de pelo menos 60cm | zero | facil | layout | `variante-de-escola` | Michael Erlewine, The Art of Feng Shui (2007), exemplo do hall de entrada |
| Remova móveis que bloqueiam portas, janelas ou o fluxo de circulação | zero | facil | layout | `consenso-classico` | Michael Erlewine, The Art of Feng Shui (2007), Entranceway: Pillar in Hallway, p. 273 |
| Adicione uma planta saudável e viçosa com folhas arredondadas | baixo | facil | elemento | `consenso-classico` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), Plants |
| Substitua plantas murchas ou secas — plantas doentes geram energia negativa | baixo | facil | elemento | `consenso-classico` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), Plants |
| Coloque um vaso com terra ou elemento natural representando o ciclo vital | baixo | facil | elemento | `variante-de-escola` | Michael Erlewine, The Art of Feng Shui (2007), Earth Remedies, p. 480 |
| Remova imediatamente objetos quebrados, lascados ou sem funcionalidade | zero | instantanea | comportamental | `variante-de-escola` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), Cleaning Out The Mess |
| Conserte ou substitua itens danificados — simbolizam situações inacabadas | medio | facil | comportamental | `variante-de-escola` | Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), Cleaning Out The Mess |
| Reorganize a disposição dos móveis para criar fluxo em curvas suaves | zero | facil | layout | `consenso-classico` | Michael Erlewine, The Art of Feng Shui (2007), Qi flow, p. 534 |
| Elimine corredores longos e estreitos usando plantas ou biombos | medio | facil | bloqueio-de-forma | `consenso-classico` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Corridors" / "Bamboo" |
| Certifique-se que a porta principal abre completamente sem obstruções | zero | instantanea | layout | `consenso-classico` | Lillian Too, The Feng Shui Dictionary (2013), verbete "Foyers" |

⚠️ = prática **contestada** por outra fonte do corpus. Ver detalhe abaixo.

## Práticas contestadas

Achadas na pesquisa: uma obra recomenda, outra desaconselha. O app agora leva
a contestação para `Remedio.contraindicacoes`, então o consultor vê o conflito
junto com a recomendação. São candidatas a sair de `constants.ts`.

### Coloque espelho estrategicamente para ampliar o espaço

- **Aparece em** Lillian Too, The Feng Shui Dictionary (2013), verbete "Bedrooms": “The inclusion of mirrors is one of the most common mistakes in modern bedroom interior design. Mirrors are frequently used to create a sense of space.”
- **Contestada por** Michael Erlewine, The Art of Feng Shui (2007), Entranceway: Mirrors, p. 269: “Some feel that the addition of the mirror helps to magnify the incoming Qi, but most experts would not recommend it.”
- **Nota:** Distinta da dica de critério «espelhos para refletir luz natural», que Alba endossa. Espelho-para-luz tem apoio; espelho-para-espaço, não.

### Adicione cristais negros como obsidiana

- **Aparece em** Bonnie Morawa, Feng Shui for Attracting Wealth and Abundance (2015), Gems and crystals in feng shui: “Gems and crystals are powerful symbols of our earthly desires and they are powerful activators.”
- **Contestada por** Virginia Alba, Feng Shui Book For Beginners (2021), House areas — The North: “avoid placing materials that represent the earth such as clay and rocks.”
- **Nota:** Cristal é remédio de TERRA (Erlewine, p. 483: "Crystals of all kinds belong to the Earth element"), e Terra controla Água no ciclo Wu Xing. A dica põe objeto de Terra no setor de Água — contraria o ciclo, além de Alba desaconselhar materiais de terra no Norte. A cor preta confere; o material, não.

### Elimine distrações e eletrônicos desnecessários

- **Aparece em** Susannah L. Williams, Feng Shui For Beginners (2ª ed.) (2012), Children Rooms: “electric appliances (avoid putting the television or computers in children rooms”
- **Contestada por** Lillian Too, The Feng Shui Dictionary (2013), verbete "Computers": “Computers do not cause bad Feng Shui. When placed in the west or northwest they can become energizers in these corners.”
- **Nota:** Too trata eletrônicos como neutros ou até energizadores. A restrição que a dica faz é de foco/atenção, não de Feng Shui.

## Contraindicações documentadas

10 dicas têm ressalva achada na mesma leitura que sustentou a
classificação. Antes desta curadoria o app não mostrava nenhuma delas.

- **Adicione elemento água: aquário, fonte ou imagem de rio** — Não posicione o aquário à direita da porta de entrada (visto de dentro para fora): Too registra essa posição como causadora de infidelidade.
- **Coloque espelho estrategicamente para ampliar o espaço** — Duas fontes desaconselham espelho com a finalidade de ampliar espaço; em quarto, Too classifica a prática como erro comum.
- **Adicione livros, mapas ou objetos de aprendizado** — Evite estantes abertas: Too — "These represent knives cutting into you and are bad Feng Shui. If you have exposed bookshelves in your office or study," recomenda fechá-las com portas.
- **Adicione plantas de madeira como bambu da sorte** — Não em quarto de casal: Too — plantas no quarto de um casal e eles "will quarrel frequently".
- **Adicione plantas saudáveis e viçosas** — Não em quarto de casal (Too) nem plantas espinhosas (Too: cactos "should not be placed in the home").
- **Ative com fonte de água pequena ou aquário** — Não à direita da porta de entrada, visto de dentro para fora (Too).
- **Adicione elementos de fogo: velas ou luz vermelha** — Não onde estiver a Estrela 5 anual (Wu Huang): Morawa — "no fires, flames, candles or red objects here".
- **Adicione objetos triangulares ou em forma de chama** — Nunca em quarto: Too — "arrows and triangles: these represent the fire element, which is very bad for the bedroom", e simbolizam flechas envenenadas apontadas para quem dorme.
- **Coloque imagens de animais com força e presença** — Uma imagem de animal por vez (Williams: "one piece of an animal at a time"); e Too alerta que no sul o cavalo pode trazer Yang em excesso.
- **Adicione uma planta saudável e viçosa com folhas arredondadas** — Nada de espinhos: Too — "Cacti and any other types of prickly plants create tiny slivers of poisonous energy". E nenhuma planta em quarto de casal (Too).

## Onde a dica vai além da fonte

Números inventados, cores que não fecham com o ciclo, setor divergente. Fica
registrado em vez de sumir — cada um destes é uma decisão de produto pendente.

- **Crie espaço de estudo ou leitura tranquilo** — A associação Nordeste↔estudo é convenção das Oito Aspirações. Too a chama "education luck" no mesmo sentido; nenhuma fonte a deriva do ciclo Wu Xing.
- **Use tons azul-escuro, verde e preto** — O Nordeste é setor de TERRA (amarelo/marrom na tabela de Williams, p. 28). Azul é Água e verde é Madeira — a paleta vem da convenção de escola, não do elemento do setor.
- **Iluminação focada e direta para concentração** — Luz como fonte de Yang é clássico; «focada e direta para concentração» é enquadramento ergonômico moderno, ausente das fontes.
- **Crie um espaço de meditação ou altar pessoal** — DIVERGÊNCIA DE SETOR: Too põe o altar no NOROESTE (trigrama Chien); Alba põe espiritualidade no NORDESTE, que é o setor usado pelo app. As duas leituras existem na literatura.
- **Use tons roxo, azul escuro e branco** — A paleta mistura três elementos: roxo é Fogo, azul escuro é Água, branco é Metal. Não corresponde a nenhum setor único do Ba Guá — é combinação de mercado.
- **Mantenha silêncio e tranquilidade neste setor** — O equilíbrio Yin/Yang é clássico, mas Too o enuncia para o QUARTO, não para um setor do Ba Guá. Aplicar a um setor é extensão do app.
- **Use tons verdes e azuis para harmonia familiar** — Verde é o elemento do setor. Azul é Água, que GERA Madeira no ciclo Sheng — coerente por nutrição, não por identidade.
- **Use tons roxo, verde e dourado** — Só o verde fecha com o elemento do Sudeste. Roxo é Fogo e dourado é Metal — e Metal CORTA Madeira no ciclo de controle. Roxo/dourado para riqueza é convenção das Oito Aspirações, não Wu Xing.
- **Coloque símbolos de abundância como moedas ou peixes** — Feng Shui simbólico: a eficácia atribuída vem do símbolo, não de cálculo de direção ou elemento.
- **Adicione cristais amarelos ou cerâmicas** — Erlewine confirma também a cor: "Earth colors of all shades of yellow, the darker the better, so ochre and deep clay-colors".
- **Coloque uma tigela de cristal ou pedras naturais** — A pedra como remédio de Terra tem apoio; a forma "tigela" é escolha decorativa, não regra de fonte.
- **Adicione objetos metálicos e brancos** — A mesma entrada dá cores ("white, golden, silver") e materiais ("stainless steel, brass, silver, bronze, copper, iron").
- **Use tons cinza, prata e branco** — Concorda com a tabela de Williams (p. 29), que dá Metal = "white, golden, silver".
- **Use tons brancos, cinza e pastéis** — Pastéis não aparecem nas fontes; branco/cinza sim (Williams, p. 29).
- **Adicione cristais brancos como selenita** — Correspondência cor-de-cristal↔área da vida é prática moderna; nenhuma fonte a deriva de trigrama ou ciclo.
- **Use tons rosa, vermelho e branco em pares** — O Sudoeste é TERRA (amarelo/marrom). Rosa/vermelho entram pelo Fogo, que GERA Terra — Too registra essa combinação no verbete "Chandeliers": luz (Fogo) + cristal (Terra) no sudoeste traz sorte no amor. Coerente pelo ciclo Sheng, não pela cor do setor.
- **Exponha fotos felizes com pessoas amadas** — SUSTENTAÇÃO PARCIAL: a fonte lê a ALTURA da foto como sintoma da relação; não recomenda expor fotos felizes como cura. Classificada popular por isso.
- **Use tons vermelhos e laranja na decoração** — Vermelho confere. Laranja não aparece em nenhuma fonte do corpus — nas tabelas, o segundo tom do Fogo é o roxo.
- **Elimine poeira e sujeira acumulada nos cantos e sob móveis** — As fontes tratam de desordem e limpeza em geral; nenhuma singulariza poeira em cantos ou sob móveis.
- **Substitua lâmpadas fracas ou queimadas por equivalentes mais potentes** — Luz como Yang é clássico; lâmpada QUEIMADA especificamente não é tratada por nenhuma fonte do corpus.
- **Adicione espelhos estratégicos para refletir e ampliar a luz natural** — Espelho-para-LUZ tem apoio (Alba; e Erlewine usa prismas no peitoril "so that morning or evening Sun could reflect light around the room"). Espelho-para-ESPAÇO é contestado — ver a dica de Carreira.
- **Abra janelas diariamente para renovar o ar pelo menos 15 minutos** — Os «15 minutos» são precisão do app, não da fonte. Nenhuma obra do corpus dá duração — Yap pede circulação de ar, sem quantificar.
- **Adicione plantas purificadoras como espada-de-são-jorge ou lírio-da-paz** — As espécies nomeadas vêm da literatura de qualidade do ar, não do Feng Shui. Contraindicação de Too vale igual: nada de planta em quarto de casal.
- **Use almofadas, quadros ou tapetes nas cores indicadas para ativação** — A tabela dá a coluna de cores dos cinco elementos; o suporte é para a cor, não para o objeto (almofada/tapete é veículo).
- **Reposicione o móvel principal para ficar de costas para parede sólida** — A mesma obra dá o lado do assento: "Try not to sit with your back facing the door, or the side door." Morawa concorda ("sleep on a solid wall"). É a regra do apoio nas costas (Tartaruga Negra), que o app também aplica em `posicionamento-mobiliario.ts`.
- **Afaste móveis de cantos mortos e garanta passagem de pelo menos 60cm** — Os 60cm são do app: nenhuma fonte do corpus dá medida de passagem. O princípio (não estrangular a circulação) tem apoio.
- **Coloque um vaso com terra ou elemento natural representando o ciclo vital** — A leitura "ciclo vital" é do app; a fonte trata o material como remédio do elemento Terra, sem essa simbologia.
- **Remova imediatamente objetos quebrados, lascados ou sem funcionalidade** — A regra aparece em duas obras (Williams, Morawa), mas como conselho de organização moderna — nenhuma a ancora em Sheng/Shar Chi ou Wu Xing.
- **Conserte ou substitua itens danificados — simbolizam situações inacabadas** — A leitura simbólica ("situações inacabadas") não aparece em nenhuma fonte do corpus — é acréscimo do app.
- **Reorganize a disposição dos móveis para criar fluxo em curvas suaves** — Too diz o mesmo ao definir Sheng Chi: as linhas de energia auspiciosas devem "meander gently through the home and accumulate and settle".
- **Elimine corredores longos e estreitos usando plantas ou biombos** — Too recomenda BIOMBO/divisória e diz explicitamente que bambu, flautas e sinos de vento "can only do so much". Planta não aparece como remédio de corredor em nenhuma fonte — o biombo da dica tem apoio, a planta não.

## Sem fonte localizável no corpus

Buscadas por termo no corpus inteiro e **não encontradas**. Não viram `Remedio`.
Se você tiver a fonte, acrescente a entrada em `curadoria-evidencia.ts`.

- Coloque fotos da família em momentos felizes
- Mantenha a área livre de objetos de conflito
- Mantenha uma lista de contatos importantes visível
- Exponha projetos criativos e expressão artística
- Exponha trabalhos criativos e projetos em andamento
- Remova imagens de solidão ou objetos únicos
- Exponha diplomas, prêmios e reconhecimentos
- Verifique equipamentos elétricos com mau funcionamento e conserte-os

## Não acionável

- **Este setor influencia todos os demais** — afirmação informativa, não recomendação. Aparece ao consultor
  como se fosse conselho; talvez devesse sair de `SETOR_DICAS`.
