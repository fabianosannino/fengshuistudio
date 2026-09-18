# ADR 0060 — leituras originais e dispersão da fachada

Data: 18/09/2026. Estado: aceito para implementação; publicação no roadmap.

## Problema

O assistente de três leituras descartava as amostras depois de aplicar a média.
Ao reabrir uma planta era impossível conferir os números originais. Campos HTML
não impediam o handler de aceitar valores fora da faixa e uma resultante circular
nula podia produzir uma direção arbitrária por ruído de ponto flutuante.

## Decisão

`bagua_entrada.orientacao_medicao` conserva três valores originais, referência de
Norte, instante de registro e conversão opcional. Campos do assistente são rascunho
até **Usar esta média**. A referência dessas amostras é explícita e independente
da referência atual, evitando relabelar como verdadeiro um conjunto magnético
restaurado depois de uma conversão. Toda aplicação/conversão exige reconfirmação.

Nova leitura manual/sensor/mapa ou mudança manual de referência remove a
associação aos originais anteriores. Converter entre referências preserva os
originais e calcula desde sua referência, sem acumular arredondamentos nem
reinterpretar a conversão salva quando o campo de declinação é editado depois.

`medicao-fachada.ts` valida exatamente três números finitos em [0,360). A média
usa a aritmética circular existente. Norma da resultante média ≤ 1e-12 recusa
direção indefinida (ex.: 0/120/240); esse epsilon é numérico, não um limite de
precisão instrumental. A direção aplicada mantém uma casa decimal e o resumo
avisa se isso cruza uma faixa de classificação.

A dispersão exibida é a maior distância angular de uma amostra até a média,
não desvio-padrão, intervalo de confiança ou precisão do instrumento. O aviso
acima de 3° é um limiar operacional de repetição, já usado pelo assistente, sem
pretensão de norma de escola. Cruzamentos entre setores de 45° e Montanhas de
15° são derivados das amostras na referência adotada, usando a tabela existente;
não implementam Kong Wang nem tornam Fei Xing uma carta clássica completa.

O resumo aparece na configuração, no histórico e na seção Ba Guá do relatório.
Registros antigos sem amostras conservam a média e declaram a lacuna. Nenhuma
amostra é fabricada e nenhum histórico/PDF é regravado.

## Persistência, versões e limites

Campo JSON opcional, sem migration ou novo upload. Rascunho e finalização
conservam os dados; fonte de análise/PDF e exportação já incluem `bagua_entrada`.
Ownership, exclusão e RLS permanecem os da consulta/snapshot. Não acrescenta
coordenadas GPS, identificadores de dispositivo ou dados pessoais novos.

Entrada de relatório passa a 6 e template a 2.7.0. Motor de análise permanece
`fengshui-2026.09-historico-1`: os adaptadores de resultado não mudaram para os
mesmos dados confirmados. Fontes antigas continuam renderizáveis com o campo
opcional. O relatório de uma versão conserva sua fonte e resultados base; a
sobreposição anual e o plano de ação usam a referência temporal da nova emissão,
agora explicada no banner. Um PDF já emitido continua sendo o documento imutável.

Ainda faltam incerteza do instrumento, calibração/condições de campo, originais
dos sensores/mapa, vetores de domínio independentes e piloto físico. Cenários
D2-ORI-01–07 não encerram D2 nem A–C.

## Referências e validação

- [SciPy: média circular](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.circmean.html): definição por vetor resultante e comportamento degenerado. A recusa explícita é decisão de engenharia deste produto.
- [NOAA: declinação magnética](https://www.ngdc.noaa.gov/geomag/declination.shtml): distinção de Norte, sinal e conversão. Reutiliza `declinacao-magnetica.ts`, sem introduzir coeficientes geofísicos.
- D2-ORI-01–07 no catálogo de cenários: valores analíticos, inválidos, fronteiras,
  conversão reversível, legado, página real com I/O simulado, snapshot e relatório.
  jsdom não comprova precisão física, disposição visual ou rasterização de PDF.
