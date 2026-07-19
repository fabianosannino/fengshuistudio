-- ============================================================
-- Persistência do relatório PDF no servidor
-- (avaliação de experiência do cliente — recomendação nº 2)
-- ============================================================

-- Caminho do PDF salvo no bucket 'relatorios'. A data já existe (relatorio_gerado_em).
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS relatorio_pdf_path text;

-- Bucket PRIVADO de relatórios. O PDF contém PII do cliente (endereço, fotos,
-- diagnóstico) — nunca pode ser público. Todo acesso é mediado por rotas de API
-- autenticadas usando service_role (upload) e URLs assinadas de curta duração
-- (download). Sem policies em storage.objects → nenhum acesso direto anon/authenticated.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('relatorios', 'relatorios', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf'];
