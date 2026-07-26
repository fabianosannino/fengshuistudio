/**
 * Declinação magnética calculada a partir de lat/long/data, via **WMM oficial**.
 *
 * ─── POR QUE ISTO EXISTE AGORA (E NÃO EXISTIA ANTES) ─────────────────────
 *
 * A ADR 0014 recusou implementar WMM/IGRF, e a razão continua correta: a
 * tabela de ~90 coeficientes harmônicos de Gauss não podia ser reproduzida de
 * memória, porque **um coeficiente errado não falha de forma visível — devolve
 * um número plausível e errado**.
 *
 * O que mudou não foi o critério, foi a disponibilidade da fonte: o pacote
 * `geomagnetism` **embute os arquivos de coeficientes oficiais do NOAA/NGDC**
 * (`data/wmm-2025.json`, epoch 2025, derivado do `WMM.COF` publicado). Não
 * estamos digitando números — estamos usando a tabela oficial. É a diferença
 * entre citar uma fonte e chutar.
 *
 * Isto **não é conteúdo de Feng Shui** e não deve ser citado como tal: é
 * geofísica aplicada, pré-processamento do dado de entrada. Nenhuma obra de
 * Feng Shui traz (nem deveria trazer) coeficientes de campo geomagnético.
 *
 * ─── A ARMADILHA QUE ESTE MÓDULO FECHA: MODELO EXPIRADO ──────────────────
 *
 * Cada ciclo WMM vale ~5 anos (o vigente: 2024-11-13 a 2029-11-29). Fora da
 * janela, o campo real já divergiu do modelo. `geomagnetism` **lança** nesse
 * caso em vez de extrapolar — comportamento correto, e este wrapper o preserva
 * devolvendo `{ ok: false }` em vez de engolir a exceção.
 *
 * Consequência prática, e é de propósito: quando o WMM2025 expirar, o cálculo
 * automático **para de funcionar** e a entrada manual (ADR 0014) volta a ser o
 * caminho. Não degrada em silêncio. Para reativar, basta atualizar o pacote —
 * o `end_date` vem do próprio arquivo de dados, não está hardcoded aqui.
 */

import { declinacaoPlausivel } from './declinacao-magnetica'

/** Limites geográficos válidos, para barrar lat/long trocados ou lixo. */
export const LAT_MIN = -90
export const LAT_MAX = 90
export const LON_MIN = -180
export const LON_MAX = 180

/**
 * Latitudes onde o modelo perde utilidade prática: perto dos polos magnéticos
 * a declinação varia violentamente com poucos km e a bússola deixa de ser
 * instrumento confiável. Não é limite do WMM, é limite do *uso* — e nenhum
 * imóvel de consultoria está aqui.
 */
export const LAT_LIMITE_CONFIAVEL = 80

export type MotivoFalha =
  | 'coordenada-invalida'
  | 'latitude-extrema'
  | 'fora-da-validade-do-modelo'
  | 'resultado-implausivel'

export type ResultadoDeclinacao =
  | {
      ok: true
      /** Declinação em graus, positiva para Leste (convenção IGRF/WMM). */
      declinacao: number
      /** Nome do modelo usado, ex.: "WMM-2025". Vai para a UI: o consultor tem direito de saber. */
      modelo: string
      /** Fim da validade do modelo (ISO). Depois disso este cálculo passa a falhar. */
      validoAte: string
    }
  | { ok: false; motivo: MotivoFalha; detalhe?: string }

/**
 * Recorte do objeto devolvido por `geomagnetism.model()`. Os metadados ficam
 * NO próprio modelo (`m.name`, `m.end_date`), não num sub-objeto `m.model` —
 * o teste de proveniência pegou essa suposição errada, que fazia o nome e a
 * validade caírem num fallback vazio sem ninguém notar.
 *
 * `num_terms` é 90: é a contagem de coeficientes harmônicos que a ADR 0014
 * citou como motivo para não transcrever a tabela à mão.
 */
interface ModeloWMM {
  name: string
  /** A lib entrega Date, não string. */
  end_date: Date
  point: (p: [number, number]) => { decl: number }
}

/**
 * Calcula a declinação para um ponto e uma data.
 *
 * **Só no servidor.** `geomagnetism` é CommonJS e carrega ~4 arquivos JSON de
 * coeficientes; mandar isso para o bundle do cliente é peso morto. Use via
 * `/api/declinacao`.
 *
 * Fail-closed em todos os caminhos: qualquer dúvida devolve `ok: false` com
 * motivo, e quem chama cai na entrada manual. Nunca devolve zero como
 * "padrão" — assumir declinação zero é o erro que a ADR 0014 existe para
 * impedir (no Brasil, 1 a 2 Montanhas das 24).
 */
export function declinacaoAutomatica(
  lat: number,
  lon: number,
  data: Date,
): ResultadoDeclinacao {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)
    || lat < LAT_MIN || lat > LAT_MAX || lon < LON_MIN || lon > LON_MAX) {
    return { ok: false, motivo: 'coordenada-invalida' }
  }
  if (Math.abs(lat) > LAT_LIMITE_CONFIAVEL) {
    return { ok: false, motivo: 'latitude-extrema' }
  }

  let decl: number
  let modelo: ModeloWMM
  try {
    // require em vez de import: o pacote é CJS sem tipos, e o import estático
    // faria o bundler do Next tentar resolvê-lo no cliente.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const geomagnetism = require('geomagnetism') as { model: (d: Date) => ModeloWMM }
    modelo = geomagnetism.model(data)
    decl = modelo.point([lat, lon]).decl
  } catch (err) {
    // A lib lança quando a data está fora da janela de validade do ciclo WMM.
    // Não tratamos como erro interno: é o modelo dizendo "não sei", e a
    // resposta certa é cair para a entrada manual.
    return {
      ok: false,
      motivo: 'fora-da-validade-do-modelo',
      detalhe: err instanceof Error ? err.message : String(err),
    }
  }

  // Cinturão e suspensório: se o modelo devolvesse algo absurdo, não passamos
  // adiante. Usa o MESMO validador da entrada manual, para as duas portas
  // terem exatamente o mesmo critério de plausibilidade.
  if (!declinacaoPlausivel(decl)) {
    return { ok: false, motivo: 'resultado-implausivel', detalhe: String(decl) }
  }

  return {
    ok: true,
    // Uma casa decimal: o WMM tem incerteza declarada de ~0,4° na declinação,
    // então mais dígitos seriam precisão falsa. E 0,1° é 1/150 de uma Montanha.
    declinacao: Math.round(decl * 10) / 10,
    modelo: modelo.name,
    validoAte: modelo.end_date.toISOString(),
  }
}

/** Mensagem para o consultor, por motivo de falha. Sempre aponta a saída manual. */
export function explicarFalha(motivo: MotivoFalha): string {
  switch (motivo) {
    case 'coordenada-invalida':
      return 'Coordenadas inválidas. Informe a declinação manualmente.'
    case 'latitude-extrema':
      return 'Latitude polar: a bússola magnética não é confiável nessa região.'
    case 'fora-da-validade-do-modelo':
      return 'O modelo magnético embutido não cobre esta data (cada ciclo WMM vale ~5 anos). Informe a declinação manualmente.'
    case 'resultado-implausivel':
      return 'O modelo devolveu um valor fora da faixa esperada. Informe a declinação manualmente.'
  }
}
