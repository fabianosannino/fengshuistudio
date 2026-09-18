'use client'

import { useEffect, useRef, useState } from 'react'
import type { BaguaEntrada } from '../../src/lib/types'
import type { ItemMobiliario } from '../../src/lib/mobiliario'
import { direcaoNaPlanta, fimDaSeta, setorDoPonto } from '../../src/lib/mobiliario'
import { lerOrientacao } from '../../src/lib/orientacao'
import { urlExibivel } from './useUrlsAssinadas'
import { BUCKET_IMOVEIS } from '../../src/lib/storage-imagens'
import type { Ponto } from '../../src/lib/poligono'

/** Usa o mesmo espaço de pixels da imagem rotacionada do editor de geometria. */
export default function PlantaMobiliario({ planta, itens, item, aoAlterar }: { planta: BaguaEntrada; itens: ItemMobiliario[]; item: ItemMobiliario; aoAlterar: (v: Partial<ItemMobiliario>) => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const [tamanho, setTamanho] = useState<{ w: number; h: number } | null>(null)
  const [erro, setErro] = useState('')
  const [modo, setModo] = useState<'posicao' | 'direcao'>('posicao')
  const [inicio, setInicio] = useState<Ponto | null>(null)
  const orientacao = lerOrientacao(planta)
  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        if (!planta.planta_url) throw new Error()
        const src = await urlExibivel(planta.planta_url, BUCKET_IMOVEIS)
        if (!ativo) return
        if (!src) throw new Error('imagem indisponível')
        const img = new Image(); img.crossOrigin = 'anonymous'
        img.onload = () => {
          if (!ativo || !cv.current) return
          const rad = (planta.rotacao ?? 0) * Math.PI / 180, cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad))
          const w = Math.round(img.width * cos + img.height * sin), h = Math.round(img.width * sin + img.height * cos)
          const canvas = cv.current; canvas.width = w; canvas.height = h
          const ctx = canvas.getContext('2d')!
          ctx.translate(w / 2, h / 2); ctx.rotate(rad); ctx.drawImage(img, -img.width / 2, -img.height / 2)
          setTamanho({ w, h })
        }
        img.onerror = () => { if (ativo) setErro('Não foi possível abrir a imagem. Você pode usar os campos numéricos.') }
        img.src = src
      } catch { if (ativo) setErro('Planta indisponível. Você pode usar os campos numéricos.') }
    }
    void carregar()
    return () => { ativo = false }
  }, [planta.planta_url, planta.rotacao])
  const b = planta.bordas
  const pontos = [...itens.filter(v => v.id !== item.id), item]
  return <section aria-label="Posicionar mobiliário na planta" style={{ background: '#F4F8F6', padding: 12, borderRadius: 8 }}>
    <h3>Posição e direção na planta</h3>
    <p>Selecione a posição do móvel com um toque. Para direção, marque dois pontos: origem no objeto e destino para onde ele aponta. Você também pode preencher os graus no formulário.</p>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <button type="button" aria-pressed={modo === 'posicao'} onClick={() => { setModo('posicao'); setInicio(null) }}>Marcar posição</button>
      <button type="button" disabled={orientacao.estado !== 'confirmada'} aria-pressed={modo === 'direcao'} onClick={() => { setModo('direcao'); setInicio(null) }}>Marcar direção com dois pontos</button>
      <button type="button" onClick={() => { setInicio(null); aoAlterar({ posicao: null }) }}>Limpar posição</button>
    </div>
    <p role="status">{orientacao.estado === 'confirmada' ? `Fachada na base da planta: ${orientacao.graus}°, Norte ${orientacao.referencia === 'magnetico' ? 'magnético' : 'verdadeiro'}; origem: ${orientacao.origem}.` : 'Para marcar direção na imagem, confirme a fachada, sua origem e a referência de Norte na configuração da planta. Os nomes dos guás BTB não definem direções cardinais.'}</p>
    <div style={{ position: 'relative', maxWidth: 850 }}>
      <canvas ref={cv} aria-label="Imagem da planta para mobiliário" style={{ display: 'block', width: '100%', height: 'auto' }} />
      {tamanho && b && <svg role="img" aria-label="Mapa de posições dos móveis" viewBox={`0 0 ${tamanho.w} ${tamanho.h}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'manipulation' }}
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect(), pt = { x: (e.clientX - r.left) * tamanho.w / r.width, y: (e.clientY - r.top) * tamanho.h / r.height }
          if (modo === 'posicao') {
            const setor = setorDoPonto(pt, planta)
            if (!setor) { setErro('Escolha uma posição dentro das bordas de referência.'); return }
            aoAlterar({ posicao: pt, setor }); setErro('')
          } else if (!inicio) { if (!setorDoPonto(pt, planta)) { setErro('Marque a origem no móvel, dentro das bordas.'); return } setInicio(pt); setErro('') }
          else {
            const graus = direcaoNaPlanta(inicio, pt, planta)
            if (graus === null) { setErro('Separe os dois pontos para definir uma direção.'); return }
            aoAlterar({ posicao: inicio, setor: setorDoPonto(inicio, planta)!, direcao: graus, referencia: orientacao.referencia, origem: 'planta' }); setInicio(null); setErro('')
          }
        }}>
        <title>Grade fixa de nove setores e posições cadastradas</title>
        <defs><marker id="seta-mobiliario" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#B4533A" /></marker></defs>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#17372F" strokeWidth={2} />
        {(planta.lv ?? [1 / 3, 2 / 3]).map((v, i) => <line key={`v${i}`} x1={b.x + b.w * v} x2={b.x + b.w * v} y1={b.y} y2={b.y + b.h} stroke="#17372F" />)}
        {(planta.lh ?? [1 / 3, 2 / 3]).map((v, i) => <line key={`h${i}`} x1={b.x} x2={b.x + b.w} y1={b.y + b.h * v} y2={b.y + b.h * v} stroke="#17372F" />)}
        {pontos.filter(v => v.posicao).map((v, i) => { const fim = fimDaSeta(v, planta, tamanho.w / 10); return <g key={v.id}><title>{v.descricao || v.tipo} · {v.ambiente}</title>{fim && <line x1={v.posicao!.x} y1={v.posicao!.y} x2={fim.x} y2={fim.y} stroke="#B4533A" strokeWidth={tamanho.w / 250} markerEnd="url(#seta-mobiliario)" />}<circle cx={v.posicao!.x} cy={v.posicao!.y} r={tamanho.w / 60} fill={v.id === item.id ? '#B4533A' : '#245F52'} /><text x={v.posicao!.x} y={v.posicao!.y} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={tamanho.w / 65}>{i + 1}</text></g> })}
        {inicio && <circle cx={inicio.x} cy={inicio.y} r={tamanho.w / 70} fill="#C9A227" />}
      </svg>}
    </div>
    {inicio && <p role="status">Origem marcada. Toque no destino da direção.</p>}
    {erro && <p role="alert">{erro}</p>}
  </section>
}
