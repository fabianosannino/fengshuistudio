import type { BaguaEntrada } from './types'
import type { Ponto } from './poligono'
import { calcularGridOrder } from './bagua-grid'
import { grausConfirmados } from './orientacao'
import { calcularMingGua } from './ming-gua'
import { setoresFavoraveis } from './posicionamento-mobiliario'
import { avisoAnoSolar, avaliarAnoSolar } from './ano-solar'
import { converterLeitura } from './declinacao-magnetica'
import { normalizarGraus } from './graus'
import type { Setor } from './trigramas'

export const NOMES_SETORES = ['Prosperidade', 'Fama/Reputação', 'Relacionamentos', 'Família', 'Centro/Saúde', 'Criatividade', 'Espiritualidade', 'Carreira', 'Pessoas Úteis'] as const
export const MAX_MOBILIARIO = 150
export interface ItemMobiliario {
  id: string; setor: number; ambiente: string; tipo: 'cama' | 'fogao' | 'mesa' | 'outro'; descricao: string
  pessoa: string; nascimento: string | null; sexo: 'masculino' | 'feminino' | null
  direcao: number | null; referencia: 'magnetico' | 'verdadeiro' | null; origem: 'manual' | 'planta'
  posicao: Ponto | null
}
export interface CadastroMobiliario { versao: 1; revisao: number; referencia_planta: string; itens: ItemMobiliario[] }
export function cadastroVazio(): CadastroMobiliario { return { versao: 1, revisao: 0, referencia_planta: '', itens: [] } }
export function novoMobiliario(): ItemMobiliario {
  return { id: crypto.randomUUID(), setor: 1, ambiente: '', tipo: 'mesa', descricao: '', pessoa: '', nascimento: null, sexo: null, direcao: null, referencia: null, origem: 'manual', posicao: null }
}
export function nomesDosQuadrantes(b: BaguaEntrada): string[] {
  const order = calcularGridOrder(b.escola ?? 'btb', { lado: b.lado, orientacaoGraus: grausConfirmados(b) })
  return Array.from({ length: 9 }, (_, i) => `${i + 1} · ${order ? NOMES_SETORES[order[i]] : 'orientação pendente'}`)
}
export function setorDoPonto(p: Ponto, be: BaguaEntrada): number | null {
  const b = be.bordas
  if (!b || b.w <= 0 || b.h <= 0 || p.x < b.x || p.y < b.y || p.x > b.x + b.w || p.y > b.y + b.h) return null
  const lv = be.lv ?? [1 / 3, 2 / 3], lh = be.lh ?? [1 / 3, 2 / 3]
  const x = (p.x - b.x) / b.w, y = (p.y - b.y) / b.h
  return (y < lh[0] ? 0 : y < lh[1] ? 1 : 2) * 3 + (x < lv[0] ? 0 : x < lv[1] ? 1 : 2) + 1
}
/** Fachada medida corresponde à base da planta, como na grade já existente. */
export function direcaoNaPlanta(inicio: Ponto, fim: Ponto, be: BaguaEntrada): number | null {
  const facing = grausConfirmados(be)
  if (facing === null || Math.hypot(fim.x - inicio.x, fim.y - inicio.y) < 2) return null
  return Math.round(normalizarGraus(Math.atan2(fim.x - inicio.x, inicio.y - fim.y) * 180 / Math.PI + facing - 180) * 10) / 10 % 360
}
export function fimDaSeta(m: ItemMobiliario, be: BaguaEntrada, comprimento: number): Ponto | null {
  const facing = grausConfirmados(be)
  if (!m.posicao || facing === null || m.direcao === null || !m.referencia || (be.orientacao_referencia !== 'magnetico' && be.orientacao_referencia !== 'verdadeiro')) return null
  const l = converterLeitura({ graus: m.direcao, referencia: m.referencia, declinacao: be.declinacao_magnetica ?? null }, be.orientacao_referencia)
  if (!l) return null
  const rad = (l.graus - facing + 180) * Math.PI / 180
  return { x: m.posicao.x + comprimento * Math.sin(rad), y: m.posicao.y - comprimento * Math.cos(rad) }
}
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function validarItensMobiliario(v: unknown, hoje = new Date().toISOString().slice(0, 10)): v is ItemMobiliario[] {
  if (!Array.isArray(v) || v.length > MAX_MOBILIARIO) return false
  const ids = new Set<string>()
  return v.every(m => {
    if (!objeto(m) || Object.keys(m).some(k => !['id', 'setor', 'ambiente', 'tipo', 'descricao', 'pessoa', 'nascimento', 'sexo', 'direcao', 'referencia', 'origem', 'posicao'].includes(k))) return false
    if (typeof m.id !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(m.id) || ids.has(m.id)) return false
    ids.add(m.id)
    if (!Number.isInteger(m.setor) || Number(m.setor) < 1 || Number(m.setor) > 9) return false
    if (!['cama', 'fogao', 'mesa', 'outro'].includes(String(m.tipo))) return false
    if (typeof m.ambiente !== 'string' || !m.ambiente.trim() || m.ambiente.length > 100) return false
    if (typeof m.descricao !== 'string' || m.descricao.length > 100 || typeof m.pessoa !== 'string' || m.pessoa.length > 80) return false
    if (m.nascimento !== null && (typeof m.nascimento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(m.nascimento) || m.nascimento > hoje || avaliarAnoSolar(m.nascimento).estado === 'invalido')) return false
    if (![null, 'masculino', 'feminino'].includes(m.sexo as string | null) || ![null, 'magnetico', 'verdadeiro'].includes(m.referencia as string | null)) return false
    if (m.direcao !== null && (typeof m.direcao !== 'number' || !Number.isFinite(m.direcao) || m.direcao < 0 || m.direcao >= 360)) return false
    if (m.origem !== 'manual' && m.origem !== 'planta') return false
    if (m.posicao !== null && (!objeto(m.posicao) || Object.keys(m.posicao).length !== 2 || !['x', 'y'].every(c => typeof (m.posicao as Record<string, unknown>)[c] === 'number' && Number.isFinite((m.posicao as Record<string, unknown>)[c]) && Number((m.posicao as Record<string, unknown>)[c]) >= 0 && Number((m.posicao as Record<string, unknown>)[c]) <= 100_000))) return false
    return true
  })
}
/** Não deduz Norte dos nomes BTB e não aplica classificação de fogão a camas/mesas. */
export function leituraMobiliario(m: ItemMobiliario, be: BaguaEntrada): string {
  if (!m.nascimento || !m.sexo) return 'Sem avaliação pessoal: informe data completa de nascimento e parâmetro sexual da fórmula.'
  const aviso = avisoAnoSolar(m.nascimento)
  if (aviso) return aviso
  const gua = calcularMingGua(m.nascimento, m.sexo)
  if (!gua) return 'Ming Gua indeterminado para os dados informados.'
  if (m.direcao === null || !m.referencia) return `Ming Gua ${gua.kua}. Informe a direção e sua referência de Norte.`
  const leitura = converterLeitura({ graus: m.direcao, referencia: m.referencia, declinacao: be.declinacao_magnetica ?? null }, 'magnetico')
  if (!leitura) return `Ming Gua ${gua.kua}. Informe a declinação para converter Norte verdadeiro em magnético.`
  const direcao = (['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as Setor[])[Math.round(leitura.graus / 45) % 8]
  return `Ming Gua ${gua.kua} · direção ${direcao} ${setoresFavoraveis(gua.direcoes).has(direcao) ? 'favorável' : 'desfavorável'} nesta variante. A posição física e as condições do ambiente precisam de avaliação separada.`
}
