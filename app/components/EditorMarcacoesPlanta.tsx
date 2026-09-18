'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { Bounds, Marcacao } from '../../src/lib/geometria-bagua'
import type { Ponto } from '../../src/lib/poligono'
import { cantos, erroMarcacao, limitesDosPontos, MAX_VERTICES_MARCACAO, pontosDaMarcacao } from '../../src/lib/marcacoes-poligonais'

const botao: CSSProperties = { minHeight: 44, padding: '8px 12px', border: '1px solid #245F52', borderRadius: 6, background: '#fff', color: '#163E35', cursor: 'pointer' }
type Etapa = 'bordas' | 'falta' | 'excesso' | 'revisar' | null
interface Props {
  bordas: Bounds; marcacoes: Marcacao[]; largura: number; altura: number
  tamanho: { width: string; height: string }; lh: number[]; lv: number[]
  confirmadoEm?: string; legado: boolean
  aoConfirmar: (b: Bounds, m: Marcacao[]) => Promise<boolean>
  aoEditar: (ativo: boolean) => void
}

/** Rascunho isolado até OK; cancelar nunca altera a geometria confirmada. */
export default function EditorMarcacoesPlanta(p: Props) {
  const [aberto, setAberto] = useState(false)
  const [etapa, setEtapa] = useState<Etapa>(null)
  const [bordas, setBordas] = useState(p.bordas)
  const [pontos, setPontos] = useState<Ponto[]>([])
  const [selecionada, setSelecionada] = useState<string>('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmacao, setConfirmacao] = useState('')
  const [vertice, setVertice] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gesto = useRef<{ id: number; indice: number; antes: Ponto[]; bordas: Bounds; inicio: Ponto; alvo: 'vertice' | 'borda' | 'adicionar' } | null>(null)
  const pontosRef = useRef(pontos)
  const bordasRef = useRef(bordas)
  useEffect(() => {
    const cancelar = (e: KeyboardEvent) => {
      const g = gesto.current
      if (e.key !== 'Escape' || !g) return
      e.preventDefault(); gesto.current = null
      pontosRef.current = g.antes; setPontos(g.antes); bordasRef.current = g.bordas; setBordas(g.bordas)
      if (svgRef.current?.hasPointerCapture(g.id)) svgRef.current.releasePointerCapture(g.id)
    }
    window.addEventListener('keydown', cancelar)
    return () => window.removeEventListener('keydown', cancelar)
  }, [])
  function atualizarPontos(novos: Ponto[]) { pontosRef.current = novos; setPontos(novos) }
  function atualizarBordas(b: Bounds) { bordasRef.current = b; setBordas(b) }
  const atual = p.marcacoes.find(m => m.id === selecionada)
  const tipo = etapa === 'falta' || etapa === 'excesso' ? etapa : atual?.tipo
  const emEdicao = etapa !== null
  function abrir() { setAberto(true); p.aoEditar(true); setErro(''); setConfirmacao('') }
  function escolher(e: Etapa) {
    if (emEdicao) { setErro('Confirme com OK ou cancele a etapa antes de trocar de ferramenta.'); return }
    abrir(); setEtapa(e); setSelecionada(''); setVertice(null); atualizarPontos([]); atualizarBordas(p.bordas)
  }
  function cancelar() { cancelarGesto(); setEtapa(null); atualizarPontos([]); setSelecionada(''); setErro(''); setVertice(null) }
  function coordenada(e: PointerEvent<SVGSVGElement>): Ponto {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(p.largura, (e.clientX - r.left) * p.largura / r.width))
    const y = Math.max(0, Math.min(p.altura, (e.clientY - r.top) * p.altura / r.height))
    // Encaixe em borda em unidades de tela, igualmente acessível no mouse e toque.
    const tx = 10 * p.largura / r.width, ty = 10 * p.altura / r.height
    const bx = [p.bordas.x, p.bordas.x + p.bordas.w].find(v => Math.abs(v - x) <= tx)
    const by = [p.bordas.y, p.bordas.y + p.bordas.h].find(v => Math.abs(v - y) <= ty)
    return { x: bx ?? x, y: by ?? y }
  }
  function iniciar(e: PointerEvent<SVGSVGElement>) {
    if (!emEdicao || salvando || gesto.current || e.button !== 0 || !e.isPrimary) return
    const target = e.target as SVGElement
    const indice = target.getAttribute('data-indice')
    const alvo = target.getAttribute('data-alvo') as 'vertice' | 'borda' | null
    if (etapa === 'bordas' && alvo !== 'borda') return
    if (etapa === 'revisar' && !atual) return
    if (!alvo && etapa === 'revisar') return
    e.preventDefault()
    gesto.current = { id: e.pointerId, indice: Number(indice), antes: pontosRef.current, bordas: bordasRef.current, inicio: coordenada(e), alvo: alvo ?? 'adicionar' }
    if (alvo === 'vertice') setVertice(Number(indice))
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function mover(e: PointerEvent<SVGSVGElement>) {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    const pt = coordenada(e)
    if (g.alvo === 'vertice') atualizarPontos(g.antes.map((v, i) => i === g.indice ? pt : v))
    if (g.alvo === 'borda') {
      const b = { ...g.bordas }
      if (g.indice === 0) { b.y = Math.min(pt.y, b.y + b.h - 30); b.h = g.bordas.y + g.bordas.h - b.y }
      if (g.indice === 1) b.w = Math.max(30, pt.x - b.x)
      if (g.indice === 2) b.h = Math.max(30, pt.y - b.y)
      if (g.indice === 3) { b.x = Math.min(pt.x, b.x + b.w - 30); b.w = g.bordas.x + g.bordas.w - b.x }
      atualizarBordas(b)
    }
  }
  function terminar(e: PointerEvent<SVGSVGElement>) {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    mover(e)
    if (g.alvo === 'adicionar') {
      if (pontosRef.current.length >= MAX_VERTICES_MARCACAO) setErro(`Limite de ${MAX_VERTICES_MARCACAO} pontos atingido.`)
      else { atualizarPontos([...g.antes, coordenada(e)]); setVertice(g.antes.length); setErro('') }
    }
    gesto.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  function cancelarGesto() {
    const g = gesto.current
    if (!g) return
    atualizarPontos(g.antes); atualizarBordas(g.bordas); gesto.current = null
    if (svgRef.current?.hasPointerCapture(g.id)) svgRef.current.releasePointerCapture(g.id)
  }
  async function confirmar(excluir = false) {
    if (salvando) return
    let novas = p.marcacoes
    if (etapa !== 'bordas') {
      if (!tipo) { setErro('Selecione uma marcação para revisar.'); return }
      if (excluir && atual) novas = p.marcacoes.filter(m => m.id !== atual.id)
      else {
        if (pontosRef.current.some(v => v.x < 0 || v.y < 0 || v.x > p.largura || v.y > p.altura)) { setErro('Os pontos precisam ficar dentro da imagem da planta.'); return }
        const aviso = erroMarcacao(pontosRef.current, tipo, p.bordas)
        if (aviso) { setErro(aviso); return }
        const m = { id: atual?.id ?? crypto.randomUUID(), tipo, pontos: pontosRef.current, ...limitesDosPontos(pontosRef.current) }
        novas = atual ? p.marcacoes.map(v => v.id === atual.id ? m : v) : [...p.marcacoes, m]
      }
    } else {
      if (![bordasRef.current.x,bordasRef.current.y,bordasRef.current.w,bordasRef.current.h].every(Number.isFinite) || bordasRef.current.x < 0 || bordasRef.current.y < 0 || bordasRef.current.w < 30 || bordasRef.current.h < 30 || bordasRef.current.x + bordasRef.current.w > p.largura || bordasRef.current.y + bordasRef.current.h > p.altura) { setErro('As bordas precisam ficar dentro da imagem e ter pelo menos 30 pixels de largura e altura.'); return }
      // Uma mudança deliberada das bordas não pode desconectar polígonos já aceitos.
      const invalida = p.marcacoes.find(m => m.pontos && erroMarcacao(m.pontos, m.tipo, bordasRef.current))
      if (invalida) { setErro('Estas bordas desconectam uma marcação. Cancele e revise ou exclua essa marcação primeiro.'); return }
    }
    setSalvando(true); setErro('')
    try {
      const ok = await p.aoConfirmar(etapa === 'bordas' ? bordasRef.current : p.bordas, novas)
      if (!ok) { setErro('Não foi possível salvar. A etapa permanece aberta para tentar novamente.'); return }
      setConfirmacao(etapa === 'bordas' ? 'Bordas revisadas e confirmadas. A referência está fixa.' : excluir ? 'Marcação excluída e salva.' : 'Marcação confirmada e salva. Confira o saldo e clique em Recalcular ao terminar.')
      cancelar()
    } catch { setErro('Não foi possível salvar. A edição continua na tela; tente novamente.') }
    finally { setSalvando(false) }
  }
  const b = etapa === 'bordas' ? bordas : p.bordas
  const cor = tipo === 'falta' ? '#B4533A' : '#24724F'
  const raio = 12 * p.largura / Math.max(1, parseFloat(p.tamanho.width) || p.largura)
  return <>
    {aberto && <svg ref={svgRef} aria-label="Editor de polígonos da planta" viewBox={`0 0 ${p.largura} ${p.altura}`}
      onPointerDown={iniciar} onPointerMove={mover} onPointerUp={terminar}
      onPointerCancel={cancelarGesto} onLostPointerCapture={cancelarGesto}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); if (gesto.current) cancelarGesto(); else cancelar() } }}
      style={{ position: 'absolute', top: 0, left: 0, ...p.tamanho, touchAction: 'none', zIndex: 2 }}>
      <title>Bordas fixas, falta em vermelho e excesso em verde. Use os campos abaixo para editar pelo teclado.</title>
      {etapa === 'bordas' && <rect {...p.bordas} width={p.bordas.w} height={p.bordas.h} fill="none" stroke="#777" strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />}
      <rect data-testid="referencia-editor" x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#102F28" strokeWidth={3} vectorEffect="non-scaling-stroke" />
      {p.lv.map((v, i) => <line key={`v${i}`} x1={b.x + b.w * v} x2={b.x + b.w * v} y1={b.y} y2={b.y + b.h} stroke="#102F28" vectorEffect="non-scaling-stroke" />)}
      {p.lh.map((v, i) => <line key={`h${i}`} x1={b.x} x2={b.x + b.w} y1={b.y + b.h * v} y2={b.y + b.h * v} stroke="#102F28" vectorEffect="non-scaling-stroke" />)}
      {p.marcacoes.filter(m => m.id !== selecionada).map(m => <polygon key={m.id} data-testid={`marca-${m.id}`} points={pontosDaMarcacao(m).map(v => `${v.x},${v.y}`).join(' ')} fill={m.tipo === 'falta' ? '#B4533A22' : '#24724F22'} stroke={m.tipo === 'falta' ? '#B4533A' : '#24724F'} vectorEffect="non-scaling-stroke" />)}
      {pontos.length > 0 && <polygon points={pontos.map(v => `${v.x},${v.y}`).join(' ')} fill={`${cor}33`} stroke={cor} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      {pontos.map((v, i) => <circle key={i} data-testid={`ponto-${i}`} data-alvo="vertice" data-indice={i} cx={v.x} cy={v.y} r={raio} fill={vertice === i ? cor : '#fff'} stroke={cor} strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
      {etapa === 'bordas' && [{ x: b.x + b.w / 2, y: b.y }, { x: b.x + b.w, y: b.y + b.h / 2 }, { x: b.x + b.w / 2, y: b.y + b.h }, { x: b.x, y: b.y + b.h / 2 }].map((v, i) => <circle key={i} data-testid={`borda-${i}`} data-alvo="borda" data-indice={i} {...v} cx={v.x} cy={v.y} r={raio} fill="#fff" stroke="#B4533A" strokeWidth={3} vectorEffect="non-scaling-stroke" />)}
    </svg>}
    <section aria-label="Etapas de edição da planta" style={{ background: '#fff', color: '#17372F', padding: 12, border: '1px solid #CFE6E0', borderRadius: 8, marginTop: 8 }}>
      <p role="status" style={{ margin: '0 0 8px' }}>{p.confirmadoEm ? `Última confirmação: ${new Date(p.confirmadoEm).toLocaleString('pt-BR')}.` : 'Bordas carregadas como referência; ainda sem confirmação neste fluxo.'} {etapa === 'bordas' ? 'Em revisão: tracejado = antes; linha contínua = proposta. OK aceita a proposta.' : 'As marcações não deslocam os nove setores.'}</p>
      {p.legado && <p>Esta análise usa os descontos anteriores. Ao confirmar uma etapa, passa a usar o saldo entre falta e excesso; os PDFs já emitidos são preservados.</p>}
      {!aberto ? <button style={botao} onClick={abrir}>Editar planta e marcações</button> : <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button style={botao} disabled={salvando} aria-pressed={etapa === 'bordas'} onClick={() => escolher('bordas')}>1. Marcar bordas</button>
          <button style={botao} disabled={salvando || !p.confirmadoEm} aria-pressed={etapa === 'falta'} onClick={() => escolher('falta')}>2. Marcar Falta</button>
          <button style={botao} disabled={salvando || !p.confirmadoEm} aria-pressed={etapa === 'excesso'} onClick={() => escolher('excesso')}>3. Marcar Excesso</button>
          <button style={botao} disabled={salvando || !p.confirmadoEm} aria-pressed={etapa === 'revisar'} onClick={() => escolher('revisar')}>Editar marcações</button>
          {!emEdicao && <button style={botao} onClick={() => { setAberto(false); p.aoEditar(false) }}>Concluir edição</button>}
        </div>
        {etapa === 'revisar' && <label>Marcação para editar <select aria-label="Marcação para editar" style={botao} value={selecionada} disabled={salvando} onChange={e => { const m = p.marcacoes.find(v => v.id === e.target.value); setSelecionada(e.target.value); atualizarPontos(m ? pontosDaMarcacao(m) : []); setVertice(null); setErro('') }}>
          <option value="">Selecione uma marcação</option>{p.marcacoes.map((m, i) => <option key={m.id} value={m.id}>{m.tipo === 'falta' ? 'Falta' : 'Excesso'} {i + 1}</option>)}
        </select></label>}
        {(etapa === 'falta' || etapa === 'excesso' || etapa === 'revisar') && <p>Toque ou clique em cada canto para criar o polígono. Arraste os pontos para ajustar; há encaixe nas bordas. Use OK para fechar e confirmar. Falta fica dentro; excesso fica fora. Ambos precisam se conectar a um trecho das bordas.</p>}
        {etapa === 'bordas' && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{(['x', 'y', 'w', 'h'] as const).map(c => <label key={c}>{({ x: 'Esquerda', y: 'Topo', w: 'Largura', h: 'Altura' })[c]} (px)<input aria-label={`Borda ${c}`} type="number" style={{ width: 85, minHeight: 44 }} value={bordas[c]} disabled={salvando} onChange={e => atualizarBordas({ ...bordasRef.current, [c]: Number(e.target.value) })} /></label>)}</div>}
        {pontos.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label>Ponto <select aria-label="Ponto para ajustar" value={vertice ?? ''} onChange={e => setVertice(e.target.value === '' ? null : Number(e.target.value))} style={botao}><option value="">Selecione</option>{pontos.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>
          {vertice !== null && pontos[vertice] && <>{(['x', 'y'] as const).map(c => <label key={c}>{c.toUpperCase()} (px)<input aria-label={`Ponto ${c}`} type="number" value={pontos[vertice][c]} disabled={salvando} style={{ minHeight: 44, width: 85 }} onChange={e => atualizarPontos(pontos.map((v, i) => i === vertice ? { ...v, [c]: Number(e.target.value) } : v))} /></label>)}
            <button style={botao} disabled={salvando} onClick={() => { const i = vertice, a = pontos[i], b = pontos[(i + 1) % pontos.length]; if (pontos.length < MAX_VERTICES_MARCACAO) atualizarPontos([...pontos.slice(0, i + 1), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ...pontos.slice(i + 1)]) }}>Inserir ponto após selecionado</button>
            <button style={botao} disabled={salvando} onClick={() => { atualizarPontos(pontos.filter((_, i) => i !== vertice)); setVertice(null) }}>Remover ponto</button></>}
        </div>}
        {emEdicao && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {(etapa === 'falta' || etapa === 'excesso') && <button style={botao} disabled={salvando || pontos.length >= MAX_VERTICES_MARCACAO} onClick={() => { atualizarPontos([...pontos, cantos(p.bordas)[pontos.length % 4]]); setVertice(pontos.length) }}>Adicionar ponto por coordenadas</button>}
          <button style={{ ...botao, background: '#245F52', color: '#fff' }} disabled={salvando} onClick={() => void confirmar()}>{salvando ? 'Salvando…' : `OK — ${etapa === 'bordas' ? 'confirmar bordas' : etapa === 'falta' ? 'confirmar falta' : etapa === 'excesso' ? 'confirmar excesso' : 'confirmar revisão'}`}</button>
          <button style={botao} disabled={salvando} onClick={cancelar}>Cancelar etapa</button>
          {atual && <button style={botao} disabled={salvando} onClick={() => void confirmar(true)}>Excluir marcação selecionada</button>}
        </div>}
      </>}
      {erro && <p role="alert" style={{ color: '#9F3425' }}>{erro}</p>}
      {confirmacao && <p role="status">{confirmacao}</p>}
    </section>
  </>
}
