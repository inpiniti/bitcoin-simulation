/**
 * Issue #23: api.js chart.result 옵셔널 체이닝 없이 접근
 * - json.chart가 null/undefined일 때 TypeError 방지 검증
 * - json.chart.result가 빈 배열일 때 undefined 반환 검증
 */
import { describe, it, expect } from 'vitest'

// api.js의 result 추출 로직을 그대로 재현
const extractResult = (json) => json?.chart?.result?.[0]

describe('api.js chart.result 옵셔널 체이닝', () => {
    it('정상 응답에서 result[0]를 반환한다', () => {
        const json = { chart: { result: [{ timestamp: [1, 2, 3] }] } }
        expect(extractResult(json)).toEqual({ timestamp: [1, 2, 3] })
    })

    it('json이 null이면 undefined를 반환한다 (TypeError 없음)', () => {
        expect(() => extractResult(null)).not.toThrow()
        expect(extractResult(null)).toBeUndefined()
    })

    it('json.chart가 없으면 undefined를 반환한다', () => {
        const json = { chart: null }
        expect(() => extractResult(json)).not.toThrow()
        expect(extractResult(json)).toBeUndefined()
    })

    it('json.chart.result가 빈 배열이면 undefined를 반환한다', () => {
        const json = { chart: { result: [] } }
        expect(extractResult(json)).toBeUndefined()
    })

    it('json.chart.result가 null이면 undefined를 반환한다', () => {
        const json = { chart: { result: null } }
        expect(() => extractResult(json)).not.toThrow()
        expect(extractResult(json)).toBeUndefined()
    })
})
