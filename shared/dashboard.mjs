import { marketMoves } from '../server/analysis.mjs';

// Pure presentation model, used by both Express and the GitHub Pages client.
export function composeDashboard(market, news, analysis, mode = 'live', errors = []) {
  const { daily, hourly, news: ignored, ...quote } = market;
  const marketTime = Date.parse(market.marketTime);
  const points = candles => candles.map(c => ({ time: Math.min(c.end + 1, marketTime), price: c.close, volume: c.volume }));
  return {
    mode, market: quote, analysis,
    charts: { hourly: points(hourly), daily: points(daily) },
    news, moves: marketMoves(hourly, daily, news.articles),
    meta: {
      fetchedAt: market.fetchedAt,
      stale: mode === 'live' && Date.now() - Date.parse(market.fetchedAt) > 90_000,
      analysisStale: Date.now() > Date.parse(analysis.validUntil),
      errors, refreshSeconds: 60, dailyUpdate: '07.00 WIB (00.00 UTC)',
      newsStale: !Number.isFinite(Date.parse(news.fetchedAt)) || Date.now() - Date.parse(news.fetchedAt) > 900_000,
    },
  };
}
