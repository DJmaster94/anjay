import { test, expect, type Page } from '@playwright/test'
import { createDemo } from '../../server/demo.mjs'
import { analyzeDaily } from '../../server/analysis.mjs'
import { composeDashboard } from '../../shared/dashboard.mjs'

function fixture() {
  const market = { ...createDemo(), source: 'Binance Spot', quote: 'USDT' }
  const news = { articles: market.news.map(n => ({ ...n, demo: false, source: 'Test RSS', url: 'https://example.com/news' })), errors: [], fetchedAt: market.fetchedAt }
  const analysis = analyzeDaily(market.daily)
  const dashboard = composeDashboard(market, news, analysis, 'live')
  return { market, snapshot: { version: 1, generatedAt: market.fetchedAt, news, reports: [{ ...analysis, source: market.source, quote: market.quote }], dashboard } }
}

async function prepare(page: Page, options: { failMarket?: boolean; failSnapshot?: boolean } = {}) {
  const data = fixture()
  let price = data.market.price
  const backendRequests: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.hostname === '127.0.0.1' && url.pathname.includes('/api/')) backendRequests.push(request.url())
  })
  await page.route('**/anjay/data/snapshot.json*', route => options.failSnapshot ? route.fulfill({ status: 404, body: 'Not found' }) : route.fulfill({ json: data.snapshot }))
  await page.route('https://api.exchange.coinbase.com/**', route => route.abort())
  await page.route('https://data-api.binance.vision/**', route => {
    if (options.failMarket) return route.abort()
    const url = new URL(route.request().url())
    let body
    if (url.pathname.endsWith('/ticker/24hr')) body = {
      closeTime: Date.now(), lastPrice: String(price), priceChangePercent: String(data.market.change24h),
      highPrice: '101500', lowPrice: '90000', volume: '30000', quoteVolume: '2900000000', count: '800000',
    }
    else if (url.pathname.endsWith('/aggTrades')) body = Array.from({ length: 1000 }, (_, i) => ({ T: Date.now() - (1000 - i) * 100, m: i >= 589 }))
    else body = (url.searchParams.get('interval') === '1d' ? data.market.daily : data.market.hourly)
      .map(c => [c.time, String(c.open), String(c.high), String(c.low), String(c.close), String(c.volume), c.end, '0', c.trades, String(c.takerBuy)])
    return route.fulfill({ json: body })
  })
  return { data, backendRequests, setPrice: (value: number) => { price = value } }
}

test('Pages project path loads demo, navigation, and archives without a backend', async ({ page }) => {
  const { backendRequests } = await prepare(page)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('./?demo=1')
  await expect(page.getByRole('heading', { name: 'Pergerakan harga' })).toBeVisible()
  await expect(page.getByText('Mode demo — data simulasi')).toBeVisible()
  await page.getByRole('button', { name: 'Analisis harian', exact: true }).click()
  await page.getByRole('button', { name: 'Arsip', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Binance Spot')
  expect(backendRequests).toEqual([])
  expect(errors).toEqual([])
})

test('Pages computes live market analysis in the browser and filters snapshot news', async ({ page }) => {
  const { backendRequests } = await prepare(page)
  await page.goto('./')
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible()
  await expect(page.locator('.stat-card').first()).toContainText('$99,126.84')
  await expect(page.locator('.flow-transactions')).toContainText('589')
  await page.getByRole('button', { name: 'Berita & katalis' }).click()
  await page.getByRole('button', { name: 'Makro', exact: true }).click()
  await expect(page.locator('.news-card')).toHaveCount(1)
  expect(backendRequests).toEqual([])
})

test('Pages refreshes prices while the page stays open', async ({ page }) => {
  await page.clock.install()
  const { setPrice } = await prepare(page)
  await page.goto('./')
  await expect(page.locator('.stat-card').first()).toContainText('$99,126.84')
  setPrice(100100)
  await page.clock.fastForward(61000)
  await expect(page.locator('.stat-card').first()).toContainText('$100,100.00')
})

test('unreachable browser APIs mark the saved snapshot stale rather than live', async ({ page }) => {
  await prepare(page, { failMarket: true })
  await page.goto('./')
  await expect(page.getByText('DATA TERTUNDA', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('jangan dianggap sebagai harga terkini')
  await expect(page.getByText('Mode demo — data simulasi')).toHaveCount(0)
})

test('without an API or snapshot, Pages offers explicit demo instead of fake live values', async ({ page }) => {
  await prepare(page, { failMarket: true, failSnapshot: true })
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Dashboard siap. Menunggu data pasar.' })).toBeVisible()
  await expect(page.locator('.stat-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Jelajahi demo' }).click()
  await expect(page.getByText('Mode demo — data simulasi')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pergerakan harga' })).toBeVisible()
})
