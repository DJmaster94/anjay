import { DAY } from './analysis.mjs';

// Deterministic synthetic data. Never used as a substitute for a live API result.
export function createDemo(now = Date.now()) {
  let seed = 73;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const dayStart = Math.floor(now / DAY) * DAY;
  let price = 49200;
  const daily = Array.from({ length: 400 }, (_, i) => {
    const open = price;
    const movement = (random() - 0.47) * 0.045 + Math.sin(i / 12) * 0.003;
    price = open * (1 + movement);
    const volume = 17000 + random() * 25000;
    const time = dayStart - (400 - i) * DAY;
    return { time, end: time + DAY - 1, open, close: price, high: Math.max(open, price) * (1 + random() * 0.017), low: Math.min(open, price) * (1 - random() * 0.017), volume, takerBuy: volume * (0.43 + random() * 0.19), trades: Math.floor(400000 + random() * 600000) };
  });
  const scale = 97_842.56 / daily.at(-1).close;
  for (const candle of daily) for (const key of ['open', 'high', 'low', 'close']) candle[key] *= scale;
  const hourStart = Math.floor(now / 3_600_000) * 3_600_000;
  price = 94300;
  const hourly = Array.from({ length: 720 }, (_, i) => {
    const open = price;
    price *= 1 + (random() - 0.495) * 0.006 + (i > 695 ? 0.0006 : 0);
    if (i === 708) price *= 1.018;
    if (i === 676) price *= 0.986;
    const volume = 400 + random() * 1700;
    const time = hourStart - (719 - i) * 3_600_000;
    return { time, end: time + 3_600_000 - 1, open, close: price, high: Math.max(open, price) * (1 + random() * 0.002), low: Math.min(open, price) * (1 - random() * 0.002), volume, takerBuy: volume * (0.50 + random() * 0.19), trades: Math.floor(18000 + random() * 17000) };
  });
  const hourlyScale = 99_126.84 / hourly.at(-1).close;
  for (const candle of hourly) for (const key of ['open', 'high', 'low', 'close']) candle[key] *= hourlyScale;
  const latest = hourly.at(-1).close;
  const recent = hourly.slice(-24);
  const news = [
    { title: 'Memahami hubungan arus ETF spot dengan permintaan Bitcoin', category: 'Institusi', summary: 'Contoh topik berita. Dalam mode live, judul, waktu, ringkasan penerbit, dan tautan diambil langsung dari RSS.' },
    { title: 'Suku bunga, likuiditas, dan pengaruhnya terhadap aset kripto', category: 'Makro', summary: 'Contoh topik berita untuk mendemonstrasikan filter. Ini bukan laporan peristiwa yang sedang terjadi.' },
    { title: 'Mengapa volume penting saat Bitcoin menembus resistance?', category: 'Pasar', summary: 'Contoh materi edukasi. Kenaikan harga perlu dibaca bersama volume dan struktur pasar.' },
    { title: 'Apa arti perubahan kebijakan bagi pasar aset digital?', category: 'Regulasi', summary: 'Contoh topik, bukan berita terkini. Aktifkan data live untuk membaca berita dari penerbit.' },
  ].map((item, i) => ({ ...item, id: `demo-${i}`, source: 'Contoh · simulasi', url: null, publishedAt: new Date(now - (i + 1) * 3_600_000).toISOString(), demo: true }));
  return {
    source: 'Data simulasi', quote: 'USD simulasi', fetchedAt: new Date(now).toISOString(), marketTime: new Date(now).toISOString(),
    price: latest, change24h: (latest / recent[0].open - 1) * 100,
    high24h: Math.max(...recent.map(c => c.high)), low24h: Math.min(...recent.map(c => c.low)),
    volume24h: recent.reduce((sum, c) => sum + c.volume, 0),
    quoteVolume24h: recent.reduce((sum, c) => sum + c.volume * c.close, 0),
    trades24h: recent.reduce((sum, c) => sum + c.trades, 0),
    daily, hourly,
    flow: { buyVolume: recent.reduce((s, c) => s + c.takerBuy, 0), sellVolume: recent.reduce((s, c) => s + c.volume - c.takerBuy, 0), buyTrades: 589, sellTrades: 411, samples: 1000, sampleFrom: new Date(now - 180_000).toISOString(), sampleTo: new Date(now).toISOString(), from: new Date(recent[0].time).toISOString(), to: new Date(now).toISOString(), source: 'Data simulasi' },
    news,
  };
}
