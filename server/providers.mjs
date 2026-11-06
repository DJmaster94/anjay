import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { XMLParser } from 'fast-xml-parser';
import { DAY } from './analysis.mjs';
import { fetchBinanceMarket, fetchCoinbaseMarket } from '../shared/market.mjs';

if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
}

export async function request(url, format = 'json') {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: format === 'json' ? 'application/json' : 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'SatoshiDashboard/1.0' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 3_000_000) throw new Error('Respons penyedia terlalu besar');
  return format === 'json' ? JSON.parse(text) : text;
}

export const binanceMarket = () => fetchBinanceMarket(request);
export const coinbaseMarket = () => fetchCoinbaseMarket(request);

export function classifyNews(title) {
  if (/etf|blackrock|institution|fund|treasury|strategy|fidelity/i.test(title)) return 'Institusi';
  if (/fed\b|inflation|rate cut|interest rate|macro|dollar|employment|cpi/i.test(title)) return 'Makro';
  if (/sec\b|regulat|law|bill|ban\b|government|congress|policy/i.test(title)) return 'Regulasi';
  return 'Pasar';
}

const plain = text => String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
export function parseFeed(xml, source, now = Date.now()) {
  const parser = new XMLParser({ ignoreAttributes: false, processEntities: false, htmlEntities: false });
  const document = parser.parse(xml);
  const raw = document.rss?.channel?.item ?? document.feed?.entry ?? [];
  const items = Array.isArray(raw) ? raw : [raw];
  const entries = items.map(item => {
    const title = plain(typeof item.title === 'object' ? item.title['#text'] : item.title);
    const summary = plain(item.description ?? item.summary ?? '').slice(0, 220);
    const link = typeof item.link === 'string' ? item.link : item.link?.['@_href'];
    let url;
    try { const parsed = new URL(link); if (parsed.protocol === 'https:') url = parsed.href; } catch { /* Omit invalid feed links. */ }
    const time = Date.parse(item.pubDate ?? item.published ?? item.updated);
    if (!url || !title || !Number.isFinite(time) || time > now + 300_000 || now - time > DAY * 14) return null;
    if (!/bitcoin|\bbtc\b/i.test(`${title} ${summary}`)) return null;
    return { id: url, title, summary, url, source, publishedAt: new Date(time).toISOString(), category: classifyNews(title), demo: false };
  }).filter(Boolean);
  return entries;
}

export async function fetchNews() {
  const feeds = [
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  ];
  const results = await Promise.allSettled(feeds.map(async feed => parseFeed(await request(feed.url, 'xml'), feed.name)));
  const unique = new Map();
  for (const result of results) if (result.status === 'fulfilled') for (const item of result.value) unique.set(item.url, item);
  const errors = results.flatMap((result, i) => result.status === 'rejected' ? [feeds[i].name] : []);
  return { articles: [...unique.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 24), errors, fetchedAt: new Date().toISOString() };
}
