import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCached, setCache, invalidateCache } from '../app/components/AppProvider'

beforeEach(() => {
  invalidateCache()
})

describe('Query Cache', () => {
  it('returns null for uncached keys', () => {
    expect(getCached('nonexistent')).toBeNull()
  })

  it('stores and retrieves cached data', () => {
    setCache('test-key', { name: 'John' })
    expect(getCached('test-key')).toEqual({ name: 'John' })
  })

  it('returns null for expired cache entries', () => {
    vi.useFakeTimers()
    setCache('expire-test', { value: 42 })

    // Advance past TTL (60 seconds)
    vi.advanceTimersByTime(61_000)

    expect(getCached('expire-test')).toBeNull()
    vi.useRealTimers()
  })

  it('invalidates all cache when no prefix given', () => {
    setCache('a:1', 'data-a')
    setCache('b:2', 'data-b')
    invalidateCache()
    expect(getCached('a:1')).toBeNull()
    expect(getCached('b:2')).toBeNull()
  })

  it('invalidates only matching prefix', () => {
    setCache('profile:123', { name: 'Ana' })
    setCache('profile:456', { name: 'Carlos' })
    setCache('clientes:789', [1, 2, 3])

    invalidateCache('profile:')

    expect(getCached('profile:123')).toBeNull()
    expect(getCached('profile:456')).toBeNull()
    expect(getCached('clientes:789')).toEqual([1, 2, 3])
  })
})
