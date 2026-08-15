# ADR 0034 — A capacidade do admin é separada do papel

**Data:** 2026-08-15
**Status:** aceito
**Relacionado:** ADR 0003 (autorização/RLS), ADR 0024 (papel ≠ plano),
ADR 0029 (plano derivado de concessões), ADR 0033 (segundo fator no admin)
**Fase:** 0 do plano de paridade entre portais

## O contexto

`profiles.role = 'admin'` é um booleano disfarçado de enum. Quem o tem, pode
tudo o que existe atrás de `/admin`:

| rota | o que faz |
|---|---|
| `/api/admin/promover` | **fabrica outro administrador** |
| `/api/admin/chaves` | **fabrica plano pago** |
| `/api/admin/subscriptions` | cancela assinatura, concede gratuidade |
| `/api/admin/reconciliacao` | corrige pedido contra o Stripe |
| `/api/admin/relatorios` | lê MRR, churn, receita |
| `/api/admin/auditoria` | lê a trilha |

Ler o relatório semanal e promover alguém a admin eram **a mesma permissão**.

## A decisão

`role = 'admin'` continua sendo «abre o painel». `capacidades_admin` diz o que
se faz lá dentro.

Não são graus da mesma coisa — são eixos diferentes. É exatamente a distinção
que o ADR 0024 já faz entre papel e plano: dois eixos que, colados num só,
produzem autorização por acidente.

### 1. `tem_capacidade()` exige as duas

```sql
SELECT p.role = 'admin' AND capacidade = ANY(p.capacidades_admin) ...
```

Tirar o papel de alguém precisa bastar para tirar tudo, sem caçar cada
capacidade que a pessoa acumulou. A capacidade sozinha não abre nada.

### 2. `capacidades_admin` é mais fechada que `role` e `plano`

Esta é a parte que não é óbvia e precisa sobreviver a revisão.

O trigger `protect_profile_privileged_columns` (20260718) deixa passar quando
`public.is_admin()`: **um admin pode alterar `role` e `plano` direto**, por
PATCH no PostgREST.

Se `capacidades_admin` tivesse a mesma saída, a mudança inteira viraria
decoração: um admin com apenas `relatorios:ler` se concederia
`usuarios:promover` num PATCH, e nada teria sido separado.

Então a coluna nova **não** tem a saída por `is_admin()`. Só `service_role`
escreve — o que significa que conceder capacidade passa por rota de servidor,
com auditoria, e não pelo cliente.

### 3. A rota declara a capacidade; ela não é deduzida do caminho

Deduzir de `/api/admin/chaves` → `chaves:*` amarraria a autorização à URL.
Renomear a rota mudaria quem pode chamá-la, e o `git mv` que fizesse isso não
pareceria uma mudança de permissão para ninguém.

Em `chaves`, cada método declara a sua: `GET` pede `chaves:ler`, `POST` pede
`chaves:gerar` e `PATCH` pede `chaves:cancelar`. Conferir a lista e **criar
plano pago** não podiam continuar sendo a mesma permissão.

### 4. O padrão é vazio

Admin novo nasce sem capacidade nenhuma. Um padrão generoso reencenaria o
defeito: o poder de promover seria herdado em vez de decidido.

Os admins **existentes** recebem todas na migration — ninguém perde acesso ao
aplicar. Reduzir é operação, e a migration não sabe quem é quem.

### 5. A capacidade que faltou não volta ao cliente

O `403` diz «Acesso restrito»; qual capacidade faltava vai só para o `logger`.
O nome da capacidade descreve a estrutura interna da autorização, e devolvê-lo
entregaria o mapa do que existe a quem já provou não poder usá-lo. É o ADR 0019
lido pelo outro lado: genérico ao cliente, específico no log.

## As consequências

- **Conceder capacidade ainda é SQL.** A tela que faz isso precisa de
  `usuarios:promover` e é PR próprio — misturá-la com a mudança de autorização
  dificultaria revisar o que importa aqui.
- **`is_admin()` continua existindo** e ainda gate de policies de leitura que
  não ganharam capacidade própria. Aposentá-la é varredura separada.
- **O menu do `AppShell` filtra por capacidade.** É UX: mostrar item que
  responde 403 transforma regra clara em erro sem explicação. Quem autoriza é
  `exigirCapacidade`, no servidor — se os dois divergirem, o servidor vence.
- **`primeiraTelaVisivel` substitui o destino fixo.** `/admin/pagamentos` era o
  destino após o login e virou inalcançável para quem só cuida do catálogo.

## Como isto foi verificado

`supabase/tests/20260815_rbac_capacidade_test.sql` sobe um Postgres
descartável, aplica a migration real via `\i` e prova os oito comportamentos —
inclusive que **nem o próprio admin** se autoconcede capacidade (42501), que
não-admin com capacidades na coluna continua barrado, e que capacidade com erro
de digitação é recusada pelo `CHECK` (23514).
