# ADR 0024 — Papel do usuário é separado do plano

- **Status:** Aceito
- **Data:** 2026-08-12
- **Relaciona-se com:** ADR 0002 (pagamentos), ADR 0003 (autorização/RLS)

## Contexto

O cadastro pedia a profissão antes de deixar o usuário ver qualquer tela:
arquiteto, profissional de Feng Shui, decorador, outro profissional, pessoal —
mais profissão, área de atuação, registro e duas redes sociais para quem não
escolhesse «pessoal».

Nada disso decidia nada. `isProfissional()` sempre olhou o **plano**
(`planoEfetivo(profile.plano) === 'profissional'`), nunca `tipo_usuario`. As
cinco opções produziam a mesma experiência, e os cinco campos extras eram
digitados por quem ainda não sabia se ia usar o produto.

O que muda de fato é outra coisa: **se a pessoa atende clientes ou cuida da
própria casa**. Isso decide o menu (carteira de clientes, cobrança e relatórios
de negócio existem ou não), a home e o vocabulário — o consultor lê «62%», o
morador lê «pede atenção» (ADR 0025).

## Decisão

**Duas dimensões independentes, com nomes diferentes.**

- **Papel** (`src/lib/papel-do-usuario.ts`): `consultor` | `pessoal`. Responde
  «para quem esta pessoa trabalha?». Decide menu, home e leitura.
- **Plano** (`src/lib/plano-utils.ts`): `free` | `simples` | `profissional`.
  Responde «o que ela comprou?». Decide limites e recursos.

Um consultor no plano free é `consultor` com recursos de free. Um cliente final
no plano profissional é `pessoal` com recursos pagos. As duas combinações são
reais e nenhuma delas era representável antes.

O papel é a **única** pergunta que precede a entrada. Profissão, registro e
redes migraram para o Perfil, ao lado de `parceiro_visivel` — o momento em que
passam a fazer diferença.

### Retrocompatibilidade sem migração

Os cinco valores antigos de `tipo_usuario` continuam válidos e ninguém é
remigrado. `arquiteto`, `feng_shui`, `decorador` e `outro_profissional` são
lidos como «atende clientes»; só `pessoal` não é.

### O padrão é consultor

Sem `tipo_usuario` nem `role` legíveis — contas antigas, contas criadas por
admin ou por convite —, o papel é `consultor`.

A assimetria é deliberada. Mostrar a home do consultor a um cliente final expõe
menus que ele não vai usar; mostrar a home do cliente final a um consultor
**esconde clientes e consultas que existem de verdade**. O segundo erro é o
caro, e é ele que o padrão evita.

## Consequências

- `role` continua protegida por trigger e exige `service_role`. A troca de
  papel no Perfil escreve só `tipo_usuario`, e `papelDoUsuario` lê essa coluna
  primeiro — por isso basta.
- A escolha é reversível no Perfil. Sem isso, a frase «dá para mudar depois»
  seria falsa e alguém que clicasse errado ficaria preso na home errada.
- `TipoUsuario` em `src/lib/types.ts` ganhou `'consultor'`, sem perder os
  quatro valores profissionais antigos.
