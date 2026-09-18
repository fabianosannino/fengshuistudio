# 0047 — direitos vigentes e gratuidade legada comprovada

18/09/2026. Continuação do B2, ADRs 0029, 0040 e 0041.

## Problema

Concessões vencem sem que uma requisição atualize profiles.plano. Cotas e telas
consultavam essa projeção e podiam continuar autorizando Pro vencido. Antes de
trocar a leitura, o inventário revelou um perfil sem concessões com gratuidade
documentada em subscriptions: Pro, preço zero, sem gateway/chave, com motivo,
sem término. Recalculá-lo sem preservar essa origem removeria direito legítimo.

## Decisão

A migration preserva somente gratuidade com esses sinais verificáveis,
sem cancelamento, sem prazo vencido e sem outra concessão prévia. Registra
origem migracao e referência gratuidade-legada:<subscription-id>, com as
datas da origem. Não cria assinatura nem altera a linha histórica, não faz
backfill indiscriminado de profiles.plano. Se sobrar perfil pago sem nenhuma
origem verificável, toda a migration falha e reverte também o backfill.

app_private.plano_vigente concentra a seleção da maior concessão ativa no
instante dado. A admissão de cota toma primeiro o lock do perfil, usado nas
mutações de concessão, depois o mutex de cota e só então consulta a hora real.
Read Committed vê a concessão já confirmada; Repeatable Read com perfil
modificado exige retry da transação inteira. Novas admissões e reativações
respeitam o plano vigente. Registros existentes acima da cota permanecem
acessíveis/editáveis, como no contrato de cotas anterior.

obter_meu_plano não aceita titular nem instante da requisição. A função
pública é invoker; o definer privado deriva auth.uid e só lê o plano daquele
usuário. Anon não executa. A função que aceita titular/instante não está
liberada ao usuário autenticado. O serviço conserva a operação separada de
recalcular a projeção; leitura comum não precisa escrever no perfil.

APIs de clientes, consultas e alteração de plano leem a regra vigente. O
carregamento compartilhado do perfil consulta concessão e seleção mínima de
colunas em paralelo, recusa indisponibilidade sem fabricar Free, e é usado
nas telas de planos, criação de consulta, clientes, parceiros, calendário,
relatórios, navegação e contexto. Metadados editáveis do Auth não substituem
papel/plano quando a leitura falha. O contexto não reutiliza cache de plano.
Fonte de novas emissões usa o plano vigente; template relatorio-2.3.0 registra
a mudança. Emissões existentes conservam o snapshot e PDF originais.

## Evidência e limites

Runner PostgreSQL 17 reproduz o bypass do cache vencido, testa preservação
da gratuidade e rollback integral para origem desconhecida, ACLs, datas
futuras/revogadas, concorrência e transação iniciada antes da concessão ou
vencimento. Testes de interface conferem que Pro vencido mostra cota Free.
Falha da RPC retorna indisponibilidade e não cancela benefícios.

Telas já abertas conservam o retrato carregado até nova leitura; a barreira
de admissão verifica novamente no banco. Isto não transforma todos os demais
recursos em autorização de backend: histórico, calendário e múltiplas análises
ainda precisam de contratos próprios nas etapas D/E. Checkout, concorrência
entre eventos Stripe e ensaio financeiro em modo teste continuam pendentes.
Gratuidade legada precisa ser encerrada pela sua origem/referência ou pela
renúncia de benefícios não pagos, sem cancelar outras concessões.

Referências: [isolamento](https://www.postgresql.org/docs/17/transaction-iso.html)
e [instantes da transação](https://www.postgresql.org/docs/17/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT).
