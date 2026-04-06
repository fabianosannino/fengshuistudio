-- Bloco 2: Melhorias em consultas e clientes

-- 1. Adicionar status 'deletada' e 'sem_analise' ao enum
ALTER TYPE consulta_status ADD VALUE IF NOT EXISTS 'deletada';
ALTER TYPE consulta_status ADD VALUE IF NOT EXISTS 'sem_analise';

-- 2. Novos campos para dados adicionais do imóvel
ALTER TABLE consultas
  ADD COLUMN IF NOT EXISTS num_moradores INT,
  ADD COLUMN IF NOT EXISTS historico_imovel TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_topograficas TEXT,
  ADD COLUMN IF NOT EXISTS dados_adicionais TEXT,
  ADD COLUMN IF NOT EXISTS fotos_antes JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS fotos_depois JSONB DEFAULT '[]';

-- 3. Index para buscar consultas por cliente
CREATE INDEX IF NOT EXISTS idx_consultas_cliente
  ON consultas (cliente_id, criado_em DESC);
