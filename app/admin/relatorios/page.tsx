'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../src/lib/supabase'
import AppShell from '../../components/AppShell'
import dynamic from 'next/dynamic'

const DynamicCharts = dynamic(() => import('./ReportCharts'), { ssr: false, loading: () => <p style={{ color: '#9CA3AF' }}>Carregando gráficos...</p> })

interface ReportSummary {
  id: string
  week_start: string
  week_end: string
  generated_at: string
  is_manual: boolean
  data: ReportData
}

interface ReportData {
  periodo: { inicio: string; fim: string; semana: number }
  usuarios: { total_acumulado: number; novos_na_semana: number; novos_por_dia: { data: string; qtd: number }[]; saidas_na_semana: number; saldo_semana: number }
  planos: { distribuicao_atual: { free: number; simples: number; profissional: number; gratuidade: number } }
  financeiro: { mrr_atual: number; arr_atual: number; receita_semana: number; inadimplencia_semana: number; faturas_pagas: number; faturas_vencidas: number; ticket_medio: number }
  uso_plataforma: { analises_realizadas: number; analises_concluidas: number; clientes_cadastrados: number }
  retencao: { churn_rate_semana: string }
  top_acoes_admin: { acao: string; qtd: number }[]
}

function fmt(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

export default function AdminRelatorios() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [selectedReport, setSelectedReport] = useState<ReportSummary | null>(null)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const loadReports = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/relatorios')
    if (res.ok) {
      const data = await res.json()
      setReports(data.reports || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadReports() }, [loadReports])

  async function generateReport(custom = false) {
    setGenerating(true)
    setMessage('')
    try {
      const body = custom && customStart && customEnd
        ? { week_start: customStart, week_end: customEnd }
        : {}
      const res = await fetch('/api/admin/relatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setMessage(data.error || 'Erro ao gerar'); setGenerating(false); return }
      setMessage('Relatório gerado com sucesso!')
      setSelectedReport(data)
      await loadReports()
    } catch { setMessage('Erro de conexão') }
    setGenerating(false)
  }

  function exportCSV(report: ReportData) {
    const lines = [
      'Métrica,Valor',
      `Período,${report.periodo.inicio} a ${report.periodo.fim}`,
      `Semana,${report.periodo.semana}`,
      `Total Usuários,${report.usuarios.total_acumulado}`,
      `Novos na Semana,${report.usuarios.novos_na_semana}`,
      `Saídas na Semana,${report.usuarios.saidas_na_semana}`,
      `Saldo,${report.usuarios.saldo_semana}`,
      `MRR,"${fmt(report.financeiro.mrr_atual)}"`,
      `ARR,"${fmt(report.financeiro.arr_atual)}"`,
      `Receita Semana,"${fmt(report.financeiro.receita_semana)}"`,
      `Inadimplência,"${fmt(report.financeiro.inadimplencia_semana)}"`,
      `Faturas Pagas,${report.financeiro.faturas_pagas}`,
      `Faturas Vencidas,${report.financeiro.faturas_vencidas}`,
      `Ticket Médio,"${fmt(report.financeiro.ticket_medio)}"`,
      `Plano Free,${report.planos.distribuicao_atual.free}`,
      `Plano Simples,${report.planos.distribuicao_atual.simples}`,
      `Plano Profissional,${report.planos.distribuicao_atual.profissional}`,
      `Gratuidades,${report.planos.distribuicao_atual.gratuidade}`,
      `Análises Realizadas,${report.uso_plataforma.analises_realizadas}`,
      `Análises Concluídas,${report.uso_plataforma.analises_concluidas}`,
      `Clientes Cadastrados,${report.uso_plataforma.clientes_cadastrados}`,
      `Churn Rate,${report.retencao.churn_rate_semana}`,
    ]
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_${report.periodo.inicio}_${report.periodo.fim}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell currentPage="admin/relatorios">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Relatórios Semanais</h1>
        <button onClick={() => generateReport(false)} disabled={generating}
          style={{ padding: '10px 20px', background: generating ? '#9CA3AF' : '#7C3AED', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: generating ? 'not-allowed' : 'pointer' }}>
          {generating ? 'Gerando...' : 'Gerar Relatório da Semana Anterior'}
        </button>
      </div>

      {message && (
        <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', background: message.includes('Erro') ? '#FEF2F2' : '#F0FDF4', color: message.includes('Erro') ? '#DC2626' : '#15803D', fontSize: '14px' }}>{message}</div>
      )}

      {/* Custom Period */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1E3A5F', margin: '0 0 12px 0' }}>Relatório sob demanda</h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px', color: '#374151' }}>
            Data início
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              style={{ display: 'block', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px' }} />
          </label>
          <label style={{ fontSize: '13px', color: '#374151' }}>
            Data fim
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              style={{ display: 'block', padding: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', marginTop: '4px' }} />
          </label>
          <button onClick={() => generateReport(true)} disabled={generating || !customStart || !customEnd}
            style={{ padding: '10px 20px', background: (!customStart || !customEnd) ? '#D1D5DB' : '#1E3A5F', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: (!customStart || !customEnd) ? 'not-allowed' : 'pointer' }}>
            Gerar
          </button>
        </div>
      </div>

      {/* Report Detail View */}
      {selectedReport && (
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ color: '#1E3A5F', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
              Semana {selectedReport.data.periodo.semana} — {fmtDate(selectedReport.data.periodo.inicio)} a {fmtDate(selectedReport.data.periodo.fim)}
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => exportCSV(selectedReport.data)}
                style={{ padding: '8px 16px', background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                Exportar CSV
              </button>
              <button onClick={() => setSelectedReport(null)}
                style={{ padding: '8px 16px', background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                Fechar
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Novos Usuários', value: `+${selectedReport.data.usuarios.novos_na_semana}`, color: '#15803D' },
              { label: 'Saídas', value: `-${selectedReport.data.usuarios.saidas_na_semana}`, color: '#DC2626' },
              { label: 'Saldo', value: `${selectedReport.data.usuarios.saldo_semana >= 0 ? '+' : ''}${selectedReport.data.usuarios.saldo_semana}`, color: selectedReport.data.usuarios.saldo_semana >= 0 ? '#15803D' : '#DC2626' },
              { label: 'MRR', value: fmt(selectedReport.data.financeiro.mrr_atual), color: '#1D4ED8' },
              { label: 'Receita Semana', value: fmt(selectedReport.data.financeiro.receita_semana), color: '#15803D' },
              { label: 'Churn', value: selectedReport.data.retencao.churn_rate_semana, color: '#D97706' },
            ].map((c, i) => (
              <div key={i} style={{ background: '#F9FAFB', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>{c.label}</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Plan Distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E3A5F', margin: '0 0 12px 0' }}>Distribuição de Planos</h4>
              {Object.entries(selectedReport.data.planos.distribuicao_atual).map(([plan, count]) => (
                <div key={plan} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ color: '#374151', fontSize: '14px', textTransform: 'capitalize' }}>{plan}</span>
                  <span style={{ fontWeight: 'bold', color: '#111827' }}>{count as number}</span>
                </div>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E3A5F', margin: '0 0 12px 0' }}>Financeiro</h4>
              {[
                { label: 'MRR', value: fmt(selectedReport.data.financeiro.mrr_atual) },
                { label: 'ARR', value: fmt(selectedReport.data.financeiro.arr_atual) },
                { label: 'Receita semana', value: fmt(selectedReport.data.financeiro.receita_semana) },
                { label: 'Inadimplência', value: fmt(selectedReport.data.financeiro.inadimplencia_semana) },
                { label: 'Ticket médio', value: fmt(selectedReport.data.financeiro.ticket_medio) },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ color: '#374151', fontSize: '14px' }}>{item.label}</span>
                  <span style={{ fontWeight: 'bold', color: '#111827' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Usage */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E3A5F', margin: '0 0 12px 0' }}>Uso da Plataforma</h4>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {[
                { label: 'Análises realizadas', value: selectedReport.data.uso_plataforma.analises_realizadas },
                { label: 'Análises concluídas', value: selectedReport.data.uso_plataforma.analises_concluidas },
                { label: 'Clientes cadastrados', value: selectedReport.data.uso_plataforma.clientes_cadastrados },
              ].map((item, i) => (
                <div key={i} style={{ background: '#F9FAFB', borderRadius: '8px', padding: '12px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7C3AED' }}>{item.value}</div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <DynamicCharts data={selectedReport.data} />
        </div>
      )}

      {/* Reports List */}
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
              <th style={{ textAlign: 'left', padding: '12px', color: '#6B7280' }}>Semana</th>
              <th style={{ textAlign: 'left', padding: '12px', color: '#6B7280' }}>Período</th>
              <th style={{ textAlign: 'center', padding: '12px', color: '#6B7280' }}>Novos</th>
              <th style={{ textAlign: 'center', padding: '12px', color: '#6B7280' }}>Saídas</th>
              <th style={{ textAlign: 'center', padding: '12px', color: '#6B7280' }}>MRR</th>
              <th style={{ textAlign: 'center', padding: '12px', color: '#6B7280' }}>Tipo</th>
              <th style={{ textAlign: 'center', padding: '12px', color: '#6B7280' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>Carregando...</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>Nenhum relatório gerado ainda. Clique em &quot;Gerar Relatório&quot; para criar o primeiro.</td></tr>
            ) : reports.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#374151' }}>Sem. {r.data.periodo?.semana || '—'}</td>
                <td style={{ padding: '12px', color: '#6B7280' }}>{fmtDate(r.week_start)} — {fmtDate(r.week_end)}</td>
                <td style={{ padding: '12px', textAlign: 'center', color: '#15803D', fontWeight: 'bold' }}>+{r.data.usuarios?.novos_na_semana || 0}</td>
                <td style={{ padding: '12px', textAlign: 'center', color: '#DC2626' }}>{r.data.usuarios?.saidas_na_semana || 0}</td>
                <td style={{ padding: '12px', textAlign: 'center', color: '#111827', fontWeight: 'bold' }}>{fmt(r.data.financeiro?.mrr_atual || 0)}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: r.is_manual ? '#FFFBEB' : '#F0FDF4', color: r.is_manual ? '#D97706' : '#15803D' }}>
                    {r.is_manual ? 'Manual' : 'Automático'}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                    <button onClick={() => setSelectedReport(r)}
                      style={{ padding: '6px 12px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      Ver
                    </button>
                    <button onClick={() => exportCSV(r.data)}
                      style={{ padding: '6px 12px', background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      CSV
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  )
}
