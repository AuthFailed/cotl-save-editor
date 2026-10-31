import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5179', ...devices['Desktop Chrome'] },
  // the production build: the service worker only exists there
  webServer: { command: 'npm run build && npx vite preview --port 5179 --strictPort', port: 5179, reuseExistingServer: !process.env.CI },
})
