# ADR 0059 — análises independentes por método

Data: 18/09/2026. Estado: aceito para implementação; publicação e aceites no roadmap.

## Problema

A consulta contém um rascunho de planta. Trocar BTB por Bússola ou revisar os
dados substitui esse rascunho; as emissões de PDF preservam sua própria fonte,
mas não permitem guardar e comparar análises antes de emitir um documento.

## Decisão

`analises_execucoes` conserva fonte e resultado privados, método, variante,
versão do motor e hash SHA-256. Só uma planta finalizada com nove setores e
entradas atuais pode gerar uma versão. O servidor calcula o resultado; o
navegador envia apenas UUID de idempotência e hash da fonte que visualizou.

A RPC invoker `ler_fonte_analise` lê a fonte em um único snapshot MVCC, com
allowlists e ownership explícito. `registrar_analise` é exclusiva do serviço,
trava perfil e consulta, impede gravação durante exclusão de conta, compara a
fonte completa e serializa a cota de 100 versões. UUID repetido com os mesmos
dados recupera a versão; reutilização incompatível ou fonte alterada retorna
conflito. A rota autentica e verifica propriedade antes do cliente privilegiado.

RLS permite somente leitura ao proprietário. Escritas diretas autenticadas são
revogadas; UPDATE é revogado inclusive do serviço e protegido por trigger.
Cada alteração exige nova execução. Não há backfill ou reescrita de históricos.

A lista transporta apenas metadados paginados; fonte completa é carregada para
as versões selecionadas. A comparação conserva as diferenças entre escolas,
sem usar notas para declarar uma superior. Dados divergentes dos atuais e motor
antigo são estados derivados, nunca campos de situação gravados.

Relatórios podem usar a fonte e os resultados complementares da versão
selecionada. `relatorio_emissoes.analise_id` possui FK composta que exige a mesma
consulta e proprietário. O plano de acesso vem das concessões atuais, não da
projeção histórica. Motor antigo permite leitura e download de PDFs já emitidos,
mas bloqueia nova emissão com um renderizador que poderia reinterpretá-lo.
Versões de entrada/motor/template são incrementadas; PDFs antigos não mudam.

## Dados pessoais, limites e validação

O snapshot inclui dados pessoais já usados pela consulta e referências privadas
a arquivos existentes. Entra na exportação paginada do titular e cai por cascata
com a consulta, depois da limpeza existente de arquivos e emissões. Nenhum bucket
ou upload novo é criado. Ver `docs/security/historico-analises-dados-pessoais.md`.

Fonte limitada a 2 MiB e resultado a 256 KiB; registro exige leitura consistente,
não promete transformar o rascunho inteiro em transação única. Versão histórica
é somente leitura e não restaura automaticamente o rascunho. Os cálculos
experimentais continuam identificados como experimentais.

Cenários D1-01–07 cobrem domínio, rotas, interface, portabilidade e SQL real no
CI. Mocks não comprovam RLS; jsdom não comprova layout, toque ou rasterização do
PDF. A–C e homologação de domínio continuam obrigatórios.
