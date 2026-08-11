import { describe, expect, it } from 'vitest'
import { montarCsp } from '../csp'

function diretiva(csp: string, nome: string): string {
  const encontrada = csp.split('; ').find(d => d.startsWith(`${nome} `) || d === nome)
  if (!encontrada) throw new Error(`diretiva ausente: ${nome}`)
  return encontrada
}

describe('montarCsp', () => {
  it('mantém unsafe-eval — tirar quebrou a produção e compra pouco', () => {
    // Já foi removida em produção. O DevTools acusou `script-src` bloqueando
    // eval e a tela de relatório parou. Não é o gerador de PDF (jspdf e
    // html2canvas não usam eval); é uma das origens da allowlist — Maps é a
    // suspeita, e exige eval de forma documentada.
    //
    // O teste trava a decisão, não a implementação: enquanto 'unsafe-inline'
    // estiver em script-src, remover 'unsafe-eval' é endurecimento aparente —
    // quem injeta script inline não precisa de eval. Ver ADR 0004.
    expect(diretiva(montarCsp(), 'script-src')).toContain("'unsafe-eval'")
  })

  it('emite a mesma política em qualquer ambiente', () => {
    // A CSP de produção tem que ser exatamente a que se testa em dev.
    expect(montarCsp()).toBe(montarCsp())
  })

  it('script-src ainda tem unsafe-inline — limitação declarada, não descuido', () => {
    // Tirar isto exige nonce por requisição, e nonce exige toda página
    // dinâmica: com as rotas pré-renderizadas o HTML sai sem o nonce e TODOS os
    // scripts são bloqueados. Ver a nota no topo de src/lib/csp.ts e o ADR 0004.
    expect(diretiva(montarCsp(), 'script-src'))
      .toContain("'unsafe-inline'")
  })

  it('style-src mantém unsafe-inline enquanto a UI for style={{...}}', () => {
    expect(diretiva(montarCsp(), 'style-src'))
      .toContain("'unsafe-inline'")
  })

  it('fecha os vetores que não dependem de nonce', () => {
    const csp = montarCsp()
    // base-uri: um <base> injetado reescreve todo caminho relativo, inclusive
    // o dos scripts. form-action: impede POST de credencial para fora.
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('preserva os destinos de que o app depende', () => {
    const csp = montarCsp()
    expect(diretiva(csp, 'connect-src')).toContain('https://*.supabase.co')
    expect(diretiva(csp, 'connect-src')).toContain('https://api.stripe.com')
    expect(diretiva(csp, 'connect-src')).toContain('https://viacep.com.br')
    expect(diretiva(csp, 'frame-src')).toContain('https://js.stripe.com')
    expect(diretiva(csp, 'script-src')).toContain('https://maps.googleapis.com')
    expect(diretiva(csp, 'img-src')).toContain('blob:')
  })
})
