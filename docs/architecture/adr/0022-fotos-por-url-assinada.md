# ADR 0022 — Fotos por URL assinada, com resolução tolerante ao formato gravado

- **Status:** Aceito — código em produção; bucket fechado em 11/08, purga do CDN pendente
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

## O CDN é uma terceira porta — descoberto ao aplicar

O fechamento foi aplicado em produção em 11/08. Os buckets ficaram
`public = false` e o origin passou a recusar (`404 NoSuchBucket`, tanto para
objeto existente quanto inexistente — resposta de bucket, não de objeto).

**E a foto continuou abrindo pela URL pública.**

O projeto tem Smart CDN (`x-smart-cdn: true` na resposta). Duas coisas que a
documentação deixa explícitas e que contrariam a leitura ingênua do header:

1. `cache-control: public, max-age=3600` governa o **browser**, não o edge. Com
   Smart CDN, «o asset é cacheado no CDN pelo maior tempo possível».
2. A invalidação é disparada por **mudança no asset** — upload, update, delete —
   porque o metadado do objeto é sincronizado para o edge. **Trocar a
   visibilidade do bucket não é uma mudança no asset**, então nada é
   invalidado: o edge segue servindo a cópia que já tinha.

Ou seja: fechar o bucket fecha a porta para todo mundo que ainda não tinha
buscado aquela URL, e **não fecha** para as URLs já cacheadas. Não é uma janela
de uma hora — sem purga, é indefinido.

O fechamento completo tem, portanto, **dois passos**, não um:

```bash
# 1. bucket privado (migrations-manuais/20260811_fechar_buckets_privados.sql)
# 2. purga do CDN — exige a secret key, Pro Plan ou acima
curl -X DELETE "https://<ref>.supabase.co/storage/v1/cdn/imoveis-fotos" \
  -H "apikey: <secret_key>"
```

A propagação leva até 60 segundos. A purga **não** alcança o cache do browser
de quem já viu a foto — para isso só o `max-age` do lado do cliente, que aí sim
é de uma hora.

### O que isso implica para a URL assinada

O mesmo mecanismo vale para o que passamos a emitir, e a documentação é direta:
**expirar ou revogar um token não purga a entrada de cache dele.** Cada token é
uma chave de cache própria; a resposta cacheada continua servível pelo edge
depois do token vencer.

Na prática, o TTL de uma hora limita quem pode **gerar** acesso, não quem já
tem a resposta cacheada. O único corte duro é apagar o objeto. Isso enfraquece
— não anula — o argumento do TTL curto: a URL ainda precisa vazar primeiro, e o
que vaza continua sendo um link temporário e não um bucket inteiro. Mas fica
registrado para não ser lido como garantia mais forte do que é.

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
  E, como a seção sobre o CDN registra, a resposta cacheada de um token pode
  sobreviver ao próprio token — o TTL limita a emissão, não a cópia no edge.

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
