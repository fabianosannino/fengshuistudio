'use client'

import Link from 'next/link'
import { BookOpen } from 'lucide-react'

/**
 * Primeiro uso do consultor — a tela quando não há nenhum dado ainda.
 *
 * O painel vazio mostrava quatro caixas com mensagens negativas: «Nenhum
 * cliente», «Nenhuma consulta», gráficos sem barras. Quem acabou de criar a
 * conta lia isso como «o produto não tem nada para mim», quando o que faltava
 * era o primeiro passo.
 *
 * Os três passos são a sequência real do método — cadastrar e anexar a planta,
 * medir a fachada, sobrepor o Ba Guá — e só o primeiro tem botão, porque os
 * outros dois dependem dele. Botão em passo que ainda não dá para fazer é
 * convite para um beco.
 */

const PASSOS = [
  {
    numero: 1,
    titulo: 'Cadastre o imóvel e anexe a planta',
    detalhe: 'JPG, PNG ou PDF da planta baixa',
    href: '/consultas/nova',
    acao: 'Começar',
  },
  {
    numero: 2,
    titulo: 'Meça a fachada',
    detalhe: 'Bússola do aparelho ou Luo Pan físico, com a declinação do local',
    href: null,
    acao: null,
  },
  {
    numero: 3,
    titulo: 'Sobreponha o Ba Guá e emita o relatório',
    detalhe: 'Setores, curas e PDF com a sua marca',
    href: null,
    acao: null,
  },
]

export default function PrimeiroUso({ nome }: { nome: string | null }) {
  const primeiroNome = nome?.trim().split(/\s+/)[0] ?? null

  return (
    <div style={{ maxWidth: '760px' }}>
      <p style={{
        color: '#C9A227', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.2em', textTransform: 'uppercase', margin: '0 0 8px',
      }}>Bem-vindo{primeiroNome ? `, ${primeiroNome}` : ''}</p>

      <h1 style={{
        fontFamily: 'var(--font-fraunces), serif', fontSize: '26px', fontWeight: 500,
        margin: '0 0 8px', color: '#0E1B2C', letterSpacing: '-0.01em',
      }}>Seu primeiro diagnóstico em três passos</h1>

      <p style={{ fontSize: '14px', color: '#4A5A67', margin: '0 0 22px', maxWidth: '44em', lineHeight: 1.6 }}>
        Nenhuma consulta ainda. Comece por um imóvel — de preferência o seu, para
        conhecer o fluxo antes de atender.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        {PASSOS.map(passo => {
          const ativo = passo.href !== null
          return (
            <div key={passo.numero} style={{
              background: '#ffffff', border: '1px solid rgba(14,27,44,0.06)', borderRadius: '12px',
              padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px',
              boxShadow: ativo ? '0 10px 28px -20px rgba(14,27,44,0.3)' : 'none',
              opacity: ativo ? 1 : 0.62,
            }}>
              <span style={{
                width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                background: ativo ? '#0E1B2C' : '#F3EEE4',
                color: ativo ? '#C9A227' : '#8A6E2F',
                fontSize: '14px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }} aria-hidden="true">{passo.numero}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0E1B2C' }}>{passo.titulo}</p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#9CA3AF' }}>{passo.detalhe}</p>
              </div>
              {passo.href && (
                <Link href={passo.href} style={{
                  background: '#2E7D6B', color: '#fff', fontSize: '13px', fontWeight: 700,
                  padding: '9px 16px', borderRadius: '8px', textDecoration: 'none', flexShrink: 0,
                }}>{passo.acao}</Link>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        background: '#F3EEE4', border: '1px solid #E7E1D6', borderRadius: '12px',
        padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
      }}>
        <BookOpen size={22} strokeWidth={1.75} color="#2E7D6B" style={{ flexShrink: 0 }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: '200px' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0E1B2C' }}>Prefere ver funcionando antes?</p>
          {/* «Sem afetar seus dados» é literal: a demonstração não grava nada e
              não cria consulta nenhuma na conta — ver app/demonstracao. */}
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280' }}>
            Um diagnóstico completo de exemplo — planta, orientação, setores e curas.
            Nada é gravado na sua conta.
          </p>
        </div>
        <Link href="/demonstracao" style={{
          border: '1px solid #D8D0C0', background: '#fff', color: '#0E1B2C',
          fontSize: '13px', fontWeight: 700, padding: '9px 16px', borderRadius: '8px',
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}>Abrir demonstração</Link>
      </div>
    </div>
  )
}
