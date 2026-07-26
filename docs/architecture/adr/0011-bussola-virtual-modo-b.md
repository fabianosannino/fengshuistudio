# ADR 0011 — Bússola virtual (Modo B): reversão deliberada de uma decisão anterior

- **Status:** Aceito
- **Data:** 2026-07-26

## Contexto

`docs/domain/fengshui-metodos-referencia.md` §2.3 documenta o Modo B de
captura de orientação (bússola virtual via magnetômetro do dispositivo,
`DeviceOrientationEvent`) e registrava explicitamente uma decisão de
produto anterior de **não** implementá-lo no MVP:

> ⚪ Decisão de produto já tomada, de propósito, na direção oposta. No PR
> que introduziu a Bússola, optei deliberadamente por não usar o sensor
> do dispositivo no MVP — justamente pelo comportamento inconsistente
> entre navegadores/iOS que este documento também aponta.

Essa razão continua tecnicamente verdadeira: `webkitCompassHeading` é uma
API não-padrão exclusiva do iOS Safari; a maioria dos outros navegadores
só expõe `alpha` (que só vale como heading de bússola quando
`event.absolute === true` — caso contrário é orientação relativa ao ponto
de partida do aparelho, não ao Norte); iOS 13+ exige `requestPermission()`
disparado por gesto do usuário; e não há nenhuma API padrão e amplamente
suportada para medir a magnitude do campo magnético (que serviria para
detectar interferência).

Diante da diretriz explícita do usuário de tornar essa peça funcional
mesmo assim, apresentei essa tensão de volta antes de implementar (a
decisão anterior era deliberada, não uma pendência esquecida) — a resposta
foi prosseguir com as salvaguardas completas descritas no documento.

## Decisão

Implementado com o fluxo completo do §2.3, dividido em duas camadas:

1. **`src/lib/bussola-dispositivo.ts`** (puro, sem DOM): recebe um array
   de amostras brutas em graus e devolve média/desvio circular (via
   `mediaCircular`/`desvioCircular`, `graus.ts`) após rejeitar outliers.
   Rejeição de outlier usa **MAD com z-score modificado** (Iglewicz &
   Hoaglin, `z = 0.6745·|d−mediana|/MAD`, limiar 3.5) aplicado às
   **distâncias circulares** de cada amostra até a média do conjunto —
   nunca ao valor bruto em graus, para não ter problema nenhum na
   descontinuidade 359°/0°. Caso especial documentado: quando MAD=0 (mais
   de metade das amostras exatamente no valor mediano — comum na prática,
   sensores repetem o mesmo grau por throttling), qualquer amostra que
   desvie desse valor exato é tratada como outlier, em vez de "não há
   outlier a rejeitar" (dividir por MAD=0 daria infinito). Um teste pegou
   esse caso antes de mesclar: com um cluster apertado + 1 outlier
   evidente, a primeira versão não rejeitava nada porque o MAD do cluster
   era zero.
   Classificação de confiança igual à do documento: desvio ≤2° alta,
   2–5° média, >5° baixa.
2. **`app/components/BussolaDispositivo.tsx`** (componente de UI,
   client-only): fluxo completo — detecção de suporte, permissão iOS
   (`requestPermission()` atrás de um clique real do usuário), animação/
   texto de calibração (3s), amostragem por 5s coletando todo evento
   `deviceorientation` que exponha uma leitura absoluta confiável, rosa
   dos ventos com anel das 24 Montanhas e agulha ao vivo, e bloqueio
   explícito do botão "Usar esta leitura" quando a confiança é baixa
   (sugerindo o assistente de 3 leituras ou um Luo Pan físico em vez
   disso). Aviso permanente de que é uma aproximação, não equivalente a
   um instrumento físico.

**A salvaguarda mais importante não está no documento original, mas foi
adicionada aqui por ser a forma mais honesta de lidar com a inconsistência
entre navegadores**: se, ao final da janela de amostragem, **nenhuma**
amostra tiver `webkitCompassHeading` (iOS) ou (`absolute === true` e
`alpha` numérico) (Android/outros), o componente se recusa a apresentar
qualquer heading — mesmo que `alpha` relativo tenha chegado. Um heading
relativo apresentado como se fosse Norte seria **pior** que não
implementar o Modo B: pareceria uma leitura de bússola válida e não é.
Estado explícito `sem-heading-absoluto` cobre esse caso, orientando para
entrada manual ou outro aparelho/navegador.

**Escopo explicitamente excluído, não esquecido:** detecção de
interferência magnética por magnitude do campo (µT, faixa esperada
22–45 µT no documento). Exigiria a Generic Sensor API `Magnetometer`, com
suporte de navegador raro e inconsistente (basicamente só Chrome/Android
atrás de uma Permissions-Policy dedicada; ausente em Safari e Firefox) —
implementar hoje seria uma feature que não funciona na maioria dos
aparelhos reais dos usuários.

## Consequências

- A UI de bagua-planta ganha um segundo painel retrátil (ao lado do
  assistente de 3 leituras já existente) dentro do modo Bússola —
  nenhuma mudança de schema: o resultado aceito vira `orientacaoGraus`,
  o mesmo campo que a entrada manual e o assistente de 3 leituras já
  escrevem.
- Testado com Playwright disparando eventos `deviceorientation`
  sintéticos (Chromium não tem magnetômetro real, mas o construtor padrão
  do evento é suficiente para simular `alpha`/`absolute`) contra uma
  página de teste temporária — cobrindo leitura de alta confiança,
  confiança baixa (bloqueio confirmado: botão "Usar esta leitura" ausente
  do DOM) e ausência total de heading absoluto (mensagem de recusa
  explícita, não uma leitura inventada).
- Bug real pego durante essa verificação visual (não relacionado à
  matemática): os rótulos N/E/S/W do componente ficavam cortados na borda
  do `viewBox` do SVG (posicionados exatamente no raio que coincide com a
  borda de um viewBox 0–200); corrigido com uma margem de 12 unidades.
- Continua fora de escopo: Modo C (mapa/satélite, §2.4) — depende de
  escolher um provedor de tiles de mapa e obter credenciais, uma decisão
  de custo/negócio levantada separadamente com o usuário, não resolvida
  nesta ADR.
