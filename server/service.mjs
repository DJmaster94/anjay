import { mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { analyzeDaily } from './analysis.mjs';
import { composeDashboard } from '../shared/dashboard.mjs';
import { binanceMarket, coinbaseMarket, fetchNews } from './providers.mjs';
import { createDemo } from './demo.mjs';

const cacheDir = path.resolve(process.env.ANALYSIS_CACHE_DIR || '.cache/daily');
let marketCache = null, newsCache = null, pending = null, pendingNews = null, lastAttempt = 0, lastErrors = [];
const analysisCache = new Map();
const reports = new Map();

async function liveMarket() {
  if (pending) return pending;
  if (Date.now() - lastAttempt < 30_000) return marketCache;
  lastAttempt = Date.now();
  pending = (async () => {
    const errors = [];
    for (const [name, provider] of [['Binance Spot', binanceMarket], ['Coinbase Exchange', coinbaseMarket]]) {
      try { marketCache = await provider(); lastErrors = []; return marketCache; }
      catch (error) { errors.push(`${name}: ${error.message === 'fetch failed' ? 'koneksi API tidak tersedia' : error.message}`); }
    }
    lastErrors = errors;
    return marketCache;
  })().finally(() => { pending = null; });
  return pending;
}

async function liveNews() {
  if (pendingNews) return pendingNews;
  if (newsCache && Date.now() - Date.parse(newsCache.fetchedAt) < 600_000) return newsCache;
  pendingNews = fetchNews().then(result => {
    if (result.articles.length || !newsCache) newsCache = result;
    else newsCache = { ...newsCache, errors: result.errors.length ? result.errors : ['Tidak ada artikel Bitcoin baru'], retryAt: result.fetchedAt };
    return newsCache;
  }).finally(() => { pendingNews = null; });
  return pendingNews;
}

async function analysisFor(market, mode) {
  const latestClosed = market.daily.filter(c => c.end < Date.now()).at(-1);
  const key = `${mode}:${market.source}:${latestClosed?.end}`;
  if (analysisCache.has(key)) return analysisCache.get(key);
  const analysis = analyzeDaily(market.daily);
  analysisCache.clear();
  analysisCache.set(key, analysis);
  if (mode === 'live') {
    const report = { ...analysis, source: market.source, quote: market.quote };
    const file = `${analysis.day}-${market.quote}.json`;
    reports.set(file, report);
    try {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(path.join(cacheDir, `${file}.tmp`), JSON.stringify(report, null, 2));
      await rename(path.join(cacheDir, `${file}.tmp`), path.join(cacheDir, file));
    } catch { console.warn('Arsip analisis hanya tersedia di memori; direktori cache tidak dapat ditulis.'); }
  }
  return analysis;
}

export async function dashboard(mode = 'live') {
  let market, news;
  if (mode === 'demo') {
    market = createDemo();
    news = { articles: market.news, errors: [], fetchedAt: market.fetchedAt };
  } else {
    [market, news] = await Promise.all([liveMarket(), liveNews()]);
    if (!market) return { unavailable: true, errors: lastErrors, news, message: 'Sumber data pasar belum dapat dihubungi. Periksa akses jaringan atau coba lagi nanti.' };
  }
  const analysis = await analysisFor(market, mode);
  return composeDashboard(market, news, analysis, mode, mode === 'live' ? lastErrors : []);
}

export async function history() {
  try {
    const files = (await readdir(cacheDir)).filter(file => /^\d{4}-\d{2}-\d{2}-(USD|USDT)\.json$/.test(file)).sort().reverse().slice(0, 30);
    for (const file of files) {
      try { reports.set(file, JSON.parse(await readFile(path.join(cacheDir, file), 'utf8'))); } catch { /* Ignore partial or invalid archives. */ }
    }
  } catch { /* No successful live daily report has been recorded yet. */ }
  return [...reports.values()].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30);
}

export function startScheduler() {
  const refresh = () => dashboard('live').catch(error => console.warn(`Pembaruan ditunda: ${error.message}`));
  void refresh();
  const timer = setInterval(refresh, 60_000);
  timer.unref();
  return timer;
}
