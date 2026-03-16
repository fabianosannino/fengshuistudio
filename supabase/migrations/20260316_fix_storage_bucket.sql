-- ============================================================
-- FIX: Create storage bucket 'imoveis-fotos' if it doesn't exist
-- and set up proper access policies.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================

-- 1. Create the bucket (public so images can be displayed)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'imoveis-fotos',
  'imoveis-fotos',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Enable RLS on storage.objects (usually already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Authenticated users can upload files to their own consultation folders
DROP POLICY IF EXISTS "Consultores fazem upload nas próprias consultas" ON storage.objects;
CREATE POLICY "Consultores fazem upload nas próprias consultas"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'imoveis-fotos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM consultas
      WHERE consultas.id::text = (storage.foldername(name))[1]
        AND consultas.consultor_id = auth.uid()
    )
  );

-- 4. Policy: Authenticated users can update/overwrite their own files
DROP POLICY IF EXISTS "Consultores atualizam arquivos nas próprias consultas" ON storage.objects;
CREATE POLICY "Consultores atualizam arquivos nas próprias consultas"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'imoveis-fotos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM consultas
      WHERE consultas.id::text = (storage.foldername(name))[1]
        AND consultas.consultor_id = auth.uid()
    )
  );

-- 5. Policy: Authenticated users can delete their own files
DROP POLICY IF EXISTS "Consultores deletam arquivos nas próprias consultas" ON storage.objects;
CREATE POLICY "Consultores deletam arquivos nas próprias consultas"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'imoveis-fotos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM consultas
      WHERE consultas.id::text = (storage.foldername(name))[1]
        AND consultas.consultor_id = auth.uid()
    )
  );

-- 6. Policy: Public read access (bucket is public)
DROP POLICY IF EXISTS "Acesso público de leitura imoveis-fotos" ON storage.objects;
CREATE POLICY "Acesso público de leitura imoveis-fotos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'imoveis-fotos');

-- 7. Policy: Authenticated users can list files in their consultation folders
-- (needed for the "delete previous plant image" logic)
DROP POLICY IF EXISTS "Consultores listam arquivos nas próprias consultas" ON storage.objects;
CREATE POLICY "Consultores listam arquivos nas próprias consultas"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'imoveis-fotos'
    AND auth.uid() IS NOT NULL
  );
