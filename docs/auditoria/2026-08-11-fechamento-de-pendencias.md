# Fechamento das pendências de segurança — o que saiu e o que ficou

**Data:** 2026-08-11
**Escopo:** a lista de pendências que sobrou de
`2026-07-18-auditoria-arquitetura-seguranca.md`,
`2026-07-19-incidente-schema-rls-defaults.md` e
`2026-07-26-escritas-supabase-sem-checagem.md`.
**Verificação a cada incremento:** `npx tsc --noEmit`, `npm test`,
`npm run lint`, `npm run build`.

---

## Estado antes

| Verificação | 2026-07-30 | Agora |
|---|---|---|
| `tsc --noEmit` | ✅ | ✅ |
| `vitest` | ✅ 548 testes | ✅ 602 testes |
| `eslint` | ❌ 16 erros, 88 warnings | ✅ **0 erros**, 92 warnings |
| `next build` | ✅ | ✅ |
| Lint no CI | informativo | **bloqueia** |

---

## Fechado

### 1. Escritas no Supabase sem checagem de erro

`src/lib/supabase-escrita.ts`: `escreverOuFalhar` devolve o dado ou lança;
`escreverBestEffort` devolve um boolean que quem chama precisa tratar. O
CLAUDE.md já exigia checar `error`, mas o padrão correto era **opcional** —
bastava esquecer. Agora não existe caminho silencioso.

Sítios corrigidos, todos da triagem de 26/07:

- `/api/admin/subscriptions` — era o mais grave da lista. O admin recebia
  «plano alterado» enquanto a mudança falhava.
- `NotificationBell` — `read_at` não gravado sumia da tela e reaparecia depois;
  falha de leitura virava «nenhuma notificação».
- `storage.remove` nas três rotas de upload. Em `/api/consultas/fotos`, uma
  remoção recusada pela RLS devolvia `success: true` com a foto ainda no bucket.

Dois casos ganharam tratamento diferente de exceção, de propósito:

- **Trilha de auditoria:** a ação já aconteceu quando o `insert` roda. Lançar
  responderia «erro» para algo aplicado. A resposta passa a avisar que a ação
  valeu mas não foi registrada (ADR 0019/0020).
- **Reembolso:** se o Stripe devolveu o dinheiro e a gravação local falhou, a
  resposta diz explicitamente para **não repetir**. Lançar aqui convidaria ao
  duplo reembolso.

O webhook de assinaturas já estava coberto por um `logWrite` de PR anterior — a
triagem o listava como «verificar», e estava resolvido.

### 2. Rate limit (A4/A5) — ADR 0023

Contagem compartilhada via Upstash quando configurado, com degradação
**declarada** (`compartilhado: false`) para memória. IP derivado de headers que
a plataforma sobrescreve, em vez da ponta do `x-forwarded-for` que o cliente
escreve. A derivação saiu de 24 rotas para um lugar só.

Os dois arquivos de teste do módulo, que já haviam divergido, viraram um.

### 3. Follow-up do advisor Supabase

`20260811_policies_authenticated_e_is_admin.sql`: as policies que referenciam
`is_admin()` saem de `PUBLIC` para `authenticated`, e a função sai do alcance de
`anon`. A migration de 20/07 tinha deixado isso pendente por dependência
circular; a ordem correta é a inversa e é a que está aplicada.

Reescritas a partir do catálogo, não de lista fixa — as definições estão
espalhadas por 11 migrations.

### 4. Lint a zero, e bloqueante

Dos 16 erros, 10 foram correções reais — cada uma tirou um render intermediário
com o valor errado, não só o aviso:

- `hooks-cliente.ts` troca `useState(false)` + efeito por `useSyncExternalStore`
  para montagem, viewport e preferências. Some o flash do tema claro antes do
  escuro, e o tema deixa de ser lido em três lugares com três estados
  independentes — alternar num não atualizava os outros até recarregar.
- Navbar, nova consulta, onboarding, produtos e chaves: valor derivado no render
  ou nascendo no estado inicial, em vez de corrigido por efeito.

Restam **6 supressões**, todas do mesmo caso: carga de dados no cliente, em que
a função de load liga o spinner de forma síncrona. Cada uma tem a razão escrita
ao lado. Sair disso é migrar para server component / camada de dados — o débito
R1 —, não reescrever o efeito.

### 5. CSP — ADR 0004 revisto

O plano de saída original começava por «migrar para nonce por requisição».
**Foi tentado e não funciona neste app**: quase toda rota é pré-renderizada, e
servindo `/landing` com a CSP de nonce a resposta vem com 22 tags `<script>` e
zero atributos `nonce` — o browser bloquearia todos.

Feito no lugar, e verificado com browser sobre o build de produção:
`unsafe-eval` fora de produção, mais `base-uri`, `form-action` e `object-src`.

### 6. Higiene e domínio fora do componente

- `vitest.config.ts` tinha um caminho **absoluto** (`/home/user/...`) que não
  existe no CI nem em outro checkout.
- 12 binários (~1,5 MB) fora da raiz, recuperáveis pelo histórico.
- `calcularSetores` e a escala de cor/rótulo saíram de
  `app/bagua-planta/page.tsx` para `src/lib`, com 16 testes.

---

## Não fechado — e por quê

### O bucket ainda está público (C8)

**É a pendência mais importante deste documento.** Todo o código está pronto:
rota de assinatura com verificação de posse (10 testes), todas as telas
resolvendo URL assinada, uploads gravando path, backfill escrito. Ver ADR 0022.

O que falta é uma linha de SQL, e ela está em
`supabase/migrations-manuais/20260811_fechar_buckets_privados.sql`, **fora** do
caminho de um `db push`. O motivo é específico: a verificação que importa é o
PDF do relatório sair com as fotos, e ele é gerado no browser com
`html2canvas` — não dá para verificar em CI.

**Enquanto esse arquivo não for aplicado, as fotos do interior das casas dos
clientes continuam acessíveis para quem tiver a URL.** O checklist de staging
está no cabeçalho do arquivo.

### Fora do alcance de quem não tem acesso ao ambiente

- **Leaked password protection:** toggle do dashboard do Supabase
  (Authentication > Providers > Email). Não versionável.
- **Upstash:** o rate limit compartilhado só passa a valer quando as duas
  variáveis existirem no ambiente da Vercel. Sem elas, o app funciona e registra
  um `warn` — mas o limite continua por instância.
- **`supabase db pull`** do schema legado (constraints, índices, enums que ainda
  só existem no banco vivo): precisa de credencial do projeto.

### Débitos de arquitetura, não tarefas

- **`script-src 'unsafe-inline'`** depende de tornar todas as páginas dinâmicas.
- **`style-src 'unsafe-inline'`** depende de migrar a estilização inline.
- **Carga de dados no cliente** (as 6 supressões de lint, os 31 componentes com
  CRUD direto): é o R1, e a saída é uma camada de dados.
- **Arquivos grandes:** `bagua-planta` saiu de 2.730 para 2.615 linhas;
  `relatorio/page.tsx` segue com 1.863 e `consultas/[id]` com 1.302. A parte
  extraída foi a que dava para verificar por teste. O resto é UI e canvas
  entrelaçados, e quebrar isso sem teste de interface troca um problema
  conhecido por um risco não medido.

### Fora do escopo desta leva

Os métodos de Feng Shui não implementados (San He, Xuan Kong Da Gua, BaZi,
Ze Ri, Kong Wang, declinação automática) continuam como estão — e a razão
registrada no documento-mestre não mudou: **não há fonte primária publicada
conferida** para eles. Implementar de memória produziria número plausível e
errado no relatório do cliente, que é exatamente o que os ADRs 0019 a 0021
existem para impedir.

O gargalo do produto também não mudou, e nenhuma linha de código o resolve:
0 assinaturas, 0 vendas, 0 lojas configuradas, o fluxo de dinheiro nunca
exercitado ponta a ponta. Ver `2026-07-19-avaliacao-experiencia-cliente.md`.

---

## Anexo (15/08): os avisos do linter do Supabase que ficam de pé

O linter de segurança acusa nove itens. Três foram corrigidos na migration
`20260815030000_endurecer_funcoes.sql`; **seis são decisões deste projeto** e
vão reaparecer em toda execução. Ficam registrados aqui porque um aviso sem
razão anotada é um convite a «consertar» — e um deles derruba o app.

### `is_admin()` executável por `authenticated` — NÃO REVOGAR

O aviso é correto na descrição e errado como recomendação para este código.
**39 policies de RLS chamam `is_admin()`**, e policy roda no contexto de quem
consulta: sem `EXECUTE` para `authenticated`, todo `select` de usuário logado
passa a falhar. Conferido antes de decidir, não presumido.

### `perfis_publicos` como `security definer`

ADR 0028. A view existe exatamente para publicar um recorte de `profiles` sem
abrir a tabela; a propriedade que o linter acusa é o mecanismo, não o defeito.

### RLS ligado e nenhuma policy: `produtos`, `cliques_de_indicacao`,
### `eventos_stripe`, `disputas_stripe`

Também é o desenho. Zero policies significa que ninguém lê sem `service_role`,
e o que é público sai por rota com **lista branca de colunas**. É o que mantém
`arquivo_path` (o arquivo que o comprador pagou para baixar) e `link_externo`
(o destino da indicação, que precisa passar pela medição) fora da vitrine.

Uma policy `select using (ativo)` devolveria a linha inteira e desfaria as duas
proteções de uma vez.

### O que foi corrigido

- `produtos_toca_atualizado_em` ganhou `set search_path = public` — nasceu sem,
  na fase 2, contra a regra do próprio projeto.
- `pedido_eventos_somente_insere` perdeu `EXECUTE` para `anon`/`authenticated`:
  era alcançável por `/rest/v1/rpc/`. Função de trigger não precisa disso — a
  checagem de privilégio é no `create trigger`, não a cada linha —, e foi
  conferido em transação revertida que `UPDATE` e `DELETE` continuam recusados.
