'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'next/navigation'
import FlowLayout from '../../../components/FlowLayout'
import PlantaMobiliario from '../../../components/PlantaMobiliario'
import { novoMobiliario, nomesDosQuadrantes, leituraMobiliario, setorDoPonto, validarItensMobiliario, MAX_MOBILIARIO, type CadastroMobiliario, type ItemMobiliario } from '../../../../src/lib/mobiliario'
import type { BaguaEntrada } from '../../../../src/lib/types'

interface Dados { nome: string; planta: BaguaEntrada; planta_sha256: string; cadastro: CadastroMobiliario }
const campo: CSSProperties = { display: 'block', minHeight: 44, width: '100%', border: '1px solid #98A99F', borderRadius: 6, padding: 8, boxSizing: 'border-box', background: '#fff', color: '#142B25' }
const botao: CSSProperties = { minHeight: 44, padding: '8px 14px', border: '1px solid #245F52', borderRadius: 6, background: '#fff', color: '#17372F', cursor: 'pointer' }
const tipos = { cama: 'Cama', fogao: 'Fogão', mesa: 'Mesa', outro: 'Outro' }

export default function MobiliarioPage() {
  const { id } = useParams<{ id: string }>()
  const [dados, setDados] = useState<Dados | null>(null)
  const [item, setItem] = useState<ItemMobiliario | null>(null)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const gravando = useRef(false)
  const [revisada, setRevisada] = useState(false)
  const [mostrarPlanta, setMostrarPlanta] = useState(false)
  const carregar = useCallback(async (signal?: AbortSignal) => {
    setErro('')
    try {
      const response = await fetch(`/api/consultas/${id}/mobiliario`, { cache: 'no-store', signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Falha ao carregar o cadastro.')
      setDados(data); setRevisada(false)
    } catch (e) { if (!signal?.aborted) setErro(e instanceof Error ? e.message : 'Cadastro indisponível.') }
  }, [id])
  useEffect(() => { const c = new AbortController(); void carregar(c.signal); return () => c.abort() }, [carregar])
  useEffect(() => {
    if (!item) return
    const alertar = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', alertar)
    return () => window.removeEventListener('beforeunload', alertar)
  }, [item])
  const alterada = !!dados && dados.cadastro.itens.length > 0 && dados.cadastro.referencia_planta !== dados.planta_sha256
  function alterar(v: Partial<ItemMobiliario>) { setItem(p => p ? { ...p, ...v } : p) }
  async function salvar(itens: ItemMobiliario[]) {
    if (!dados || gravando.current) return
    if (alterada && !revisada) { setErro('Revise as posições e confirme o uso da planta atual antes de salvar.'); return }
    if (!validarItensMobiliario(itens)) { setErro('Preencha o ambiente e confira data completa, setor e direção de 0 até menos de 360 graus.'); return }
    gravando.current=true; setOcupado(true); setErro(''); setMsg('')
    try {
      const r = await fetch(`/api/consultas/${id}/mobiliario`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisao: dados.cadastro.revisao, planta_sha256: dados.planta_sha256, itens }) })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? 'Não foi possível salvar.')
      setDados({ ...dados, cadastro: body.cadastro }); setItem(null); setMostrarPlanta(false); setMsg('Cadastro salvo. Os itens continuam separados, inclusive quando estão no mesmo setor.')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar. A edição permanece na tela.') }
    finally { gravando.current=false; setOcupado(false) }
  }
  const nomes = dados ? nomesDosQuadrantes(dados.planta) : []
  return <FlowLayout backHref={item ? undefined : `/bagua-planta?consultaId=${id}`} onBack={item ? () => setErro('Salve ou cancele a edição do móvel antes de voltar.') : undefined} backLabel="Voltar à planta">
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '70px 20px 40px', color: '#142B25' }}>
      <h1>Ambientes e mobiliário</h1>
      {dados && <p>{dados.nome}</p>}
      <p>Registre cada móvel em uma linha: setor, ambiente, posição e direção. Mesa e fogão podem ocupar o mesmo setor com posições e direções diferentes. Identifique a pessoa de referência por um apelido, se desejar; nascimento e sexo são opcionais para o cadastro e necessários apenas para o cálculo pessoal.</p>
      <details><summary style={{ ...botao, display: 'inline-block' }}>Como interpretar os termos e as direções</summary>
        <dl style={{ lineHeight: 1.6 }}>
          <dt><strong>Ba Zhai — Oito Mansões</strong></dt><dd>Método que relaciona oito direções ao trigrama da casa ou da pessoa. Kua da Casa deriva do assento, oposto à fachada confirmada; não é o mesmo dado que o Kua pessoal.</dd>
          <dt><strong>Ming Gua — Kua pessoal</strong></dt><dd>Número calculado pela data de nascimento e pelo parâmetro masculino/feminino da fórmula tradicional. Esse parâmetro não descreve a identidade de gênero. Próximo ao Li Chun, início do ano solar, pode ser necessário horário e fuso; o sistema informa a indeterminação.</dd>
          <dt><strong>坐凶向吉 — “sentar no mal, olhar para o bem”</strong></dt><dd>Expressão sobre distinguir localização e direção, frequentemente aplicada ao fogão nesta leitura. Não significa colocar toda cama ou mesa em um setor desfavorável. O cadastro compara a direção ao Ming Gua; não certifica sozinho o posicionamento do móvel.</dd>
          <dt><strong>Direção e Norte</strong></dt><dd>0° é Norte, 90° Leste, 180° Sul e 270° Oeste. Informe se a medida usa Norte magnético ou verdadeiro. Para converter entre eles, é necessária a declinação do local. Na mesa, registre a direção do olhar de quem a usa; para cama e fogão, descreva a convenção adotada no campo Identificação. Na planta, a fachada de referência corresponde à sua base.</dd>
          <dt><strong>Quadrante BTB</strong></dt><dd>O nome do guá identifica uma posição relativa à entrada. Ele não substitui a medição de uma direção cardinal. Este cadastro está disponível para BTB e Bússola; a leitura direcional permanece separada.</dd>
        </dl>
      </details>
      {erro && <p role="alert" style={{ padding: 12, background: '#FAEEE9', color: '#96372C' }}>{erro}</p>}
      {msg && <p role="status">{msg}</p>}
      {!dados && !erro && <p role="status">Carregando cadastro…</p>}
      <button style={botao} disabled={ocupado} onClick={() => void carregar()}>Recarregar dados salvos</button>
      {dados && <>
        {alterada && <div role="status" style={{ padding: 12, background: '#FFF5D9', marginTop: 12 }}><p>A planta mudou desde o último cadastro. Confira todos os setores, posições e direções antes de aceitar a nova referência. Resultados anteriores ficam suspensos até a revisão.</p><label><input type="checkbox" checked={revisada} onChange={e => {
          setRevisada(e.target.checked)
          if (e.target.checked) setDados({ ...dados, cadastro: { ...dados.cadastro, itens: dados.cadastro.itens.map(m => ({ ...m, setor: m.posicao ? setorDoPonto(m.posicao, dados.planta) ?? m.setor : m.setor, posicao: m.posicao && setorDoPonto(m.posicao, dados.planta) ? m.posicao : null, ...(m.origem === 'planta' ? { direcao: null } : {}) })) } })
        }} /> Revisei os setores na planta atual; direções obtidas na imagem serão medidas novamente.</label><button style={botao} disabled={!revisada || ocupado || !!item} onClick={() => void salvar(dados.cadastro.itens)}>Salvar revisão da referência</button></div>}
        <div style={{ overflowX: 'auto', margin: '20px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <caption style={{ textAlign: 'left', padding: 8 }}>{dados.cadastro.itens.length} móvel(is) cadastrado(s). Cada linha tem sua própria identificação.</caption>
            <thead><tr>{['Quadrante', 'Ambiente', 'Mobiliário', 'Pessoa · nascimento · sexo', 'Direção', 'Leitura', 'Ações'].map(t => <th key={t} style={{ padding: 8, borderBottom: '2px solid #CFE6E0' }}>{t}</th>)}</tr></thead>
            <tbody>{dados.cadastro.itens.map(m => <tr key={m.id}>
              <td style={{ padding: 8 }}>{nomes[m.setor - 1]}</td><td>{m.ambiente}</td><td>{tipos[m.tipo]}{m.descricao && ` · ${m.descricao}`}</td>
              <td>{m.pessoa || 'Não identificada'}<br />{m.nascimento ? m.nascimento.split('-').reverse().join('/') : 'Sem data'} · {m.sexo ?? 'sem parâmetro'}</td>
              <td>{m.direcao === null ? 'Não medida' : `${m.direcao}°`}<br />{m.referencia ?? 'Norte não informado'} · {m.origem === 'planta' ? 'pela planta' : 'manual'}</td>
              <td style={{ maxWidth: 230 }}>{alterada ? 'Aguardando revisão da planta.' : leituraMobiliario(m, dados.planta)}</td>
              <td><button style={botao} disabled={ocupado || !!item} onClick={() => { setItem({ ...m }); setErro(''); setMsg('') }}>Editar {m.descricao || tipos[m.tipo]}</button><button style={botao} disabled={ocupado || !!item} onClick={() => void salvar(dados.cadastro.itens.filter(v => v.id !== m.id))}>Excluir {m.descricao || tipos[m.tipo]}</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!item && <button style={{ ...botao, background: '#245F52', color: '#fff' }} disabled={ocupado || dados.cadastro.itens.length >= MAX_MOBILIARIO} onClick={() => { setItem(novoMobiliario()); setErro(''); setMsg('') }}>Adicionar mobiliário</button>}
        {item && <form aria-label="Cadastro de mobiliário" onSubmit={e => { e.preventDefault(); const existe = dados.cadastro.itens.some(v => v.id === item.id); void salvar(existe ? dados.cadastro.itens.map(v => v.id === item.id ? item : v) : [...dados.cadastro.itens, item]) }} style={{ padding: 18, border: '1px solid #CFE6E0', borderRadius: 10 }}>
          <h2>{dados.cadastro.itens.some(v => v.id === item.id) ? 'Editar móvel' : 'Novo móvel'}</h2>
          <fieldset disabled={ocupado} style={{ border: 0, padding: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 14 }}>
              <label>Quadrante<select style={campo} value={item.setor} onChange={e => alterar({ setor: Number(e.target.value), posicao: null })}>{nomes.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}</select></label>
              <label>Ambiente<input style={campo} required maxLength={100} value={item.ambiente} onChange={e => alterar({ ambiente: e.target.value })} placeholder="Ex.: cozinha, quarto 1" /></label>
              <label>Mobiliário<select style={campo} value={item.tipo} onChange={e => alterar({ tipo: e.target.value as ItemMobiliario['tipo'] })}>{Object.entries(tipos).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
              <label>Identificação / convenção da direção<input style={campo} maxLength={100} value={item.descricao} onChange={e => alterar({ descricao: e.target.value })} placeholder="Ex.: mesa junto à janela, direção do olhar" /></label>
              <label>Pessoa de referência<input style={campo} maxLength={80} value={item.pessoa} onChange={e => alterar({ pessoa: e.target.value })} placeholder="Nome curto ou apelido" /></label>
              <label>Data de nascimento<input style={campo} type="date" value={item.nascimento ?? ''} onChange={e => alterar({ nascimento: e.target.value || null })} /></label>
              <label>Sexo usado na fórmula<select style={campo} value={item.sexo ?? ''} onChange={e => alterar({ sexo: e.target.value as ItemMobiliario['sexo'] || null })}><option value="">Não informado</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option></select></label>
              <label>Direção em graus<input style={campo} type="number" min={0} max={359.99} step="any" value={item.direcao ?? ''} onChange={e => alterar({ direcao: e.target.value === '' ? null : Number(e.target.value), origem: 'manual' })} /></label>
              <label>Referência de Norte<select style={campo} value={item.referencia ?? ''} onChange={e => alterar({ referencia: e.target.value as ItemMobiliario['referencia'] || null, origem: 'manual' })}><option value="">Não informada</option><option value="magnetico">Magnético</option><option value="verdadeiro">Verdadeiro</option></select></label>
            </div>
            <p role="status">{alterada ? 'Revisão da planta pendente.' : leituraMobiliario(item, dados.planta)}</p>
            <button type="button" style={botao} onClick={() => setMostrarPlanta(v => !v)}>{mostrarPlanta ? 'Fechar planta' : 'Posicionar ou medir na planta'}</button>
            {mostrarPlanta && <PlantaMobiliario planta={dados.planta} itens={dados.cadastro.itens} item={item} aoAlterar={alterar} />}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}><button style={{ ...botao, background: '#245F52', color: '#fff' }} type="submit">{ocupado ? 'Salvando…' : 'Salvar móvel'}</button><button style={botao} type="button" onClick={() => { setItem(null); setMostrarPlanta(false); setErro('') }}>Cancelar edição</button></div>
          </fieldset>
        </form>}
      </>}
    </main>
  </FlowLayout>
}
