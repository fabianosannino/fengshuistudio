# ADR 0032 — Indicação diz quem vende, e o clique é medido sem identificar quem clicou

**Data:** 2026-08-14
**Status:** aceito
**Relacionado:** ADR 0028 (projeção pública), ADR 0030 (pedido como máquina de
estados), ADR 0031 (entrega derivada)
**Modelo completo:** `docs/domain/modelo-da-loja.md`, seções 8 e 12, fase 4

## O contexto

Um produto de terceiro pode ser vendido de dois jeitos:

- **indicação** — o terceiro vende na loja dele, o dinheiro **não** passa por
  aqui, e nós ganhamos comissão sobre o que encaminhamos;
- **marketplace** — a cobrança passa por nós.

A diferença é jurídica antes de ser visual. No marketplace deixamos de ser
vitrine e viramos intermediário, e o CDC trata a cadeia de fornecimento como
**solidária**: o comprador escolhe de quem cobrar quando o terceiro não entrega.

## O que estava aqui antes

`produtos_afiliados` existia com RLS, duas policies e **zero linhas** — nada
escrevia nela. O que a tela `/produtos` mostrava era um catálogo escrito à mão
dentro do componente, sem link nenhum: todo item caía no rótulo «Em breve», sob
um aviso que prometia redirecionar «para a loja parceira».

Tabela pronta, promessa na tela, e nada ligando as duas. É a forma exata de
`store_orders` antes da fase 0.

## As decisões

### 1. O modo de venda mora no produto, com constraint bicondicional

```sql
check ((modo_de_venda = 'indicacao') = (link_externo is not null))
```

Nos dois sentidos, de propósito. Indicação sem link não tem para onde mandar;
**marketplace com link teria dois caminhos de compra**, e o comprador escolheria
o que não passa pelo nosso pedido — sem pedido não há recibo, arrependimento
nem comissão, e ninguém descobriria até a primeira reclamação.

### 2. A vitrine separa os dois grupos, e diz quem vende

«Do FengShui Studio» e «Indicações» são seções distintas, e o cartão de
indicação carrega «Vendido por ‹parceiro›» antes do clique.

Um título só para os dois prometeria uma responsabilidade que não temos — e, no
sentido inverso, que é o pior, esconderia a que temos.

### 3. O clique passa por nós, e o destino nunca vem do cliente

`/api/loja/indicacao?produto=<uuid>` recebe o **id do produto**; a URL sai do
cadastro. Aceitar a URL na query transformaria a rota num redirecionador aberto
— um link que começa no nosso domínio, com o nosso HTTPS, e termina onde o
atacante quiser. É o presente que um phisher pede.

Mesmo vindo do cadastro o link é conferido (`ehLinkDeIndicacaoSeguro`): só
`https`, sem usuário embutido. Cadastro é digitado, e digitação erra.

### 4. Mede-se volume, nunca identidade

`cliques_de_indicacao` guarda produto e hora. **Não guarda IP, hash de
visitante, nem sessão.**

Para cobrar o parceiro basta volume; identificar quem clicou seria coletar dado
pessoal para responder uma pergunta que ninguém faz — o oposto do que a LGPD
pede. A contagem por produto é **derivada** na leitura, e não uma coluna
incrementada: contador gravado erra na primeira escrita perdida e ninguém sabe
qual.

Atribuição de afiliado (fase 5) é outra coisa e vai precisar de `indicacoes`,
com prazo e visitante — lá a pergunta é «quem trouxe este comprador», e ela não
tem resposta sem identificar a visita. A diferença entre as duas justifica as
duas tabelas.

### 5. `link_externo` fica fora da projeção pública

A vitrine leva `parceiro` e não leva o destino. Publicar a URL final deixaria o
navegador ir direto, e a comissão viraria palavra contra palavra.

## O que isto custa

- **Um salto a mais** entre o clique e a loja do parceiro. É o preço de existir
  número para apurar.
- **A contagem é best-effort**: se a escrita falhar, o visitante segue mesmo
  assim. Perder um clique da apuração é barato; travar a ida dele à loja que
  gera a comissão, não.
