import { describe, it, expect, vi, beforeEach } from 'vitest'

// The rate-limit module uses a module-level setInterval for cleanup.
// We need to mock timers before importing.
vi.useFakeTimers()

// Dynamic import after timer mock is set up
const { rateLimit } = await import('../rate-limit')

describe('rateLimit', () => {
  beforeEach(() => {
    // Advance time far enough to expire all existing entries,
    // effectively resetting the store between tests.
    vi.advanceTimersByTime(120_000)
  })

  it('allows requests under the limit', () => {
    const result = rateLimit('10.0.0.1', { limit: 5, windowMs: 60_000 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('decrements remaining count on successive calls', () => {
    const ip = '10.0.0.2'
    const opts = { limit: 3, windowMs: 60_000 }

    const r1 = rateLimit(ip, opts)
    expect(r1.success).toBe(true)
    expect(r1.remaining).toBe(2)

    const r2 = rateLimit(ip, opts)
    expect(r2.success).toBe(true)
    expect(r2.remaining).toBe(1)

    const r3 = rateLimit(ip, opts)
    expect(r3.success).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it('blocks requests over the limit', () => {
    const ip = '10.0.0.3'
    const opts = { limit: 2, windowMs: 60_000 }

    rateLimit(ip, opts) // 1
    rateLimit(ip, opts) // 2 (at limit)
    const blocked = rateLimit(ip, opts) // 3 (over limit)

    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('resets after window expires', () => {
    const ip = '10.0.0.4'
    const opts = { limit: 1, windowMs: 10_000 }

    const r1 = rateLimit(ip, opts)
    expect(r1.success).toBe(true)

    const r2 = rateLimit(ip, opts)
    expect(r2.success).toBe(false)

    // Advance past the window
    vi.advanceTimersByTime(11_000)

    const r3 = rateLimit(ip, opts)
    expect(r3.success).toBe(true)
    expect(r3.remaining).toBe(0) // limit 1, used 1 => 0 remaining
  })

  it('tracks different IPs separately', () => {
    const opts = { limit: 1, windowMs: 60_000 }

    const r1 = rateLimit('10.0.0.10', opts)
    expect(r1.success).toBe(true)

    // Second IP should still be allowed
    const r2 = rateLimit('10.0.0.11', opts)
    expect(r2.success).toBe(true)

    // First IP should be blocked
    const r3 = rateLimit('10.0.0.10', opts)
    expect(r3.success).toBe(false)
  })

  it('uses default limit of 30 and windowMs of 60_000', () => {
    const ip = '10.0.0.20'
    const result = rateLimit(ip)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(29) // 30 - 1
  })
})
