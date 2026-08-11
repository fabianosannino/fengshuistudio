import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      // Mesmo destino do `paths` do tsconfig (`@/*` → raiz do projeto). Antes
      // apontava para `src/` — e por um caminho ABSOLUTO da máquina de quem
      // escreveu, que não existe no CI nem em outro checkout. Nada importa por
      // `@` hoje, o que é o único motivo de a divergência não ter estourado.
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
