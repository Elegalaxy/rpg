import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// GitHub Pages serves the project at /rpg/, so built assets need that prefix. The dev server stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/rpg/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
}))
