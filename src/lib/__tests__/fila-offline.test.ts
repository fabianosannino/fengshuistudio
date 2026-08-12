import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  lerFila, enfileirar, confirmar, limparFila, pendentesDaConsulta, sincronizar,
} from '../fila-offline'

/** `localStorage` de mentira, para o teste não depender de ambiente de browser. */
function storageFake(inicial: Record<string, string> = {}): Storage {
  const dados = new Map(Object.entries(inicial))
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => { dados.set(k, v) },
    removeItem: (k: string) => { dados.delete(k) },
    clear: () => dados.clear(),
    key: (i: number) => [...dados.keys()][i] ?? null,
    get length() { return dados.size },
  } as Storage
}

/** Storage que recusa gravar — cota estourada ou modo privativo. */
function storageCheio(): Storage {
  return {
    ...storageFake(),
    setItem: () => { throw new Error('QuotaExceededError') },
  } as Storage
}

let storage: Storage
beforeEach(() => { storage = storageFake() })

describe('enfileirar', () => {
  it('guarda a marcação para quando houver sinal', () => {
    expect(enfileirar(storage, 'c1:checklist_chi', { porta: 'conforme' })).toBe(true)
    expect(lerFila(storage)).toHaveLength(1)
  })

  it('última escrita vence, por chave', () => {
    // Marcar «conforme» e depois «problema» deixa uma entrada, a última. Enviar
    // as duas daria o resultado errado se chegassem fora de ordem — e fora de
    // ordem é o padrão quando a rede volta com várias requisições em voo.
    enfileirar(storage, 'c1:checklist_chi', { porta: 'conforme' })
    enfileirar(storage, 'c1:checklist_chi', { porta: 'problema' })

    const fila = lerFila(storage)
    expect(fila).toHaveLength(1)
    expect(fila[0].valor).toEqual({ porta: 'problema' })
  })

  it('chaves diferentes convivem', () => {
    enfileirar(storage, 'c1:checklist_chi', {})
    enfileirar(storage, 'c1:vistoria_notas', {})
    enfileirar(storage, 'c2:checklist_chi', {})
    expect(lerFila(storage)).toHaveLength(3)
  })

  it('devolve false quando não conseguiu gravar', () => {
    // A tela precisa saber: sem isto, «sincroniza depois» vira promessa falsa.
    expect(enfileirar(storageCheio(), 'c1:x', {})).toBe(false)
  })
})

describe('lerFila', () => {
  it('JSON corrompido vira fila vazia, não exceção', () => {
    // Aba fechada no meio da escrita. Travar a tela com a fila é pior que
    // perder a fila.
    const quebrado = storageFake({ 'fengshui-fila-vistoria': '{isso não é json' })
    expect(lerFila(quebrado)).toEqual([])
  })

  it('descarta entrada sem forma de entrada', () => {
    const sujo = storageFake({ 'fengshui-fila-vistoria': JSON.stringify([
      { chave: 'c1:ok', valor: 1, em: 5 },
      { valor: 2 },
      null,
      'texto',
    ]) })
    expect(lerFila(sujo)).toHaveLength(1)
  })

  it('valor que não é lista vira fila vazia', () => {
    expect(lerFila(storageFake({ 'fengshui-fila-vistoria': '{"a":1}' }))).toEqual([])
  })
})

describe('pendentesDaConsulta', () => {
  it('filtra pela consulta e ordena pelo momento da marcação', () => {
    vi.spyOn(Date, 'now').mockReturnValue(200)
    enfileirar(storage, 'c1:b', {})
    vi.spyOn(Date, 'now').mockReturnValue(100)
    enfileirar(storage, 'c1:a', {})
    vi.spyOn(Date, 'now').mockReturnValue(300)
    enfileirar(storage, 'c2:x', {})
    vi.restoreAllMocks()

    expect(pendentesDaConsulta(storage, 'c1').map(e => e.chave)).toEqual(['c1:a', 'c1:b'])
  })
})

describe('sincronizar', () => {
  it('envia tudo e limpa o que o servidor aceitou', async () => {
    enfileirar(storage, 'c1:a', 1)
    enfileirar(storage, 'c1:b', 2)

    const r = await sincronizar(storage, 'c1', async () => true)
    expect(r.enviadas).toHaveLength(2)
    expect(r.falhas).toHaveLength(0)
    expect(lerFila(storage)).toHaveLength(0)
  })

  it('o que falhou permanece na fila', async () => {
    // Entrada descartada por erro de rede é indistinguível, do lado do
    // consultor, de uma marcação que ele nunca fez.
    enfileirar(storage, 'c1:a', 1)
    enfileirar(storage, 'c1:b', 2)

    const r = await sincronizar(storage, 'c1', async e => e.chave === 'c1:a')
    expect(r.enviadas).toEqual(['c1:a'])
    expect(r.falhas).toEqual(['c1:b'])
    expect(lerFila(storage).map(e => e.chave)).toEqual(['c1:b'])
  })

  it('exceção no envio conta como falha, não derruba a sincronização', async () => {
    enfileirar(storage, 'c1:a', 1)
    enfileirar(storage, 'c1:b', 2)

    const r = await sincronizar(storage, 'c1', async e => {
      if (e.chave === 'c1:a') throw new Error('offline')
      return true
    })
    expect(r.falhas).toEqual(['c1:a'])
    expect(r.enviadas).toEqual(['c1:b'])
  })

  it('não toca na fila de outra consulta', async () => {
    enfileirar(storage, 'c1:a', 1)
    enfileirar(storage, 'c2:a', 1)

    await sincronizar(storage, 'c1', async () => true)
    expect(lerFila(storage).map(e => e.chave)).toEqual(['c2:a'])
  })
})

describe('confirmar e limparFila', () => {
  it('confirmar tira só o que foi confirmado', () => {
    enfileirar(storage, 'c1:a', 1)
    enfileirar(storage, 'c1:b', 2)
    confirmar(storage, ['c1:a'])
    expect(lerFila(storage).map(e => e.chave)).toEqual(['c1:b'])
  })

  it('limparFila esvazia tudo', () => {
    enfileirar(storage, 'c1:a', 1)
    limparFila(storage)
    expect(lerFila(storage)).toEqual([])
  })
})
