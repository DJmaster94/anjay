import { test, expect } from '@playwright/test'

test('demo is explicit and chart, analysis, export, methodology, and news work', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/?demo=1')
  await expect(page.getByText('Mode demo — data simulasi')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pergerakan harga' })).toBeVisible()
  await page.getByRole('button', { name: '7H', exact: true }).click()
  await expect(page.getByRole('button', { name: '7H', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Level S/R' }).click()
  await expect(page.getByRole('button', { name: 'Level S/R' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Analisis harian', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Di balik analisis' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Ekspor JSON' }).click()
  expect((await download).suggestedFilename()).toMatch(/^satoshi-demo-.*\.json$/)
  await page.getByRole('button', { name: 'Lihat metode & evaluasi' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Akurasi model')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Berita & katalis' }).click()
  await page.getByRole('button', { name: 'Makro', exact: true }).click()
  await expect(page.locator('.news-card')).toHaveCount(1)
  await page.locator('.news-card').click()
  await expect(page.getByText('Contoh materi — mode simulasi')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('textbox', { name: 'Cari berita Bitcoin' }).fill('kata-yang-tidak-ada')
  await expect(page.getByText('Tidak ada berita yang cocok')).toBeVisible()
  expect(errors).toEqual([])
})

test('mobile navigation and layouts remain within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?demo=1')
  await expect(page.getByRole('heading', { name: 'Pergerakan harga' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.getByRole('button', { name: 'Buka navigasi' }).click()
  await page.getByRole('button', { name: 'Aktivitas pasar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Transaksi, bukan jumlah orang.' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.getByRole('button', { name: 'Sumber & metodologi' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Tutup dialog' }).click()
})

test('unavailable live data does not silently show fake prices or switch to demo', async ({ page }) => {
  await page.route('**/api/dashboard?mode=live', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ unavailable: true, message: 'Sumber data pasar belum dapat dihubungi.' }) }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard siap. Menunggu data pasar.' })).toBeVisible()
  await expect(page.getByText('Mode demo — data simulasi')).toHaveCount(0)
  await expect(page.locator('.stat-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Jelajahi demo' }).click()
  await expect(page.getByText('Mode demo — data simulasi')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pergerakan harga' })).toBeVisible()
  await page.getByRole('button', { name: 'Gunakan data live' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard siap. Menunggu data pasar.' })).toBeVisible()
  await expect(page.locator('.stat-card')).toHaveCount(0)
})

test('stale market data is visibly marked and invalid API mode is rejected', async ({ page, request }) => {
  const demo = await (await request.get('/api/dashboard?mode=demo')).json()
  demo.mode = 'live'; demo.meta.stale = true
  await page.route('**/api/dashboard?mode=live', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(demo) }))
  await page.goto('/')
  await expect(page.getByText('DATA TERTUNDA', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('jangan dianggap sebagai harga terkini')
  expect((await request.get('/api/dashboard?mode=invalid')).status()).toBe(400)
})

test('GPT preview renders the production dashboard inside an HTTPS iframe', async ({ page, request, baseURL }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  // Both domains are intercepted locally. No request is sent to GPT or a
  // public preview service; production response headers are preserved.
  await page.route('https://satoshi-preview.example/**', async route => {
    const url = new URL(route.request().url())
    const response = await request.get(`${baseURL}${url.pathname}${url.search}`)
    await route.fulfill({ response })
  })
  await page.route('https://chatgpt.com/satoshi-preview-test', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>GPT iframe test</title><iframe title="Dashboard preview" style="width:100%;height:1000px" src="https://satoshi-preview.example/?demo=1"></iframe>',
  }))
  await page.goto('https://chatgpt.com/satoshi-preview-test')
  const preview = page.frameLocator('iframe[title="Dashboard preview"]')
  await expect(preview.getByRole('heading', { name: 'Pergerakan harga' })).toBeVisible()
  await preview.getByRole('button', { name: 'Analisis harian', exact: true }).click()
  await expect(preview.getByRole('heading', { name: 'Di balik analisis' })).toBeVisible()
  expect(errors).toEqual([])
  const response = await request.get('/')
  expect(response.headers()['x-frame-options']).toBeUndefined()
  expect(response.headers()['content-security-policy']).toContain('https://chatgpt.com')
})

test('unrelated websites remain unable to frame the dashboard', async ({ page, request, baseURL }) => {
  await page.route('https://satoshi-preview.example/**', async route => {
    const url = new URL(route.request().url())
    const response = await request.get(`${baseURL}${url.pathname}${url.search}`)
    await route.fulfill({ response })
  })
  await page.route('https://unrelated.example/iframe-test', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><iframe title="Untrusted embed" src="https://satoshi-preview.example/?demo=1"></iframe>',
  }))
  const refusal = page.waitForEvent('console', { predicate: message => /frame-ancestors/.test(message.text()) })
  await page.goto('https://unrelated.example/iframe-test')
  expect((await refusal).text()).toMatch(/violates|Refused/i)
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Pergerakan harga' })).toHaveCount(0)
})
