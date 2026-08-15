# ADR 0033 — O painel admin exige segundo fator, e a falha é fechada

**Data:** 2026-08-15
**Status:** aceito
**Relacionado:** ADR 0003 (autorização/RLS), ADR 0019 (erro genérico ≠ erro
enganoso), ADR 0023 (rate limit com degradação declarada)
**Fase:** 0 do plano de paridade entre portais

## O contexto

Atrás de `/admin` estão a geração de chaves de ativação, a promoção de usuário
a admin, o catálogo que a loja cobra, o cancelamento de assinatura e a
reconciliação que corrige pedido. Até aqui, tudo isso era alcançado com **uma
senha**.

Senha vaza — por reuso, por phishing, por máquina comprometida. E o alcance de
uma senha de admin vazada não é «ver dados»: é `promover_usuario`, que fabrica
outro admin, e `gerar_chaves`, que fabrica plano pago. Nenhuma das duas deixa a
conta original com aparência de invadida.

## A decisão

**O painel exige `aal2`** — senha mais TOTP — em toda página `/admin/*` e em
toda rota `/api/admin/*`.

### 1. A verificação é do servidor, e a falha é fechada

O Ervatório já tinha resolvido isto, e a implementação de lá foi lida antes de
escrever esta. Ela mostra os dois modos de errar:

```js
catch(e){
  console.warn('[admin-mfa] indisponível, prosseguindo sem MFA:', e);
  return true;   // ← libera
}
```

**Falhar aberto.** Qualquer erro na consulta do fator — rede instável, projeto
mal configurado, resposta inesperada — vira acesso liberado. Um segundo fator
que some quando a rede oscila protege exatamente nas horas em que nada está
acontecendo.

**Verificar só no cliente.** O `if` mora no navegador; quem chama a rota direto
não passa por ele. O painel *parece* protegido, e a API não está.

Aqui: `decidirAcesso` tem um estado `indeterminado` que **não** é acesso, e a
guarda é `exigirAdmin`, no servidor. O middleware também confere, mas para
mostrar a tela certa — não é ele a proteção, porque um matcher é uma lista e
listas esquecem rotas.

### 2. A guarda é uma, e não nove

A checagem `role === 'admin'` estava copiada em nove rotas, em três formatos
diferentes. Nove cópias de uma regra de autorização não são nove chances de
acertar: são nove lugares onde a décima rota vai esquecer — e o esquecimento
**não quebra nada**, porque a rota continua funcionando, só que para todo mundo.

`exigirAdmin` responde as três perguntas na ordem em que ficam mais caras:
sessão (cookie), papel (uma consulta), fator (outra consulta). A do fator só
acontece para quem já provou ser admin.

### 3. O interruptor é de ambiente, nunca do painel

`ADMIN_MFA_OBRIGATORIO=false` desliga a exigência. É variável de ambiente e
**não** uma chave que o admin vira na tela, por um motivo circular que precisa
ser dito em voz alta: *um MFA que o painel desliga é um MFA que quem invadiu o
painel desliga.*

Isso fixa a régua que vale para os quatro portais daqui em diante:

> **Se desligar é medida de proteção, mora em variável de ambiente. Se ligar é
> decisão comercial, mora numa chave que o admin vira.** Nunca o inverso.

O padrão é exigir: a ausência da variável não afrouxa nada, e só a string exata
`'false'` desliga — `'False'`, `'0'` e `'no'` continuam exigindo, porque são as
formas que alguém escreve achando que desligou.

Enquanto desligado, todo acesso ao painel escreve um `warn` no log. Estado
excepcional que não aparece vira permanente sem ninguém decidir que ficasse.

### 4. O erro diz o que é, sem dizer demais

Um admin que ainda não confirmou o código recebe `403` com
`codigo: 'mfa_pendente'` — não «acesso restrito». A distinção é o ADR 0019: a
mensagem genérica é correta contra quem não é admin, e **enganosa** contra quem
é e só não digitou o código ainda. O texto continua genérico; o código de
máquina é que carrega a diferença, e é ele que leva à tela de verificação.

## As consequências

- **O cron não passa pelo MFA.** `/api/admin/reconciliacao` e
  `reconciliacao-loja` aceitam `Authorization: Bearer $CRON_SECRET` antes de
  chegar na guarda. Um agendador não tem app autenticador, e exigir `aal2` dele
  quebraria a reconciliação diária sem tornar nada mais seguro — o que protege
  aquele caminho é o segredo.
- **TOTP precisa estar habilitado no projeto Supabase**
  (*Authentication → Multi-Factor*). Se não estiver, o cadastro do fator falha e
  a tela diz isso explicitamente, em vez de mostrar erro cru — e **não** libera
  o painel por causa do erro.
- **O primeiro acesso de cada admin passa pelo cadastro do fator.** Não há
  período de tolerância: quem entra sem fator cai na tela do QR.
- **Perder o autenticador exige intervenção pelo Supabase** (remover o fator
  pelo painel do projeto). Códigos de recuperação ficam como pendência
  declarada — sem eles, o caminho de volta existe, mas é manual.

## O que ficou de fora, e por quê

**Códigos de recuperação.** O Supabase não oferece backup codes nativos para
TOTP; implementá-los significa gerar, exibir uma única vez, guardar o hash e
tratar o resgate. É trabalho real e independente desta mudança, e adiá-lo não
deixa ninguém trancado — o dono do projeto Supabase remove o fator.

**Extensão ao resto do app.** Consultores não passam a precisar de MFA. O que
esta decisão cobre é o painel, onde uma sessão vale por todos os usuários.
