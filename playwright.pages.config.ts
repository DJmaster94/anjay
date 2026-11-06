import { defineConfig } from '@playwright/test'
import main from './playwright.config'

export default defineConfig({
  ...main,
  testDir: './tests/pages',
  use: { ...main.use, baseURL: 'http://127.0.0.1:4176/anjay/' },
  webServer: { command: 'npm run preview:pages', port: 4176, reuseExistingServer: false, timeout: 20000 },
})
