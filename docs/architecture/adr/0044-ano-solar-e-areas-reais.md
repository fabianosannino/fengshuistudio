# 0044 — ano solar e áreas reais dos setores

Status: implementado; 18/09/2026. Revisão independente de domínio pendente.

## Ano solar

O parser antigo aceitava datas impossíveis e adotava 4/fev para todos os anos.
A biblioteca MIT Astronomy Engine 2.1.19 foi fixada como dependência de
desenvolvimento. O gerador busca longitude eclíptica aparente de 315 graus e
grava instantes UTC para 1864–2100. Só essa tabela entra na aplicação; o CI
confere sua reprodução exata, sem consultar serviços nem enviar nascimento.

Strings civis exigem YYYY-MM-DD válido, incluindo a regra gregoriana de anos
bissextos. Timestamps exigem offset explícito. Date significa instante; não
usa o fuso da máquina. Um fuso IANA pode ser informado à função. Sem hora e
sem fuso, a data civil é um intervalo que abrange UTC+14 a UTC-12. Se o corte
estiver nesse intervalo, o resultado é indeterminado. Com fuso e sem hora,
o dia do corte também fica indeterminado; não se presume meia-noite.

Adota-se margem conservadora de 30 minutos em torno do instante calculado:
a biblioteca declara precisão angular de um minuto de arco, não um minuto
de tempo. A margem é uma decisão de engenharia, não uma certificação de
precisão. Quatro âncoras HKO (2015, 2016, 2025 e 2026), publicadas em UTC+08,
ficaram a menos de um minuto do resultado; isso não prova a mesma precisão
em todos os 237 anos. Fora da cobertura, não há fallback para 4/fev.

Ming Gua, período e estrela anual usam a mesma função. Avisos acompanham a
indeterminação no cliente, mobiliário e PDF. A UI ainda coleta nascimento
somente por data; persistir hora/fuso e a evidência da informação é trabalho
posterior. Não inferir hora/local a partir de endereço atual.

A estrela anual passa a um ciclo decrescente contínuo ancorado em 2026=1,
sem trocar a constante em 2000. Preserva 2024=3, 2025=2, 2027=9 e corrige
1999=1/2000=9. Testes de invariantes não são revisão de escola nem evidência
empírica de eficácia das interpretações.

## Geometria

Cada célula usa a área efetiva entre as próprias divisórias. Uma falta de
60×100 numa célula de 60×100 representa 100%, mesmo que a área média seja
10.000. Marcações de cada tipo são unidas por varredura de intervalos: áreas
sobrepostas contam uma vez. O excesso é a união fora do contorno, repartida
pela extensão das faixas da borda; não se renormalizam pesos de uma janela
artificialmente limitada. Isso é um modelo de retângulos alinhados aos eixos,
não um motor de cômodos/polígonos semânticos.

Contorno e marcações precisam ter dimensões positivas finitas, e as duas
divisórias de cada eixo devem ser estritamente crescentes dentro de (0,1).
Até 500 marcações são aceitas por cálculo. Percentual de excesso pode passar
de 100%; a nota resultante permanece entre 0 e 100. A tela informa entrada
inválida e exige recálculo antes de finalizar geometria alterada.

Há casos de interseção, sobreposição, vazio em L com oráculo independente de
células unitárias, conservação de área externa, divisórias desiguais, escala,
translação, degeneração e limites numéricos. A geometria poligonal existente
não foi reescrita; sua validação ampliada pertence à etapa E.

## Histórico e implantação

Motor `fengshui-2026.09-c1c2`, template `relatorio-2.2.0` e análise
`bagua-3.0.0`. Referências antigas ficam desatualizadas; plantas BTB legadas
com geometria também precisam ser revistas para nova emissão dependente.
Não se reemite nem sobrescreve PDF, entrada ou score de produção em massa.
Sem nova migration de banco. Reversão deve suspender novas emissões afetadas,
preservando PDFs; não reativar resultados sabidamente incorretos.

Fontes primárias:

- [HKO — termos solares](https://www.hko.gov.hk/en/gts/time/24solarterms.htm).
- [HKO 2015](https://www.hko.gov.hk/en/gts/astron2015/Solar_Term_2015.htm) e
  [2016](https://www.hko.gov.hk/en/gts/astron2016/Solar_Term_2016.htm).
- [HKO 2025](https://www.hko.gov.hk/en/gts/astron2025/files/HKO_almanac_2025.pdf) e
  [fevereiro de 2026](https://www.hko.gov.hk/en/gts/astron2026/files/2026cal02.pdf).
- [Astronomy Engine — licença, modelo e precisão](https://github.com/cosinekitty/astronomy).
