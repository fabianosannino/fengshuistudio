'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'
import { logger } from '../../src/lib/logger'

const ORIGEM = 'NotificationBell'

export default function NotificationBell() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<{id: string; type: string; content: string; created_at: string}[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, count: total, error } = await supabase
        .from('payment_notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) {
        // Sem isto, uma falha de leitura vira "nenhuma notificação" — o sino
        // some da tela como se estivesse tudo em dia.
        logger.error('Falha ao carregar notificações', { route: ORIGEM, error: error.message })
        return
      }
      setNotifications(data || [])
      setCount(total || 0)
    }
    load()
  }, [])

  async function markRead(id: string) {
    const { error } = await supabase
      .from('payment_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      // Marcar como lida só na tela faria a notificação reaparecer no próximo
      // carregamento, sem explicação. Melhor ela continuar visível.
      logger.error('Falha ao marcar notificação como lida', { route: ORIGEM, error: error.message })
      return
    }

    setNotifications(prev => prev.filter(n => n.id !== id))
    setCount(prev => Math.max(0, prev - 1))
  }

  if (count === 0) return null

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(!open)} style={{
        background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '4px'
      }}>
        <span style={{ fontSize: '18px' }}>🔔</span>
        <span style={{
          position: 'absolute', top: '-2px', right: '-2px', background: '#DC2626', color: '#fff',
          borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', fontWeight: 'bold',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>{count}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, width: '300px', background: '#fff',
          borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 100, overflow: 'hidden'
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #E5E7EB', fontSize: '13px', fontWeight: 'bold', color: '#0E1B2C' }}>
            Notificações ({count})
          </div>
          {notifications.map(n => (
            <div key={n.id} style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', fontSize: '12px', color: '#374151' }}>
              <div>{n.content}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ color: '#9CA3AF', fontSize: '10px' }}>{new Date(n.created_at).toLocaleDateString('pt-BR')}</span>
                <button type="button" onClick={() => markRead(n.id)} style={{ background: 'none', border: 'none', color: '#2E7D6B', fontSize: '10px', cursor: 'pointer' }}>Marcar como lida</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
