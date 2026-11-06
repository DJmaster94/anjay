import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDaily, atr, ema, marketMoves, pivots, probability, rsi, validateCandles, DAY } from '../server/analysis.mjs';
import { createDemo } from '../server/demo.mjs';

function candles(count, direction = 1) {
  const now = Math.floor(Date.now() / DAY) * DAY;
  return Array.from({ length: count }, (_, i) => {
    const close = 2000 + direction * i;
    const time = now - (count - i) * DAY;
    return { time, end: time + DAY - 1, open: close - direction, high: close + 2, low: close - 2, close, volume: 1000 };
  });
}

test('classic pivots use the previous completed OHLC values', () => {
  const result = pivots({ high: 120, low: 90, close: 105, time: Date.parse('2026-11-05') });
  assert.deepEqual(result, { pivot: 105, support: [90, 75], resistance: [120, 135], sourceDay: '2026-11-05' });
});
test('Wilder RSI handles rising, falling, flat, and insufficient histories', () => {
  assert.equal(rsi(Array.from({ length: 35 }, (_, i) => i + 1)), 100);
  assert.equal(rsi(Array.from({ length: 35 }, (_, i) => 100 - i)), 0);
  assert.equal(rsi(Array(35).fill(100)), 50);
  assert.equal(rsi([10, 20]), null);
});
test('EMA and Wilder ATR produce known values', () => {
  assert.equal(ema(Array.from({ length: 40 }, (_, i) => i + 1), 12), 34.5);
  assert.equal(atr(candles(20)), 4);
});
test('daily analysis ignores all still-open data, including extreme moves', () => {
  const now = Date.now(), daily = candles(180);
  const baseline = analyzeDaily(daily, now);
  const time = Math.floor(now / DAY) * DAY;
  const open = { time, end: time + DAY - 1, open: 2000, high: 100000, low: 1, close: 99999, volume: 1000000 };
  assert.deepEqual(analyzeDaily([...daily, open], now), baseline);
  assert.equal(baseline.day, new Date(now).toISOString().slice(0, 10));
  assert.equal(baseline.validUntil, new Date(time + DAY).toISOString());
});
test('gaps in historical daily candles block analysis rather than change the horizon', () => {
  const rows = candles(80); rows.splice(10, 1);
  assert.throws(() => analyzeDaily(rows), /celah/);
});
test('validation drops invalid and duplicate candles and sorts valid data', () => {
  const rows = candles(70);
  const invalid = { ...rows[0], high: NaN };
  const result = validateCandles([...rows].reverse().concat(invalid, rows[0]));
  assert.deepEqual(result, rows);
  assert.throws(() => validateCandles([{ ...rows[0], low: -1 }]), /valid/);
});
test('insufficient probability history remains unavailable', () => assert.equal(probability(candles(100)), null));
test('probabilities sum to 100 and walk-forward is correct on a strictly rising series', () => {
  const p = probability(candles(240));
  assert.equal(p.up, 100); assert.equal(p.down, 0); assert.equal(p.samples, 50);
  assert.equal(p.backtest.accuracy, 100); assert.equal(p.backtest.brier, 0);
  assert.equal(p.backtest.baselineAccuracy, 100);
  assert.ok(p.interval[0] > 90 && p.interval[1] === 100);
});
test('falling series produces the opposite outcome without hard-coded bullish bias', () => {
  const p = probability(candles(240, -1));
  assert.equal(p.up, 0); assert.equal(p.down, 100); assert.equal(p.backtest.accuracy, 100);
});
test('demo is deterministic, includes both directions, and is explicitly synthetic', () => {
  const now = Date.now(); const one = createDemo(now), two = createDemo(now);
  assert.deepEqual(one, two); assert.equal(one.source, 'Data simulasi');
  assert.ok(one.news.every(n => n.demo && n.url === null));
  const moves = marketMoves(one.hourly, one.daily, one.news);
  assert.ok(moves.some(m => m.change > 1)); assert.ok(moves.some(m => m.change < -1));
  assert.ok(moves.every(m => m.hypothesis && m.observation && m.outlook));
});
test('open hourly candles do not appear in movement explanations', () => {
  const data = createDemo(); const time = Math.floor(Date.now() / 3600000) * 3600000;
  const current = { time, end: time + 3600000 - 1, open: 100, high: 200, low: 99, close: 200, volume: 1000 };
  assert.equal(marketMoves([current], data.daily).length, 0);
});
