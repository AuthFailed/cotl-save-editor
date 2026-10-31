import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 5179)
const ci = !!process.env.CI

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${port}`, ...devices['Desktop Chrome'], trace: ci ? 'retain-on-failure' : 'off' },
  // the production build: the service worker only exists there
  webServer: {
    command: `${ci || existsSync('dist/index.html') ? '' : 'npm run build && '}npx vite preview --port ${port} --strictPort`,
    port,
    reuseExistingServer: !ci,
  },
})
