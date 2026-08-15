import { describe, expect, it } from 'vitest'
import { ROTAS_MARKETING, ehRotaDeMarketing } from '../auth-rotas'

/**
 * As rotas que a Navbar e o rodapé da home pública linkam. Um visitante que
 * clica em qualquer uma delas precisa chegar à página — não ao login.
 *
 * Era o defeito: para saber o preço era preciso ter conta, e para decidir
 * criar conta era preciso saber o preço.
 */
const LINKS_DA_HOME_PUBLICA = [
  '/precos', '/recursos', '/sobre', '/para-consultores', '/rede-de-parceiros', '/minha-casa',
]

describe('ehRotaDeMarketing', () => {
  it('libera tudo que a home pública linka', () => {
    for (const rota of LINKS_DA_HOME_PUBLICA) {
      expect(ehRotaDeMarketing(rota), rota).toBe(true)
    }
  })

  it('libera as subpáginas de recurso', () => {
    for (const rota of ['/recursos/bagua', '/recursos/calendario', '/recursos/relatorios', '/recursos/roda-da-vida']) {
      expect(ehRotaDeMarketing(rota), rota).toBe(true)
    }
  })

  it('libera a loja — quem ainda não tem conta precisa ver o que está à venda', () => {
    /*
     * Este caso já existiu invertido, afirmando que `/produtos` **não** era
     * pública «porque monta o AppShell». Estava certo quando foi escrito.
     *
     * Deixou de estar quando a página ganhou dois ramos: com menu para quem
     * tem conta, sem menu para o visitante. O ramo do visitante existia no
     * código, com texto próprio, e nunca rodou — o middleware interceptava
     * antes. Loja que exige cadastro para mostrar o preço pede a decisão antes
     * do motivo dela.
     */
    expect(ehRotaDeMarketing('/produtos')).toBe(true)
  })

  it('não libera tela de app', () => {
    // `/planos` e `/demonstracao` montam o AppShell incondicionalmente e leem
    // dados de sessão. Abrir uma delas por engano exporia tela autenticada.
    for (const rota of ['/dashboard', '/planos', '/demonstracao', '/clientes', '/perfil', '/admin']) {
      expect(ehRotaDeMarketing(rota), rota).toBe(false)
    }
  })

  it('não confunde a loja com as telas de admin de produto', () => {
    // `/admin/produtos` cadastra o catálogo e é do dono; `/produtos` é a
    // vitrine. Casar por prefixo abriria a primeira junto com a segunda.
    expect(ehRotaDeMarketing('/admin/produtos')).toBe(false)
    expect(ehRotaDeMarketing('/produtos-admin')).toBe(false)
  })

  it('não confunde prefixo com rota', () => {
    // `/recursos-internos` não é subpágina de `/recursos`; casar por prefixo
    // solto abriria qualquer rota que começasse com as mesmas letras.
    expect(ehRotaDeMarketing('/recursos-internos')).toBe(false)
    expect(ehRotaDeMarketing('/precos-admin')).toBe(false)
  })

  it('a lista não tem duplicata', () => {
    expect(new Set(ROTAS_MARKETING).size).toBe(ROTAS_MARKETING.length)
  })
})
