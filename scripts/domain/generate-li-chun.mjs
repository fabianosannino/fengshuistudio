/** Reproducible ephemeris; the astronomical dependency stays out of browser bundles. */
import { SearchSunLongitude } from 'astronomy-engine'
import { readFileSync, writeFileSync } from 'node:fs'
const events = {}
for (let year = 1864; year <= 2100; year++) {
  const event = SearchSunLongitude(315, new Date(Date.UTC(year, 1, 1)), 7)
  if (!event) throw new Error(`Li Chun unavailable: ${year}`)
  events[year] = event.date.toISOString()
}
const output = JSON.stringify({ version: 'li-chun-ae-2.1.19-v1', engine: 'astronomy-engine@2.1.19', longitude: 315, uncertaintyMinutes: 30, events }, null, 2) + '\n'
const target = new URL('../../src/lib/data/li-chun.json', import.meta.url)
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== output) throw new Error('Committed Li Chun table differs from its pinned generator')
} else writeFileSync(target, output)
process.stdout.write(JSON.stringify({ years: Object.keys(events).length, first: 1864, last: 2100 }) + '\n')
