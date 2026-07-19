# Avaliação — Experiência do Cliente e Efetividade dos Resultados

**Data:** 2026-07-19
**Método:** análise dos fluxos no código (auditados) + dados reais de produção
(Supabase, acesso autorizado do dono). Complementa
`docs/auditoria/2026-07-18-auditoria-arquitetura-seguranca.md` (segurança/arquitetura).

---

## Ressalva de método (essencial)

O produto **ainda não tem uso real de clientes**. Todo o conteúdo do banco
pertence às contas de teste do dono (`fsannino@gmail.com` e
`fabiano@sannino.com.br`). Portanto **não é possível medir empiricamente a
"efetividade no uso real" — não há uso real ainda.** O que se avalia aqui é
(a) a qualidade do fluxo/experiência pelo código e (b) o que o teste do próprio
dono revela sobre atrito e conclusão.

Sinais de uso real (produção, 2026-07-19):

| Sinal | Valor |
|---|---|
| Assinaturas pagas / ativas | 0 |
| Pedidos na loja | 0 |
| Pagamentos registrados | 0 |
| Chaves de ativação usadas | 0 |
| Lojas configuradas / contas Stripe | 0 |
| Consultores que realmente logaram | 1 (o dono) |
| Janela de atividade | 23/02 – 06/04/2026 (sem novidade há ~3,5 meses) |

---

## 1. Funil interno (dados do teste do dono)

| Etapa | Nº | Leitura |
|---|---|---|
| Consultas criadas | 14 | — |
| em andamento | 12 | 86% travadas sem finalizar |
| finalizadas | 2 | 14% chegaram ao "fim" |
| Ba Guá iniciado | 10 | Feature central, a mais usada |
| Ba Guá finalizado | 7 | Bom engajamento no núcleo |
| Setores pontuados | 84 (score médio 56%) | Diagnóstico funciona |
| Roda da Vida com conteúdo | 3 de 14 | Pouco usada |
| Fluxo do Chi com conteúdo | 1 de 14 | Quase não usada |
| Snapshot do relatório (`bagua_imagem`) | 0 | Resultado visual não persistido |
| Registros em `diagnostico_criterios` | 0 (mas 101 setores) | Diagnóstico vive só no JSONB; tabela oficial vazia |

**Leituras-chave:**
- A maioria das consultas nunca é finalizada (12/14). O passo "finalizar" é
  pouco claro ou não agrega valor percebido.
- O Ba Guá é o coração do produto e funciona; as outras ferramentas (Roda da
  Vida, Fluxo do Chi) foram quase ignoradas — excesso de superfície com valor
  pouco claro.
- Persistência de resultado falha em dois pontos: o snapshot do relatório está
  zerado e os critérios de diagnóstico não estão na tabela `diagnostico_criterios`
  (ficam só no JSONB `bagua_entrada`). Essa tabela é efetivamente morta — mesma
  duplicação de modelo apontada na auditoria de arquitetura.

---

## 2. Experiência, fluxo a fluxo

**Consultor (usuário pagante):**

| Fluxo | Avaliação |
|---|---|
| Cadastro → dashboard | ✅ Simples; dashboard com resumo e gráficos é bom começo. |
| Criar cliente | ✅ Bom (autofill de CEP, foto). |
| Criar consulta | ⚠️ Limites de plano inline; regra "3 grátis / 1 ativa" pode confundir. |
| **Ba Guá (núcleo)** | ⚠️ Poderoso, mas maior ponto de atrito: upload, rotação, marcação e pontuação num canvas de 2.097 linhas, 100% no cliente. Provável má experiência no celular. |
| Recomendações | ⚠️ Efetividade comprometida por inconsistência (ver §3). |
| Relatório PDF | ⚠️ Gerado no navegador (html2canvas+jsPDF) — frágil, sem cópia no servidor, qualidade depende do device. É o entregável final; precisa ser à prova de falha. |
| Roda da Vida / Fluxo do Chi | ⚠️ Baixíssima adoção. Aprofundar valor ou simplificar/esconder. |
| Loja (Stripe Connect) | ❓ Nunca exercitada de ponta a ponta (0 lojas, 0 vendas). |

**Cliente final (recebe a consultoria):**
- Único entregável é o **PDF**, cuja geração é o elo mais frágil.
- A **loja pública** `/loja/[slug]` nunca foi configurada — toque inexistente.

---

## 3. Efetividade dos resultados — risco central

O "resultado" que o produto entrega é o diagnóstico + recomendações + relatório.
Risco crítico: **existem 3 motores de recomendação distintos, com conteúdo
divergente:**

1. `app/bagua-planta` (tela de diagnóstico) — motor próprio.
2. `app/consultas/[id]` (tela de detalhe) — outro motor.
3. `app/consultas/[id]/relatorio` (PDF do cliente) — outro conjunto de dicas.

A divergência tela↔PDF do `SETOR_DICAS` já foi corrigida (PR #70), mas o motor
do `bagua-planta` continua separado. Na prática, **a mesma casa pode gerar
recomendações diferentes conforme a tela** — o que corrói a confiança no
resultado, que é exatamente o que o cliente paga para receber. Para um produto
cuja proposta de valor É a recomendação, consistência do resultado é requisito
nº 1, não débito P2.

Agravado por: snapshot do relatório não salvo e diagnóstico granular não
persistido na tabela oficial — o resultado é efêmero, regenerado no cliente a
cada vez.

---

## 4. Nota geral e recomendações priorizadas

**Nota:** núcleo forte e diferenciado (diagnóstico Ba Guá visual funciona e
engaja), mas produto em estado **pré-validação** — nunca usado por cliente real,
monetização nunca rodou, atividade parada há ~3 meses. A prioridade não é
adicionar features; é **fechar o ciclo de valor de uma consulta ponta a ponta e
validar com 1 cliente real.**

1. **Unificar o motor de recomendação** (3 → 1 fonte de verdade). Sem isso, o
   resultado é inconsistente. Evolução direta do fix do PR #70.
2. **Relatório PDF confiável e persistido** — gerar/guardar no servidor, não
   depender do navegador. É o entregável; não pode falhar.
3. **Reduzir atrito do Ba Guá** e **clarear o "finalizar"** — 86% travaram em
   andamento; entender por quê.
4. **Validar a loja ponta a ponta** com uma venda real (a `SERVICE_ROLE_KEY` já
   está configurada) — o fluxo de dinheiro nunca foi testado.
5. **Focar ou cortar** Roda da Vida e Fluxo do Chi — quase ninguém usou.
6. **Corrigir o modelo de dados do diagnóstico** (JSONB vs tabela
   `diagnostico_criterios` vazia) para o resultado ser consultável e durável.

---

## Anexo — consultas de referência

As métricas vêm de queries diretas em produção (projeto `airijuazookdnstyfady`),
sobre `consultas`, `setores_bagua`, `diagnostico_criterios`, `subscriptions`,
`invoices`, `store_orders`, `pagamentos`, `activation_keys` e `profiles`.
Reprodutíveis a qualquer momento para reavaliar o funil quando houver uso real.
