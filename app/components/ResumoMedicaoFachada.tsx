import {
  lerMedicaoFachada,
  resumirMedicaoFachada,
} from '../../src/lib/medicao-fachada'
import { rotuloReferencia } from '../../src/lib/declinacao-magnetica'

export default function ResumoMedicaoFachada({
  valor,
  origem,
}: {
  valor: unknown
  origem?: string
}) {
  const medicao = lerMedicaoFachada(valor)
  if (!medicao)
    return origem === 'tres_leituras' ? (
      <p>
        Leituras originais não disponíveis neste registro. A média antiga foi
        preservada; use o assistente para registrar uma nova medição.
      </p>
    ) : null
  const { original, atual, referencia } = resumirMedicaoFachada(medicao)
  return (
    <div aria-label="Registro das medições de fachada">
      <p>
        Registro da medição:{' '}
        {new Date(medicao.registrada_em).toLocaleString('pt-BR')}.
      </p>
      <p>
        Leituras originais: {medicao.leituras.map((n) => `${n}°`).join(' · ')}{' '}
        em Norte {rotuloReferencia(medicao.referencia)}. Média circular
        original: {original.media.toFixed(2)}°.
      </p>
      {medicao.conversao && (
        <p>
          Conversão aplicada: declinação {medicao.conversao.declinacao}°;
          direção resultante {atual.aplicada.toFixed(1)}° em Norte{' '}
          {rotuloReferencia(referencia)}. Os valores originais foram
          preservados.
        </p>
      )}
      <p>
        Dispersão máxima em relação à média: {original.dispersao.toFixed(2)}°.
        Isso descreve a variação entre as três leituras; não mede a precisão do
        instrumento nem elimina interferência magnética.
      </p>
      {atual.repetir && (
        <p>
          Dispersão acima de 3°: repita as medições e verifique possíveis
          interferências antes de confirmar a fachada.
        </p>
      )}
      {atual.mudaSetor && (
        <p>
          As leituras abrangem mais de um setor de 45°. A escolha da fachada
          pode mudar o resultado de Oito Mansões; revise a medição.
        </p>
      )}
      {atual.mudaMontanha && (
        <p>
          As leituras abrangem mais de uma das 24 Montanhas (faixas de 15°).
          Revise a fachada antes de interpretar métodos que dependem dessa
          divisão.
        </p>
      )}
      {atual.arredondamentoMudaFaixa && (
        <p>
          O arredondamento para uma casa decimal muda a faixa de direção.
          Confira o valor adotado antes de confirmar.
        </p>
      )}
    </div>
  )
}
