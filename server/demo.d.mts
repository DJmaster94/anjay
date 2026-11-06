import type { MarketData, NewsItem } from '../src/types'
export function createDemo(now?: number): MarketData & { news: NewsItem[] }
