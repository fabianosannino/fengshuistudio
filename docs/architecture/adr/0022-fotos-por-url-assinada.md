# ADR 0022 — Fotos por URL assinada, com resolução tolerante ao formato gravado

- **Status:** Aceito — código em produção, fechamento do bucket pendente
- **Data:** 2026-08-11
- **Severidade:** alta — dado pessoal de cliente acessível sem autenticação (LGPD)
- **Relaciona-se com:** ADR 0005 (armazenamento de fotos e LGPD), ADR 0006 (leitura pública de perfis)

## Contexto

Os buckets `imoveis-fotos` e `clientes-fotos` nasceram públicos
(`20260316_fix_storage_bucket.sql`, reafirmado em `20260724_hotfix_pos_incidente.sql`).
Bucket público significa que **qualquer pessoa com a URL abre o arquivo, sem
sessão** — e os arquivos são fotos do interior da casa de clientes. Foi o achado
C8 da auditoria de 2026-07-18, o mais grave que sobreviveu ao P0/P1.

As policies de `storage.objects` já amarram cada arquivo ao dono desde julho.
Elas não resolvem isto: a leitura pública **não passa por policy nenhuma**. São
duas portas, e só uma estava fechada.

O que travou a correção por três semanas não foi a policy, foi o formato do
dado. O banco guarda a **URL pública completa** em seis lugares
(`clientes.foto_url`, `consultas.foto_geral_url`, `.fotos_antes`,
`.fotos_depois`, `.fotos_comodos[].fotos[]`, `.bagua_entrada.planta_url`).
Fechar o bucket transformaria cada uma dessas linhas em 404. O plano registrado
na auditoria tinha cinco passos, com o backfill como pré-requisito do
fechamento — ou seja, a correção do vazamento dependia de uma migração de dados
dar certo primeiro.

## Decisão

**Parar de depender do formato gravado.** `caminhoDoObjeto()`
(`src/lib/storage-imagens.ts`) aceita URL pública legada, URL assinada ou path
já normalizado, e devolve sempre o path do objeto. É o path que se manda
assinar.

Com isso a ordem de dependência inverte: o backfill deixa de ser pré-requisito
do fechamento e vira limpeza. Linha antiga e linha nova percorrem o mesmo
caminho, então o fechamento do bucket pode acontecer **antes**, **depois** ou
**sem** o backfill.

A assinatura é uma rota própria, `POST /api/storage/assinar`, que confere posse
pela pasta raiz do path — id da consulta em `imoveis-fotos`, id do usuário em
`clientes-fotos` — contra o `user.id` da sessão, nunca contra o corpo da
requisição. Assina em lote porque a lista de clientes e o relatório exibem
dezenas de imagens de uma vez.

**A verificação de posse é duplicada de propósito.** Ela já existe nas policies
de `storage.objects`, mas uma URL assinada, depois de emitida, **não passa mais
por RLS** — ela é a credencial. A checagem na rota é a última que existe, e por
isso tem teste próprio, incluindo consulta de outro consultor e travessia de
pasta (`..`).

## O fechamento do bucket é um passo separado

`update storage.buckets set public = false` **não** está em
`supabase/migrations/`. Está em `supabase/migrations-manuais/`, fora do caminho
de um `db push`, com o checklist de staging no cabeçalho.

O motivo não é cautela genérica: a verificação que importa é **o PDF do
relatório sair com as fotos**. Ele é gerado no browser com `html2canvas`, que
captura o DOM depois das imagens carregarem. Isso não é verificável em CI — só
com Supabase real e browser real. Enquanto o arquivo não for aplicado, o código
está pronto e **a exposição continua aberta**. Está escrito assim no arquivo e
aqui: um passo preparado não é um problema resolvido.

## Consequências

- **Positivo:** o fechamento do bucket vira uma linha de SQL reversível, sem
  migração de dados no caminho crítico. O backfill pode falhar, ser adiado ou
  nem acontecer, sem reabrir o vazamento.
- **Positivo:** o valor gravado passa a ser o path, mais curto e sem o domínio
  do projeto embutido — trocar de projeto Supabase deixa de reescrever linha.
- **Negativo:** toda tela que exibe foto ganhou uma ida ao servidor antes de
  renderizar. Mitigado pelo lote e pelo cache de módulo em `useUrlsAssinadas`,
  mas existe: numa conexão ruim as fotos aparecem depois do resto.
- **Negativo:** o botão «Baixar PDF» agora espera as assinaturas antes de
  habilitar. É deliberado — capturar antes produziria um relatório com buracos
  no lugar das fotos, que é pior que esperar.
- **Negativo:** a URL assinada, uma vez emitida, vale por uma hora para quem a
  tiver. É um afrouxamento em relação ao ideal, e o preço de manter o
  `html2canvas` funcionando: TTL curto demais venceria durante a geração do PDF.

## Alternativas consideradas

- **Backfill primeiro, fechar depois** (o plano original): rejeitado. Coloca uma
  migração de dados de seis campos JSONB no caminho crítico de uma correção de
  exposição de dado pessoal. Se o backfill falhar no meio, fica-se com metade
  das linhas em cada formato — e ainda com o bucket aberto.
- **Proxy de imagem pela aplicação** (`/api/foto?path=…` devolvendo os bytes):
  rejeitado. Faz todo tráfego de imagem passar pela função serverless, com custo
  e limite de tempo, para ganhar pouco sobre a URL assinada.
- **Manter público e confiar na URL ser difícil de adivinhar:** rejeitado. É
  segurança por obscuridade sobre dado pessoal — e a URL vaza no `Referer`, no
  histórico e em qualquer compartilhamento de tela.
