/**
 * A guarda do painel admin — uma só, no servidor.
 *
 * ## O que ela substitui
 *
 * Antes desta função a checagem estava copiada em nove rotas, em três formatos
 * diferentes: umas devolviam `{ user, profile }`, outras só o `user`, outras um
 * booleano. Nenhuma conferia segundo fator, porque não havia segundo fator a
 * conferir.
 *
 * Nove cópias de uma regra de autorização não são nove chances de acertar: são
 * nove lugares onde a décima rota vai esquecer, e o esquecimento **não quebra
 * nada** — a rota funciona, só que para todo mundo. É a mesma forma do defeito
 * que `papeis.ts` da Veridia descreve: «o modo de falha de um sistema de planos
 * não é não deixar entrar; é deixar entrar quem não devia, e esse falha em
 * silêncio».
 *
 * ## Por que a resposta é um tipo somado e não um `null`
 *
 * Porque «não está logado», «não é admin» e «é admin e ainda não confirmou o
 * código» pedem respostas diferentes: 401, 403 genérico e 403 com código para o
 * cliente saber levar à verificação. Um `null` para os três forçaria cada rota a
 * reinventar a distinção — e a errá-la de formas distintas.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { logger } from './logger'
import type { Profile } from './types'
import {
  decidirAcesso, mfaExigido, CODIGO_MFA_PENDENTE,
  VARIAVEL_DO_INTERRUPTOR, type NiveisDaSessao,
} from './mfa-admin'
import { temCapacidade, type Capacidade } from './capacidades-admin'

/** O papel que abre o painel. Constante nomeada, não string solta. */
export const PAPEL_ADMIN = 'admin'

export type FalhaDaGuarda =
  | { motivo: 'nao_autenticado'; status: 401 }
  | { motivo: 'nao_admin'; status: 403 }
  | { motivo: 'mfa_pendente'; status: 403 }
  | { motivo: 'mfa_indeterminado'; status: 403 }
  | { motivo: 'sem_capacidade'; status: 403; capacidade: Capacidade }

export type ResultadoDaGuarda =
  | { ok: true; user: User; profile: Profile }
  | ({ ok: false } & FalhaDaGuarda)

/**
 * Lê os níveis de garantia da sessão.
 *
 * Isolado porque é a única parte que fala com o Supabase, e porque o modo de
 * falha dela é o que mais importa: quando a consulta erra, devolvemos `null`
 * nos dois campos, e `decidirAcesso` transforma isso em negativa. Engolir o
 * erro e assumir `aal1` daria a mesma tela de «cadastre seu fator» a quem já
 * tem um — e engolir e assumir `aal2` seria liberar por acidente.
 */
async function niveisDaSessao(supabase: SupabaseClient): Promise<NiveisDaSessao> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) {
      logger.warn('Não foi possível ler o nível de garantia da sessão', {
        erro: error?.message,
      })
      return { currentLevel: null, nextLevel: null }
    }
    return {
      currentLevel: data.currentLevel as NiveisDaSessao['currentLevel'],
      nextLevel: data.nextLevel as NiveisDaSessao['nextLevel'],
    }
  } catch (e) {
    logger.warn('Erro ao consultar MFA da sessão', {
      erro: e instanceof Error ? e.message : 'desconhecido',
    })
    return { currentLevel: null, nextLevel: null }
  }
}

/**
 * Autenticado + admin + segundo fator confirmado.
 *
 * As três perguntas na ordem em que ficam mais baratas: sessão primeiro (só
 * cookie), papel depois (uma consulta), fator por último (outra consulta) — e a
 * do fator só acontece para quem já provou ser admin, porque perguntar o nível
 * de garantia de um visitante qualquer é gasto sem resposta útil.
 */
export async function exigirAdmin(
  supabase: SupabaseClient
): Promise<ResultadoDaGuarda> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, motivo: 'nao_autenticado', status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== PAPEL_ADMIN) {
    return { ok: false, motivo: 'nao_admin', status: 403 }
  }

  const exigido = mfaExigido(process.env[VARIAVEL_DO_INTERRUPTOR])
  if (!exigido) {
    // Registrado toda vez, de propósito: um painel rodando sem segundo fator é
    // estado excepcional, e estado excepcional que não aparece no log vira
    // permanente sem ninguém decidir que ficasse.
    logger.warn('Painel admin acessado sem exigência de segundo fator', {
      variavel: VARIAVEL_DO_INTERRUPTOR,
    })
    return { ok: true, user, profile: profile as Profile }
  }

  const acesso = decidirAcesso(await niveisDaSessao(supabase), exigido)

  if (acesso === 'liberado') return { ok: true, user, profile: profile as Profile }
  if (acesso === 'indeterminado') {
    return { ok: false, motivo: 'mfa_indeterminado', status: 403 }
  }
  // `precisa_verificar` e `precisa_cadastrar` levam à mesma tela, que decide
  // qual dos dois mostrar consultando o próprio Supabase. A rota não precisa
  // saber a diferença — só que falta o fator.
  return { ok: false, motivo: 'mfa_pendente', status: 403 }
}

/**
 * Autenticado + admin + segundo fator + **a capacidade exigida**.
 *
 * É `exigirAdmin` mais uma pergunta, e a ordem importa: quem não é admin nem
 * chega a ser perguntado sobre capacidade, porque a resposta seria a mesma e a
 * distinção vazaria quem é admin e quem não é.
 *
 * ## Por que a rota declara a capacidade em vez de deduzi-la
 *
 * Porque deduzir do caminho (`/api/admin/chaves` → `chaves:*`) amarraria a
 * autorização à URL. Renomear a rota mudaria quem pode chamá-la, e o `git mv`
 * que fizesse isso não pareceria uma mudança de permissão para ninguém.
 */
export async function exigirCapacidade(
  supabase: SupabaseClient,
  capacidade: Capacidade
): Promise<ResultadoDaGuarda> {
  const guarda = await exigirAdmin(supabase)
  if (!guarda.ok) return guarda

  const capacidades = (guarda.profile as Profile & { capacidades_admin?: string[] })
    .capacidades_admin
  if (!temCapacidade(capacidades, capacidade)) {
    return { ok: false, motivo: 'sem_capacidade', status: 403, capacidade }
  }
  return guarda
}

/**
 * A falha virada resposta HTTP.
 *
 * O corpo é genérico para o cliente e específico só no código de máquina: o
 * texto não diz «você não é admin» nem «este usuário existe», porque a mensagem
 * de erro é um canal de vazamento tão bom quanto qualquer outro. O detalhe vai
 * para o `logger`.
 */
export function respostaDaGuarda(falha: FalhaDaGuarda, rota: string): NextResponse {
  logger.warn('Acesso ao admin recusado', {
    rota,
    motivo: falha.motivo,
    // A capacidade que faltou vai só para o log. Ela nomeia a estrutura interna
    // da autorização, e devolvê-la ao cliente entregaria o mapa do que existe a
    // quem já provou não poder usá-lo.
    ...(falha.motivo === 'sem_capacidade' ? { capacidade: falha.capacidade } : {}),
  })

  if (falha.motivo === 'nao_autenticado') {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (falha.motivo === 'mfa_pendente') {
    return NextResponse.json(
      { error: 'Verificação em duas etapas necessária', codigo: CODIGO_MFA_PENDENTE },
      { status: 403 }
    )
  }
  if (falha.motivo === 'mfa_indeterminado') {
    return NextResponse.json(
      { error: 'Não foi possível verificar o segundo fator. Tente novamente.' },
      { status: 403 }
    )
  }
  return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
}
