import { describe, it, expect, beforeEach, vi } from 'vitest'

// We need to reset the module state between tests
let rateLimit: typeof import('../src/lib/rate-limit').rateLimit

beforeEach(async () => {
  vi.resetModules()
  // Use fake timers to avoid the setInterval cleanup running
  vi.useFakeTimers()
  const mod = await import('../src/lib/rate-limit')
  rateLimit = mod.rateLimit
})

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    const result = rateLimit('192.168.1.1', { limit: 5, windowMs: 60_000 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('tracks multiple requests from same IP', () => {
    rateLimit('10.0.0.1', { limit: 3, windowMs: 60_000 })
    rateLimit('10.0.0.1', { limit: 3, windowMs: 60_000 })
    const result = rateLimit('10.0.0.1', { limit: 3, windowMs: 60_000 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('blocks requests over the limit', () => {
    const opts = { limit: 2, windowMs: 60_000 }
    rateLimit('1.2.3.4', opts) // 1
    rateLimit('1.2.3.4', opts) // 2
    const result = rateLimit('1.2.3.4', opts) // 3 = blocked
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('isolates different IPs', () => {
    const opts = { limit: 1, windowMs: 60_000 }
    rateLimit('ip-a', opts)
    const result = rateLimit('ip-b', opts)
    expect(result.success).toBe(true)
  })

  it('resets after window expires', () => {
    const opts = { limit: 1, windowMs: 1_000 }
    rateLimit('reset-ip', opts)
    const blocked = rateLimit('reset-ip', opts)
    expect(blocked.success).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(1_100)

    const afterReset = rateLimit('reset-ip', opts)
    expect(afterReset.success).toBe(true)
    expect(afterReset.remaining).toBe(0)
  })

  it('uses default limit of 30 when no options provided', () => {
    const result = rateLimit('default-ip')
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(29)
  })
})
