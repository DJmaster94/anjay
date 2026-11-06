import test from 'node:test';
import assert from 'node:assert/strict';
import { binanceMarket, coinbaseMarket, parseFeed } from '../server/providers.mjs';
import { createDemo } from '../server/demo.mjs';

test('RSS parsing keeps relevant, timely HTTPS links and strips markup', () => {
  const now = Date.now();
  const item = (title, link, time = now) => `<item><title>${title}</title><link>${link}</link><pubDate>${new Date(time).toUTCString()}</pubDate><description><![CDATA[<p>Bitcoin &amp; liquidity.</p>]]></description></item>`;
  const xml = `<rss><channel>${item('Bitcoin ETF inflows', 'https://example.com/bitcoin')}${item('BTC rates', 'javascript:alert(1)')}${item('Bitcoin old', 'https://example.com/old', now - 30 * 86400000)}${item('Bitcoin future', 'https://example.com/future', now + 86400000)}</channel></rss>`;
  const result = parseFeed(xml, 'Test publisher', now);
  assert.equal(result.length, 1); assert.equal(result[0].category, 'Institusi');
  assert.equal(result[0].summary, 'Bitcoin & liquidity.'); assert.equal(result[0].demo, false);
});

test('Binance adapter maps taker side and distinguishes trade samples from volume', async t => {
  const now = Date.now(), demo = createDemo(now);
  const raw = rows => rows.map(c => [c.time, String(c.open), String(c.high), String(c.low), String(c.close), String(c.volume), c.end, '0', c.trades, String(c.takerBuy)]);
  t.mock.method(globalThis, 'fetch', async url => {
    const path = new URL(url).pathname;
    let value;
    if (path.endsWith('/ticker/24hr')) value = { closeTime: now, lastPrice: '100', priceChangePercent: '2', highPrice: '103', lowPrice: '98', volume: '1000', quoteVolume: '100000', count: '500' };
    else if (path.endsWith('/aggTrades')) value = [{ T: now - 1000, m: true }, { T: now - 800, m: false }, { T: now, m: false }];
    else value = raw(new URL(url).searchParams.get('interval') === '1d' ? demo.daily : demo.hourly);
    return new Response(JSON.stringify(value), { status: 200 });
  });
  const data = await binanceMarket();
  assert.equal(data.quote, 'USDT'); assert.equal(data.price, 100);
  assert.equal(data.flow.buyTrades, 2); assert.equal(data.flow.sellTrades, 1);
  assert.equal(data.flow.samples, 3);
  assert.ok(data.flow.buyVolume > data.flow.sellVolume);
  assert.equal(data.daily.length, 400);
});

test('Coinbase adapter retains USD and marks unavailable order flow', async t => {
  const now = Date.now(), demo = createDemo(now);
  const raw = rows => rows.map(c => [c.time / 1000, c.low, c.high, c.open, c.close, c.volume]).reverse();
  t.mock.method(globalThis, 'fetch', async url => {
    const endpoint = new URL(url);
    const value = endpoint.pathname.endsWith('/ticker') ? { price: '100', time: new Date(now).toISOString() }
      : endpoint.pathname.endsWith('/stats') ? { open: '80', high: '101', low: '78', volume: '1000' }
      : raw(endpoint.searchParams.get('granularity') === '86400' ? demo.daily : demo.hourly);
    return new Response(JSON.stringify(value), { status: 200 });
  });
  const data = await coinbaseMarket();
  assert.equal(data.quote, 'USD'); assert.equal(data.change24h, 25);
  assert.equal(data.flow, null); assert.equal(data.quoteVolumeEstimated, true);
});

test('a stale upstream ticker is rejected, not labeled live', async t => {
  t.mock.method(globalThis, 'fetch', async url => new Response(JSON.stringify(String(url).includes('ticker') ? { closeTime: Date.now() - 86400000 } : [])));
  await assert.rejects(binanceMarket(), /mutakhir/);
});
