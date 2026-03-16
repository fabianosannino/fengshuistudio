'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'
import { CRITERIOS } from '../../src/lib/constants'

// ─── DADOS ────────────────────────────────────────────────────────────────────

const SETORES = [
  { nome:'Prosperidade',    elem:'Madeira', dir:'Sudeste',  cor:'#7C3AED',
    dicas:['Adicione plantas saudáveis e viçosas','Use tons roxo, verde e dourado','Coloque objetos de madeira ou formas altas','Remova objetos quebrados ou murchos','Mantenha a área iluminada e organizada'] },
  { nome:'Fama/Reputação',  elem:'Fogo',    dir:'Sul',      cor:'#DC2626',
    dicas:['Use tons vermelhos e alaranjados','Instale iluminação forte ou velas','Exponha diplomas, troféus e conquistas','Evite elementos de água neste setor','Adicione símbolos de fênix ou pássaros'] },
  { nome:'Relacionamentos', elem:'Terra',   dir:'Sudoeste', cor:'#BE185D',
    dicas:['Coloque objetos em pares','Use cores rosa, branco e bege','Adicione cristal de quartzo rosa','Exponha imagens de casais ou parceria','Mantenha o espaço acolhedor e convidativo'] },
  { nome:'Família',         elem:'Madeira', dir:'Leste',    cor:'#15803D',
    dicas:['Coloque fotos de família em molduras','Use tons verdes e formas retangulares','Adicione plantas ou flores frescas','Inclua objetos de madeira natural','Organize fotos em ordem cronológica'] },
  { nome:'Centro/Saúde',    elem:'Terra',   dir:'Centro',   cor:'#D97706',
    dicas:['Mantenha o centro completamente livre','Use tons amarelos e terrosos','Evite móveis pesados no centro','Adicione cristais amarelos ou cerâmicas','Este setor influencia todos os demais'] },
  { nome:'Criatividade',    elem:'Metal',   dir:'Oeste',    cor:'#B45309',
    dicas:['Use tons brancos, cinza e metálicos','Adicione objetos redondos ou ovais','Crie um espaço inspirador e lúdico','Exponha arte, músicas ou materiais criativos','Inclua elementos metálicos decorativos'] },
  { nome:'Espiritualidade', elem:'Terra',   dir:'Nordeste', cor:'#92400E',
    dicas:['Crie um cantinho de meditação ou estudo','Use tons azul escuro e preto','Adicione livros, cristais e pedras naturais','Mantenha o espaço silencioso e ordenado','Exponha símbolos espirituais significativos'] },
  { nome:'Carreira',        elem:'Água',    dir:'Norte',    cor:'#1D4ED8',
    dicas:['Use tons pretos e azuis escuros','Adicione elemento água (espelho, fonte ou aquário)','Mantenha os caminhos livres e fluidos','Exponha imagens de água, lagos ou rios','Inclua objetos ondulados ou irregulares'] },
  { nome:'Pessoas Úteis',   elem:'Metal',   dir:'Noroeste', cor:'#6B7280',
    dicas:['Use tons cinza, prata e metálico','Adicione objetos de viagem ou mapas','Crie um espaço acolhedor para receber visitas','Instale sinos de vento metálicos','Exponha imagens de mentores ou referências'] },
]

// ─── RECOMENDAÇÕES DINÂMICAS ──────────────────────────────────────────────────

const CRITERIO_DICAS: Record<number, string[]> = {
  0: [ // Limpeza e organização
    'Faça uma limpeza profunda e reorganize completamente este setor',
    'Descarte objetos desnecessários — a desordem bloqueia o fluxo de energia',
    'Use caixas organizadoras e mantenha superfícies livres',
  ],
  1: [ // Iluminação
    'Aumente a iluminação com luminárias adicionais ou spots direcionados',
    'Substitua lâmpadas fracas por luz branca quente (3000-4000K)',
    'Considere luz natural — abra cortinas ou adicione espelhos estratégicos',
  ],
  2: [ // Ventilação
    'Melhore a circulação de ar — abra janelas regularmente',
    'Adicione plantas purificadoras como espada-de-são-jorge ou lírio-da-paz',
    'Evite objetos que acumulem poeira e bloqueiem o fluxo de ar',
  ],
  3: [ // Cores harmônicas
    'Repinte as paredes com a cor do elemento associado a este setor',
    'Adicione almofadas, tapetes ou obras de arte nas cores recomendadas',
    'Remova objetos com cores que conflitem com o elemento do setor',
  ],
  4: [ // Mobiliário
    'Reposicione os móveis para criar caminhos de circulação livres',
    'Remova móveis com cantos apontados diretamente para áreas de descanso',
    'Escolha formas de móveis alinhadas com o elemento do setor',
  ],
  5: [ // Plantas e elementos naturais
    'Adicione plantas vivas e saudáveis — evite plantas artificiais ou murchas',
    'Inclua elementos naturais como pedras, cristais ou madeira bruta',
    'Mantenha as plantas adubadas, podadas e sem folhas secas',
  ],
  6: [ // Ausência de objetos quebrados
    'Remova imediatamente todos os objetos quebrados, lascados ou com defeito',
    'Conserte ou descarte itens danificados — eles simbolizam energia estagnada',
    'Revise tomadas, lâmpadas queimadas e torneiras com vazamento',
  ],
  7: [ // Fluxo de energia
    'Desobstrua os cantos — use plantas ou luminárias para ativar energia estagnada',
    'Garanta que as portas abram completamente sem obstáculos',
    'Reorganize o layout para criar um fluxo natural de circulação',
  ],
}

function gerarRecomendacoes(
  setor: typeof SETORES[0],
  sc: Setor
): { urgente: string[]; melhoria: string[]; manutencao: string[] } {
  const urgente:    string[] = []
  const melhoria:   string[] = []
  const manutencao: string[] = []

  // Problemas geométricos
  if (sc.falta) {
    urgente.push(`⚠ Setor com área construída insuficiente — a energia de ${setor.nome} está enfraquecida neste imóvel`)
    urgente.push('Compense com ativação energética intensa: mais objetos do elemento, cores e intenção')
  }
  if (sc.excesso) {
    melhoria.push(`↑ Setor com projeção além dos limites — excesso pode gerar desequilíbrio em ${setor.nome}`)
    melhoria.push('Use divisórias simbólicas ou espelhos para definir limites energéticos claros')
  }

  // Critérios físicos com score baixo (0 = crítico, 1 = ruim)
  sc.criterios.forEach((val, ci) => {
    const dicas = CRITERIO_DICAS[ci] || []
    if (val === 0) urgente.push(...dicas.slice(0,2))
    else if (val === 1) melhoria.push(dicas[0])
  })

  // Dicas específicas do setor se score total baixo
  const ts = total(sc.geo, sc.criterios)
  const dicasSetor = setor.dicas ?? []
  if (ts < 40) {
    urgente.push(...dicasSetor.slice(0,3))
  } else if (ts < 70) {
    melhoria.push(...dicasSetor.slice(0,2))
  } else {
    manutencao.push(...dicasSetor.slice(3,5))
  }

  // Deduplicar
  return {
    urgente:    [...new Set(urgente)].slice(0,4),
    melhoria:   [...new Set(melhoria)].slice(0,4),
    manutencao: [...new Set(manutencao)].slice(0,3),
  }
}

function gridOrder(escola: string, lado: string): number[] {
  if (escola === 'btb' && lado === 'direita') return [2,1,0,5,4,3,8,7,6]
  return [0,1,2,3,4,5,6,7,8]
}

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type Step   = 'upload' | 'configurar' | 'entrada' | 'resultado'
type Lado   = 'esquerda' | 'centro' | 'direita'
type Bounds = { x:number; y:number; w:number; h:number }
type Drag   = { tipo:'borda'; lado:'top'|'bottom'|'left'|'right' }
            | { tipo:'linhaH'|'linhaV'; index:number }
type Setor  = {
  criterios:number[]; geo:number; falta:boolean; excesso:boolean;
  /** Area metrics (pixel-based, proportional) */
  aq:number;  // theoretical area (1/9 of bounds)
  ac:number;  // construction inside bounds within sector
  av:number;  // void inside bounds = A_falta (aq - ac, clamped ≥0)
  ae:number;  // construction outside bounds = A_excesso
  ar:number;  // effective area = AQ - AV - AE (clamped ≥0)
  desvio:number; // ((ar - aq) / aq) * 100  — always ≤ 0 or ≈ 0
  /** Manual adjustment (Nível 3) */
  ajusteManual:number|null;  // manual override % (null = use calculated)
  ajusteTipo:'equilibrado'|'faltante'|'excedente'|null;
  obs:string; // consultant text observation
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

function calcBounds(src: HTMLCanvasElement): Bounds {
  const ctx=src.getContext('2d')!
  const d=ctx.getImageData(0,0,src.width,src.height).data
  let x0=src.width,x1=0,y0=src.height,y1=0
  for(let y=0;y<src.height;y++) for(let x=0;x<src.width;x++){
    const i=(y*src.width+x)*4
    if(d[i+3]>30&&!(d[i]>230&&d[i+1]>230&&d[i+2]>230)){
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y
    }
  }
  const m=10
  const bx=Math.max(0,x0-m)
  const by=Math.max(0,y0-m)
  const bw=Math.min(src.width -bx, x1-bx+m)
  const bh=Math.min(src.height-by, y1-by+m)
  return {x:bx,y:by,w:bw,h:bh}
}

function analisar(src: HTMLCanvasElement, b:Bounds, lh:number[], lv:number[]): Setor[] {
  const ctx=src.getContext('2d')!, W=src.width, H=src.height
  const d=ctx.getImageData(0,0,W,H).data

  // Helper: classify a pixel as vegetation/outdoor
  function isVegetation(r:number,g:number,b:number){
    // Green-dominant: grass, trees, bushes, garden
    return g > r*1.12 && g > b*1.12 && g > 55
  }
  // Helper: classify a pixel as construction (walls, furniture, indoor floors)
  // Excludes vegetation, sky, and plain white backgrounds
  function isConstruction(r:number,g:number,b:number){
    if(isVegetation(r,g,b)) return false
    const brightness=(r+g+b)/3
    // Very bright = empty/background
    if(brightness>225) return false
    // Walls: very dark lines
    if(brightness<100) return true
    // Furniture/fixtures: medium dark, non-green
    if(brightness<170) return true
    // Colored elements (non-green): saturated pixels like colored walls/tiles
    const maxC=Math.max(r,g,b), minC=Math.min(r,g,b)
    const sat=maxC>0?(maxC-minC)/maxC:0
    if(sat>0.3 && brightness<210) return true
    return false
  }

  // Calculate construction pixel count inside a region
  function constructionCount(x0:number,y0:number,x1:number,y1:number){
    let construction=0, sampled=0
    const sx=Math.max(0,Math.floor(x0)), ex2=Math.min(W,Math.ceil(x1))
    const sy=Math.max(0,Math.floor(y0)), ey2=Math.min(H,Math.ceil(y1))
    const stp = Math.max(1, Math.floor(Math.min(ex2-sx, ey2-sy) / 200))
    for(let y=sy;y<ey2;y+=stp) for(let x=sx;x<ex2;x+=stp){
      const i=(y*W+x)*4, r=d[i],g=d[i+1],bv=d[i+2],a=d[i+3]
      if(a<30) continue
      sampled++
      if(isConstruction(r,g,bv)) construction++
    }
    const regionArea = (ex2-sx)*(ey2-sy)
    if(sampled===0) return 0
    return (construction/sampled)*regionArea
  }

  // ARE = bounds area (from orange handles only), AQ = uniform for all 9 sectors
  const ARE = b.w * b.h
  const aqUnit = ARE / 9
  // Margin for detecting construction outside bounds (15% of boundary)
  const mgW = b.w * 0.15, mgH = b.h * 0.15

  return Array(9).fill(0).map((_,idx)=>{
    const row=Math.floor(idx/3),col=idx%3
    const x0=b.x+(col===0?0:b.w*lv[col-1]),x1=b.x+(col===2?b.w:b.w*lv[col])
    const y0=b.y+(row===0?0:b.h*lh[row-1]),y1=b.y+(row===2?b.h:b.h*lh[row])

    // AQ: theoretical area = ARE / 9 (equal for all 9 sectors)
    const aq = aqUnit

    // AC: construction pixels inside bounds within this sector
    const ac = constructionCount(x0,y0,x1,y1)

    // AV: void inside sector (theoretical minus actual, clamped ≥ 0)
    const av = ac < aq ? aq - ac : 0

    // AE: construction outside bounds in this sector's edge direction
    let aeTotal = 0
    if(row===0) aeTotal += constructionCount(x0,b.y-mgH,x1,b.y)
    if(row===2) aeTotal += constructionCount(x0,b.y+b.h,x1,b.y+b.h+mgH)
    if(col===0) aeTotal += constructionCount(b.x-mgW,y0,b.x,y1)
    if(col===2) aeTotal += constructionCount(b.x+b.w,y0,b.x+b.w+mgW,y1)
    const ae = aeTotal

    // AR = AQ - A_falta - A_excesso (clamped ≥ 0)
    // A_falta = AV (void inside), A_excesso = AE (construction outside)
    const ar = Math.max(0, aq - av - ae)

    // Deviation percentage (completely independent per sector)
    // AR ≤ AQ always, so desvio ≤ 0 (or ≈ 0 when equilibrado)
    const desvio = aq > 0 ? ((ar - aq) / aq) * 100 : 0

    // Independent per-sector diagnosis — no cross-sector contamination
    const falta = av > 0
    const excesso = ae > 0

    // Geo score based on absolute deviation (independent per sector)
    const absD = Math.abs(desvio)
    const geo = absD <= 5 ? 100 : absD <= 15 ? 80 : absD <= 40 ? 50 : absD <= 70 ? 25 : 10

    return {criterios:Array(8).fill(1),geo,falta,excesso,aq,ac,av,ae,ar,desvio,ajusteManual:null,ajusteTipo:null,obs:''}
  })
}

function desvioTipo(d:number,sc?:Setor):{tipo:string;icon:string;intensidade:string;cor:string}{
  const abs=Math.abs(d)
  if(abs<=5)  return {tipo:'Equilibrado',icon:'✓',intensidade:'—',cor:'#15803D'}
  const intensidade=abs<=15?'Leve':abs<=40?'Moderado':abs<=70?'Acentuado':'Ausente'
  const cor=abs<=15?'#D97706':abs<=40?'#EA580C':'#DC2626'
  // Determine type based on what caused the deviation
  if(sc){
    if(sc.av>0&&sc.ae>0) return {tipo:'Faltante',icon:'▼',intensidade,cor}
    if(sc.ae>0&&sc.av===0) return {tipo:'Excesso ext.',icon:'▲',intensidade,cor}
  }
  if(d<0) return {tipo:'Faltante',icon:'▼',intensidade,cor}
  return {tipo:'Excedente',icon:'▲',intensidade,cor}
}
function desvioCorCanvas(d:number):string{
  const abs=Math.abs(d)
  if(abs<=5)  return '#15803D'
  if(abs<=15) return '#D97706'
  if(abs<=40) return '#EA580C'
  return '#DC2626'
}

function fisico(c:number[]){return Math.round(c.reduce((a,b)=>a+b,0)/(c.length*3)*100)}
function total(geo:number,c:number[]){return Math.round(geo*0.4+fisico(c)*0.6)}
function cor(s:number){return s>=80?'#15803D':s>=60?'#65A30D':s>=40?'#D97706':s>=20?'#EA580C':'#DC2626'}
function lbl(s:number){return s>=80?'Excelente':s>=60?'Bom':s>=40?'Regular':s>=20?'Ruim':'Crítico'}

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
  const [modo,     setModo]     = useState<'nenhum'|'bordas'|'grid'>('nenhum')
  const [setores,  setSetores]  = useState<Setor[]>([])
  const [ativo,    setAtivo]    = useState<number|null>(null)
  const [msg,      setMsg]      = useState('')
  const [consultas,setConsultas]= useState<{id:string;nome_imovel:string}[]>([])
  const [fullscreen,setFullscreen] = useState(false)
  const [showInstrucao,setShowInstrucao] = useState(true)
  const [bordaModificada,setBordaModificada] = useState(false)
  const [ultimoRecalculo,setUltimoRecalculo] = useState<string|null>(null)
  const fsCvRef = useRef<HTMLCanvasElement>(null)
  // Refs to always have latest values (avoids stale closures in drag handlers)
  const boundsRef = useRef<Bounds|null>(null)
  const lhRef = useRef([1/3,2/3])
  const lvRef = useRef([1/3,2/3])

  // Dismiss instruction card via localStorage
  useEffect(()=>{
    if(consultaId){
      const key = `bagua_instrucao_dismissed_${consultaId}`
      if(localStorage.getItem(key)==='1') setShowInstrucao(false)
    }
  },[consultaId])
  function dismissInstrucao(){
    setShowInstrucao(false)
    if(consultaId) localStorage.setItem(`bagua_instrucao_dismissed_${consultaId}`,'1')
  }

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

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user){router.push('/login');return}
      supabase.from('consultas').select('id,nome_imovel').eq('consultor_id',user.id)
        .order('criado_em',{ascending:false}).then(({data})=>setConsultas(data||[]))
      // Se veio com consultaId, carrega nome e dados existentes
      if(consultaId){
        supabase.from('consultas').select('nome_imovel,bagua_entrada').eq('id',consultaId).single()
          .then(({data})=>{
            if(data) setConsultaNome(data.nome_imovel)
            if(data?.bagua_entrada){
              const e=data.bagua_entrada as {x:number;y:number;lado:string}
              setEntrada({x:e.x,y:e.y})
              setLado(e.lado as Lado)
            }
          })
        supabase.from('setores_bagua')
          .select('numero,score_percentual,diagnostico_criterios(criterio,score)')
          .eq('consulta_id',consultaId).order('numero')
          .then(({data})=>{
            if(!data||data.length===0) return
            setSetores(prev=>{
              const next=[...prev]
              data.forEach((s:any)=>{
                const idx=(s.numero||1)-1
                if(idx<0||idx>8) return
                const cMap:number[]=Array(8).fill(0)
                s.diagnostico_criterios?.forEach((c:any)=>{
                  const ci=['Limpeza e organização','Iluminação adequada','Ventilação e ar fresco','Cores harmônicas','Mobiliário posicionado','Plantas e elementos naturais','Ausência de objetos quebrados','Fluxo de energia livre'].indexOf(c.criterio)
                  if(ci>=0) cMap[ci]=c.score
                })
                next[idx]={...next[idx],criterios:cMap}
              })
              return next
            })
          })
      }
    })
  },[router,consultaId])

  // ── reconstruir imagem rotacionada + redimensionar canvas ─────────────────
  // ÚNICA vez que o canvas é redimensionado = quando image ou rotacao muda
  useEffect(()=>{
    if(!img) return
    const r=buildRot(img,rot)
    rotRef.current=r
    const cv=cvRef.current; if(!cv) return
    const maxW=Math.min(640,window.innerWidth-80)
    const maxH=Math.max(200,window.innerHeight-440)
    const s=Math.min(maxW/r.width,maxH/r.height)
    cv.width=r.width*s; cv.height=r.height*s
    // Fixar CSS igual aos pixels — impede width:100% de distorcer canvas portrait
    cv.style.width  = cv.width  + 'px'
    cv.style.height = cv.height + 'px'
    // reset posicionamento ao girar
    setBounds(null); setEntrada(null); setSetores([])
  },[img,rot])

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
      const c=sc?desvioCorCanvas(sc.desvio):st.cor
      ctx.fillStyle=c+(sel?'55':'28'); ctx.fillRect(x0,y0,fw,fh)
      ctx.strokeStyle=sel?'#000':c; ctx.lineWidth=sel?3:1.5; ctx.strokeRect(x0,y0,fw,fh)
      const fs=Math.max(8,Math.min(12,fw/11))
      ctx.fillStyle='#000000cc'; ctx.font=`bold ${fs}px Arial`; ctx.textAlign='center'
      ctx.fillText(st.nome,x0+fw/2,y0+fh/2-(sc?fs*0.6:0))
      if(sc){
        const dt=desvioTipo(sc.desvio,sc)
        ctx.font=`${Math.max(7,fs-2)}px Arial`; ctx.fillStyle='#000000aa'
        ctx.fillText(`AR: ${Math.round(sc.ar).toLocaleString()} px²`,x0+fw/2,y0+fh/2+fs*0.5)
        ctx.font=`bold ${Math.max(7,fs-2)}px Arial`
        ctx.fillStyle=desvioCorCanvas(sc.desvio)
        ctx.fillText(`${dt.icon} ${dt.tipo}`,x0+fw/2,y0+fh/2+fs*1.5)
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

    // ── linhas grid ──
    if(modo==='grid'){
      ctx.strokeStyle='#FF4500'; ctx.lineWidth=2.5; ctx.setLineDash([6,4])
      lh.forEach(h=>{
        const ly=by+bh*h
        ctx.beginPath(); ctx.moveTo(bx,ly); ctx.lineTo(bx+bw,ly); ctx.stroke()
        ctx.beginPath(); ctx.arc(bx+bw/2,ly,10,0,Math.PI*2)
        ctx.fillStyle='#FF4500'; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke()
      })
      lv.forEach(v=>{
        const lx=bx+bw*v
        ctx.beginPath(); ctx.moveTo(lx,by); ctx.lineTo(lx,by+bh); ctx.stroke()
        ctx.beginPath(); ctx.arc(lx,by+bh/2,10,0,Math.PI*2)
        ctx.fillStyle='#FF4500'; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke()
      })
      ctx.setLineDash([])
    }

    // ── marcador de entrada ──
    if(entrada){
      const ex=entrada.x*s,ey=entrada.y*s
      const r2=7 // circle radius (14px diameter / 2)

      // Chi direction arrow (pointing inward from closest wall)
      if(bounds){
        const bx2=bounds.x*s,by2=bounds.y*s,bw2=bounds.w*s,bh2=bounds.h*s
        const distTop=Math.abs(ey-by2),distBot=Math.abs(ey-(by2+bh2))
        const distLeft=Math.abs(ex-bx2),distRight=Math.abs(ex-(bx2+bw2))
        const minDist=Math.min(distTop,distBot,distLeft,distRight)
        let ax=0,ay=0 // arrow direction (inward)
        if(minDist===distTop){ay=1} else if(minDist===distBot){ay=-1}
        else if(minDist===distLeft){ax=1} else {ax=-1}
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[bounds,entrada,lado,escola,lh,lv,modo,setores,ativo])

  // redesenha sempre que draw muda (state changes)
  useEffect(()=>{ draw() },[draw])
  // redesenha quando rotRef é atualizado (depois do useEffect de rotação)
  useEffect(()=>{ draw() },[rot,img])
  // redesenha quando step muda (ex: configurar → entrada)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ draw() },[step])

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
      const c=sc?desvioCorCanvas(sc.desvio):st.cor
      ctx.fillStyle=c+'28'; ctx.fillRect(x0,y0,fw,fh)
      ctx.strokeStyle=c; ctx.lineWidth=1.5; ctx.strokeRect(x0,y0,fw,fh)
      const fs=Math.max(10,Math.min(16,fw/9))
      ctx.fillStyle='#000000cc'; ctx.font=`bold ${fs}px Arial`; ctx.textAlign='center'
      ctx.fillText(st.nome,x0+fw/2,y0+fh/2-(sc?fs*0.6:0))
      if(sc){
        const dt=desvioTipo(sc.desvio,sc)
        ctx.font=`${Math.max(8,fs-1)}px Arial`; ctx.fillStyle='#000000aa'
        ctx.fillText(`AR: ${Math.round(sc.ar).toLocaleString()} px²`,x0+fw/2,y0+fh/2+fs*0.5)
        ctx.font=`bold ${Math.max(8,fs-1)}px Arial`
        ctx.fillStyle=desvioCorCanvas(sc.desvio)
        ctx.fillText(`${dt.icon} ${dt.tipo}`,x0+fw/2,y0+fh/2+fs*1.7)
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

    // Grid lines
    if(modo==='grid'){
      ctx.strokeStyle='#FF4500'; ctx.lineWidth=2.5; ctx.setLineDash([8,5])
      lh.forEach(h=>{
        const ly=by+bh*h
        ctx.beginPath(); ctx.moveTo(bx,ly); ctx.lineTo(bx+bw,ly); ctx.stroke()
        ctx.beginPath(); ctx.arc(bx+bw/2,ly,14,0,Math.PI*2)
        ctx.fillStyle='#FF4500'; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke()
      })
      lv.forEach(v=>{
        const lx=bx+bw*v
        ctx.beginPath(); ctx.moveTo(lx,by); ctx.lineTo(lx,by+bh); ctx.stroke()
        ctx.beginPath(); ctx.arc(lx,by+bh/2,14,0,Math.PI*2)
        ctx.fillStyle='#FF4500'; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke()
      })
      ctx.setLineDash([])
    }

    // Entry marker (fullscreen version)
    if(entrada){
      const ex2=entrada.x*s,ey2=entrada.y*s
      const r2=9

      // Chi direction arrow
      if(bounds){
        const bx2=bounds.x*s,by2=bounds.y*s,bw2=bounds.w*s,bh2=bounds.h*s
        const distTop=Math.abs(ey2-by2),distBot=Math.abs(ey2-(by2+bh2))
        const distLeft=Math.abs(ex2-bx2),distRight=Math.abs(ex2-(bx2+bw2))
        const minDist=Math.min(distTop,distBot,distLeft,distRight)
        let ax2=0,ay2=0
        if(minDist===distTop){ay2=1} else if(minDist===distBot){ay2=-1}
        else if(minDist===distLeft){ax2=1} else {ax2=-1}
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[fullscreen,bounds,entrada,lado,escola,lh,lv,modo,setores])

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
    if(modo==='grid'){
      for(let i=0;i<lh.length;i++) if(Math.abs(cy-(by+bh*lh[i]))<T) return{tipo:'linhaH',index:i}
      for(let i=0;i<lv.length;i++) if(Math.abs(cx-(bx+bw*lv[i]))<T) return{tipo:'linhaV',index:i}
    }
    return null
  }
  function onFsMD(e:React.MouseEvent<HTMLCanvasElement>){
    if(modo==='nenhum') return
    const{cx,cy}=fsCC(e); const t=fsFindDrag(cx,cy)
    if(t){dragRef.current=t; isDrag.current=false}
  }
  function onFsMM(e:React.MouseEvent<HTMLCanvasElement>){
    if(!dragRef.current||!bounds) return
    isDrag.current=true; setBordaModificada(true)
    const{cx,cy}=fsCC(e); const s=fsScale()
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
    if(t.tipo==='linhaH'){const rel=Math.max(0.05,Math.min(0.95,(cy-by)/bh));setLh(p=>{const n=p.map((v,i)=>i===t.index?rel:v);lhRef.current=n;return n})}
    if(t.tipo==='linhaV'){const rel=Math.max(0.05,Math.min(0.95,(cx-bx)/bw));setLv(p=>{const n=p.map((v,i)=>i===t.index?rel:v);lvRef.current=n;return n})}
  }
  function onFsMU(){
    if(isDrag.current) recalcular()
    dragRef.current=null; setTimeout(()=>{isDrag.current=false},50)
  }

  // ── coords canvas (independente de CSS scale) ──────────────────────────────
  function cc(e:React.MouseEvent<HTMLCanvasElement>){
    const cv=cvRef.current!,r=cv.getBoundingClientRect()
    return{cx:(e.clientX-r.left)*(cv.width/r.width),cy:(e.clientY-r.top)*(cv.height/r.height)}
  }

  // ── upload ─────────────────────────────────────────────────────────────────
  function onUpload(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file) return
    const reader=new FileReader()
    reader.onload=ev=>{
      const i=new Image()
      i.onload=()=>{ setImg(i); setRot(0); setStep('configurar') }
      i.src=ev.target?.result as string
    }
    reader.readAsDataURL(file)
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
      // Persist entrance point
      if(consultaId){
        supabase.from('consultas').update({bagua_entrada:{x:ex,y:ey,lado:newLado}}).eq('id',consultaId).then(()=>{})
      }
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

  // ── calcular ───────────────────────────────────────────────────────────────
  function calcular(){
    const r=rotRef.current; if(!r) return
    const b=calcBounds(r)
    setBounds(b); boundsRef.current=b
    setLh([1/3,2/3]); lhRef.current=[1/3,2/3]
    setLv([1/3,2/3]); lvRef.current=[1/3,2/3]
    setSetores(analisar(r,b,[1/3,2/3],[1/3,2/3]))
    setStep('resultado'); setModo('nenhum')
    setBordaModificada(false)
    setUltimoRecalculo(new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))
  }

  function recalcular(){
    const r=rotRef.current
    const b=boundsRef.current
    const curLh=lhRef.current
    const curLv=lvRef.current
    if(!r||!b) return
    const novos=analisar(r,b,curLh,curLv)
    setSetores(prev=>novos.map((n,i)=>({...n,criterios:prev[i]?.criterios??n.criterios})))
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
    if(modo==='grid'){
      for(let i=0;i<lh.length;i++) if(Math.abs(cy-(by+bh*lh[i]))<T) return{tipo:'linhaH',index:i}
      for(let i=0;i<lv.length;i++) if(Math.abs(cx-(bx+bw*lv[i]))<T) return{tipo:'linhaV',index:i}
    }
    return null
  }

  function onMD(e:React.MouseEvent<HTMLCanvasElement>){
    if(modo==='nenhum') return
    const{cx,cy}=cc(e); const t=findDrag(cx,cy)
    if(t){dragRef.current=t; isDrag.current=false}
  }

  function onMM(e:React.MouseEvent<HTMLCanvasElement>){
    if(!dragRef.current||!bounds) return
    isDrag.current=true; setBordaModificada(true)
    const{cx,cy}=cc(e); const s=scale()
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
    if(t.tipo==='linhaH'){const rel=Math.max(0.05,Math.min(0.95,(cy-by)/bh));setLh(p=>{const n=p.map((v,i)=>i===t.index?rel:v);lhRef.current=n;return n})}
    if(t.tipo==='linhaV'){const rel=Math.max(0.05,Math.min(0.95,(cx-bx)/bw));setLv(p=>{const n=p.map((v,i)=>i===t.index?rel:v);lvRef.current=n;return n})}
  }

  function onMU(){
    if(isDrag.current) recalcular()
    dragRef.current=null; setTimeout(()=>{isDrag.current=false},50)
  }

  // ── critério ───────────────────────────────────────────────────────────────
  // ── salvar setor no banco ──────────────────────────────────────────────────
  async function salvarSetorDB(orderIdx:number){
    if(!consultaId) return
    console.log('ativo:', ativo, 'setores[ativo]:', ativo !== null ? setores[ativo] : null)
    const stDef=SETORES[order[orderIdx]]
    const sc=setores[orderIdx]
    // upsert setor_bagua
    const {data:setorRow,error:e1}=await supabase.from('setores_bagua').upsert({
      consulta_id:consultaId,
      numero:orderIdx+1,
      nome:stDef.nome,
      elemento:stDef.elem,
      posicao_grid:String(orderIdx+1),
      score_percentual:Math.round(sc.geo*0.4+(sc.criterios.reduce((a:number,b:number)=>a+b,0)/24*100)*0.6)
    },{onConflict:'consulta_id,numero'}).select('id').single()
    if(e1||!setorRow){setMsg('Erro: '+(e1?.message||JSON.stringify(e1)||'sem retorno'));return}
    // salvar criterios
    const nomes=['Limpeza e organização','Iluminação adequada','Ventilação e ar fresco','Cores harmônicas','Mobiliário posicionado','Plantas e elementos naturais','Ausência de objetos quebrados','Fluxo de energia livre']
    const inserts=nomes.map((criterio,ci)=>({setor_id:setorRow.id,criterio,score:sc.criterios[ci]??0}))
    await supabase.from('diagnostico_criterios').delete().eq('setor_id',setorRow.id)
    await supabase.from('diagnostico_criterios').insert(inserts)
    // Save canvas snapshot to consulta (best effort - column may not exist yet)
    try {
      const cv=cvRef.current
      if(cv){
        const dataUrl=cv.toDataURL('image/png',0.7)
        await supabase.from('consultas').update({bagua_imagem:dataUrl}).eq('id',consultaId)
      }
    } catch{}
    setMsg(`"${stDef.nome}" salvo!`)
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
        const scorePct=Math.round(sc.geo*0.4+(sc.criterios.reduce((a:number,b:number)=>a+b,0)/24*100)*0.6)
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
        await supabase.from('diagnostico_criterios').delete().eq('setor_id',setorRow.id)
        await supabase.from('diagnostico_criterios').insert(inserts)
      }
      // Save canvas snapshot + finalization metadata
      const cv=cvRef.current
      const dataUrl=cv?cv.toDataURL('image/png',0.7):null
      const b=boundsRef.current
      const finalizacao={
        x:entrada?.x??0, y:entrada?.y??0, lado,
        bordas:b?{x:b.x,y:b.y,w:b.w,h:b.h}:null,
        finalizada_em:new Date().toISOString(),
        lh:lhRef.current, lv:lvRef.current,
      }
      await supabase.from('consultas').update({
        bagua_imagem:dataUrl,
        bagua_entrada:finalizacao,
        status:'em_andamento',
      }).eq('id',consultaId)
      // Show toast
      setMsg('✓ Análise salva com sucesso. Todas as páginas foram atualizadas.')
      setTimeout(()=>{
        router.push(`/consultas/${consultaId}`)
      },1000)
    }catch(err:any){
      setMsg('Erro ao salvar: '+(err?.message||'erro desconhecido'))
    }finally{
      setSalvandoTudo(false)
    }
  }

  const order  = gridOrder(escola,lado)
  const stepN  = {upload:0,configurar:1,entrada:2,resultado:3}[step]
  const stAtivo= ativo!==null?SETORES[order[ativo]]:null
  const scAtivo= ativo!==null?setores[ativo]:null

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#F9FAFB',fontFamily:'Arial,sans-serif'}}>
      <style>{`
        @keyframes pulseEntrada {
          0%   { transform: scale(1);   opacity: 1; }
          50%  { transform: scale(1.5); opacity: 0.4; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      <header style={{background:'#1E3A5F',padding:'0 20px',height:'52px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{fontSize:'22px',cursor:'pointer'}} onClick={()=>router.push('/dashboard')}>☯</span>
          <span style={{color:'#B8860B',fontSize:'17px',fontWeight:'bold'}}>FengShui Studio</span>
        </div>
        <div style={{display:'flex',gap:'14px',alignItems:'center'}}>
          {consultaId && (
            <span onClick={()=>router.push(`/consultas/${consultaId}`)} style={{color:'#B8860B',fontSize:'13px',cursor:'pointer',fontWeight:'bold'}}>← {consultaNome||'Consulta'}</span>
          )}
          <span onClick={()=>router.push('/dashboard')} style={{color:'rgba(255,255,255,0.7)',fontSize:'13px',cursor:'pointer'}}>Dashboard</span>
          <span onClick={()=>router.push('/consultas')} style={{color:'rgba(255,255,255,0.7)',fontSize:'13px',cursor:'pointer'}}>Consultas</span>
        </div>
      </header>

      <main style={{padding:'14px 18px',maxWidth:'1160px',margin:'0 auto'}}>

        <div style={{marginBottom:'10px'}}>
          <h1 style={{color:'#1E3A5F',fontSize:'17px',fontWeight:'bold',margin:'0 0 2px 0'}}>Análise de Planta Ba Gua</h1>
          <p style={{color:'#6B7280',fontSize:'12px',margin:0}}>Mapeamento e avaliação energética por setor</p>
        </div>

        {/* Steps */}
        <div style={{display:'flex',gap:'6px',marginBottom:'12px',alignItems:'center'}}>
          {['Upload','Configurar','Entrada','Resultado'].map((s,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:'5px'}}>
              <div style={{width:'20px',height:'20px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'10px',fontWeight:'bold',
                background:i<stepN?'#15803D':i===stepN?'#1E3A5F':'#E5E7EB',
                color:i<=stepN?'#fff':'#9CA3AF'}}>
                {i<stepN?'✓':i+1}
              </div>
              <span style={{color:'#374151',fontSize:'12px'}}>{s}</span>
              {i<3&&<span style={{color:'#D1D5DB',fontSize:'10px'}}>→</span>}
            </div>
          ))}
        </div>

        {/* ════ UPLOAD ════ */}
        {step==='upload'&&(
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

        {/* ════ CANVAS AREA (sempre no DOM quando há imagem) ════ */}
        {step!=='upload'&&(
          <div style={{display:'flex',gap:'12px',alignItems:'flex-start'}}>
            <div style={{flex:1,minWidth:0,background:'#fff',borderRadius:'12px',padding:'14px',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>

              {/* Instrução contextual acima do canvas */}
              {step==='configurar'&&(
                <div style={{marginBottom:'8px',padding:'7px 10px',background:'#F3E8FF',borderRadius:'6px',color:'#7C3AED',fontSize:'12px'}}>
                  🔄 Ajuste a rotação para que a <strong>porta fique na base</strong> da imagem (↓), depois clique em Continuar
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
              <div style={{position:'relative',display:'inline-block'}}>
                <canvas ref={cvRef}
                  onClick={step==='entrada'||step==='resultado'?onClick:undefined}
                  onMouseDown={step==='resultado'?onMD:undefined}
                  onMouseMove={step==='resultado'?onMM:undefined}
                  onMouseUp={step==='resultado'?onMU:undefined}
                  onMouseLeave={step==='resultado'?onMU:undefined}
                  style={{
                    maxWidth:'100%',display:'block',
                    border:'1px solid #E5E7EB',borderRadius:'8px',
                    cursor: step==='entrada'?'crosshair':modo!=='nenhum'?'move':'pointer',
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
                    style={{padding:'7px 14px',background:'transparent',color:'#6B7280',border:'1px solid #D1D5DB',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>
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

              {/* Instrução explicativa (resultado) */}
              {step==='resultado'&&showInstrucao&&(
                <div style={{marginTop:'10px',padding:'16px 18px',background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:'10px',position:'relative'}}>
                  <button onClick={dismissInstrucao} style={{position:'absolute',top:'8px',right:'10px',background:'transparent',border:'none',fontSize:'16px',cursor:'pointer',color:'#6B7280'}}>✕</button>
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
                  <button onClick={()=>{dismissInstrucao();setModo('bordas')}} style={{
                    width:'100%',padding:'10px',background:'#1D4ED8',color:'#fff',border:'none',
                    borderRadius:'7px',fontSize:'13px',fontWeight:'bold',cursor:'pointer'
                  }}>Entendido — ajustar bordas</button>
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
                    <button onClick={()=>setModo(modo==='grid'?'nenhum':'grid')}
                      style={{background:modo==='grid'?'#DC2626':'#7C3AED',color:'#fff',border:'none',padding:'6px 12px',borderRadius:'6px',fontSize:'11px',fontWeight:'bold',cursor:'pointer'}}>
                      {modo==='grid'?'🔒 Finalizar':'⊞ Grid'}
                    </button>
                    <button onClick={recalcular} disabled={!bordaModificada}
                      style={{background:bordaModificada?'#1D4ED8':'#93C5FD',color:'#fff',border:'none',padding:'6px 12px',borderRadius:'6px',fontSize:'11px',fontWeight:'bold',cursor:bordaModificada?'pointer':'not-allowed',opacity:bordaModificada?1:0.6}}>
                      🔄 Recalcular
                    </button>
                    <button onClick={()=>setFullscreen(true)}
                      style={{background:'#15803D',color:'#fff',border:'none',padding:'6px 12px',borderRadius:'6px',fontSize:'11px',fontWeight:'bold',cursor:'pointer'}}>
                      🔍 Tela cheia
                    </button>
                    <button onClick={()=>{setStep('upload');setImg(null);setBounds(null);setEntrada(null);setModo('nenhum');setSetores([]);setAtivo(null)}}
                      style={{background:'transparent',color:'#6B7280',border:'1px solid #D1D5DB',padding:'6px 12px',borderRadius:'6px',fontSize:'11px',cursor:'pointer'}}>
                      ↩ Nova planta
                    </button>
                  </div>
                  {modo==='bordas'&&<div style={{marginTop:'5px',padding:'5px 9px',background:'#FEF3C7',borderRadius:'5px',color:'#92400E',fontSize:'10px'}}>Arraste as alças laranja nas bordas do retângulo</div>}
                  {modo==='grid'  &&<div style={{marginTop:'5px',padding:'5px 9px',background:'#EDE9FE',borderRadius:'5px',color:'#5B21B6',fontSize:'10px'}}>Arraste as linhas laranja para reposicionar os setores</div>}
                  {msg            &&<div style={{marginTop:'5px',padding:'6px 10px',background:'#F0FDF4',borderRadius:'5px',color:'#15803D',fontSize:'11px',fontWeight:'bold'}}>✅ {msg}</div>}
                  {ultimoRecalculo&&!bordaModificada&&<div style={{marginTop:'5px',padding:'5px 9px',background:'#F0FDF4',borderRadius:'5px',color:'#15803D',fontSize:'10px'}}>✓ Atualizado às {ultimoRecalculo}</div>}
                  {bordaModificada&&<div style={{marginTop:'5px',padding:'5px 9px',background:'#FEF3C7',borderRadius:'5px',color:'#92400E',fontSize:'10px'}}>⚠ Bordas alteradas — clique em &quot;Recalcular&quot; para atualizar os valores</div>}

                  {/* Mini-cards 3x3 */}
                  {setores.length>0&&(
                    <div style={{marginTop:'12px'}}>
                      <div style={{fontSize:'11px',fontWeight:'bold',color:'#1E3A5F',marginBottom:'6px'}}>📊 Resumo por setor</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'5px'}}>
                        {setores.map((sc,i)=>{
                          const st=SETORES[order[i]]; const sel=ativo===i
                          const dt=desvioTipo(sc.desvio,sc)
                          const dStr=sc.desvio>0?`+${Math.round(sc.desvio)}%`:`${Math.round(sc.desvio)}%`
                          const statusCor=desvioCorCanvas(sc.desvio)
                          return(
                            <div key={i} onClick={()=>setAtivo(i===ativo?null:i)} style={{
                              padding:'7px',borderRadius:'6px',cursor:'pointer',
                              border:`2px solid ${sel?statusCor:'#E5E7EB'}`,background:sel?statusCor+'18':'#F9FAFB',
                            }}>
                              <div style={{fontSize:'10px',fontWeight:'bold',color:'#1E3A5F'}}>{st.nome}</div>
                              <div style={{fontSize:'11px',color:'#374151',marginTop:'2px'}}>AR: {Math.round(sc.ar).toLocaleString()} px²</div>
                              <div style={{fontSize:'10px',color:statusCor,fontWeight:'bold',marginTop:'2px'}}>{dt.icon} {dStr} {dt.tipo}</div>
                              <div style={{fontSize:'8px',color:statusCor}}>{dt.intensidade!=='—'?dt.intensidade:''}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Balanced banner */}
                  {setores.length===9&&setores.every(s=>Math.abs(s.desvio)<=5)&&(
                    <div style={{marginTop:'10px',padding:'10px 14px',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:'8px',textAlign:'center'}}>
                      <div style={{fontSize:'20px',marginBottom:'4px'}}>☯</div>
                      <div style={{fontSize:'12px',fontWeight:'bold',color:'#15803D'}}>Planta equilibrada</div>
                      <div style={{fontSize:'10px',color:'#16A34A',marginTop:'2px'}}>Todos os setores com desvio ≤ 5%</div>
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
              <div style={{width:'276px',flexShrink:0,background:'#fff',borderRadius:'12px',padding:'14px',
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

                {/* ── MÉTRICAS DE ÁREA ── */}
                {(()=>{
                  const dt=desvioTipo(scAtivo.desvio,scAtivo)
                  const autoDesvio=Math.round(scAtivo.desvio)
                  const finalDesvio=scAtivo.ajusteManual!==null?scAtivo.ajusteManual:autoDesvio
                  const finalDt=scAtivo.ajusteManual!==null?desvioTipo(-Math.abs(scAtivo.ajusteManual)):dt
                  // Metrics: only show AV/AE if > 0
                  const metricRows:[string,number,string][] = [
                    ['AQ  Área teórica',scAtivo.aq,'1/9 do retângulo'],
                  ]
                  if(scAtivo.av>0) metricRows.push(['A_falta (vazio interno)',scAtivo.av,'AQ − AC'])
                  if(scAtivo.ae>0) metricRows.push(['A_excesso (constr. externa)',scAtivo.ae,'fora das bordas'])
                  metricRows.push(['AR  Área resultante',scAtivo.ar,'AQ − falta − excesso'])
                  return (
                    <div style={{marginBottom:'10px'}}>
                      <div style={{fontSize:'11px',fontWeight:'bold',color:'#374151',marginBottom:'6px'}}>📐 Métricas de área</div>
                      <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
                        {metricRows.map(([label,val,formula],mi)=>(
                          <div key={mi} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 7px',background:mi===metricRows.length-1?'#EFF6FF':'#F9FAFB',borderRadius:'4px'}}>
                            <span style={{fontSize:'10px',fontWeight:mi===metricRows.length-1?'bold':'normal',color:'#1E3A5F'}}>{label}</span>
                            <div style={{display:'flex',alignItems:'baseline',gap:'4px'}}>
                              <span style={{fontSize:'11px',fontWeight:'bold',color:'#374151'}}>{Math.round(val).toLocaleString()} px²</span>
                              <span style={{fontSize:'8px',color:'#D1D5DB'}}>{formula}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Multi-level desvio display */}
                      <div style={{marginTop:'8px',display:'flex',flexDirection:'column',gap:'3px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 7px',background:'#F9FAFB',borderRadius:'4px'}}>
                          <span style={{fontSize:'10px',color:'#6B7280'}}>Automático:</span>
                          <span style={{fontSize:'11px',fontWeight:'bold',color:dt.cor}}>{autoDesvio}% {dt.icon} {dt.tipo}</span>
                        </div>
                        {scAtivo.ajusteManual!==null&&(
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 7px',background:'#EDE9FE',borderRadius:'4px',borderLeft:'3px solid #7C3AED'}}>
                            <span style={{fontSize:'10px',color:'#5B21B6',fontWeight:'bold'}}>Final (consultor):</span>
                            <span style={{fontSize:'11px',fontWeight:'bold',color:finalDt.cor}}>{-Math.abs(scAtivo.ajusteManual)}% {finalDt.icon} {finalDt.tipo}</span>
                          </div>
                        )}
                      </div>

                      {/* Desvio banner */}
                      <div style={{marginTop:'6px',padding:'6px 8px',borderRadius:'6px',display:'flex',alignItems:'center',gap:'6px',
                        background:finalDt.cor+'15',borderLeft:`3px solid ${finalDt.cor}`}}>
                        <span style={{fontSize:'14px'}}>{finalDt.icon}</span>
                        <div>
                          <div style={{fontSize:'11px',fontWeight:'bold',color:finalDt.cor}}>Desvio: {finalDesvio}%</div>
                          <div style={{fontSize:'9px',color:finalDt.cor}}>{finalDt.tipo}{finalDt.intensidade!=='—'?` · ${finalDt.intensidade}`:''}</div>
                        </div>
                      </div>

                      {/* Explanatory messages */}
                      {scAtivo.av > 0 && (
                        <div style={{marginTop:'6px',padding:'6px 8px',background:'#FEF2F2',borderRadius:'5px',borderLeft:'3px solid #DC2626',fontSize:'10px',color:'#7F1D1D',lineHeight:'1.5'}}>
                          ⚠ Este setor possui {Math.round(scAtivo.av).toLocaleString()} px² de área sem construção dentro de seus limites. Isso indica <strong>FALTA</strong> de energia no Guá de {stAtivo.nome}. AR = AQ − A_falta{scAtivo.ae>0?' − A_excesso':''}
                        </div>
                      )}
                      {scAtivo.ae > 0 && (
                        <div style={{marginTop:'4px',padding:'6px 8px',background:'#FFF7ED',borderRadius:'5px',borderLeft:'3px solid #EA580C',fontSize:'10px',color:'#78350F',lineHeight:'1.5'}}>
                          ⚠ Este setor possui {Math.round(scAtivo.ae).toLocaleString()} px² de construção fora das bordas. Essa área foi descontada pois não integra o Baguá. AR = AQ − {scAtivo.av>0?'A_falta − ':''}A_excesso
                        </div>
                      )}
                      {scAtivo.av === 0 && scAtivo.ae === 0 && (
                        <div style={{marginTop:'4px',padding:'6px 8px',background:'#F0FDF4',borderRadius:'5px',borderLeft:'3px solid #15803D',fontSize:'10px',color:'#14532D',lineHeight:'1.5'}}>
                          ✓ Setor completamente equilibrado dentro das bordas. Sem falta nem excesso. AR = AQ
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* ── AJUSTE DO CONSULTOR (Nível 3) ── */}
                <div style={{marginBottom:'10px',padding:'10px',background:'#FAFAFA',borderRadius:'8px',border:'1px solid #E5E7EB'}}>
                  <div style={{fontSize:'11px',fontWeight:'bold',color:'#374151',marginBottom:'8px'}}>🎛 Ajuste do consultor</div>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px'}}>
                    <label style={{fontSize:'10px',color:'#6B7280',whiteSpace:'nowrap'}}>Desvio manual (%):</label>
                    <input type="number" min={-100} max={0} step={1}
                      value={scAtivo.ajusteManual??''}
                      placeholder="—"
                      onChange={e=>{
                        const v=e.target.value
                        setAjusteManual(ativo!,v===''?null:Number(v))
                      }}
                      style={{width:'60px',padding:'4px 6px',borderRadius:'4px',border:'1px solid #D1D5DB',fontSize:'11px',textAlign:'center'}}
                    />
                    <select value={scAtivo.ajusteTipo??''}
                      onChange={e=>setAjusteTipo(ativo!,(e.target.value||null) as any)}
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
                      Ajustado manualmente — este valor sobrescreve o automático
                    </div>
                  )}
                </div>

                {/* ── Recomendações dinâmicas (ACIMA dos critérios) ── */}
                {(()=>{
                  const rec = gerarRecomendacoes(stAtivo, scAtivo)
                  const hasRec = rec.urgente.length + rec.melhoria.length + rec.manutencao.length > 0
                  if (!hasRec) return null
                  return (
                    <div style={{marginBottom:'12px',borderTop:'1px solid #F3F4F6',paddingTop:'10px'}}>
                      <div style={{fontSize:'12px',fontWeight:'bold',color:'#374151',marginBottom:'8px'}}>💡 Recomendações</div>

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
                  )
                })()}

                {/* Critérios */}
                <div style={{fontSize:'12px',fontWeight:'bold',color:'#374151',marginBottom:'8px',borderTop:'1px solid #F3F4F6',paddingTop:'8px'}}>
                  Avaliação física
                </div>
                {CRITERIOS.map((crit,ci)=>(
                  <div key={ci} style={{marginBottom:'9px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                      <span style={{fontSize:'10px',color:'#374151'}}>{crit}</span>
                      <span style={{fontSize:'10px',fontWeight:'bold',color:['#DC2626','#D97706','#65A30D','#15803D'][scAtivo.criterios[ci]]}}>
                        {['Crítico','Regular','Bom','Ótimo'][scAtivo.criterios[ci]]}
                      </span>
                    </div>
                    <div style={{display:'flex',gap:'3px'}}>
                      {[0,1,2,3].map(v=>(
                        <button key={v} onClick={()=>setCrit(ativo!,ci,v)} style={{
                          flex:1,padding:'4px 0',borderRadius:'4px',border:'1px solid',fontSize:'11px',fontWeight:'bold',cursor:'pointer',
                          borderColor:scAtivo.criterios[ci]===v?['#DC2626','#D97706','#65A30D','#15803D'][v]:'#D1D5DB',
                          background:scAtivo.criterios[ci]===v?['#FEF2F2','#FFF7ED','#F0FDF4','#DCFCE7'][v]:'#fff',
                          color:scAtivo.criterios[ci]===v?['#DC2626','#D97706','#65A30D','#15803D'][v]:'#9CA3AF',
                        }}>{v}</button>
                      ))}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'8px',color:'#D1D5DB',marginTop:'1px'}}>
                      <span>Crítico</span><span>Ótimo</span>
                    </div>
                  </div>
                ))}

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
                <button onClick={()=>setModo(modo==='grid'?'nenhum':'grid')}
                  style={{background:modo==='grid'?'#DC2626':'#7C3AED',color:'#fff',border:'none',padding:'8px 16px',borderRadius:'6px',fontSize:'12px',fontWeight:'bold',cursor:'pointer'}}>
                  {modo==='grid'?'🔒 Finalizar grid':'⊞ Ajustar grid'}
                </button>
                <button onClick={recalcular} disabled={!bordaModificada}
                  style={{background:bordaModificada?'#1D4ED8':'#93C5FD',color:'#fff',border:'none',padding:'8px 16px',borderRadius:'6px',fontSize:'12px',fontWeight:'bold',cursor:bordaModificada?'pointer':'not-allowed',opacity:bordaModificada?1:0.6}}>
                  🔄 Recalcular
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
            {modo==='grid'&&(
              <div style={{position:'absolute',top:'64px',left:'50%',transform:'translateX(-50%)',
                padding:'6px 16px',background:'#EDE9FE',borderRadius:'6px',color:'#5B21B6',fontSize:'12px',zIndex:1}}>
                Arraste as linhas para reposicionar as divisoes dos setores Ba Gua
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
                cursor:modo!=='nenhum'?'move':'default',
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
    </div>
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
