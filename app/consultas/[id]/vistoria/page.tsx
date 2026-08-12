'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../src/lib/supabase'
import { logger } from '../../../../src/lib/logger'
import { redirecionarParaLogin } from '../../../../src/lib/auth-rotas'
import {
  normalizarChecklist, resumirChi, definirEstado, proximoEstado,
  type ChecklistChi,
} from '../../../../src/lib/fluxo-chi'
import { enfileirar, sincronizar, pendentesDaConsulta } from '../../../../src/lib/fila-offline'
import { CHECKLIST_CHI } from '../../../../src/lib/checklist-chi'
import { Check, X, CloudOff, RefreshCw, PenLine, ArrowLeft, Cloud } from 'lucide-react'

/**
 * Modo vistoria — o consultor andando pela casa, com o celular na mão.
 *
 * ## Por que uma tela separada
 *
 * A aba de Fluxo de Chi foi desenhada para a mesa: linhas de 8px de padding,
 * botões de 22px, três colunas. Dentro da casa do cliente, com uma mão
 * segurando o celular, nada disso funciona. Aqui cada ponto é um cartão de
 * 56px, o alvo tem 44px e a lista é uma coluna só.
 *
 * ## Offline
 *
 * A vistoria acontece no porão, no banheiro, no fundo do corredor — onde o
 * sinal cai. Toda marcação vai para `src/lib/fila-offline.ts` **antes** de
 * qualquer tentativa de rede, e a fila sobrevive a fechar o navegador. Quando o
 * sinal volta, sincroniza sozinha.
 *
 * **Foto não entra na fila.** Um blob de 3 MB por item encheria a cota de 5 MB
 * do `localStorage` na terceira foto, e falhar em gravar a fila é pior que não
 * ter fila — a tela diz que foto precisa de conexão, em vez de prometer.
 */

const ESTILO_ALVO: React.CSSProperties = {
  minHeight: '44px', minWidth: '44px', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
}

export default function Vistoria() {
  const params = useParams()
  const consultaId = params.id as string

  const [carregando, setCarregando] = useState(true)
  const [nomeImovel, setNomeImovel] = useState('')
  const [chi, setChi] = useState<ChecklistChi>({})
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [notaAberta, setNotaAberta] = useState<string | null>(null)
  const [pendentes, setPendentes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [avisoDeFila, setAvisoDeFila] = useState('')

  /** Envia uma entrada da fila. `true` = o servidor aceitou. */
  const enviarEntrada = useCallback(async (entrada: { chave: string; valor: unknown }) => {
    const campo = entrada.chave.split(':')[1]
    if (campo !== 'checklist_chi' && campo !== 'vistoria_notas') return true
    const { error } = await supabase
      .from('consultas')
      .update({ [campo]: entrada.valor })
      .eq('id', consultaId)
    if (error) {
      logger.warn('Marcação da vistoria segue na fila', {
        route: '/consultas/[id]/vistoria', consultaId, campo, error: error.message,
      })
      return false
    }
    return true
  }, [consultaId])

  const tentarSincronizar = useCallback(async () => {
    if (typeof window === 'undefined') return
    const fila = pendentesDaConsulta(window.localStorage, consultaId)
    if (fila.length === 0) { setPendentes(0); return }

    setSincronizando(true)
    const { falhas } = await sincronizar(window.localStorage, consultaId, enviarEntrada)
    setPendentes(falhas.length)
    setSincronizando(false)
  }, [consultaId, enviarEntrada])

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { redirecionarParaLogin(); return }

      const { data, error } = await supabase
        .from('consultas')
        .select('nome_imovel, checklist_chi, vistoria_notas')
        .eq('id', consultaId)
        .single()
      if (!ativo) return

      if (error || !data) {
        logger.error('Falha ao abrir a vistoria', {
          route: '/consultas/[id]/vistoria', consultaId, error: error?.message,
        })
        setCarregando(false)
        return
      }

      setNomeImovel(data.nome_imovel?.trim() || 'Imóvel')
      setChi(normalizarChecklist(data.checklist_chi))
      setNotas((data.vistoria_notas ?? {}) as Record<string, string>)
      setPendentes(pendentesDaConsulta(window.localStorage, consultaId).length)
      setCarregando(false)
      setTimeout(() => { void tentarSincronizar() }, 0)
    }
    void carregar()
    return () => { ativo = false }
  }, [consultaId, tentarSincronizar])

  // `useSyncExternalStore` em vez de estado + efeito: o estado da rede é uma
  // fonte externa, e lê-la para dentro de `useState` cria uma cópia que pode
  // divergir do navegador entre o render e o efeito.
  const online = useSyncExternalStore(
    (aoMudar) => {
      window.addEventListener('online', aoMudar)
      window.addEventListener('offline', aoMudar)
      return () => {
        window.removeEventListener('online', aoMudar)
        window.removeEventListener('offline', aoMudar)
      }
    },
    () => navigator.onLine,
    () => true, // no servidor não há rede para consultar; a tela assume online
  )

  // O evento é o gatilho: esperar o próximo toque para sincronizar deixaria a
  // fila cheia enquanto o consultor caminha por um cômodo com sinal.
  useEffect(() => {
    if (!online) return
    // Fora do commit: `tentarSincronizar` escreve estado antes do primeiro
    // `await`, e fazer isso dentro do efeito encadeia um render extra.
    const id = setTimeout(() => { void tentarSincronizar() }, 0)
    return () => clearTimeout(id)
  }, [online, tentarSincronizar])

  /** Grava na fila e, se der, manda na hora. A tela nunca espera pela rede. */
  function gravar(campo: 'checklist_chi' | 'vistoria_notas', valor: unknown) {
    const guardou = enfileirar(window.localStorage, `${consultaId}:${campo}`, valor)
    if (!guardou) {
      setAvisoDeFila('Não foi possível guardar no aparelho. Fique com sinal enquanto marca — sem isso, o que você marcar pode se perder.')
    } else {
      setAvisoDeFila('')
      setPendentes(pendentesDaConsulta(window.localStorage, consultaId).length)
    }
    if (navigator.onLine) void tentarSincronizar()
  }

  function marcar(itemId: string) {
    const novo = definirEstado(chi, itemId, proximoEstado(chi[itemId]))
    setChi(novo)
    gravar('checklist_chi', novo)
  }

  function anotar(itemId: string, texto: string) {
    const novo = { ...notas, [itemId]: texto }
    if (texto.trim() === '') delete novo[itemId]
    setNotas(novo)
    gravar('vistoria_notas', novo)
  }

  const resumo = resumirChi(chi, CHECKLIST_CHI.map(i => i.id))

  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', background: '#FBF9F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#2E7D6B', fontSize: '15px' }}>Carregando…</p>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#FBF9F4',
      fontFamily: 'var(--font-figtree), sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Cabeçalho ────────────────────────────────────────────────── */}
      <header style={{
        background: '#0E1B2C', padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <Link href={`/consultas/${consultaId}`} aria-label="Voltar à consulta" style={{ ...ESTILO_ALVO, color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeImovel}</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>Vistoria · Fluxo de Chi</p>
          </div>
        </div>

        {/* O estado da sincronização é informação, não decoração: é ele que
            diz se o trabalho da última meia hora está seguro. */}
        <span style={{
          background: online ? 'rgba(46,125,107,0.28)' : 'rgba(201,162,39,0.2)',
          color: online ? '#8FD8C4' : '#F0D888',
          fontSize: '11px', fontWeight: 700, padding: '5px 10px', borderRadius: '20px',
          display: 'flex', gap: '5px', alignItems: 'center', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {sincronizando
            ? <><RefreshCw size={13} strokeWidth={2} aria-hidden="true" />enviando</>
            : online
              ? <><Cloud size={13} strokeWidth={2} aria-hidden="true" />{pendentes > 0 ? `${pendentes} na fila` : 'salvo'}</>
              : <><CloudOff size={13} strokeWidth={2} aria-hidden="true" />offline</>}
        </span>
      </header>

      <div style={{ padding: '18px', flex: 1 }}>
        {avisoDeFila && (
          <div style={{
            background: '#FAEEE9', border: '1px solid #EBD3C7', color: '#B4533A',
            borderRadius: '10px', padding: '11px 14px', fontSize: '13px',
            marginBottom: '14px', lineHeight: 1.5,
          }}>{avisoDeFila}</div>
        )}

        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6B7280' }}>
          {resumo.texto} · toque para marcar
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {CHECKLIST_CHI.map(item => {
            const estado = chi[item.id]
            const nota = notas[item.id] ?? ''
            const aberta = notaAberta === item.id
            const visual = estado === 'conforme'
              ? { borda: '#DCEAE4', fundo: '#2E7D6B', Icone: Check }
              : estado === 'problema'
                ? { borda: '#EBD3C7', fundo: '#B4533A', Icone: X }
                : { borda: '#E7E1D6', fundo: null, Icone: null }

            return (
              <div key={item.id} style={{
                background: '#fff', border: `1px solid ${visual.borda}`, borderRadius: '12px',
                padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button type="button" onClick={() => marcar(item.id)}
                    aria-label={`${item.label} — ${estado ?? 'não visto'}. Toque para alternar.`}
                    style={{
                      ...ESTILO_ALVO, flexShrink: 0, padding: 0, border: 'none',
                      background: 'transparent', cursor: 'pointer',
                    }}>
                    <span style={{
                      width: '28px', height: '28px', borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      ...(visual.fundo
                        ? { background: visual.fundo }
                        : { border: '2px solid #D8D0C0' }),
                    }}>
                      {visual.Icone && <visual.Icone size={16} strokeWidth={2.5} color="#fff" aria-hidden="true" />}
                    </span>
                  </button>

                  <button type="button" onClick={() => marcar(item.id)} style={{
                    flex: 1, textAlign: 'left', background: 'none', border: 'none',
                    padding: 0, cursor: 'pointer', fontSize: '14px', color: '#0E1B2C',
                  }}>{item.label}</button>

                  {estado === undefined && (
                    <span style={{ fontSize: '12px', color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>não visto</span>
                  )}
                </div>

                {/* Nota por ponto: o detalhe que se perde entre a visita e o
                    relatório. Escrita, não gravada — áudio precisaria de bucket,
                    whitelist de MIME e decisão de LGPD sobre voz. */}
                {(aberta || nota) && (
                  <div style={{ paddingLeft: '56px' }}>
                    <textarea
                      value={nota}
                      onChange={e => anotar(item.id, e.target.value)}
                      placeholder="O que você observou aqui"
                      rows={2}
                      aria-label={`Nota sobre ${item.label}`}
                      style={{
                        width: '100%', padding: '10px 12px', border: '1px solid #E7E1D6',
                        borderRadius: '9px', fontSize: '14px', resize: 'vertical',
                        boxSizing: 'border-box', fontFamily: 'inherit',
                      }} />
                  </div>
                )}

                {!aberta && !nota && (
                  <div style={{ paddingLeft: '52px' }}>
                    <button type="button" onClick={() => setNotaAberta(item.id)} style={{
                      border: '1px solid #E7E1D6', borderRadius: '9px', padding: '9px 13px',
                      fontSize: '13px', fontWeight: 600, background: '#fff', color: '#0E1B2C',
                      display: 'flex', gap: '7px', alignItems: 'center', minHeight: '44px',
                      boxSizing: 'border-box', cursor: 'pointer',
                    }}>
                      <PenLine size={15} strokeWidth={1.75} aria-hidden="true" />Anotar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{
          background: '#F3EEE4', border: '1px solid #E7E1D6', borderRadius: '12px',
          padding: '14px', display: 'flex', gap: '11px', alignItems: 'flex-start',
        }}>
          <RefreshCw size={17} strokeWidth={1.75} color="#8A6E2F" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: '13px', color: '#4A5A67', lineHeight: 1.5 }}>
            {pendentes > 0
              ? `${pendentes} ${pendentes === 1 ? 'marcação guardada' : 'marcações guardadas'} no aparelho. Sincronizam sozinhas quando houver sinal.`
              : 'Tudo sincronizado. As marcações continuam sendo guardadas no aparelho antes de irem para o servidor.'}
            {' '}Fotos precisam de conexão — elas não cabem na memória do navegador.
          </p>
        </div>
      </div>

      <div style={{
        borderTop: '1px solid #E7E1D6', background: '#fff', padding: '14px 18px',
        display: 'flex', gap: '10px', position: 'sticky', bottom: 0,
      }}>
        <Link href={`/consultas/${consultaId}`} style={{
          flex: 1, border: '1px solid #D8D0C0', color: '#0E1B2C', fontSize: '14px',
          fontWeight: 700, padding: '13px', borderRadius: '9px', textAlign: 'center',
          minHeight: '48px', boxSizing: 'border-box', textDecoration: 'none',
        }}>Voltar à consulta</Link>
        <button type="button" onClick={() => void tentarSincronizar()} disabled={sincronizando} style={{
          flex: 1, background: sincronizando ? '#9CA3AF' : '#2E7D6B', color: '#fff',
          fontSize: '14px', fontWeight: 700, padding: '13px', borderRadius: '9px',
          border: 'none', minHeight: '48px', boxSizing: 'border-box',
          cursor: sincronizando ? 'wait' : 'pointer',
        }}>{sincronizando ? 'Enviando…' : 'Sincronizar agora'}</button>
      </div>
    </div>
  )
}
