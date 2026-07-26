# Achado — escritas no Supabase sem checagem de erro (perda silenciosa de dados)

- **Data:** 2026-07-26
- **Severidade:** alta no fluxo de diagnóstico (perda de trabalho do consultor); a
  triagem dos demais sites está no fim deste documento.

## A causa raiz

O cliente `@supabase/supabase-js` **resolve** a promise com `{ data, error }` em
caso de erro de banco — ele **não rejeita**. Consequências que isso produz, e
que foram observadas neste código:

1. `await supabase.from(...).update(...)` sem desestruturar `error` **engole a
   falha por completo**.
2. Um `try/catch` em volta **não ajuda**: como não há rejeição, o `catch` nunca
   dispara em erro de banco.
3. `.then(null, handler)` (ou `.catch(handler)`) também **não ajuda**, pelo mesmo
   motivo — é um handler de rejeição.

Isso viola uma regra explícita do `CLAUDE.md`:
> Toda escrita no Supabase deve checar `error` (não engula falha).

O próprio `app/bagua-planta/page.tsx` já usava o padrão correto
(`const {error} = await ...` + checagem) em 5 lugares — o que mostra que os
sites sem checagem eram esquecimento, não outra premissa de API.

## O que foi corrigido neste incremento

Escopo: o **fluxo de diagnóstico**, que é onde a perda atinge o trabalho do
consultor diretamente.

### `app/bagua-planta/page.tsx`

| Site | Sintoma antes da correção |
|---|---|
| `salvarRascunho` (autosave) | O rascunho se perdia em silêncio. Chamado em 5 pontos (marcar entrada, definir bordas, recalcular setores, concluir edição do polígono) — o consultor seguia trabalhando achando que estava salvo. |
| **Salvamento final** | **O pior caso.** O `await` não lançava, então o `try/catch` em volta nunca disparava: o app exibia **"✓ Análise salva com sucesso"** e **navegava para outra página** com a análise perdida. |
| `recomecarAnalise` (limpar rascunho) | Usava `.then(null, ...)`; erro de banco passava batido e o rascunho antigo podia reaparecer. |
| Rascunho inicial pós-upload | Mesmo padrão: a planta subia para o storage mas podia não ser registrada na consulta. |
| Snapshot `bagua_imagem` | `catch {}` vazio. **Mantido best-effort de propósito** (a coluna pode não existir e a falha não deve bloquear o salvamento dos critérios), mas agora registrado via `logger.warn` em vez de desaparecer. |

### `app/consultas/[id]/page.tsx` (`salvarSetor`)

| Site | Sintoma antes da correção |
|---|---|
| `delete` dos critérios | **Corrupção, não só perda:** se o delete falhasse e o insert passasse, os critérios **duplicavam** em vez de substituir. |
| `update` de `setores_bagua` | Score, recomendações customizadas e mapeamento de cômodos podiam não ser gravados, e a tela ainda exibia **"Setor salvo com sucesso!"** com o valor novo — que sumia ao recarregar. |

Em todos os casos a correção faz duas coisas: **registra** via `logger` e
**avisa o consultor**, em vez de apenas logar. Uma falha de escrita que só vai
para o console não protege quem está trabalhando.

## NÃO corrigido — triagem para decisão

O padrão é sistêmico. Os sites abaixo ficaram fora **de propósito**, porque
tocam cobrança/permissão e merecem revisão própria, não um efeito colateral
deste incremento.

**Prioridade alta — tocam plano/cobrança:**

- `app/api/admin/subscriptions/route.ts` — múltiplos `profiles.update({plano})`,
  `subscriptions.insert/update` e `invoices.update` sem checagem. Um admin pode
  receber resposta de sucesso enquanto a mudança de plano falhou. É o mais grave
  da lista restante.
- `app/api/stripe/webhooks/subscriptions/route.ts` (~linha 120) — verificar.

**Prioridade média:**

- `app/components/NotificationBell.tsx` — `read_at` não marcado; a notificação
  reaparece.
- `app/api/clientes/foto/route.ts`, `app/api/consultas/fotos/route.ts`,
  `app/api/consultas/bagua-planta/route.ts` — `storage.remove` de arquivos
  antigos sem checagem: vaza armazenamento, não corrompe dado.

**Prioridade baixa (provavelmente aceitável como best-effort, mas vale
declarar):**

- `admin_audit_log.insert` em `promover`, `chaves` e `subscriptions` — se falhar,
  a ação acontece sem registro de auditoria. Dependendo da exigência de
  compliance, isso pode subir de prioridade.

## Recomendação

Um **helper compartilhado** que force a checagem (algo como
`escreverOuFalhar(query, contexto)` devolvendo o dado ou lançando) evitaria a
reincidência melhor que corrigir site por site — o problema é que o padrão
correto é opcional hoje. Não implementado aqui para manter o incremento
revisável e focado no fluxo de diagnóstico.
