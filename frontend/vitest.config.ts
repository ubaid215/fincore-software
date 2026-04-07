import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./testing/setup.ts'],
    
    pool: 'vmThreads',  // or 'forks' or 'threads'
    isolate: false,
    maxWorkers: 1,  // Replaces maxThreads/maxForks
    
    
    server: {
      deps: {
        inline: true,  // Inline all deps to avoid ESM issues
      },
    },
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['modules/**/*.{test,spec}.{ts,tsx}', 'shared/**/*.{test,spec}.{ts,tsx}'],
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
        '**/e2e/**',
      ],
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})