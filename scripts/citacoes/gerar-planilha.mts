/**
 * Gera `docs/domain/curadoria-dicas.md` a partir do código.
 *
 *     npx vite-node scripts/citacoes/gerar-planilha.mts
 *
 * A planilha é DERIVADA: `constants.ts` dá as dicas, `dicas-classificadas.ts`
 * dá custo/desfazer/mecanismo e `curadoria-evidencia.ts` dá força de evidência
 * e proveniência. Gerar em vez de transcrever é o que impede o documento de
 * divergir do que o app realmente faz — já aconteceu antes (ver a correção de
 * "117 dicas" na ADR 0015).
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SETOR_DICAS, CRITERIO_DICAS } from '../../src/lib/constants'
import {
  SUGESTOES_MECANICAS, DICAS_NAO_ACIONAVEIS,
} from '../../src/lib/dicas-classificadas'
import {
  CURADORIA_EVIDENCIA, DICAS_SEM_FONTE_LOCALIZADA, FONTES_CURADORIA, citarFonte,
} from '../../src/lib/curadoria-evidencia'

const RAIZ = resolve(import.meta.dirname, '../..')

const todas = [...Object.values(SETOR_DICAS).flat(), ...Object.values(CRITERIO_DICAS).flat()]
const unicas = [...new Set(todas)]
const naoAcionaveis = new Set(DICAS_NAO_ACIONAVEIS)
const semFonte = new Set(DICAS_SEM_FONTE_LOCALIZADA)

/** Escapa `|` para não quebrar a tabela markdown. */
const esc = (s: string) => s.replace(/\|/g, '\\|')

function contagem(forca: string): number {
  return Object.values(CURADORIA_EVIDENCIA).filter(e => e.forca === forca).length
}

const L: string[] = []
L.push('# Curadoria das dicas — proveniência por dica')
L.push('')
L.push('> **GERADO** por `scripts/citacoes/gerar-planilha.mts` a partir de')
L.push('> `constants.ts`, `dicas-classificadas.ts` e `curadoria-evidencia.ts`.')
L.push('> Não editar à mão — regenere. Para conferir as citações contra as obras:')
L.push('> `python3 scripts/citacoes/extrair-corpus.py && python3 scripts/citacoes/verificar-citacoes.py`.')
L.push('')
L.push('## Estado')
L.push('')
L.push(`- ${todas.length} dicas no catálogo, **${unicas.length} textos únicos** (as repetidas entre setores duplicados compartilham classificação).`)
L.push(`- ${DICAS_NAO_ACIONAVEIS.length} não é ação, e sim afirmação informativa → nunca vira remédio.`)
L.push(`- **${Object.keys(CURADORIA_EVIDENCIA).length} curadas com fonte nomeada, localizador e citação literal.**`)
L.push(`- **${DICAS_SEM_FONTE_LOCALIZADA.length} sem fonte localizável** no corpus — seguem aparecendo como texto no relatório, sem selo de evidência.`)
L.push('')
L.push('| Força de evidência | Dicas |')
L.push('|---|---|')
for (const f of ['consenso-classico', 'variante-de-escola', 'tradicao-popular']) {
  L.push(`| \`${f}\` | ${contagem(f)} |`)
}
L.push('')
L.push('## O que cada tier significa')
L.push('')
L.push('- `consenso-classico` — âncora explícita num construto clássico nomeado')
L.push('  (ciclo Wu Xing, Ba Guá do Céu Posterior, Sheng/Shar Chi, Escola das Formas)')
L.push('  **e** presente em mais de uma fonte, sem contradição encontrada.')
L.push('- `variante-de-escola` — atribuível a uma convenção de escola, ou as fontes')
L.push('  divergem, ou a fonte sustenta o princípio mas não o detalhe que a dica acrescenta.')
L.push('- `tradicao-popular` — aparece na literatura consultada, sem âncora clássica localizável.')
L.push('')
L.push('> **Limite honesto:** `consenso-classico` aqui é consenso *deste corpus*,')
L.push('> que é majoritariamente literatura introdutória ocidental. Não é verificação')
L.push('> contra fonte primária chinesa — nenhuma obra do corpus é edição crítica de')
L.push('> texto clássico. Ver ADR 0017.')
L.push('')
L.push('## Fontes usadas')
L.push('')
L.push('| Obra | Ano | Tier |')
L.push('|---|---|---|')
for (const f of Object.values(FONTES_CURADORIA)) {
  L.push(`| ${esc(f.autor)}, *${esc(f.titulo)}* | ${f.ano} | \`${f.tier}\` |`)
}
L.push('')

L.push('## Dicas curadas')
L.push('')
L.push('| Dica | Custo | Desfazer | Mecanismo | Evidência | Fonte |')
L.push('|---|---|---|---|---|---|')
for (const d of unicas) {
  const e = CURADORIA_EVIDENCIA[d]
  const m = SUGESTOES_MECANICAS[d]
  if (!e || !m) continue
  const marca = e.contestadaPor ? ' ⚠️' : ''
  L.push(`| ${esc(d)}${marca} | ${m.custo} | ${m.reversibilidade} | ${m.mecanismo} | \`${e.forca}\` | ${esc(citarFonte(e))} |`)
}
L.push('')
L.push('⚠️ = prática **contestada** por outra fonte do corpus. Ver detalhe abaixo.')
L.push('')

const contestadas = Object.entries(CURADORIA_EVIDENCIA).filter(([, e]) => e.contestadaPor)
L.push('## Práticas contestadas')
L.push('')
L.push('Achadas na pesquisa: uma obra recomenda, outra desaconselha. O app agora leva')
L.push('a contestação para `Remedio.contraindicacoes`, então o consultor vê o conflito')
L.push('junto com a recomendação. São candidatas a sair de `constants.ts`.')
L.push('')
for (const [d, e] of contestadas) {
  L.push(`### ${d}`)
  L.push('')
  L.push(`- **Aparece em** ${citarFonte(e)}: “${e.citacao}”`)
  L.push(`- **Contestada por** ${citarFonte(e.contestadaPor!)}: “${e.contestadaPor!.citacao}”`)
  if (e.nota) L.push(`- **Nota:** ${e.nota}`)
  L.push('')
}

const comContra = Object.entries(CURADORIA_EVIDENCIA).filter(([, e]) => e.contraindicacao)
L.push('## Contraindicações documentadas')
L.push('')
L.push(`${comContra.length} dicas têm ressalva achada na mesma leitura que sustentou a`)
L.push('classificação. Antes desta curadoria o app não mostrava nenhuma delas.')
L.push('')
for (const [d, e] of comContra) {
  L.push(`- **${d}** — ${e.contraindicacao}`)
}
L.push('')

const comNota = Object.entries(CURADORIA_EVIDENCIA).filter(([, e]) => e.nota && !e.contestadaPor)
L.push('## Onde a dica vai além da fonte')
L.push('')
L.push('Números inventados, cores que não fecham com o ciclo, setor divergente. Fica')
L.push('registrado em vez de sumir — cada um destes é uma decisão de produto pendente.')
L.push('')
for (const [d, e] of comNota) {
  L.push(`- **${d}** — ${e.nota}`)
}
L.push('')

L.push('## Sem fonte localizável no corpus')
L.push('')
L.push('Buscadas por termo no corpus inteiro e **não encontradas**. Não viram `Remedio`.')
L.push('Se você tiver a fonte, acrescente a entrada em `curadoria-evidencia.ts`.')
L.push('')
for (const d of DICAS_SEM_FONTE_LOCALIZADA) L.push(`- ${d}`)
L.push('')

L.push('## Não acionável')
L.push('')
for (const d of DICAS_NAO_ACIONAVEIS) {
  L.push(`- **${d}** — afirmação informativa, não recomendação. Aparece ao consultor`)
  L.push('  como se fosse conselho; talvez devesse sair de `SETOR_DICAS`.')
}
L.push('')

// Guarda: a planilha não pode "perder" dica nenhuma sem avisar.
const cobertas = unicas.filter(d => CURADORIA_EVIDENCIA[d] || semFonte.has(d) || naoAcionaveis.has(d))
if (cobertas.length !== unicas.length) {
  const faltando = unicas.filter(d => !cobertas.includes(d))
  throw new Error(`Dicas fora de todas as listas:\n${faltando.join('\n')}`)
}

writeFileSync(resolve(RAIZ, 'docs/domain/curadoria-dicas.md'), L.join('\n'), 'utf8')
console.log(`docs/domain/curadoria-dicas.md: ${L.length} linhas, ${Object.keys(CURADORIA_EVIDENCIA).length} dicas curadas`)
