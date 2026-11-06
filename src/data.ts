import type { ArchivedAnalysis, DailyAnalysis, Dashboard, MarketData, Mode, PagesSnapshot } from './types'

export const isGitHubPages = import.meta.env.VITE_DEPLOY_TARGET === 'github-pages'
let snapshotCache: PagesSnapshot | null = null
let snapshotChecked = 0
let lastDashboard: Dashboard | null = null
let analysisCache: { key: string; value: DailyAnalysis } | null = null

const resource = (path: string) => new URL(path, new URL(import.meta.env.BASE_URL, window.location.href)).href
const signalWithTimeout = (signal?: AbortSignal) => signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000)

async function json(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal: signalWithTimeout(signal), credentials: 'omit' })
  if (!response.ok) {
    let message = `Sumber data merespons HTTP ${response.status}.`
    try { const body = await response.json(); if (typeof body.message === 'string') message = body.message } catch { /* Non-JSON response. */ }
    throw new Error(message)
  }
  return response.json()
}

async function snapshot(signal?: AbortSignal): Promise<PagesSnapshot | null> {
  if (snapshotCache && Date.now() - snapshotChecked < 60_000) return snapshotCache
  try {
    const value = await json(resource(`data/snapshot.json?t=${Math.floor(Date.now() / 60_000)}`), signal)
    if (value.version !== 1 || !Array.isArray(value.news?.articles) || !Array.isArray(value.reports)) throw new Error('Snapshot tidak valid.')
    snapshotCache = value
    snapshotChecked = Date.now()
    return value
  } catch (error) {
    if (signal?.aborted) throw error
    return snapshotCache
  }
}

async function publicMarket(signal?: AbortSignal): Promise<MarketData> {
  const { fetchBinanceMarket, fetchCoinbaseMarket } = await import('../shared/market.mjs')
  const request = (url: string) => json(url, signal)
  for (const provider of [fetchBinanceMarket, fetchCoinbaseMarket]) {
    try { return await provider(request) } catch (error) { if (signal?.aborted) throw error }
  }
  throw new Error('API harga tidak dapat dihubungi dari browser ini. Periksa koneksi atau coba lagi nanti.')
}

export async function loadDashboard(mode: Mode, signal?: AbortSignal): Promise<Dashboard> {
  if (!isGitHubPages) return json(resource(`api/dashboard?mode=${mode}`), signal)
  const [{ analyzeDaily }, { composeDashboard }] = await Promise.all([import('../server/analysis.mjs'), import('../shared/dashboard.mjs')])
  if (mode === 'demo') {
    const { createDemo } = await import('../server/demo.mjs')
    const market = createDemo()
    return composeDashboard(market, { articles: market.news, errors: [], fetchedAt: market.fetchedAt }, analyzeDaily(market.daily), mode)
  }
  const [marketResult, saved] = await Promise.all([publicMarket(signal).then(value => ({ value, error: null }), error => ({ value: null, error: error as Error })), snapshot(signal)])
  if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
  if (!marketResult.value) {
    const fallback = lastDashboard ?? saved?.dashboard
    if (!fallback || fallback.mode !== 'live') throw marketResult.error ?? new Error('Data pasar belum tersedia.')
    // Explicitly mark the snapshot as stale even if its timestamp is recent.
    return { ...fallback, meta: { ...fallback.meta, stale: true, analysisStale: Date.now() > Date.parse(fallback.analysis.validUntil), newsStale: true, errors: ['API browser tidak tersedia; menggunakan snapshot terakhir.'] } }
  }
  const market = marketResult.value
  const closed = market.daily.filter(c => c.end < Date.now()).at(-1)
  const key = `${market.source}:${closed?.end}`
  if (analysisCache?.key !== key) analysisCache = { key, value: analyzeDaily(market.daily) }
  const news = saved?.news ?? { articles: [], errors: ['Snapshot berita belum tersedia'], fetchedAt: new Date(0).toISOString() }
  lastDashboard = composeDashboard(market, news, analysisCache.value, mode)
  return lastDashboard
}

export async function loadArchive(signal?: AbortSignal): Promise<{ reports: ArchivedAnalysis[] }> {
  if (!isGitHubPages) return json(resource('api/history'), signal)
  const saved = await snapshot(signal)
  return { reports: saved?.reports ?? [] }
}
