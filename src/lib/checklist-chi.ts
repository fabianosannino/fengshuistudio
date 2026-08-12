/**
 * Os onze pontos do checklist de Fluxo de Chi.
 *
 * A lista vivia copiada em três lugares: `TabFluxoChi.tsx` (rótulos completos),
 * `relatorio/page.tsx` (rótulos abreviados, `CHI_ITEMS`) e, agora, a vistoria.
 * Os `id` batiam por sorte — e é o `id` que liga o estado gravado ao ponto, de
 * modo que uma divergência silenciosa faria o relatório mostrar «não
 * verificado» num item que o consultor marcou.
 *
 * Os rótulos continuam sendo dois: o longo é o do levantamento, com o critério
 * inteiro; o curto é o do relatório, onde a coluna é estreita e o cliente não
 * precisa do parêntese. Mesmo ponto, mesma chave, duas escritas.
 */

export type CategoriaChi = 'entrada' | 'circulacao' | 'estrutura' | 'elementos'

export interface ItemDoChecklistChi {
  id: string
  /** Rótulo do levantamento — o critério inteiro. */
  label: string
  /** Rótulo do relatório — mesmo ponto, mais curto. */
  labelCurto: string
  categoria: CategoriaChi
}

export const CHECKLIST_CHI: ItemDoChecklistChi[] = [
  { id: 'porta_abre', categoria: 'entrada',
    label: 'Porta principal abre completamente (sem obstruções)',
    labelCurto: 'Porta principal abre completamente' },
  { id: 'entrada_livre', categoria: 'entrada',
    label: 'Entrada livre e acolhedora (sem objetos acumulados)',
    labelCurto: 'Entrada livre e acolhedora' },
  { id: 'sem_corredor_longo', categoria: 'circulacao',
    label: 'Não há corredores longos e estreitos sem tratamento',
    labelCurto: 'Sem corredores longos e estreitos' },
  { id: 'sem_portas_alinhadas', categoria: 'circulacao',
    label: 'Não há portas alinhadas diretamente (porta-a-porta)',
    labelCurto: 'Sem portas alinhadas (porta-a-porta)' },
  { id: 'sem_escada_porta', categoria: 'circulacao',
    label: 'Não há escada diretamente voltada para a porta principal',
    labelCurto: 'Sem escada frente à porta principal' },
  { id: 'banheiro_fora_centro', categoria: 'estrutura',
    label: 'Banheiro não está localizado no centro da casa',
    labelCurto: 'Banheiro fora do centro da casa' },
  { id: 'sem_vigas_expostas', categoria: 'estrutura',
    label: 'Não há vigas expostas sobre cama, sofá ou mesa de trabalho',
    labelCurto: 'Sem vigas expostas sobre áreas de estar' },
  { id: 'espelhos_ok', categoria: 'elementos',
    label: 'Espelhos não refletem diretamente a porta de entrada',
    labelCurto: 'Espelhos não refletem a porta de entrada' },
  { id: 'sem_cantos_agressivos', categoria: 'elementos',
    label: 'Não há cantos/quinas apontados para áreas de estar ou descanso',
    labelCurto: 'Sem cantos agressivos para áreas de estar' },
  { id: 'fluxo_suave', categoria: 'circulacao',
    label: 'Fluxo de circulação suave entre cômodos (sem bloqueios)',
    labelCurto: 'Fluxo de circulação suave' },
  { id: 'luz_natural', categoria: 'elementos',
    label: 'Iluminação natural adequada nos principais ambientes',
    labelCurto: 'Iluminação natural adequada' },
]

export const CATEGORIAS_CHI: Record<CategoriaChi, { label: string; cor: string }> = {
  entrada: { label: 'Entrada / Boca do Chi', cor: '#2E7D6B' },
  circulacao: { label: 'Circulação', cor: '#245F52' },
  estrutura: { label: 'Estrutura', cor: '#8A6E2F' },
  elementos: { label: 'Elementos', cor: '#A9613C' },
}

/** Só os ids — o que `resumirChi` e `itensComProblema` pedem. */
export const IDS_DO_CHECKLIST_CHI = CHECKLIST_CHI.map(i => i.id)
