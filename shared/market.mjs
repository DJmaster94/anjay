import { validateCandles, DAY } from '../server/analysis.mjs';

function checkFresh(time, maxAge = 180_000) {
  const age = Date.now() - time;
  if (!Number.isFinite(time) || age > maxAge || age < -60_000) throw new Error('Timestamp penyedia tidak mutakhir');
}

function checkMarket(data) {
  for (const key of ['price', 'high24h', 'low24h', 'volume24h', 'quoteVolume24h', 'change24h']) {
    if (!Number.isFinite(data[key]) || (key !== 'change24h' && data[key] <= 0)) throw new Error('Nilai pasar tidak valid');
  }
  if (data.high24h < data.low24h) throw new Error('Rentang harga tidak valid');
  checkFresh(data.daily.at(-1).time, DAY * 2);
  checkFresh(data.hourly.at(-1).time, 3_600_000 * 2);
  return data;
}

export async function fetchBinanceMarket(request) {
  const base = 'https://data-api.binance.vision/api/v3';
  const [ticker, dailyRaw, hourlyRaw, tradesResult] = await Promise.all([
    request(`${base}/ticker/24hr?symbol=BTCUSDT`),
    request(`${base}/klines?symbol=BTCUSDT&interval=1d&limit=400`),
    request(`${base}/klines?symbol=BTCUSDT&interval=1h&limit=720`),
    request(`${base}/aggTrades?symbol=BTCUSDT&limit=1000`).then(value => ({ value }), () => ({ value: null })),
  ]);
  checkFresh(Number(ticker.closeTime));
  const normalize = rows => validateCandles(rows.map(row => ({ time: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]), end: Number(row[6]), trades: Number(row[8]), takerBuy: Number(row[9]) })));
  const daily = normalize(dailyRaw), hourly = normalize(hourlyRaw);
  const recent = hourly.slice(-24);
  const trades = tradesResult.value?.filter(t => Number.isFinite(t.T) && typeof t.m === 'boolean') ?? [];
  const buyVolume = recent.reduce((s, c) => s + c.takerBuy, 0);
  const sellVolume = recent.reduce((s, c) => s + c.volume - c.takerBuy, 0);
  const flowValid = Number.isFinite(buyVolume) && Number.isFinite(sellVolume) && buyVolume >= 0 && sellVolume >= 0 && buyVolume + sellVolume > 0;
  return checkMarket({
    source: 'Binance Spot', quote: 'USDT', fetchedAt: new Date().toISOString(), marketTime: new Date(Number(ticker.closeTime)).toISOString(),
    price: Number(ticker.lastPrice), change24h: Number(ticker.priceChangePercent),
    high24h: Number(ticker.highPrice), low24h: Number(ticker.lowPrice), volume24h: Number(ticker.volume), quoteVolume24h: Number(ticker.quoteVolume), trades24h: Number(ticker.count),
    daily, hourly,
    flow: flowValid ? {
      buyVolume, sellVolume,
      buyTrades: trades.length ? trades.filter(t => !t.m).length : null,
      sellTrades: trades.length ? trades.filter(t => t.m).length : null,
      samples: trades.length,
      sampleFrom: trades.length ? new Date(trades[0].T).toISOString() : null,
      sampleTo: trades.length ? new Date(trades.at(-1).T).toISOString() : null,
      from: new Date(recent[0].time).toISOString(), to: new Date(Number(ticker.closeTime)).toISOString(), source: 'Binance Spot',
    } : null,
  });
}

export async function fetchCoinbaseMarket(request) {
  const base = 'https://api.exchange.coinbase.com/products/BTC-USD';
  const [ticker, stats, dailyRaw, hourlyRaw] = await Promise.all([
    request(`${base}/ticker`), request(`${base}/stats`),
    request(`${base}/candles?granularity=86400`), request(`${base}/candles?granularity=3600`),
  ]);
  checkFresh(Date.parse(ticker.time));
  const normalize = (rows, size) => validateCandles(rows.map(row => ({ time: row[0] * 1000, end: row[0] * 1000 + size - 1, low: Number(row[1]), high: Number(row[2]), open: Number(row[3]), close: Number(row[4]), volume: Number(row[5]) })));
  return checkMarket({
    source: 'Coinbase Exchange', quote: 'USD', fetchedAt: new Date().toISOString(), marketTime: ticker.time,
    price: Number(ticker.price), change24h: (Number(ticker.price) / Number(stats.open) - 1) * 100,
    high24h: Number(stats.high), low24h: Number(stats.low), volume24h: Number(stats.volume),
    quoteVolume24h: Number(stats.volume) * Number(ticker.price), quoteVolumeEstimated: true,
    trades24h: null, daily: normalize(dailyRaw, DAY), hourly: normalize(hourlyRaw, 3_600_000), flow: null,
  });
}
