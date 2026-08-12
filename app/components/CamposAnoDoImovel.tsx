'use client'

import {
  periodoDoImovel, reformaIncoerente, faixaDoPeriodo,
  ANO_MINIMO_CONSTRUCAO, ANO_MAXIMO_CONSTRUCAO,
} from '../../src/lib/periodo-do-imovel'

/**
 * Ano de construção e ano da última reforma estrutural — os dois dados de que
 * o período (Yun 運) da carta natal de Estrelas Voadoras depende.
 *
 * Ano, e não data: ver o cabeçalho de `src/lib/periodo-do-imovel.ts`. O campo
 * anterior era um `<input type="date">` que obrigava a inventar dia e mês, e o
 * dia inventado mudava o período.
 *
 * O período aparece aqui, ao lado dos campos, porque é a única forma de o
 * consultor conferir que o número saiu do que ele digitou.
 */

interface Props {
  anoConstrucao: string
  anoReformaEstrutural: string
  onChange: (campo: 'ano_construcao' | 'ano_reforma_estrutural', valor: string) => void
  /** Estilo do input, para casar com o formulário que hospeda os campos. */
  estiloInput?: React.CSSProperties
}

const ESTILO_PADRAO: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB',
  borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
}

const ESTILO_LABEL: React.CSSProperties = {
  display: 'block', color: '#374151', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px',
}

function paraNumero(valor: string): number | null {
  const n = Number(valor)
  return valor.trim() !== '' && Number.isInteger(n) ? n : null
}

export default function CamposAnoDoImovel({
  anoConstrucao, anoReformaEstrutural, onChange, estiloInput,
}: Props) {
  const estilo = { ...ESTILO_PADRAO, ...estiloInput }

  const dados = {
    anoConstrucao: paraNumero(anoConstrucao),
    anoReformaEstrutural: paraNumero(anoReformaEstrutural),
  }
  const periodo = periodoDoImovel(dados)
  const incoerente = reformaIncoerente(dados)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <label htmlFor="input-ano-construcao" style={ESTILO_LABEL}>Ano de construção</label>
          <input id="input-ano-construcao" type="number" inputMode="numeric"
            min={ANO_MINIMO_CONSTRUCAO} max={ANO_MAXIMO_CONSTRUCAO}
            value={anoConstrucao} onChange={e => onChange('ano_construcao', e.target.value)}
            placeholder="Ex: 1998" style={estilo} />
        </div>
        <div>
          <label htmlFor="input-ano-reforma" style={ESTILO_LABEL}>Ano da última reforma estrutural</label>
          <input id="input-ano-reforma" type="number" inputMode="numeric"
            min={ANO_MINIMO_CONSTRUCAO} max={ANO_MAXIMO_CONSTRUCAO}
            value={anoReformaEstrutural} onChange={e => onChange('ano_reforma_estrutural', e.target.value)}
            placeholder="Ex: 2015" style={estilo} />
          <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '4px 0 0 0' }}>
            Telhado, paredes estruturais ou fachada — o que muda a carta. Pintura e
            troca de piso não contam.
          </p>
        </div>
      </div>

      {incoerente && (
        <p style={{
          fontSize: '12px', color: '#B4533A', background: '#FEF2F2',
          border: '1px solid #FECACA', borderRadius: '8px',
          padding: '8px 12px', margin: '10px 0 0 0',
        }}>
          A reforma está anterior à construção. Os campos podem ter sido trocados —
          enquanto isso, o período segue o ano de construção.
        </p>
      )}

      {periodo && (
        <div style={{
          fontSize: '12px', color: '#2E7D6B', background: '#EAF4F1',
          border: '1px solid #DCEFE9', borderRadius: '8px',
          padding: '8px 12px', margin: '10px 0 0 0',
        }}>
          <strong>Período {periodo.periodo}</strong>
          {' '}({faixaDoPeriodo(periodo.anoUsado).inicio}–{faixaDoPeriodo(periodo.anoUsado).fim})
          {periodo.daReforma ? ', pela reforma estrutural' : ', pela construção'} de {periodo.anoUsado}.
          {/* A virada do período cai no Li Chun, não em 1º de janeiro. O ano
              sozinho não distingue os dois casos — e escolher um em silêncio é
              o que o campo de data fazia. */}
          {periodo.ambiguo && (
            <span style={{ display: 'block', marginTop: '6px', color: '#92400E' }}>
              {periodo.anoUsado} é ano de virada: se a obra foi concluída antes de
              4 de fevereiro, o período é {periodo.periodoAnterior}. Confirme o mês
              antes de usar a carta.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
