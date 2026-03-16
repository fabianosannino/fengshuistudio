'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import AppShell from '../components/AppShell'
import Skeleton from '../components/Skeleton'
import ConfirmModal from '../components/ConfirmModal'
import type { Consulta } from '../../src/lib/types'

const PROF_TYPES = ['consultor', 'arquiteto', 'feng_shui', 'decorador', 'outro_profissional']
const PAGE_SIZE = 10

export default function Consultas() {
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isProfessional, setIsProfessional] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('plano, tipo_usuario, role')
        .eq('id', user.id)
        .single()

      const isProf = prof?.plano === 'pro'
        || (prof?.tipo_usuario ? PROF_TYPES.includes(prof.tipo_usuario) : false)
        || prof?.role === 'consultor'
      setIsProfessional(isProf)

      const { data } = await supabase
        .from('consultas')
        .select(`*, clientes(nome_completo)`)
        .eq('consultor_id', user.id)
        .order('criado_em', { ascending: false })
      setConsultas(data || [])
      setLoading(false)
    }
    load()
  }, [])

  function statusColor(status: string) {
    const map: Record<string, string> = { rascunho: '#6B7280', em_andamento: '#D97706', finalizada: '#15803D', arquivada: '#9CA3AF' }
    return map[status] || '#6B7280'
  }

  function statusLabel(status: string) {
    const map: Record<string, string> = { rascunho: 'Rascunho', em_andamento: 'Em andamento', finalizada: 'Finalizada', arquivada: 'Arquivada' }
    return map[status] || status
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('consultas').delete().eq('id', id)
    if (error) {
      setMessage('Erro ao excluir: ' + error.message)
    } else {
      setConsultas(consultas.filter(c => c.id !== id))
    }
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <AppShell currentPage="consultas">
        <div style={{ marginBottom: '24px' }}>
          <Skeleton width="200px" height="24px" />
          <div style={{ marginTop: '8px' }}><Skeleton width="260px" height="16px" /></div>
        </div>
        <Skeleton variant="list" rows={4} />
      </AppShell>
    )
  }

  const totalPages = Math.ceil(consultas.length / PAGE_SIZE)
  const paginatedItems = consultas.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <AppShell currentPage="consultas">

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#1E3A5F', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            {isProfessional ? 'Consultas' : 'Meus Imóveis'}
          </h1>
          <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>
            {consultas.length} {isProfessional ? 'consulta(s) registrada(s)' : 'imóvel(is) cadastrado(s)'}
          </p>
        </div>
        <button onClick={() => window.location.href = '/consultas/nova'} style={{
          background: '#7C3AED', color: '#ffffff', border: 'none',
          padding: '12px 24px', borderRadius: '8px', fontSize: '15px',
          fontWeight: 'bold', cursor: 'pointer'
        }}>{isProfessional ? '+ Nova consulta' : '+ Novo imóvel'}</button>
      </div>

      {message && (
        <div style={{
          marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#DC2626', fontSize: '14px'
        }}>{message}</div>
      )}

      {consultas.length === 0 ? (
        <div style={{
          background: '#ffffff', borderRadius: '12px', padding: '64px 32px',
          textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>{isProfessional ? '📋' : '🏠'}</div>
          <h3 style={{ color: '#1E3A5F', fontSize: '18px', marginBottom: '8px' }}>
            {isProfessional ? 'Nenhuma consulta registrada' : 'Nenhum imóvel cadastrado'}
          </h3>
          <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
            {isProfessional
              ? 'Clique em "Nova consulta" para começar um diagnóstico Ba Gua'
              : 'Cadastre seu imóvel para receber o diagnóstico Feng Shui personalizado'}
          </p>
          <button onClick={() => window.location.href = '/consultas/nova'} style={{
            background: '#7C3AED', color: '#ffffff', border: 'none',
            padding: '12px 24px', borderRadius: '8px', fontSize: '15px',
            fontWeight: 'bold', cursor: 'pointer'
          }}>{isProfessional ? 'Iniciar primeira consulta' : 'Cadastrar meu imóvel'}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {paginatedItems.map(consulta => (
            <div key={consulta.id} style={{
              background: '#ffffff', borderRadius: '12px', padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              borderLeft: `4px solid ${statusColor(consulta.status)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '12px'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                  <h3 style={{ color: '#111827', fontSize: '16px', fontWeight: 'bold', margin: '0' }}>
                    {consulta.nome_imovel || 'Imóvel'}
                  </h3>
                  <span style={{
                    background: `${statusColor(consulta.status)}20`,
                    color: statusColor(consulta.status),
                    padding: '2px 10px', borderRadius: '20px',
                    fontSize: '12px', fontWeight: 'bold'
                  }}>{statusLabel(consulta.status)}</span>
                  {(()=>{
                    const be=consulta.bagua_entrada as any
                    const finalizada=!!(be?.finalizada_em)
                    const emAndamento=!!(be?.planta_url)&&!finalizada
                    if(finalizada) return <span style={{background:'#F0FDF4',color:'#15803D',padding:'2px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:'bold'}}>{`☯ Conclu\u00edda ${new Date(be.finalizada_em).toLocaleDateString('pt-BR')}`}</span>
                    if(emAndamento) return <span style={{background:'#FFF7ED',color:'#D97706',padding:'2px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:'bold'}}>☯ Em andamento</span>
                    return null
                  })()}
                </div>
                {isProfessional && consulta.clientes?.nome_completo && (
                  <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 4px 0' }}>
                    👤 {consulta.clientes.nome_completo}
                  </p>
                )}
                <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '0' }}>
                  📅 {new Date(consulta.criado_em).toLocaleDateString('pt-BR')}
                  {consulta.tipo_imovel && ` • ${consulta.tipo_imovel}`}
                  {consulta.area_total_m2 && ` • ${consulta.area_total_m2}m²`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.location.href = `/consultas/${consulta.id}`} style={{
                  padding: '8px 20px', background: '#7C3AED', color: '#fff',
                  border: 'none', borderRadius: '6px', fontSize: '13px',
                  fontWeight: 'bold', cursor: 'pointer'
                }}>Abrir</button>
                {consulta.status === 'finalizada' && (
                  <button onClick={() => window.location.href = `/consultas/${consulta.id}/relatorio`} style={{
                    padding: '8px 20px', background: '#1E3A5F', color: '#fff',
                    border: 'none', borderRadius: '6px', fontSize: '13px',
                    fontWeight: 'bold', cursor: 'pointer'
                  }}>Relatório</button>
                )}
                <button onClick={() => setDeleteTarget(consulta.id)} style={{
                  padding: '8px 16px', background: '#FEF2F2', color: '#DC2626',
                  border: '1px solid #FECACA', borderRadius: '6px', fontSize: '13px',
                  cursor: 'pointer'
                }}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: '8px', marginTop: '24px',
        }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB',
              background: currentPage === 1 ? '#F9FAFB' : '#ffffff',
              color: currentPage === 1 ? '#D1D5DB' : '#374151',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 'bold',
            }}
          >← Anterior</button>
          <span style={{ color: '#6B7280', fontSize: '13px' }}>
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB',
              background: currentPage === totalPages ? '#F9FAFB' : '#ffffff',
              color: currentPage === totalPages ? '#D1D5DB' : '#374151',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 'bold',
            }}
          >Próximo →</button>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={isProfessional ? 'Excluir consulta' : 'Excluir imóvel'}
        message={isProfessional
          ? 'Tem certeza que deseja excluir esta consulta? Esta ação não pode ser desfeita.'
          : 'Tem certeza que deseja excluir este imóvel? Esta ação não pode ser desfeita.'}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  )
}
