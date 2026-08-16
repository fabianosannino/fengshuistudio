/**
 * Catálogo próprio da plataforma — cadastro, arquivo e publicação.
 *
 * A tela é deliberadamente sequencial: cadastra, envia o arquivo, publica.
 * Não é fluxo bonito por acaso — é a única ordem que o banco aceita, porque
 * digital ativo sem arquivo é recusado por constraint. Espelhar a regra aqui
 * evita que o admin descubra a ordem por tentativa e erro.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '../../components/AppShell'
import { logger } from '../../../src/lib/logger'
import { formatarMoeda } from '../../../src/lib/formato'
import { Upload, Package, Eye, EyeOff, Pencil, Image as ImageIcon } from 'lucide-react'
import EditarProduto, { SeloDaPromocao } from './EditarProduto'
import { precoVigente } from '../../../src/lib/promocao-do-produto'
import { urlPublicaDaImagem } from '../../../src/lib/produtos-da-plataforma'

interface ProdutoAdmin {
  id: string
  tipo: string
  modo_de_venda: 'marketplace' | 'indicacao'
  nome: string
  descricao: string | null
  preco_centavos: number
  ativo: boolean
  arquivo_nome: string | null
  arquivo_bytes: number | null
  link_externo: string | null
  parceiro: string | null
  imagem_path: string | null
  promocao_preco_centavos: number | null
  promocao_inicio: string | null
  promocao_fim: string | null
  cliques: number
}

const ROTA = '/api/admin/produtos'

/**
 * A miniatura do cartão, ou o quadro vazio.
 *
 * O quadro vazio existe para que a lista não mude de forma conforme o produto
 * tenha foto ou não — e para que «este não tem imagem» seja visível de relance,
 * que é o motivo de a coluna existir.
 */
function Miniatura({ url }: { url: string | null }) {
  const moldura = {
    width: '64px', height: '64px', borderRadius: '8px', flexShrink: 0,
    border: '1px solid #F3F4F6', overflow: 'hidden' as const,
  }

  if (!url) {
    return (
      <div style={{
        ...moldura, background: '#F9FAFB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} aria-hidden="true">
        <ImageIcon size={20} color="#D1D5DB" />
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element -- bucket externo; `next/image` exigiria configurar o domínio remoto e não ganha nada numa miniatura de 64px
  return <img src={url} alt="" style={{ ...moldura, objectFit: 'cover', display: 'block' }} />
}

function tamanho(bytes: number | null): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function AdminProdutos() {
  const [produtos, setProdutos] = useState<ProdutoAdmin[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')

  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [preco, setPreco] = useState('')
  const [indicacao, setIndicacao] = useState(false)
  const [linkExterno, setLinkExterno] = useState('')
  const [parceiro, setParceiro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [enviandoDe, setEnviandoDe] = useState<string | null>(null)
  const [enviandoFotoDe, setEnviandoFotoDe] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const inputsDeArquivo = useRef<Record<string, HTMLInputElement | null>>({})
  const inputsDeFoto = useRef<Record<string, HTMLInputElement | null>>({})

  /*
   * O instante da renderização, congelado.
   *
   * Chamar `new Date()` dentro do map faria cada cartão perguntar a hora por
   * conta própria — e uma campanha que fechasse no meio da lista apareceria
   * «rodando» acima e «encerrada» abaixo, na mesma tela.
   */
  const agora = new Date()

  const carregar = useCallback(async () => {
    const res = await fetch(ROTA)
    const dados = await res.json().catch(() => ({}))
    if (!res.ok) {
      setErro(dados.error ?? 'Não foi possível carregar o catálogo.')
    } else {
      setProdutos(dados.produtos ?? [])
      setErro('')
    }
    setCarregando(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  async function cadastrar() {
    // O preço é digitado em reais e convertido aqui; o servidor recebe e
    // valida centavos. Aceitar «19,90» e «19.90» é o mínimo em pt-BR.
    const centavos = Math.round(Number(preco.replace(',', '.')) * 100)
    if (!Number.isFinite(centavos) || centavos <= 0) {
      setAviso('Informe um preço válido.')
      return
    }

    setSalvando(true)
    setAviso('')
    const res = await fetch(ROTA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome, descricao, preco_centavos: centavos,
        // Indicação é produto de terceiro por definição: o banco recusa a
        // combinação contrária, e mandar o tipo certo daqui evita que o admin
        // descubra isso por mensagem de erro.
        ...(indicacao
          ? { tipo: 'bem_de_terceiro', modo_de_venda: 'indicacao', link_externo: linkExterno, parceiro }
          : {}),
      }),
    })
    const dados = await res.json().catch(() => ({}))
    setSalvando(false)

    if (!res.ok) { setAviso(dados.error ?? 'Não foi possível cadastrar.'); return }

    setNome(''); setDescricao(''); setPreco(''); setLinkExterno(''); setParceiro('')
    setAviso(indicacao
      ? 'Indicação cadastrada. Publique para ela aparecer na loja.'
      : 'Produto cadastrado. Envie o arquivo para poder publicá-lo.')
    await carregar()
  }

  async function enviarArquivo(produtoId: string, arquivo: File) {
    setEnviandoDe(produtoId)
    setAviso('')

    const form = new FormData()
    form.append('produto_id', produtoId)
    form.append('arquivo', arquivo)

    try {
      const res = await fetch(`${ROTA}/arquivo`, { method: 'POST', body: form })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) { setAviso(dados.error ?? 'Não foi possível enviar o arquivo.'); return }
      setAviso('Arquivo enviado.')
      await carregar()
    } catch (err) {
      logger.error('Falha no envio do arquivo do produto', { error: String(err) })
      setAviso('Não foi possível enviar o arquivo.')
    } finally {
      setEnviandoDe(null)
    }
  }

  async function enviarFoto(produtoId: string, imagem: File) {
    setEnviandoFotoDe(produtoId)
    setAviso('')

    const form = new FormData()
    form.append('produto_id', produtoId)
    form.append('imagem', imagem)

    try {
      const res = await fetch(`${ROTA}/imagem`, { method: 'POST', body: form })
      const dados = await res.json().catch(() => ({}))
      if (!res.ok) { setAviso(dados.error ?? 'Não foi possível enviar a imagem.'); return }
      setAviso('Imagem atualizada.')
      await carregar()
    } catch (err) {
      logger.error('Falha no envio da imagem do produto', { error: String(err) })
      setAviso('Não foi possível enviar a imagem.')
    } finally {
      setEnviandoFotoDe(null)
    }
  }

  async function alternarPublicacao(produto: ProdutoAdmin) {
    setAviso('')
    const res = await fetch(ROTA, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: produto.id, ativo: !produto.ativo }),
    })
    const dados = await res.json().catch(() => ({}))
    if (!res.ok) { setAviso(dados.error ?? 'Não foi possível alterar.'); return }
    await carregar()
  }

  const cartao = {
    background: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '16px',
  }
  const campo = {
    width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB',
    borderRadius: '8px', fontSize: '14px', marginBottom: '10px',
    fontFamily: 'inherit',
  }

  return (
    <AppShell currentPage="admin/produtos">
      <div style={{ maxWidth: '820px' }}>
        <h1 style={{ color: '#0E1B2C', fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px' }}>
          Produtos do FengShui Studio
        </h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 20px' }}>
          Vendidos pela plataforma, com entrega por download. A cobrança é na
          nossa conta e não há comissão de intermediação.
        </p>

        {aviso && (
          <p style={{ background: '#FAF3E0', color: '#8A6E2F', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>
            {aviso}
          </p>
        )}
        {erro && (
          <p style={{ background: '#FDECEC', color: '#A33A3A', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>
            {erro}
          </p>
        )}

        <div style={cartao}>
          <h2 style={{ color: '#0E1B2C', fontSize: '16px', fontWeight: 'bold', margin: '0 0 12px' }}>
            Novo produto
          </h2>
          <input
            style={campo} value={nome} maxLength={120}
            onChange={e => setNome(e.target.value)}
            placeholder="Nome (ex.: Guia do Ba Guá em PDF)"
          />
          <textarea
            style={{ ...campo, minHeight: '70px', resize: 'vertical' as const }}
            value={descricao} maxLength={600}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Descrição curta — aparece na loja e no checkout"
          />
          <input
            style={{ ...campo, maxWidth: '200px' }} value={preco} inputMode="decimal"
            onChange={e => setPreco(e.target.value)}
            placeholder={indicacao ? 'Preço de referência (ex.: 29,90)' : 'Preço em reais (ex.: 29,90)'}
          />

          {/* Indicação muda quem vende, quem entrega e quem responde — por isso
              é uma escolha explícita no cadastro, não uma consequência de ter
              preenchido um link. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 12px', fontSize: '14px', color: '#374151' }}>
            <input type="checkbox" checked={indicacao}
              onChange={e => setIndicacao(e.target.checked)} />
            Indicação — quem vende é um parceiro, e a compra acontece no site dele
          </label>

          {indicacao && (
            <>
              <input
                style={campo} value={parceiro} maxLength={120}
                onChange={e => setParceiro(e.target.value)}
                placeholder="Nome do parceiro — aparece como «Vendido por» na loja"
              />
              <input
                style={campo} value={linkExterno} maxLength={500}
                onChange={e => setLinkExterno(e.target.value)}
                placeholder="https://loja-do-parceiro.com.br/produto"
              />
              <p style={{ color: '#8A6E2F', fontSize: '12px', margin: '0 0 12px', lineHeight: 1.5 }}>
                O preço aqui é <strong>referência</strong>: quem cobra é o parceiro,
                e o valor pode mudar lá. O clique é contado para apurar a comissão.
              </p>
            </>
          )}

          <button type="button" disabled={salvando || !nome.trim()} onClick={cadastrar} style={{
            padding: '10px 20px', background: '#0E1B2C', color: '#fff', border: 'none',
            borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
            cursor: salvando || !nome.trim() ? 'default' : 'pointer',
            opacity: salvando || !nome.trim() ? 0.6 : 1,
          }}>{salvando ? 'Salvando…' : 'Cadastrar'}</button>
        </div>

        {carregando ? (
          <p style={{ color: '#6B7280', fontSize: '14px' }}>Carregando…</p>
        ) : produtos.length === 0 ? (
          <div style={{ ...cartao, textAlign: 'center' as const, color: '#6B7280' }}>
            <Package size={28} color="#9CA3AF" />
            <p style={{ fontSize: '14px', margin: '10px 0 0' }}>Nenhum produto cadastrado ainda.</p>
          </div>
        ) : produtos.map(produto => (
          <div key={produto.id} style={cartao}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <Miniatura url={urlPublicaDaImagem(produto.imagem_path)} />
              <div>
                <strong style={{ color: '#0E1B2C', fontSize: '15px' }}>{produto.nome}</strong>
                <div style={{ margin: '5px 0 0' }}>
                  <SeloDaPromocao produto={produto} agora={agora} />
                </div>
                <p style={{ color: '#6B7280', fontSize: '13px', margin: '4px 0 0' }}>
                  {/* O preço vigente, não o cheio: é este que o comprador paga
                      agora, e a lista existe para mostrar o estado real. */}
                  {formatarMoeda(precoVigente(produto, agora).centavos / 100)}
                  {produto.modo_de_venda === 'indicacao'
                    ? ` · ${produto.parceiro ?? 'parceiro'} · ${produto.cliques} clique${produto.cliques === 1 ? '' : 's'}`
                    : produto.arquivo_nome
                      ? ` · ${produto.arquivo_nome} ${tamanho(produto.arquivo_bytes)}`
                      : ' · sem arquivo'}
                </p>
                {produto.modo_de_venda === 'indicacao' && produto.link_externo && (
                  <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '2px 0 0', wordBreak: 'break-all' }}>
                    {produto.link_externo}
                  </p>
                )}
              </div>
              </div>
              <span style={{
                padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                background: produto.ativo ? '#F0F6F3' : '#F3F4F6',
                color: produto.ativo ? '#2E7D6B' : '#6B7280',
                alignSelf: 'flex-start',
              }}>{produto.ativo ? 'Publicado' : 'Rascunho'}</span>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
              <input
                type="file" hidden
                accept=".pdf,.epub,.zip,.mp3,.mp4"
                ref={el => { inputsDeArquivo.current[produto.id] = el }}
                onChange={e => {
                  const arquivo = e.target.files?.[0]
                  if (arquivo) enviarArquivo(produto.id, arquivo)
                  e.target.value = ''
                }}
              />
              {/* Indicação não tem arquivo para entregar: quem entrega é o
                  parceiro. Mostrar o botão sugeriria uma obrigação nossa. */}
              {produto.modo_de_venda !== 'indicacao' && (
              <button type="button" onClick={() => inputsDeArquivo.current[produto.id]?.click()}
                disabled={enviandoDe === produto.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', background: '#fff', color: '#0E1B2C',
                  border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px',
                  cursor: enviandoDe === produto.id ? 'default' : 'pointer',
                }}>
                <Upload size={15} />
                {enviandoDe === produto.id
                  ? 'Enviando…'
                  : produto.arquivo_nome ? 'Substituir arquivo' : 'Enviar arquivo'}
              </button>
              )}

              <input
                type="file" hidden accept="image/jpeg,image/png,image/webp"
                ref={el => { inputsDeFoto.current[produto.id] = el }}
                onChange={e => {
                  const imagem = e.target.files?.[0]
                  if (imagem) enviarFoto(produto.id, imagem)
                  e.target.value = ''
                }}
              />
              <button type="button" onClick={() => inputsDeFoto.current[produto.id]?.click()}
                disabled={enviandoFotoDe === produto.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', background: '#fff', color: '#0E1B2C',
                  border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px',
                  cursor: enviandoFotoDe === produto.id ? 'default' : 'pointer',
                }}>
                <ImageIcon size={15} />
                {enviandoFotoDe === produto.id
                  ? 'Enviando…'
                  : produto.imagem_path ? 'Trocar foto' : 'Adicionar foto'}
              </button>

              <button type="button"
                onClick={() => setEditando(editando === produto.id ? null : produto.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', background: '#fff', color: '#0E1B2C',
                  border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px',
                  cursor: 'pointer',
                }}>
                <Pencil size={15} />
                {editando === produto.id ? 'Fechar' : 'Editar'}
              </button>

              <button type="button" onClick={() => alternarPublicacao(produto)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', background: produto.ativo ? '#fff' : '#2E7D6B',
                color: produto.ativo ? '#0E1B2C' : '#fff',
                border: produto.ativo ? '1px solid #E5E7EB' : 'none',
                borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
              }}>
                {produto.ativo ? <EyeOff size={15} /> : <Eye size={15} />}
                {produto.ativo ? 'Despublicar' : 'Publicar'}
              </button>
            </div>

            {editando === produto.id && (
              <EditarProduto
                produto={produto}
                onSalvo={carregar}
                onFechar={() => setEditando(null)}
                onErro={setAviso}
              />
            )}
          </div>
        ))}
      </div>
    </AppShell>
  )
}
