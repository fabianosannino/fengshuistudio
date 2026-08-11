# ADR 0023 — Rate limit com store compartilhado e degradação declarada

- **Status:** Aceito
- **Data:** 2026-08-11
- **Relaciona-se com:** ADR 0019 (erro genérico ≠ erro enganoso)

## Contexto

O limitador contava requisições num `Map` de módulo. Em serverless isso não é
um detalhe de implementação: cada instância tem o seu contador, e a plataforma
cria quantas instâncias quiser. `limit: 10` valia **10 por instância**.

O limite mais sensível é o da ativação de plano (`/api/planos`), que protege a
comparação de chave contra força bruta. Ele era justamente um dos de valor
baixo — e portanto um dos mais fáceis de contornar abrindo conexões até cair
numa instância nova.

O segundo furo estava na chave. `x-forwarded-for.split(',')[0]` lê a ponta
**esquerda** da cadeia, que é a que o cliente escreve: bastava variar o header a
cada requisição para ganhar cota nova, sem nem precisar de instâncias
diferentes.

## Decisão

**Store compartilhado quando configurado, memória quando não.** Com
`UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` no ambiente, a contagem é
única para a frota (`INCR` + `EXPIRE … NX`, para a janela fixa não virar janela
infinita). Sem as variáveis, ou com o Redis fora do ar, cai para o contador em
memória.

**A degradação é declarada, não silenciosa.** O retorno inclui
`compartilhado: boolean`, e em produção sem Redis o módulo registra um `warn`.
Um limitador que finge valer globalmente é pior que um que diz não valer: quem
lê o código assume a garantia que não existe.

**A chave passa a vir de headers que a plataforma sobrescreve** (`x-real-ip`,
`cf-connecting-ip`) e, no fallback, da ponta **direita** do `x-forwarded-for` —
a entrada anexada pelo proxy mais próximo, a única que o cliente não forja. A
premissa é um proxy confiável na frente (Vercel), e está escrita no módulo:
com mais de um, a posição a ler muda.

## Consequências

- **Positivo:** com Redis configurado, o limite passa a valer de fato — é a
  diferença entre ter e não ter proteção contra força bruta de chave.
- **Positivo:** a derivação de IP saiu de 24 rotas para um lugar só; corrigir a
  premissa de proxy no futuro é uma edição, não uma varredura.
- **Negativo:** `rateLimit` virou assíncrona, e todas as rotas ganharam `await`.
- **Negativo:** cada requisição limitada agora pode incluir uma ida ao Redis
  (timeout de 1,5 s, com queda para memória). Em rota de leitura frequente isso
  é latência real.
- **Negativo, e é uma escolha:** falha do Redis degrada em vez de bloquear.
  Um limitador indisponível derrubando a aplicação inteira seria pior que um
  limitador temporariamente por instância. A escolha vale enquanto o limitador
  for defesa contra abuso, não parte de um controle de acesso.

## Alternativas consideradas

- **Bloquear (`fail closed`) quando o Redis cai:** rejeitado pelo motivo acima.
  Vale rever se algum dia um limite virar controle de licença ou cobrança.
- **Limitar por usuário autenticado em vez de IP:** melhor para as rotas com
  sessão, e não exclui esta mudança — mas não cobre justamente as rotas
  anônimas, que são as que precisam. Fica para quando houver caso.
- **`@upstash/ratelimit` em vez de dois comandos via REST:** a biblioteca traz
  janela deslizante e outras estratégias; para duas chamadas de pipeline, não
  compensa a dependência.
