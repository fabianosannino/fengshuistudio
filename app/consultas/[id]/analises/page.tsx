'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useParams } from 'next/navigation'
import FlowLayout from '../../../components/FlowLayout'
import {
  LIMITE_ANALISES,
  comparacaoPermitida,
  estadoDoRegistro,
  VERSAO_MOTOR_ANALISE,
  type AnaliseSalva,
  type ResumoAnalise,
} from '../../../../src/lib/historico-analises'

type Atual = {
  nome: string | null
  metodo: string | null
  fonte_sha256: string
  impedimento: string | null
}
const botao: CSSProperties = {
  minHeight: 44,
  padding: '8px 14px',
  border: '1px solid #245F52',
  borderRadius: 6,
  color: '#17372F',
  background: '#fff',
  cursor: 'pointer',
}
const escola = (metodo: string | null) =>
  metodo === 'btb' ? 'BTB' : metodo === 'bussola' ? 'Bússola' : 'Não definido'
const data = (iso: string) => new Date(iso).toLocaleString('pt-BR')

function Versao({ analise }: { analise: AnaliseSalva }) {
  const o = analise.resultado.orientacao
  return (
    <article
      aria-label={`Versão ${analise.id}`}
      style={{
        flex: '1 1 360px',
        minWidth: 0,
        padding: 16,
        border: '1px solid #BDD2C8',
        borderRadius: 8,
      }}
    >
      <h2>
        {escola(analise.metodo)} · {data(analise.criado_em)}
      </h2>
      <p>
        Variante: {analise.variante}. Motor: {analise.versao_motor}.
      </p>
      <p>
        Orientação:{' '}
        {o.estado === 'confirmada'
          ? `${o.graus}° · Norte ${o.referencia === 'magnetico' ? 'magnético' : 'verdadeiro'} · ${o.origem}`
          : 'Sem leitura confirmada'}
        .
      </p>
      <p>
        As informações abaixo pertencem à versão salva. A consulta atual pode
        ter outros dados.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', textAlign: 'left' }}>
          <caption>Setores preservados</caption>
          <thead>
            <tr>
              {['Setor', 'Falta', 'Excesso', 'Saldo', 'Nota registrada'].map(
                (n) => (
                  <th key={n} style={{ padding: 6 }}>
                    {n}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {analise.resultado.setores.map((s) => (
              <tr key={s.numero}>
                <td>{s.nome}</td>
                <td>{s.falta.toFixed(1)}%</td>
                <td>{s.excesso.toFixed(1)}%</td>
                <td>{s.saldo.toFixed(1)}%</td>
                <td>
                  {s.nota === null ? 'Não avaliado' : `${s.nota.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Saldo negativo indica falta; positivo indica excesso. A nota registrada
        também pode incluir critérios e ajustes do consultor.
      </p>
      <details>
        <summary>Resultados complementares e limitações</summary>
        {(['baZhai', 'mingGua', 'feiXing'] as const).map((chave) => {
          const m = analise.resultado.metodos[chave]
          return (
            <div key={chave}>
              <h3>
                {
                  {
                    baZhai: 'Kua da Casa · Oito Mansões',
                    mingGua: 'Ming Gua · Kua pessoal',
                    feiXing: 'Estrelas Voadoras',
                  }[chave]
                }{' '}
                · {m.estado.replaceAll('_', ' ')}
              </h3>
              {m.motivo && <p>{m.motivo}</p>}
              {m.limitacoes.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
              {m.resultado &&
                ('kua' in m.resultado ? (
                  <p>
                    Kua {m.resultado.kua} · grupo {m.resultado.grupo}. Direções
                    favoráveis: {Object.values(m.resultado.direcoes).join(', ')}
                    .
                  </p>
                ) : (
                  <div>
                    <p>
                      Mapa experimental · Período {m.resultado.mapa.periodo}.
                    </p>
                    <ul>
                      {m.resultado.mapa.palacios.map((p) => (
                        <li key={p.palacio}>
                          {p.palacio}: montanha {p.montanha}, período{' '}
                          {p.periodo}, fachada {p.fachada}.
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )
        })}
      </details>
      {analise.versao_motor === VERSAO_MOTOR_ANALISE ? (
        <Link
          href={`/consultas/${analise.consulta_id}/relatorio?analise=${analise.id}`}
        >
          Preparar relatório desta versão
        </Link>
      ) : (
        <p>
          Esta versão usa um motor anterior. Consulte seus resultados salvos e
          os PDFs já emitidos; registre uma versão atual para nova emissão.
        </p>
      )}
    </article>
  )
}

export default function AnalisesPage() {
  const { id } = useParams<{ id: string }>()
  const [atual, setAtual] = useState<Atual | null>(null),
    [lista, setLista] = useState<ResumoAnalise[]>([])
  const [pagina, setPagina] = useState(0),
    [mais, setMais] = useState(false),
    [erro, setErro] = useState(''),
    [msg, setMsg] = useState('')
  const [ocupado, setOcupado] = useState(false),
    [a, setA] = useState(''),
    [b, setB] = useState(''),
    [versoes, setVersoes] = useState<AnaliseSalva[]>([])
  const pendente = useRef<{ id: string; fonte_sha256: string } | null>(null),
    gravando = useRef(false)
  const carregar = useCallback(
    async (p = 0, signal?: AbortSignal) => {
      const r = await fetch(`/api/consultas/${id}/analises?pagina=${p}`, {
        cache: 'no-store',
        signal,
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Histórico indisponível.')
      setAtual(d.atual)
      setLista((v) => (p === 0 ? d.analises : [...v, ...d.analises]))
      setPagina(p)
      setMais(d.mais)
    },
    [id],
  )
  useEffect(() => {
    const c = new AbortController()
    void carregar(0, c.signal).catch((e) => {
      if (!c.signal.aborted) setErro(e.message)
    })
    return () => c.abort()
  }, [carregar])
  useEffect(() => {
    const c = new AbortController()
    setVersoes([])
    const ids = [a, b].filter((v, i, vs) => v && vs.indexOf(v) === i)
    void Promise.all(
      ids.map(async (v) => {
        const r = await fetch(`/api/consultas/${id}/analises?analise=${v}`, {
            cache: 'no-store',
            signal: c.signal,
          }),
          d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Versão indisponível.')
        return d.analise as AnaliseSalva
      }),
    )
      .then((v) => {
        if (!c.signal.aborted) setVersoes(v)
      })
      .catch((e) => {
        if (!c.signal.aborted) setErro(e.message)
      })
    return () => c.abort()
  }, [id, a, b])
  async function salvar() {
    if (!atual || gravando.current) return
    gravando.current = true
    setOcupado(true)
    setErro('')
    setMsg('')
    pendente.current ??= {
      id: crypto.randomUUID(),
      fonte_sha256: atual.fonte_sha256,
    }
    try {
      const r = await fetch(`/api/consultas/${id}/analises`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendente.current),
        }),
        d = await r.json()
      if (!r.ok) {
        if (r.status < 500) pendente.current = null
        throw new Error(d.error ?? 'Falha ao salvar. Tente novamente.')
      }
      pendente.current = null
      setA(d.analise.id)
      setMsg('Versão registrada. As análises anteriores foram preservadas.')
      await carregar()
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Falha de conexão. Tente salvar novamente.',
      )
    } finally {
      gravando.current = false
      setOcupado(false)
    }
  }
  async function atualizar(p = 0) {
    setOcupado(true)
    setErro('')
    try {
      await carregar(p)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao atualizar.')
    } finally {
      setOcupado(false)
    }
  }
  const jaSalva =
    atual &&
    lista.some(
      (v) =>
        v.fonte_sha256 === atual.fonte_sha256 &&
        v.versao_motor === VERSAO_MOTOR_ANALISE,
    )
  return (
    <FlowLayout>
      <main
        style={{
          maxWidth: 1200,
          margin: 'auto',
          padding: 20,
          color: '#17372F',
        }}
      >
        <Link href={`/consultas/${id}`}>Voltar à consulta</Link>
        <h1>Histórico de análises</h1>
        <p>
          Guarde cada análise finalizada antes de mudar o método ou revisar a
          planta. Você pode manter BTB e Bússola na mesma consulta, comparar
          versões e preparar relatórios com os dados de cada versão.
        </p>
        {erro && <p role="alert">{erro}</p>}
        {msg && <p role="status">{msg}</p>}
        {atual && (
          <section
            style={{ padding: 16, background: '#EAF1EE', borderRadius: 8 }}
          >
            <h2>
              {atual.nome ?? 'Consulta'} · método atual: {escola(atual.metodo)}
            </h2>
            {atual.impedimento && (
              <p>
                {atual.impedimento}{' '}
                <Link href={`/bagua-planta?consultaId=${id}`}>
                  Revisar planta
                </Link>
              </p>
            )}
            <button
              style={botao}
              disabled={ocupado || !!atual.impedimento || !!jaSalva}
              onClick={() => void salvar()}
            >
              {ocupado
                ? 'Aguarde…'
                : jaSalva
                  ? 'Versão atual já registrada'
                  : pendente.current
                    ? 'Tentar salvar novamente'
                    : 'Registrar análise atual'}
            </button>{' '}
            <button
              style={botao}
              disabled={ocupado}
              onClick={() => void atualizar()}
            >
              Atualizar lista
            </button>
            <p>
              Até {LIMITE_ANALISES} versões por consulta. Salvar uma versão não
              altera as outras nem os PDFs existentes. O rascunho da planta
              continua sendo editável.
            </p>
          </section>
        )}
        <h2>Versões registradas</h2>
        {atual && lista.length === 0 && (
          <p>
            Nenhuma versão registrada. Finalize a planta e use “Registrar
            análise atual”.
          </p>
        )}
        <ul>
          {lista.map((v) => (
            <li key={v.id} style={{ margin: '12px 0' }}>
              <button
                style={botao}
                onClick={() => {
                  setA(v.id)
                  setB('')
                }}
              >
                Abrir {escola(v.metodo)} · {data(v.criado_em)}
              </button>{' '}
              {estadoDoRegistro(v, atual?.fonte_sha256 ?? '')}
            </li>
          ))}
        </ul>
        {mais && (
          <button
            style={botao}
            disabled={ocupado}
            onClick={() => void atualizar(pagina + 1)}
          >
            Carregar mais versões
          </button>
        )}
        {lista.length > 0 && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { nome: 'Versão A', valor: a, selecionar: setA },
              { nome: 'Versão B', valor: b, selecionar: setB },
            ].map(({ nome, valor, selecionar }) => (
              <label key={nome}>
                {nome}
                <select
                  aria-label={nome}
                  style={{ ...botao, display: 'block', maxWidth: '100%' }}
                  value={valor}
                  onChange={(e) => selecionar(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {lista.map((r) => (
                    <option key={r.id} value={r.id}>
                      {escola(r.metodo)} · {data(r.criado_em)} ·{' '}
                      {r.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        {versoes.length === 2 && (
          <p role="status">{comparacaoPermitida(versoes[0], versoes[1])}</p>
        )}
        <div
          style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}
        >
          {versoes.map((v) => (
            <Versao key={v.id} analise={v} />
          ))}
        </div>
      </main>
    </FlowLayout>
  )
}
