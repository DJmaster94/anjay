import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dashboard, history } from '../server/service.mjs';

const cachedFile = '.cache/pages/snapshot.json';
let previous = null;
try { previous = JSON.parse(await readFile(cachedFile, 'utf8')); } catch { /* First deployment. */ }

const result = await dashboard('live');
let news = result.news;
if (!news.articles.length && news.errors.length && previous?.news?.articles?.length) {
  news = { ...previous.news, errors: news.errors };
}
let market = result.unavailable ? previous?.dashboard ?? null : result;
if (market) {
  market = { ...market, news, meta: { ...market.meta, newsStale: Date.now() - Date.parse(news.fetchedAt) > 900_000 } };
}
const snapshot = {
  version: 1, generatedAt: new Date().toISOString(), news,
  reports: await history(), dashboard: market,
};
await mkdir('public/data', { recursive: true });
await mkdir('.cache/pages', { recursive: true });
const body = JSON.stringify(snapshot);
await writeFile('public/data/snapshot.json', body);
await writeFile(cachedFile, body);
console.log(JSON.stringify({ snapshot: 'public/data/snapshot.json', articles: news.articles.length, reports: snapshot.reports.length, marketAvailable: Boolean(market), newsErrors: news.errors }));
if (result.unavailable) console.warn('Snapshot harga belum tersedia; browser akan mencoba API publik secara langsung.');
