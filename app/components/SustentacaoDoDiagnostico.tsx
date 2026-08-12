'use client'

import {
  sustentacaoDoDiagnostico, resumoDaSustentacao, RESSALVA_XUAN_KONG,
  type DadosDoDiagnostico,
} from '../../src/lib/sustentacao-do-diagnostico'
import { CircleCheck, CircleAlert } from 'lucide-react'

/**
 * «O que este diagnóstico já sustenta» — cada campo ausente vira consequência.
 *
 * A regra e os textos estão em `src/lib/sustentacao-do-diagnostico.ts`; aqui só
 * a apresentação. Corpo de 13px: os painéis de método usavam 10–11px, abaixo do
 * mínimo legível que o design system fixa.
 */

export default function SustentacaoDoDiagnostico({
  dados, mostrarRessalva = true,
}: {
  dados: DadosDoDiagnostico
  /** A ressalva só faz sentido onde a carta de Estrelas Voadoras é exibida. */
  mostrarRessalva?: boolean
}) {
  const metodos = sustentacaoDoDiagnostico(dados)
  const temEstrelas = metodos.some(m => m.nome === 'Estrelas Voadoras' && m.disponivel)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#0E1B2C' }}>
          O que este diagnóstico já sustenta
        </h4>
        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{resumoDaSustentacao(metodos)}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {metodos.map(metodo => (
          <div key={metodo.nome} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start' }}>
            {metodo.disponivel
              ? <CircleCheck size={16} strokeWidth={1.75} color="#2E7D6B" style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
              : <CircleAlert size={16} strokeWidth={1.75} color="#8A6E2F" style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />}
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: '13px', color: '#0E1B2C' }}>{metodo.nome}</span>
              {metodo.oQueFalta && (
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#8A6E2F', lineHeight: 1.45 }}>
                  {metodo.oQueFalta}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Caixa, não rodapé de 10px: a ressalva limita o que a carta afirma, e
          uma limitação em corpo ilegível não limita nada. */}
      {mostrarRessalva && temEstrelas && (
        <div style={{
          background: '#FAF3E0', border: '1px solid #EEDFB4', borderRadius: '12px',
          padding: '13px', marginTop: '14px',
        }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#6B5220', lineHeight: 1.55 }}>
            {RESSALVA_XUAN_KONG}
          </p>
        </div>
      )}
    </div>
  )
}
