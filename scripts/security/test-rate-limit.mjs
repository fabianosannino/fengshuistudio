/** Atomic counters against Redis, isolated from application data and networks. */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { SCRIPT_RATE_LIMIT } from '../../src/lib/rate-limit-script.ts'

const container = `fss-rate-${randomBytes(5).toString('hex')}`
const image = 'redis:7.4-alpine@sha256:520775a41a63e77e06c73e35d2fd9cc15921a609516818796b4ecbb813078bc7'
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const cli = (...args) => docker('exec', container, 'redis-cli', '--json', ...args)
const count = (key, ms) => JSON.parse(cli('EVAL', SCRIPT_RATE_LIMIT, '1', key, String(ms)))
const concurrent = key => new Promise((resolve, reject) => {
  const child = spawn('docker', ['exec', container, 'redis-cli', '--json', 'EVAL', SCRIPT_RATE_LIMIT, '1', key, '60000'], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', err = ''
  child.stdout.on('data', chunk => { out += chunk }); child.stderr.on('data', chunk => { err += chunk })
  child.on('error', reject)
  child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err)))
})
let checks = 0
const check = (value, message) => { assert.ok(value, message); checks++ }
try {
  docker('run', '-d', '--name', container, '--network', 'none', image, 'redis-server', '--save', '', '--appendonly', 'no')
  let ready = false
  for (let i = 0; i < 40; i++) {
    try { ready = cli('PING') === '"PONG"' } catch { /* Container startup. */ }
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  check(ready, 'Redis ready')
  const results = await Promise.all(Array.from({ length: 32 }, () => concurrent('same-window')))
  check(results.map(r => r[0]).sort((a, b) => a - b).every((n, i) => n === i + 1), 'Concurrent workers never get duplicate/lost counts')
  check(results.every(r => r[1] > 0 && r[1] <= 60_000), 'Every successful increment has a finite TTL')
  cli('PEXPIRE', 'same-window', '5000')
  const next = count('same-window', 60_000)
  check(next[0] === 33 && next[1] > 0 && next[1] <= 5_000, 'Later traffic does not renew the window')
  cli('INCR', 'legacy-without-ttl')
  check(cli('PTTL', 'legacy-without-ttl') === '-1', 'Reproduce missing expiration after a partial old pipeline')
  const repaired = count('legacy-without-ttl', 60_000)
  check(repaired[0] === 2 && repaired[1] === 60_000, 'Repair expiration without resetting the existing counter')
  count('expired', 60_000)
  cli('PEXPIRE', 'expired', '1')
  await new Promise(resolve => setTimeout(resolve, 25))
  check(count('expired', 60_000)[0] === 1, 'Expired windows reopen normally')
  cli('SET', 'invalid-value', 'not-an-integer')
  check(cli('EVAL', SCRIPT_RATE_LIMIT, '1', 'invalid-value', '60000').includes('error'), 'Redis refuses corrupt counters instead of approving')
  process.stdout.write(JSON.stringify({ passed: checks, redis: '7.4', parallelWorkers: 32, network: 'none' }) + '\n')
} finally {
  try { docker('rm', '-f', '-v', container) } catch { /* Only this randomly named fixture container. */ }
}
