import { describe, expect, it } from 'vitest'
import { montarCsp } from '../csp'

function diretiva(csp: string, nome: string): string {
  const encontrada = csp.split('; ').find(d => d.startsWith(`${nome} `) || d === nome)
  if (!encontrada) throw new Error(`diretiva ausente: ${nome}`)
  return encontrada
}

describe('montarCsp', () => {
  it('remove unsafe-eval em produção', () => {
    // O React Refresh só existe em dev; em produção a diretiva era pura
    // superfície de ataque (cadeias de gadget que dependem de eval).
    expect(diretiva(montarCsp({ desenvolvimento: false }), 'script-src'))
      .not.toContain("'unsafe-eval'")
  })

  it('mantém unsafe-eval em desenvolvimento', () => {
    expect(diretiva(montarCsp({ desenvolvimento: true }), 'script-src'))
      .toContain("'unsafe-eval'")
  })

  it('script-src ainda tem unsafe-inline — limitação declarada, não descuido', () => {
    // Tirar isto exige nonce por requisição, e nonce exige toda página
    // dinâmica: com as rotas pré-renderizadas o HTML sai sem o nonce e TODOS os
    // scripts são bloqueados. Ver a nota no topo de src/lib/csp.ts e o ADR 0004.
    expect(diretiva(montarCsp({ desenvolvimento: false }), 'script-src'))
      .toContain("'unsafe-inline'")
  })

  it('style-src mantém unsafe-inline enquanto a UI for style={{...}}', () => {
    expect(diretiva(montarCsp({ desenvolvimento: false }), 'style-src'))
      .toContain("'unsafe-inline'")
  })

  it('fecha os vetores que não dependem de nonce', () => {
    const csp = montarCsp({ desenvolvimento: false })
    // base-uri: um <base> injetado reescreve todo caminho relativo, inclusive
    // o dos scripts. form-action: impede POST de credencial para fora.
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('preserva os destinos de que o app depende', () => {
    const csp = montarCsp({ desenvolvimento: false })
    expect(diretiva(csp, 'connect-src')).toContain('https://*.supabase.co')
    expect(diretiva(csp, 'connect-src')).toContain('https://api.stripe.com')
    expect(diretiva(csp, 'connect-src')).toContain('https://viacep.com.br')
    expect(diretiva(csp, 'frame-src')).toContain('https://js.stripe.com')
    expect(diretiva(csp, 'script-src')).toContain('https://maps.googleapis.com')
    expect(diretiva(csp, 'img-src')).toContain('blob:')
  })
})
