-- =====================================================
-- BILLING SYSTEM — FengShui Studio / Qi Vitalis
-- Rodar no Supabase SQL Editor
-- =====================================================

-- 1. Tabela de planos disponíveis
CREATE TABLE IF NOT EXISTS plans (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  price_monthly   DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly    DECIMAL(10,2) NOT NULL DEFAULT 0,
  description     TEXT,
  features        JSONB,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO plans (name, slug, price_monthly, price_yearly, description, features)
VALUES
  ('Free', 'free', 0, 0, 'Para conhecer a plataforma', '{"imoveis":3,"clientes":false,"calendario":false,"pdf":"bloqueado","parceiros":"bloqueado","multiplas_analises":false,"historico":false}'),
  ('Simples', 'simples', 97, 814.80, 'Para uso pessoal', '{"imoveis":1,"clientes":false,"calendario":true,"pdf":"marca_dagua","parceiros":"visualizar","multiplas_analises":false,"historico":false}'),
  ('Profissional', 'profissional', 247, 2076.00, 'Para consultores profissionais', '{"imoveis":"ilimitado","clientes":true,"calendario":true,"pdf":"limpo","parceiros":"completo","multiplas_analises":true,"historico":true}')
ON CONFLICT (slug) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  description = EXCLUDED.description,
  features = EXCLUDED.features;

-- 2. Tabela de assinaturas
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID REFERENCES profiles(id) NOT NULL,
  plan_id                 UUID REFERENCES plans(id) NOT NULL,
  billing_cycle           TEXT NOT NULL DEFAULT 'monthly',
  status                  TEXT NOT NULL DEFAULT 'active',
  price_paid              DECIMAL(10,2),
  started_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_period_start    TIMESTAMP WITH TIME ZONE,
  current_period_end      TIMESTAMP WITH TIME ZONE,
  next_billing_date       TIMESTAMP WITH TIME ZONE,
  cancelled_at            TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  payment_method_id       TEXT,
  gateway_subscription_id TEXT,
  activated_by_key        UUID REFERENCES activation_keys(id),
  gratuidade_motivo       TEXT,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia subscriptions" ON subscriptions;
CREATE POLICY "Admin gerencia subscriptions"
  ON subscriptions FOR ALL
  USING (is_admin() OR user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);

-- 3. Tabela de faturas
CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES profiles(id) NOT NULL,
  subscription_id     UUID REFERENCES subscriptions(id),
  plan_id             UUID REFERENCES plans(id),
  amount              DECIMAL(10,2) NOT NULL,
  discount            DECIMAL(10,2) DEFAULT 0,
  amount_paid         DECIMAL(10,2) DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending',
  billing_cycle       TEXT,
  due_date            DATE NOT NULL,
  paid_at             TIMESTAMP WITH TIME ZONE,
  paid_manually       BOOLEAN DEFAULT FALSE,
  paid_method         TEXT,
  paid_by_admin       UUID REFERENCES profiles(id),
  gateway_invoice_id  TEXT,
  payment_url         TEXT,
  description         TEXT,
  installments        INT DEFAULT 1,
  installment_number  INT DEFAULT 1,
  notes               TEXT,
  refunded_at         TIMESTAMP WITH TIME ZONE,
  refund_amount       DECIMAL(10,2),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin e usuario gerencia invoices" ON invoices;
CREATE POLICY "Admin e usuario gerencia invoices"
  ON invoices FOR ALL
  USING (is_admin() OR user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices (due_date);

-- 4. Tabela de notificações de pagamento
CREATE TABLE IF NOT EXISTS payment_notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) NOT NULL,
  invoice_id  UUID REFERENCES invoices(id),
  type        TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'in_app',
  sent_at     TIMESTAMP WITH TIME ZONE,
  read_at     TIMESTAMP WITH TIME ZONE,
  content     TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE payment_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin e usuario ve notificacoes" ON payment_notifications;
CREATE POLICY "Admin e usuario ve notificacoes"
  ON payment_notifications FOR ALL
  USING (is_admin() OR user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_payment_notifications_user_id ON payment_notifications (user_id);

-- 5. Tabela de relatórios semanais
CREATE TABLE IF NOT EXISTS weekly_reports (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start    DATE NOT NULL,
  week_end      DATE NOT NULL,
  generated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data          JSONB NOT NULL,
  is_manual     BOOLEAN DEFAULT FALSE,
  sent_to       TEXT[],
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin ve relatorios" ON weekly_reports;
CREATE POLICY "Admin ve relatorios"
  ON weekly_reports FOR ALL
  USING (is_admin());

-- 6. Adicionar campos à tabela activation_keys
ALTER TABLE activation_keys
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS duration_months INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_percent INT DEFAULT 0;
