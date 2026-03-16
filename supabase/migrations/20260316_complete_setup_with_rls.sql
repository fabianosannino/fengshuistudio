-- ============================================================
-- MIGRAÇÃO COMPLETA: Colunas faltantes + RLS em todas as tabelas
-- FengShui Studio
-- Data: 2026-03-16
--
-- Esta migração é IDEMPOTENTE — segura para rodar múltiplas vezes.
-- Usa IF NOT EXISTS para colunas e DROP POLICY IF EXISTS antes
-- de cada CREATE POLICY.
-- ============================================================


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 1: COLUNAS FALTANTES NA TABELA profiles
-- ════════════════════════════════════════════════════════════════

-- Colunas principais de controle de acesso e plano
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tipo_usuario TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT 'free';

-- Colunas do perfil profissional (página Perfil)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profissao TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS area_atuacao TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registro_profissional TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS site TEXT;

-- Visibilidade na rede de parceiros
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parceiro_visivel BOOLEAN DEFAULT FALSE;


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 2: HABILITAR RLS EM TODAS AS TABELAS
-- ════════════════════════════════════════════════════════════════

ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE setores_bagua        ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostico_criterios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rituais              ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 3: POLÍTICAS RLS — profiles
-- ════════════════════════════════════════════════════════════════
-- Usuário lê e atualiza o próprio perfil.
-- Admin pode ler todos os perfis.
-- Parceiros visíveis podem ser lidos por qualquer usuário autenticado.

-- 3a. SELECT — próprio perfil
DROP POLICY IF EXISTS "Usuário lê próprio perfil" ON profiles;
CREATE POLICY "Usuário lê próprio perfil"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- 3b. SELECT — admin lê todos
DROP POLICY IF EXISTS "Admin lê todos os perfis" ON profiles;
CREATE POLICY "Admin lê todos os perfis"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- 3c. SELECT — parceiros visíveis para todos os autenticados
DROP POLICY IF EXISTS "Parceiros visíveis para autenticados" ON profiles;
CREATE POLICY "Parceiros visíveis para autenticados"
  ON profiles FOR SELECT
  USING (
    parceiro_visivel = TRUE
    AND auth.uid() IS NOT NULL
  );

-- 3d. UPDATE — usuário atualiza próprio perfil
DROP POLICY IF EXISTS "Usuário atualiza próprio perfil" ON profiles;
CREATE POLICY "Usuário atualiza próprio perfil"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3e. INSERT — usuário cria próprio perfil (primeiro login)
DROP POLICY IF EXISTS "Usuário cria próprio perfil" ON profiles;
CREATE POLICY "Usuário cria próprio perfil"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 4: POLÍTICAS RLS — clientes
-- ════════════════════════════════════════════════════════════════
-- Cada consultor vê/cria/edita/apaga apenas seus próprios clientes.

DROP POLICY IF EXISTS "Consultor lê próprios clientes" ON clientes;
CREATE POLICY "Consultor lê próprios clientes"
  ON clientes FOR SELECT
  USING (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor cria clientes" ON clientes;
CREATE POLICY "Consultor cria clientes"
  ON clientes FOR INSERT
  WITH CHECK (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor atualiza próprios clientes" ON clientes;
CREATE POLICY "Consultor atualiza próprios clientes"
  ON clientes FOR UPDATE
  USING (consultor_id = auth.uid())
  WITH CHECK (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor deleta próprios clientes" ON clientes;
CREATE POLICY "Consultor deleta próprios clientes"
  ON clientes FOR DELETE
  USING (consultor_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 5: POLÍTICAS RLS — consultas
-- ════════════════════════════════════════════════════════════════
-- Cada consultor vê/cria/edita/apaga apenas suas próprias consultas.

DROP POLICY IF EXISTS "Consultor lê próprias consultas" ON consultas;
CREATE POLICY "Consultor lê próprias consultas"
  ON consultas FOR SELECT
  USING (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor cria consultas" ON consultas;
CREATE POLICY "Consultor cria consultas"
  ON consultas FOR INSERT
  WITH CHECK (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor atualiza próprias consultas" ON consultas;
CREATE POLICY "Consultor atualiza próprias consultas"
  ON consultas FOR UPDATE
  USING (consultor_id = auth.uid())
  WITH CHECK (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor deleta próprias consultas" ON consultas;
CREATE POLICY "Consultor deleta próprias consultas"
  ON consultas FOR DELETE
  USING (consultor_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 6: POLÍTICAS RLS — setores_bagua
-- ════════════════════════════════════════════════════════════════
-- Acesso baseado na consulta associada (via consulta_id → consultas.consultor_id).

DROP POLICY IF EXISTS "Usuário lê setores das próprias consultas" ON setores_bagua;
CREATE POLICY "Usuário lê setores das próprias consultas"
  ON setores_bagua FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consultas
      WHERE consultas.id = setores_bagua.consulta_id
        AND consultas.consultor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuário cria setores nas próprias consultas" ON setores_bagua;
CREATE POLICY "Usuário cria setores nas próprias consultas"
  ON setores_bagua FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consultas
      WHERE consultas.id = setores_bagua.consulta_id
        AND consultas.consultor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuário atualiza setores das próprias consultas" ON setores_bagua;
CREATE POLICY "Usuário atualiza setores das próprias consultas"
  ON setores_bagua FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM consultas
      WHERE consultas.id = setores_bagua.consulta_id
        AND consultas.consultor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consultas
      WHERE consultas.id = setores_bagua.consulta_id
        AND consultas.consultor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuário deleta setores das próprias consultas" ON setores_bagua;
CREATE POLICY "Usuário deleta setores das próprias consultas"
  ON setores_bagua FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM consultas
      WHERE consultas.id = setores_bagua.consulta_id
        AND consultas.consultor_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 7: POLÍTICAS RLS — diagnostico_criterios
-- ════════════════════════════════════════════════════════════════
-- Acesso baseado no setor → consulta → consultor_id.

DROP POLICY IF EXISTS "Usuário lê critérios das próprias consultas" ON diagnostico_criterios;
CREATE POLICY "Usuário lê critérios das próprias consultas"
  ON diagnostico_criterios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM setores_bagua
      JOIN consultas ON consultas.id = setores_bagua.consulta_id
      WHERE setores_bagua.id = diagnostico_criterios.setor_id
        AND consultas.consultor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuário cria critérios nas próprias consultas" ON diagnostico_criterios;
CREATE POLICY "Usuário cria critérios nas próprias consultas"
  ON diagnostico_criterios FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM setores_bagua
      JOIN consultas ON consultas.id = setores_bagua.consulta_id
      WHERE setores_bagua.id = diagnostico_criterios.setor_id
        AND consultas.consultor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuário atualiza critérios das próprias consultas" ON diagnostico_criterios;
CREATE POLICY "Usuário atualiza critérios das próprias consultas"
  ON diagnostico_criterios FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM setores_bagua
      JOIN consultas ON consultas.id = setores_bagua.consulta_id
      WHERE setores_bagua.id = diagnostico_criterios.setor_id
        AND consultas.consultor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM setores_bagua
      JOIN consultas ON consultas.id = setores_bagua.consulta_id
      WHERE setores_bagua.id = diagnostico_criterios.setor_id
        AND consultas.consultor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuário deleta critérios das próprias consultas" ON diagnostico_criterios;
CREATE POLICY "Usuário deleta critérios das próprias consultas"
  ON diagnostico_criterios FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM setores_bagua
      JOIN consultas ON consultas.id = setores_bagua.consulta_id
      WHERE setores_bagua.id = diagnostico_criterios.setor_id
        AND consultas.consultor_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 8: POLÍTICAS RLS — pagamentos
-- ════════════════════════════════════════════════════════════════
-- Cada consultor gerencia apenas seus próprios pagamentos.

DROP POLICY IF EXISTS "Consultor lê próprios pagamentos" ON pagamentos;
CREATE POLICY "Consultor lê próprios pagamentos"
  ON pagamentos FOR SELECT
  USING (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor cria pagamentos" ON pagamentos;
CREATE POLICY "Consultor cria pagamentos"
  ON pagamentos FOR INSERT
  WITH CHECK (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor atualiza próprios pagamentos" ON pagamentos;
CREATE POLICY "Consultor atualiza próprios pagamentos"
  ON pagamentos FOR UPDATE
  USING (consultor_id = auth.uid())
  WITH CHECK (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor deleta próprios pagamentos" ON pagamentos;
CREATE POLICY "Consultor deleta próprios pagamentos"
  ON pagamentos FOR DELETE
  USING (consultor_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 9: POLÍTICAS RLS — rituais
-- ════════════════════════════════════════════════════════════════
-- Cada consultor gerencia apenas seus próprios rituais.

DROP POLICY IF EXISTS "Consultor lê próprios rituais" ON rituais;
CREATE POLICY "Consultor lê próprios rituais"
  ON rituais FOR SELECT
  USING (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor cria rituais" ON rituais;
CREATE POLICY "Consultor cria rituais"
  ON rituais FOR INSERT
  WITH CHECK (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor atualiza próprios rituais" ON rituais;
CREATE POLICY "Consultor atualiza próprios rituais"
  ON rituais FOR UPDATE
  USING (consultor_id = auth.uid())
  WITH CHECK (consultor_id = auth.uid());

DROP POLICY IF EXISTS "Consultor deleta próprios rituais" ON rituais;
CREATE POLICY "Consultor deleta próprios rituais"
  ON rituais FOR DELETE
  USING (consultor_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- SEÇÃO 10: ATUALIZAR CACHE DO POSTGREST
-- ════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
