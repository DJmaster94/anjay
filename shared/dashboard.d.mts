import type { Dashboard, DailyAnalysis, MarketData, Mode } from '../src/types'
export function composeDashboard(market: MarketData, news: Dashboard['news'], analysis: DailyAnalysis, mode?: Mode, errors?: string[]): Dashboard
