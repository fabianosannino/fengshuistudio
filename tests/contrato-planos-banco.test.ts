import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { REGRAS_DE_PLANO, VERSAO_DIREITOS_PLANOS } from '../src/lib/plano-utils'

describe('projeção de direitos no banco', () => {
  const sql = readFileSync('supabase/migrations/20260918041545_atomic_plan_quotas.sql', 'utf8')
  for (const [plano, direitos] of Object.entries(REGRAS_DE_PLANO)) {
    it(`${plano}: não diverge do contrato público de telas e APIs`, () => {
      const json = sql.match(new RegExp(`\\('${plano}', '([^']+)'::jsonb\\)`))?.[1]
      expect(json).toBeDefined()
      expect(JSON.parse(json!)).toEqual({ ...direitos, versao: VERSAO_DIREITOS_PLANOS })
    })
  }
})
