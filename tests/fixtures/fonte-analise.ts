import type { FonteRelatorio } from '../../src/lib/relatorio-emissao'
import { referenciaDaAnalise } from '../../src/lib/analise-bagua'
import type { BaguaEntrada } from '../../src/lib/types'
export const idAnaliseTeste = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export function fonteAnaliseTeste(escola = 'btb'): FonteRelatorio {
  const b: BaguaEntrada = {
    escola,
    lado: 'centro',
    bordas: { x: 100, y: 100, w: 600, h: 600 },
    geometria_regra: 'saldo-v2',
    finalizada_em: '2026-09-18T12:00:00.000Z',
    marcacoes: [{ id: 'falta', tipo: 'falta', x: 100, y: 100, w: 100, h: 100 }],
    orientacao_graus: 180,
    orientacao_estado: 'confirmada',
    orientacao_referencia: 'magnetico',
    orientacao_origem: 'manual',
    orientacao_confirmada_em: '2026-09-18T12:00:00.000Z',
  }
  b.analise_referencia = referenciaDaAnalise(b)
  return {
    consulta: {
      id: idAnaliseTeste(1),
      consultor_id: idAnaliseTeste(1),
      cliente_id: idAnaliseTeste(2),
      nome_imovel: 'Planta sintética',
      bagua_entrada: b,
      ano_construcao: 2025,
      clientes: { data_nascimento: '1990-06-01', genero: 'masculino' },
    },
    perfil: { id: idAnaliseTeste(1), plano: 'pro', nome_completo: 'Sintético' },
    setores: Array.from({ length: 9 }, (_, i) => ({
      id: idAnaliseTeste(i + 10),
      consulta_id: idAnaliseTeste(1),
      numero: i + 1,
      nome: `Setor ${i + 1}`,
      score_percentual: i === 0 ? null : 80,
      diagnostico_criterios: [],
    })),
    evolucao: [],
    chi_custom: [],
  } as unknown as FonteRelatorio
}
