/**
 * Issue #3: EarningsImpactPanel priceImpact 목업 데이터(Math.random) 제거
 * - priceImpact가 deterministic한 값을 반환하는지 검증
 * - surprisePercent 기반 계산 로직 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// fetchStockData mock
vi.mock('../lib/api', () => ({
    fetchStockData: vi.fn().mockResolvedValue([{ date: '2024-01-01', close: 100 }])
}))

import { analyzeEarningsImpact } from '../lib/earningsAnalysis'

const makEarningsRecord = (quarter, actual, estimate, surpriseRaw) => ({
    quarter: { fmt: quarter },
    actual: { fmt: String(actual) },
    estimate: { fmt: String(estimate) },
    surprisePercent: surpriseRaw != null ? { raw: surpriseRaw, fmt: `${(surpriseRaw * 100).toFixed(1)}%` } : undefined,
})

describe('analyzeEarningsImpact - priceImpact', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random')
    })

    it('Math.random을 호출하지 않는다', async () => {
        const history = [makEarningsRecord('Mar 2024', 2.18, 2.1, 0.038)]
        await analyzeEarningsImpact('AAPL', history)
        expect(Math.random).not.toHaveBeenCalled()
    })

    it('같은 입력으로 두 번 호출하면 동일한 priceImpact를 반환한다 (deterministic)', async () => {
        const history = [makEarningsRecord('Mar 2024', 2.18, 2.1, 0.038)]
        const result1 = await analyzeEarningsImpact('AAPL', history)
        const result2 = await analyzeEarningsImpact('AAPL', history)
        expect(result1.impactHistory[0].priceImpact).toBe(result2.impactHistory[0].priceImpact)
    })

    it('surprisePercent.raw * 0.3으로 priceImpact를 계산한다', async () => {
        const history = [makEarningsRecord('Mar 2024', 2.18, 2.1, 0.1)] // 10% surprise
        const result = await analyzeEarningsImpact('AAPL', history)
        expect(result.impactHistory[0].priceImpact).toBe('0.03') // 0.1 * 0.3 = 0.03
    })

    it('surprisePercent가 없으면 priceImpact는 null이다', async () => {
        const history = [makEarningsRecord('Mar 2024', 2.18, 2.1, null)]
        const result = await analyzeEarningsImpact('AAPL', history)
        expect(result.impactHistory[0].priceImpact).toBeNull()
    })

    it('음수 surprise에 대해 음수 priceImpact를 반환한다', async () => {
        const history = [makEarningsRecord('Mar 2024', 1.8, 2.1, -0.2)] // -20% miss
        const result = await analyzeEarningsImpact('AAPL', history)
        const impact = parseFloat(result.impactHistory[0].priceImpact)
        expect(impact).toBeLessThan(0)
    })
})
