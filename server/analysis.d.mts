import type { Candle, DailyAnalysis, Dashboard } from '../src/types'
export const DAY: number
export function analyzeDaily(candles: Candle[], now?: number): DailyAnalysis
export function marketMoves(hourly: Candle[], daily: Candle[], news?: Dashboard['news']['articles']): Dashboard['moves']
