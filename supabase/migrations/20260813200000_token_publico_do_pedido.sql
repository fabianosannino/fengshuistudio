-- ═══════════════════════════════════════════════════════════════════════════
-- `pedidos.token_publico` — como o comprador vê o próprio pedido
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## O problema
--
-- O comprador da loja **não tem conta**. Não existe `auth.uid()` para comparar,
-- então nenhuma policy de RLS o alcança. Ele precisa acompanhar o pedido
-- mesmo assim — é requisito do produto e, no prazo de arrependimento, é o que
-- evita atrito no suporte.
--
-- ## O que foi descartado
--
-- - **Pedir o e-mail.** «Digite seu e-mail para ver seu pedido» entrega o
--   histórico de compras de qualquer pessoa a quem souber o e-mail dela. Saber
--   um e-mail não prova ser dono dele.
-- - **Usar o número do pedido.** `P260813-F0FD73` é legível de propósito, para
--   o suporte falar dele ao telefone — e o que é legível é adivinhável.
--
-- ## O que foi escolhido
--
-- Um token opaco de 24 bytes aleatórios, gerado no banco, com prazo próprio.
--
-- Preferido a link assinado por HMAC por dois motivos operacionais: não
-- introduz mais um segredo para rotacionar, e é **revogável** — apagar a linha
-- mata o link, o que um HMAC válido até a data não permite. O prazo vira dado
-- em vez de assinatura, e dado a gente consegue corrigir.
--
-- 180 dias cobrem com folga os 7 do arrependimento e a janela de suporte.
-- Depois disso o link morre, e isso é intencional: link de acesso a dado
-- pessoal que vale para sempre é o que a LGPD não aceita.

alter table public.pedidos
  add column if not exists token_publico text
    default encode(gen_random_bytes(24), 'hex'),
  add column if not exists token_expira_em timestamptz
    default (now() + interval '180 days');

-- Os pedidos que já existiam nasceram antes da coluna.
update public.pedidos
   set token_publico = encode(gen_random_bytes(24), 'hex'),
       token_expira_em = now() + interval '180 days'
 where token_publico is null;

alter table public.pedidos alter column token_publico set not null;

-- Unicidade é requisito de segurança aqui, não só de modelagem: dois pedidos
-- com o mesmo token fariam um comprador ver o do outro.
create unique index if not exists idx_pedidos_token_publico
  on public.pedidos (token_publico);

comment on column public.pedidos.token_publico is
  'Acesso do comprador ao próprio pedido. Ele não tem conta, então RLS não o alcança.';

-- Nenhuma policy nova.
--
-- A leitura por token acontece numa rota pública que usa `service_role` e faz
-- a conferência ela mesma. Abrir uma policy para `anon` seria pior: a policy
-- precisaria comparar o token, e o token viaja na URL — bastaria um erro de
-- filtro para a tabela inteira ficar legível para a internet.
