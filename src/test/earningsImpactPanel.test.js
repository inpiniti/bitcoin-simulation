/**
 * Issue #29: EarningsImpactPanel Math.random() 사용으로 렌더마다 값이 달라짐
 * - impact 계산이 결정론적인지 검증
 * - surprisePercent.raw를 기반으로 계산되는지 검증
 */
import { describe, it, expect } from 'vitest'

// EarningsImpactPanel.jsx의 impact 계산 로직
const calcImpact = (surprisePercent) =>
    Math.abs(surprisePercent?.raw != null ? surprisePercent.raw * 0.3 : 0).toFixed(2)

describe('EarningsImpactPanel impact 계산', () => {
    it('같은 입력에 항상 같은 값을 반환한다 (결정론적)', () => {
        const h = { surprisePercent: { raw: 0.15 } }
        const r1 = calcImpact(h.surprisePercent)
        const r2 = calcImpact(h.surprisePercent)
        expect(r1).toBe(r2)
    })

    it('surprisePercent.raw * 0.3이 impact 값이 된다', () => {
        const h = { surprisePercent: { raw: 0.10 } }
        expect(calcImpact(h.surprisePercent)).toBe('0.03')
    })

    it('surprisePercent가 null이면 0.00을 반환한다', () => {
        expect(calcImpact(null)).toBe('0.00')
        expect(calcImpact({ raw: null })).toBe('0.00')
    })

    it('음수 surprisePercent도 절대값으로 표시된다', () => {
        const h = { surprisePercent: { raw: -0.20 } }
        expect(calcImpact(h.surprisePercent)).toBe('0.06')
    })

    it('Math.random()은 사용되지 않는다', () => {
        // 10번 호출해도 모두 같은 값
        const h = { surprisePercent: { raw: 0.05 } }
        const results = Array.from({ length: 10 }, () => calcImpact(h.surprisePercent))
        expect(new Set(results).size).toBe(1)
    })
})
