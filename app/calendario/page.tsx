'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'

// Calculo das fases da lua
function getMoonPhase(date: Date): { fase: string; emoji: string; percentual: number } {
  const known = new Date(2000, 0, 6, 18, 14) // Lua nova conhecida
  const cycle = 29.53058867
  const diff = (date.getTime() - known.getTime()) / 1000 / 60 / 60 / 24
  const phase = ((diff % cycle) + cycle) % cycle
  const pct = Math.round((phase / cycle) * 100)

  if (phase < 1.85) return { fase: 'Nova', emoji: '🌑', percentual: pct }
  if (phase < 7.38) return { fase: 'Crescente', emoji: '🌒', percentual: pct }
  if (phase < 9.23) return { fase: 'Quarto Crescente', emoji: '🌓', percentual: pct }
  if (phase < 13.69) return { fase: 'Gibosa Crescente', emoji: '🌔', percentual: pct }
  if (phase < 16.61) return { fase: 'Cheia', emoji: '🌕', percentual: pct }
  if (phase < 20.30) return { fase: 'Gibosa Minguante', emoji: '🌖', percentual: pct }
  if (phase < 22.15) return { fase: 'Quarto Minguante', emoji: '🌗', percentual: pct }
  if (phase < 27.68) return { fase: 'Minguante', emoji: '🌘', percentual: pct }
  return { fase: 'Nova', emoji: '🌑', percentual: pct }
}

function getFaseSimples(fase: string): string {
  if (fase.includes('Nova')) return 'nova'
  if (fase.includes('Crescente')) return 'crescente'
  if (fase.includes('Cheia')) return 'cheia'
  if (fase.includes('Minguante')) return 'minguante'
  return 'nova'
}

// Proximas fases principais do mes
function getProximasFases(ano: number, mes: number) {
  const fases: { data: Date; fase: string; emoji: string }[] = []
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  let ultimaFase = ''

  for (let d = 1; d <= diasNoMes; d++) {
    const data = new Date(ano, mes, d)
    const { fase, emoji } = getMoonPhase(data)
    const faseSimples = getFaseSimples(fase)
    if (faseSimples !== ultimaFase && ['Nova', 'Quarto Crescente', 'Cheia', 'Quarto Minguante'].includes(fase)) {
      fases.push({ data, fase, emoji })
      ultimaFase = faseSimples
    }
  }
  return fases
}

const RITUAIS_SUGERIDOS: Record<string, { titulo: string; descricao: string }[]> = {
  nova: [
    { titulo: 'Limpeza energética', descricao: 'Limpe a casa com sal grosso e incenso. Ideal para renovar energias e iniciar novos ciclos.' },
    { titulo: 'Definição de intenções', descricao: 'Escreva suas metas para o ciclo lunar. A lua nova é o momento de plantar sementes.' },
    { titulo: 'Meditação de silêncio', descricao: 'Pratique 15 minutos de meditação em silêncio para conectar-se com sua essência.' },
  ],
  crescente: [
    { titulo: 'Ativação do Ba Gua', descricao: 'Ative os setores do Ba Gua com elementos correspondentes. Momento de expansão.' },
    { titulo: 'Organização de ambientes', descricao: 'Organize gavetas e armários. A energia crescente potencializa a organização.' },
    { titulo: 'Ritual de prosperidade', descricao: 'Coloque moedas no setor de Prosperidade e acenda uma vela amarela.' },
  ],
  cheia: [
    { titulo: 'Ritual de gratidão', descricao: 'Agradeça pelas conquistas do ciclo. A lua cheia amplifica as energias positivas.' },
    { titulo: 'Energização de cristais', descricao: 'Coloque seus cristais sob a luz da lua cheia para recarregar suas energias.' },
    { titulo: 'Celebração e colheita', descricao: 'Comemore resultados alcançados. Prepare um jantar especial e celebre.' },
  ],
  minguante: [
    { titulo: 'Desapego e liberação', descricao: 'Doe roupas e objetos que não usa mais. Libere o que não serve ao seu crescimento.' },
    { titulo: 'Banho de ervas', descricao: 'Tome um banho de ervas (alecrim, lavanda) para limpar energias densas.' },
    { titulo: 'Revisão e reflexão', descricao: 'Revise o que funcionou no ciclo e o que precisa ser ajustado no próximo.' },
  ]
}

const COR_FASE: Record<string, string> = {
  nova: '#1E3A5F',
  crescente: '#7C3AED',
  cheia: '#B8860B',
  minguante: '#6B7280'
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function Calendario() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mesAtual, setMesAtual] = useState(new Date().getMonth())
  const [anoAtual, setAnoAtual] = useState(new Date().getFullYear())
  const [rituais, setRituais] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [faseSelecionada, setFaseSelecionada] = useState<string | null>(null)
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    fase_lunar: 'nova',
    data_ritual: '',
    horario: '',
    cliente_id: '',
  })

  const hoje = new Date()
  const faseHoje = getMoonPhase(hoje)
  const faseSimples = getFaseSimples(faseHoje.fase)
  const proximasFases = getProximasFases(anoAtual, mesAtual)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setUser(user)

      const inicioMes = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`
      const fimMes = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${new Date(anoAtual, mesAtual + 1, 0).getDate()}`

      const { data: rits } = await supabase
        .from('rituais')
        .select('*, clientes(nome_completo)')
        .eq('consultor_id', user.id)
        .gte('data_ritual', inicioMes)
        .lte('data_ritual', fimMes)
        .order('data_ritual', { ascending: true })
      setRituais(rits || [])

      const { data: clis } = await supabase
        .from('clientes')
        .select('id, nome_completo')
        .eq('consultor_id', user.id)
        .eq('ativo', true)
        .order('nome_completo')
      setClientes(clis || [])

      setLoading(false)
    }
    load()
  }, [mesAtual, anoAtual])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function preencherSugerido(titulo: string, descricao: string, fase: string) {
    setForm({ ...form, titulo, descricao, fase_lunar: fase })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('rituais').insert({
      consultor_id: user.id,
      titulo: form.titulo,
      descricao: form.descricao,
      fase_lunar: form.fase_lunar,
      data_ritual: form.data_ritual,
      horario: form.horario || null,
      cliente_id: form.cliente_id || null,
      tipo: 'customizado',
      status: 'pendente'
    })
    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      setMessage('Ritual agendado com sucesso!')
      setForm({ titulo: '', descricao: '', fase_lunar: 'nova', data_ritual: '', horario: '', cliente_id: '' })
      setShowForm(false)
      // Recarregar rituais
      const inicioMes = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`
      const fimMes = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${new Date(anoAtual, mesAtual + 1, 0).getDate()}`
      const { data: rits } = await supabase
        .from('rituais')
        .select('*, clientes(nome_completo)')
        .eq('consultor_id', user.id)
        .gte('data_ritual', inicioMes)
        .lte('data_ritual', fimMes)
        .order('data_ritual', { ascending: true })
      setRituais(rits || [])
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  async function toggleStatus(id: string, statusAtual: string) {
    const novoStatus = statusAtual === 'pendente' ? 'concluido' : 'pendente'
    await supabase.from('rituais').update({ status: novoStatus }).eq('id', id)
    setRituais(rituais.map(r => r.id === id ? { ...r, status: novoStatus } : r))
  }

  async function deleteRitual(id: string) {
    if (!confirm('Excluir este ritual?')) return
    await supabase.from('rituais').delete().eq('id', id)
    setRituais(rituais.filter(r => r.id !== id))
  }

  function mudarMes(direcao: number) {
    let novoMes = mesAtual + direcao
    let novoAno = anoAtual
    if (novoMes < 0) { novoMes = 11; novoAno-- }
    if (novoMes > 11) { novoMes = 0; novoAno++ }
    setMesAtual(novoMes)
    setAnoAtual(novoAno)
  }

  // Gerar dias do calendario
  function gerarDiasCalendario() {
    const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay()
    const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate()
    const dias: (number | null)[] = []
    for (let i = 0; i < primeiroDia; i++) dias.push(null)
    for (let i = 1; i <= diasNoMes; i++) dias.push(i)
    return dias
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  const rituaisPendentes = rituais.filter(r => r.status === 'pendente').length

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
      <header style={{
        background: '#1E3A5F', padding: '0 32px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px', cursor: 'pointer' }} onClick={() => window.location.href = '/dashboard'}>☯</span>
          <span style={{ color: '#B8860B', fontSize: '20px', fontWeight: 'bold' }}>FengShui Studio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span onClick={() => window.location.href = '/dashboard'} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Dashboard</span>
          <span onClick={() => window.location.href = '/clientes'} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Clientes</span>
          <span onClick={() => window.location.href = '/consultas'} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Consultas</span>
          <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold' }}>Calendário</span>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
            color: '#ffffff', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
          }}>Sair</button>
        </div>
      </header>

      <main style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* Fase atual */}
        <div style={{
          background: `linear-gradient(135deg, ${COR_FASE[faseSimples]}, #1E3A5F)`,
          borderRadius: '16px', padding: '28px 32px', marginBottom: '28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'
        }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '0 0 4px 0' }}>Fase lunar de hoje</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '48px' }}>{faseHoje.emoji}</span>
              <div>
                <h1 style={{ color: '#ffffff', fontSize: '26px', fontWeight: 'bold', margin: '0' }}>Lua {faseHoje.fase}</h1>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', margin: '4px 0 0 0' }}>
                  {hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '0 0 4px 0' }}>Rituais pendentes este mês</p>
            <span style={{ color: '#ffffff', fontSize: '32px', fontWeight: 'bold' }}>{rituaisPendentes}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>

          {/* Calendario mini */}
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <button onClick={() => mudarMes(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#7C3AED' }}>◀</button>
              <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0' }}>{MESES[mesAtual]} {anoAtual}</h3>
              <button onClick={() => mudarMes(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#7C3AED' }}>▶</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} style={{ color: '#9CA3AF', fontSize: '11px', padding: '4px', fontWeight: 'bold' }}>{d}</div>
              ))}
              {gerarDiasCalendario().map((dia, i) => {
                if (!dia) return <div key={`e${i}`} />
                const data = new Date(anoAtual, mesAtual, dia)
                const moonInfo = getMoonPhase(data)
                const isHoje = dia === hoje.getDate() && mesAtual === hoje.getMonth() && anoAtual === hoje.getFullYear()
                const temRitual = rituais.some(r => new Date(r.data_ritual + 'T12:00:00').getDate() === dia)
                return (
                  <div key={dia} style={{
                    padding: '4px 2px', borderRadius: '6px', cursor: 'default',
                    background: isHoje ? '#7C3AED' : 'transparent',
                    position: 'relative'
                  }}>
                    <div style={{ color: isHoje ? '#fff' : '#374151', fontSize: '13px', fontWeight: isHoje ? 'bold' : 'normal' }}>{dia}</div>
                    <div style={{ fontSize: '10px' }}>{moonInfo.emoji}</div>
                    {temRitual && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#B8860B', margin: '2px auto 0' }} />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Proximas fases */}
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0' }}>Fases deste mês</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {proximasFases.length === 0 ? (
                <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Nenhuma fase principal neste mês.</p>
              ) : proximasFases.map((f, i) => {
                const fs = getFaseSimples(f.fase)
                return (
                  <div key={i} onClick={() => setFaseSelecionada(faseSelecionada === fs ? null : fs)} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                    borderRadius: '8px', background: faseSelecionada === fs ? `${COR_FASE[fs]}10` : '#F9FAFB',
                    border: faseSelecionada === fs ? `2px solid ${COR_FASE[fs]}` : '1px solid #E5E7EB',
                    cursor: 'pointer'
                  }}>
                    <span style={{ fontSize: '28px' }}>{f.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#111827', fontWeight: 'bold', fontSize: '14px', margin: '0' }}>Lua {f.fase}</p>
                      <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '2px 0 0 0' }}>
                        {f.data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span style={{ color: COR_FASE[fs], fontSize: '12px' }}>Ver rituais →</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Rituais sugeridos por fase */}
        {faseSelecionada && (
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '28px', borderTop: `3px solid ${COR_FASE[faseSelecionada]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0' }}>
                Rituais sugeridos para Lua {faseSelecionada === 'nova' ? 'Nova' : faseSelecionada === 'crescente' ? 'Crescente' : faseSelecionada === 'cheia' ? 'Cheia' : 'Minguante'}
              </h3>
              <button onClick={() => setFaseSelecionada(null)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '14px' }}>✕ Fechar</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
              {RITUAIS_SUGERIDOS[faseSelecionada]?.map((ritual, i) => (
                <div key={i} style={{
                  padding: '16px', borderRadius: '8px', background: '#F9FAFB',
                  border: '1px solid #E5E7EB'
                }}>
                  <h4 style={{ color: COR_FASE[faseSelecionada], fontSize: '14px', fontWeight: 'bold', margin: '0 0 6px 0' }}>{ritual.titulo}</h4>
                  <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 12px 0' }}>{ritual.descricao}</p>
                  <button onClick={() => preencherSugerido(ritual.titulo, ritual.descricao, faseSelecionada)} style={{
                    padding: '6px 16px', background: COR_FASE[faseSelecionada], color: '#fff',
                    border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                  }}>+ Agendar</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botao novo ritual + formulario */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ color: '#1E3A5F', fontSize: '18px', fontWeight: 'bold', margin: '0' }}>
            Rituais agendados ({rituais.length})
          </h2>
          <button onClick={() => { setShowForm(!showForm); setMessage('') }} style={{
            background: '#7C3AED', color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: '8px', fontSize: '14px',
            fontWeight: 'bold', cursor: 'pointer'
          }}>{showForm ? 'Cancelar' : '+ Novo ritual'}</button>
        </div>

        {message && (
          <div style={{
            marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
            background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${message.includes('Erro') ? '#FECACA' : '#BBF7D0'}`,
            color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: '14px'
          }}>{message}</div>
        )}

        {showForm && (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '20px',
            borderTop: '3px solid #7C3AED'
          }}>
            <h3 style={{ color: '#1E3A5F', fontSize: '16px', fontWeight: 'bold', margin: '0 0 20px 0' }}>Agendar ritual</h3>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Título *</label>
                  <input name="titulo" value={form.titulo} onChange={handleChange} required placeholder="Nome do ritual"
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Fase lunar</label>
                  <select name="fase_lunar" value={form.fase_lunar} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    <option value="nova">🌑 Lua Nova</option>
                    <option value="crescente">🌒 Lua Crescente</option>
                    <option value="cheia">🌕 Lua Cheia</option>
                    <option value="minguante">🌘 Lua Minguante</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Data *</label>
                  <input name="data_ritual" type="date" value={form.data_ritual} onChange={handleChange} required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Horário</label>
                  <input name="horario" type="time" value={form.horario} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Cliente (opcional)</label>
                  <select name="cliente_id" value={form.cliente_id} onChange={handleChange}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    <option value="">Sem cliente específico</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_completo}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Descrição</label>
                <textarea name="descricao" value={form.descricao} onChange={handleChange} rows={3} placeholder="Detalhes do ritual..."
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <button type="submit" disabled={saving} style={{
                padding: '12px 32px', background: saving ? '#9CA3AF' : '#7C3AED',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer'
              }}>{saving ? 'Salvando...' : 'Agendar ritual'}</button>
            </form>
          </div>
        )}

        {/* Lista de rituais */}
        {rituais.length === 0 ? (
          <div style={{
            background: '#ffffff', borderRadius: '12px', padding: '48px 32px',
            textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌙</div>
            <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>Nenhum ritual agendado para {MESES[mesAtual]}.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rituais.map(r => (
              <div key={r.id} style={{
                background: '#ffffff', borderRadius: '12px', padding: '16px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                borderLeft: `4px solid ${COR_FASE[r.fase_lunar] || '#6B7280'}`,
                opacity: r.status === 'concluido' ? 0.7 : 1
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h4 style={{
                        color: '#111827', fontSize: '15px', fontWeight: 'bold', margin: '0',
                        textDecoration: r.status === 'concluido' ? 'line-through' : 'none'
                      }}>{r.titulo}</h4>
                      <span style={{
                        background: r.status === 'concluido' ? '#F0FDF4' : '#FFF7ED',
                        color: r.status === 'concluido' ? '#15803D' : '#D97706',
                        padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold'
                      }}>{r.status === 'concluido' ? 'Concluído' : 'Pendente'}</span>
                    </div>
                    <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '0' }}>
                      📅 {new Date(r.data_ritual + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {r.horario && ` • ⏰ ${r.horario.slice(0, 5)}`}
                      {r.clientes?.nome_completo && ` • 👤 ${r.clientes.nome_completo}`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => toggleStatus(r.id, r.status)} style={{
                      padding: '6px 14px', background: r.status === 'concluido' ? '#FFF7ED' : '#F0FDF4',
                      color: r.status === 'concluido' ? '#D97706' : '#15803D',
                      border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer'
                    }}>{r.status === 'concluido' ? 'Reabrir' : '✓ Concluir'}</button>
                    <button onClick={() => deleteRitual(r.id)} style={{
                      padding: '6px 12px', background: '#FEF2F2', color: '#DC2626',
                      border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer'
                    }}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}