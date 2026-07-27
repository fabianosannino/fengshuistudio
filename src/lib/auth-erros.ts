import { logger } from './logger'

/**
 * Classificação das falhas do Supabase Auth para a tela de login.
 *
 * O problema que isto resolve: a tela colapsava *qualquer* erro de
 * `signInWithPassword` em «E-mail ou senha incorretos». Falha de rede, chave de
 * API inválida e 401 do gateway apareciam todos como senha errada — o que manda
 * o usuário (e quem investiga) procurar no lugar errado. Uma indisponibilidade
 * de serviço chegou a ser diagnosticada como credencial durante horas por causa
 * disso.
 *
 * A regra da casa continua valendo: a mensagem que chega à tela é **genérica**,
 * o detalhe vai para o `logger`. Genérico, porém, não precisa ser enganoso —
 * «não foi possível conectar» e «senha incorreta» são ambos genéricos, e só um
 * deles é verdade em cada caso.
 */

export type CausaFalhaAuth =
  | 'credenciais-invalidas'
  | 'email-nao-confirmado'
  | 'rede-indisponivel'
  | 'servico-indisponivel'
  | 'limite-de-tentativas'
  | 'conta-ja-existe'
  | 'senha-fraca'
  | 'desconhecida'

export const MENSAGEM_POR_CAUSA: Record<CausaFalhaAuth, string> = {
  'credenciais-invalidas':
    'E-mail ou senha incorretos. Tente novamente.',
  'email-nao-confirmado':
    'Confirme seu e-mail antes de entrar. Veja a caixa de entrada e o spam.',
  'rede-indisponivel':
    'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  'servico-indisponivel':
    'O serviço de autenticação está indisponível no momento. Tente novamente em instantes.',
  'limite-de-tentativas':
    'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.',
  'conta-ja-existe':
    'Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.',
  'senha-fraca':
    'Senha muito fraca. Use ao menos 8 caracteres, combinando letras e números.',
  'desconhecida':
    'Não foi possível concluir a operação. Tente novamente em instantes.',
}

export interface FalhaAuth {
  causa: CausaFalhaAuth
  /** Vai para a tela. Sempre de `MENSAGEM_POR_CAUSA`, nunca da lib. */
  mensagem: string
  /** Vai para o `logger`. Nunca chega à tela. */
  detalhe: string
}

/** Falha de transporte: o request nem chegou ao servidor de auth. */
const NOME_ERRO_REDE = 'AuthRetryableFetchError'
const PADRAO_REDE = /failed to fetch|networkerror|network request failed|load failed|err_[a-z_]+|fetch failed/i
/** 401/403 por chave/JWT — é configuração do deploy, não credencial do usuário. */
const PADRAO_CHAVE = /api ?key|apikey|jwt|no api key|invalid claim/i
const PADRAO_CREDENCIAL = /invalid login credentials|invalid_credentials|invalid grant/i
const PADRAO_NAO_CONFIRMADO = /email[ _]not[ _]confirmed|not confirmed|confirm your email/i
const PADRAO_JA_EXISTE = /already registered|already exists|user_already_exists|duplicate/i
const PADRAO_SENHA_FRACA = /weak[ _]password|password should be|at least \d+ characters/i

interface ErroBruto {
  name: string
  message: string
  code: string
  status: number | null
}

function normalizar(erro: unknown): ErroBruto {
  const e = (erro ?? {}) as Record<string, unknown>
  const status = typeof e.status === 'number' ? e.status : null
  return {
    name: typeof e.name === 'string' ? e.name : '',
    message: typeof e.message === 'string' ? e.message : String(erro ?? ''),
    code: typeof e.code === 'string' ? e.code : '',
    status,
  }
}

/**
 * Traduz um erro do Supabase Auth em causa + mensagem para a tela.
 *
 * A ordem das checagens importa: rede primeiro, porque um erro de transporte
 * não tem `status` confiável e cairia no ramo genérico; chave antes de
 * credencial, porque um 401 de apikey não é senha errada.
 */
export function classificarErroAuth(erro: unknown): FalhaAuth {
  const { name, message, code, status } = normalizar(erro)
  const texto = `${code} ${message}`
  const detalhe = [name, status !== null ? `status=${status}` : '', code, message]
    .filter(Boolean).join(' ')

  const causa = ((): CausaFalhaAuth => {
    if (name === NOME_ERRO_REDE || PADRAO_REDE.test(texto)) return 'rede-indisponivel'
    // 401/403 aqui nunca é senha errada — o Supabase devolve 400 para isso.
    // É chave de API, JWT ou gateway: problema de deploy, não do usuário.
    if (status === 401 || status === 403 || PADRAO_CHAVE.test(texto)) return 'servico-indisponivel'
    if (status !== null && status >= 500) return 'servico-indisponivel'
    if (status === 429 || /rate limit|too many/i.test(texto)) return 'limite-de-tentativas'
    if (PADRAO_NAO_CONFIRMADO.test(texto)) return 'email-nao-confirmado'
    if (PADRAO_CREDENCIAL.test(texto)) return 'credenciais-invalidas'
    if (PADRAO_JA_EXISTE.test(texto)) return 'conta-ja-existe'
    if (PADRAO_SENHA_FRACA.test(texto)) return 'senha-fraca'
    return 'desconhecida'
  })()

  return { causa, mensagem: MENSAGEM_POR_CAUSA[causa], detalhe }
}

/**
 * Classifica **e registra**. Preferir esta às telas: assim é impossível mostrar
 * a mensagem sem deixar o detalhe no log.
 */
export function falhaAuth(erro: unknown, acao: string): FalhaAuth {
  const falha = classificarErroAuth(erro)
  logger.error('Falha no fluxo de autenticação', {
    action: acao,
    causa: falha.causa,
    detalhe: falha.detalhe,
  })
  return falha
}
