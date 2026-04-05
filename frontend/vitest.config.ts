import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./testing/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
        '**/shared/utils/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        '**/modules/**/utils/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
      exclude: [
        '**/node_modules/**',
        '**/testing/**',
        '**/*.config.*',
        '**/types/**',
        '**/index.ts',
      ],
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})