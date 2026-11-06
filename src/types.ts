export type Mode = 'live' | 'demo'
export type View = 'overview' | 'analysis' | 'activity' | 'news'
export interface Candle { time: number; end: number; open: number; high: number; low: number; close: number; volume: number; takerBuy?: number; trades?: number }
export interface NewsItem { id: string; title: string; summary: string; source: string; url: string | null; publishedAt: string; category: string; demo: boolean }
export interface DailyAnalysis {
  day: string; asOf: string; validUntil: string; trend: 'bullish' | 'bearish' | 'netral'; summary: string; explanation: string;
  levels: { pivot: number; support: number[]; resistance: number[]; sourceDay: string };
  indicators: { rsi: number; sma20: number; sma50: number; ema20: number; macd: number; atr: number; atrPercent: number };
  probability: { up: number; down: number; samples: number; historyDays: number; interval: number[]; baseline: number; horizon: string; backtest: { days: number; accuracy: number; baselineAccuracy: number; brier: number } | null } | null;
  scenarios: { direction: string; title: string; trigger: number; target: number; invalidation: number; description: string }[];
}
export interface Dashboard {
  mode: Mode;
  market: { source: string; quote: string; fetchedAt: string; marketTime: string; price: number; change24h: number; high24h: number; low24h: number; volume24h: number; quoteVolume24h: number; quoteVolumeEstimated?: boolean; trades24h: number | null; flow: { buyVolume: number; sellVolume: number; buyTrades: number | null; sellTrades: number | null; samples: number; sampleFrom: string | null; sampleTo: string | null; from: string; to: string; source: string } | null };
  analysis: DailyAnalysis;
  charts: { hourly: { time: number; price: number; volume: number }[]; daily: { time: number; price: number; volume: number }[] };
  news: { articles: NewsItem[]; errors: string[]; fetchedAt: string; retryAt?: string };
  moves: { time: string; change: number; from: number; to: number; volumeMultiple: number | null; observation: string; hypothesis: string; outlook: string; related: { title: string; url: string }[] }[];
  meta: { fetchedAt: string; stale: boolean; analysisStale: boolean; errors: string[]; refreshSeconds: number; dailyUpdate: string; newsStale: boolean };
}
export type MarketData = Dashboard['market'] & { daily: Candle[]; hourly: Candle[] }
export type ArchivedAnalysis = DailyAnalysis & { source: string; quote: string }
export interface PagesSnapshot { version: 1; generatedAt: string; news: Dashboard['news']; reports: ArchivedAnalysis[]; dashboard: Dashboard | null }
