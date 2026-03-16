# ☯ FengShui Studio — Documentacao Completa do Sistema

> **Versao:** 0.1.0
> **Ultima atualizacao:** Marco de 2026
> **Desenvolvido por:** CollabZ Consultoria

---

## Indice

1. [Visao Geral](#1-visao-geral)
2. [Planos e Funcionalidades](#2-planos-e-funcionalidades)
3. [Primeiros Passos](#3-primeiros-passos)
4. [Funcionalidades Detalhadas](#4-funcionalidades-detalhadas)
   - 4.1 [Dashboard](#41-dashboard)
   - 4.2 [Consultas (Diagnosticos)](#42-consultas-diagnosticos)
   - 4.3 [Clientes](#43-clientes-plano-profissional)
   - 4.4 [Pagamentos](#44-pagamentos-plano-profissional)
   - 4.5 [Curas e Rituais](#45-curas-e-rituais)
   - 4.6 [Calendario Chines / Lunar](#46-calendario-chines--lunar)
   - 4.7 [Rede de Parceiros](#47-rede-de-parceiros)
   - 4.8 [Produtos](#48-produtos)
   - 4.9 [Perfil](#49-perfil)
   - 4.10 [Planos e Upgrade](#410-planos-e-upgrade)
5. [Area Administrativa](#5-area-administrativa)
6. [Arquitetura Tecnica (para desenvolvedores)](#6-arquitetura-tecnica-para-desenvolvedores)
7. [Configuracao do Banco de Dados](#7-configuracao-do-banco-de-dados)
8. [Variaveis de Ambiente](#8-variaveis-de-ambiente)
9. [FAQ / Perguntas Frequentes](#9-faq--perguntas-frequentes)
10. [Glossario](#10-glossario)

---

## 1. Visao Geral

### O que e o FengShui Studio?

O **FengShui Studio** e uma plataforma online (aplicacao web) criada para ajudar pessoas e profissionais a realizarem diagnosticos de Feng Shui em imoveis. O sistema permite que voce analise a energia do seu lar ou escritorio, identifique problemas em cada setor do Ba Gua e receba recomendacoes personalizadas de curas e harmonizacao.

Pense nele como um **assistente digital de Feng Shui**: voce cadastra seu imovel, o sistema divide os ambientes nos 9 setores do Ba Gua, voce avalia cada setor com criterios simples (limpeza, iluminacao, cores, etc.) e ele gera um relatorio completo com recomendacoes de cristais, plantas, cores e acoes para melhorar a energia.

### Para quem e?

O FengShui Studio foi pensado para diferentes tipos de usuarios:

| Tipo de Usuario | Descricao |
|---|---|
| 🏠 **Pessoal** | Pessoas comuns que querem harmonizar sua propria residencia |
| ☯ **Profissional de Feng Shui** | Consultores que atendem clientes e precisam gerar relatorios |
| 🏗️ **Arquiteto(a)** | Profissionais de arquitetura que usam Feng Shui em projetos |
| 🎨 **Decorador(a)** | Profissionais de decoracao que aplicam principios de harmonia |
| 💼 **Outro Profissional** | Qualquer outro profissional que trabalhe com harmonizacao de ambientes |

### URL de Acesso

Acesse o sistema pelo navegador (Chrome, Firefox, Safari, Edge) no endereco fornecido pelo administrador. A pagina inicial e a tela de login.

---

## 2. Planos e Funcionalidades

O FengShui Studio possui **tres planos** para atender diferentes necessidades. Veja abaixo a comparacao completa:

### 📊 Tabela Comparativa

| Funcionalidade | 🆓 Free (Gratis) | 💙 Simples (R$ 29,90/mes) | 💜 Profissional (R$ 49,90/mes) |
|---|---|---|---|
| **Imoveis cadastrados** | Ate 3 imoveis (total) | 1 imovel ativo por vez | ♾️ Ilimitados |
| **Diagnostico Ba Gua** | 1 analise por imovel | 1 analise por imovel | Multiplas analises por imovel |
| **Cadastro de clientes** | ❌ Nao disponivel | ❌ Nao disponivel | ✅ Ilimitados |
| **Relatorio PDF** | ❌ Nao disponivel | ✅ Com marca d'agua | ✅ Sem marca d'agua (limpo) |
| **Calendario lunar** | ❌ Nao disponivel | ✅ Incluido | ✅ Incluido |
| **Rede de parceiros** | ❌ Nao disponivel | 👁️ Apenas visualizar | ✅ Acesso completo (aparecer + visualizar) |
| **Historico de analises** | ❌ Nao disponivel | ❌ Nao disponivel | ✅ Incluido |
| **Pagamentos** | ❌ Nao disponivel | ❌ Nao disponivel | ✅ Controle financeiro completo |

### Detalhes dos limites

- **Free — 3 imoveis total:** Voce pode cadastrar ate 3 imoveis no total. Nao e possivel criar mais apos esse limite. Para continuar, faca upgrade.
- **Simples — 1 imovel ativo:** Voce pode ter apenas 1 imovel ativo por vez. Para cadastrar outro, precisa **arquivar** o imovel atual primeiro. Isso permite analisar diferentes imoveis ao longo do tempo, mas so um de cada vez.
- **Profissional — Ilimitado:** Sem limite de imoveis, clientes ou analises. Ideal para consultores que atendem varios clientes.

### Como fazer upgrade (Chaves de Ativacao)

O upgrade de plano e feito por meio de **chaves de ativacao**. Funciona assim:

1. Va ate a pagina **"Planos"** no menu lateral (icone ⭐)
2. Escolha o plano desejado (Simples ou Profissional)
3. Clique no botao **"Ativar"**
4. Digite a **chave de ativacao** que voce recebeu
5. Clique em **"Ativar"**
6. Pronto! Seu plano sera atualizado imediatamente 🎉

> 💡 **Onde consigo uma chave?** As chaves sao geradas pelo administrador do sistema. Entre em contato pelo e-mail **suporte@fengshuistudio.com** para adquirir a sua.

---

## 3. Primeiros Passos

### 3.1 Como criar uma conta

1. Acesse a pagina do FengShui Studio no seu navegador
2. Voce vera a tela de login com duas abas: **"Entrar"** e **"Cadastrar"**
3. Clique na aba **"Cadastrar"**
4. Preencha os campos:
   - **Nome completo** — Seu nome, como deseja ser identificado
   - **E-mail** — Um e-mail valido (sera usado para login)
   - **Senha** — Minimo de 6 caracteres
   - **Tipo de usuario** — Escolha entre as opcoes abaixo

### 3.2 Cadastro como Profissional vs Pessoal

Ao se cadastrar, voce escolhe o **tipo de usuario**. Isso determina como o sistema funciona para voce:

**🏠 Pessoal (uso proprio)**
- O sistema mostra o menu como "Minha Casa" ao inves de "Consultas"
- Voce e automaticamente cadastrado como seu proprio "cliente"
- Interface simplificada para analisar a propria residencia
- Nao precisa preencher dados profissionais

**👔 Profissional (consultor, arquiteto, decorador, etc.)**
- Ao escolher qualquer opcao profissional, o cadastro tera um **segundo passo**
- Voce preenchera dados profissionais:
  - Profissao (obrigatorio)
  - Area de atuacao (obrigatorio)
  - Registro profissional (opcional — CAU, CREA, etc.)
  - LinkedIn (opcional)
  - Instagram (opcional)
- O sistema mostra menus completos: Clientes, Consultas, Pagamentos, etc.

### 3.3 Confirmacao de e-mail

Apos criar a conta, voce recebera um **e-mail de confirmacao**. E muito importante!

1. Abra seu e-mail (a caixa de entrada do e-mail que voce usou no cadastro)
2. Procure o e-mail do FengShui Studio
3. Clique no link de confirmacao

> ⚠️ **Nao recebeu o e-mail?**
> - Verifique a pasta de **Spam** ou **Lixo Eletronico**
> - Aguarde alguns minutos
> - Use o botao **"Reenviar e-mail de confirmacao"** na tela de cadastro
> - Confirme se o e-mail digitado esta correto

### 3.4 Primeiro login

Apos confirmar o e-mail:

1. Volte para a pagina do FengShui Studio
2. Na aba **"Entrar"**, digite seu e-mail e senha
3. Clique em **"Entrar"**
4. Voce sera redirecionado para o **Dashboard** (painel principal)

---

## 4. Funcionalidades Detalhadas

### 4.1 Dashboard

O Dashboard e a **pagina inicial** do sistema apos o login. E como um "painel de controle" que mostra um resumo de tudo o que esta acontecendo.

#### KPIs (Indicadores Principais)

No topo do dashboard, voce vera 4 cartoes com numeros importantes:

| Indicador | O que mostra |
|---|---|
| 👤 **Clientes ativos** | Quantidade de clientes cadastrados e ativos |
| 📋 **Consultas realizadas** | Total de diagnosticos/consultas criados |
| 🌙 **Rituais pendentes** | Quantidade de rituais/curas agendados que ainda nao foram realizados |
| ⭐ **Plano atual** | Qual plano voce esta usando (Free, Simples ou Profissional) |

> 💡 Voce pode clicar em qualquer um desses cartoes para ir direto para a pagina correspondente.

#### Graficos Disponiveis

O Dashboard exibe **4 graficos** para ajudar voce a acompanhar sua atividade:

1. **📊 Status das Consultas (Grafico de Pizza)**
   - Mostra quantas consultas estao em cada status: Rascunho, Em andamento, Finalizada, Arquivada
   - As cores ajudam a identificar rapidamente: cinza (rascunho), amarelo (em andamento), verde (finalizada), cinza escuro (arquivada)

2. **💰 Pagamentos por Mes (Grafico de Barras)**
   - Mostra o financeiro dos ultimos 6 meses
   - Barras verdes = Recebido, amarelas = Pendente, vermelhas = Atrasado
   - Inclui mini-cartoes com totais: Recebido, Pendente e Atrasado

3. **📈 Consultas por Mes (Grafico de Linha)**
   - Mostra a evolucao de quantas consultas foram criadas a cada mes
   - Util para ver se seu volume de trabalho esta crescendo

4. **👥 Novos Clientes por Mes (Grafico de Barras)**
   - Mostra quantos clientes novos foram cadastrados a cada mes

#### Agenda de Proximas Atividades

Abaixo dos graficos, ha uma lista com as **proximas atividades dos proximos 30 dias**:

- 🌙 **Rituais pendentes** — Curas e rituais agendados
- 📋 **Consultas em andamento** — Diagnosticos ainda nao finalizados
- 💰 **Pagamentos proximos** — Cobranças pendentes ou atrasadas

#### Analises Ba Gua Recentes

Se voce ja realizou analises Ba Gua em imoveis, elas aparecem aqui com o status:
- ✅ **Concluida** — Analise finalizada com data/hora
- ⏳ **Em andamento** — Analise ainda em progresso

#### Acoes Rapidas

No final do Dashboard ha atalhos para as acoes mais comuns:
- ✨ **Nova consulta** — Iniciar um novo diagnostico
- 👤 **Novo cliente** — Cadastrar um cliente
- 📄 **Ver relatorios** — Acessar consultas finalizadas
- 🌙 **Calendario lunar** — Ver proximos rituais

---

### 4.2 Consultas (Diagnosticos)

Esta e a funcionalidade **principal** do sistema. Aqui voce cria e gerencia os diagnosticos de Feng Shui dos imoveis.

> 📝 **Nota:** Para usuarios pessoais, esta pagina aparece como **"Minha Casa"** no menu.

#### Criar Nova Consulta

O processo de criacao de uma consulta tem **2 etapas**:

**Etapa 1 — Dados do Imovel:**

Preencha as informacoes basicas do imovel:

| Campo | Descricao | Obrigatorio? |
|---|---|---|
| **Cliente** | Selecione o cliente (so para profissionais) | Sim (profissionais) |
| **Nome do imovel** | Um nome para identificar o imovel (ex: "Apartamento Centro") | Nao |
| **Tipo do imovel** | Residencial, Comercial, Escritorio ou Outro | Sim |
| **Area total (m²)** | A metragem total do imovel | Nao |
| **Posicao da porta** | Onde fica a porta principal: Centro, Esquerda ou Direita | Sim |
| **Endereco** | Endereco completo do imovel | Nao |

> 💡 **Usuarios pessoais:** O sistema automaticamente cadastra voce como "cliente" de si mesmo. Nao precisa se preocupar com isso — basta preencher os dados do imovel.

**Etapa 2 — Selecao dos Setores Ba Gua:**

Nesta etapa, voce escolhe quais setores do Ba Gua serao analisados. O Ba Gua e dividido em **9 setores**, cada um representando uma area da vida:

| # | Setor | Elemento | Posicao | O que representa |
|---|---|---|---|---|
| 1 | **Carreira** | Agua 💧 | Centro-Norte | Vida profissional, caminho de vida, fluxo |
| 2 | **Conhecimento** | Terra 🏔️ | Nordeste | Sabedoria, estudos, autoconhecimento |
| 3 | **Familia** | Madeira 🌳 | Leste | Relacoes familiares, saude, raizes |
| 4 | **Prosperidade** | Madeira 🌳 | Sudeste | Abundancia, riqueza, fluxo financeiro |
| 5 | **Centro** | Terra 🏔️ | Centro | Equilibrio, saude geral, vitalidade |
| 6 | **Pessoas Uteis** | Metal ⚙️ | Noroeste | Mentores, amigos, conexoes importantes |
| 7 | **Filhos/Criatividade** | Metal ⚙️ | Oeste | Criatividade, projetos, filhos |
| 8 | **Relacionamentos** | Terra 🏔️ | Sudoeste | Amor, casamento, parcerias |
| 9 | **Fama** | Fogo 🔥 | Sul | Reputacao, reconhecimento, autoestima |

Voce pode selecionar setores individualmente clicando neles, ou usar o botao **"Selecionar todos"** para analisar todos os 9 setores.

#### Diagnostico com Criterios

Apos criar a consulta, voce fara o diagnostico de cada setor selecionado. Para cada setor, existem **8 criterios** de avaliacao:

1. 🧹 **Limpeza e organizacao** — O ambiente esta limpo e organizado?
2. 💡 **Iluminacao adequada** — A luz e suficiente e agradavel?
3. 🌬️ **Ventilacao e ar fresco** — O ar circula bem no ambiente?
4. 🎨 **Cores harmonicas** — As cores estao de acordo com o elemento do setor?
5. 🛋️ **Mobiliario posicionado** — Os moveis estao bem posicionados?
6. 🌿 **Plantas e elementos naturais** — Ha plantas vivas ou elementos da natureza?
7. 🔧 **Ausencia de objetos quebrados** — Nao ha objetos danificados?
8. 🌊 **Fluxo de energia livre** — A energia (Chi) circula livremente?

Cada criterio recebe uma **nota** que influencia o score percentual do setor.

#### Recomendacoes e Curas

Com base no diagnostico, o sistema gera **recomendacoes personalizadas** para cada setor. As recomendacoes sao organizadas por tipo:

- 🔴 **Urgente** — Problemas criticos que precisam de atencao imediata
- 🟡 **Melhoria** — Sugestoes para melhorar a energia do setor
- 🟢 **Manutencao** — Dicas para manter o bom estado do setor

Para cada setor, o sistema sugere:
- **Cores indicadas** — Quais cores usar na decoracao
- **Cristais recomendados** — Pedras para ativacao energetica
- **Plantas sugeridas** — Tipos de plantas que harmonizam o setor
- **Acoes praticas** — O que fazer concretamente para melhorar

#### Fotos do Imovel

Voce pode adicionar fotos de cada comodo do imovel para documentar o estado atual e facilitar a analise. As fotos sao organizadas por comodo e podem ser visualizadas junto com o diagnostico.

#### Roda da Vida

A **Roda da Vida** e uma ferramenta visual que mostra como voce avalia cada area da sua vida em uma escala. As areas avaliadas sao:

- Carreira
- Espiritualidade
- Familia / Saude
- Prosperidade
- Fama / Reputacao
- Relacionamentos
- Criatividade / Filhos
- Pessoas Uteis
- Saude / Centro

Cada area recebe uma nota, e o sistema gera um grafico em forma de "teia" mostrando quais areas estao em equilibrio e quais precisam de atencao.

#### Fluxo de Chi

O **Fluxo de Chi** permite mapear como a energia vital (Chi) circula pelo imovel. O sistema possui um checklist para verificar se o fluxo de energia esta adequado, identificando:

- Bloqueios de energia (moveis mal posicionados, corredores obstruidos)
- Areas de estagnacao (cantos mortos, ambientes fechados)
- Posicoes de comando (posicao ideal do movel principal em cada ambiente)

#### Gerar Relatorio PDF

Ao finalizar o diagnostico, voce pode gerar um **relatorio em PDF** com todas as informacoes:

| Plano | PDF |
|---|---|
| 🆓 Free | ❌ Nao disponivel |
| 💙 Simples | ✅ Com marca d'agua do FengShui Studio |
| 💜 Profissional | ✅ Sem marca d'agua (relatorio limpo e profissional) |

O relatorio inclui: dados do imovel, scores de cada setor, recomendacoes, curas sugeridas e graficos.

#### Status de uma Consulta

Cada consulta passa por diferentes status:

| Status | Significado | Icone |
|---|---|---|
| **Rascunho** | Consulta criada mas ainda nao iniciada | ⚪ |
| **Em andamento** | Diagnostico sendo realizado | 🟡 |
| **Finalizada** | Diagnostico completo, pronto para gerar PDF | 🟢 |
| **Arquivada** | Consulta guardada no historico | ⚫ |

---

### 4.3 Clientes (Plano Profissional)

> ⚠️ **Funcionalidade exclusiva do plano Profissional.** No plano Free e Simples, o cadastro de clientes externos nao esta disponivel.

A pagina de Clientes permite gerenciar todos os seus clientes de forma organizada.

#### Cadastrar um novo cliente

Clique no botao **"+ Novo cliente"** e preencha:

**Dados pessoais:**
- Nome completo (obrigatorio)
- E-mail
- Telefone

**Endereco completo:**
- CEP (ao digitar, o sistema busca automaticamente o endereco via ViaCEP!)
- Rua / Logradouro
- Numero
- Complemento
- Bairro
- Cidade
- Estado
- Pais

**Adicional:**
- Observacoes / Notas
- Foto do cliente (JPG, PNG ou WEBP, maximo 5MB)

> 💡 **Dica do CEP:** Digite o CEP completo e o sistema preenche automaticamente a rua, bairro, cidade e estado!

#### Vincular cliente a consulta

Ao criar uma nova consulta, voce seleciona o cliente no primeiro passo. O cliente fica vinculado aquela consulta e aparece nos relatorios e pagamentos.

Na lista de clientes, cada cartao possui um botao **"Nova consulta"** que ja abre o formulario com o cliente selecionado.

#### Foto do cliente

Voce pode adicionar uma foto ao perfil do cliente. Formatos aceitos:
- JPEG / JPG
- PNG
- WEBP
- Tamanho maximo: 5MB

A foto aparece no cartao do cliente e nos relatorios.

---

### 4.4 Pagamentos (Plano Profissional)

> ⚠️ **Funcionalidade exclusiva do plano Profissional.**

O modulo de Pagamentos permite controlar as financas das suas consultas.

#### Registrar um pagamento

Clique em **"+ Novo pagamento"** e preencha:

| Campo | Descricao |
|---|---|
| **Descricao** | Ex: "Consulta residencial - Joao" (obrigatorio) |
| **Valor (R$)** | O valor da cobranca (obrigatorio) |
| **Status** | Pendente, Pago, Atrasado ou Cancelado |
| **Vencimento** | Data de vencimento (obrigatorio) |
| **Data pagamento** | Data em que foi pago (se ja pago) |
| **Metodo** | Pix, Cartao, Boleto, Dinheiro, Transferencia ou Outro |
| **Cliente** | Vincular a um cliente cadastrado |
| **Consulta vinculada** | Vincular a uma consulta especifica |
| **Observacoes** | Notas adicionais |

#### Status de pagamento

| Status | Cor | Significado |
|---|---|---|
| 🟡 **Pendente** | Amarelo | Aguardando pagamento |
| 🟢 **Pago** | Verde | Pagamento recebido |
| 🔴 **Atrasado** | Vermelho | Vencido e nao pago |
| ⚫ **Cancelado** | Cinza | Pagamento cancelado |

> 💡 O sistema marca automaticamente como **"Atrasado"** pagamentos pendentes cujo vencimento ja passou.

#### Acoes rapidas nos pagamentos

- **✓ Pago** — Marcar um pagamento pendente/atrasado como pago (com data de hoje)
- **Editar** — Alterar dados do pagamento
- **Excluir** — Remover o pagamento (com confirmacao)

#### Historico e Filtros

- Filtre por status: Todos, Pendente, Pago, Atrasado, Cancelado
- Paginacao automatica (10 itens por pagina)
- KPIs no topo: Total Recebido, Total Pendente, Total Atrasado

---

### 4.5 Curas e Rituais

A pagina de **Curas** e um verdadeiro guia pratico de harmonizacao! Ela oferece informacoes detalhadas sobre como aplicar curas em cada setor do Ba Gua.

#### O que sao curas no Feng Shui?

"Curas" sao acoes praticas para corrigir desequilibrios energeticos em um ambiente. Podem incluir:

- 💎 **Cristais** — Pedras com propriedades energeticas especificas
- 🌿 **Plantas** — Vegetais vivos que purificam e ativam energia
- 🪞 **Objetos** — Espelhos, sinos de vento, fontes de agua, etc.
- 🧘 **Mudras** — Posicoes das maos para canalizacao de energia
- 🧘‍♀️ **Meditacoes** — Praticas meditativas especificas para cada setor
- 🔔 **Mantras** — Sons e palavras sagradas para harmonizacao

#### Conteudo por Elemento

O sistema organiza as curas pelos **9 elementos/setores**:

1. **Agua / Carreira** — Cristais: Agua-marinha, Sodalita. Plantas: Bambu da sorte, Lirio da paz
2. **Terra / Conhecimento** — Cristais: Ametista, Fluorita. Plantas: Suculentas
3. **Madeira / Familia** — Cristais: Quartzo verde, Jade. Plantas: Ficus, Palmeira
4. **Madeira / Prosperidade** — Cristais: Citrino, Pirita. Plantas: Crassula (Jade)
5. **Terra / Centro** — Cristais: Citrino, Calcita mel. Plantas: Crisantemo amarelo
6. **Fogo / Fama** — Cristais: Jaspe vermelha, Granada. Plantas: Bromelia vermelha
7. **Terra / Relacionamentos** — Cristais: Quartzo rosa, Pedra da lua. Plantas: Orquideas
8. **Metal / Criatividade** — Cristais: Cristal branco, Selenita. Plantas: Orquidea branca
9. **Metal / Pessoas Uteis** — Cristais: Turmalina preta, Olho de tigre. Plantas: Lotus

#### Como agendar rituais

Na pagina do Calendario (proximo topico), voce pode criar rituais vinculados a fases lunares. Os rituais ficam associados a um cliente e aparecem na agenda do Dashboard.

#### Fases Lunares e Curas

Cada fase lunar e ideal para um tipo diferente de cura:

| Fase | Emoji | Ideal para |
|---|---|---|
| 🌑 **Lua Nova** | Inicio de ciclos, limpeza energetica, definicao de intencoes |
| 🌒 **Lua Crescente** | Ativacao do Ba Gua, organizacao, rituais de prosperidade |
| 🌕 **Lua Cheia** | Gratidao, energizacao de cristais, celebracao |
| 🌘 **Lua Minguante** | Desapego, liberacao, banhos de ervas, reflexao |

---

### 4.6 Calendario Chines / Lunar

> ⚠️ **Disponivel nos planos Simples e Profissional.**

O Calendario Lunar e uma ferramenta que mostra as fases da lua e ajuda voce a planejar rituais e curas no momento mais adequado.

#### Funcionalidades do Calendario

- 📅 **Calendario mensal** com dias e fases lunares
- 🌙 **Fase lunar atual** com nome e emoji
- 📆 **Proximas fases** marcadas no calendario (Lua Nova, Quarto Crescente, Lua Cheia, Quarto Minguante)
- ✨ **Rituais sugeridos** para cada fase lunar
- ➕ **Criar rituais** personalizados vinculados a uma data e fase lunar

#### Rituais Sugeridos por Fase

**🌑 Lua Nova:**
- Limpeza energetica (sal grosso e incenso)
- Definicao de intencoes (escrever metas)
- Meditacao de silencio (15 minutos)

**🌒 Lua Crescente:**
- Ativacao do Ba Gua (elementos correspondentes)
- Organizacao de ambientes (gavetas e armarios)
- Ritual de prosperidade (moedas + vela amarela)

**🌕 Lua Cheia:**
- Ritual de gratidao
- Energizacao de cristais (sob a luz da lua)
- Celebracao e colheita

**🌘 Lua Minguante:**
- Desapego e liberacao (doar roupas e objetos)
- Banho de ervas (alecrim, lavanda)
- Revisao e reflexao do ciclo

#### Quando usar

Use o calendario para:
- Planejar rituais e limpezas energeticas na melhor fase lunar
- Agendar consultas com clientes em datas propícias
- Acompanhar o ciclo lunar e suas influencias energeticas

---

### 4.7 Rede de Parceiros

A Rede de Parceiros e um diretorio onde profissionais de Feng Shui e areas relacionadas podem ser encontrados por usuarios do sistema.

#### Como aparecer na rede

Para aparecer na Rede de Parceiros, voce precisa:

1. Ter um plano **Simples** ou **Profissional**
2. Ir ate a pagina **"Perfil"**
3. Na secao **"Rede de Parceiros"**, ativar o toggle **"Aparecer na Rede de Parceiros"**
4. Salvar o perfil

Quando ativado, seu perfil fica visivel para todos os outros usuarios do sistema.

#### Informacoes exibidas no perfil de parceiro

- Nome completo
- Tipo de profissional (icone e badge)
- Profissao e area de atuacao
- Registro profissional (se preenchido)
- Cidade e estado
- Bio / Apresentacao (ate 120 caracteres no cartao)
- Links para LinkedIn e Instagram

#### Filtros de busca

Os usuarios podem encontrar parceiros usando:
- 🔍 **Busca por texto** — Nome, profissao, cidade
- 📍 **Filtro por estado** — Todos os estados do Brasil
- 👔 **Filtro por tipo de profissional** — Arquiteto, Profissional de Feng Shui, Decorador, Outro

> 💡 **Plano Free:** Usuarios do plano Free veem um aviso de que precisam fazer upgrade para aparecer na rede, mas podem visualizar os parceiros disponiveis.

---

### 4.8 Produtos

A pagina de Produtos apresenta **sugestoes de produtos afiliados** uteis para aplicar curas de Feng Shui. Os produtos sao organizados por categorias:

| Categoria | Icone | Exemplos |
|---|---|---|
| **Espelhos** | 🪞 | Espelho Concavo Ba Gua, Espelho Convexo, Espelho Plano Octogonal |
| **Cristais e Pedras** | 💎 | Cristal Multifacetado, Quartzo Rosa, Obsidiana, Citrino, Ametista |
| **Fontes de Agua** | ⛲ | Fonte de Mesa Bambu, Fonte Cascata Ceramica, Mini Aquario |
| **Plantas e Vasos** | 🌿 | Bambu da Sorte, Espada de Sao Jorge, Lirio da Paz |
| **Sinos de Vento** | 🎐 | Sino 5 Tubos, Sino de Bambu, Mobile Cristal |
| **Velas e Incensos** | 🕯️ | Kit Velas 7 Chakras, Incensario Cascata |

Cada produto mostra:
- Nome e descricao
- Tag de uso (Ex: "Protecao", "Prosperidade", "Ativacao")
- Preco de referencia

> 📝 **Nota:** Os produtos sao sugestoes informativas. Os precos podem variar.

---

### 4.9 Perfil

A pagina de Perfil permite gerenciar todas as suas informacoes pessoais e profissionais.

#### Dados pessoais (todos os usuarios)

- Nome completo
- Telefone
- Cidade
- Estado

#### Dados profissionais (todos os usuarios)

- Nome da empresa
- Site
- Bio / Apresentacao (texto livre para descrever sua experiencia)

#### Perfil profissional (apenas profissionais)

- Profissao
- Area de atuacao
- Registro profissional (CAU, CREA, etc.)
- LinkedIn
- Instagram

#### Configuracao de Parceiro Visivel (planos Simples e Profissional)

Toggle para ativar/desativar sua visibilidade na Rede de Parceiros.

- **Ativado (verde):** Seu perfil esta visivel para outros usuarios
- **Desativado (cinza):** Seu perfil esta oculto

#### Modo Escuro

O FengShui Studio possui um **modo escuro** (tema noturno) que pode ser ativado clicando no icone 🌙 no menu lateral. Para voltar ao modo claro, clique no icone ☀️.

A preferencia e salva automaticamente no seu navegador.

---

### 4.10 Planos e Upgrade

A pagina de Planos mostra todos os planos disponiveis com seus recursos e permite fazer upgrade.

#### Como ativar uma chave

1. Acesse **"Planos"** no menu lateral (icone ⭐)
2. Veja seu plano atual destacado no topo
3. Clique em **"Ativar Simples"** ou **"Ativar Profissional"**
4. Um campo aparecera para digitar a chave de ativacao
5. Cole ou digite a chave recebida
6. Clique em **"Ativar"**
7. Se a chave for valida, seu plano sera atualizado instantaneamente!

#### Voltar para o plano Free

Se desejar, voce pode voltar ao plano Free:
1. Na pagina de Planos, clique em **"Mudar para Free"**
2. Confirme a acao (voce perdera acesso aos recursos pagos)

> ⚠️ **Atencao:** Ao voltar para o Free, voce perde acesso a: PDF, calendario, parceiros, clientes, pagamentos e historico.

---

## 5. Area Administrativa

A area administrativa e acessivel apenas por usuarios com o papel de **admin**. Quando logado como admin, um item extra aparece no menu lateral: 🔧 **Admin**.

### Acesso admin

O papel de admin e definido no banco de dados (campo `role = 'admin'` na tabela `profiles`). Apenas o administrador do sistema pode promover outros usuarios.

### Gerenciamento de Chaves de Ativacao

O admin pode:
- **Criar chaves** de ativacao para os planos Simples e Profissional
- **Visualizar todas as chaves** — Status: Disponivel, Usada, Expirada, Cancelada
- **Ver quem usou** cada chave e quando
- **Adicionar notas** a cada chave (ex: "Chave para o cliente Joao")
- **Definir data de expiracao** para as chaves

#### Status das chaves

| Status | Significado |
|---|---|
| ✅ **Available (Disponivel)** | Chave pronta para ser usada |
| 🔵 **Used (Usada)** | Chave ja ativada por um usuario |
| ⏰ **Expired (Expirada)** | Chave com prazo vencido |
| ❌ **Cancelled (Cancelada)** | Chave cancelada pelo admin |

### Promocao de Usuarios

O admin pode alterar o papel (role) de um usuario para:
- `user` — Usuario normal
- `consultor` — Consultor profissional
- `admin` — Administrador do sistema

### Log de Auditoria

O sistema registra um **log de auditoria** com todas as acoes administrativas:
- Quem fez a acao
- Quando foi feita
- Tipo de acao (criacao de chave, ativacao de plano, etc.)
- Detalhes adicionais

---

## 6. Arquitetura Tecnica (para desenvolvedores)

> 📝 **Nota:** Esta secao e voltada para desenvolvedores e equipe tecnica.

### Stack Tecnologico

| Tecnologia | Funcao | Versao |
|---|---|---|
| **Next.js** | Framework web (frontend e API) | 16.1.6 |
| **React** | Biblioteca de interface | 19.2.3 |
| **TypeScript** | Linguagem de programacao tipada | 5.9.3 |
| **Supabase** | Banco de dados, autenticacao e storage | SDK 2.97.0 |
| **Tailwind CSS** | Estilizacao | 4.x |
| **Recharts** | Graficos e visualizacoes | 3.7.0 |
| **jsPDF** | Geracao de relatorios PDF | 4.2.0 |
| **html2canvas** | Captura de tela para PDF | 1.4.1 |
| **Vitest** | Testes automatizados | 4.1.0 |
| **Vercel** | Hospedagem e deploy | — |

### Estrutura de Pastas

```
fengshuistudio/
├── app/                        # Paginas e rotas (Next.js App Router)
│   ├── components/             # Componentes reutilizaveis (AppShell, Skeleton, etc.)
│   ├── login/page.tsx          # Tela de login e cadastro
│   ├── dashboard/page.tsx      # Painel principal
│   ├── consultas/              # Listagem e gestao de consultas
│   │   ├── page.tsx
│   │   ├── nova/page.tsx       # Criar nova consulta
│   │   └── [id]/page.tsx       # Detalhe de uma consulta
│   ├── clientes/page.tsx       # Gestao de clientes
│   ├── pagamentos/page.tsx     # Controle financeiro
│   ├── curas/page.tsx          # Curas e rituais
│   ├── calendario/page.tsx     # Calendario lunar
│   ├── parceiros/page.tsx      # Rede de parceiros
│   ├── produtos/page.tsx       # Produtos afiliados
│   ├── perfil/page.tsx         # Meu perfil
│   ├── planos/page.tsx         # Planos e upgrade
│   ├── admin/                  # Area administrativa
│   │   └── chaves/page.tsx     # Gestao de chaves de ativacao
│   └── api/                    # Rotas de API (backend)
│       ├── consultas/          # API de consultas
│       ├── clientes/           # API de clientes
│       └── planos/             # API de planos e ativacao
├── src/
│   └── lib/
│       ├── types.ts            # Tipos TypeScript compartilhados
│       ├── constants.ts        # Constantes (setores, criterios, cores, dicas)
│       ├── plano-utils.ts      # Logica de planos e limites
│       └── supabase.ts         # Cliente Supabase
├── supabase/
│   └── migrations/             # Scripts SQL de migracao do banco
├── docs/                       # Documentacao
├── package.json                # Dependencias do projeto
└── tsconfig.json               # Configuracao TypeScript
```

### Banco de Dados (Tabelas Principais)

O banco de dados e hospedado no **Supabase** (PostgreSQL). As tabelas principais sao:

| Tabela | Descricao |
|---|---|
| `profiles` | Perfis de usuario (nome, plano, tipo, dados profissionais) |
| `clientes` | Clientes cadastrados por consultores |
| `consultas` | Diagnosticos de Feng Shui (dados do imovel, status) |
| `setores_bagua` | Setores do Ba Gua de cada consulta (9 por consulta) |
| `diagnostico_criterios` | Criterios avaliados em cada setor (score por criterio) |
| `pagamentos` | Registros financeiros |
| `rituais` | Rituais e curas agendados |
| `activation_keys` | Chaves de ativacao de planos |
| `audit_log` | Log de acoes administrativas |

### Autenticacao (Supabase Auth)

O sistema usa o **Supabase Auth** para autenticacao:
- Cadastro com e-mail e senha
- Confirmacao de e-mail obrigatoria
- Login com e-mail e senha
- Recuperacao de senha por e-mail
- Sessao persistente (voce nao precisa fazer login toda vez)

### Armazenamento de Arquivos (Supabase Storage)

Fotos de clientes e imoveis sao armazenadas no **Supabase Storage**:
- Bucket dedicado para fotos
- Formatos aceitos: JPEG, PNG, WEBP
- Tamanho maximo: 5MB por arquivo
- URLs publicas geradas automaticamente

### Deploy (Vercel)

O sistema e hospedado na **Vercel**, uma plataforma de deploy automatico:
- Deploy automatico a cada commit no repositorio
- HTTPS incluso
- CDN global para performance

---

## 7. Configuracao do Banco de Dados

### Como executar migracoes

As migracoes sao scripts SQL que criam e atualizam a estrutura do banco de dados. Os arquivos estao em `supabase/migrations/`.

**Migracoes disponiveis:**

| Arquivo | O que faz |
|---|---|
| `20260316_complete_setup_with_rls.sql` | Migracao completa: colunas faltantes + RLS em todas as tabelas |
| `20260316_add_profile_professional_columns.sql` | Adiciona colunas profissionais na tabela profiles |
| `20260316_admin_activation_keys.sql` | Cria tabela de chaves de ativacao e log de auditoria |
| `20260316_fix_all_missing_columns.sql` | Corrige colunas ausentes em todas as tabelas |

**Para executar:**

1. Acesse o **Supabase Dashboard** (painel do Supabase)
2. Va em **SQL Editor**
3. Cole o conteudo do arquivo de migracao
4. Clique em **Run**

> 💡 As migracoes sao **idempotentes** — ou seja, sao seguras para rodar varias vezes. Elas usam `IF NOT EXISTS` e `DROP ... IF EXISTS` para evitar erros.

### Tabelas e suas colunas principais

#### Tabela `profiles`

| Coluna | Tipo | Descricao |
|---|---|---|
| `id` | UUID | ID do usuario (mesmo do Supabase Auth) |
| `nome_completo` | TEXT | Nome completo |
| `plano` | TEXT | Plano atual (free, simples, profissional) |
| `tipo_usuario` | TEXT | Tipo (pessoal, consultor, arquiteto, etc.) |
| `role` | TEXT | Papel no sistema (user, consultor, admin) |
| `nome_empresa` | TEXT | Nome da empresa |
| `telefone` | TEXT | Telefone |
| `cidade` | TEXT | Cidade |
| `estado` | TEXT | Estado (UF) |
| `bio` | TEXT | Biografia/apresentacao |
| `site` | TEXT | Website |
| `profissao` | TEXT | Profissao |
| `area_atuacao` | TEXT | Area de atuacao |
| `registro_profissional` | TEXT | Registro (CAU, CREA) |
| `linkedin` | TEXT | URL do LinkedIn |
| `instagram` | TEXT | Perfil do Instagram |
| `parceiro_visivel` | BOOLEAN | Aparece na rede de parceiros? |

#### Tabela `clientes`

| Coluna | Tipo | Descricao |
|---|---|---|
| `id` | UUID | Identificador unico |
| `consultor_id` | UUID | ID do profissional (dono) |
| `nome_completo` | TEXT | Nome do cliente |
| `email` | TEXT | E-mail |
| `telefone` | TEXT | Telefone |
| `cep`, `rua`, `numero`, etc. | TEXT | Endereco completo |
| `foto_url` | TEXT | URL da foto |
| `ativo` | BOOLEAN | Cliente ativo? |

#### Tabela `consultas`

| Coluna | Tipo | Descricao |
|---|---|---|
| `id` | UUID | Identificador unico |
| `consultor_id` | UUID | ID do profissional |
| `cliente_id` | UUID | ID do cliente |
| `nome_imovel` | TEXT | Nome do imovel |
| `tipo_imovel` | TEXT | Residencial, comercial, etc. |
| `area_total_m2` | NUMERIC | Area em metros quadrados |
| `status` | TEXT | rascunho, em_andamento, finalizada, arquivada |
| `roda_da_vida` | JSONB | Dados da Roda da Vida |
| `checklist_chi` | JSONB | Checklist do fluxo de Chi |

### RLS (Row Level Security) explicado de forma simples

O **RLS** e uma camada de seguranca do banco de dados que garante que **cada usuario so veja seus proprios dados**. Funciona assim:

- 🔒 **Voce so ve seus proprios clientes** — Ninguem mais pode acessar
- 🔒 **Voce so ve suas proprias consultas** — Mesmo no banco de dados
- 🔒 **Voce so edita seu proprio perfil** — Ninguem pode alterar seus dados
- 🔒 **Parceiros visiveis** — Se voce ativou "parceiro visivel", todos os usuarios logados podem ver seu perfil (mas so as informacoes publicas)
- 🔒 **Admin ve tudo** — Usuarios com role "admin" podem ver todos os perfis

Em termos simples: **e como se cada usuario tivesse seu proprio "cofre" de dados que so ele pode abrir**.

---

## 8. Variaveis de Ambiente

O sistema precisa de duas variaveis de ambiente para funcionar. Elas sao configuradas no arquivo `.env.local` (na raiz do projeto) ou nas configuracoes de deploy da Vercel.

| Variavel | O que e | Onde encontrar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | O endereco (URL) do seu projeto Supabase | Painel do Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | A chave publica (anonima) do Supabase | Painel do Supabase → Settings → API → anon public |

**Exemplo de `.env.local`:**

```
NEXT_PUBLIC_SUPABASE_URL=https://seuprojetoid.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ **Importante:**
> - A `ANON_KEY` e uma chave **publica** e segura para uso no frontend
> - **Nunca** compartilhe a `SERVICE_ROLE_KEY` (chave de servico) — ela tem acesso total ao banco
> - As variaveis com prefixo `NEXT_PUBLIC_` sao visiveis no navegador (isso e normal e esperado)

---

## 9. FAQ / Perguntas Frequentes

### "Limite de imoveis atingido" — o que fazer?

**Plano Free (3 imoveis):**
- Voce ja cadastrou o maximo de 3 imoveis
- Para continuar, faca upgrade para o plano Simples ou Profissional
- Va em **Planos** → Escolha um plano → Use sua chave de ativacao

**Plano Simples (1 imovel ativo):**
- Voce ja tem 1 imovel ativo
- Para cadastrar outro, primeiro **arquive** o imovel atual:
  1. Va em **Consultas** (ou Minha Casa)
  2. Abra a consulta atual
  3. Altere o status para **"Arquivada"**
  4. Agora voce pode criar uma nova consulta
- Ou faca upgrade para o plano **Profissional** (imoveis ilimitados)

### "Pagina nao carrega" — verificar migracoes

Se uma pagina apresenta erro ou nao carrega os dados:

1. **Verifique se as migracoes foram executadas:**
   - Acesse o Supabase Dashboard
   - Va em SQL Editor
   - Execute o arquivo `20260316_complete_setup_with_rls.sql`
   - Isso cria todas as colunas e politicas de seguranca necessarias

2. **Verifique as variaveis de ambiente:**
   - Confirme que `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estao corretas
   - Reinicie o servidor de desenvolvimento se estiver rodando localmente

3. **Limpe o cache do navegador:**
   - Pressione `Ctrl + Shift + Delete` (ou `Cmd + Shift + Delete` no Mac)
   - Selecione "Dados em cache" e limpe

### Como resetar a senha?

1. Na tela de login, clique em **"Esqueci minha senha"**
2. Digite seu e-mail
3. Voce recebera um e-mail com um link para redefinir a senha
4. Clique no link e defina uma nova senha

> 💡 Verifique a pasta de Spam se nao receber o e-mail.

### Posso usar o sistema no celular?

Sim! O FengShui Studio e **responsivo**, ou seja, se adapta a telas de celular e tablet. O menu lateral se transforma em um menu hamburguer (☰) que pode ser aberto e fechado.

### Meus dados estao seguros?

Sim! O sistema usa:
- **HTTPS** — Toda comunicacao e criptografada
- **Supabase Auth** — Autenticacao segura com tokens
- **RLS (Row Level Security)** — Cada usuario so acessa seus proprios dados no banco
- **Senhas criptografadas** — Suas senhas nunca sao armazenadas em texto puro

### Como entro em contato com o suporte?

Envie um e-mail para **suporte@fengshuistudio.com** com:
- Seu nome e e-mail de cadastro
- Descricao do problema
- Captura de tela (se possivel)

---

## 10. Glossario

### Termos de Feng Shui

| Termo | Significado |
|---|---|
| ☯ **Feng Shui** | Antiga arte chinesa de harmonizacao de ambientes. Literalmente "vento e agua". Estuda como a disposicao dos espacos influencia a energia e o bem-estar. |
| 🔲 **Ba Gua** | Mapa octogonal (8 lados + centro) que divide um espaco em 9 setores, cada um correspondendo a uma area da vida. E a principal ferramenta do Feng Shui. |
| 🌊 **Chi (Qi)** | Energia vital que flui por todos os ambientes e seres vivos. O objetivo do Feng Shui e fazer o Chi fluir de forma harmoniosa. |
| 🧭 **Setores** | As 9 divisoes do Ba Gua: Carreira, Conhecimento, Familia, Prosperidade, Centro, Fama, Relacionamentos, Criatividade e Pessoas Uteis. |
| 💊 **Curas** | Acoes praticas para corrigir desequilibrios energeticos: adicionar plantas, cristais, cores, espelhos, fontes, etc. |
| 🔥 **Cinco Elementos** | Agua, Madeira, Fogo, Terra e Metal. Cada setor do Ba Gua e associado a um elemento que rege sua energia. |
| 🌑 **Fase Lunar** | Posicao da lua em relacao ao sol (Nova, Crescente, Cheia, Minguante). Cada fase e ideal para diferentes tipos de curas e rituais. |
| ☰ **Trigramas** | Simbolos de tres linhas (cheias ou cortadas) do I Ching que representam forcas da natureza. Cada setor do Ba Gua tem um trigrama associado. |
| 🏠 **Posicao de Comando** | A posicao ideal de um movel (cama, mesa, sofa) em um comodo — geralmente de costas para uma parede solida, com visao da porta. |
| 🌿 **Fluxo de Chi** | O caminho que a energia percorre dentro do imovel. Deve ser suave e curvo, sem bloqueios ou corredores longos e estreitos. |
| 🧘 **Mudra** | Posicao das maos usada em meditacao para canalizar energia. Cada setor do Ba Gua tem um mudra especifico. |
| 🔔 **Mantra** | Som ou frase sagrada repetida durante rituais para harmonizacao energetica. |
| 🌸 **Roda da Vida** | Ferramenta de autoavaliacao que mede a satisfacao em cada area da vida, correlacionando com os setores do Ba Gua. |
| 💜 **Lo Shu** | Quadrado magico chines de 3x3 que define a ordem dos setores do Ba Gua. A sequencia e: Prosperidade, Fama, Relacionamentos / Familia, Centro, Criatividade / Conhecimento, Carreira, Pessoas Uteis. |

### Termos Tecnicos Simplificados

| Termo Tecnico | O que significa na pratica |
|---|---|
| **Dashboard** | Painel principal / Tela inicial do sistema |
| **Login** | Entrar no sistema com e-mail e senha |
| **Logout** | Sair do sistema |
| **Cadastro / Sign Up** | Criar uma conta nova |
| **Toggle** | Botao de liga/desliga (como um interruptor) |
| **Upload** | Enviar um arquivo (foto) do seu computador para o sistema |
| **PDF** | Formato de documento que pode ser baixado e impresso |
| **Responsivo** | O site se adapta a diferentes tamanhos de tela (celular, tablet, computador) |
| **Modo Escuro** | Tema de cores escuras para usar em ambientes com pouca luz |
| **KPI** | Indicador numerico (ex: "5 clientes ativos") |
| **Filtro** | Ferramenta para mostrar apenas itens que correspondam a um criterio |
| **Paginacao** | Divisao de uma lista grande em paginas (10 itens por pagina) |
| **Chave de Ativacao** | Codigo que voce digita para desbloquear um plano |
| **Migracao** | Script que atualiza a estrutura do banco de dados |
| **RLS** | Regra de seguranca que garante que voce so veja seus proprios dados |
| **API** | "Canal de comunicacao" entre o site e o banco de dados |
| **Deploy** | Processo de colocar o sistema no ar (publicar na internet) |
| **Supabase** | Servico de banco de dados e autenticacao usado pelo sistema |
| **Vercel** | Servico de hospedagem onde o site fica "no ar" |

---

> 📝 **Este documento foi criado para facilitar o entendimento do FengShui Studio. Se tiver duvidas, entre em contato pelo e-mail suporte@fengshuistudio.com.**

---

*FengShui Studio 2026 — CollabZ Consultoria*
*Todos os direitos reservados.*
