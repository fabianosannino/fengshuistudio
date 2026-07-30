-- A escolha do modelo de pontuação fica gravada NA CONSULTA, não no perfil do
-- consultor. Motivo: reabrir uma consulta antiga não pode repontuá-la sob um
-- padrão novo — o relatório já entregue ao cliente precisa continuar
-- reproduzível. Mesma lição da ADR 0018. Ver ADR 0021.
-- Já aplicada em produção; versionada aqui para o histórico.
alter table public.consultas
  add column if not exists modelo_pontuacao text,
  add column if not exists peso_geo numeric(3,2);

-- Fail-closed: só os quatro modelos conhecidos, e peso dentro de 0–1.
-- Nulo é permitido e significa «usar o padrão do produto».
alter table public.consultas
  drop constraint if exists consultas_modelo_pontuacao_valido;
alter table public.consultas
  add constraint consultas_modelo_pontuacao_valido
  check (modelo_pontuacao is null or modelo_pontuacao in
    ('fisico-puro','geometrico-puro','composto-ponderado','composto-conservador'));

alter table public.consultas
  drop constraint if exists consultas_peso_geo_faixa;
alter table public.consultas
  add constraint consultas_peso_geo_faixa
  check (peso_geo is null or (peso_geo >= 0 and peso_geo <= 1));
