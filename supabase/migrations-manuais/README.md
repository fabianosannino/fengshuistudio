# Migrations que exigem validação antes de aplicar

Arquivos aqui **não** são aplicados por `supabase db push` junto com o resto.
Estão separados de propósito: cada um é uma mudança *outward-facing* e difícil
de reverter, cuja verificação depende de coisas que não existem no CI — um
Supabase real, um browser, um PDF gerado de verdade.

Aplicar um destes arquivos é uma decisão, não uma etapa de deploy. Cada um traz
o seu próprio checklist de verificação no cabeçalho; rode o checklist em
staging, e só então aplique em produção.

Quando um arquivo tiver sido aplicado em produção e validado, mova-o para
`supabase/migrations/` com a data da aplicação, para que um rebuild futuro o
reaplique junto com o resto do schema.

| Arquivo | O que faz | Bloqueio |
|---|---|---|
| `20260811_fechar_buckets_privados.sql` | Fecha `imoveis-fotos` e `clientes-fotos` (C8/LGPD) | Precisa de staging: a geração do PDF do relatório usa `html2canvas` e é o ponto de maior risco |
