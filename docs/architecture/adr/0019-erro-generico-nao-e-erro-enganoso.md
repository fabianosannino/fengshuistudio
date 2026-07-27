# ADR 0019 — Resposta genérica não é resposta enganosa

- **Status:** Aceito
- **Data:** 2026-07-27
- **Relaciona-se com:** ADR 0003 (autorização e respostas genéricas ao cliente)

## Contexto

A ADR 0003 estabeleceu que a resposta ao cliente é genérica e o detalhe vai para
o `logger`. A tela de login aplicou a regra assim:

```ts
const { error } = await supabase.auth.signInWithPassword({ email, password })
if (error) {
  setMessage('E-mail ou senha incorretos. Tente novamente.')
}
```

Isso não é genérico — é uma **afirmação específica e frequentemente falsa**.
Queda de rede, chave de API inválida, 401 do gateway e 5xx do Supabase todos
apareciam como senha errada.

O custo apareceu em produção: uma indisponibilidade foi investigada por horas
como problema de credencial, porque era isso que a tela afirmava. A mensagem
mandou o proprietário conferir usuário, senha e base de dados enquanto a causa
estava no deploy.

A mesma superfície tinha o defeito oposto em três lugares — `esqueci-senha`,
`redefinir-senha` e o cadastro repassavam `error.message` cru:

```ts
setMessage('Erro ao enviar e-mail: ' + error.message)   // → "Invalid API key"
```

Genérico demais num lado, vazando detalhe de infraestrutura no outro.

## Decisão

`src/lib/auth-erros.ts` classifica o erro em uma de oito causas e devolve uma
mensagem tirada de `MENSAGEM_POR_CAUSA` — **nunca** o texto da biblioteca. O
detalhe técnico vai no campo `detalhe`, que só o `logger` consome.

`falhaAuth(erro, acao)` classifica **e registra** na mesma chamada. As telas
usam essa, não `classificarErroAuth`: assim é impossível mostrar a mensagem
esquecendo o log.

A ordem das checagens é parte da decisão, não detalhe de implementação:

1. **Rede primeiro** — erro de transporte não tem `status` confiável e cairia no
   ramo genérico.
2. **Chave/401 antes de credencial** — o Supabase devolve **400** para senha
   errada. Um 401 ali nunca é o usuário; é configuração do deploy.

## Consequências

O princípio que fica: *genérico* qualifica o **nível de detalhe**, não a
**veracidade**. «Não foi possível conectar» e «e-mail ou senha incorretos» são
igualmente genéricos, e só um deles é verdade em cada caso. Escolher o errado
não protege ninguém — só transfere o custo do diagnóstico para quem investiga.

### Efeito colateral encontrado ao corrigir

As três telas decidiam a cor do aviso lendo a própria mensagem:

```ts
const isError = message.includes('Erro') || message.includes('incorretos')
```

Nenhuma das mensagens novas contém essas palavras: uma falha de rede seria
pintada de **verde**, como sucesso. Trocado por estado explícito
(`messageIsError`) nas três. Estilo derivado de substring do texto é frágil por
construção — some no primeiro reword.

### Verificação

A política de rede do contêiner de desenvolvimento bloqueia o host do Supabase,
o que virou fixture do caso real: com a aplicação local, o login com credencial
**válida** falha no transporte. Antes da correção a tela dizia «E-mail ou senha
incorretos»; depois diz «Não foi possível conectar ao servidor», com
`causa: rede-indisponivel` no log estruturado.

Os testes cobrem as oito causas e travam o invariante que originou a ADR: a
mensagem exibida pertence sempre a `MENSAGEM_POR_CAUSA` e nunca contém o texto
do erro original.
