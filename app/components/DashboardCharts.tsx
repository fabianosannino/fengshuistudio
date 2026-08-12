'use client'

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import type { StatusChartEntry, PagamentoMesChartEntry, ConsultaMesChartEntry, ClienteMesChartEntry } from '../../src/lib/types'

const CORES_STATUS: Record<string, string> = {
  rascunho: '#94A3B8',
  em_andamento: '#C9A227',
  finalizada: '#2E7D6B',
  arquivada: '#6B7280',
}

const COR_PAGO = '#2E7D6B'
const COR_PENDENTE = '#C9A227'
const COR_ATRASADO = '#B4533A'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Status Consultas Pie Chart ──
export function StatusPieChart({ statusData }: { statusData: StatusChartEntry[] }) {
  if (statusData.length === 0) {
    return (
      <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Nenhuma consulta registrada ainda</p>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={statusData}
          cx="50%" cy="50%"
          innerRadius={55} outerRadius={90}
          paddingAngle={4} dataKey="value" stroke="none"
        >
          {statusData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`${value} consulta(s)`, '']}
          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
        />
        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '13px', color: '#6B7280' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Pagamentos Bar Chart ──
export function PagamentosBarChart({ pagamentosData }: { pagamentosData: PagamentoMesChartEntry[] }) {
  if (pagamentosData.length === 0) {
    return (
      <div style={{ height: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Nenhum pagamento registrado</p>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={pagamentosData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), '']}
          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
        />
        <Bar dataKey="Recebido" stackId="a" fill={COR_PAGO} radius={[0, 0, 0, 0]} maxBarSize={28} />
        <Bar dataKey="Pendente" stackId="a" fill={COR_PENDENTE} radius={[0, 0, 0, 0]} maxBarSize={28} />
        <Bar dataKey="Atrasado" stackId="a" fill={COR_ATRASADO} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Consultas Line Chart ──
export function ConsultasLineChart({ consultasMesData }: { consultasMesData: ConsultaMesChartEntry[] }) {
  if (consultasMesData.length === 0) {
    return (
      <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Crie consultas para ver a evolucao</p>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={consultasMesData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => [`${value}`, 'Consultas']}
          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
        />
        <Line type="monotone" dataKey="consultas" stroke="#2E7D6B" strokeWidth={3}
          dot={{ fill: '#2E7D6B', r: 5, strokeWidth: 2, stroke: '#ffffff' }}
          activeDot={{ r: 7, fill: '#2E7D6B', stroke: '#ffffff', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Clientes Bar Chart ──
export function ClientesBarChart({ clientesMesData }: { clientesMesData: ClienteMesChartEntry[] }) {
  if (clientesMesData.length === 0) {
    return (
      <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Cadastre clientes para ver o grafico</p>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={clientesMesData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => [`${value}`, 'Clientes']}
          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '13px' }}
        />
        <Bar dataKey="clientes" fill="#2E7D6B" radius={[6, 6, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}
