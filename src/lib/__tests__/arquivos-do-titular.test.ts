// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { removerArquivosDoTitular } from '../arquivos-do-titular'
vi.mock('server-only', () => ({}))
function client(handler: (bucket: string, path: string, offset: number) => unknown) {
  const remove = vi.fn().mockResolvedValue({ error: null })
  const list = vi.fn(async (bucket: string, path: string, options: { offset: number }) => handler(bucket,path,options.offset))
  const supabase = { storage: { from: (bucket: string) => ({
    list: (path: string, options: { offset: number }) => list(bucket,path,options),
    remove: (paths: string[]) => remove(bucket, paths),
  }) } } as unknown as SupabaseClient
  return { supabase, remove, list }
}
describe('inventário de objetos por raízes comprovadas', () => {
  it('alcança versões substituídas de foto do cliente e de planta', async () => {
    const c = client((bucket, path) => ({ error: null, data:
      bucket === 'clientes-fotos' && path === 'owner' ? [{ id: null, name: 'client' }] :
      bucket === 'clientes-fotos' && path === 'owner/client' ? [{ id: 'old', name: 'old.jpg' }, { id: 'new', name: 'new.jpg' }] :
      bucket === 'imoveis-fotos' && path === 'visit' ? [{ id: null, name: 'bagua-planta' }] :
      bucket === 'imoveis-fotos' && path === 'visit/bagua-planta' ? [{ id: 'old', name: 'old.png' }, { id: 'new', name: 'new.png' }] : [] }))
    expect(await removerArquivosDoTitular(c.supabase, 'owner', ['visit'])).toBe(4)
    expect(c.remove).toHaveBeenCalledWith('clientes-fotos', ['owner/client/old.jpg', 'owner/client/new.jpg'])
    expect(c.remove).toHaveBeenCalledWith('imoveis-fotos', ['visit/bagua-planta/old.png', 'visit/bagua-planta/new.png'])
  })
  it('exclusão de uma consulta preserva as fotos dos clientes e outras consultas', async () => {
    const c = client(() => ({ error: null, data: [] }))
    await removerArquivosDoTitular(c.supabase,'owner',['visit'],{ incluirFotosClientes: false })
    expect(c.list.mock.calls.map(call => call.slice(0, 2))).toEqual([['imoveis-fotos','visit'],['relatorios','visit']])
  })
  it('inclui arquivos órfãos e subpastas, sem tocar em outra raiz', async () => {
    const c = client((bucket, path) => ({ error: null, data: bucket === 'imoveis-fotos'
      ? path === 'visit' ? [{ id: null, name: 'pasta' }, { id: 'orphan', name: 'orphan.png' }]
        : [{ id: 'nested', name: 'inside.png' }] : [] }))
    expect(await removerArquivosDoTitular(c.supabase, 'owner', ['visit'])).toBe(2)
    expect(c.remove).toHaveBeenCalledExactlyOnceWith('imoveis-fotos', ['visit/orphan.png', 'visit/pasta/inside.png'])
    expect(c.list.mock.calls.every(call => ['owner','visit','visit/pasta'].includes(call[1]))).toBe(true)
  })
  it('lista todas as páginas antes de remover, sem saltar objetos', async () => {
    const files = Array.from({ length: 251 }, (_, n) => ({ id: `f${n}`, name: `${n}.png` }))
    const c = client((bucket, _path, offset) => ({ error: null, data: bucket === 'clientes-fotos' ? files.slice(offset,offset+100) : [] }))
    c.remove.mockImplementation(async () => { expect(c.list).toHaveBeenCalledTimes(3); return { error: null } })
    expect(await removerArquivosDoTitular(c.supabase,'owner',[])).toBe(251)
    expect(c.remove.mock.calls.flatMap(call => call[1])).toHaveLength(251)
  })
  it.each(['..','../other','bad/name','bad\\name','%2e%2e'])('recusa nome ambíguo vindo do inventário: %s', async name => {
    const c = client(() => ({ error: null, data: [{ id: 'id', name }] }))
    await expect(removerArquivosDoTitular(c.supabase,'owner',[])).rejects.toThrow()
    expect(c.remove).not.toHaveBeenCalled()
  })
  it('erro de listagem não vira inventário vazio', async () => {
    const c = client(() => ({ data: null, error: {} }))
    await expect(removerArquivosDoTitular(c.supabase,'owner',[])).rejects.toThrow('Inventário')
    expect(c.remove).not.toHaveBeenCalled()
  })
  it('erro de remoção impede confirmação de sucesso', async () => {
    const c = client(() => ({ error: null, data: [{ id: 'file', name: 'a.png' }] }))
    c.remove.mockResolvedValue({ error: {} })
    await expect(removerArquivosDoTitular(c.supabase,'owner',[])).rejects.toThrow('Remoção')
  })
})
