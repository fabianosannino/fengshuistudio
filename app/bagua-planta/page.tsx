'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'
import FlowLayout from '../components/FlowLayout'
import { CRITERIOS } from '../../src/lib/constants'
import { gerarRecomendacoes } from '../../src/lib/recomendacoes'
import type { BaguaEntrada, BaguaMarcacaoJSON } from '../../src/lib/types'

// ─── DADOS ────────────────────────────────────────────────────────────────────

// As dicas de cada setor vêm de SETOR_DICAS (src/lib/constants) via o motor
// canônico de recomendações — não são duplicadas aqui.
const SETORES = [
  { nome:'Prosperidade',    elem:'Madeira', dir:'Sudeste',  cor:'#7C3AED' },
  { nome:'Fama/Reputação',  elem:'Fogo',    dir:'Sul',      cor:'#DC2626' },
  { nome:'Relacionamentos', elem:'Terra',   dir:'Sudoeste', cor:'#BE185D' },
  { nome:'Família',         elem:'Madeira', dir:'Leste',    cor:'#15803D' },
  { nome:'Centro/Saúde',    elem:'Terra',   dir:'Centro',   cor:'#D97706' },
  { nome:'Criatividade',    elem:'Metal',   dir:'Oeste',    cor:'#B45309' },
  { nome:'Espiritualidade', elem:'Terra',   dir:'Nordeste', cor:'#92400E' },
  { nome:'Carreira',        elem:'Água',    dir:'Norte',    cor:'#1D4ED8' },
  { nome:'Pessoas Úteis',   elem:'Metal',   dir:'Noroeste', cor:'#6B7280' },
]

// As recomendações vêm do motor canônico (src/lib/recomendacoes). A tela de
// diagnóstico passa também faltaPct/excessoPct para incluir as recs geométricas.

function gridOrder(escola: string, lado: string): number[] {
  if (escola === 'btb' && lado === 'direita') return [2,1,0,5,4,3,8,7,6]
  return [0,1,2,3,4,5,6,7,8]
}

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type Step   = 'upload' | 'metragem' | 'configurar' | 'entrada' | 'resultado'
type Lado   = 'esquerda' | 'centro' | 'direita'
type Bounds = { x:number; y:number; w:number; h:number }
type Marcacao = { id:string; tipo:'falta'|'excesso'; x:number; y:number; w:number; h:number }
type Drag   = { tipo:'borda'; lado:'top'|'bottom'|'left'|'right' }
            | { tipo:'marcacao-mover'; id:string; offX:number; offY:number }
            | { tipo:'marcacao-resize'; id:string; canto:'tl'|'tr'|'bl'|'br' }
type Setor  = {
  criterios:number[];
  geo:number;         // 100 base - faltaPct + excessoPct (points)
  faltaArea:number;   // falta area in px² for this sector
  excessoArea:number; // excesso area in px² for this sector
  faltaPct:number;    // falta as % of sector area
  excessoPct:number;  // excesso as % of sector area
  /** Manual geo adjustment — fine-tuning (Avançado) */
  ajusteManual:number|null;
  ajusteTipo:'equilibrado'|'faltante'|'excedente'|null;
  obs:string;
}

const DRAG = 18

// ─── FUNÇÕES PURAS ────────────────────────────────────────────────────────────

function buildRot(img: HTMLImageElement, deg: number): HTMLCanvasElement {
  const rad=deg*Math.PI/180, sin=Math.abs(Math.sin(rad)), cos=Math.abs(Math.cos(rad))
  const rw=Math.round(img.width*cos+img.height*sin)
  const rh=Math.round(img.width*sin+img.height*cos)
  const c=document.createElement('canvas'); c.width=rw; c.height=rh
  const ctx=c.getContext('2d')!
  ctx.translate(rw/2,rh/2); ctx.rotate(rad); ctx.drawImage(img,-img.width/2,-img.height/2)
  return c
}

// Compute overlap area between two rectangles
function rectOverlap(r:{x:number;y:number;w:number;h:number}, sx:number,sy:number,sw:number,sh:number):number{
  const ox=Math.max(0,Math.min(r.x+r.w,sx+sw)-Math.max(r.x,sx))
  const oy=Math.max(0,Math.min(r.y+r.h,sy+sh)-Math.max(r.y,sy))
  return ox*oy
}

// For excesso: compute only the area OUTSIDE the main bounds
function excessoAreaExterna(m:Marcacao, b:Bounds):number{
  const totalArea=m.w*m.h
  const overlapComBounds=rectOverlap(m,b.x,b.y,b.w,b.h)
  return Math.max(0,totalArea-overlapComBounds)
}

// New calculation: purely from manual marcacoes, no pixel detection
function calcularSetores(b:Bounds, lh:number[], lv:number[], marcacoes:Marcacao[]): Setor[] {
  const boundsArea = b.w * b.h
  const sectorArea = boundsArea / 9

  // Pre-compute external excesso areas and distribute to nearest sectors
  const excessoExterno = Array(9).fill(0) as number[]
  for(const m of marcacoes){
    if(m.tipo!=='excesso') continue
    const extArea=excessoAreaExterna(m,b)
    if(extArea<=0) continue
    // Distribute external area to the sectors whose edges are closest
    // Find which sectors the excesso is adjacent to by extending sector boundaries
    const sectorWeights=Array(9).fill(0) as number[]
    let totalWeight=0
    for(let idx=0;idx<9;idx++){
      const row=Math.floor(idx/3),col=idx%3
      const sx0=b.x+(col===0?0:b.w*lv[col-1]),sx1=b.x+(col===2?b.w:b.w*lv[col])
      const sy0=b.y+(row===0?0:b.h*lh[row-1]),sy1=b.y+(row===2?b.h:b.h*lh[row])
      // Extend sector bounds outward (large extent for edge sectors)
      const ext=Math.max(b.w,b.h)*2
      const exX0=col===0?sx0-ext:sx0, exX1=col===2?sx1+ext:sx1
      const exY0=row===0?sy0-ext:sy0, exY1=row===2?sy1+ext:sy1
      const overlap=rectOverlap(m,exX0,exY0,exX1-exX0,exY1-exY0)
      // Subtract overlap with the actual sector (internal part)
      const internalOverlap=rectOverlap(m,sx0,sy0,sx1-sx0,sy1-sy0)
      const weight=Math.max(0,overlap-internalOverlap)
      sectorWeights[idx]=weight
      totalWeight+=weight
    }
    if(totalWeight>0){
      for(let idx=0;idx<9;idx++){
        excessoExterno[idx]+=extArea*(sectorWeights[idx]/totalWeight)
      }
    }
  }

  return Array(9).fill(0).map((_,idx)=>{
    const row=Math.floor(idx/3),col=idx%3
    const x0=b.x+(col===0?0:b.w*lv[col-1]),x1=b.x+(col===2?b.w:b.w*lv[col])
    const y0=b.y+(row===0?0:b.h*lh[row-1]),y1=b.y+(row===2?b.h:b.h*lh[row])
    const sw=x1-x0,sh=y1-y0

    let faltaArea=0
    for(const m of marcacoes){
      if(m.tipo!=='falta') continue
      const overlap=rectOverlap(m,x0,y0,sw,sh)
      if(overlap>0) faltaArea+=overlap
    }
    const excessoArea=excessoExterno[idx]
    const faltaPct = sectorArea > 0 ? (faltaArea / sectorArea) * 100 : 0
    const excessoPct = sectorArea > 0 ? (excessoArea / sectorArea) * 100 : 0
    const geo = 100 - faltaPct - excessoPct

    return {criterios:Array(8).fill(2),geo,faltaArea,excessoArea,faltaPct,excessoPct,ajusteManual:null,ajusteTipo:null,obs:''}
  })
}

// ─── NEW SCORING SYSTEM ──────────────────────────────────────────────────────
// Physical score: 0→-2, 1→-1, 2→0, 3→+1, 4→+2
const FISICO_MAP=[-2,-1,0,1,2]
function scoreFisico(c:number[]):number{return c.reduce((s,v)=>s+(FISICO_MAP[v]??0),0)}
// Effective geo (with manual adjustment if set)
function geoEfetivo(sc:Setor):number{return sc.ajusteManual!==null?sc.ajusteManual:sc.geo}
// Total score = geo + physical
function scoreTotal(sc:Setor):number{return Math.round(geoEfetivo(sc)+scoreFisico(sc.criterios))}
// Geo color based on sector data: Green (equilibrado), Red (falta), Orange (excesso)
function corGeo(geo:number, sc?:Setor):string{
  if(Math.abs(geo-100)<0.5) return '#15803D'
  if(sc && sc.excessoPct > sc.faltaPct) return '#D97706' // Orange for excesso-dominant
  return '#DC2626' // Red for falta-dominant
}
// Geo label based on sector data
function lblGeo(geo:number, sc?:Setor):string{
  if(Math.abs(geo-100)<0.5) return 'Equilibrado'
  if(sc && sc.excessoPct > sc.faltaPct) return 'Excesso'
  if(sc && sc.faltaPct > sc.excessoPct) return 'Falta'
  return 'Desequilíbrio'
}
// Total score color (quality scale)
function corTotal(t:number):string{return t>=95?'#15803D':t>=80?'#65A30D':t>=60?'#D97706':t>=40?'#EA580C':'#DC2626'}
function lblTotal(t:number):string{return t>=95?'Excelente':t>=80?'Bom':t>=60?'Regular':t>=40?'Ruim':'Crítico'}
// Check if criteria have been evaluated (changed from default 2)
function criteriosAvaliados(c:number[]):boolean{return c.some(v=>v!==2)}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

function BaguaPlantaContent() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const consultaId  = searchParams.get('consultaId')
  const [consultaNome, setConsultaNome] = useState('')
  const cvRef    = useRef<HTMLCanvasElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const rotRef   = useRef<HTMLCanvasElement|null>(null)
  const dragRef  = useRef<Drag|null>(null)
  const isDrag   = useRef(false)

  const [img,      setImg]      = useState<HTMLImageElement|null>(null)
  const [step,     setStep]     = useState<Step>('upload')
  const [rot,      setRot]      = useState(0)
  const [escola,   setEscola]   = useState<'btb'|'bussola'>('btb')
  const [lado,     setLado]     = useState<Lado>('centro')
  const [entrada,  setEntrada]  = useState<{x:number;y:number}|null>(null)
  const [bounds,   setBounds]   = useState<Bounds|null>(null)
  const [lh,       setLh]       = useState([1/3,2/3])
  const [lv,       setLv]       = useState([1/3,2/3])
  const [modo,     setModo]     = useState<'nenhum'|'bordas'|'marcarFalta'|'marcarExcesso'>('nenhum')
  const [setores,  setSetores]  = useState<Setor[]>([])
  const [ativo,    setAtivo]    = useState<number|null>(null)
  const [msg,      setMsg]      = useState('')
  const [msgTipo,  setMsgTipo]  = useState<'erro'|'sucesso'>('sucesso')
  const [consultas,setConsultas]= useState<{id:string;nome_imovel:string}[]>([])
  const [fullscreen,setFullscreen] = useState(false)
  const [instrucaoAberta,setInstrucaoAberta] = useState(true)
  const [bordaModificada,setBordaModificada] = useState(false)
  const [ultimoRecalculo,setUltimoRecalculo] = useState<string|null>(null)
  const fsCvRef = useRef<HTMLCanvasElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  // Refs to always have latest values (avoids stale closures in drag handlers)
  const boundsRef = useRef<Bounds|null>(null)
  const lhRef = useRef([1/3,2/3])
  const lvRef = useRef([1/3,2/3])
  // Plant persistence state
  const [plantaUrl, setPlantaUrl] = useState<string|null>(null)
  const plantaUrlRef = useRef<string|null>(null)
  const [carregandoPlanta, setCarregandoPlanta] = useState(false)
  const [showRetomar, setShowRetomar] = useState(false)
  const rascunhoRef = useRef<BaguaEntrada | null>(null) // holds loaded draft for "Continuar"
  const restaurandoRef = useRef(false) // prevents re-save during restoration
  // Falta/Excesso manual rectangles
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([])
  const marcacoesRef = useRef<Marcacao[]>([])
  const desenhandoRef = useRef<{startX:number;startY:number;tipo:'falta'|'excesso'}|null>(null)
  const [desenhandoPreview, setDesenhandoPreview] = useState<{x:number;y:number;w:number;h:number}|null>(null)
  // Metragem real (m²)
  const [metragemReal, setMetragemReal] = useState<number>(0)
  const metragemRef = useRef<number>(0)
  // Recalculate pending state
  const [recalculoPendente, setRecalculoPendente] = useState(false)

  // Instruction accordion (no longer dismissed permanently)

  // ESC key to exit fullscreen
  useEffect(()=>{
    function handleKey(e:KeyboardEvent){
      if(e.key==='Escape'&&fullscreen){setModo('nenhum');setFullscreen(false)}
    }
    window.addEventListener('keydown',handleKey)
    return ()=>window.removeEventListener('keydown',handleKey)
  },[fullscreen])

  // Sync refs with state (so drag end handlers always read latest values)
  useEffect(()=>{ boundsRef.current=bounds },[bounds])
  useEffect(()=>{ lhRef.current=lh },[lh])
  useEffect(()=>{ lvRef.current=lv },[lv])
  useEffect(()=>{ plantaUrlRef.current=plantaUrl },[plantaUrl])
  useEffect(()=>{ marcacoesRef.current=marcacoes },[marcacoes])
  useEffect(()=>{ metragemRef.current=metragemReal },[metragemReal])

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user){router.push('/login');return}
      supabase.from('consultas').select('id,nome_imovel').eq('consultor_id',user.id)
        .order('criado_em',{ascending:false}).then(({data})=>setConsultas(data||[])).then(null,(e: Error)=>console.error('Erro ao carregar consultas:',e))
      // Se veio com consultaId, carrega nome e dados existentes
      if(consultaId){
        supabase.from('consultas').select('nome_imovel,bagua_entrada').eq('id',consultaId).single()
          .then(({data})=>{
            if(data) setConsultaNome(data.nome_imovel)
            if(data?.bagua_entrada){
              const be=data.bagua_entrada as BaguaEntrada
              // Check if there's a saved plant image (in-progress or finalized analysis)
              if(be.planta_url && !be.finalizada_em){
                // Draft analysis exists — offer to continue
                rascunhoRef.current=be
                setPlantaUrl(be.planta_url)
                setShowRetomar(true)
                return
              }
              if(be.planta_url && be.finalizada_em){
                // Finalized analysis — load for viewing/re-editing
                rascunhoRef.current=be
                setPlantaUrl(be.planta_url)
                setShowRetomar(true)
                return
              }
              // Legacy format: just entrance coords
              if(typeof be.x==='number'&&typeof be.y==='number'){
                setEntrada({x:be.x,y:be.y})
                setLado((be.lado||'centro') as Lado)
              }
            }
          }).then(null,(e: Error)=>console.error('Erro ao carregar consulta:',e))
        supabase.from('setores_bagua')
          .select('numero,score_percentual,diagnostico_criterios(criterio,score)')
          .eq('consulta_id',consultaId).order('numero')
          .then(({data})=>{
            if(!data||data.length===0) return
            setSetores(prev=>{
              const next=[...prev]
              data.forEach((s:{numero?:number; diagnostico_criterios?:{criterio:string; score:number}[]})=>{
                const idx=(s.numero||1)-1
                if(idx<0||idx>8) return
                const cMap:number[]=Array(8).fill(0)
                s.diagnostico_criterios?.forEach((c:{criterio:string; score:number})=>{
                  const ci=['Limpeza e organização','Iluminação adequada','Ventilação e ar fresco','Cores harmônicas','Mobiliário posicionado','Plantas e elementos naturais','Ausência de objetos quebrados','Fluxo de energia livre'].indexOf(c.criterio)
                  if(ci>=0) cMap[ci]=c.score
                })
                next[idx]={...next[idx],criterios:cMap}
              })
              return next
            })
          }).then(null,(e: Error)=>console.error('Erro ao carregar setores:',e))
      }
    })
  },[router,consultaId])

  // Restore saved draft state (loads image from URL and restores all state)
  function restaurarRascunho(){
    const be=rascunhoRef.current; if(!be?.planta_url) return
    setShowRetomar(false)
    setCarregandoPlanta(true)
    restaurandoRef.current=true
    const i=new Image()
    i.crossOrigin='anonymous'
    i.onload=()=>{
      setImg(i)
      setRot(be.rotacao||0)
      setLado((be.lado||'centro') as Lado)
      if(typeof be.x==='number'&&typeof be.y==='number') setEntrada({x:be.x,y:be.y})
      // Defer bounds/setores restoration after image+rotation effect runs
      setTimeout(()=>{
        const r2=buildRot(i,be.rotacao||0)
        rotRef.current=r2
        if(be.bordas){
          const b={x:be.bordas.x,y:be.bordas.y,w:be.bordas.w,h:be.bordas.h}
          setBounds(b); boundsRef.current=b
        }
        if(be.lh){setLh(be.lh);lhRef.current=be.lh}
        if(be.lv){setLv(be.lv);lvRef.current=be.lv}
        // Restore step
        const etapa=(be.etapa||'configurar') as Step
        if(be.finalizada_em) setStep('resultado')
        else setStep(etapa)
        // Recalculate sectors if we have bounds
        // Restore marcacoes
        const savedMarcacoes:Marcacao[]=Array.isArray(be.marcacoes)?be.marcacoes.map((m:BaguaMarcacaoJSON):Marcacao=>({
          id:m.id||Date.now().toString(36),tipo:m.tipo as Marcacao['tipo'],x:m.x??0,y:m.y??0,w:m.w??0,h:m.h??0
        })):[]
        setMarcacoes(savedMarcacoes); marcacoesRef.current=savedMarcacoes

        if(be.bordas&&r2){
          const bRestored={x:be.bordas.x,y:be.bordas.y,w:be.bordas.w,h:be.bordas.h}
          const lhRestored=be.lh||[1/3,2/3]
          const lvRestored=be.lv||[1/3,2/3]
          const novos=calcularSetores(bRestored,lhRestored,lvRestored,savedMarcacoes)
          // Merge saved sector data (criterios, ajustes) with recalculated geometry
          const setoresRasc=be.setores_rascunho
          setSetores(novos.map((n,idx)=>{
            const saved=setoresRasc?.[idx]
            return {
              ...n,
              criterios:saved?.criterios??n.criterios,
              ajusteManual:saved?.ajusteManual??null,
              ajusteTipo:(saved?.ajusteTipo??null) as Setor['ajusteTipo'],
              obs:saved?.obs??'',
            }
          }))
          // Restore metragem
          if(be.metragem_real) { setMetragemReal(be.metragem_real); metragemRef.current=be.metragem_real }
        }
        setCarregandoPlanta(false)
        restaurandoRef.current=false
      },200)
    }
    i.onerror=()=>{
      setCarregandoPlanta(false)
      restaurandoRef.current=false
      setMsg('Erro ao carregar planta salva. Faça novo upload.'); setMsgTipo('erro')
      setStep('upload')
    }
    i.src=be.planta_url
  }

  function recomecarAnalise(){
    setShowRetomar(false)
    rascunhoRef.current=null
    setImg(null); setStep('upload'); setRot(0)
    setBounds(null); boundsRef.current=null
    setEntrada(null); setSetores([]); setLh([1/3,2/3]); setLv([1/3,2/3])
    lhRef.current=[1/3,2/3]; lvRef.current=[1/3,2/3]
    // Clear saved draft (keep planta_url for storage but clear state)
    if(consultaId){
      supabase.from('consultas').update({bagua_entrada:null,bagua_imagem:null}).eq('id',consultaId).then(()=>{}).then(null,(e: Error)=>console.error('Erro ao limpar rascunho:',e))
    }
  }

  // ── reconstruir imagem rotacionada + redimensionar canvas ─────────────────
  // Resize canvas to fit current viewport
  const resizeCanvas = useCallback(()=>{
    const r=rotRef.current, cv=cvRef.current
    if(!r||!cv) return
    // Use actual container width for accurate sizing
    const container=canvasContainerRef.current
    const containerW=container?container.clientWidth:window.innerWidth-40
    const maxW=Math.min(containerW,window.innerWidth-40)
    const maxH=Math.max(500,window.innerHeight-180)
    const s=Math.min(maxW/r.width,maxH/r.height)
    cv.width=Math.round(r.width*s); cv.height=Math.round(r.height*s)
    cv.style.width  = cv.width  + 'px'
    cv.style.height = cv.height + 'px'
  },[])

  useEffect(()=>{
    if(!img) return
    const r=buildRot(img,rot)
    rotRef.current=r
    const cv=cvRef.current; if(!cv) return
    // Use requestAnimationFrame to ensure container is laid out before measuring
    requestAnimationFrame(()=>{
      resizeCanvas()
      // Second frame to catch late layout shifts
      requestAnimationFrame(()=>{ resizeCanvas() })
    })
    // Skip reset during restoration (bounds/setores are set by restaurarRascunho)
    if(restaurandoRef.current) return
    // reset posicionamento ao girar
    setBounds(null); setEntrada(null); setSetores([])
  },[img,rot,resizeCanvas])

  // ── escala pixels do rotCanvas → pixels do canvas de exibição ─────────────
  const scale=useCallback(()=>{
    const cv=cvRef.current,r=rotRef.current
    return(cv&&r)?cv.width/r.width:1
  },[])

  // ── draw ───────────────────────────────────────────────────────────────────
  const draw=useCallback(()=>{
    const cv=cvRef.current,r=rotRef.current; if(!cv||!r) return
    const ctx=cv.getContext('2d')!
    const s=cv.width/r.width
    ctx.clearRect(0,0,cv.width,cv.height)
    ctx.drawImage(r,0,0,cv.width,cv.height)   // imagem já rotacionada, sem transforms

    if(!bounds) return
    const bx=bounds.x*s,by=bounds.y*s,bw=bounds.w*s,bh=bounds.h*s
    const order=gridOrder(escola,lado)

    // ── setores ──
    for(let row=0;row<3;row++) for(let col=0;col<3;col++){
      const idx=row*3+col, st=SETORES[order[idx]], sc=setores[idx]
      const x0=bx+(col===0?0:bw*lv[col-1]),x1=bx+(col===2?bw:bw*lv[col])
      const y0=by+(row===0?0:bh*lh[row-1]),y1=by+(row===2?bh:bh*lh[row])
      const fw=x1-x0,fh=y1-y0,sel=ativo===idx
      const geoVal=sc?geoEfetivo(sc):100
      const c=sc?corGeo(geoVal,sc):st.cor
      ctx.fillStyle=c+(sel?'44':'18'); ctx.fillRect(x0,y0,fw,fh)
      ctx.strokeStyle=sel?'#000':c; ctx.lineWidth=sel?3:1.5; ctx.strokeRect(x0,y0,fw,fh)
      const fs=Math.max(8,Math.min(12,fw/11))
      ctx.fillStyle='#000000cc'; ctx.font=`bold ${fs}px Arial`; ctx.textAlign='center'
      ctx.fillText(st.nome,x0+fw/2,y0+fh/2-(sc?fs*0.3:0))
      if(sc){
        ctx.font=`bold ${Math.max(7,fs-2)}px Arial`
        ctx.fillStyle=c
        ctx.fillText(lblGeo(geoVal,sc),x0+fw/2,y0+fh/2+fs*0.9)
      }
    }

    // ── borda externa ──
    ctx.strokeStyle=modo==='bordas'?'#FF4500':'#1E3A5F'
    ctx.lineWidth=modo==='bordas'?3:2.5
    ctx.setLineDash(modo==='bordas'?[6,4]:[])
    ctx.strokeRect(bx,by,bw,bh); ctx.setLineDash([])

    // ── alças bordas ──
    if(modo==='bordas'){
      [[bx+bw/2,by],[bx+bw/2,by+bh],[bx,by+bh/2],[bx+bw,by+bh/2]].forEach(([hx,hy])=>{
        ctx.beginPath(); ctx.arc(hx,hy,10,0,Math.PI*2)
        ctx.fillStyle='#FF4500'; ctx.fill()
        ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke()
      })
    }

    // ── linhas grid (fixas 1/3 x 1/3, sem arraste) ──
    ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=1; ctx.setLineDash([4,4])
    lh.forEach(h=>{const ly=by+bh*h; ctx.beginPath(); ctx.moveTo(bx,ly); ctx.lineTo(bx+bw,ly); ctx.stroke()})
    lv.forEach(v=>{const lx=bx+bw*v; ctx.beginPath(); ctx.moveTo(lx,by); ctx.lineTo(lx,by+bh); ctx.stroke()})
    ctx.setLineDash([])

    // ── marcador de entrada ──
    if(entrada){
      const ex=entrada.x*s,ey=entrada.y*s
      const r2=7 // circle radius (14px diameter / 2)

      // Chi direction arrow (perpendicular to nearest edge, pointing inward)
      if(bounds){
        const dTop=Math.abs(ey-by), dBot=Math.abs(ey-(by+bh))
        const dLeft=Math.abs(ex-bx), dRight=Math.abs(ex-(bx+bw))
        const minD=Math.min(dTop,dBot,dLeft,dRight)
        let ax=0, ay=0
        if(minD===dTop) ay=1       // nearest to top edge → point down
        else if(minD===dBot) ay=-1  // nearest to bottom → point up
        else if(minD===dLeft) ax=1  // nearest to left → point right
        else ax=-1                  // nearest to right → point left
        const aLen=28, aStart=r2+4
        const sx2=ex+ax*aStart,sy2=ey+ay*aStart
        const ex2=ex+ax*(aStart+aLen),ey2=ey+ay*(aStart+aLen)
        // Arrow shaft
        ctx.strokeStyle='#DC2626'; ctx.lineWidth=2.5
        ctx.beginPath(); ctx.moveTo(sx2,sy2); ctx.lineTo(ex2,ey2); ctx.stroke()
        // Arrowhead
        const headLen=8,headAng=Math.PI/5
        const angle=Math.atan2(ey2-sy2,ex2-sx2)
        ctx.fillStyle='#DC2626'; ctx.beginPath()
        ctx.moveTo(ex2,ey2)
        ctx.lineTo(ex2-headLen*Math.cos(angle-headAng),ey2-headLen*Math.sin(angle-headAng))
        ctx.lineTo(ex2-headLen*Math.cos(angle+headAng),ey2-headLen*Math.sin(angle+headAng))
        ctx.closePath(); ctx.fill()
      }

      // Red circle with white border
      ctx.beginPath(); ctx.arc(ex,ey,r2,0,Math.PI*2)
      ctx.fillStyle='#DC2626'; ctx.fill()
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=2; ctx.stroke()

      // "Entrada" label
      const lbl2='Entrada'
      ctx.font='bold 11px Arial'; ctx.textAlign='left'
      const tw=ctx.measureText(lbl2).width
      const lx=ex+r2+6,ly=ey-r2-2
      ctx.fillStyle='rgba(220,38,38,0.85)'
      const pad=3
      ctx.beginPath()
      ctx.roundRect(lx-pad,ly-10-pad,tw+pad*2,14+pad*2,4)
      ctx.fill()
      ctx.fillStyle='#ffffff'; ctx.fillText(lbl2,lx,ly+2)
    }

    // ── marcações de falta/excesso ──
    const drawMarcacao=(m:Marcacao,s2:number)=>{
      const mx=m.x*s2,my=m.y*s2,mw=m.w*s2,mh=m.h*s2
      const isFalta=m.tipo==='falta'
      ctx.fillStyle=isFalta?'rgba(220,38,38,0.15)':'rgba(245,158,11,0.15)'
      ctx.fillRect(mx,my,mw,mh)
      ctx.strokeStyle=isFalta?'#DC2626':'#F59E0B'; ctx.lineWidth=2; ctx.setLineDash([6,4])
      ctx.strokeRect(mx,my,mw,mh); ctx.setLineDash([])
      // Label
      const marcArea=m.w*m.h
      const boundsArea=bounds?bounds.w*bounds.h:1
      const pctArea=Math.round((marcArea/boundsArea)*100)
      const label=`${isFalta?'FALTA':'EXCESSO'} · ${pctArea}%`
      const fs2=Math.max(8,Math.min(11,mw/10))
      ctx.font=`bold ${fs2}px Arial`; ctx.textAlign='center'
      ctx.fillStyle=isFalta?'rgba(220,38,38,0.9)':'rgba(245,158,11,0.9)'
      ctx.fillText(label,mx+mw/2,my+mh/2+fs2/3)
      // Resize handles (4 corners)
      const hs=4
      ;[[mx,my],[mx+mw,my],[mx,my+mh],[mx+mw,my+mh]].forEach(([hx,hy])=>{
        ctx.fillStyle=isFalta?'#DC2626':'#F59E0B'
        ctx.fillRect(hx-hs,hy-hs,hs*2,hs*2)
        ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(hx-hs,hy-hs,hs*2,hs*2)
      })
      // Delete button (top-right)
      const dx=mx+mw-1,dy=my-1
      ctx.fillStyle=isFalta?'#DC2626':'#F59E0B'
      ctx.beginPath(); ctx.arc(dx,dy,7,0,Math.PI*2); ctx.fill()
      ctx.fillStyle='#fff'; ctx.font='bold 10px Arial'; ctx.textAlign='center'
      ctx.fillText('✕',dx,dy+3.5)
    }
    for(const m of marcacoes) drawMarcacao(m,s)
    // Drawing preview
    if(desenhandoPreview){
      const isFalta=modo==='marcarFalta'
      const px=desenhandoPreview.x*s,py=desenhandoPreview.y*s,pw=desenhandoPreview.w*s,ph=desenhandoPreview.h*s
      ctx.fillStyle=isFalta?'rgba(220,38,38,0.15)':'rgba(245,158,11,0.15)'
      ctx.fillRect(px,py,pw,ph)
      ctx.strokeStyle=isFalta?'#DC2626':'#F59E0B'; ctx.lineWidth=2; ctx.setLineDash([6,4])
      ctx.strokeRect(px,py,pw,ph); ctx.setLineDash([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[bounds,entrada,lado,escola,lh,lv,modo,setores,ativo,marcacoes,desenhandoPreview])

  // redesenha sempre que draw muda (state changes)
  useEffect(()=>{ draw() },[draw])
  // redesenha quando rotRef é atualizado (depois do useEffect de rotação)
  useEffect(()=>{ draw() },[rot,img])
  // redesenha quando step muda (ex: configurar → entrada)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ draw() },[step])

  // Responsive: recalculate canvas on window resize + container resize
  useEffect(()=>{
    if(!img) return
    function handleResize(){ resizeCanvas(); draw() }
    window.addEventListener('resize',handleResize)

    // ResizeObserver catches container size changes (sidebar toggle, layout shifts)
    const container = canvasContainerRef.current
    let ro: ResizeObserver | undefined
    if(container && typeof ResizeObserver !== 'undefined'){
      ro = new ResizeObserver(()=>{ resizeCanvas(); draw() })
      ro.observe(container)
    }

    return ()=>{
      window.removeEventListener('resize',handleResize)
      ro?.disconnect()
    }
  },[img,resizeCanvas,draw])

  // ── fullscreen canvas draw ──────────────────────────────────────────────────
  const drawFS = useCallback(()=>{
    const cv=fsCvRef.current, r=rotRef.current; if(!cv||!r||!fullscreen) return
    const ctx=cv.getContext('2d')!
    // Size fullscreen canvas to fill viewport with some padding
    const maxW = window.innerWidth - 60
    const maxH = window.innerHeight - 160
    const s = Math.min(maxW/r.width, maxH/r.height)
    cv.width = r.width*s; cv.height = r.height*s
    cv.style.width = cv.width+'px'; cv.style.height = cv.height+'px'

    ctx.clearRect(0,0,cv.width,cv.height)
    ctx.drawImage(r,0,0,cv.width,cv.height)

    if(!bounds) return
    const bx=bounds.x*s,by=bounds.y*s,bw=bounds.w*s,bh=bounds.h*s
    const order2=gridOrder(escola,lado)

    // Draw sectors
    for(let row=0;row<3;row++) for(let col=0;col<3;col++){
      const idx=row*3+col, st=SETORES[order2[idx]], sc=setores[idx]
      const x0=bx+(col===0?0:bw*lv[col-1]),x1=bx+(col===2?bw:bw*lv[col])
      const y0=by+(row===0?0:bh*lh[row-1]),y1=by+(row===2?bh:bh*lh[row])
      const fw=x1-x0,fh=y1-y0
      const geoVal2=sc?geoEfetivo(sc):100
      const c=sc?corGeo(geoVal2,sc):st.cor
      ctx.fillStyle=c+'18'; ctx.fillRect(x0,y0,fw,fh)
      ctx.strokeStyle=c; ctx.lineWidth=1.5; ctx.strokeRect(x0,y0,fw,fh)
      const fs=Math.max(10,Math.min(16,fw/9))
      ctx.fillStyle='#000000cc'; ctx.font=`bold ${fs}px Arial`; ctx.textAlign='center'
      ctx.fillText(st.nome,x0+fw/2,y0+fh/2-(sc?fs*0.3:0))
      if(sc){
        ctx.font=`bold ${Math.max(8,fs-1)}px Arial`
        ctx.fillStyle=c
        ctx.fillText(lblGeo(geoVal2,sc),x0+fw/2,y0+fh/2+fs*0.9)
      }
    }

    // Boundary
    ctx.strokeStyle=modo==='bordas'?'#FF4500':'#1E3A5F'
    ctx.lineWidth=modo==='bordas'?3:2.5
    ctx.setLineDash(modo==='bordas'?[8,5]:[])
    ctx.strokeRect(bx,by,bw,bh); ctx.setLineDash([])

    // Border handles
    if(modo==='bordas'){
      [[bx+bw/2,by],[bx+bw/2,by+bh],[bx,by+bh/2],[bx+bw,by+bh/2]].forEach(([hx,hy])=>{
        ctx.beginPath(); ctx.arc(hx,hy,14,0,Math.PI*2)
        ctx.fillStyle='#FF4500'; ctx.fill()
        ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke()
      })
    }

    // Grid lines (fixed 1/3 x 1/3)
    ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1; ctx.setLineDash([6,4])
    lh.forEach(h=>{const ly=by+bh*h; ctx.beginPath(); ctx.moveTo(bx,ly); ctx.lineTo(bx+bw,ly); ctx.stroke()})
    lv.forEach(v=>{const lx=bx+bw*v; ctx.beginPath(); ctx.moveTo(lx,by); ctx.lineTo(lx,by+bh); ctx.stroke()})
    ctx.setLineDash([])

    // Entry marker (fullscreen version)
    if(entrada){
      const ex2=entrada.x*s,ey2=entrada.y*s
      const r2=9

      // Chi direction arrow (pointing toward center of bounds)
      if(bounds){
        const dTop2=Math.abs(ey2-by), dBot2=Math.abs(ey2-(by+bh))
        const dLeft2=Math.abs(ex2-bx), dRight2=Math.abs(ex2-(bx+bw))
        const minD2=Math.min(dTop2,dBot2,dLeft2,dRight2)
        let ax2=0, ay2=0
        if(minD2===dTop2) ay2=1
        else if(minD2===dBot2) ay2=-1
        else if(minD2===dLeft2) ax2=1
        else ax2=-1
        const aLen=36, aStart=r2+5
        const sx3=ex2+ax2*aStart,sy3=ey2+ay2*aStart
        const ex3=ex2+ax2*(aStart+aLen),ey3=ey2+ay2*(aStart+aLen)
        ctx.strokeStyle='#DC2626'; ctx.lineWidth=3
        ctx.beginPath(); ctx.moveTo(sx3,sy3); ctx.lineTo(ex3,ey3); ctx.stroke()
        const headLen=10,headAng=Math.PI/5
        const angle=Math.atan2(ey3-sy3,ex3-sx3)
        ctx.fillStyle='#DC2626'; ctx.beginPath()
        ctx.moveTo(ex3,ey3)
        ctx.lineTo(ex3-headLen*Math.cos(angle-headAng),ey3-headLen*Math.sin(angle-headAng))
        ctx.lineTo(ex3-headLen*Math.cos(angle+headAng),ey3-headLen*Math.sin(angle+headAng))
        ctx.closePath(); ctx.fill()
      }

      ctx.beginPath(); ctx.arc(ex2,ey2,r2,0,Math.PI*2)
      ctx.fillStyle='#DC2626'; ctx.fill()
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.5; ctx.stroke()

      const lbl2='Entrada'
      ctx.font='bold 13px Arial'; ctx.textAlign='left'
      const tw=ctx.measureText(lbl2).width
      const lx=ex2+r2+8,ly=ey2-r2-2
      ctx.fillStyle='rgba(220,38,38,0.85)'
      const pad=4
      ctx.beginPath()
      ctx.roundRect(lx-pad,ly-12-pad,tw+pad*2,16+pad*2,5)
      ctx.fill()
      ctx.fillStyle='#ffffff'; ctx.fillText(lbl2,lx,ly+2)
    }

    // ── marcações de falta/excesso (fullscreen) ──
    const drawMarcacaoFS=(m:Marcacao)=>{
      const mx=m.x*s,my=m.y*s,mw=m.w*s,mh=m.h*s
      const isFalta=m.tipo==='falta'
      ctx.fillStyle=isFalta?'rgba(220,38,38,0.15)':'rgba(245,158,11,0.15)'
      ctx.fillRect(mx,my,mw,mh)
      ctx.strokeStyle=isFalta?'#DC2626':'#F59E0B'; ctx.lineWidth=2; ctx.setLineDash([6,4])
      ctx.strokeRect(mx,my,mw,mh); ctx.setLineDash([])
      const marcArea2=m.w*m.h
      const boundsArea2=bounds?bounds.w*bounds.h:1
      const pctArea2=Math.round((marcArea2/boundsArea2)*100)
      const label=`${isFalta?'FALTA':'EXCESSO'} · ${pctArea2}%`
      const fs2=Math.max(10,Math.min(14,mw/8))
      ctx.font=`bold ${fs2}px Arial`; ctx.textAlign='center'
      ctx.fillStyle=isFalta?'rgba(220,38,38,0.9)':'rgba(245,158,11,0.9)'
      ctx.fillText(label,mx+mw/2,my+mh/2+fs2/3)
      const hs=5
      ;[[mx,my],[mx+mw,my],[mx,my+mh],[mx+mw,my+mh]].forEach(([hx,hy])=>{
        ctx.fillStyle=isFalta?'#DC2626':'#F59E0B'
        ctx.fillRect(hx-hs,hy-hs,hs*2,hs*2)
        ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(hx-hs,hy-hs,hs*2,hs*2)
      })
      const dx=mx+mw-1,dy=my-1
      ctx.fillStyle=isFalta?'#DC2626':'#F59E0B'
      ctx.beginPath(); ctx.arc(dx,dy,8,0,Math.PI*2); ctx.fill()
      ctx.fillStyle='#fff'; ctx.font='bold 11px Arial'; ctx.textAlign='center'
      ctx.fillText('✕',dx,dy+4)
    }
    for(const m of marcacoes) drawMarcacaoFS(m)
    if(desenhandoPreview){
      const isFalta=modo==='marcarFalta'
      const px=desenhandoPreview.x*s,py=desenhandoPreview.y*s,pw=desenhandoPreview.w*s,ph=desenhandoPreview.h*s
      ctx.fillStyle=isFalta?'rgba(220,38,38,0.15)':'rgba(245,158,11,0.15)'
      ctx.fillRect(px,py,pw,ph)
      ctx.strokeStyle=isFalta?'#DC2626':'#F59E0B'; ctx.lineWidth=2; ctx.setLineDash([6,4])
      ctx.strokeRect(px,py,pw,ph); ctx.setLineDash([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[fullscreen,bounds,entrada,lado,escola,lh,lv,modo,setores,marcacoes,desenhandoPreview])

  useEffect(()=>{ drawFS() },[drawFS])

  // ── fullscreen canvas event helpers ─────────────────────────────────────────
  function fsScale(){
    const cv=fsCvRef.current, r=rotRef.current
    return(cv&&r)?cv.width/r.width:1
  }
  function fsCC(e:React.MouseEvent<HTMLCanvasElement>){
    const cv=fsCvRef.current!,rect=cv.getBoundingClientRect()
    return{cx:(e.clientX-rect.left)*(cv.width/rect.width),cy:(e.clientY-rect.top)*(cv.height/rect.height)}
  }
  function fsFindDrag(cx:number,cy:number):Drag|null{
    if(!bounds) return null
    const s=fsScale(),T=DRAG+4
    const bx=bounds.x*s,by=bounds.y*s,bw=bounds.w*s,bh=bounds.h*s
    if(modo==='bordas'){
      if(Math.abs(cy-by)<T&&cx>=bx-T&&cx<=bx+bw+T) return{tipo:'borda',lado:'top'}
      if(Math.abs(cy-by-bh)<T&&cx>=bx-T&&cx<=bx+bw+T) return{tipo:'borda',lado:'bottom'}
      if(Math.abs(cx-bx)<T&&cy>=by-T&&cy<=by+bh+T) return{tipo:'borda',lado:'left'}
      if(Math.abs(cx-bx-bw)<T&&cy>=by-T&&cy<=by+bh+T) return{tipo:'borda',lado:'right'}
    }
    return null
  }
  function onFsMD(e:React.MouseEvent<HTMLCanvasElement>){
    const{cx,cy}=fsCC(e); const s=fsScale()
    if(modo==='marcarFalta'||modo==='marcarExcesso'){
      const ix=cx/s, iy=cy/s
      for(const m of marcacoes){
        const mx=m.x*s,my=m.y*s,mw=m.w*s,mh=m.h*s
        const dx=mx+mw-1,dy=my-1
        if(Math.sqrt((cx-dx)**2+(cy-dy)**2)<12){removeMarcacao(m.id);return}
        const HANDLE=10
        const corners:[number,number,'tl'|'tr'|'bl'|'br'][]=[
          [mx,my,'tl'],[mx+mw,my,'tr'],[mx,my+mh,'bl'],[mx+mw,my+mh,'br']]
        for(const [hx,hy,c] of corners){
          if(Math.abs(cx-hx)<HANDLE&&Math.abs(cy-hy)<HANDLE){
            dragRef.current={tipo:'marcacao-resize',id:m.id,canto:c}; isDrag.current=false; return
          }
        }
        if(cx>=mx&&cx<=mx+mw&&cy>=my&&cy<=my+mh){
          dragRef.current={tipo:'marcacao-mover',id:m.id,offX:ix-m.x,offY:iy-m.y}; isDrag.current=false; return
        }
      }
      desenhandoRef.current={startX:ix,startY:iy,tipo:modo==='marcarFalta'?'falta':'excesso'}
      isDrag.current=false; return
    }
    if(modo==='nenhum') return
    const t=fsFindDrag(cx,cy)
    if(t){dragRef.current=t; isDrag.current=false}
  }
  function onFsMM(e:React.MouseEvent<HTMLCanvasElement>){
    const{cx,cy}=fsCC(e); const s=fsScale()
    if(desenhandoRef.current){
      isDrag.current=true
      const ix=cx/s, iy=cy/s; const st=desenhandoRef.current
      setDesenhandoPreview({x:Math.min(st.startX,ix),y:Math.min(st.startY,iy),
        w:Math.abs(ix-st.startX),h:Math.abs(iy-st.startY)})
      return
    }
    if(dragRef.current&&(dragRef.current.tipo==='marcacao-mover'||dragRef.current.tipo==='marcacao-resize')){
      isDrag.current=true; const t=dragRef.current; const ix=cx/s, iy=cy/s
      setMarcacoes(prev=>{
        const next=prev.map(m=>{
          if(t.tipo==='marcacao-mover'&&m.id===t.id) return {...m,x:ix-t.offX,y:iy-t.offY}
          if(t.tipo==='marcacao-resize'&&m.id===t.id){
            const nx=t.canto.includes('l')?ix:m.x, ny=t.canto.includes('t')?iy:m.y
            const nw=t.canto.includes('l')?m.x+m.w-ix:ix-m.x
            const nh=t.canto.includes('t')?m.y+m.h-iy:iy-m.y
            return {...m,x:nx,y:ny,w:Math.max(5,nw),h:Math.max(5,nh)}
          }
          return m
        })
        marcacoesRef.current=next; return next
      })
      return
    }
    if(!dragRef.current||!bounds) return
    isDrag.current=true; setBordaModificada(true)
    const bx=bounds.x*s,by=bounds.y*s,bw=bounds.w*s,bh=bounds.h*s
    const t=dragRef.current
    if(t.tipo==='borda'){
      const ix=cx/s,iy=cy/s
      setBounds(prev=>{
        if(!prev) return prev; const nb={...prev}
        if(t.lado==='top'){const dd=nb.y-iy;nb.y=iy;nb.h+=dd}
        if(t.lado==='bottom'){nb.h=iy-nb.y}
        if(t.lado==='left'){const dd=nb.x-ix;nb.x=ix;nb.w+=dd}
        if(t.lado==='right'){nb.w=ix-nb.x}
        if(nb.w<30)nb.w=30; if(nb.h<30)nb.h=30
        boundsRef.current=nb; return nb
      })
    }
  }
  function onFsMU(){
    if(desenhandoRef.current&&desenhandoPreview&&desenhandoPreview.w>3&&desenhandoPreview.h>3){
      const m:Marcacao={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
        tipo:desenhandoRef.current.tipo,...desenhandoPreview}
      const next=[...marcacoes,m]
      setMarcacoes(next); marcacoesRef.current=next
      marcacaoAlterada()
    }
    desenhandoRef.current=null; setDesenhandoPreview(null)
    if(dragRef.current&&(dragRef.current.tipo==='marcacao-mover'||dragRef.current.tipo==='marcacao-resize')){
      if(isDrag.current) marcacaoAlterada()
      dragRef.current=null; setTimeout(()=>{isDrag.current=false},50); return
    }
    if(isDrag.current) recalcular()
    dragRef.current=null; setTimeout(()=>{isDrag.current=false},50)
  }

  // ── coords canvas (independente de CSS scale) ──────────────────────────────
  function cc(e:React.MouseEvent<HTMLCanvasElement>){
    const cv=cvRef.current!,r=cv.getBoundingClientRect()
    return{cx:(e.clientX-r.left)*(cv.width/r.width),cy:(e.clientY-r.top)*(cv.height/r.height)}
  }

  // ── upload ─────────────────────────────────────────────────────────────────
  // Track upload promise so salvarRascunho can wait for URL before saving
  const uploadPromiseRef = useRef<Promise<string|null>|null>(null)

  function onUpload(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file) return
    // Load image locally first
    const reader=new FileReader()
    reader.onload=ev=>{
      const i=new Image()
      i.onload=()=>{
        setImg(i); setRot(0); setStep('metragem')
        // Upload to Supabase storage and wait for URL
        if(consultaId){
          const fd=new FormData()
          fd.append('consulta_id',consultaId)
          fd.append('planta',file)
          const uploadP = fetch('/api/consultas/bagua-planta',{method:'POST',body:fd})
            .then(r=>{
              if(!r.ok) throw new Error(`Upload falhou (${r.status})`)
              return r.json()
            })
            .then(d=>{
              if(d.url){
                setPlantaUrl(d.url)
                plantaUrlRef.current=d.url
                // Save initial draft state
                supabase.from('consultas').update({
                  bagua_entrada:{planta_url:d.url,planta_nome:file.name,planta_enviada_em:new Date().toISOString(),etapa:'metragem',rotacao:0,lado:'centro'}
                }).eq('id',consultaId).then(()=>{}).then(null,(e: Error)=>console.error('Erro ao salvar rascunho:',e))
                return d.url as string
              }
              setMsg(d.error||'Erro ao enviar planta. Verifique o storage do Supabase.'); setMsgTipo('erro')
              return null
            })
            .catch(err=>{
              console.error('Upload planta error:', err)
              setMsg('Erro ao enviar planta para o servidor. Verifique se o bucket de storage existe no Supabase.'); setMsgTipo('erro')
              return null
            })
          uploadPromiseRef.current=uploadP
        }
      }
      i.src=ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Save analysis state as draft (called on key transitions)
  async function salvarRascunho(overrides?:Partial<{etapa:Step;rotacao:number;bordas:Bounds|null;lhV:number[];lvV:number[];entradaV:{x:number;y:number}|null;ladoV:Lado;setoresV:Setor[]}>){
    if(!consultaId||restaurandoRef.current) return
    // Wait for upload to complete if planta_url is not yet available
    let url = plantaUrlRef.current
    if(!url && uploadPromiseRef.current){
      url = await uploadPromiseRef.current
      if(!url) return // upload failed, skip saving
    }
    if(!url) return // no plant image, nothing to save
    const b=overrides?.bordas??boundsRef.current
    const curLh=overrides?.lhV??lhRef.current
    const curLv=overrides?.lvV??lvRef.current
    const draft:BaguaEntrada={
      planta_url:url,
      etapa:overrides?.etapa??step,
      rotacao:overrides?.rotacao??rot,
      lado:overrides?.ladoV??lado,
      metragem_real:metragemRef.current||undefined,
    }
    if(overrides?.entradaV??entrada){
      const ent=overrides?.entradaV??entrada
      draft.x=ent!.x; draft.y=ent!.y
    }
    if(b) draft.bordas={x:b.x,y:b.y,w:b.w,h:b.h}
    if(curLh) draft.lh=curLh
    if(curLv) draft.lv=curLv
    // Save sector draft data (criterios, ajustes)
    const sArr=overrides?.setoresV??setores
    if(sArr.length===9){
      draft.setores_rascunho=sArr.map(sc=>({
        criterios:sc.criterios,
        ajusteManual:sc.ajusteManual,
        ajusteTipo:sc.ajusteTipo,
        obs:sc.obs,
      }))
    }
    // Save marcacoes (falta/excesso rectangles)
    const curMarcacoes=marcacoesRef.current
    if(curMarcacoes.length>0){
      draft.marcacoes=curMarcacoes.map(m=>({id:m.id,tipo:m.tipo,x:m.x,y:m.y,w:m.w,h:m.h}))
    }
    await supabase.from('consultas').update({bagua_entrada:draft}).eq('id',consultaId)
  }

  // ── click ──────────────────────────────────────────────────────────────────
  function onClick(e:React.MouseEvent<HTMLCanvasElement>){
    if(isDrag.current) return
    const{cx,cy}=cc(e); const s=scale()
    if(step==='entrada'){
      const ex=cx/s, ey=cy/s
      const newLado:Lado=(ex)<(rotRef.current?.width||1)*0.33?'esquerda':(ex)>(rotRef.current?.width||1)*0.67?'direita':'centro'
      setEntrada({x:ex,y:ey})
      setLado(newLado)
      // Persist entrance point as draft
      salvarRascunho({etapa:'entrada',entradaV:{x:ex,y:ey},ladoV:newLado})
      return
    }
    if(step==='resultado'&&modo==='nenhum'&&bounds){
      const bx=bounds.x*s,by=bounds.y*s,bw=bounds.w*s,bh=bounds.h*s
      if(cx>=bx&&cx<=bx+bw&&cy>=by&&cy<=by+bh){
        const col=(cx-bx)/bw<lv[0]?0:(cx-bx)/bw<lv[1]?1:2
        const row=(cy-by)/bh<lh[0]?0:(cy-by)/bh<lh[1]?1:2
        setAtivo(p=>p===row*3+col?null:row*3+col)
      }
    }
  }

  // ── marcação helpers — just mark as pending, don't auto-recalculate ─────
  function marcacaoAlterada(){
    setRecalculoPendente(true)
    setBordaModificada(true)
  }
  function removeMarcacao(id:string){
    const next=marcacoes.filter(m=>m.id!==id)
    setMarcacoes(next); marcacoesRef.current=next
    setRecalculoPendente(true); setBordaModificada(true)
  }

  // ── calcular ───────────────────────────────────────────────────────────────
  function calcular(){
    const r=rotRef.current; if(!r) return
    // Default bounds to full image with 5% margin
    const m5=0.05
    const b={x:Math.round(r.width*m5),y:Math.round(r.height*m5),w:Math.round(r.width*(1-2*m5)),h:Math.round(r.height*(1-2*m5))}
    setBounds(b); boundsRef.current=b
    setLh([1/3,2/3]); lhRef.current=[1/3,2/3]
    setLv([1/3,2/3]); lvRef.current=[1/3,2/3]
    const novosSetores=calcularSetores(b,[1/3,2/3],[1/3,2/3],marcacoesRef.current)
    setSetores(novosSetores)
    setStep('resultado'); setModo('nenhum')
    setBordaModificada(false)
    setUltimoRecalculo(new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))
    // Save draft
    salvarRascunho({etapa:'resultado',bordas:b,lhV:[1/3,2/3],lvV:[1/3,2/3],setoresV:novosSetores})
  }

  function recalcular(){
    const b=boundsRef.current
    const curLh=lhRef.current
    const curLv=lvRef.current
    if(!b) return
    const novos=calcularSetores(b,curLh,curLv,marcacoesRef.current)
    setSetores(prev=>{
      const merged=novos.map((n,i)=>({...n,criterios:prev[i]?.criterios??n.criterios,
        ajusteManual:prev[i]?.ajusteManual??null,ajusteTipo:prev[i]?.ajusteTipo??null,obs:prev[i]?.obs??''}))
      salvarRascunho({etapa:'resultado',bordas:b,lhV:curLh,lvV:curLv,setoresV:merged})
      return merged
    })
    setRecalculoPendente(false)
    setBordaModificada(false)
    setUltimoRecalculo(new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))
  }

  // ── drag ───────────────────────────────────────────────────────────────────
  function findDrag(cx:number,cy:number):Drag|null{
    if(!bounds) return null
    const s=scale(),T=DRAG
    const bx=bounds.x*s,by=bounds.y*s,bw=bounds.w*s,bh=bounds.h*s
    if(modo==='bordas'){
      if(Math.abs(cy-by)<T       &&cx>=bx-T&&cx<=bx+bw+T) return{tipo:'borda',lado:'top'}
      if(Math.abs(cy-by-bh)<T    &&cx>=bx-T&&cx<=bx+bw+T) return{tipo:'borda',lado:'bottom'}
      if(Math.abs(cx-bx)<T       &&cy>=by-T&&cy<=by+bh+T) return{tipo:'borda',lado:'left'}
      if(Math.abs(cx-bx-bw)<T    &&cy>=by-T&&cy<=by+bh+T) return{tipo:'borda',lado:'right'}
    }
    return null
  }

  function onMD(e:React.MouseEvent<HTMLCanvasElement>){
    const{cx,cy}=cc(e); const s=scale()
    // Start drawing marcacao
    if(modo==='marcarFalta'||modo==='marcarExcesso'){
      const ix=cx/s, iy=cy/s
      // Check delete button, corner handles, or body
      for(const m of marcacoes){
        const mx=m.x*s,my=m.y*s,mw=m.w*s,mh=m.h*s
        // Delete button (top-right corner)
        const dx=mx+mw-1,dy=my-1
        if(Math.sqrt((cx-dx)**2+(cy-dy)**2)<10){removeMarcacao(m.id);return}
        // Corner handles
        const HANDLE=8
        const corners:[number,number,'tl'|'tr'|'bl'|'br'][]=[
          [mx,my,'tl'],[mx+mw,my,'tr'],[mx,my+mh,'bl'],[mx+mw,my+mh,'br']]
        for(const [hx,hy,c] of corners){
          if(Math.abs(cx-hx)<HANDLE&&Math.abs(cy-hy)<HANDLE){
            dragRef.current={tipo:'marcacao-resize',id:m.id,canto:c}; isDrag.current=false; return
          }
        }
        // Move body
        if(cx>=mx&&cx<=mx+mw&&cy>=my&&cy<=my+mh){
          dragRef.current={tipo:'marcacao-mover',id:m.id,offX:cx/s-m.x,offY:cy/s-m.y}; isDrag.current=false; return
        }
      }
      // Start new drawing
      desenhandoRef.current={startX:ix,startY:iy,tipo:modo==='marcarFalta'?'falta':'excesso'}
      isDrag.current=false; return
    }
    if(modo==='nenhum') return
    const t=findDrag(cx,cy)
    if(t){dragRef.current=t; isDrag.current=false}
  }

  function onMM(e:React.MouseEvent<HTMLCanvasElement>){
    const{cx,cy}=cc(e); const s=scale()
    // Drawing marcacao preview
    if(desenhandoRef.current){
      isDrag.current=true
      const ix=cx/s, iy=cy/s
      const st=desenhandoRef.current
      setDesenhandoPreview({x:Math.min(st.startX,ix),y:Math.min(st.startY,iy),
        w:Math.abs(ix-st.startX),h:Math.abs(iy-st.startY)})
      return
    }
    // Moving/resizing marcacao
    if(dragRef.current&&(dragRef.current.tipo==='marcacao-mover'||dragRef.current.tipo==='marcacao-resize')){
      isDrag.current=true
      const t=dragRef.current
      const ix=cx/s, iy=cy/s
      setMarcacoes(prev=>{
        const next=prev.map(m=>{
          if(t.tipo==='marcacao-mover'&&m.id===t.id){
            return {...m,x:ix-t.offX,y:iy-t.offY}
          }
          if(t.tipo==='marcacao-resize'&&m.id===t.id){
            const nx=t.canto.includes('l')?ix:m.x
            const ny=t.canto.includes('t')?iy:m.y
            const nw=t.canto.includes('l')?m.x+m.w-ix:ix-m.x
            const nh=t.canto.includes('t')?m.y+m.h-iy:iy-m.y
            return {...m,x:nx,y:ny,w:Math.max(5,nw),h:Math.max(5,nh)}
          }
          return m
        })
        marcacoesRef.current=next; return next
      })
      return
    }
    if(!dragRef.current||!bounds) return
    isDrag.current=true; setBordaModificada(true)
    const bx=bounds.x*s,by=bounds.y*s,bw=bounds.w*s,bh=bounds.h*s
    const t=dragRef.current
    if(t.tipo==='borda'){
      const ix=cx/s,iy=cy/s
      setBounds(prev=>{
        if(!prev) return prev; const b={...prev}
        if(t.lado==='top')    {const d=b.y-iy;b.y=iy;b.h+=d}
        if(t.lado==='bottom') {b.h=iy-b.y}
        if(t.lado==='left')   {const d=b.x-ix;b.x=ix;b.w+=d}
        if(t.lado==='right')  {b.w=ix-b.x}
        if(b.w<30)b.w=30; if(b.h<30)b.h=30
        boundsRef.current=b; return b
      })
    }
  }

  function onMU(){
    // Finish drawing marcacao
    if(desenhandoRef.current&&desenhandoPreview&&desenhandoPreview.w>3&&desenhandoPreview.h>3){
      const m:Marcacao={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
        tipo:desenhandoRef.current.tipo,...desenhandoPreview}
      const next=[...marcacoes,m]
      setMarcacoes(next); marcacoesRef.current=next
      marcacaoAlterada()
    }
    desenhandoRef.current=null; setDesenhandoPreview(null)
    // Finish moving/resizing marcacao
    if(dragRef.current&&(dragRef.current.tipo==='marcacao-mover'||dragRef.current.tipo==='marcacao-resize')){
      if(isDrag.current) marcacaoAlterada()
      dragRef.current=null; setTimeout(()=>{isDrag.current=false},50); return
    }
    if(isDrag.current) recalcular()
    dragRef.current=null; setTimeout(()=>{isDrag.current=false},50)
  }

  // ── critério ───────────────────────────────────────────────────────────────
  // ── salvar setor no banco ──────────────────────────────────────────────────
  async function salvarSetorDB(orderIdx:number){
    if(!consultaId) return
    const stDef=SETORES[order[orderIdx]]
    const sc=setores[orderIdx]
    // upsert setor_bagua
    const {data:setorRow,error:e1}=await supabase.from('setores_bagua').upsert({
      consulta_id:consultaId,
      numero:orderIdx+1,
      nome:stDef.nome,
      elemento:stDef.elem,
      posicao_grid:String(orderIdx+1),
      score_percentual:scoreTotal(sc)
    },{onConflict:'consulta_id,numero'}).select('id').single()
    if(e1||!setorRow){setMsg('Erro: '+(e1?.message||JSON.stringify(e1)||'sem retorno'));setMsgTipo('erro');return}
    // salvar criterios
    const nomes=['Limpeza e organização','Iluminação adequada','Ventilação e ar fresco','Cores harmônicas','Mobiliário posicionado','Plantas e elementos naturais','Ausência de objetos quebrados','Fluxo de energia livre']
    const inserts=nomes.map((criterio,ci)=>({setor_id:setorRow.id,criterio,score:sc.criterios[ci]??0}))
    const {error:eDelC}=await supabase.from('diagnostico_criterios').delete().eq('setor_id',setorRow.id)
    const {error:eInsC}=await supabase.from('diagnostico_criterios').insert(inserts)
    if(eDelC||eInsC){setMsg('Erro ao salvar critérios do diagnóstico: '+((eDelC||eInsC)?.message||''));setMsgTipo('erro');return}
    // Save canvas snapshot to consulta (best effort - column may not exist yet)
    try {
      const cv=cvRef.current
      if(cv){
        const dataUrl=cv.toDataURL('image/png',0.7)
        await supabase.from('consultas').update({bagua_imagem:dataUrl}).eq('id',consultaId)
      }
    } catch{}
    setMsg(`"${stDef.nome}" salvo!`); setMsgTipo('sucesso')
    setTimeout(()=>setMsg(''),3000)
  }

  function setCrit(si:number,ci:number,val:number){
    setSetores(p=>p.map((sc,i)=>i!==si?sc:{...sc,criterios:sc.criterios.map((v,j)=>j===ci?val:v)}))
  }
  function setAjusteManual(si:number,val:number|null){
    setSetores(p=>p.map((sc,i)=>i!==si?sc:{...sc,ajusteManual:val}))
  }
  function setAjusteTipo(si:number,val:'equilibrado'|'faltante'|'excedente'|null){
    setSetores(p=>p.map((sc,i)=>i!==si?sc:{...sc,ajusteTipo:val}))
  }
  function setObs(si:number,val:string){
    setSetores(p=>p.map((sc,i)=>i!==si?sc:{...sc,obs:val}))
  }
  function resetAjuste(si:number){
    setSetores(p=>p.map((sc,i)=>i!==si?sc:{...sc,ajusteManual:null,ajusteTipo:null,obs:''}))
  }

  const [salvandoTudo,setSalvandoTudo] = useState(false)

  async function finalizarAnalise(){
    if(!consultaId||setores.length!==9) return
    setSalvandoTudo(true)
    try{
      const nomes=['Limpeza e organização','Iluminação adequada','Ventilação e ar fresco','Cores harmônicas','Mobiliário posicionado','Plantas e elementos naturais','Ausência de objetos quebrados','Fluxo de energia livre']
      // Save all 9 sectors
      for(let i=0;i<9;i++){
        const stDef=SETORES[order[i]]
        const sc=setores[i]
        const scorePct=scoreTotal(sc)
        const {data:setorRow,error:e1}=await supabase.from('setores_bagua').upsert({
          consulta_id:consultaId,
          numero:i+1,
          nome:stDef.nome,
          elemento:stDef.elem,
          posicao_grid:String(i+1),
          score_percentual:scorePct
        },{onConflict:'consulta_id,numero'}).select('id').single()
        if(e1||!setorRow) continue
        const inserts=nomes.map((criterio,ci)=>({setor_id:setorRow.id,criterio,score:sc.criterios[ci]??0}))
        const {error:eDelC}=await supabase.from('diagnostico_criterios').delete().eq('setor_id',setorRow.id)
        const {error:eInsC}=await supabase.from('diagnostico_criterios').insert(inserts)
        if(eDelC||eInsC) throw new Error('Falha ao salvar critérios: '+((eDelC||eInsC)?.message||''))
      }
      // Save canvas snapshot + finalization metadata
      const cv=cvRef.current
      const dataUrl=cv?cv.toDataURL('image/png',0.7):null
      const b=boundsRef.current
      const finalizacao:BaguaEntrada={
        x:entrada?.x??0, y:entrada?.y??0, lado,
        bordas:b?{x:b.x,y:b.y,w:b.w,h:b.h}:null,
        finalizada_em:new Date().toISOString(),
        lh:lhRef.current, lv:lvRef.current,
        rotacao:rot, etapa:'resultado',
        metragem_real:metragemRef.current||undefined,
      }
      const urlFinal = plantaUrlRef.current || plantaUrl
      if(urlFinal) finalizacao.planta_url=urlFinal
      // Save sector draft data for restoration
      if(setores.length===9){
        finalizacao.setores_rascunho=setores.map(sc=>({
          criterios:sc.criterios,
          ajusteManual:sc.ajusteManual,
          ajusteTipo:sc.ajusteTipo,
          obs:sc.obs,
        }))
      }
      // Save marcacoes
      if(marcacoes.length>0){
        finalizacao.marcacoes=marcacoes.map(m=>({id:m.id,tipo:m.tipo,x:m.x,y:m.y,w:m.w,h:m.h}))
      }
      await supabase.from('consultas').update({
        bagua_imagem:dataUrl,
        bagua_entrada:finalizacao,
        status:'em_andamento',
      }).eq('id',consultaId)
      // Show toast
      setMsg('✓ Análise salva com sucesso. Todas as páginas foram atualizadas.'); setMsgTipo('sucesso')
      setTimeout(()=>{
        router.push(`/consultas/${consultaId}`)
      },1000)
    }catch(err){
      setMsg('Erro ao salvar: '+(err instanceof Error ? err.message : 'erro desconhecido')); setMsgTipo('erro')
    }finally{
      setSalvandoTudo(false)
    }
  }

  const order  = gridOrder(escola,lado)
  const stepN  = {upload:0,metragem:1,configurar:2,entrada:3,resultado:4}[step]
  const stAtivo= ativo!==null?SETORES[order[ativo]]:null
  const scAtivo= ativo!==null?setores[ativo]:null

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <FlowLayout
      showHeader
      backLabel={consultaNome || 'Consulta'}
      backHref={consultaId ? `/consultas/${consultaId}` : '/consultas'}
    >
      <style>{`
        @keyframes pulseEntrada {
          0%   { transform: scale(1);   opacity: 1; }
          50%  { transform: scale(1.5); opacity: 0.4; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes pulseRecalc {
          0%   { box-shadow: 0 0 0 0 rgba(234,88,12,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(234,88,12,0); }
          100% { box-shadow: 0 0 0 0 rgba(234,88,12,0); }
        }
      `}</style>

      <main style={{padding:'14px 18px',maxWidth:'1160px',margin:'0 auto'}}>

        <div style={{marginBottom:'10px'}}>
          <h1 style={{color:'#1E3A5F',fontSize:'17px',fontWeight:'bold',margin:'0 0 2px 0'}}>Análise de Planta Ba Gua</h1>
          <p style={{color:'#6B7280',fontSize:'12px',margin:0}}>Mapeamento e avaliação energética por setor</p>
        </div>

        {/* Steps */}
        <div style={{display:'flex',gap:'6px',marginBottom:'12px',alignItems:'center'}}>
          {['Upload','Metragem','Configurar','Entrada','Resultado'].map((s,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:'5px'}}>
              <div style={{width:'20px',height:'20px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'10px',fontWeight:'bold',
                background:i<stepN?'#15803D':i===stepN?'#1E3A5F':'#E5E7EB',
                color:i<=stepN?'#fff':'#9CA3AF'}}>
                {i<stepN?'✓':i+1}
              </div>
              <span style={{color:'#374151',fontSize:'12px'}}>{s}</span>
              {i<4&&<span style={{color:'#D1D5DB',fontSize:'10px'}}>→</span>}
            </div>
          ))}
        </div>

        {/* ════ LOADING PLANTA ════ */}
        {carregandoPlanta&&(
          <div style={{background:'#fff',borderRadius:'12px',padding:'48px',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
            <div style={{fontSize:'48px',marginBottom:'10px'}}>☯</div>
            <h3 style={{color:'#1E3A5F',fontSize:'16px',marginBottom:'6px'}}>Carregando planta salva...</h3>
            <p style={{color:'#6B7280',fontSize:'13px'}}>Restaurando análise anterior</p>
          </div>
        )}

        {/* ════ RETOMAR / RECOMEÇAR ════ */}
        {showRetomar&&!carregandoPlanta&&(
          <div style={{background:'#fff',borderRadius:'12px',padding:'36px',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
            <div style={{fontSize:'48px',marginBottom:'10px'}}>🏠</div>
            <h3 style={{color:'#1E3A5F',fontSize:'16px',marginBottom:'6px'}}>
              {rascunhoRef.current?.finalizada_em?'Diagnóstico finalizado anteriormente':'Análise em andamento'}
            </h3>
            <p style={{color:'#6B7280',fontSize:'13px',marginBottom:'20px'}}>
              {rascunhoRef.current?.finalizada_em
                ?`Finalizada em ${new Date(rascunhoRef.current.finalizada_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}`
                :`Etapa: ${({upload:'Upload',metragem:'Metragem',configurar:'Configurar',entrada:'Entrada',resultado:'Resultado'} as Record<string,string>)[rascunhoRef.current?.etapa||'upload']||'Upload'}`
              }
            </p>
            <div style={{display:'flex',gap:'12px',justifyContent:'center'}}>
              <button onClick={restaurarRascunho}
                style={{background:'#15803D',color:'#fff',border:'none',padding:'10px 24px',borderRadius:'8px',fontSize:'14px',fontWeight:'bold',cursor:'pointer'}}>
                Continuar análise
              </button>
              <button onClick={()=>{
                if(confirm('Tem certeza que deseja recomecar do zero? Todos os dados salvos serão apagados.')){
                  recomecarAnalise()
                }
              }}
                style={{background:'#fff',color:'#DC2626',border:'2px solid #DC2626',padding:'10px 24px',borderRadius:'8px',fontSize:'14px',fontWeight:'bold',cursor:'pointer'}}>
                Recomeçar do zero
              </button>
            </div>
          </div>
        )}

        {/* ════ UPLOAD ════ */}
        {step==='upload'&&!showRetomar&&!carregandoPlanta&&(
          <div style={{background:'#fff',borderRadius:'12px',padding:'48px',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
            <div style={{fontSize:'48px',marginBottom:'10px'}}>🏠</div>
            <h3 style={{color:'#1E3A5F',fontSize:'16px',marginBottom:'6px'}}>Upload da planta baixa</h3>
            <p style={{color:'#6B7280',fontSize:'13px',marginBottom:'20px'}}>JPG ou PNG · fundo branco com paredes escuras</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} style={{display:'none'}}/>
            <button onClick={()=>fileRef.current?.click()}
              style={{background:'#7C3AED',color:'#fff',border:'none',padding:'10px 28px',borderRadius:'8px',fontSize:'14px',fontWeight:'bold',cursor:'pointer'}}>
              Selecionar arquivo
            </button>
          </div>
        )}

        {/* ════ METRAGEM ════ */}
        {step==='metragem'&&!showRetomar&&!carregandoPlanta&&(
          <div style={{background:'#fff',borderRadius:'12px',padding:'36px',boxShadow:'0 1px 4px rgba(0,0,0,0.08)',maxWidth:'480px',margin:'0 auto'}}>
            <div style={{fontSize:'36px',textAlign:'center',marginBottom:'10px'}}>📐</div>
            <h3 style={{color:'#1E3A5F',fontSize:'16px',textAlign:'center',marginBottom:'6px'}}>Metragem do imóvel</h3>
            <p style={{color:'#6B7280',fontSize:'12px',textAlign:'center',marginBottom:'20px'}}>
              Informe a área total construída para converter os valores de pixels em metros quadrados
            </p>
            <div style={{marginBottom:'16px'}}>
              <label htmlFor="metragem-input" style={{display:'block',color:'#374151',fontSize:'13px',fontWeight:'bold',marginBottom:'6px'}}>
                Área total (m²)
              </label>
              <input id="metragem-input" type="number" min={1} max={99999} step={0.1}
                value={metragemReal||''}
                placeholder="Ex: 120"
                onChange={e=>{const v=Number(e.target.value); setMetragemReal(v); metragemRef.current=v}}
                style={{width:'100%',padding:'10px 14px',borderRadius:'8px',border:'2px solid #D1D5DB',fontSize:'16px',boxSizing:'border-box',textAlign:'center'}}
              />
              <p style={{color:'#9CA3AF',fontSize:'10px',marginTop:'4px',textAlign:'center'}}>
                Área construída total conforme planta baixa
              </p>
            </div>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={()=>setStep('upload')}
                style={{flex:1,padding:'10px',background:'transparent',color:'#6B7280',border:'1px solid #E5E7EB',borderRadius:'8px',fontSize:'14px',cursor:'pointer'}}>
                ← Voltar
              </button>
              <button onClick={()=>setStep('configurar')}
                style={{flex:2,padding:'10px',background:metragemReal>0?'#1E3A5F':'#93C5FD',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'bold',cursor:metragemReal>0?'pointer':'not-allowed',opacity:metragemReal>0?1:0.6}}
                disabled={metragemReal<=0}>
                Continuar → Configurar planta
              </button>
            </div>
            {metragemReal<=0&&(
              <p style={{color:'#D97706',fontSize:'10px',textAlign:'center',marginTop:'8px'}}>
                Informe a metragem para continuar
              </p>
            )}
          </div>
        )}

        {/* ════ CANVAS AREA (sempre no DOM quando há imagem) ════ */}
        {step!=='upload'&&step!=='metragem'&&!showRetomar&&!carregandoPlanta&&(
          <div style={{display:'flex',gap:'12px',alignItems:'flex-start'}}>
            <div style={{flex:1,minWidth:0,background:'#fff',borderRadius:'12px',padding:'14px',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>

              {/* Instrução contextual acima do canvas */}
              {step==='configurar'&&(
                <div style={{marginBottom:'10px',padding:'14px 16px',background:'#FFFBEB',borderLeft:'4px solid #F59E0B',borderRadius:'8px',color:'#92400E',fontSize:'14px',fontWeight:600}}>
                  <div style={{marginBottom:'10px'}}>
                    🔄 Ajuste a rotação para que a <strong>porta fique na base</strong> da imagem (↓), depois clique em Continuar
                  </div>
                  <div style={{display:'flex',justifyContent:'center'}}>
                    <div style={{width:'90px',height:'110px',border:'2px solid #D97706',borderRadius:'6px',position:'relative',background:'#FEF3C7',display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:'4px'}}>
                      <div style={{position:'absolute',top:'8px',left:'50%',transform:'translateX(-50)',fontSize:'10px',color:'#92400E',fontWeight:700}}>Planta</div>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0px'}}>
                        <span style={{fontSize:'18px',lineHeight:1,color:'#D97706'}}>↓</span>
                        <span style={{fontSize:'9px',fontWeight:700,color:'#B45309'}}>Porta aqui</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {step==='entrada'&&(
                <div style={{marginBottom:'8px',padding:'7px 10px',background:'#EFF6FF',borderRadius:'6px',color:'#1D4ED8',fontSize:'12px'}}>
                  🖱️ <strong>Clique na planta</strong> onde fica a entrada principal
                </div>
              )}
              {step==='resultado'&&(
                <div style={{marginBottom:'7px',padding:'6px 10px',background:'#F0F9FF',borderRadius:'6px',color:'#0369A1',fontSize:'11px'}}>
                  💡 Escola: <strong>{escola==='btb'?'BTB':'Bússola'}</strong> · Entrada: <strong>{lado}</strong> · Clique num setor para avaliar
                </div>
              )}

              {/* ══ CANVAS ÚNICO — nunca sai do DOM ══ */}
              <div ref={canvasContainerRef} style={{position:'relative',display:'inline-block',width:'100%'}}>
                <canvas ref={cvRef}
                  onClick={step==='entrada'||step==='resultado'?onClick:undefined}
                  onMouseDown={step==='resultado'?onMD:undefined}
                  onMouseMove={step==='resultado'?onMM:undefined}
                  onMouseUp={step==='resultado'?onMU:undefined}
                  onMouseLeave={step==='resultado'?onMU:undefined}
                  style={{
                    display:'block',
                    border:'1px solid #E5E7EB',borderRadius:'8px',
                    cursor: step==='entrada'?'crosshair':(modo==='marcarFalta'||modo==='marcarExcesso')?'crosshair':modo!=='nenhum'?'move':'pointer',
                    userSelect:'none',
                  }}
                />
                {/* Pulse animation overlay for entrance marker */}
                {entrada&&cvRef.current&&(()=>{
                  const cv=cvRef.current!
                  const s2=cv.width/(rotRef.current?.width||1)
                  const cssScaleX=cv.getBoundingClientRect().width/cv.width
                  const cssScaleY=cv.getBoundingClientRect().height/cv.height
                  const px=(entrada.x*s2)*cssScaleX
                  const py=(entrada.y*s2)*cssScaleY
                  return (
                    <div style={{
                      position:'absolute',left:px-7,top:py-7,
                      width:14,height:14,borderRadius:'50%',
                      border:'2px solid rgba(220,38,38,0.5)',
                      animation:'pulseEntrada 1.2s ease-in-out infinite',
                      pointerEvents:'none',
                    }}/>
                  )
                })()}
              </div>

              {/* Controles CONFIGURAR */}
              {step==='configurar'&&(
                <div style={{marginTop:'12px'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                    <div>
                      <label style={{display:'block',color:'#374151',fontSize:'12px',fontWeight:'bold',marginBottom:'7px'}}>1️⃣ Método</label>
                      <div style={{display:'flex',gap:'7px'}}>
                        <button onClick={()=>setEscola('btb')} style={{
                          flex:1,padding:'7px 4px',borderRadius:'7px',border:'2px solid',fontSize:'12px',fontWeight:'bold',cursor:'pointer',
                          borderColor:escola==='btb'?'#7C3AED':'#D1D5DB',background:escola==='btb'?'#EDE9FE':'#fff',color:escola==='btb'?'#7C3AED':'#6B7280',
                        }}>🚪 BTB<br/><span style={{fontWeight:'normal',fontSize:'10px'}}>Porta como ref.</span></button>
                        <button
                          title="Método Bússola — em desenvolvimento. Em breve disponível."
                          style={{
                            flex:1,padding:'7px 4px',borderRadius:'7px',border:'2px solid',fontSize:'12px',fontWeight:'bold',
                            cursor:'not-allowed',opacity:0.4,
                            borderColor:'#D1D5DB',background:'#fff',color:'#6B7280',
                          }}>🧭 Bússola<br/><span style={{fontWeight:'normal',fontSize:'10px'}}>Cardinais</span></button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="input-rotacao" style={{display:'block',color:'#374151',fontSize:'12px',fontWeight:'bold',marginBottom:'7px'}}>
                        2️⃣ Rotação <span style={{color:'#7C3AED',fontWeight:'normal'}}>{rot}°</span>
                      </label>
                      <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'6px'}}>
                        <button onClick={()=>setRot(r=>(r-90+360)%360)} style={{padding:'4px 10px',background:'#F3F4F6',border:'1px solid #D1D5DB',borderRadius:'5px',cursor:'pointer'}}>↺</button>
                        <input id="input-rotacao" type="range" min={0} max={359} value={rot} onChange={e=>setRot(Number(e.target.value))} style={{flex:1}}/>
                        <button onClick={()=>setRot(r=>(r+90)%360)} style={{padding:'4px 10px',background:'#F3F4F6',border:'1px solid #D1D5DB',borderRadius:'5px',cursor:'pointer'}}>↻</button>
                      </div>
                      <div style={{display:'flex',gap:'4px'}}>
                        {[0,90,180,270].map(r=>(
                          <button key={r} onClick={()=>setRot(r)} style={{
                            flex:1,padding:'3px 0',fontSize:'11px',border:'1px solid',borderRadius:'4px',cursor:'pointer',
                            borderColor:rot===r?'#7C3AED':'#D1D5DB',background:rot===r?'#EDE9FE':'#fff',color:rot===r?'#7C3AED':'#6B7280',
                          }}>{r}°</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button onClick={()=>setStep('entrada')}
                    style={{width:'100%',background:'#1E3A5F',color:'#fff',border:'none',padding:'10px',borderRadius:'8px',fontSize:'14px',fontWeight:'bold',cursor:'pointer'}}>
                    Continuar → Marcar entrada principal
                  </button>
                </div>
              )}

              {/* Controles ENTRADA */}
              {step==='entrada'&&(
                <div style={{marginTop:'10px',display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                  <button onClick={()=>setStep('configurar')}
                    style={{padding:'6px 14px',background:'transparent',color:'#6B7280',border:'1px solid #E5E7EB',borderRadius:'6px',fontSize:'14px',fontWeight:400,cursor:'pointer'}}>
                    ← Voltar
                  </button>
                  {entrada&&(
                    <div style={{padding:'5px 11px',background:'#F0FDF4',borderRadius:'6px',color:'#15803D',fontSize:'12px'}}>
                      ✅ Entrada: <strong>{lado}</strong>
                    </div>
                  )}
                  {entrada&&(
                    <button onClick={calcular}
                      style={{padding:'8px 20px',background:'#1E3A5F',color:'#fff',border:'none',borderRadius:'7px',fontSize:'13px',fontWeight:'bold',cursor:'pointer'}}>
                      Calcular Ba Gua →
                    </button>
                  )}
                </div>
              )}

              {/* Instrução explicativa (resultado) — accordion */}
              {step==='resultado'&&(
                <div style={{marginTop:'10px',background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:'10px',overflow:'hidden'}}>
                  <button onClick={()=>setInstrucaoAberta(!instrucaoAberta)} style={{
                    width:'100%',padding:'12px 18px',background:'transparent',border:'none',cursor:'pointer',
                    display:'flex',alignItems:'center',justifyContent:'space-between'
                  }}>
                    <span style={{fontWeight:'bold',color:'#1E3A5F',fontSize:'13px'}}>📋 Instrucoes de ajuste</span>
                    <span style={{fontSize:'14px',color:'#6B7280',transition:'transform 0.2s',transform:instrucaoAberta?'rotate(0deg)':'rotate(180deg)'}}>{instrucaoAberta?'▲':'▼'}</span>
                  </button>
                  {instrucaoAberta&&(
                    <div style={{padding:'0 18px 16px 18px'}}>
                      <div style={{display:'flex',gap:'10px',alignItems:'flex-start',marginBottom:'12px'}}>
                        <span style={{fontSize:'20px',flexShrink:0}}>ℹ️</span>
                        <div>
                          <div style={{fontWeight:'bold',color:'#1E3A5F',fontSize:'13px',marginBottom:'6px'}}>Como ajustar a análise para sua planta</div>
                          <p style={{color:'#374151',fontSize:'11px',lineHeight:'1.6',margin:'0 0 8px 0'}}>
                            A análise automática considera o retângulo envolvente detectado na imagem. Para resultados precisos:
                          </p>
                          <ol style={{color:'#374151',fontSize:'11px',lineHeight:'1.7',margin:'0 0 10px 0',paddingLeft:'16px'}}>
                            <li>Clique em <strong>&quot;Bordas&quot;</strong>.</li>
                            <li>Arraste as alças nos 4 lados até coincidir com as <strong>paredes externas</strong> da área construída — ignore jardins, pátios e calçadas.</li>
                            <li>Clique em <strong>&quot;Recalcular&quot;</strong>.</li>
                          </ol>
                          <div style={{fontWeight:'bold',color:'#92400E',fontSize:'11px',marginBottom:'6px'}}>⚠ O que acontece após o ajuste:</div>
                          <div style={{display:'flex',flexDirection:'column',gap:'6px',fontSize:'10px',color:'#374151',lineHeight:'1.5'}}>
                            <div style={{padding:'6px 8px',background:'#FEF2F2',borderRadius:'5px',borderLeft:'3px solid #DC2626'}}>
                              <strong style={{color:'#DC2626'}}>VAZIO dentro das bordas</strong> — área sem construção (jardim interno, pátio, recuo). É descontada do setor → indica <strong>FALTA</strong> de energia naquele Guá.
                            </div>
                            <div style={{padding:'6px 8px',background:'#FFF7ED',borderRadius:'5px',borderLeft:'3px solid #EA580C'}}>
                              <strong style={{color:'#EA580C'}}>CONSTRUÇÃO fora das bordas</strong> — parte da construção extrapola as bordas (edícula, saliência). Também é descontada → indica <strong>EXCESSO</strong> não integrado ao mapa.
                            </div>
                            <div style={{padding:'6px 8px',background:'#F0FDF4',borderRadius:'5px',borderLeft:'3px solid #15803D'}}>
                              <strong style={{color:'#15803D'}}>Setor sem falta nem excesso</strong> — todo construído dentro das bordas → setor <strong>EQUILIBRADO</strong> ✓.
                            </div>
                          </div>
                          <p style={{color:'#6B7280',fontSize:'10px',margin:'8px 0 0 0',fontStyle:'italic'}}>Os descontos são proporcionais à área afetada em relação à área total do setor.</p>
                        </div>
                      </div>
                      <button onClick={()=>{setInstrucaoAberta(false);setModo('bordas')}} style={{
                        width:'100%',padding:'10px',background:'#1D4ED8',color:'#fff',border:'none',
                        borderRadius:'7px',fontSize:'13px',fontWeight:'bold',cursor:'pointer'
                      }}>Entendido — ajustar bordas</button>
                    </div>
                  )}
                </div>
              )}

              {/* Controles RESULTADO */}
              {step==='resultado'&&(
                <>
                  <div style={{marginTop:'9px',display:'flex',gap:'6px',flexWrap:'wrap'}}>
                    <button onClick={()=>setModo(modo==='bordas'?'nenhum':'bordas')}
                      style={{background:modo==='bordas'?'#DC2626':'#D97706',color:'#fff',border:'none',padding:'6px 12px',borderRadius:'6px',fontSize:'11px',fontWeight:'bold',cursor:'pointer'}}>
                      {modo==='bordas'?'🔒 Finalizar':'⬜ Bordas'}
                    </button>
                    <button onClick={()=>setModo(modo==='marcarFalta'?'nenhum':'marcarFalta')}
                      style={{background:modo==='marcarFalta'?'#DC2626':'#EF4444',color:'#fff',border:'none',padding:'6px 12px',borderRadius:'6px',fontSize:'11px',fontWeight:'bold',cursor:'pointer'}}>
                      {modo==='marcarFalta'?'🔒 Finalizar':'▭ Marcar Falta'}
                    </button>
                    <button onClick={()=>setModo(modo==='marcarExcesso'?'nenhum':'marcarExcesso')}
                      style={{background:modo==='marcarExcesso'?'#DC2626':'#F59E0B',color:'#fff',border:'none',padding:'6px 12px',borderRadius:'6px',fontSize:'11px',fontWeight:'bold',cursor:'pointer'}}>
                      {modo==='marcarExcesso'?'🔒 Finalizar':'▭ Marcar Excesso'}
                    </button>
                    <button onClick={recalcular} disabled={!bordaModificada&&!recalculoPendente}
                      style={{background:recalculoPendente?'#EA580C':bordaModificada?'#1D4ED8':'#93C5FD',color:'#fff',border:'none',padding:'6px 12px',borderRadius:'6px',fontSize:'11px',fontWeight:'bold',cursor:(bordaModificada||recalculoPendente)?'pointer':'not-allowed',opacity:(bordaModificada||recalculoPendente)?1:0.6,
                        animation:recalculoPendente?'pulseRecalc 1.5s ease-in-out infinite':'none'}}>
                      🔄 Recalcular{recalculoPendente?' (pendente)':''}
                    </button>
                    <button onClick={()=>setFullscreen(true)}
                      style={{background:'#15803D',color:'#fff',border:'none',padding:'6px 12px',borderRadius:'6px',fontSize:'11px',fontWeight:'bold',cursor:'pointer'}}>
                      🔍 Tela cheia
                    </button>
                    <button onClick={()=>{setStep('upload');setImg(null);setBounds(null);setEntrada(null);setModo('nenhum');setSetores([]);setAtivo(null);setMarcacoes([])}}
                      style={{background:'transparent',color:'#6B7280',border:'1px solid #D1D5DB',padding:'6px 12px',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>
                      ↩ Nova planta
                    </button>
                  </div>
                  {modo==='bordas'&&<div style={{marginTop:'5px',padding:'5px 9px',background:'#FEF3C7',borderRadius:'5px',color:'#92400E',fontSize:'10px'}}>Arraste as alças laranja nas bordas do retângulo</div>}
                  {modo==='marcarFalta'&&<div style={{marginTop:'5px',padding:'5px 9px',background:'#FEF2F2',borderRadius:'5px',color:'#DC2626',fontSize:'10px'}}>Clique e arraste na planta para marcar uma área de FALTA (vazio interno)</div>}
                  {modo==='marcarExcesso'&&<div style={{marginTop:'5px',padding:'5px 9px',background:'#FFF7ED',borderRadius:'5px',color:'#EA580C',fontSize:'10px'}}>Clique e arraste na planta para marcar uma área de EXCESSO (construção além das bordas)</div>}
                  {msg&&(()=>{
                    const isError=msgTipo==='erro'
                    return <div style={{marginTop:'5px',padding:'6px 10px',background:isError?'#FEF2F2':'#F0FDF4',borderRadius:'5px',color:isError?'#DC2626':'#15803D',fontSize:'11px',fontWeight:'bold'}}>{isError?'⚠':'✅'} {msg}</div>
                  })()}
                  {ultimoRecalculo&&!bordaModificada&&<div style={{marginTop:'5px',padding:'5px 9px',background:'#F0FDF4',borderRadius:'5px',color:'#15803D',fontSize:'10px'}}>✓ Atualizado às {ultimoRecalculo}</div>}
                  {bordaModificada&&<div style={{marginTop:'5px',padding:'5px 9px',background:'#FEF3C7',borderRadius:'5px',color:'#92400E',fontSize:'10px'}}>⚠ Bordas alteradas — clique em &quot;Recalcular&quot; para atualizar os valores</div>}

                  {/* Mini-cards 3x3 */}
                  {setores.length>0&&(
                    <div style={{marginTop:'12px'}}>
                      <div style={{fontSize:'11px',fontWeight:'bold',color:'#1E3A5F',marginBottom:'6px'}}>📊 Resumo por setor</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'5px'}}>
                        {setores.map((sc,i)=>{
                          const st=SETORES[order[i]]; const sel=ativo===i
                          const gv=geoEfetivo(sc)
                          const ts=scoreTotal(sc)
                          const sf=scoreFisico(sc.criterios)
                          return(
                            <div key={i} onClick={()=>setAtivo(i===ativo?null:i)} style={{
                              padding:'7px',borderRadius:'6px',cursor:'pointer',
                              border:`2px solid ${sel?corTotal(ts):'#E5E7EB'}`,background:sel?corTotal(ts)+'18':'#F9FAFB',
                            }}>
                              <div style={{fontSize:'10px',fontWeight:'bold',color:'#1E3A5F'}}>{st.nome}</div>
                              <div style={{display:'flex',flexDirection:'column',gap:'1px',marginTop:'2px'}}>
                                <div style={{display:'flex',justifyContent:'space-between',fontSize:'9px'}}>
                                  <span style={{color:'#6B7280'}}>Geo:</span>
                                  <span style={{color:corGeo(gv,sc),fontWeight:'bold'}}>{Math.round(gv)} pts</span>
                                </div>
                                <div style={{display:'flex',justifyContent:'space-between',fontSize:'9px'}}>
                                  <span style={{color:'#6B7280'}}>Físico:</span>
                                  {criteriosAvaliados(sc.criterios)
                                    ? <span style={{color:sf>=0?'#15803D':'#DC2626',fontWeight:'bold'}}>{sf>=0?'+':''}{sf} pts</span>
                                    : <span style={{color:'#9CA3AF',fontStyle:'italic'}}>Não avaliado</span>
                                  }
                                </div>
                              </div>
                              <div style={{fontSize:'10px',color:corTotal(ts),fontWeight:'bold',marginTop:'2px',borderTop:'1px solid #E5E7EB',paddingTop:'2px'}}>{ts} pts · {lblTotal(ts)}</div>
                              {sc.ajusteManual!==null&&<div style={{fontSize:'7px',color:'#7C3AED',marginTop:'1px'}}>&#x270F; Ajustado</div>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Balanced banner */}
                  {setores.length===9&&setores.every(s=>scoreTotal(s)>=90)&&(
                    <div style={{marginTop:'10px',padding:'10px 14px',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:'8px',textAlign:'center'}}>
                      <div style={{fontSize:'20px',marginBottom:'4px'}}>☯</div>
                      <div style={{fontSize:'12px',fontWeight:'bold',color:'#15803D'}}>Planta equilibrada</div>
                      <div style={{fontSize:'10px',color:'#16A34A',marginTop:'2px'}}>Todos os setores com score total ≥ 90</div>
                    </div>
                  )}

                  {/* Salvar e continuar */}
                  {setores.length===9&&consultaId&&(
                    <button onClick={finalizarAnalise} disabled={salvandoTudo}
                      style={{
                        marginTop:'14px',width:'100%',padding:'12px',
                        background:salvandoTudo?'#93C5FD':'linear-gradient(135deg, #1E3A5F, #2D5A8E)',
                        color:'#fff',border:'none',borderRadius:'8px',
                        fontSize:'14px',fontWeight:'bold',cursor:salvandoTudo?'not-allowed':'pointer',
                      }}>
                      {salvandoTudo?'Salvando...':'Salvar e continuar análise →'}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* ════ PAINEL LATERAL ════ */}
            {step==='resultado'&&ativo!==null&&stAtivo&&scAtivo&&(
              <div style={{width:'260px',flexShrink:0,background:'#fff',borderRadius:'12px',padding:'14px',
                boxShadow:'0 2px 12px rgba(0,0,0,0.12)',border:`3px solid ${stAtivo.cor}`,
                position:'sticky',top:'16px',maxHeight:'calc(100vh - 100px)',overflowY:'auto'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                  <div>
                    <span style={{fontSize:'14px',fontWeight:'bold',color:'#1E3A5F'}}>{stAtivo.nome}</span>
                    <div style={{fontSize:'10px',color:'#6B7280'}}>{stAtivo.elem} · {stAtivo.dir}</div>
                  </div>
                  <button onClick={()=>setAtivo(null)} style={{background:'transparent',border:'none',fontSize:'18px',cursor:'pointer',color:'#9CA3AF'}}>×</button>
                </div>

                {/* Cores / Elemento */}
                <div style={{padding:'6px 8px',background:'#F9FAFB',borderRadius:'6px',marginBottom:'10px',fontSize:'10px',color:'#374151',display:'flex',gap:'10px',flexWrap:'wrap'}}>
                  <span>Elemento: <strong>{stAtivo.elem}</strong></span>
                  <span>Direção: <strong>{stAtivo.dir}</strong></span>
                </div>

                {/* ── 3-SCORE DISPLAY ── */}
                {(()=>{
                  const gv=geoEfetivo(scAtivo)
                  const sf=scoreFisico(scAtivo.criterios)
                  const ts=scoreTotal(scAtivo)
                  return (
                    <div style={{marginBottom:'10px'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
                        {/* Geo score */}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px',background:'#F9FAFB',borderRadius:'5px',borderLeft:`3px solid ${corGeo(gv,scAtivo)}`}}>
                          <span style={{fontSize:'10px',color:'#6B7280'}}>Geométrico:</span>
                          <span style={{fontSize:'11px',fontWeight:'bold',color:corGeo(gv,scAtivo)}}>{Math.round(gv)} pts · {lblGeo(gv,scAtivo)}</span>
                        </div>
                        {scAtivo.faltaPct>0&&(
                          <div style={{fontSize:'9px',color:'#DC2626',paddingLeft:'11px'}}>Falta: {Math.round(scAtivo.faltaPct)}%</div>
                        )}
                        {scAtivo.excessoPct>0&&(
                          <div style={{fontSize:'9px',color:'#D97706',paddingLeft:'11px'}}>Excesso: {Math.round(scAtivo.excessoPct)}%</div>
                        )}
                        {scAtivo.ajusteManual!==null&&(
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 8px',background:'#EDE9FE',borderRadius:'4px',borderLeft:'3px solid #7C3AED'}}>
                            <span style={{fontSize:'9px',color:'#5B21B6',fontWeight:'bold'}}>Geo ajustado:</span>
                            <span style={{fontSize:'10px',fontWeight:'bold',color:corGeo(scAtivo.ajusteManual,scAtivo)}}>{scAtivo.ajusteManual} pts</span>
                          </div>
                        )}
                        {/* Physical score */}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px',background:'#F9FAFB',borderRadius:'5px',borderLeft:'3px solid #6B7280'}}>
                          <span style={{fontSize:'10px',color:'#6B7280'}}>Físico:</span>
                          {criteriosAvaliados(scAtivo.criterios)
                            ? <span style={{fontSize:'11px',fontWeight:'bold',color:sf>=0?'#15803D':'#DC2626'}}>{sf>=0?'+':''}{sf} pts</span>
                            : <span style={{fontSize:'11px',color:'#9CA3AF',fontStyle:'italic'}}>Não avaliado</span>
                          }
                        </div>
                        {/* Total score */}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 8px',background:corTotal(ts)+'15',borderRadius:'5px',borderLeft:`3px solid ${corTotal(ts)}`}}>
                          <span style={{fontSize:'11px',fontWeight:'bold',color:'#374151'}}>Total:</span>
                          <span style={{fontSize:'13px',fontWeight:'bold',color:corTotal(ts)}}>{ts} pts · {lblTotal(ts)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* ── Avaliação física (critérios) ── */}
                <div style={{fontSize:'12px',fontWeight:'bold',color:'#374151',marginBottom:'8px',borderTop:'1px solid #F3F4F6',paddingTop:'8px'}}>
                  Avaliação física
                </div>
                {CRITERIOS.map((crit,ci)=>{
                  const LABELS=['-2','-1','0','+1','+2']
                  const NOMES=['Crítico','Ruim','Neutro','Bom','Ótimo']
                  const CORES=['#DC2626','#EA580C','#6B7280','#65A30D','#15803D']
                  const BGS=['#FEF2F2','#FFF7ED','#F9FAFB','#F0FDF4','#DCFCE7']
                  const val=scAtivo.criterios[ci]??2
                  return (
                  <div key={ci} style={{marginBottom:'9px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                      <span style={{fontSize:'10px',color:'#374151'}}>{crit}</span>
                      <span style={{fontSize:'10px',fontWeight:'bold',color:CORES[val]}}>
                        {NOMES[val]}
                      </span>
                    </div>
                    <div style={{display:'flex',gap:'3px'}}>
                      {[0,1,2,3,4].map(v=>(
                        <button key={v} onClick={()=>setCrit(ativo!,ci,v)} style={{
                          flex:1,padding:'4px 0',borderRadius:'4px',border:'1px solid',fontSize:'10px',fontWeight:'bold',cursor:'pointer',
                          borderColor:val===v?CORES[v]:'#D1D5DB',
                          background:val===v?BGS[v]:'#fff',
                          color:val===v?CORES[v]:'#9CA3AF',
                        }}>{LABELS[v]}</button>
                      ))}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'8px',color:'#D1D5DB',marginTop:'1px'}}>
                      <span>Crítico</span><span>Ótimo</span>
                    </div>
                  </div>
                  )
                })}

                {/* ── Avançado — Ajuste do consultor (colapsável) ── */}
                <details style={{marginBottom:'10px',marginTop:'4px'}}>
                  <summary style={{fontSize:'11px',fontWeight:'bold',color:'#7C3AED',cursor:'pointer',padding:'6px 0',userSelect:'none',borderTop:'1px solid #F3F4F6',paddingTop:'8px'}}>
                    🎛 Avançado — Ajuste do consultor
                  </summary>
                  <div style={{padding:'10px',background:'#FAFAFA',borderRadius:'8px',border:'1px solid #E5E7EB',marginTop:'4px'}}>
                    <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                      <label style={{fontSize:'10px',color:'#6B7280',whiteSpace:'nowrap'}}>Geo manual (pts):</label>
                      <input type="number" min={0} max={200} step={1}
                        value={scAtivo.ajusteManual??''}
                        placeholder={String(Math.round(scAtivo.geo))}
                        onChange={e=>{
                          const v=e.target.value
                          setAjusteManual(ativo!,v===''?null:Number(v))
                        }}
                        style={{width:'60px',padding:'4px 6px',borderRadius:'4px',border:'1px solid #D1D5DB',fontSize:'11px',textAlign:'center'}}
                      />
                      <select value={scAtivo.ajusteTipo??''}
                        onChange={e=>setAjusteTipo(ativo!,(e.target.value||null) as Setor['ajusteTipo'])}
                        style={{flex:1,padding:'4px 6px',borderRadius:'4px',border:'1px solid #D1D5DB',fontSize:'10px'}}>
                        <option value="">Tipo automático</option>
                        <option value="equilibrado">Equilibrado</option>
                        <option value="faltante">Faltante</option>
                        <option value="excedente">Excedente</option>
                      </select>
                    </div>
                    <textarea value={scAtivo.obs} placeholder="Observações do consultor (opcional)"
                      onChange={e=>setObs(ativo!,e.target.value)}
                      style={{width:'100%',padding:'6px',borderRadius:'4px',border:'1px solid #D1D5DB',fontSize:'10px',resize:'vertical',minHeight:'36px',boxSizing:'border-box'}}
                    />
                    {scAtivo.ajusteManual!==null&&(
                      <button onClick={()=>resetAjuste(ativo!)} style={{marginTop:'4px',padding:'4px 10px',background:'transparent',border:'1px solid #D1D5DB',borderRadius:'4px',fontSize:'10px',color:'#6B7280',cursor:'pointer'}}>
                        ↺ Usar valor calculado
                      </button>
                    )}
                    {scAtivo.ajusteManual!==null&&(
                      <div style={{marginTop:'4px',fontSize:'9px',color:'#7C3AED',fontWeight:'bold'}}>
                        Valor geo sobrescrito — total recalculado automaticamente
                      </div>
                    )}
                  </div>
                </details>

                {/* ── Recomendações dinâmicas (colapsável) ── */}
                {(()=>{
                  const rec = criteriosAvaliados(scAtivo.criterios)
                    ? gerarRecomendacoes({
                        nomeSetor: stAtivo.nome,
                        scorePct: scoreTotal(scAtivo),
                        criterios: scAtivo.criterios,
                        faltaPct: scAtivo.faltaPct,
                        excessoPct: scAtivo.excessoPct,
                      })
                    : { urgente: [], melhoria: [], manutencao: [] }
                  const hasRec = rec.urgente.length + rec.melhoria.length + rec.manutencao.length > 0
                  if (!hasRec) return null
                  return (
                    <details style={{marginBottom:'10px'}}>
                      <summary style={{fontSize:'11px',fontWeight:'bold',color:'#374151',cursor:'pointer',padding:'6px 0',userSelect:'none'}}>
                        💡 Recomendações
                      </summary>
                      <div style={{padding:'10px 0',marginTop:'4px'}}>
                      {rec.urgente.length>0&&(
                        <div style={{marginBottom:'8px'}}>
                          <div style={{fontSize:'9px',fontWeight:'bold',marginBottom:'4px',display:'flex',alignItems:'center',gap:'4px'}}>
                            <span style={{background:'#DC2626',color:'#fff',borderRadius:'3px',padding:'1px 6px'}}>URGENTE</span>
                          </div>
                          {rec.urgente.map((d,i)=>(
                            <div key={i} style={{display:'flex',gap:'5px',marginBottom:'4px',padding:'5px 7px',background:'#FEF2F2',borderRadius:'5px',borderLeft:'3px solid #DC2626'}}>
                              <span style={{color:'#DC2626',fontSize:'11px',flexShrink:0,marginTop:'1px'}}>•</span>
                              <span style={{fontSize:'10px',color:'#7F1D1D',lineHeight:'1.45'}}>{d}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {rec.melhoria.length>0&&(
                        <div style={{marginBottom:'8px'}}>
                          <div style={{fontSize:'9px',fontWeight:'bold',marginBottom:'4px',display:'flex',alignItems:'center',gap:'4px'}}>
                            <span style={{background:'#D97706',color:'#fff',borderRadius:'3px',padding:'1px 6px'}}>MELHORIA</span>
                          </div>
                          {rec.melhoria.map((d,i)=>(
                            <div key={i} style={{display:'flex',gap:'5px',marginBottom:'4px',padding:'5px 7px',background:'#FFFBEB',borderRadius:'5px',borderLeft:'3px solid #D97706'}}>
                              <span style={{color:'#D97706',fontSize:'11px',flexShrink:0,marginTop:'1px'}}>•</span>
                              <span style={{fontSize:'10px',color:'#78350F',lineHeight:'1.45'}}>{d}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {rec.manutencao.length>0&&(
                        <div>
                          <div style={{fontSize:'9px',fontWeight:'bold',marginBottom:'4px',display:'flex',alignItems:'center',gap:'4px'}}>
                            <span style={{background:'#15803D',color:'#fff',borderRadius:'3px',padding:'1px 6px'}}>MANUTENÇÃO</span>
                          </div>
                          {rec.manutencao.map((d,i)=>(
                            <div key={i} style={{display:'flex',gap:'5px',marginBottom:'4px',padding:'5px 7px',background:'#F0FDF4',borderRadius:'5px',borderLeft:'3px solid #15803D'}}>
                              <span style={{color:'#15803D',fontSize:'11px',flexShrink:0,marginTop:'1px'}}>•</span>
                              <span style={{fontSize:'10px',color:'#14532D',lineHeight:'1.45'}}>{d}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      </div>
                    </details>
                  )
                })()}

                <button onClick={()=>salvarSetorDB(ativo!)}
                  style={{width:'100%',marginTop:'8px',background:consultaId?'#7C3AED':'#1E3A5F',color:'#fff',border:'none',padding:'9px',borderRadius:'7px',fontSize:'12px',fontWeight:'bold',cursor:'pointer'}}>
                  💾 Salvar avaliação{consultaId?' no banco':''}
                </button>

              </div>
            )}
          </div>
        )}

        {/* ════ FULLSCREEN OVERLAY ════ */}
        {fullscreen && step==='resultado' && (
          <div style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.92)',
            zIndex:9999, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', padding:'20px'
          }}>
            {/* Top bar */}
            <div style={{
              position:'absolute', top:0, left:0, right:0,
              padding:'12px 24px', display:'flex', alignItems:'center',
              justifyContent:'space-between', background:'rgba(0,0,0,0.5)'
            }}>
              <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <span style={{color:'#B8860B',fontSize:'16px',fontWeight:'bold'}}>☯ FengShui Studio</span>
                <span style={{color:'rgba(255,255,255,0.5)',fontSize:'12px'}}>— Tela cheia</span>
              </div>
              <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                <button onClick={()=>setModo(modo==='bordas'?'nenhum':'bordas')}
                  style={{background:modo==='bordas'?'#DC2626':'#D97706',color:'#fff',border:'none',padding:'8px 16px',borderRadius:'6px',fontSize:'12px',fontWeight:'bold',cursor:'pointer'}}>
                  {modo==='bordas'?'🔒 Finalizar bordas':'⬜ Ajustar bordas'}
                </button>
                <button onClick={()=>setModo(modo==='marcarFalta'?'nenhum':'marcarFalta')}
                  style={{background:modo==='marcarFalta'?'#DC2626':'#EF4444',color:'#fff',border:'none',padding:'8px 16px',borderRadius:'6px',fontSize:'12px',fontWeight:'bold',cursor:'pointer'}}>
                  {modo==='marcarFalta'?'🔒 Finalizar':'▭ Falta'}
                </button>
                <button onClick={()=>setModo(modo==='marcarExcesso'?'nenhum':'marcarExcesso')}
                  style={{background:modo==='marcarExcesso'?'#DC2626':'#F59E0B',color:'#fff',border:'none',padding:'8px 16px',borderRadius:'6px',fontSize:'12px',fontWeight:'bold',cursor:'pointer'}}>
                  {modo==='marcarExcesso'?'🔒 Finalizar':'▭ Excesso'}
                </button>
                <button onClick={recalcular} disabled={!bordaModificada&&!recalculoPendente}
                  style={{background:recalculoPendente?'#EA580C':bordaModificada?'#1D4ED8':'#93C5FD',color:'#fff',border:'none',padding:'8px 16px',borderRadius:'6px',fontSize:'12px',fontWeight:'bold',cursor:(bordaModificada||recalculoPendente)?'pointer':'not-allowed',opacity:(bordaModificada||recalculoPendente)?1:0.6,
                    animation:recalculoPendente?'pulseRecalc 1.5s ease-in-out infinite':'none'}}>
                  🔄 Recalcular{recalculoPendente?' (pendente)':''}
                </button>
                <button onClick={()=>{setModo('nenhum');setFullscreen(false)}}
                  style={{background:'#15803D',color:'#fff',border:'none',padding:'8px 20px',borderRadius:'6px',fontSize:'13px',fontWeight:'bold',cursor:'pointer'}}>
                  ✓ OK — Voltar
                </button>
              </div>
            </div>

            {/* Instructions */}
            {modo==='bordas'&&(
              <div style={{position:'absolute',top:'64px',left:'50%',transform:'translateX(-50%)',
                padding:'6px 16px',background:'#FEF3C7',borderRadius:'6px',color:'#92400E',fontSize:'12px',zIndex:1}}>
                Arraste as alças laranja para ajustar os limites da construcao (fronteira Feng Shui)
              </div>
            )}
            {modo==='marcarFalta'&&(
              <div style={{position:'absolute',top:'64px',left:'50%',transform:'translateX(-50%)',
                padding:'6px 16px',background:'#FEF2F2',borderRadius:'6px',color:'#DC2626',fontSize:'12px',zIndex:1}}>
                Clique e arraste para marcar uma area de FALTA
              </div>
            )}
            {modo==='marcarExcesso'&&(
              <div style={{position:'absolute',top:'64px',left:'50%',transform:'translateX(-50%)',
                padding:'6px 16px',background:'#FFF7ED',borderRadius:'6px',color:'#EA580C',fontSize:'12px',zIndex:1}}>
                Clique e arraste para marcar uma area de EXCESSO
              </div>
            )}
            {/* Fullscreen canvas */}
            <canvas ref={fsCvRef}
              onMouseDown={onFsMD}
              onMouseMove={onFsMM}
              onMouseUp={onFsMU}
              onMouseLeave={onFsMU}
              style={{
                display:'block', borderRadius:'8px',
                border:'2px solid rgba(255,255,255,0.2)',
                cursor:(modo==='marcarFalta'||modo==='marcarExcesso')?'crosshair':modo!=='nenhum'?'move':'default',
                userSelect:'none', maxWidth:'95vw', maxHeight:'80vh'
              }}
            />

            {/* Bottom info */}
            <div style={{
              position:'absolute', bottom:'16px', left:'50%', transform:'translateX(-50%)',
              display:'flex', gap:'16px', alignItems:'center'
            }}>
              <span style={{color:'rgba(255,255,255,0.5)',fontSize:'11px'}}>
                Escola: <strong style={{color:'#fff'}}>{escola==='btb'?'BTB':'Bussola'}</strong>
              </span>
              <span style={{color:'rgba(255,255,255,0.5)',fontSize:'11px'}}>
                Entrada: <strong style={{color:'#fff'}}>{lado}</strong>
              </span>
              <span style={{color:'rgba(255,255,255,0.5)',fontSize:'11px'}}>
                Pressione ESC ou clique OK para sair
              </span>
            </div>
          </div>
        )}

      </main>
    </FlowLayout>
  )
}

export default function BaguaPlanta() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☯</div>
          <p style={{ color: '#7C3AED', fontSize: '16px' }}>Carregando planta...</p>
        </div>
      </div>
    }>
      <BaguaPlantaContent />
    </Suspense>
  )
}
