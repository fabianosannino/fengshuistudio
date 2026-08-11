'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '../../src/lib/supabase'
import { usePreferenciaBooleana, PREFERENCIA_TEMA_ESCURO } from './hooks-cliente'
import type { Profile } from '../../src/lib/types'
import type { User } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────
interface AppState {
  user: User | null
  profile: Profile | null
  darkMode: boolean
  loading: boolean
  online: boolean
  toggleDarkMode: () => void
  refreshProfile: () => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// ─── Simple cache for Supabase queries ───────────────────────
const queryCache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 60_000 // 1 minute

export function getCached<T>(key: string): T | null {
  const entry = queryCache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T
  return null
}

export function setCache(key: string, data: unknown) {
  queryCache.set(key, { data, ts: Date.now() })
}

export function invalidateCache(prefix?: string) {
  if (!prefix) { queryCache.clear(); return }
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) queryCache.delete(key)
  }
}

// ─── Retry fetch with exponential backoff ────────────────────
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelay = 1000,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)))
    }
  }
  throw new Error('Unreachable')
}

// ─── Provider ────────────────────────────────────────────────
export default function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [darkMode, setDarkMode] = usePreferenciaBooleana(PREFERENCIA_TEMA_ESCURO, false)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(true)

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUser(null); setProfile(null); return }
    setUser(user)

    const cached = getCached<Profile>(`profile:${user.id}`)
    if (cached) { setProfile(cached); return }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setCache(`profile:${user.id}`, data)
    } else {
      const fallback: Profile = {
        nome_completo: user.user_metadata?.nome_completo || '',
        tipo_usuario: user.user_metadata?.tipo_usuario || '',
        role: user.user_metadata?.role || '',
        plano: 'freemium',
      }
      setProfile(fallback)
    }
  }, [])

  useEffect(() => {
    // Auth + profile
    /*
     * Carga de dados no cliente: a função liga o spinner de forma síncrona.
     * Sair deste padrão é migrar para server component / camada de dados —
     * o débito R1 registrado na auditoria de 2026-07-18 —, não reescrever
     * este efeito. A supressão é por sítio, e nova violação quebra o CI.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProfile().finally(() => setLoading(false))

    // Online/offline detection
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    setOnline(navigator.onLine)

    // Register service worker (PWA)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed — not critical
      })
    }

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [refreshProfile])

  // A persistência é do hook — e agora AppShell, FlowLayout e este provider
  // leem a MESMA preferência: alternar em um atualiza os três na hora.
  function toggleDarkMode() { setDarkMode(!darkMode) }

  return (
    <AppContext.Provider value={{ user, profile, darkMode, loading, online, toggleDarkMode, refreshProfile }}>
      {!online && (
        <div role="alert" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#DC2626', color: '#fff', textAlign: 'center',
          padding: '8px 16px', fontSize: '13px', fontWeight: 'bold',
          fontFamily: 'var(--font-figtree), sans-serif',
        }}>
          Sem conexão com a internet. Verifique sua rede.
        </div>
      )}
      {children}
    </AppContext.Provider>
  )
}
