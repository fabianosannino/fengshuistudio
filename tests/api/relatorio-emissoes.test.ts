// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { jsonCanonico, MAX_PDF_RELATORIO, VERSOES_RELATORIO, type FonteRelatorio } from '../../src/lib/relatorio-emissao'
import { secoesDoFormato } from '../../src/lib/formato-do-relatorio'
import { referenciaDaAnalise } from '../../src/lib/analise-bagua'
import type { BaguaEntrada } from '../../src/lib/types'
import { MARGEM_MULTIPART } from '../../src/lib/multipart-limitado'

vi.mock('server-only', () => ({}))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
type Row = Record<string, unknown>
let usuario: { id: string } | null
let consultaVisivel: boolean
let erroBanco: boolean
const registros: Row[] = []
const insercoes: Row[] = []
const upload = vi.fn()
const download = vi.fn()
const sign = vi.fn()
const rpc = vi.fn()
const adminCriado = vi.fn()
const source = vi.fn()
const limiter = vi.fn()
const hash = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex')

function query(tabela: string, admin = false) {
  const filtros: ((r: Row) => boolean)[] = []
  let limite = Infinity
  let inicio = 0
  let colunas = '*'
  const chain = {
    select(c: string) { colunas = c; return chain },
    eq(c: string, v: unknown) { filtros.push(r => r[c] === v); return chain },
    in(c: string, vs: unknown[]) { filtros.push(r => vs.includes(r[c])); return chain },
    order() { return chain },
    limit(n: number) { limite = n; return chain },
    range(a: number, b: number) { inicio = a; limite = b + 1; return chain },
    async insert(row: Row) { insercoes.push(row); registros.push(row); return { error: erroBanco ? { message: 'private database error' } : null } },
    async maybeSingle() { const r = await executar(); return { ...r, data: r.data?.[0] ?? null } },
    then(resolve: (r: unknown) => unknown) { return executar().then(resolve) },
  }
  async function executar() {
    if (erroBanco) return { data: null, error: { message: 'private database error' } }
    const rows = tabela === 'consultas' ? (consultaVisivel ? [{ id: id(1), consultor_id: usuario?.id }] : []) : registros
    const data = rows.filter(r => (admin || r.consultor_id === usuario?.id) && filtros.every(f => f(r))).slice(inicio, limite)
    return { data: data.map(r => colunas === '*' ? r : Object.fromEntries(colunas.split(',').map(c => [c, r[c]]))), error: null }
  }
  return chain
}
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: async () => ({ auth: { getUser: async () => ({ data: { user: usuario } }) }, from: (t: string) => query(t) }) }))
vi.mock('../../src/lib/supabase-admin', () => ({ createSupabaseAdminClient: () => {
  adminCriado()
  return { from: (t: string) => query(t, true), storage: { from: () => ({ upload, download, createSignedUrl: sign }) }, rpc }
} }))
vi.mock('../../src/lib/relatorio-fonte', () => ({ carregarFonteRelatorio: (...a: unknown[]) => source(...a), sha256: (s: string | Uint8Array) => hash(s) }))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: () => limiter(), ipDaRequisicao: () => '203.0.113.1' }))

import { POST, GET } from '../../app/api/consultas/relatorio/route'
import { POST as PREPARAR } from '../../app/api/consultas/relatorio/preparar/route'

const pdf = '%PDF-1.4\nsynthetic fixture\n%%EOF\n'
const fonte = { consulta: { id: id(1), consultor_id: id(1), bagua_entrada: {} }, perfil: {}, setores: [], evolucao: [], chi_custom: [] } as unknown as FonteRelatorio
const edicao = { secoes: secoesDoFormato('resumo'), textos: { introducao: 'Introdução', curas: '', chi: '', conclusao: '' }, recomendacoes: {} }
function preparada(extra: Row = {}) {
  return { id: id(10), consulta_id: id(1), consultor_id: id(1), estado: 'preparada', criado_em: new Date().toISOString(), pdf_path: `${id(1)}/emissoes/${id(10)}.pdf`, ...extra }
}
function envio(texto = pdf, emissao = id(10)) {
  const form = new FormData()
  form.set('consulta_id', id(1)); form.set('emissao_id', emissao)
  form.set('pdf', new Blob([texto], { type: 'application/pdf' }), 'report.pdf')
  return new Request('http://local/api/consultas/relatorio', { method: 'POST', body: form })
}
function preparo(extra: Row = {}) {
  return new Request('http://local/api/consultas/relatorio/preparar', { method: 'POST', body: JSON.stringify({
    id: id(20), consulta_id: id(1), fonte_sha256: hash(jsonCanonico(fonte)), referencia_temporal: new Date(Date.now() - 1000).toISOString(), fuso: 'UTC', edicao, versoes: VERSOES_RELATORIO, ...extra,
  }) })
}
function leitura(sufixo = '') { return new Request(`http://local/api/consultas/relatorio?consulta_id=${id(1)}${sufixo}`) }

beforeEach(() => {
  vi.clearAllMocks()
  registros.length = 0; insercoes.length = 0
  usuario = { id: id(1) }; consultaVisivel = true; erroBanco = false
  source.mockResolvedValue(fonte)
  limiter.mockResolvedValue({ success: true })
  upload.mockResolvedValue({ error: null })
  download.mockResolvedValue({ data: new Blob([pdf]), error: null })
  sign.mockResolvedValue({ data: { signedUrl: 'https://storage.example/signed' }, error: null })
  rpc.mockResolvedValue({ data: new Date().toISOString(), error: null })
})

describe('preparação versionada', () => {
  it('bloqueia bússola não confirmada e análise obsoleta antes de usar privilégio', async () => {
    const be = { escola: 'bussola', orientacao_graus: 0, orientacao_estado: 'confirmada', orientacao_referencia: 'magnetico', orientacao_origem: 'manual', orientacao_confirmada_em: new Date().toISOString() } as BaguaEntrada
    for (const bagua of [{ escola: 'bussola', orientacao_graus: 0 }, be, { ...be, analise_referencia: { entrada: 'antiga', versao: 'antiga' } }]) {
      const alterada = { ...fonte, consulta: { ...fonte.consulta, bagua_entrada: bagua } }
      source.mockResolvedValue(alterada)
      expect((await PREPARAR(preparo({ fonte_sha256: hash(jsonCanonico(alterada)) }))).status).toBe(409)
    }
    expect(adminCriado).not.toHaveBeenCalled()
    const atual = { ...fonte, consulta: { ...fonte.consulta, bagua_entrada: { ...be, analise_referencia: referenciaDaAnalise(be) } } }
    source.mockResolvedValue(atual)
    expect((await PREPARAR(preparo({ fonte_sha256: hash(jsonCanonico(atual)) }))).status).toBe(201)
  })
  it('recusa página antiga depois de uma mudança de motor ou template', async () => {
    expect((await PREPARAR(preparo({ versoes: { ...VERSOES_RELATORIO, motor: 'anterior' } }))).status).toBe(409)
    expect(insercoes).toHaveLength(0)
    expect(adminCriado).not.toHaveBeenCalled()
  })
  it('exige sessão antes do cliente privilegiado', async () => {
    usuario = null
    expect((await PREPARAR(preparo())).status).toBe(401)
    expect(adminCriado).not.toHaveBeenCalled()
  })
  it('recusa consulta alheia antes do cliente privilegiado', async () => {
    source.mockResolvedValue(null)
    expect((await PREPARAR(preparo())).status).toBe(404)
    expect(adminCriado).not.toHaveBeenCalled()
  })
  it('recusa prévia desatualizada e textos fora do contrato', async () => {
    expect((await PREPARAR(preparo({ fonte_sha256: 'a'.repeat(64) }))).status).toBe(409)
    expect((await PREPARAR(preparo({ edicao: { ...edicao, recomendacoes: { foreign: 'x' } } }))).status).toBe(400)
    expect(insercoes).toHaveLength(0)
  })
  it('usa entradas do servidor e vincula revisão sem atualizar a anterior', async () => {
    registros.push(preparada({ id: id(8), estado: 'concluida', pdf_sha256: 'a'.repeat(64) }))
    const antes = JSON.stringify(registros[0])
    const res = await PREPARAR(preparo({ entrada: { consulta: 'forjada' }, consultor_id: id(2) }))
    expect(res.status).toBe(201)
    expect(insercoes[0]).toMatchObject({ consultor_id: id(1), revisao_de: id(8), estado: 'preparada', entrada: { fonte } })
    expect(JSON.stringify(registros[0])).toBe(antes)
    expect(insercoes[0].pdf_path).toBe(`${id(1)}/emissoes/${id(20)}.pdf`)
  })
})

describe('upload e confirmação', () => {
  it.each([undefined, '1'])('limita o corpo inteiro com Content-Length=%s antes de consultar emissões', async length => {
    const cancel = vi.fn()
    const headers: Record<string, string> = { 'content-type': 'multipart/form-data; boundary=x' }
    if (length) headers['content-length'] = length
    const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(MAX_PDF_RELATORIO + MARGEM_MULTIPART + 1)) }, cancel })
    const request = new Request('https://example.invalid', { method: 'POST', headers, body, duplex: 'half' } as RequestInit)
    expect((await POST(request)).status).toBe(413)
    expect(cancel).toHaveBeenCalledOnce(); expect(adminCriado).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled()
  })
  it('recusa arquivo acima do limite da hospedagem antes de acessar storage', async () => {
    expect((await POST(envio('x'.repeat(MAX_PDF_RELATORIO + 1)))).status).toBe(400)
    expect(adminCriado).not.toHaveBeenCalled()
  })
  it('não cria storage privilegiado para emissão alheia', async () => {
    registros.push(preparada({ consultor_id: id(2) }))
    expect((await POST(envio())).status).toBe(404)
    expect(adminCriado).not.toHaveBeenCalled()
  })
  it('não aceita apenas extensão/MIME de PDF', async () => {
    registros.push(preparada())
    expect((await POST(envio('<html>invalido</html>'))).status).toBe(400)
    expect(upload).not.toHaveBeenCalled()
  })
  it('grava em caminho único sem upsert e confirma hash dos bytes', async () => {
    registros.push(preparada())
    expect((await POST(envio())).status).toBe(200)
    expect(upload).toHaveBeenCalledWith(registros[0].pdf_path, expect.any(Uint8Array), { contentType: 'application/pdf', upsert: false })
    expect(rpc).toHaveBeenCalledWith('concluir_emissao_relatorio', { p_id: id(10), p_consultor: id(1), p_sha256: hash(pdf), p_bytes: Buffer.byteLength(pdf) })
  })
  it('falha de confirmação não declara sucesso e permite repetir o mesmo arquivo', async () => {
    registros.push(preparada())
    rpc.mockResolvedValueOnce({ error: { message: 'internal key=private' }, data: null })
    const res = await POST(envio())
    expect(res.status).toBe(503)
    expect(await res.text()).not.toContain('private')
    upload.mockResolvedValueOnce({ error: { message: 'Already exists' } })
    expect((await POST(envio())).status).toBe(200)
    expect(download).toHaveBeenCalledWith(registros[0].pdf_path)
  })
  it('não sobrescreve arquivo diferente depois de timeout', async () => {
    registros.push(preparada())
    upload.mockResolvedValue({ error: { message: 'Already exists' } })
    download.mockResolvedValue({ data: new Blob(['different']), error: null })
    expect((await POST(envio())).status).toBe(409)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('não confirma se upload falhar e não houver arquivo recuperável', async () => {
    registros.push(preparada())
    upload.mockResolvedValue({ error: { message: 'network' } })
    download.mockResolvedValue({ error: { message: 'missing' } })
    expect((await POST(envio())).status).toBe(503)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('repetição de concluída com mesmos bytes não faz outra escrita', async () => {
    registros.push(preparada({ estado: 'concluida', pdf_sha256: hash(pdf), pdf_bytes: Buffer.byteLength(pdf), concluido_em: '2026-09-18T02:00:00Z' }))
    expect((await POST(envio())).status).toBe(200)
    expect(upload).not.toHaveBeenCalled()
    expect((await POST(envio('%PDF-1.4\noutro\n%%EOF'))).status).toBe(409)
  })
  it('recusa preparação expirada', async () => {
    registros.push(preparada({ criado_em: '2020-01-01T00:00:00Z' }))
    expect((await POST(envio())).status).toBe(409)
    expect(upload).not.toHaveBeenCalled()
  })
})

describe('histórico e leitura', () => {
  it('lista metadados sem expor snapshot ou paths de storage', async () => {
    registros.push(preparada({ entrada: { cpf: 'privado' } }))
    const res = await GET(leitura('&historico=1'))
    const text = await res.text()
    expect(text).not.toContain('privado')
    expect(text).not.toContain('pdf_path')
  })
  it('uma preparação não vira download', async () => {
    registros.push(preparada())
    expect((await GET(leitura(`&emissao_id=${id(10)}`))).status).toBe(404)
    expect(sign).not.toHaveBeenCalled()
  })
  it('abre PDF legado sem inventar entrada/hash', async () => {
    registros.push(preparada({ estado: 'legado', pdf_path: `${id(1)}/relatorio.pdf`, pdf_sha256: null }))
    const res = await GET(leitura(`&emissao_id=${id(10)}`))
    expect(res.status).toBe(200)
    expect((await res.json()).legado).toBe(true)
  })
  it('recusa PDF com hash divergente antes de assinar', async () => {
    registros.push(preparada({ estado: 'concluida', pdf_sha256: 'b'.repeat(64) }))
    expect((await GET(leitura())).status).toBe(503)
    expect(sign).not.toHaveBeenCalled()
  })
  it('não disponibiliza outra consulta e sanitiza falha de banco', async () => {
    consultaVisivel = false
    expect((await GET(leitura())).status).toBe(404)
    expect(adminCriado).not.toHaveBeenCalled()
    erroBanco = true
    const res = await GET(leitura())
    expect(res.status).toBe(503)
    expect(await res.text()).not.toContain('private')
  })
})
