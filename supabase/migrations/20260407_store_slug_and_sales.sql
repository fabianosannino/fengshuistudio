-- Store improvements: slug + orders

-- 1. Slug para loja do consultor
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS store_slug TEXT UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_store_slug
  ON profiles (store_slug)
  WHERE store_slug IS NOT NULL;

-- 2. Tabela de vendas/pedidos
CREATE TABLE IF NOT EXISTS store_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES profiles(id) NOT NULL,
  buyer_email TEXT,
  buyer_name TEXT,
  product_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE store_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seller ve suas vendas" ON store_orders;
CREATE POLICY "Seller ve suas vendas"
  ON store_orders FOR ALL
  USING (seller_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_store_orders_seller
  ON store_orders (seller_id, created_at DESC);
