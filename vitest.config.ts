import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Alias `@/` de apps/web para testear sus libs de servidor (runner, rutas…).
    alias: { '@': fileURLToPath(new URL('./apps/web', import.meta.url)) },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/web/lib/**/*.test.ts', 'infra/**/*.test.js'],
    environment: 'node',
    testTimeout: 20000,
  },
})
