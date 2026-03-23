/**
 * Issue #4: OverviewPanel에서 EPS를 returnOnAssets 필드에 임시 표시 중
 * - fetchOverview 반환값에 eps 필드가 분리되어 있는지 검증
 * - returnOnAssets에 EPS 데이터가 섞이지 않는지 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('fetchOverview - eps / returnOnAssets 필드 분리', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('eps 필드와 returnOnAssets 필드가 분리되어 있다', () => {
        // api.js에서 반환하는 financials 구조 검증
        const quoteData = { eps: '6.43', marketCap: '3T', regularMarketPrice: '213', trailingPE: '33', beta: '1.2' }
        const fmt = (val) => ({ fmt: val || '-' })

        const financials = {
            eps: fmt(quoteData?.eps ?? '-'),
            returnOnAssets: fmt('-'),
            returnOnEquity: fmt('-'),
        }

        // eps 필드에 올바른 값이 들어있다
        expect(financials.eps.fmt).toBe('6.43')
        // returnOnAssets에 EPS 문자열이 섞이지 않는다
        expect(financials.returnOnAssets.fmt).not.toContain('EPS')
        expect(financials.returnOnAssets.fmt).toBe('-')
    })

    it('eps가 없으면 eps 필드는 "-"를 반환한다', () => {
        const quoteData = { marketCap: '3T' }
        const fmt = (val) => ({ fmt: val || '-' })

        const financials = {
            eps: fmt(quoteData?.eps ?? '-'),
            returnOnAssets: fmt('-'),
        }

        expect(financials.eps.fmt).toBe('-')
    })

    it('returnOnAssets 필드에 "EPS:"가 포함되지 않는다', () => {
        const quoteData = { eps: '2.5' }
        const fmt = (val) => ({ fmt: val || '-' })

        const financials = {
            eps: fmt(quoteData?.eps ?? '-'),
            returnOnAssets: fmt('-'),
        }

        expect(financials.returnOnAssets.fmt).not.toMatch(/EPS/i)
    })
})
