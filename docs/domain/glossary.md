# Glossário — Linguagem Ubíqua do FengShui Studio

> Os nomes aqui são os que aparecem no código do domínio (`src/lib/constants.ts`,
> `plano-utils.ts`, `types.ts`). Mantê-los consistentes entre negócio, código e
> banco. Termos técnicos de Feng Shui ficam em português (linguagem do
> especialista), não são "generalizados".

## Domínio Feng Shui

- **Ba Guá:** mapa energético de 9 setores sobreposto à planta do imóvel. No app,
  o consultor marca a planta e o sistema calcula os setores.
- **Metodologia:** a escola de Feng Shui usada para orientar o Ba Guá na planta
  (`src/lib/metodologias.ts`, `bagua_entrada.escola`). Duas hoje:
  - **BTB (Chapéu Preto):** o grid gira com a **porta** de entrada — Carreira
    fica sempre na parede da entrada, não importa a orientação real da casa.
    Não precisa de bússola. Padrão do app.
  - **Escola da Bússola (Clássica):** os setores são fixos à **direção
    cardinal real** (Carreira é sempre Norte, Fama é sempre Sul…), lidos pela
    orientação magnética da fachada (`bagua_entrada.orientacao_graus`,
    0–359°). Cálculo em `src/lib/bagua-grid.ts`.
  Registro extensível — novas escolas (Estrelas Voadoras, Oito Mansões da
  casa) entram como itens novos em `METODOLOGIAS`, sem redesenhar a UI.
- **Setor:** cada uma das áreas do Ba Guá (ex.: `Carreira`, `Prosperidade`,
  `Relacionamentos`, `Fama`, `Família`, `Filhos`/`Criatividade`, `Conhecimento`,
  `Pessoas Úteis`, `Centro`/`Saúde`). Persistidos em `setores_bagua`.
- **Critério:** item físico avaliado por setor (limpeza, iluminação, ventilação,
  cores, mobiliário, plantas, ausência de objetos quebrados, fluxo de energia).
  Pontuado de 0 a 4 em `diagnostico_criterios`. Fonte: `CRITERIOS`.
- **Score do setor:** percentual derivado das pontuações dos critérios
  (`score_percentual`). Thresholds de leitura: `>= 70` bom, `>= 40` médio.
- **Dicas / recomendações:** listas de ações por setor (`SETOR_DICAS`) e por
  critério (`CRITERIO_DICAS`), classificadas em urgente / melhoria / manutenção.
  **Fonte única** em `src/lib/recomendacoes.ts` (`gerarRecomendacoes`) — tela de
  diagnóstico, detalhe da consulta e PDF chamam a mesma função; inclui também a
  estratégia dos Cinco Elementos (`cinco-elementos.ts`) e conflitos
  cômodo×setor (`comodo-setor.ts`).
- **Marcação (falta/excesso):** retângulo desenhado na planta indicando área
  faltante ou em excesso de um setor (`bagua_entrada.marcacoes`).
- **Roda da Vida:** avaliação de 12 áreas da vida do cliente
  (`roda_da_vida`, `RODA_AREAS`), com respostas e plano de ações.
- **Fluxo do Chi:** checklist de circulação de energia pelo imóvel
  (`checklist_chi`).
- **Cura:** intervenção/ajuste recomendado para um setor. Consultores podem
  cadastrar curas customizadas (`consultor_curas_custom`).

## Entidades de negócio

- **Consultor:** usuário profissional (o `profile` com `role` padrão). Dono dos
  próprios clientes e consultas.
- **Cliente:** pessoa atendida pelo consultor (`clientes`).
- **Consulta:** um trabalho de Feng Shui sobre um imóvel de um cliente
  (`consultas`). Estados (`ConsultaStatus`): `rascunho`, `em_andamento`,
  `finalizada`, `arquivada`, `deletada`, `sem_analise`.
- **Ritual:** evento agendado (agenda/calendário), com fase lunar
  (`rituais`).
- **Pagamento:** cobrança que o consultor registra para seus clientes
  (`pagamentos`) — distinto da assinatura da plataforma.

## Planos e billing

- **Plano efetivo (`planoEfetivo`):** normaliza valores legados
  (`freemium`→`free`, `pro`→`profissional`). Fonte única de regra de plano em
  `plano-utils.ts`.
- **Planos:** `free` (limite de imóveis), `simples`, `profissional` (ilimitado).
- **Chave de ativação (`activation_keys`):** código que ativa um plano pago sem
  passar pelo Stripe; validada contra o `plan_type` do plano solicitado.
- **Assinatura (`subscriptions`) / Fatura (`invoices`):** estado de billing
  sincronizado a partir do Stripe via webhooks.
- **Loja / Store slug:** vitrine pública do consultor (`/loja/[slug]`),
  vendas via Stripe Connect.
- **Application fee:** taxa que a plataforma retém em cada venda da loja.
