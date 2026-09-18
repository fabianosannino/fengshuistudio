# 0048 — Contadores atômicos e política por operação

Data: 18/09/2026. Complementa o ADR 0023.

## Problema

O pipeline REST executava INCR e EXPIRE separadamente e conferia apenas a
primeira resposta. Falha parcial podia deixar chave sem prazo. O identificador
era compartilhado por rotas distintas, misturando cotas e limites. Em produção,
falha de Redis degradava inclusive operações sensíveis para memória por instância.

## Decisão

Um EVAL faz INCR, lê PTTL e atribui o prazo caso inexista. Não renova janela
viva. Contagem e TTL precisam ser inteiros válidos; resposta parcial/erro não
aprova. A chave inclui escopo constante da operação e duração da janela. O
Redis recebe HMAC-SHA256 com o token do provedor como segredo, sem IP em texto.
É pseudonimização, não anonimização; rotação do token reinicia as cotas.

As rotas que já usavam rate limit agora declaram escopo. Escritas, admin,
portabilidade e endpoints públicos que verificam tokens de pedidos exigem
contador compartilhado em produção. Indisponibilidade retorna 503/Retry-After
antes de efeitos; cota excedida permanece 429. Reconciliação de assinaturas
compartilha o escopo EXEC entre simulação e aplicação da mesma operação.

Leituras de menor risco e desenvolvimento conservam fallback declarado por
instância. O Map tem teto de 10 mil entradas; remove expiradas, jamais expulsa
contadores vivos para recuperar espaço. Sem espaço, recusa. A expiração é
inclusiva na fronteira. Falhas de Redis não registram mensagem upstream, IP,
URL nem token. Timeout da chamada: 1,5 s.

## Evidência e operação

O mesmo Lua é exercitado em Redis 7.4, imagem fixada por digest, Docker sem
rede/portas e dados sintéticos: 32 trabalhadores concorrentes, janela que não
desliza, reparo do contador sem TTL, expiração e valor corrompido. CI inclui
o runner. Testes de API verificam recusa antes de checkout e uploads.

Metadados do Vercel confirmaram as duas variáveis sensíveis do Upstash nos
ambientes production/preview. Valores sensíveis não são exportados pela CLI;
ausência no processo local não prova ausência na plataforma. Nenhum segredo
foi revelado ou alterado. Após deployment, verificar um endpoint protegido
sem sessão: 401 demonstra passagem pela proteção sem executar a operação.

## Limites

503 é uma escolha de segurança com impacto de disponibilidade; não trocar
por fallback global durante incidente. Verificar conexão/permissão EVAL e
credenciais, sem registrar os valores. Este limitador não cobre acesso direto
ao Supabase nem substitui cotas, RLS, autenticação ou proteção de borda.
Endpoints sem rate limit prévio não são implicitamente protegidos por este
pacote. IP pressupõe proxy confiável Vercel e pode agrupar usuários em NAT.
Não se simulou indisponibilidade do Redis real de produção.

Referências: [REST Upstash](https://upstash.com/docs/redis/features/restapi),
[atomicidade de scripts Redis](https://redis.io/docs/latest/develop/programmability/eval-intro/).
