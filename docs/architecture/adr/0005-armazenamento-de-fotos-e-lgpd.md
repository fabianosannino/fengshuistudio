# ADR 0005 — Armazenamento de fotos (Supabase Storage) e LGPD

- **Status:** Proposto (migração pendente de execução em staging)
- **Data:** 2026-07-19

## Contexto

Fotos de imóveis de clientes (interiores de residências) e fotos dos clientes
ficam em dois buckets do Supabase Storage: `imoveis-fotos` e `clientes-fotos`.

Estado atual (mapeado na auditoria):

- Ambos os buckets são **públicos** (`public = true`).
- O banco guarda a **URL pública completa** (não o path) em
  `consultas.foto_geral_url`, `consultas.fotos_comodos[].fotos[]`,
  `consultas.fotos_antes[]`, `consultas.fotos_depois[]`,
  `consultas.bagua_entrada.planta_url` e `clientes.foto_url`.
- Todos os ~13 pontos de render são componentes `'use client'`, e a geração de
  PDF (`relatorio`) usa `html2canvas` com `useCORS` — as imagens precisam
  carregar antes da captura.

Consequência: **qualquer pessoa com a URL acessa a foto sem autenticação** —
dado pessoal sensível exposto (risco LGPD). A migration `20260718` já restringiu
a *listagem* do bucket ao dono, mas a *leitura pública por URL* permanece.

## Decisão

Migrar `imoveis-fotos` e `clientes-fotos` para **buckets privados + URLs
assinadas** (signed URLs com TTL curto), geradas no servidor após verificação de
ownership. **Não** fazer o flip do bucket para privado sem antes migrar app e
dados, porque isso invalida instantaneamente todas as URLs públicas já salvas e
pode deixar os PDFs em branco.

## Plano de migração (faseado, com staging obrigatório)

1. Rota `GET /api/storage/signed?path=...` que valida ownership
   (consulta/cliente do `user.id`) e retorna `createSignedUrl`.
2. Passar as 3 rotas de upload a salvar o **path** (não a URL pública);
   ajustar os 3 pontos de DELETE que hoje derivam o path por `split('/bucket/')`.
3. Backfill idempotente das linhas existentes: URL pública → path.
4. Nos pontos de render, resolver a signed URL antes de exibir (com
   `crossOrigin` correto para o `html2canvas`). **Validar a geração de PDF em
   staging** — ponto de maior risco.
5. Só então: `UPDATE storage.buckets SET public = false` nos dois buckets.

## Consequências

- **Positivo:** fecha o vazamento de PII; conformidade LGPD.
- **Custo:** cada exibição de foto passa a exigir uma signed URL (mais uma
  chamada); TTL curto significa re-assinar em sessões longas.
- **Risco principal:** o PDF client-side depende de as imagens carregarem antes
  da captura — daí a exigência de validação em staging antes do flip.

## Alternativas consideradas

- **Manter público (status quo):** rejeitado — é o risco LGPD.
- **Ofuscar o path (nomes aleatórios) mantendo público:** rejeitado — segurança
  por obscuridade; a URL vaza igual.
- **Proxy de imagem autenticado** em vez de signed URLs: possível, mas coloca a
  banda de imagem passando pelo servidor Next; signed URL serve direto do
  storage.
