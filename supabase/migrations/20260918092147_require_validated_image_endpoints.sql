-- Apply after the image endpoints use service_role for validated bytes.
-- Restrictive policies defeat older or future permissive write policies.
create policy imagens_validadas_insert on storage.objects as restrictive for insert to anon,authenticated
  with check(bucket_id not in ('clientes-fotos','imoveis-fotos','produtos-imagens'));
create policy imagens_validadas_delete on storage.objects as restrictive for delete to anon,authenticated
  using(bucket_id not in ('clientes-fotos','imoveis-fotos','produtos-imagens'));
create policy imagens_validadas_update on storage.objects as restrictive for update to anon,authenticated
  using(bucket_id not in ('clientes-fotos','imoveis-fotos','produtos-imagens'))
  with check(bucket_id not in ('clientes-fotos','imoveis-fotos','produtos-imagens'));
