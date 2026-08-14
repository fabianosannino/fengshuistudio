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
import { Upload, Package, Eye, EyeOff } from 'lucide-react'

interface ProdutoAdmin {
  id: string
  tipo: string
  nome: string
  descricao: string | null
  preco_centavos: number
  ativo: boolean
  arquivo_nome: string | null
  arquivo_bytes: number | null
}

const ROTA = '/api/admin/produtos'

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
  const [salvando, setSalvando] = useState(false)

  const [enviandoDe, setEnviandoDe] = useState<string | null>(null)
  const inputsDeArquivo = useRef<Record<string, HTMLInputElement | null>>({})

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
      body: JSON.stringify({ nome, descricao, preco_centavos: centavos }),
    })
    const dados = await res.json().catch(() => ({}))
    setSalvando(false)

    if (!res.ok) { setAviso(dados.error ?? 'Não foi possível cadastrar.'); return }

    setNome(''); setDescricao(''); setPreco('')
    setAviso('Produto cadastrado. Envie o arquivo para poder publicá-lo.')
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
            placeholder="Preço em reais (ex.: 29,90)"
          />
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
              <div>
                <strong style={{ color: '#0E1B2C', fontSize: '15px' }}>{produto.nome}</strong>
                <p style={{ color: '#6B7280', fontSize: '13px', margin: '4px 0 0' }}>
                  {formatarMoeda(produto.preco_centavos / 100)}
                  {produto.arquivo_nome
                    ? ` · ${produto.arquivo_nome} ${tamanho(produto.arquivo_bytes)}`
                    : ' · sem arquivo'}
                </p>
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
          </div>
        ))}
      </div>
    </AppShell>
  )
}
