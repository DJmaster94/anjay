import type { MarketData } from '../src/types'
export type JsonRequest = (url: string) => Promise<unknown>
export function fetchBinanceMarket(request: JsonRequest): Promise<MarketData>
export function fetchCoinbaseMarket(request: JsonRequest): Promise<MarketData>
