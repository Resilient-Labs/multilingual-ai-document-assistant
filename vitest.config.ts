import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  /** Keeps Vite/Vitest artifacts in-repo so constrained system `/var` temp does not break runs (ENOSPC). */
  cacheDir: path.resolve(__dirname, '.tmp/vite'),
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
