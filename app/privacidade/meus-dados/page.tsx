/**
 * Direitos do titular, em autoatendimento (LGPD art. 18).
 *
 * ## O que esta tela mostra antes de oferecer o botão
 *
 * O inventário — quantos clientes, consultas e pedidos existem hoje. Sem ele,
 * «excluir minha conta» é um botão que faz algo que a pessoa não consegue
 * prever, e a lei pede consentimento informado, não um clique.
 *
 * Aqui isso pesa mais do que nos outros portais: o consultor não está apagando
 * só os dados dele. Está apagando a ficha de cada cliente que cadastrou —
 * pessoas que nunca abriram conta aqui e não serão avisadas. Ele precisa ver o
 * número antes.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../src/lib/supabase'
import { logger } from '../../../src/lib/logger'
import AppShell from '../../components/AppShell'
import { PALAVRA_DE_CONFIRMACAO } from '../../../src/lib/dados-do-titular'
import { Download, TriangleAlert } from 'lucide-react'

const ROTA = '/api/conta/dados'

interface Inventario {
  clientes: number
  consultas: number
  compras: number
}

export default function MeusDados() {
  const [inventario, setInventario] = useState<Inventario | null>(null)
  const [confirmacao, setConfirmacao] = useState('')
  const [baixando, setBaixando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // As contagens saem do banco a cada carregamento — nunca de um campo
    // guardado, que alguém precisaria lembrar de manter em dia.
    const [clientes, consultas, compras] = await Promise.all([
      supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('consultor_id', user.id),
      supabase.from('consultas').select('id', { count: 'exact', head: true }).eq('consultor_id', user.id),
      user.email
        ? supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('comprador_email', user.email)
        : Promise.resolve({ count: 0 }),
    ])

    setInventario({
      clientes: clientes.count ?? 0,
      consultas: consultas.count ?? 0,
      compras: compras.count ?? 0,
    })
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  async function baixar() {
    setBaixando(true)
    setErro('')
    try {
      const resposta = await fetch(ROTA)
      if (!resposta.ok) throw new Error(String(resposta.status))
      const dados = await resposta.json()

      // O arquivo é montado no navegador com o que a rota devolveu: não há URL
      // a proteger e nada fica guardado em lugar nenhum.
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
      )
      const link = document.createElement('a')
      link.href = url
      link.download = `fengshui-meus-dados-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      logger.error('Falha ao baixar dados do titular', {
        erro: e instanceof Error ? e.message : 'desconhecido',
      })
      setErro('Não foi possível gerar o arquivo. Tente novamente.')
    } finally {
      setBaixando(false)
    }
  }

  async function excluir() {
    setExcluindo(true)
    setErro('')
    try {
      const resposta = await fetch(ROTA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmacao }),
      })
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}))
        setErro(corpo.error ?? 'Não foi possível concluir a exclusão.')
        setExcluindo(false)
        return
      }
      // A conta não existe mais: encerrar a sessão aqui evita uma tela que
      // consulta um usuário que o servidor já removeu.
      await supabase.auth.signOut()
      window.location.href = '/?conta=excluida'
    } catch {
      setErro('Não foi possível concluir a exclusão.')
      setExcluindo(false)
    }
  }

  const podeExcluir = confirmacao.trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO

  return (
    <AppShell currentPage="privacidade/meus-dados">
      <div style={{ maxWidth: '680px' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Seus dados</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: 1.6 }}>
          Você pode baixar uma cópia de tudo o que guardamos ou pedir a exclusão
          da sua conta. São direitos seus, e não precisam de justificativa.
        </p>

        <section style={{ marginTop: '28px', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#374151' }}>
            O que temos hoje
          </h2>
          <div style={{ display: 'flex', gap: '20px', marginTop: '14px', flexWrap: 'wrap' }}>
            {inventario
              ? [
                  { rotulo: 'Clientes', valor: inventario.clientes },
                  { rotulo: 'Consultas', valor: inventario.consultas },
                  { rotulo: 'Compras', valor: inventario.compras },
                ].map((item) => (
                  <div key={item.rotulo}>
                    <p style={{ fontSize: '12px', color: '#9CA3AF' }}>{item.rotulo}</p>
                    <p style={{ fontSize: '26px', color: '#111827' }}>{item.valor}</p>
                  </div>
                ))
              : <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Carregando...</p>}
          </div>
        </section>

        <section style={{ marginTop: '20px', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#374151' }}>
            Baixar uma cópia
          </h2>
          <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: 1.6, marginTop: '8px' }}>
            Um arquivo JSON com seu perfil, seus clientes, suas consultas,
            assinaturas, faturas e compras.
          </p>
          <button type="button" onClick={() => void baixar()} disabled={baixando} style={{
            marginTop: '14px', padding: '10px 16px', borderRadius: '8px',
            border: '1px solid #D1D5DB', background: '#fff', fontSize: '14px',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
            opacity: baixando ? 0.6 : 1,
          }}>
            <Download size={16} aria-hidden />
            {baixando ? 'Gerando...' : 'Baixar meus dados'}
          </button>
        </section>

        <section style={{ marginTop: '20px', border: '1px solid #F3C9BC', background: '#FDF6F3', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B4533A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TriangleAlert size={16} aria-hidden />
            Excluir minha conta
          </h2>

          <p style={{ color: '#7A3D2C', fontSize: '14px', lineHeight: 1.6, marginTop: '10px' }}>
            <strong>
              As fichas dos seus {inventario?.clientes ?? 0} clientes e as{' '}
              {inventario?.consultas ?? 0} consultas são apagadas por completo
            </strong>
            , junto com as fotos. Essas pessoas não têm conta aqui e não serão
            avisadas — se você precisa daqueles dados, baixe a cópia antes.
          </p>
          <p style={{ color: '#7A3D2C', fontSize: '14px', lineHeight: 1.6, marginTop: '10px' }}>
            Suas compras continuam existindo como registro fiscal, mas seu nome e
            e-mail saem delas. Seu perfil público sai do ar.
          </p>
          <p style={{ color: '#9A6B5C', fontSize: '13px', lineHeight: 1.6, marginTop: '10px' }}>
            A exclusão é imediata e não pode ser desfeita.
          </p>

          <label htmlFor="confirmacao" style={{ display: 'block', fontSize: '13px', color: '#7A3D2C', marginTop: '16px', marginBottom: '6px' }}>
            Digite <strong>{PALAVRA_DE_CONFIRMACAO}</strong> para confirmar
          </label>
          <input
            id="confirmacao"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            autoComplete="off"
            style={{
              width: '100%', maxWidth: '260px', padding: '10px 14px',
              border: '1px solid #E0A692', borderRadius: '8px', fontSize: '14px',
              outline: 'none', boxSizing: 'border-box',
            }}
          />

          <button type="button" onClick={() => void excluir()} disabled={!podeExcluir || excluindo} style={{
            display: 'block', marginTop: '14px', padding: '10px 16px',
            borderRadius: '8px', border: 'none', background: '#B4533A',
            color: '#fff', fontSize: '14px', fontWeight: 'bold',
            cursor: podeExcluir ? 'pointer' : 'not-allowed',
            opacity: podeExcluir && !excluindo ? 1 : 0.45,
          }}>
            {excluindo ? 'Excluindo...' : 'Excluir minha conta'}
          </button>

          <p role="status" aria-live="polite" style={{ minHeight: '20px', fontSize: '13px', color: '#B4533A', marginTop: '10px' }}>
            {erro}
          </p>
        </section>
      </div>
    </AppShell>
  )
}
