'use client'

import { useEffect, useState, useCallback } from 'react'
import AppShell from '../../components/AppShell'
import Skeleton from '../../components/Skeleton'
import type { AuditLogEntry } from '../../../src/lib/types'
import { dataDeAuditoria } from '../../../src/lib/data-auditoria'
import { KeyRound, Ban, ArrowUpCircle, CircleCheck, FileText, ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react'

const PAGE_SIZE = 30


const ACTION_LABELS: Record<string, { label: string; Icon: LucideIcon; color: string }> = {
  generate_keys:  { label: 'Geração de chaves', Icon: KeyRound, color: '#2E7D6B' },
  cancel_key:     { label: 'Cancelamento de chave', Icon: Ban, color: '#DC2626' },
  promote_user:   { label: 'Promoção de usuário', Icon: ArrowUpCircle, color: '#15803D' },
  use_key:        { label: 'Uso de chave', Icon: CircleCheck, color: '#1D4ED8' },
}

export default function AdminAuditoria() {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/admin/auditoria?page=${page}`)
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    }
    setLoading(false)
  }, [page])

  useEffect(() => {
    /*
     * Carga de dados no cliente: a função liga o spinner de forma síncrona.
     * Sair deste padrão é migrar para server component / camada de dados —
     * o débito R1 registrado na auditoria de 2026-07-18 —, não reescrever
     * este efeito. A supressão é por sítio, e nova violação quebra o CI.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs()
  }, [fetchLogs])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (loading) {
    return (
      <AppShell currentPage="admin/auditoria">
        <div style={{ marginBottom: '24px' }}>
          <Skeleton width="260px" height="24px" />
          <div style={{ marginTop: '8px' }}><Skeleton width="200px" height="16px" /></div>
        </div>
        <Skeleton variant="list" rows={8} />
      </AppShell>
    )
  }

  return (
    <AppShell currentPage="admin/auditoria">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ color: '#0E1B2C', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Log de Auditoria</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>{total} registro{total !== 1 ? 's' : ''}</p>
        </div>
        <a href="/admin/chaves" style={{
          padding: '8px 16px', background: '#2E7D6B', color: '#fff', borderRadius: '8px',
          fontSize: '13px', fontWeight: 'bold', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
        }}><ArrowLeft size={15} strokeWidth={2} aria-hidden="true" /> Voltar para Chaves</a>
      </div>

      <div style={{
        background: '#fff', borderRadius: '12px', padding: '20px 24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB',
      }}>
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: '14px' }}>
            Nenhum registro de auditoria encontrado
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                  {['Data', 'Ação', 'Alvo', 'Detalhes', 'Realizado por'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 8px', color: '#6B7280', fontWeight: 'bold', fontSize: '11px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const a = ACTION_LABELS[log.action] || { label: log.action, Icon: FileText, color: '#6B7280' }
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '10px 8px', color: '#6B7280', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {dataDeAuditoria(log.performed_at)}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: a.color + '15', color: a.color,
                          padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold',
                        }}>
                          <a.Icon size={12} strokeWidth={2} aria-hidden="true" /> {a.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#374151', fontSize: '12px' }}>
                        {log.target_type === 'user' && 'Usuário'}
                        {log.target_type === 'activation_key' && 'Chave'}
                        {log.target_id && <span style={{ color: '#9CA3AF', marginLeft: '4px', fontFamily: 'monospace', fontSize: '10px' }}>{log.target_id.slice(0, 8)}...</span>}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#6B7280', fontSize: '11px', maxWidth: '250px' }}>
                        {log.details && (
                          <div style={{ lineHeight: '1.5' }}>
                            {'quantidade' in log.details && <span>Qtd: {String(log.details.quantidade)} </span>}
                            {'nome' in log.details && <span>Nome: {String(log.details.nome)} </span>}
                            {'from_plan' in log.details && <span>{String(log.details.from_plan)} → {String(log.details.to_plan)} </span>}
                            {'note' in log.details && Boolean(log.details.note) && <span style={{ fontStyle: 'italic' }}>&quot;{String(log.details.note)}&quot;</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#374151', fontSize: '12px' }}>
                        {log.performer?.nome_completo || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: '1px solid #E5E7EB',
                background: page === 1 ? '#F9FAFB' : '#fff', color: page === 1 ? '#D1D5DB' : '#374151',
                cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}
            ><ArrowLeft size={13} strokeWidth={2} aria-hidden="true" /> Anterior</button>
            <span style={{ color: '#6B7280', fontSize: '12px' }}>Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: '1px solid #E5E7EB',
                background: page === totalPages ? '#F9FAFB' : '#fff', color: page === totalPages ? '#D1D5DB' : '#374151',
                cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}
            >Próximo <ArrowRight size={13} strokeWidth={2} aria-hidden="true" /></button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
