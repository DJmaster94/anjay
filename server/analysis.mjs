const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
const round = (n, places = 2) => Number(n.toFixed(places));
export const DAY = 86_400_000;

export function validateCandles(candles, now = Date.now()) {
  if (!Array.isArray(candles)) throw new Error('Format candle tidak valid');
  const seen = new Set();
  const result = candles.filter(c => {
    const numbers = [c.time, c.end, c.open, c.high, c.low, c.close, c.volume];
    if (!numbers.every(Number.isFinite) || c.time > now || c.end <= c.time || c.low <= 0 || c.volume < 0) return false;
    if (c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close) || seen.has(c.time)) return false;
    seen.add(c.time);
    return true;
  }).sort((a, b) => a.time - b.time);
  if (!result.length) throw new Error('Tidak ada candle yang valid');
  return result;
}

export function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    gain += Math.max(0, delta) / period;
    loss += Math.max(0, -delta) / period;
  }
  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(0, delta)) / period;
    loss = (loss * (period - 1) + Math.max(0, -delta)) / period;
  }
  if (gain === 0 && loss === 0) return 50;
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

export function ema(values, period) {
  if (values.length < period) return null;
  let result = mean(values.slice(0, period));
  const weight = 2 / (period + 1);
  for (const value of values.slice(period)) result += weight * (value - result);
  return result;
}

export function atr(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const ranges = candles.slice(1).map((c, i) => Math.max(c.high - c.low, Math.abs(c.high - candles[i].close), Math.abs(c.low - candles[i].close)));
  let value = mean(ranges.slice(0, period));
  for (const range of ranges.slice(period)) value = (value * (period - 1) + range) / period;
  return value;
}

export function pivots(candle) {
  const pivot = (candle.high + candle.low + candle.close) / 3;
  return {
    pivot: round(pivot),
    support: [round(2 * pivot - candle.high), round(pivot - (candle.high - candle.low))],
    resistance: [round(2 * pivot - candle.low), round(pivot + (candle.high - candle.low))],
    sourceDay: new Date(candle.time).toISOString().slice(0, 10),
  };
}

function features(candles, index) {
  const history = candles.slice(0, index + 1);
  const prices = history.map(c => c.close);
  const last = prices.at(-1);
  return [rsi(prices) / 25, (last / mean(prices.slice(-20)) - 1) * 20, (last / prices.at(-8) - 1) * 10, atr(history) / last * 20];
}

function nearest(history, target, count) {
  return history.map(item => ({ ...item, distance: Math.sqrt(item.features.reduce((sum, x, j) => sum + (x - target[j]) ** 2, 0)) }))
    .sort((a, b) => a.distance - b.distance).slice(0, count);
}

function wilson(wins, total) {
  const z = 1.96, p = wins / total, denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
  return [round((center - half) * 100, 1), round((center + half) * 100, 1)];
}

export function probability(candles) {
  if (candles.length < 150) return null;
  const records = [];
  for (let i = 59; i < candles.length - 1; i++) {
    const change = candles[i + 1].close / candles[i].close - 1;
    if (change !== 0) records.push({ index: i, features: features(candles, i), up: change > 0 ? 1 : 0 });
  }
  if (records.length < 40) return null;
  const matches = nearest(records, features(candles, candles.length - 1), 50);
  const wins = matches.reduce((sum, row) => sum + row.up, 0);
  const forecast = wins / matches.length;
  const evaluation = [];
  for (const row of records.slice(-90)) {
    // A label for index t uses close[t+1]. At forecast i, only t < i is known.
    const known = records.filter(previous => previous.index < row.index);
    if (known.length < 60) continue;
    const sample = nearest(known, row.features, 50);
    const p = mean(sample.map(x => x.up));
    const baseline = mean(known.map(x => x.up));
    evaluation.push({ correct: Number(Number(p >= 0.5) === row.up), baselineCorrect: Number(Number(baseline >= 0.5) === row.up), brier: (p - row.up) ** 2 });
  }
  return {
    up: round(forecast * 100), down: round((1 - forecast) * 100),
    samples: matches.length, historyDays: candles.length,
    interval: wilson(wins, matches.length),
    baseline: round(mean(records.map(x => x.up)) * 100),
    backtest: evaluation.length ? {
      days: evaluation.length, accuracy: round(mean(evaluation.map(x => x.correct)) * 100, 1),
      baselineAccuracy: round(mean(evaluation.map(x => x.baselineCorrect)) * 100, 1),
      brier: round(mean(evaluation.map(x => x.brier)), 3),
    } : null,
    horizon: 'Penutupan hari UTC berikutnya terhadap penutupan terakhir',
  };
}

export function analyzeDaily(allCandles, now = Date.now()) {
  const candles = validateCandles(allCandles, now).filter(c => c.end < now);
  if (candles.length < 60) throw new Error('Minimal 60 candle harian tertutup diperlukan');
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].time - candles[i - 1].time !== DAY) throw new Error('Riwayat harian memiliki celah; analisis ditunda');
  }
  const prices = candles.map(c => c.close), last = candles.at(-1);
  const sma20 = mean(prices.slice(-20)), sma50 = mean(prices.slice(-50));
  const rsi14 = rsi(prices), volatility = atr(candles), levels = pivots(last);
  const macd = ema(prices, 12) - ema(prices, 26);
  const trend = last.close > sma20 && sma20 > sma50 ? 'bullish' : last.close < sma20 && sma20 < sma50 ? 'bearish' : 'netral';
  const day = new Date(last.time + DAY).toISOString().slice(0, 10);
  return {
    day, asOf: new Date(last.end).toISOString(), validUntil: new Date(last.time + DAY * 2).toISOString(),
    trend, levels, probability: probability(candles),
    indicators: { rsi: round(rsi14), sma20: round(sma20), sma50: round(sma50), ema20: round(ema(prices, 20)), macd: round(macd), atr: round(volatility), atrPercent: round(volatility / last.close * 100) },
    summary: trend === 'bullish'
      ? 'Tren harian menguat, tetapi konfirmasi tetap penting.'
      : trend === 'bearish' ? 'Tekanan jual masih dominan pada tren harian.' : 'Pasar berada dalam fase transisi. Tunggu konfirmasi arah.',
    explanation: `Penutupan terakhir ${last.close > sma20 ? 'di atas' : 'di bawah'} rata-rata 20 hari. RSI ${round(rsi14, 1)} menunjukkan ${rsi14 >= 70 ? 'momentum jenuh beli' : rsi14 <= 30 ? 'momentum jenuh jual' : 'momentum dalam rentang normal'}. Level hari ini dihitung dari candle hari sebelumnya yang sudah selesai.`,
    scenarios: [
      { direction: 'up', title: 'Jika resistance ditembus', trigger: levels.resistance[0], target: levels.resistance[1], invalidation: levels.pivot, description: 'Penutupan candle harian di atas R1 dengan volume lebih tinggi dari rata-rata 20 hari mendukung kelanjutan menuju R2. Kembali di bawah pivot melemahkan skenario.' },
      { direction: 'down', title: 'Jika support kehilangan pijakan', trigger: levels.support[0], target: levels.support[1], invalidation: levels.pivot, description: 'Penutupan candle harian di bawah S1 dengan volume meningkat membuka kemungkinan pengujian S2. Kembali di atas pivot melemahkan skenario.' },
    ],
  };
}

export function marketMoves(hourly, daily, news = []) {
  const reference = daily.filter(c => c.end < Date.now()).slice(-20);
  const typicalHourVolume = reference.length ? mean(reference.map(c => c.volume)) / 24 : 0;
  return hourly.filter(c => c.end < Date.now()).slice(-72)
    .map(c => ({ candle: c, change: (c.close / c.open - 1) * 100 }))
    .filter(x => Math.abs(x.change) >= 1)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .map(({ candle: c, change }) => {
      const volumeMultiple = typicalHourVolume ? c.volume / typicalHourVolume : null;
      const related = news.filter(n => n.publishedAt && Math.abs(Date.parse(n.publishedAt) - c.time) < 6 * 3_600_000).slice(0, 2);
      return {
        time: new Date(c.time).toISOString(), change: round(change), from: c.open, to: c.close,
        volumeMultiple: volumeMultiple ? round(volumeMultiple) : null,
        observation: `Harga ${change > 0 ? 'naik' : 'turun'} ${Math.abs(round(change))}% dalam satu jam${volumeMultiple ? `, dengan volume ${round(volumeMultiple, 1)}× rata-rata per jam selama 20 hari` : ''}.`,
        hypothesis: volumeMultiple > 1.5
          ? 'Partisipasi volume yang lebih besar konsisten dengan dorongan transaksi yang kuat. Berita, likuidasi, atau perubahan posisi mungkin berperan, tetapi data ini tidak memastikan penyebabnya.'
          : 'Pergerakan dengan volume relatif terbatas dapat konsisten dengan likuiditas yang tipis atau reposisi. Penyebab spesifik belum terverifikasi.',
        outlook: change > 0
          ? 'Kelanjutan lebih masuk akal bila harga mempertahankan area breakout dan volume bertahan. Kembali ke area awal pergerakan memperbesar risiko pembalikan.'
          : 'Pemulihan perlu dikonfirmasi oleh reclaim area awal pergerakan. Kegagalan bertahan pada support dapat memperpanjang tekanan jual.',
        related: related.map(n => ({ title: n.title, url: n.url })),
      };
    });
}
