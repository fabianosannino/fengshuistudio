# ADR 0028 — `perfis_publicos` é `SECURITY DEFINER` de propósito

**Data:** 2026-08-12
**Status:** aceito

## Contexto

O linter do Supabase acusa, em nível **ERROR**:

> View `public.perfis_publicos` is defined with the SECURITY DEFINER property

Views `SECURITY DEFINER` aplicam as permissões e o RLS de quem as criou, não de
quem consulta. É um alerta correto como regra geral — e aqui é justamente o
mecanismo pretendido.

## O que a view expõe

Vinte e uma colunas de `profiles`, e só as linhas de quem **optou** por aparecer:

```sql
where parceiro_visivel = true or store_slug is not null
```

Quem lê: `/parceiros`, `/consultores` e `/loja/[slug]` — as três páginas
públicas onde um visitante sem conta precisa ver quem são os consultores e o
que eles vendem. A loja precisa inclusive do `stripe_account_id`, que é o que
monta o checkout da conta conectada, e que já é público por construção: ele
está na própria URL de `/store/[accountId]`.

## Decisão

**Fica como está**, e este ADR existe para que o alerta não seja «corrigido» por
alguém que o encontre sem contexto.

## Por que trocar para `SECURITY INVOKER` seria pior

Com `security_invoker = true`, o RLS de `profiles` passa a valer para o
visitante anônimo — que não tem nenhuma policy. As três páginas ficariam vazias.

Para fazê-las funcionar seria preciso uma policy em `profiles` liberando a
leitura dessas linhas para `anon`. E aí o buraco seria real: policy é por
**linha**, não por coluna. Liberar a linha do consultor visível libera **todas**
as suas colunas — e-mail, `plano`, `role`, `stripe_customer_id`, telefone. A
view existe exatamente para não fazer isso.

A alternativa segura é a que já está no lugar: uma projeção fixa de colunas,
com filtro de linha explícito, servida com as permissões do criador.

## O que mantém isso seguro

1. **A lista de colunas é branca, não preta.** Coluna nova em `profiles` não
   aparece na view sozinha — é preciso adicioná-la, e aí a decisão é
   consciente. Ao mexer na view, pergunte de cada coluna: «isto pode ser lido
   por qualquer pessoa da internet?».
2. **O filtro é opt-in.** Ninguém aparece sem ter marcado `parceiro_visivel` ou
   criado uma loja.
3. **Os grants da view são somente leitura para `anon` e `authenticated`.**
   Isso exige revogar explicitamente escritas desses papéis e de `PUBLIC`,
   inclusive permissões por coluna. Uma view simples é atualizável: declarar
   `grant select` não retira os demais grants existentes.
4. **`profiles` continua com RLS estrito.** A view é a única porta pública, e
   estreita.

## Consequência

O advisor vai continuar acusando. É ruído conhecido, e não deve ser silenciado
mudando a view — deve ser respondido apontando para este documento.

Se um dia a lista de colunas crescer a ponto de a projeção deixar de ser
obviamente pública, a resposta não é trocar o modo da view: é encolher a
projeção.

## Correção de permissões em 17/09/2026

A verificação após o PR #189 encontrou `INSERT`, `UPDATE` e `DELETE` concedidos
a `anon` e `authenticated` na view. A migration original revogava apenas de
`PUBLIC`; isso não removia os grants dos papéis da API. Portanto a condição 3
acima era uma intenção arquitetural, mas não correspondia ao banco examinado.

O teste de integração reproduziu alteração e exclusão anônimas em perfis
sintéticos por essa view, mesmo depois do hardening da tabela `profiles`.
`20260918012132_restrict_public_profile_view_to_read_only.sql` revoga as escritas
e mantém apenas `SELECT` para esses papéis, preservando a projeção e o opt-in.
O runner verifica a leitura pública, a recusa de POST/PATCH/DELETE, permissões
por coluna e a persistência da restrição após restauração do banco sintético.

Não trocar para `SECURITY INVOKER` continua sendo a decisão correta; o alerta
do advisor é aceito **com os grants restritos e verificados**, não por confiar
apenas neste documento. Novas migrations que recriem a view devem restabelecer
e testar essa restrição explicitamente.
