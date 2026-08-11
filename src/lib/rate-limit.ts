/**
 * Rate limit com store compartilhado (Upstash Redis) e degradação para memória.
 *
 * ## Por que não bastava o `Map`
 *
 * A versão anterior contava requisições num `Map` de módulo. Em serverless cada
 * instância tem o seu — e a plataforma cria quantas quiser. Um atacante com
 * `limit: 10` conseguia 10 tentativas *por instância*, o que na prática tornava
 * inócuo o limite que protege a força bruta de chave de ativação (achado A4/A5
 * da auditoria de 2026-07-18).
 *
 * Com `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` no ambiente, o
 * contador passa a ser único para toda a frota. Sem eles — ou se o Redis estiver
 * fora do ar — o limitador **não some**: ele volta ao contador em memória e
 * `compartilhado: false` diz que a garantia está degradada, em vez de fingir que
 * o limite vale globalmente.
 */

import { logger } from './logger'

export interface OpcoesRateLimit {
  limit?: number
  windowMs?: number
}

export interface ResultadoRateLimit {
  success: boolean
  remaining: number
  /** `false` quando a contagem é local à instância (sem Redis ou com Redis fora). */
  compartilhado: boolean
}

const LIMITE_PADRAO = 30
const JANELA_PADRAO_MS = 60_000

// ── Derivação do IP ───────────────────────────────────────────────────────────

/**
 * IP do cliente, na medida em que dá para confiar nele.
 *
 * A versão anterior usava `x-forwarded-for.split(',')[0]` — a ponta **esquerda**
 * da cadeia, que é justamente a que o cliente controla: basta mandar o header
 * pronto para receber uma cota nova a cada requisição.
 *
 * Aqui a ordem é: headers que a plataforma **sobrescreve** (`x-real-ip`,
 * `cf-connecting-ip`) e, como último recurso, a ponta **direita** do
 * `x-forwarded-for` — a entrada anexada pelo proxy mais próximo, a única que um
 * cliente não consegue forjar.
 *
 * **Premissa:** exatamente um proxy confiável na frente (Vercel). Com mais de um,
 * a posição a ler muda e este helper precisa mudar junto.
 */
export function ipDaRequisicao(request: Request): string {
  const headers = request.headers

  const real = headers.get('x-real-ip')?.trim()
  if (real) return real

  const cloudflare = headers.get('cf-connecting-ip')?.trim()
  if (cloudflare) return cloudflare

  const cadeia = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map(parte => parte.trim())
    .filter(Boolean)

  return cadeia.length > 0 ? cadeia[cadeia.length - 1] : 'desconhecido'
}

// ── Store em memória (fallback) ───────────────────────────────────────────────

interface EntradaMemoria {
  count: number
  resetAt: number
}

const memoria = new Map<string, EntradaMemoria>()
let proximaLimpeza = 0

/**
 * Limpeza sob demanda em vez de `setInterval`: um timer de módulo continua vivo
 * enquanto a instância existir, roda em processos que nunca chamam o limitador e
 * atrapalha teste com fake timers.
 */
function limparExpirados(agora: number) {
  if (agora < proximaLimpeza) return
  proximaLimpeza = agora + 60_000
  for (const [chave, entrada] of memoria) {
    if (agora > entrada.resetAt) memoria.delete(chave)
  }
}

function contarNaMemoria(chave: string, limite: number, janelaMs: number): ResultadoRateLimit {
  const agora = Date.now()
  limparExpirados(agora)

  const entrada = memoria.get(chave)
  if (!entrada || agora > entrada.resetAt) {
    memoria.set(chave, { count: 1, resetAt: agora + janelaMs })
    return { success: true, remaining: limite - 1, compartilhado: false }
  }

  entrada.count++
  if (entrada.count > limite) {
    return { success: false, remaining: 0, compartilhado: false }
  }
  return { success: true, remaining: limite - entrada.count, compartilhado: false }
}

// ── Store compartilhado (Upstash REST) ────────────────────────────────────────

function configuracaoRedis(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

let avisouSemStoreCompartilhado = false

function avisarSeProducaoSemRedis() {
  if (avisouSemStoreCompartilhado) return
  avisouSemStoreCompartilhado = true
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Rate limit sem store compartilhado — a contagem é por instância', {
      route: 'rate-limit',
      action: 'sem-upstash',
    })
  }
}

/**
 * `INCR` + `EXPIRE ... NX` num pipeline: o primeiro conta, o segundo fixa a
 * janela só na criação da chave, para que ela não seja empurrada para frente a
 * cada requisição (isso transformaria a janela fixa numa janela infinita).
 *
 * Devolve `null` em qualquer falha — quem chama cai para a memória.
 */
async function contarNoRedis(
  chave: string,
  janelaMs: number,
  config: { url: string; token: string }
): Promise<number | null> {
  const janelaSegundos = Math.max(1, Math.ceil(janelaMs / 1000))

  try {
    const resposta = await fetch(`${config.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', chave],
        ['EXPIRE', chave, String(janelaSegundos), 'NX'],
      ]),
      signal: AbortSignal.timeout(1_500),
      cache: 'no-store',
    })

    if (!resposta.ok) {
      logger.warn('Rate limit: Redis respondeu erro', {
        route: 'rate-limit', action: 'incr', status: resposta.status,
      })
      return null
    }

    const corpo = (await resposta.json()) as Array<{ result?: unknown; error?: string }>
    const contagem = corpo?.[0]?.result
    return typeof contagem === 'number' ? contagem : null
  } catch (err) {
    // Timeout, DNS, rede: o limitador degrada, não derruba a rota.
    logger.warn('Rate limit: falha ao falar com o Redis', {
      route: 'rate-limit', action: 'incr', error: String(err),
    })
    return null
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Consome uma unidade da cota de `chave` (normalmente o IP do cliente).
 *
 * Passou a ser assíncrona porque o store compartilhado é remoto — todos os call
 * sites precisam de `await`.
 */
export async function rateLimit(
  chave: string,
  { limit = LIMITE_PADRAO, windowMs = JANELA_PADRAO_MS }: OpcoesRateLimit = {}
): Promise<ResultadoRateLimit> {
  const config = configuracaoRedis()

  if (!config) {
    avisarSeProducaoSemRedis()
    return contarNaMemoria(chave, limit, windowMs)
  }

  const contagem = await contarNoRedis(`ratelimit:${chave}:${windowMs}`, windowMs, config)
  if (contagem === null) {
    return contarNaMemoria(chave, limit, windowMs)
  }

  if (contagem > limit) {
    return { success: false, remaining: 0, compartilhado: true }
  }
  return { success: true, remaining: limit - contagem, compartilhado: true }
}
