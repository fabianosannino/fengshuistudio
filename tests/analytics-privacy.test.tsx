import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import Analytics from '../app/components/Analytics'
afterEach(() => { vi.unstubAllEnvs() })
describe('analytics suspenso por minimização de dados', () => {
  it('IDs configurados não injetam rastreadores nem vazam a URL privada', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-FIXTURE')
    vi.stubEnv('NEXT_PUBLIC_PLAUSIBLE_DOMAIN', 'example.invalid')
    const { container } = render(<Analytics />)
    expect(container).toBeEmptyDOMElement()
    expect(container.querySelector('script')).toBeNull()
  })
})
