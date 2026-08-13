/**
 * Vitrine de serviços do consultor — o que ele faz, sem botão de comprar.
 *
 * ## Por que não tem checkout
 *
 * Decisão de 13/08: a vitrine é **informativa**. Ela existe para o visitante
 * entender o que aquele consultor faz e decidir procurá-lo; quando o preço
 * fecha, o serviço vira produto na loja dele («Meus produtos»).
 *
 * Se tivesse botão de comprar, ela **seria** a loja com outro nome — e manter
 * as duas faria duas fontes discordarem sobre o preço do mesmo serviço.
 *
 * ## Preço «sob consulta» é ausência, não zero
 *
 * Consultoria de Feng Shui se precifica por imóvel, metragem e deslocamento.
 * Deixar o campo vazio mostra «sob consulta»; mostrar «R$ 0,00» diria que é de
 * graça, que é a leitura errada e cara.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import { logger } from '../../src/lib/logger'

export interface ServicoDoParceiro {
  id: string
  nome: string
  descricao: string | null
  modalidade: 'presencial' | 'online' | 'hibrido'
  duracao_minutos: number | null
  preco_a_partir_de_centavos: number | null
  ativo: boolean
}

export const ROTULO_DA_MODALIDADE: Record<string, string> = {
  presencial: 'Presencial',
  online: 'Online',
  hibrido: 'Presencial ou online',
}

/** «Sob consulta» quando não há faixa declarada. Nunca «R$ 0,00». */
export function faixaDePreco(centavos: number | null): string {
  if (centavos === null || centavos === undefined) return 'Sob consulta'
  return `A partir de ${(centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
}

const VAZIO = {
  nome: '', descricao: '', modalidade: 'presencial' as const,
  duracao: '', preco: '',
}

export default function VitrineDeServicos({ perfilId }: { perfilId: string }) {
  const [servicos, setServicos] = useState<ServicoDoParceiro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('servicos_do_parceiro')
      .select('id, nome, descricao, modalidade, duracao_minutos, preco_a_partir_de_centavos, ativo')
      .eq('perfil_id', perfilId)
      .order('ordem')

    if (error) {
      logger.error('Não foi possível carregar a vitrine', {
        route: '/perfil', erro: error.message,
      })
      setAviso('Não foi possível carregar seus serviços.')
    }
    setServicos((data ?? []) as ServicoDoParceiro[])
    setCarregando(false)
  }, [perfilId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { setAviso('O nome do serviço é obrigatório.'); return }

    setSalvando(true)
    setAviso('')

    const preco = form.preco.trim()
      ? Math.round(parseFloat(form.preco.replace(/\./g, '').replace(',', '.')) * 100)
      : null

    const { error } = await supabase.from('servicos_do_parceiro').insert({
      perfil_id: perfilId,
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      modalidade: form.modalidade,
      duracao_minutos: form.duracao.trim() ? parseInt(form.duracao, 10) : null,
      // `NaN` vira nulo em vez de zero: preço ilegível é «não declarado», e
      // gravar 0 anunciaria o serviço como gratuito.
      preco_a_partir_de_centavos: preco !== null && Number.isFinite(preco) ? preco : null,
    })

    setSalvando(false)

    if (error) {
      logger.error('Não foi possível salvar o serviço', { route: '/perfil', erro: error.message })
      setAviso('Não foi possível salvar. Tente novamente.')
      return
    }

    setForm(VAZIO)
    await carregar()
  }

  async function alternarAtivo(servico: ServicoDoParceiro) {
    const { error } = await supabase
      .from('servicos_do_parceiro')
      .update({ ativo: !servico.ativo, atualizado_em: new Date().toISOString() })
      .eq('id', servico.id)

    if (error) {
      logger.error('Não foi possível alterar o serviço', { route: '/perfil', erro: error.message })
      setAviso('Não foi possível alterar. Tente novamente.')
      return
    }
    await carregar()
  }

  async function remover(servico: ServicoDoParceiro) {
    const { error } = await supabase.from('servicos_do_parceiro').delete().eq('id', servico.id)
    if (error) {
      logger.error('Não foi possível remover o serviço', { route: '/perfil', erro: error.message })
      setAviso('Não foi possível remover. Tente novamente.')
      return
    }
    await carregar()
  }

  const campo = {
    width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB',
    borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ marginTop: '20px', borderTop: '1px solid #F3F4F6', paddingTop: '20px' }}>
      <h4 style={{ color: '#0E1B2C', fontSize: '15px', fontWeight: 'bold', margin: '0 0 4px' }}>
        Serviços que você oferece
      </h4>
      <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 16px' }}>
        Aparecem no seu card para quem procura um consultor. É vitrine: quem se
        interessar entra em contato com você — a cobrança não acontece aqui.
      </p>

      {aviso && (
        <div style={{ padding: '10px 12px', background: '#FDECEC', color: '#A33A3A', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
          {aviso}
        </div>
      )}

      {carregando ? (
        <p style={{ color: '#9CA3AF', fontSize: '13px' }}>Carregando…</p>
      ) : servicos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {servicos.map(servico => (
            <div key={servico.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
              padding: '12px', background: servico.ativo ? '#F9FAFB' : '#F3F4F6',
              borderRadius: '8px', border: '1px solid #E5E7EB', opacity: servico.ativo ? 1 : 0.6,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#0E1B2C', fontSize: '14px', fontWeight: 'bold' }}>{servico.nome}</div>
                <div style={{ color: '#6B7280', fontSize: '12px', marginTop: '2px' }}>
                  {ROTULO_DA_MODALIDADE[servico.modalidade] ?? servico.modalidade}
                  {servico.duracao_minutos && ` · ${servico.duracao_minutos} min`}
                  {' · '}{faixaDePreco(servico.preco_a_partir_de_centavos)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button type="button" onClick={() => alternarAtivo(servico)} style={{
                  padding: '4px 10px', background: 'transparent', color: '#2E7D6B',
                  border: '1px solid #DCEAE4', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                }}>{servico.ativo ? 'Ocultar' : 'Mostrar'}</button>
                <button type="button" onClick={() => remover(servico)} style={{
                  padding: '4px 10px', background: 'transparent', color: '#A33A3A',
                  border: '1px solid #E5B4B4', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                }}>Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={adicionar} style={{ display: 'grid', gap: '10px' }}>
        <input
          style={campo}
          placeholder="Nome do serviço — ex.: Consulta residencial completa"
          value={form.nome}
          onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
        />
        <textarea
          style={{ ...campo, minHeight: '64px', resize: 'vertical' }}
          placeholder="O que está incluído, para quem serve…"
          value={form.descricao}
          onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
        />
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            style={{ ...campo, flex: '1 1 160px' }}
            value={form.modalidade}
            onChange={e => setForm(f => ({ ...f, modalidade: e.target.value as typeof f.modalidade }))}
          >
            <option value="presencial">Presencial</option>
            <option value="online">Online</option>
            <option value="hibrido">Presencial ou online</option>
          </select>
          <input
            style={{ ...campo, flex: '1 1 120px' }}
            placeholder="Duração (min)"
            inputMode="numeric"
            value={form.duracao}
            onChange={e => setForm(f => ({ ...f, duracao: e.target.value }))}
          />
          <input
            style={{ ...campo, flex: '1 1 160px' }}
            placeholder="A partir de R$ (opcional)"
            value={form.preco}
            onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
          />
        </div>
        <p style={{ color: '#9CA3AF', fontSize: '12px', margin: 0 }}>
          Deixe o preço em branco para aparecer como «sob consulta».
        </p>
        <button type="submit" disabled={salvando} style={{
          justifySelf: 'start', padding: '10px 20px', background: '#2E7D6B', color: '#fff',
          border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
          cursor: salvando ? 'default' : 'pointer',
        }}>{salvando ? 'Salvando…' : 'Adicionar serviço'}</button>
      </form>
    </div>
  )
}
