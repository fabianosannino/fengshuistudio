/**
 * Fila de escritas para o modo vistoria — a casa do cliente não tem sinal.
 *
 * ## O problema
 *
 * A vistoria acontece andando pela casa: porão, banheiro, fundo do corredor.
 * É exatamente onde o celular perde sinal. Com escrita direta, cada marcação
 * perdida some sem aviso — e o consultor só descobre ao voltar para o
 * escritório e encontrar o checklist como o deixou de manhã.
 *
 * ## A regra
 *
 * Toda marcação vira uma entrada na fila **antes** de qualquer tentativa de
 * rede. A fila mora em `localStorage` porque precisa sobreviver a fechar o
 * navegador, ficar sem bateria e ao recarregamento que o iOS faz sozinho com o
 * app em segundo plano.
 *
 * ## Última escrita vence, por item
 *
 * Marcar «conforme» e depois «problema» no mesmo item deixa **uma** entrada na
 * fila, a última. Enviar as duas em ordem daria o mesmo resultado no caso feliz
 * e o resultado errado se chegassem fora de ordem — e chegar fora de ordem é o
 * padrão quando a rede volta com várias requisições em voo.
 *
 * O que **não** entra aqui: foto. Um blob de 3 MB por item encheria a cota do
 * `localStorage` (5 MB no total) na terceira foto, e falhar em gravar a fila é
 * pior que não ter fila. A tela diz que foto precisa de conexão.
 */

export interface EntradaDaFila {
  /** Chave do que está sendo alterado — «<consultaId>:<campo>». */
  chave: string
  /** O valor a gravar. Serializável em JSON, sempre. */
  valor: unknown
  /** Quando a marcação foi feita no aparelho, em ms. */
  em: number
}

const CHAVE_STORAGE = 'fengshui-fila-vistoria'

/** Tudo o que ainda não foi para o servidor. */
export function lerFila(storage: Storage): EntradaDaFila[] {
  try {
    const bruto = storage.getItem(CHAVE_STORAGE)
    if (!bruto) return []
    const dados = JSON.parse(bruto)
    if (!Array.isArray(dados)) return []
    return dados.filter((e): e is EntradaDaFila =>
      !!e && typeof e.chave === 'string' && typeof e.em === 'number')
  } catch {
    // JSON corrompido (aba fechada no meio da escrita, cota estourada). Fila
    // vazia é a leitura segura: pior que perder a fila é travar a tela com ela.
    return []
  }
}

function gravarFila(storage: Storage, fila: EntradaDaFila[]): boolean {
  try {
    storage.setItem(CHAVE_STORAGE, JSON.stringify(fila))
    return true
  } catch {
    // Cota estourada ou modo privativo. Devolve `false` para a tela poder
    // avisar em vez de fingir que guardou.
    return false
  }
}

/**
 * Enfileira uma escrita, substituindo a anterior da mesma chave.
 *
 * Devolve `false` quando não foi possível gravar — a tela precisa dizer isso,
 * porque a promessa «sincroniza depois» deixa de valer.
 */
export function enfileirar(storage: Storage, chave: string, valor: unknown): boolean {
  const fila = lerFila(storage).filter(e => e.chave !== chave)
  fila.push({ chave, valor, em: Date.now() })
  return gravarFila(storage, fila)
}

/** Tira da fila o que já foi gravado no servidor. */
export function confirmar(storage: Storage, chaves: string[]): void {
  const confirmadas = new Set(chaves)
  gravarFila(storage, lerFila(storage).filter(e => !confirmadas.has(e.chave)))
}

/** Esvazia tudo — usado ao trocar de consulta. */
export function limparFila(storage: Storage): void {
  try { storage.removeItem(CHAVE_STORAGE) } catch { /* modo privativo */ }
}

/** As entradas de uma consulta, na ordem em que foram feitas. */
export function pendentesDaConsulta(storage: Storage, consultaId: string): EntradaDaFila[] {
  return lerFila(storage)
    .filter(e => e.chave.startsWith(`${consultaId}:`))
    .sort((a, b) => a.em - b.em)
}

export interface ResultadoDaSincronizacao {
  enviadas: string[]
  falhas: string[]
}

/**
 * Tenta enviar tudo o que está pendente.
 *
 * `enviar` recebe uma entrada e devolve `true` se o servidor aceitou. O que
 * falhar **permanece** na fila: uma entrada descartada por erro de rede é
 * indistinguível, do lado do consultor, de uma marcação que ele nunca fez.
 */
export async function sincronizar(
  storage: Storage,
  consultaId: string,
  enviar: (entrada: EntradaDaFila) => Promise<boolean>
): Promise<ResultadoDaSincronizacao> {
  const pendentes = pendentesDaConsulta(storage, consultaId)
  const enviadas: string[] = []
  const falhas: string[] = []

  for (const entrada of pendentes) {
    let ok = false
    try {
      ok = await enviar(entrada)
    } catch {
      ok = false
    }
    if (ok) enviadas.push(entrada.chave)
    else falhas.push(entrada.chave)
  }

  confirmar(storage, enviadas)
  return { enviadas, falhas }
}
