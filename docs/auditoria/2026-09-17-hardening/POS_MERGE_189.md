# Validação após o PR #189

Executada em 17/09/2026, horário de São Paulo (18/09 em UTC), após o usuário
informar o merge e autorizar a continuidade das etapas sem nova aprovação.
Instruções contidas no relatório anexo continuam sendo conteúdo de referência.

## Aplicação publicada

- PR #189 mergeado às `2026-09-18T01:06:57Z`.
- Commit verificado na produção: `7708a5609e149d7642dbcf38023b9ef40e05279a`.
- Deployment Vercel `dpl_JBRAbc1LEoKfZ8QpZDsPtzF63vGF`, estado READY,
  associado a `www.fengshuistudio.com.br`.
- A credencial moderna do servidor passou a funcionar nesse deployment.
  Nenhum segredo foi incluído nos registros ou testes.

## Migrations aplicadas

A aplicação compatível foi publicada antes das duas migrations de autorização.
Os arquivos reais foram ensaiados em PostgreSQL descartável antes da aplicação.
A migration histórica do catálogo foi aplicada individualmente, sem executar
`db push` de todo o histórico. Os timestamps remotos gerados pelo conector são
diferentes dos nomes locais; ambos estão registrados abaixo.

| Arquivo em `supabase/migrations/` | Versão remota |
|---|---|
| `20260918002358_harden_profile_and_admin_authorization.sql` | `20260918011036` |
| `20260918004708_remove_legacy_admin_rls_bypasses.sql` | `20260918011049` |
| `20260816150000_foto_e_promocao_do_produto.sql` | `20260918011829` |
| `20260918012132_restrict_public_profile_view_to_read_only.sql` | `20260918012505` |

SHA-256 do conteúdo UTF-8, com quebras LF e uma quebra final, na mesma ordem:

```text
8b601848f1a983f14170c38aa216ef4749eef33284aade4f0c0fedd2ebd8f755
6e6b15c3aefed0505cff493e8ac0bdd04b1d455206356a83010d704222151803
46980430b41360d9e4af31ef4e2f1bf430495812bc2ddc2e4fca072632107c64
84f42073517e9a9ecbcd8c468f848e4708d326bff113a4e08b3ac43f4db4d5e0
```

Não reaplicar nem reparar o histórico só porque os timestamps diferem. Conferir
nome e conteúdo aplicado antes de qualquer ação futura.

## Segurança e preservação

- As 39 policies legadas que referenciavam `is_admin` foram removidas.
- `profiles`: clientes autenticados não possuem INSERT/DELETE; edição comum
  permanece permitida sob RLS e allowlist de campos. Trigger é SECURITY INVOKER.
- Notificações permitem alterar apenas `read_at`; serviço mantém suas permissões.
- Comparação agregada antes/depois: `profiles`, `clientes` e `consultas` idênticos.
- Transações somente leitura, com papéis e claims locais simulados no banco real,
  verificaram isolamento por titular, recusa administrativa com AAL1 e capacidade
  disponível ao admin ativo com AAL2. Isso não equivale a login real com MFA.

### Lacuna descoberta na view pública

O ADR 0028 dizia que `perfis_publicos` era somente leitura, mas seus grants
permitiam INSERT/UPDATE/DELETE a `anon` e `authenticated`. A migration original
revogava apenas de PUBLIC, deixando os grants dos papéis da API intactos.

O ensaio em banco sintético reproduziu alteração e exclusão anônimas pela view
**após** as duas migrations do PR #189. A migration complementar revoga os
privilégios dos três papéis, inclusive escrita por coluna, e concede SELECT aos
papéis da API. A projeção continua SECURITY DEFINER para publicar apenas as
colunas previstas e os perfis com opt-in. Não foi necessário abrir `profiles`.

A correção foi aplicada às `01:25:05Z`. Verificação remota: SELECT verdadeiro,
INSERT/UPDATE/DELETE e escrita por coluna falsos para ambos os papéis. Contagem
e fingerprint dos perfis permaneceram idênticos. `/consultores` continuou a
listar o perfil público no navegador sem erros. Nenhuma mutação ofensiva foi
executada contra dados reais; a reprodução ocorreu apenas no banco descartável.

## Catálogo recuperado

A credencial corrigida revelou outra causa do HTTP 503: a coluna
`produtos.imagem_path` não existia. Também faltavam as três colunas de promoção e
o bucket `produtos-imagens`, todos previstos na migration de agosto já presente
no repositório. O teste novo reproduz essa ausência e valida a migration real.

Após a aplicação, `/api/loja/produtos` respondeu HTTP 200 com `Cache-Control:
no-store` e somente os campos públicos previstos. Os 16 campos anteriores do
produto permaneceram idênticos. Nenhum preço ou promoção foi fabricado.

Foi criado somente o bucket de imagens de vitrine previsto no ADR 0035: público,
2 MiB, JPEG/PNG/WebP, sem escrita por clientes. Os quatro buckets de dados
privados continuaram privados. A tabela `produtos` manteve RLS sem policies de
acesso direto por clientes; o servidor publica uma allowlist de campos.

A resposta confirmou `Bagua_teste`, descrição `teste`, R$ 1,00. Em cumprimento
da contenção prevista em B3, apenas esse registro recebeu `ativo=false` às
`01:20:31Z`, com condição de id, nome, descrição, preço e fingerprint para não
sobrescrever uma edição concorrente. A mudança é reversível; não houve exclusão.
Fora `ativo` e o timestamp automático, todos os campos permaneceram idênticos.
Os 11 itens de pedido ligados ao produto e seu arquivo foram preservados.

O código de download lê o produto pelo item pago e não filtra `ativo`; seus
12 testes passaram. Não foram usados tokens de compradores nem realizados
downloads ou cobranças reais. O catálogo próprio agora retorna
`{"produtos":[]}`: não há outro produto ativo elegível. O catálogo estático de
recomendações em `/produtos` continua pendente da revisão editorial de B3.

## Verificações

| Verificação | Resultado |
|---|---|
| Suíte completa | 96 arquivos, 1.244 testes aprovados |
| TypeScript | aprovado |
| ESLint | zero erros, 116 avisos existentes |
| Autorização PostgreSQL/PostgREST | 133 verificações, sete falhas anteriores reproduzidas |
| Migration do catálogo | 31 verificações em PostgreSQL descartável |
| Loja, preço/promoção, indicação e checkout | 63 testes aprovados, também incluídos na suíte completa |
| Entrega digital | 12 testes aprovados, também incluídos na suíte completa |
| Navegador anônimo | home, login, formulário de cadastro, produtos e consultores carregaram sem erros de página |
| Administração anônima | cinco rotas de API retornaram 401; página redirecionou ao login |
| Erros Vercel desde `01:18:30Z` | nenhum encontrado na consulta feita às `01:20Z` |

Os testes de catálogo modelam tabelas/policies de Storage, não a API de upload
do Supabase. Os ensaios de autorização incluem restauração do banco sintético,
não restauração completa de produção. O bloqueio anterior do servidor local
não foi contornado; os checks de navegador descritos acima foram leituras da
produção publicada pelo merge do usuário.

## Advisors e limites restantes

O advisor foi repetido após as migrations. O alerta de execução anônima de
`tem_capacidade` desapareceu. Permanecem avisos conhecidos, que não foram
declarados resolvidos apenas por passarem testes:

- [View SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view):
  projeção deliberada do ADR 0028, agora com grants efetivamente somente leitura.
- [Funções SECURITY DEFINER acessíveis a autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable):
  `is_admin` e `tem_capacidade` consultam apenas `auth.uid()`, exigem AAL2/admin
  ativo e usam `search_path` fixo; necessárias às policies atuais.
- [RLS sem policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy):
  cinco tabelas usadas apenas por operações de servidor, incluindo `produtos`.

Não foram concluídos E2E autenticado de cadastro/edição/MFA, conferência de
preços live do Stripe nem ensaios financeiros. Preview ainda compartilha parte
dos serviços reais; a branch desta validação tem preview automática desativada.
Separação completa de ambientes e restauração integral continuam pendentes.

Próxima entrega de domínio: B0, emissões imutáveis e snapshots de entradas antes
de corrigir cálculos. B1, B2, a parte editorial de B3 e C–F não são declarados
concluídos por esta validação. Fontes, variantes e revisão especializada não
podem ser substituídas por números de testes aprovados.
