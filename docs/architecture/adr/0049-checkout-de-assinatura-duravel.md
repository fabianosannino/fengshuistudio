# 0049 — Tentativa durável antes de criar Customer e Checkout

Data: 18/09/2026. Complementa os ADRs 0041/0042/0043.

## Problema

O checkout criava uma sessão a cada chamada. Duas requisições podiam observar
ausência de assinatura e abrir duas sessões; uma resposta perdida também
gerava outra sessão. Idempotência de Customer baseada só no usuário não
registrava o prazo de validade da chave do provedor. A exclusão podia começar
enquanto uma primeira chamada externa ainda não tinha resultado persistido.

## Decisão

`checkouts_assinatura` registra a intenção antes de qualquer criação externa.
Cada titular tem no máximo uma tentativa aberta. A reserva serializa por
`profiles FOR UPDATE` e congela UUID, plano, ciclo, preço, ambiente, origem e
Customer anterior. Duas escolhas concorrentes recebem a mesma primeira
tentativa. RLS e ACL negam acesso a anon/authenticated; a rota usa o dono da
sessão e RPCs service_role. Não cria novas concessões nem confirma pagamento.

Customer novo e Checkout usam chaves derivadas desse UUID, com parâmetros
estáveis. Nenhum e-mail/nome mutável entra na criação de Customer; o Checkout
coleta os dados de cobrança e preserva o e-mail de Customers já existentes.
O `client_reference_id` é o UUID da tentativa. A versão v1 desse contrato de
parâmetros deve continuar reproduzível enquanto houver tentativas abertas.

A aplicação não repete criações desconhecidas a partir de 23 horas desde a
autorização durável de cada fase (Customer/sessão), uma margem anterior às
24h mínimas de retenção de idempotência da
Stripe. Resultado antigo desconhecido exige reconciliação; expiração local
não prova que nada aconteceu. Sessão com ID conhecido é recuperada por GET,
inclusive depois desse prazo. Chamadas têm timeout de 20s e um retry; a rota
tem maxDuration de 60s. Não se alega transação distribuída ou exactly-once.

O vínculo de Customer/perfil e tentativa é uma transação. Registro de sessão
é monotônico e condicionado ao dono, UUID ainda aberto e Customer esperado.
Falha de persistência não devolve URL. Trabalhador antigo não pode substituir
Customer, sessão ou tentativa mais recente. Não há lease de exclusão mútua
na rede: concorrência converge pela mesma chave de idempotência da Stripe.

A janela de cada criação começa no banco antes da chamada externa e nunca
se renova. Visita que somente descobriu uma assinatura ativa não inicia esse
relógio. Tentativa sem sessão iniciada pode ser encerrada para mudar a escolha
após confirmar o vínculo de Customer; o mesmo lock impede um trabalhador
antigo de iniciar a criação depois disso.

Sessões abertas são reutilizadas. Para mudar a escolha, primeiro confirma-se
a expiração da anterior na Stripe; erro/timeout ou corrida com conclusão
mantém a tentativa. Sessão concluída bloqueia nova compra até verificar que
sua assinatura é terminal. Há no máximo duas etapas por requisição.

Assinaturas não terminais continuam exigindo portal. A listagem de sessões
também detecta sessões legadas abertas e aquelas concluídas depois da leitura
de assinaturas. Mais de 100 resultados recusa por informação incompleta.
Sessões de pagamento avulso não bloqueiam assinatura. A tela oferece portal
quando a API indica conflito de assinatura, mesmo com projeção local atrasada.

## Privacidade e migração

Intento pendente/antigo impede iniciar exclusão, mesmo sem Customer salvo:
o resultado externo pode ser desconhecido. FK RESTRICT impede apagar a última
referência. O encerramento comercial e a retenção desses registros precisam
de fluxo próprio, já pendente em C3. Portabilidade inclui apenas as tentativas
do titular. Nenhum arquivo, e-mail, segredo ou URL de sessão é armazenado.

A migração é aditiva, sem backfill e sem criar/cancelar cobrança. Aplicar após
os gates de CI, antes da aplicação nova, e conferir ACLs e contagens. Não
reverter para criação sem coordenação para contornar uma indisponibilidade.

## Verificação e limites

PostgreSQL real isolado verifica concorrência de escolhas, ACLs, replay,
vínculos monotônicos, trabalhador antigo, rollback e exclusão concorrente.
Testes de API exercitam parâmetros congelados, respostas perdidas, janela
vencida, expiração desconhecida, sessão incompatível e portal. Teste React
exercita o botão de recuperação. Não substituem homologação Stripe test mode.

Ainda falta ambiente de testes com credenciais e quatro Prices de teste. Não
houve cobrança, cancelamento ou estorno real. Não resolve coordenação entre
eventos diferentes de webhook, espelho/concessão atômicos, checkout da loja,
Customer criado por sistemas externos nem reconciliação administrativa de
intentos antigos desconhecidos. Sessão legada aberta exige conclusão ou
expiração; não se cancela silenciosamente uma sessão sem intenção conhecida.

Referências: [idempotência Stripe](https://docs.stripe.com/api/idempotent_requests),
[criar sessão](https://docs.stripe.com/api/checkout/sessions/create),
[expirar sessão](https://docs.stripe.com/api/checkout/sessions/expire).
