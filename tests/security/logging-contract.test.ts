// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

it('mensagens de log do produto são literais; console bruto passa pelo logger', () => {
  const falhas: string[] = []
  function visitarDiretorio(dir: string) {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      if (entrada.name === '__tests__') continue
      const caminho = join(dir, entrada.name)
      if (entrada.isDirectory()) { visitarDiretorio(caminho); continue }
      if (!/\.tsx?$/.test(caminho)) continue
      const source = ts.createSourceFile(caminho, readFileSync(caminho, 'utf8'), ts.ScriptTarget.Latest, true)
      function visitar(no: ts.Node) {
        if (ts.isCallExpression(no)) {
          const chamada = no.expression.getText(source)
          const mensagem = no.arguments[0]
          if (/^logger\.(error|warn|info)$/.test(chamada) && (!mensagem || (!ts.isStringLiteral(mensagem) && !ts.isNoSubstitutionTemplateLiteral(mensagem)))) falhas.push(`${caminho}: mensagem dinâmica`)
          if (/^console\.(log|warn|error)$/.test(chamada) && caminho !== join('src', 'lib', 'logger.ts')) falhas.push(`${caminho}: console sem filtro`)
        }
        ts.forEachChild(no, visitar)
      }
      visitar(source)
    }
  }
  visitarDiretorio('app')
  visitarDiretorio(join('src', 'lib'))
  expect(falhas).toEqual([])
})
