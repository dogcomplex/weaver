import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '#weaver/core': path.resolve(__dirname, 'packages/core/src'),
      '#weaver/runtime': path.resolve(__dirname, 'packages/runtime/src'),
      '#weaver/adapters': path.resolve(__dirname, 'packages/adapters/src'),
      '#weaver/glamour': path.resolve(__dirname, 'packages/glamour/src'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
  },
})
