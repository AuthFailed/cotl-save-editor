import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5179', ...devices['Desktop Chrome'] },
  webServer: { command: 'npx vite --port 5179 --strictPort', port: 5179, reuseExistingServer: true },
})
