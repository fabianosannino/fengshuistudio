'use client'

/**
 * Estado que só existe no browser, sem efeito de sincronização.
 *
 * O padrão anterior — `useState(false)` + `useEffect(() => setX(valorReal))` —
 * renderiza uma vez com o valor errado e corrige no render seguinte. Além do
 * flash visível (tema claro piscando antes do escuro), é o que o
 * `react-hooks/set-state-in-effect` aponta: cascata de renders.
 *
 * `useSyncExternalStore` existe exatamente para isto: declara a fonte externa
 * (o browser), o valor do lado do servidor e como reagir a mudanças. Sem
 * efeito, sem render intermediário.
 */

import { useSyncExternalStore } from 'react'

const LARGURA_MOBILE = 768

/** Nunca muda depois de montado: assinar é um no-op. */
function semAssinatura(): () => void {
  return () => {}
}

/**
 * `false` durante a renderização no servidor, `true` no cliente.
 *
 * Para o conteúdo que depende de `window`/`localStorage` e por isso não pode
 * sair igual dos dois lados.
 */
export function useMontado(): boolean {
  return useSyncExternalStore(semAssinatura, () => true, () => false)
}

function assinarResize(callback: () => void): () => void {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

/** Viewport estreita. No servidor assume desktop — o mesmo padrão de antes. */
export function useEhMobile(): boolean {
  return useSyncExternalStore(
    assinarResize,
    () => window.innerWidth < LARGURA_MOBILE,
    () => false
  )
}

// ── Preferências em localStorage ──────────────────────────────────────────────

const ouvintes = new Set<() => void>()

function assinarPreferencia(callback: () => void): () => void {
  ouvintes.add(callback)
  // `storage` cobre a mudança feita em OUTRA aba; o Set cobre esta aba, onde o
  // evento nativo não dispara para quem escreveu.
  window.addEventListener('storage', callback)
  return () => {
    ouvintes.delete(callback)
    window.removeEventListener('storage', callback)
  }
}

function lerPreferencia(chave: string): string | null {
  try {
    return localStorage.getItem(chave)
  } catch {
    // Navegação privada, storage bloqueado: cai no padrão.
    return null
  }
}

/**
 * Preferência booleana persistida, compartilhada entre todos os componentes
 * que a leem.
 *
 * O tema escuro era lido em três lugares (`AppShell`, `FlowLayout`,
 * `AppProvider`), cada um com o seu `useState` — alternar num não atualizava os
 * outros até o próximo carregamento. Com uma fonte só, atualiza em todos.
 *
 * O snapshot é `boolean` de propósito: `useSyncExternalStore` compara por
 * identidade, e devolver objeto novo a cada leitura entraria em loop.
 */
export function usePreferenciaBooleana(
  chave: string,
  padrao: boolean
): [boolean, (valor: boolean) => void] {
  const valor = useSyncExternalStore(
    assinarPreferencia,
    () => {
      const bruto = lerPreferencia(chave)
      return bruto === null ? padrao : bruto === 'true'
    },
    () => padrao
  )

  const definir = (novo: boolean) => {
    try {
      localStorage.setItem(chave, String(novo))
    } catch {
      // Sem persistência, mas a tela ainda precisa reagir.
    }
    for (const ouvinte of ouvintes) ouvinte()
  }

  return [valor, definir]
}

/**
 * Lista persistida em localStorage.
 *
 * `useSyncExternalStore` compara o snapshot por identidade, e `JSON.parse`
 * devolve um objeto novo a cada chamada — o que entraria em loop de render.
 * Por isso o parse é memorizado pelo texto cru: mesma string, mesma referência.
 */
const cacheJson = new Map<string, { bruto: string | null; valor: unknown }>()

export function usePreferenciaLista<T>(
  chave: string,
  padrao: T[]
): [T[], (valor: T[]) => void] {
  const valor = useSyncExternalStore(
    assinarPreferencia,
    () => {
      const bruto = lerPreferencia(chave)
      const memorizado = cacheJson.get(chave)
      if (memorizado && memorizado.bruto === bruto) return memorizado.valor as T[]

      let analisado: T[] = padrao
      if (bruto) {
        try {
          const cru = JSON.parse(bruto)
          if (Array.isArray(cru)) analisado = cru as T[]
        } catch {
          // Conteúdo corrompido: fica o padrão, e a próxima escrita conserta.
        }
      }
      cacheJson.set(chave, { bruto, valor: analisado })
      return analisado
    },
    () => padrao
  )

  const definir = (novo: T[]) => {
    try {
      localStorage.setItem(chave, JSON.stringify(novo))
    } catch {
      // Sem persistência, mas a tela ainda precisa reagir.
    }
    cacheJson.delete(chave)
    for (const ouvinte of ouvintes) ouvinte()
  }

  return [valor, definir]
}

export const PREFERENCIA_TEMA_ESCURO = 'fengshui-dark'
export const PREFERENCIA_SIDEBAR_ABERTA = 'fengshui-sidebar'
export const PREFERENCIA_ITENS_CHI = 'fengshui-custom-chi-items'
