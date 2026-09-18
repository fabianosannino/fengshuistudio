# B2 — cobrança e contrato dos planos

## Entrega de aplicação (18/09/2026)

Checkout estrito, validação compartilhada de catálogo, proteção contra recriar
Customer em erro transitório, Price como fundamento da concessão, consulta ao
estado atual no webhook, falhas de escrita propagadas e preservação de
concessões independentes. Telas de planos derivam direitos da matriz efetiva.
O cadastro/callback conserva plano e ciclo, com redirecionamento validado.

Verificação local: typecheck, build com variáveis sintéticas, 1.367 testes em
104 arquivos e lint (0 erros, 115 avisos preexistentes). Há casos de corpo
inválido, configuração ausente, moeda/valor/recorrência/modo incompatíveis,
timeout de Customer, chave idempotente, assinatura existente, metadata falsa,
evento atrasado, estado não elegível, concessão de outra origem e falha de
persistência. A jornada de preços testa o link real e o total anual.

## Catálogo real conferido em leitura

Stripe MCP ainda exige reautenticação. A leitura foi possível com
`vercel env run --environment production --project <projeto verificado>`,
usando a configuração existente somente na memória de um processo Node
temporário. Nenhum `.env` foi gravado, nenhuma credencial foi impressa e
nenhuma sessão/cobrança foi criada. Seis variáveis sensíveis indisponíveis
para pull não eram necessárias a essa leitura.

| Plano/ciclo | Produto | Valor total | Moeda/intervalo | Resultado |
|---|---|---|---|---|
| Simples mensal | Plano Simples | R$ 20,00 | BRL / mês | OK live |
| Simples anual | Plano Simples | R$ 168,00 | BRL / ano | OK live |
| Profissional mensal | Professional | R$ 49,90 | BRL / mês | OK live |
| Profissional anual | Professional | R$ 411,60 | BRL / ano | OK live |

Preços e produtos ativos, cobrança fixa por unidade, intervalo de uma unidade,
dois ciclos no mesmo produto e produtos distintos entre planos conferidos.
Banco real contém uma assinatura gratuita e uma concessão de migração; ambas
preservadas. A projeção `plans.features` ainda diverge da matriz efetiva.

## Continuação B2

- Cotas e reativação sob concorrência, incluindo cadastro do próprio titular.
- Projeção de direitos no banco sem remover dados ou direitos existentes.
- Coordenação durável dos retries de checkout e eventos; unicidade de concessões.
- Ensaio financeiro no modo teste e jornada autenticada real. Testes locais
  com mocks e leitura live não são equivalentes a esses ensaios.

## Cotas — segundo pacote

Migration aditiva com projeção versionada dos direitos e admissão atômica no
banco. Cobre criação, reativação, chamadas diretas ao Supabase e concorrência.
Acima da cota legada, mantém consulta/edição e impede apenas novas admissões.
Cadastro próprio é identificado separadamente e preparado por RPC sem IDs
informados pelo navegador. Referência a cliente de outro proprietário é recusada.

A tela de nova consulta ainda usava 1 imóvel no Simples e total histórico no
Free; agora usa 10/3 imóveis ativos e permite seleção de clientes ao consultor
no Simples. Falha ao ler perfil/contagem impede criação, sem assumir plano Free.

PR #193 está integrado em `bd1cbd8af99eccf542c3ce72a63a09919ed8149e` e produção
READY em `dpl_DoyZPfmHMiYe7RAQAHkEvyFc2cPa`. A aplicação desse primeiro pacote
não encerra a coordenação durável de checkout/webhook nem o ensaio financeiro.

## B1 após deploy

PR #192 integrado em `c014cba940ac18ab4089428ba57c3e6186d24316`.
Vercel `dpl_FPpbmV5DNZavsNL6jV4tu4oQq2XS` READY, produção no mesmo SHA.
Smoke anônimo: catálogo 200 (`produtos: []`), entrada de relatório 401 e
preparação 401. Inventário sem dados pessoais: 17 consultas, 3 de bússola com
orientação legada e nenhuma confirmação retroativa. Não foram reemitidas.

Verificação do segundo pacote: 1.374 testes em 106 arquivos, typecheck e build
aprovados, lint com zero erros e 106 avisos anteriores. Runner PostgreSQL:
37 verificações, incluindo reprodução da corrida e RPC concorrente. Antes da
migration, inventário real: 13 clientes, 17 consultas e zero referências a
cliente de outro proprietário. Nenhum dado de teste foi criado em produção.

PR #194 integrado em `9a05c15144c59858814a111db9324e0ccbd6f64e`; produção READY
em `dpl_AqZghxndo6wa3samZXwcKVWr2L8W`. A migration manteve 13 clientes e 17
consultas, marcou 3 titulares (havia 4 contatos correspondentes, com duplicata
do mesmo proprietário), corrigiu direitos e preservou os preços. RPC anônima
negada, wrapper público invoker e mutex privado com RLS. Advisors: mesmos
avisos/erro anteriores, mais um INFO esperado pela tabela técnica sem policies;
ela não deve ter acesso de usuários.

## Concessões — terceiro pacote

Ativação de chave, concessão, projeção e auditoria ficam numa transação.
Benefício administrativo e cancelamento passam a preservar origens distintas.
Inventário real: seis chaves disponíveis, nenhuma usada, todas sem duração ou
desconto especial. Nenhuma chave real foi usada nos testes. O runner isolado
passou em 31 verificações de concorrência, rollback e prazo.

Configuração Vercel `development` conferida apenas por indicadores, sem valores:
chave Stripe **live** e quatro preços configurados. Não é ambiente de ensaio.
A aplicação passa a impedir live fora da produção e test em produção. Não se
alterou segredo nem se criou cobrança. Stripe MCP continua exigindo login;
credenciais test e serviços isolados continuam sendo dependência externa.

Continuação: coordenação durável de checkout, exclusividade e retomada de
eventos, notificações idempotentes, conciliação de estornos sem falso sucesso,
tratamento das projeções vencidas e ensaio test mode. A emissão de créditos
administrativos e o estorno ainda exigem revisão específica; o registro local
não basta para provar movimento financeiro no provedor.

Validação do terceiro pacote: 1.405 testes em 109 arquivos, typecheck e build
com configuração sintética aprovados. Lint sem erros (105 avisos). Runner
PostgreSQL com 31 verificações. Não houve execução financeira live nem
ativação de chave de produção. A revisão React manteve os estados derivados e
o retorno do servidor como fonte da confirmação de plano.

PR #195 integrado em `c20ee91a52936d89390248c7d61c6e155996a0d4`, após os três
checks de CI aprovados. Migration aplicada como `20260918050106` no Supabase.
Readback: 13 clientes, 17 consultas, uma concessão e seis chaves disponíveis;
RPC de ativação autorizada somente para `service_role`, negada a `anon` e
`authenticated`. Nenhuma chave de produção foi ativada.
Vercel `dpl_B6vq9kXs8Po34N84GayY6ntLLcPj` READY no mesmo SHA.

## Reserva de webhooks — quarto pacote

RPC com token e prazo impede admissão simultânea da mesma entrega. Ambos os
endpoints falham em 503 se não conseguirem reservar; só confirmam sucesso
após persistir conclusão. Tentativa antiga não libera nem conclui uma nova.
23 verificações PostgreSQL cobrem concorrência, retomada, ACL e notificações.
Inventário real anterior à migração: 24 eventos, zero pendentes e uma
notificação. RLS ativo em ambas as tabelas. O pacote não é uma transação única
dos efeitos do webhook; limites e continuação estão no ADR 0042.
Verificação local do quarto pacote: 1.431 testes em 110 arquivos, typecheck,
build e lint aprovados (zero erros, 105 avisos existentes).

O primeiro CI do quarto pacote identificou uma corrida no relógio da projeção
de concessões, descrita no ADR 0042. A ordem foi reproduzida de forma controlada
e corrigida numa migration adicional; runner agora tem 34 verificações. Não
houve merge com check vermelho. Leitura agregada de produção encontrou um
perfil Pro sem concessão vigente e outro Pro coerente; não foi feito recálculo
em massa nem retirada de direito legado. A origem do perfil divergente precisa
ser reconciliada antes de abandonar a projeção nas leituras de autorização.

PR #197 integrado em `c3463631097a15ad85856c89f34e802e755363be`, após CI
35310713236 verde. Migrations remotas `20260918053120` e `20260918053127`;
inventário e ACL verificados após aplicação. Produção READY em
`dpl_DSgbJWBqvqFX1uuQpLkDRe7u39hZ`, mesmo SHA.

## Contenção das ações financeiras administrativas

Os caminhos legados mark_paid/refund foram removidos e recebem 409 sem
movimentação ou falsa confirmação. Inclui crédito que antes era apenas
anotação. A implementação completa continua pendente de coordenação durável
e ensaio test mode (ADR 0045). Não se executou reembolso real.

Investigação agregada da divergência de plano: o perfil Pro sem concessão é
cliente e tem uma assinatura legada `gratuidade`, valor zero, sem gateway,
sem chave, com motivo e sem prazo. O outro Pro é administrador com concessão
vigente. Isso identifica o direito legado a preservar numa migração futura;
nenhum direito foi recalculado ou retirado nesta leitura.

## Plano vigente e preservação de origem (ADR 0047)

Cotas passam a consultar a maior concessão vigente após serializar pelo
perfil, sem depender do cache profiles.plano. APIs, telas centrais e fonte
para novas emissões consultam a mesma regra. Indisponibilidade não é Free.
Backfill estrito preserva uma gratuidade legada documentada, de preço zero,
sem gateway, sem chave e sem cancelamento; perfil pago restante sem origem
faz a migração inteira falhar. Nenhuma assinatura real foi criada/cancelada.

Validação: 1.595 testes em 121 arquivos, TypeScript aprovado e 60 verificações
PostgreSQL, incluindo bypass anterior, rollback do backfill, ACLs, dados
existentes preservados, concorrência e concessão/vencimento após início da
transação. PR #203 integrado em `ba7cdeb6220fdba7c79c583da5db0087635f07ed`
após CI 35317381931 verde; migration remota `20260918070348`. Readback:
13 clientes, 17 consultas, uma assinatura preservada, duas concessões e zero
divergências entre cache e plano vigente. ACLs conferidas. Produção READY
`dpl_H3mA8d4pMXePYhgWffm5izuUcjCm`, mesmo SHA. Advisors sem novas classes de
alertas (view pública deliberada, duas funções existentes e sete INFO).

## Checkout de assinatura durável (ADR 0049)

Reserva única por titular antes de criar Customer/sessão. Parâmetros e chaves
estáveis nos retries, vínculo monotônico, reutilização de sessão conhecida e
expiração confirmada antes de trocar plano/ciclo. Resultado desconhecido com
23h recusa nova criação até reconciliação. Sessões legadas e assinaturas em
andamento impedem duplicação; conflito de assinatura oferece portal acionável.

Runner PostgreSQL: 46 verificações reais de concorrência, ACL, replay,
trabalhadores antigos e exclusão coordenada. Não realizou operações Stripe
reais. Test mode isolado e coordenação financeira entre webhooks continuam
pendentes; o pacote não declara B2 encerrado.

Validação local: 1.640 testes em 123 arquivos, typecheck/build aprovados e
lint sem erros (103 avisos). Preflight de produção: 13 clientes, 17 consultas,
uma assinatura, duas concessões e nenhuma intenção de exclusão; tabela nova
ainda inexistente. A migração só será aplicada após os gates remotos passarem.

PR #205 integrado em `f4bad32ba63ec4dcc7dbdfdb7303106653f6f5a0`, CI
35320387106 verde. Migration remota `20260918074206`: zero tentativas,
contagens preservadas, RLS ativo, RPCs apenas service_role. Produção READY
`dpl_8FNKcv8EmoPLaUDnWnBdRBWk84je`, mesmo SHA.

## Assinatura e concessão na mesma transação (ADR 0050)

Reserva por assinatura antes da leitura no provedor; aplicação valida token
e prazo depois dos locks e grava espelho, benefício e projeção atomicamente.
Direito de assinatura recebe o fim do período, trial usa seu prazo menor e
inadimplência não estende o período anterior. Cancelamento preserva outras
origens; endpoint do titular confirma o estado atual e as escritas secundárias.
Não conclui reconciliação de faturas/estornos/disputas ou homologação test mode.

Validação local: 1.651 testes em 124 arquivos, typecheck e build aprovados.
Runner PostgreSQL com 48 verificações, incluindo reprodução do defeito
anterior, rollback e recusa de prazo infinito. Preflight real: 13 clientes,
17 consultas, uma assinatura, duas concessões, zero checkouts, zero vínculos
Customer ambíguos e zero concessões de assinatura sem prazo.
