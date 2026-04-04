'use client'

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ReportData {
  usuarios: { novos_por_dia: { data: string; qtd: number }[] }
  planos: { distribuicao_atual: { free: number; simples: number; profissional: number; gratuidade: number } }
}

const PLAN_COLORS: Record<string, string> = {
  free: '#6B7280',
  simples: '#059669',
  profissional: '#7C3AED',
  gratuidade: '#1D4ED8',
}

export default function ReportCharts({ data }: { data: ReportData }) {
  const dailyData = (data.usuarios?.novos_por_dia || []).map(d => ({
    dia: d.data.slice(5), // MM-DD
    qtd: d.qtd,
  }))

  const planData = Object.entries(data.planos?.distribuicao_atual || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: value as number,
    color: PLAN_COLORS[name] || '#9CA3AF',
  })).filter(d => d.value > 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Daily New Users */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E3A5F', margin: '0 0 12px 0' }}>Novos Usuários por Dia</h4>
        {dailyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="qtd" fill="#7C3AED" name="Novos" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Sem dados para o período</p>
        )}
      </div>

      {/* Plan Distribution Pie */}
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E3A5F', margin: '0 0 12px 0' }}>Distribuição de Planos</h4>
        {planData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {planData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Sem dados para o período</p>
        )}
      </div>
    </div>
  )
}
