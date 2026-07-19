# Threat Model — FengShui Studio

> Modelo resumido, orientado aos ativos e às fronteiras reais do sistema.
> Complementa `SECURITY.md` (política) e `docs/auditoria/` (achados). Atualizar
> quando a superfície mudar.

## Ativos a proteger

| Ativo | Sensibilidade | Onde vive |
|---|---|---|
| Dados pessoais de clientes (endereço, telefone, e-mail) | LGPD | tabela `clientes` (RLS por `consultor_id`) |
| Fotos de interiores de imóveis | LGPD (sensível) | buckets de Storage — ver ADR 0005 |
| `role`/`plano`/`stripe_*` do consultor | Privilégio/billing | `profiles` (trigger + RLS) |
| Segredos (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, webhook secrets) | Crítico | só no servidor, nunca `NEXT_PUBLIC_` |
| Trilha de auditoria | Integridade | `admin_audit_log` (append-only, limpeza restrita) |
| Valores de pagamento / taxa da plataforma | Financeiro | Stripe + `subscriptions`/`invoices`/`store_orders` |

## Fronteiras de confiança

1. **Navegador → Supabase (anon key):** não confiável. Tudo depende de RLS.
2. **Navegador → `/api/*`:** autenticado por cookie; a rota re-deriva ownership
   do `user.id`, nunca de IDs do corpo.
3. **Stripe → webhooks:** confiável **apenas após** `constructEvent` validar a
   assinatura HMAC; então escreve com `service_role`.
4. **Servidor → Supabase (service_role):** ignora RLS; uso restrito a
   `server-only` após autorização já verificada.

## Principais ameaças e mitigações

| Ameaça | Vetor | Mitigação |
|---|---|---|
| Escalada a admin | `UPDATE profiles SET role='admin'` via anon key | Trigger em colunas privilegiadas (ADR 0003) |
| Burla de billing | usuário insere `subscription` ativa / `invoice` paga | Escrita de billing só admin/service_role (ADR 0003) |
| Manipulação de preço | comprador define `unit_amount` | Preço lido do Stripe no servidor (ADR 0002) |
| Operar conta Stripe de terceiro | `account_id` no corpo | `account_id` derivado do perfil autenticado |
| Vazamento de PII (fotos) | URL pública do bucket | Buckets privados + signed URLs (ADR 0005 — pendente) |
| Adulteração de audit log | RPC de limpeza | `EXECUTE` revogado + `SECURITY DEFINER` com `search_path` |
| XSS | script inline | Escapamento do React; CSP (com débito `unsafe-inline` — ADR 0004) |
| Open redirect | `?redirect=` no login | `isSafeRedirect` valida caminho relativo |
| Injeção em upload | `file.name` malicioso | MIME por whitelist; extensão derivada do MIME, não do nome |
| Vazamento de detalhe interno | `error.message` no corpo | Respostas genéricas; detalhe só no `logger` |

## Riscos aceitos / residuais (rastreados como débito P2)

- Leitura pública dos buckets de fotos até a migração do ADR 0005.
- `unsafe-inline` no CSP até o plano de saída do ADR 0004.
- Rate limiting **in-memory** — ineficaz em serverless (cada instância tem seu
  store) e chave por IP `x-forwarded-for` (spoofável). Migrar para store
  compartilhado (Upstash/Redis).
- CRUD de negócio direto do cliente: qualquer nova tabela **precisa** de RLS
  correto desde a migration, pois não há camada de API intermediando.
