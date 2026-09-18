// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_BYTES_DO_ARQUIVO } from '../../src/lib/produtos-da-plataforma'
import { MARGEM_MULTIPART } from '../../src/lib/multipart-limitado'

const id = '22222222-2222-4222-8222-222222222222'
const m = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  capability: true, readError: false, writeError: false,
  upload: vi.fn(), remove: vi.fn(), rate: vi.fn(), query: vi.fn(), updates: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('../../src/lib/rate-limit', () => ({ rateLimit: m.rate, ipDaRequisicao: () => 'fixture' }))
vi.mock('../../src/lib/supabase-route', () => ({ createRouteHandlerClient: async () => ({}) }))
vi.mock('../../src/lib/guarda-admin', () => ({ exigirCapacidade: async () => ({ ok: m.capability }), respostaDaGuarda: () => Response.json({}, { status: 403 }) }))
vi.mock('../../src/lib/supabase-admin', () => ({ createSupabaseAdminClient: () => ({
  storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
  from: () => {
    const filters: [string, unknown][] = []
    let update: Record<string, unknown> | undefined
    const q = {
      select: () => q,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return q },
      is: (key: string, value: unknown) => { filters.push([key, value]); return q },
      update: (value: Record<string, unknown>) => { update = value; return q },
      maybeSingle: async () => {
        m.query()
        if (update ? m.writeError : m.readError) return { data: null, error: { message: 'private detail' } }
        if (!m.row || filters.some(([key, value]) => m.row?.[key] !== value)) return { data: null, error: null }
        if (update) { Object.assign(m.row, update); m.updates(update) }
        return { data: { ...m.row }, error: null }
      },
    }
    return q
  },
}) }))
import { POST } from '../../app/api/admin/produtos/arquivo/route'

function envio(size = 10, type = 'application/pdf', produto = id) {
  const form = new FormData()
  form.set('produto_id', produto)
  form.set('arquivo', new File([new Uint8Array(size)], 'material.pdf', { type }))
  return new Request('https://example.invalid', { method: 'POST', body: form })
}

beforeEach(() => {
  vi.clearAllMocks()
  m.row = { id, arquivo_path: 'anterior.pdf' }
  m.capability = true; m.readError = false; m.writeError = false
  m.rate.mockResolvedValue({ success: true }); m.upload.mockResolvedValue({ error: null })
})

describe('arquivo do produto: limite, vínculo e concorrência', () => {
  it('exige capacidade antes de ler qualquer byte', async () => {
    m.capability = false
    const request = envio(), spy = vi.spyOn(request.body!, 'getReader')
    expect((await POST(request)).status).toBe(403)
    expect(spy).not.toHaveBeenCalled(); expect(m.query).not.toHaveBeenCalled(); expect(m.upload).not.toHaveBeenCalled()
  })
  it('falha fechada no rate limit não lê o corpo', async () => {
    m.rate.mockResolvedValue({ success: false, indisponivel: true })
    const request = envio(), spy = vi.spyOn(request.body!, 'getReader')
    expect((await POST(request)).status).toBe(503)
    expect(spy).not.toHaveBeenCalled(); expect(m.query).not.toHaveBeenCalled()
  })
  it.each([undefined, '1'])('interrompe corpo excessivo com Content-Length=%s sem banco ou storage', async length => {
    const cancel = vi.fn()
    const headers: Record<string, string> = { 'content-type': 'multipart/form-data; boundary=x' }
    if (length) headers['content-length'] = length
    const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(MAX_BYTES_DO_ARQUIVO + MARGEM_MULTIPART + 1)) }, cancel })
    const request = new Request('https://example.invalid', { method: 'POST', headers, body, duplex: 'half' } as RequestInit)
    expect((await POST(request)).status).toBe(413)
    expect(cancel).toHaveBeenCalledOnce(); expect(m.query).not.toHaveBeenCalled(); expect(m.upload).not.toHaveBeenCalled()
  })
  it.each([{ size: 0, status: 400 }, { size: MAX_BYTES_DO_ARQUIVO + 1, status: 413 }])('recusa arquivo de $size bytes antes do banco', async ({ size, status }) => {
    expect((await POST(envio(size))).status).toBe(status)
    expect(m.query).not.toHaveBeenCalled(); expect(m.upload).not.toHaveBeenCalled()
  })
  it('recusa formato e identificador inválidos', async () => {
    expect((await POST(envio(10, 'text/html'))).status).toBe(400)
    expect((await POST(envio(10, 'application/pdf', 'invalido'))).status).toBe(400)
    expect(m.upload).not.toHaveBeenCalled()
  })
  it('produto ausente não gera objeto órfão; erro de leitura não é ausência', async () => {
    m.row = null
    expect((await POST(envio())).status).toBe(404)
    m.readError = true
    expect((await POST(envio())).status).toBe(503)
    expect(m.upload).not.toHaveBeenCalled()
  })
  it.each([null, 'anterior.pdf'])('confirma arquivo no limite e preserva o anterior (%s)', async path => {
    m.row!.arquivo_path = path
    expect((await POST(envio(MAX_BYTES_DO_ARQUIVO))).status).toBe(200)
    expect(m.upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${id}/[\\w-]+\\.pdf$`)), expect.any(File), { contentType: 'application/pdf', upsert: false })
    expect(m.row?.arquivo_path).toBe(m.upload.mock.calls[0][0])
    expect(m.updates).toHaveBeenCalledOnce(); expect(m.remove).not.toHaveBeenCalled()
  })
  it.each(['substituido', 'excluido'])('não confirma nem sobrescreve produto %s durante o upload', async evento => {
    m.upload.mockImplementationOnce(async () => {
      if (evento === 'substituido') m.row!.arquivo_path = 'concorrente.pdf'
      else m.row = null
      return { error: null }
    })
    expect((await POST(envio())).status).toBe(409)
    expect(m.updates).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled()
    if (evento === 'substituido') expect(m.row?.arquivo_path).toBe('concorrente.pdf')
  })
  it('falha de upload não troca o vínculo; falha ambígua de gravação não apaga arquivo', async () => {
    m.upload.mockResolvedValueOnce({ error: { message: 'private detail' } })
    const response = await POST(envio())
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('private')
    expect(m.row?.arquivo_path).toBe('anterior.pdf'); expect(m.updates).not.toHaveBeenCalled()
    m.writeError = true
    expect((await POST(envio())).status).toBe(503)
    expect(m.row?.arquivo_path).toBe('anterior.pdf'); expect(m.remove).not.toHaveBeenCalled()
  })
  it('falha de transporte retorna erro genérico e preserva o vínculo', async () => {
    m.upload.mockRejectedValueOnce(new Error('private detail'))
    const response = await POST(envio())
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('private')
    expect(m.row?.arquivo_path).toBe('anterior.pdf'); expect(m.remove).not.toHaveBeenCalled()
  })
})
