-- 1. Tabela de referências custom do consultor para curas
CREATE TABLE IF NOT EXISTS consultor_curas_custom (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consultor_id UUID REFERENCES profiles(id) NOT NULL,
  setor_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  como_utilizar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE consultor_curas_custom ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consultor gerencia suas curas custom" ON consultor_curas_custom;
CREATE POLICY "Consultor gerencia suas curas custom"
  ON consultor_curas_custom FOR ALL
  USING (consultor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_consultor_curas_custom_consultor
  ON consultor_curas_custom (consultor_id, setor_id);

-- 2. Coluna de cômodos múltiplos nos setores (JSONB array)
ALTER TABLE setores_bagua
  ADD COLUMN IF NOT EXISTS comodos JSONB DEFAULT '[]';
