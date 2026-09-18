/** Varredura local, sem rede; nunca imprimir o conteúdo dos achados. */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
assert.equal(git('rev-parse', '--is-shallow-repository'), 'false', 'O scanner exige o histórico completo: fetch-depth: 0')
const gitDirectory = git('rev-parse', '--path-format=absolute', '--git-common-dir')
const image = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f'
const dockerArgs = [
  'run', '--rm', '-i', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
  '--security-opt', 'no-new-privileges', '--pids-limit', '64', '--memory', '512m', '--cpus', '2',
  '--mount', `type=bind,source=${root},target=/repo,readonly`,
  // O gitdir separado atende tanto checkout normal quanto worktree no Windows.
  '--mount', `type=bind,source=${gitDirectory},target=/git,readonly`,
  '-e', 'GIT_DIR=/git', '-e', 'GIT_WORK_TREE=/repo',
  '-e', 'GIT_CONFIG_COUNT=1', '-e', 'GIT_CONFIG_KEY_0=safe.directory', '-e', 'GIT_CONFIG_VALUE_0=/repo',
  image,
]
const options = [
  '--config', '/repo/.gitleaks.toml', '--gitleaks-ignore-path', '/repo/.gitleaksignore',
  '--ignore-gitleaks-allow', '--redact=100', '--no-banner', '--no-color', '--log-level', 'error',
  '--report-format', 'json', '--report-path', '-', '--timeout', '300',
]
function scan(command, input) {
  const result = spawnSync('docker', [...dockerArgs, ...command, ...options], {
    encoding: 'utf8', input, timeout: 330_000, maxBuffer: 16 * 1024 * 1024,
  })
  // Nem stdout nem stderr bruto entra em logs: podem conter dados do repositório.
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw new Error(`Scanner indisponível (saída ${result.status ?? 'ausente'}). Verifique Docker/imagem/limites; não liberar o gate.`)
  }
  let findings
  try { findings = JSON.parse(result.stdout) } catch { throw new Error('Relatório do scanner inválido; não liberar o gate.') }
  assert.ok(Array.isArray(findings), 'Relatório deve ser uma lista')
  return { status: result.status, findings, redacted: !input || !result.stdout.includes(input.trim().split('=')[1].trim()) }
}

// Controle positivo sintético em memória: nunca é uma credencial nem um commit.
// Prova que as mesmas regras/exceções ainda detectam um valor novo e o ocultam.
const canary = `api_key = ${randomBytes(24).toString('hex')}\n`
const control = scan(['stdin'], canary)
assert.equal(control.status, 1, 'O controle positivo precisa ser detectado')
assert.ok(control.findings.length > 0 && control.findings.every(finding => finding.Secret === 'REDACTED'))
assert.equal(control.redacted, true, 'O relatório não pode expor o valor sintético')

const history = scan(['git', '/repo', '--log-opts=--all --full-history --diff-merges=first-parent'])
if (history.status !== 0 || history.findings.length !== 0) {
  throw new Error(`Histórico contém ${history.findings.length} possível(is) segredo(s). Revisar localmente com redação; nenhum valor foi impresso.`)
}
process.stdout.write(JSON.stringify({
  scanner: 'gitleaks 8.30.1', reachableCommits: Number(git('rev-list', '--all', '--count')),
  positiveControl: true, remainingFindings: history.findings.length, network: 'none', mounts: 'readonly',
}) + '\n')
