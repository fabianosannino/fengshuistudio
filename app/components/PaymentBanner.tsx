'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../src/lib/supabase'

interface OverdueInfo {
  hasOverdue: boolean
  daysOverdue: number
  amount: number
  isSuspended: boolean
}

export default function PaymentBanner() {
  const [info, setInfo] = useState<OverdueInfo | null>(null)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: invoices } = await supabase
        .from('invoices')
        .select('amount, amount_paid, due_date, status')
        .eq('user_id', user.id)
        .in('status', ['overdue', 'pending'])
        .order('due_date', { ascending: true })
        .limit(5)

      if (!invoices || invoices.length === 0) return

      const today = new Date()
      const overdueInvoices = invoices.filter(inv => {
        const due = new Date(inv.due_date)
        return due < today && inv.status === 'overdue'
      })

      if (overdueInvoices.length === 0) return

      const oldestDue = new Date(overdueInvoices[0].due_date)
      const daysOverdue = Math.floor((today.getTime() - oldestDue.getTime()) / (1000 * 60 * 60 * 24))
      const totalAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.amount - inv.amount_paid), 0)

      setInfo({
        hasOverdue: true,
        daysOverdue,
        amount: totalAmount,
        isSuspended: daysOverdue >= 7,
      })
    }
    check()
  }, [])

  if (!info || !info.hasOverdue) return null

  const isSuspended = info.isSuspended
  const bg = isSuspended ? '#FAEEE9' : '#FAF3E0'
  const border = isSuspended ? '#EBD3C7' : '#EEDFB4'
  const color = isSuspended ? '#B4533A' : '#8A6E2F'
  const icon = isSuspended ? '🔴' : '⚠'

  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: '10px',
      padding: '12px 20px', marginBottom: '16px', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <div>
          <div style={{ color, fontSize: '14px', fontWeight: 'bold' }}>
            {isSuspended
              ? 'Acesso suspenso por falta de pagamento.'
              : `Você tem uma fatura em atraso (${info.daysOverdue} dia${info.daysOverdue > 1 ? 's' : ''}).`}
          </div>
          <div style={{ color: '#6B7280', fontSize: '13px' }}>
            {isSuspended
              ? 'Suas análises estão salvas. Regularize para retomar o acesso completo.'
              : `Valor: R$ ${info.amount.toFixed(2).replace('.', ',')}. Regularize para manter o acesso completo.`}
          </div>
        </div>
      </div>
      <a href="/planos" style={{
        padding: '8px 20px', background: color, color: '#fff', borderRadius: '8px',
        textDecoration: 'none', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap'
      }}>
        {isSuspended ? 'Regularizar assinatura' : 'Pagar agora'}
      </a>
    </div>
  )
}
