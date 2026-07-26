# ADR 0012 — Modo C de orientação: alinhamento sobre mapa/satélite (Google Maps)

- **Status:** Aceito
- **Data:** 2026-07-26

## Contexto

`docs/domain/fengshui-metodos-referencia.md` §2.4 descreve o Modo C de
captura de orientação — o usuário reconhece o próprio telhado numa imagem
de satélite e alinha a planta baixa sobre ela, em vez de tentar medir um
ângulo com bússola. O documento argumenta (com razão) que este é o modo de
maior impacto de UX para o usuário leigo, que não sabe medir mas sabe
reconhecer.

Diferente dos Modos A e B, este modo tem uma **dependência externa paga**:
precisa de um provedor de tiles de mapa/satélite e de credenciais. Isso é
uma decisão de custo/negócio, não de engenharia — foi levada ao usuário
antes de qualquer implementação. Escolha: **Google Maps Platform**
(melhor cobertura de satélite no Brasil, com custo por carregamento acima
da cota gratuita).

## Decisão

Implementado em três camadas, deliberadamente separadas pelo que é
testável sem a credencial externa:

1. **`src/lib/orientacao-mapa.ts`** (puro, testado): `calcularFacingVerdadeiro(aresta, rotacao)`.
   A conta é uma soma de ângulos e nada mais, porque duas convenções
   coincidem: `transform: rotate()` do CSS usa sentido horário para graus
   positivos (eixo Y cresce para baixo), igual à convenção de bússola; e o
   mapa é renderizado com `heading:0`/`tilt:0`, o que garante que "para
   cima" na tela é Norte verdadeiro (Web Mercator). Não há troca de
   sinal/eixo escondida.
2. **`app/components/OverlayAlinhamentoMapa.tsx`** (testado isoladamente):
   a camada da planta com mover (arrastar), rotacionar, escalar e
   opacidade. Desacoplado do Google Maps de propósito — mesmo padrão do
   `EditorPoligonoTaiJi` (ADR 0010): recebe só uma `imagemUrl` e um fundo
   qualquer, então dá para verificar toda a interação sem chave de API.
3. **`app/components/MapaAlinhamento.tsx`** (NÃO verificável aqui, ver
   abaixo): carrega o Maps JavaScript API, geocodifica o endereço (ou usa
   `navigator.geolocation`), monta o mapa em modo satélite e compõe a
   camada 2 por cima.

### Honestidade sobre o que foi e o que não foi verificado

A camada 3 **não pôde ser testada de ponta a ponta** neste ambiente: não
há chave real do Google Maps no sandbox (é credencial paga do usuário).
O que foi possível verificar, e foi:

- As camadas 1 e 2 completamente (matemática + interação real de
  arrastar/rotacionar/escalar via Playwright).
- Que a CSP da aplicação **não bloqueia** o script do Maps: injetei o
  mesmo `<script src="https://maps.googleapis.com/maps/api/js?...">` que
  o componente injeta, dentro de uma página real do app sob a CSP real, e
  confirmei que a requisição sai e que nenhuma violação de CSP é
  registrada.
- O caminho fail-closed: sem `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, o painel
  não tenta carregar nada e exibe um aviso orientando para os Modos A/B.

**Ainda é necessário verificar num deploy real com a chave configurada**
antes de confiar cegamente neste modo. Isso está registrado também no
comentário de cabeçalho do próprio componente, não só aqui.

### Dois bloqueios reais de configuração, encontrados e corrigidos

Ambos fariam o Modo C falhar silenciosamente em produção:

1. **CSP**: `script-src` e `connect-src` não incluíam
   `https://maps.googleapis.com` — o script seria recusado pelo navegador.
   Adicionados (mais `https://maps.gstatic.com` em `connect-src`).
   `img-src` já era permissivo (`https:`), então os tiles não eram
   problema.
2. **`Permissions-Policy: geolocation=()`** desabilitava geolocalização
   por completo — o botão "usar minha localização atual" nunca
   funcionaria. Alterado para `geolocation=(self)`: liberado apenas para
   a própria origem, com câmera e microfone seguindo totalmente
   bloqueados. Esta é uma mudança de header de segurança, feita
   conscientemente e com o escopo mínimo necessário para a feature pedida
   (relacionada à ADR 0004, sobre a CSP).

### Bug real encontrado durante a verificação

O arrasto da camada aplicava apenas ~1/8 do movimento do mouse. A causa
não era a matemática: o navegador iniciava o **drag-and-drop nativo da
imagem** (`<img>` é arrastável por padrão), o que dispara um
`pointercancel` e mata a sequência de ponteiro depois de ~2 eventos.
Diagnosticado contando os eventos reais que chegavam ao elemento (em vez
de chutar), e corrigido com `draggable={false}` + `setPointerCapture`
(necessário porque o próprio elemento se move junto com o cursor e
"escapa" de baixo dele). Depois da correção, um arrasto de 40px aplica
exatamente 40px, e arrastos sucessivos acumulam corretamente.

## Consequências

- **Sem a chave configurada, nada muda** para quem já usa o app: o painel
  do Modo C aparece com um aviso e os Modos A/B continuam sendo o
  caminho. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` foi documentada em
  `.env.example`, incluindo o aviso de **restringir a chave por domínio**
  (é uma chave pública, exposta ao navegador — restrição por HTTP
  referrer é a única proteção real contra uso indevido da cota paga).
- O resultado é entregue como Norte **VERDADEIRO** e rotulado como tal na
  UI, com aviso explícito de que a declinação magnética (~8–23° no
  Brasil) não é corrigida. Converter para magnético exigiria um modelo
  WMM/IGRF, que não existe em nenhum lugar do app ainda — mesmo gap já
  registrado para o Modo A, não uma regressão nova.
- A "pinça" (pinch) do documento foi implementada como slider de escala —
  simplificação desktop-first declarada, não uma lacuna silenciosa.
- **Fora de escopo, explicitamente:** os "ganhos extras" que o §2.4 lista
  para o diagnóstico de Formas (detecção automática de vias em T, curvas
  de rua, corpos d'água, prédios altos vizinhos, topografia, mapa de
  sombra/insolação). Cada um é análise de imagem/geoprocessamento por si
  só, não apenas UI de mapa — o catálogo de Sha externo continua não
  implementado, como o próprio documento já registra.
