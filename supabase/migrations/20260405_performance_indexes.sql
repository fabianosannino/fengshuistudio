-- Performance indexes for common queries

-- Dashboard queries
CREATE INDEX IF NOT EXISTS idx_consultas_consultor_status
  ON consultas (consultor_id, status);

CREATE INDEX IF NOT EXISTS idx_consultas_consultor_criado
  ON consultas (consultor_id, criado_em DESC);

-- Client lookups
CREATE INDEX IF NOT EXISTS idx_clientes_consultor_ativo
  ON clientes (consultor_id, ativo);

-- Payment queries
CREATE INDEX IF NOT EXISTS idx_pagamentos_consultor_status
  ON pagamentos (consultor_id, status);

CREATE INDEX IF NOT EXISTS idx_pagamentos_consultor_vencimento
  ON pagamentos (consultor_id, data_vencimento);

-- Ritual queries
CREATE INDEX IF NOT EXISTS idx_rituais_consultor_status
  ON rituais (consultor_id, status);

CREATE INDEX IF NOT EXISTS idx_rituais_consultor_data
  ON rituais (consultor_id, data_ritual);
