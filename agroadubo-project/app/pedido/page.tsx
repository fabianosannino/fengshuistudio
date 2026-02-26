'use client'

import { useState, useEffect } from 'react'
import { Resultado } from '../lib/types'

interface ItemPedido {
  nome: string
  tipo: string
  npk: string
  dosagem: string
  quantidade: string
  unidade: string
  observacao: string
}

export default function PedidoPage() {
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [propriedade, setPropriedade] = useState('')
  const [observacoesGerais, setObservacoesGerais] = useState('')
  const [pedidoGerado, setPedidoGerado] = useState(false)
  const [numeroPedido, setNumeroPedido] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('agroadubo-dark')
    if (saved === 'true') setDarkMode(true)

    const data = localStorage.getItem('agroadubo-pedido')
    if (data) {
      try {
        const res: Resultado = JSON.parse(data)
        setResultado(res)

        const items: ItemPedido[] = []

        // Add fertilizers
        res.adubos.forEach(a => {
          items.push({
            nome: a.nome,
            tipo: a.tipo,
            npk: a.npk,
            dosagem: a.dosagem,
            quantidade: '',
            unidade: a.dosagem.includes('kg/ha') ? 'kg' : a.dosagem.includes('ton') ? 'tonelada' : a.dosagem.includes('g/m2') || a.dosagem.includes('g/planta') || a.dosagem.includes('g/cova') ? 'kg' : a.dosagem.includes('g por vaso') || a.dosagem.includes('g por tubete') || a.dosagem.includes('g/L') ? 'g' : 'kg',
            observacao: `${a.aplicacao} - ${a.frequencia}`,
          })
        })

        // Add tubete substrate
        items.push({
          nome: 'Substrato para Tubete',
          tipo: 'Substrato',
          npk: '-',
          dosagem: res.tubete.substrato,
          quantidade: '',
          unidade: 'litros',
          observacao: `Para tubete ${res.tubete.tamanho}`,
        })

        // Add tubetes
        items.push({
          nome: `Tubete Polpa Moldada ${res.tubete.tamanho}`,
          tipo: 'Tubete',
          npk: '-',
          dosagem: res.tubete.volume,
          quantidade: '',
          unidade: 'unidades',
          observacao: `Tempo de muda: ${res.tubete.tempoMuda}`,
        })

        // Add soil corrections if relevant
        if (res.correcoesSolo.length > 0 && !res.correcoesSolo[0].startsWith('Solo adequado')) {
          res.correcoesSolo.forEach(c => {
            if (c.toLowerCase().includes('calcario')) {
              items.push({ nome: 'Calcario Dolomitico (PRNT > 80%)', tipo: 'Corretivo de Solo', npk: '-', dosagem: '2-4 ton/ha', quantidade: '', unidade: 'tonelada', observacao: c })
            } else if (c.toLowerCase().includes('gesso')) {
              items.push({ nome: 'Gesso Agricola', tipo: 'Corretivo de Solo', npk: '-', dosagem: '1-2 ton/ha', quantidade: '', unidade: 'tonelada', observacao: c })
            }
          })
        }

        setItens(items)
      } catch {
        // Invalid data
      }
    }
  }, [])

  const t = {
    bg: darkMode ? '#0f172a' : '#F9FAFB',
    card: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#e2e8f0' : '#111827',
    textSoft: darkMode ? '#94a3b8' : '#6B7280',
    border: darkMode ? '#334155' : '#E5E7EB',
    accent: '#16a34a',
    accentLight: darkMode ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.08)',
  }

  const cardStyle: React.CSSProperties = { background: t.card, borderRadius: '16px', padding: '24px', border: `1px solid ${t.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }
  const btnPrimary: React.CSSProperties = { background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none', padding: '14px 36px', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${t.border}`, background: darkMode ? '#0f172a' : '#fff', color: t.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.2s ease' }

  function updateItem(index: number, field: keyof ItemPedido, value: string) {
    setItens(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function removeItem(index: number) {
    setItens(prev => prev.filter((_, i) => i !== index))
  }

  function gerarPedido() {
    const num = `AGR-${Date.now().toString(36).toUpperCase()}`
    setNumeroPedido(num)
    setPedidoGerado(true)

    // Save to localStorage history
    const historico = JSON.parse(localStorage.getItem('agroadubo-pedidos') || '[]')
    historico.push({
      numero: num,
      data: new Date().toISOString(),
      cliente: nomeCliente,
      telefone,
      email,
      propriedade,
      planta: resultado?.planta.nome,
      itens: itens.filter(item => item.quantidade),
      observacoes: observacoesGerais,
    })
    localStorage.setItem('agroadubo-pedidos', JSON.stringify(historico))
  }

  function imprimirPedido() {
    const itensComQtd = itens.filter(item => item.quantidade)
    const itensHTML = itensComQtd.map((item, i) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 8px;font-size:13px;">${i + 1}</td>
        <td style="padding:10px 8px;font-size:13px;"><strong>${item.nome}</strong><br/><span style="color:#6b7280;font-size:11px;">${item.tipo}${item.npk !== '-' ? ' | NPK ' + item.npk : ''}</span></td>
        <td style="padding:10px 8px;font-size:13px;">${item.dosagem}</td>
        <td style="padding:10px 8px;font-size:13px;font-weight:700;">${item.quantidade} ${item.unidade}</td>
        <td style="padding:10px 8px;font-size:12px;color:#6b7280;">${item.observacao}</td>
      </tr>
    `).join('')

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Pedido de Compra ${numeroPedido}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#111827; padding:32px; max-width:800px; margin:0 auto; }
        table { width:100%; border-collapse:collapse; }
        th { background:#f0fdf4; color:#052e16; padding:10px 8px; text-align:left; font-size:12px; font-weight:700; border-bottom:2px solid #16a34a; }
        @media print { body { padding:16px; } }
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #16a34a;">
        <div>
          <h1 style="font-size:22px;color:#16a34a;margin-bottom:4px;">AgroAdubo - Pedido de Compra</h1>
          <p style="font-size:14px;color:#6b7280;">Pedido N. ${numeroPedido}</p>
        </div>
        <div style="text-align:right;font-size:12px;color:#6b7280;">
          <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
          <p>Hora: ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
          <p style="font-size:11px;color:#6b7280;font-weight:600;margin-bottom:8px;">DADOS DO CLIENTE</p>
          ${nomeCliente ? `<p style="font-size:13px;margin-bottom:4px;"><strong>Nome:</strong> ${nomeCliente}</p>` : ''}
          ${telefone ? `<p style="font-size:13px;margin-bottom:4px;"><strong>Telefone:</strong> ${telefone}</p>` : ''}
          ${email ? `<p style="font-size:13px;margin-bottom:4px;"><strong>Email:</strong> ${email}</p>` : ''}
          ${propriedade ? `<p style="font-size:13px;"><strong>Propriedade:</strong> ${propriedade}</p>` : ''}
        </div>
        <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
          <p style="font-size:11px;color:#6b7280;font-weight:600;margin-bottom:8px;">DADOS DA AVALIACAO</p>
          <p style="font-size:13px;margin-bottom:4px;"><strong>Planta:</strong> ${resultado?.planta.nome} (${resultado?.planta.nomeCientifico})</p>
          <p style="font-size:13px;margin-bottom:4px;"><strong>Regiao:</strong> ${resultado?.regiao.nome}</p>
          <p style="font-size:13px;margin-bottom:4px;"><strong>Solo:</strong> ${resultado?.solo.nome}</p>
          <p style="font-size:13px;"><strong>Producao:</strong> ${resultado?.producao.nome}</p>
        </div>
      </div>

      <h2 style="font-size:16px;color:#052e16;margin-bottom:12px;">Itens do Pedido</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Produto</th><th>Dosagem Ref.</th><th>Quantidade</th><th>Obs.</th></tr>
        </thead>
        <tbody>${itensHTML}</tbody>
      </table>

      <div style="margin-top:16px;font-size:13px;color:#6b7280;">
        <p><strong>Total de itens:</strong> ${itensComQtd.length}</p>
      </div>

      ${observacoesGerais ? `<div style="margin-top:20px;padding:14px;background:#fefce8;border:1px solid rgba(234,179,8,0.2);border-radius:8px;"><p style="font-size:11px;color:#a16207;font-weight:600;margin-bottom:4px;">OBSERVACOES</p><p style="font-size:13px;color:#111827;">${observacoesGerais}</p></div>` : ''}

      <div style="margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px;">
        <div style="text-align:center;">
          <div style="border-top:1px solid #111827;padding-top:8px;">
            <p style="font-size:12px;color:#6b7280;">Assinatura do Cliente</p>
          </div>
        </div>
        <div style="text-align:center;">
          <div style="border-top:1px solid #111827;padding-top:8px;">
            <p style="font-size:12px;color:#6b7280;">Assinatura do Vendedor</p>
          </div>
        </div>
      </div>

      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:11px;">
        <p>Documento gerado por AgroAdubo em ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR')}</p>
        <p>As quantidades devem ser ajustadas conforme analise de solo e orientacao de agronomo responsavel.</p>
      </div>
    </body></html>`)

    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 500)
  }

  if (!resultado) {
    return (
      <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...cardStyle, textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>{'📋'}</div>
          <h2 style={{ color: t.text, fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Nenhuma avaliacao encontrada</h2>
          <p style={{ color: t.textSoft, fontSize: '14px', marginBottom: '24px' }}>Faca uma avaliacao de planta primeiro para gerar um pedido de compra.</p>
          <button onClick={() => window.location.href = '/avaliar'} style={btnPrimary}>{'🌱'} Avaliar Planta</button>
        </div>
      </div>
    )
  }

  if (pedidoGerado) {
    const itensComQtd = itens.filter(item => item.quantidade)
    return (
      <div style={{ minHeight: '100vh', background: t.bg, transition: 'background 0.3s ease' }}>
        <style>{`
          @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes successPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.4); } 50% { box-shadow: 0 0 0 12px rgba(22,163,74,0); } }
          .btn-hover:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(22,163,74,0.3); }
        `}</style>

        <header style={{ background: darkMode ? '#1e293b' : '#ffffff', borderBottom: `1px solid ${t.border}`, padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <span style={{ fontSize: '24px' }}>{'🌱'}</span>
            <span style={{ color: '#16a34a', fontSize: '18px', fontWeight: 800 }}>AgroAdubo</span>
          </a>
          <button onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('agroadubo-dark', String(next)) }} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: t.text, fontSize: '14px' }}>
            {darkMode ? '☀️ Claro' : '🌙 Escuro'}
          </button>
        </header>

        <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', animation: 'slideIn 0.4s ease-out' }}>
          <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #16a34a, #15803d)', border: 'none', marginBottom: '24px', color: '#fff', textAlign: 'center', padding: '40px 24px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px', animation: 'successPulse 2s ease-in-out 1' }}>{'✅'}</div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Pedido Gerado com Sucesso!</h1>
            <p style={{ fontSize: '16px', opacity: 0.9, marginBottom: '12px' }}>Pedido N. {numeroPedido}</p>
            <p style={{ fontSize: '14px', opacity: 0.7 }}>{new Date().toLocaleDateString('pt-BR')} as {new Date().toLocaleTimeString('pt-BR')}</p>
          </div>

          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>{'📋'} Resumo do Pedido</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : '#fafafa', borderRadius: '10px', padding: '14px', border: `1px solid ${t.border}` }}>
                <p style={{ color: t.textSoft, fontSize: '11px', fontWeight: 600, marginBottom: '8px' }}>CLIENTE</p>
                {nomeCliente && <p style={{ color: t.text, fontSize: '13px', marginBottom: '4px' }}><strong>Nome:</strong> {nomeCliente}</p>}
                {telefone && <p style={{ color: t.text, fontSize: '13px', marginBottom: '4px' }}><strong>Tel:</strong> {telefone}</p>}
                {email && <p style={{ color: t.text, fontSize: '13px', marginBottom: '4px' }}><strong>Email:</strong> {email}</p>}
                {propriedade && <p style={{ color: t.text, fontSize: '13px' }}><strong>Propriedade:</strong> {propriedade}</p>}
              </div>
              <div style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : '#fafafa', borderRadius: '10px', padding: '14px', border: `1px solid ${t.border}` }}>
                <p style={{ color: t.textSoft, fontSize: '11px', fontWeight: 600, marginBottom: '8px' }}>AVALIACAO</p>
                <p style={{ color: t.text, fontSize: '13px', marginBottom: '4px' }}><strong>Planta:</strong> {resultado.planta.icon} {resultado.planta.nome}</p>
                <p style={{ color: t.text, fontSize: '13px', marginBottom: '4px' }}><strong>Regiao:</strong> {resultado.regiao.nome}</p>
                <p style={{ color: t.text, fontSize: '13px', marginBottom: '4px' }}><strong>Solo:</strong> {resultado.solo.nome}</p>
                <p style={{ color: t.text, fontSize: '13px' }}><strong>Producao:</strong> {resultado.producao.nome}</p>
              </div>
            </div>

            <p style={{ color: t.textSoft, fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>ITENS ({itensComQtd.length})</p>
            {itensComQtd.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < itensComQtd.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                <div>
                  <p style={{ color: t.text, fontSize: '14px', fontWeight: 600, margin: 0 }}>{item.nome}</p>
                  <p style={{ color: t.textSoft, fontSize: '12px', margin: 0 }}>{item.tipo}{item.npk !== '-' ? ` | NPK ${item.npk}` : ''}</p>
                </div>
                <p style={{ color: t.accent, fontSize: '15px', fontWeight: 700, margin: 0 }}>{item.quantidade} {item.unidade}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={imprimirPedido} className="btn-hover" style={{ ...btnPrimary, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>{'🖨️'} Imprimir Pedido</button>
            <button onClick={() => { setPedidoGerado(false) }} style={{ background: 'transparent', color: t.textSoft, border: `1px solid ${t.border}`, padding: '14px 36px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>{'✏️'} Editar Pedido</button>
            <button onClick={() => window.location.href = '/avaliar'} className="btn-hover" style={btnPrimary}>{'🌱'} Nova Avaliacao</button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, transition: 'background 0.3s ease' }}>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .btn-hover:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(22,163,74,0.3); }
        .input-focus:focus { border-color: #16a34a !important; box-shadow: 0 0 0 3px rgba(22,163,74,0.1); }
      `}</style>

      <header style={{ background: darkMode ? '#1e293b' : '#ffffff', borderBottom: `1px solid ${t.border}`, padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <span style={{ fontSize: '24px' }}>{'🌱'}</span>
          <span style={{ color: '#16a34a', fontSize: '18px', fontWeight: 800 }}>AgroAdubo</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => window.location.href = '/avaliar'} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: t.textSoft, fontSize: '13px', fontWeight: 600 }}>
            {'←'} Voltar
          </button>
          <button onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('agroadubo-dark', String(next)) }} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: t.text, fontSize: '14px' }}>
            {darkMode ? '☀️ Claro' : '🌙 Escuro'}
          </button>
        </div>
      </header>

      <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '32px' }}>{'🛒'}</span>
            <h1 style={{ color: t.text, fontSize: '28px', fontWeight: 800, margin: 0 }}>Pedido de Compra</h1>
          </div>
          <p style={{ color: t.textSoft, fontSize: '15px', margin: 0 }}>Materiais recomendados para {resultado.planta.icon} {resultado.planta.nome} - {resultado.producao.nome}</p>
        </div>

        {/* Evaluation Summary */}
        <div style={{ ...cardStyle, marginBottom: '20px', borderLeft: '4px solid #16a34a', background: darkMode ? 'rgba(22,163,74,0.08)' : '#f0fdf4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '36px' }}>{resultado.planta.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ color: t.text, fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0' }}>{resultado.planta.nome} ({resultado.planta.nomeCientifico})</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ background: darkMode ? 'rgba(22,163,74,0.2)' : '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{'📍'} {resultado.regiao.nome}</span>
                <span style={{ background: darkMode ? 'rgba(22,163,74,0.2)' : '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{resultado.solo.icon} {resultado.solo.nome}</span>
                <span style={{ background: darkMode ? 'rgba(22,163,74,0.2)' : '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{resultado.producao.icon} {resultado.producao.nome}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Client Data */}
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>{'👤'} Dados do Cliente</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ color: t.textSoft, fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Nome *</label>
              <input className="input-focus" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} placeholder="Nome completo" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: t.textSoft, fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Telefone</label>
              <input className="input-focus" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: t.textSoft, fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Email</label>
              <input className="input-focus" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" style={inputStyle} />
            </div>
            <div>
              <label style={{ color: t.textSoft, fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Propriedade / Local</label>
              <input className="input-focus" value={propriedade} onChange={e => setPropriedade(e.target.value)} placeholder="Nome da propriedade" style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Items */}
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{'📦'} Itens do Pedido</h3>
          <p style={{ color: t.textSoft, fontSize: '13px', marginBottom: '20px' }}>Informe a quantidade desejada para cada item. Itens sem quantidade nao serao incluidos no pedido.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {itens.map((item, i) => (
              <div key={i} style={{
                borderRadius: '12px', padding: '16px',
                border: `1px solid ${item.quantidade ? 'rgba(22,163,74,0.3)' : t.border}`,
                borderLeft: `4px solid ${item.tipo.includes('Corretivo') ? '#d97706' : item.tipo === 'Substrato' ? '#7c3aed' : item.tipo === 'Tubete' ? '#0891b2' : item.tipo.includes('Organico') ? '#78716c' : '#16a34a'}`,
                background: item.quantidade ? (darkMode ? 'rgba(22,163,74,0.06)' : '#fafffe') : (darkMode ? 'rgba(255,255,255,0.02)' : '#fafafa'),
                transition: 'all 0.2s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <p style={{ color: t.text, fontSize: '15px', fontWeight: 700, margin: 0 }}>{item.nome}</p>
                      {item.npk !== '-' && <span style={{ background: darkMode ? 'rgba(22,163,74,0.15)' : '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>NPK {item.npk}</span>}
                    </div>
                    <p style={{ color: t.textSoft, fontSize: '12px', margin: '0 0 2px 0' }}>{item.tipo}</p>
                    <p style={{ color: t.textSoft, fontSize: '12px', margin: '0 0 2px 0' }}>Dosagem ref.: <strong style={{ color: t.text }}>{item.dosagem}</strong></p>
                    <p style={{ color: t.textSoft, fontSize: '11px', margin: 0 }}>{item.observacao}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div>
                      <label style={{ color: t.textSoft, fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Quantidade</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          className="input-focus"
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantidade}
                          onChange={e => updateItem(i, 'quantidade', e.target.value)}
                          placeholder="0"
                          style={{ ...inputStyle, width: '100px', textAlign: 'right' as const }}
                        />
                        <select
                          value={item.unidade}
                          onChange={e => updateItem(i, 'unidade', e.target.value)}
                          style={{ ...inputStyle, width: '100px', cursor: 'pointer' }}
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="tonelada">ton</option>
                          <option value="litros">litros</option>
                          <option value="unidades">un</option>
                          <option value="sacos">sacos</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={() => removeItem(i)} title="Remover item" style={{
                      background: 'none', border: `1px solid ${darkMode ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'}`,
                      borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#dc2626', fontSize: '14px',
                      marginTop: '18px',
                    }}>{'×'}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Observations */}
        <div style={{ ...cardStyle, marginBottom: '24px' }}>
          <h3 style={{ color: t.text, fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>{'📝'} Observacoes</h3>
          <textarea
            className="input-focus"
            value={observacoesGerais}
            onChange={e => setObservacoesGerais(e.target.value)}
            placeholder="Observacoes adicionais sobre o pedido, prazo de entrega, forma de pagamento..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' as const }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '40px' }}>
          <button
            onClick={gerarPedido}
            disabled={!nomeCliente || itens.every(item => !item.quantidade)}
            className="btn-hover"
            style={{
              ...btnPrimary,
              background: (!nomeCliente || itens.every(item => !item.quantidade)) ? '#9ca3af' : 'linear-gradient(135deg, #d97706, #b45309)',
              cursor: (!nomeCliente || itens.every(item => !item.quantidade)) ? 'not-allowed' : 'pointer',
              padding: '16px 48px', fontSize: '16px',
            }}
          >
            {'🛒'} Gerar Pedido de Compra
          </button>
          <button onClick={() => window.location.href = '/avaliar'} style={{ background: 'transparent', color: t.textSoft, border: `1px solid ${t.border}`, padding: '16px 36px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
            {'←'} Voltar para Avaliacao
          </button>
        </div>

        {(!nomeCliente || itens.every(item => !item.quantidade)) && (
          <div style={{ textAlign: 'center', padding: '16px', borderRadius: '10px', background: darkMode ? 'rgba(234,179,8,0.08)' : '#fefce8', border: '1px solid rgba(234,179,8,0.2)', marginBottom: '20px' }}>
            <p style={{ color: '#a16207', fontSize: '13px', margin: 0 }}>
              {'⚠️'} Preencha o nome do cliente e informe a quantidade de pelo menos um item para gerar o pedido.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
