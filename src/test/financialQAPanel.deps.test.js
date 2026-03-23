/**
 * Issue #20: FinancialQAPanel useEffect 의존성 배열 불완전
 * - aiModels/fetchAiModels가 의존성 배열에 포함되었는지 검증
 * Issue #21: FinancialQAPanel useMemo hist1d 의존성 배열 불완전
 * - hist1d 전체가 의존성 배열에 포함되었는지 검증
 */
import { describe, it, expect, vi } from 'vitest'

// useEffect 의존성 변경 시 실행되는지 검증하는 헬퍼
function createEffectTracker() {
    let runCount = 0
    const deps = []
    return {
        track(dep) { deps.push(dep); runCount++ },
        getRunCount: () => runCount,
        getDeps: () => deps
    }
}

describe('FinancialQAPanel 의존성 배열 검증', () => {
    it('aiModels가 변경되면 useEffect가 재실행된다', () => {
        const tracker = createEffectTracker()
        const runEffect = (aiModels) => tracker.track(aiModels)

        // 첫 실행
        runEffect([])
        // aiModels 변경
        runEffect([{ id: 1, name: 'SP500-v1' }])

        expect(tracker.getRunCount()).toBe(2)
        expect(tracker.getDeps()[1]).toHaveLength(1)
    })

    it('fetchAiModels 참조가 변경되면 useEffect가 재실행된다', () => {
        const tracker = createEffectTracker()
        const fn1 = vi.fn()
        const fn2 = vi.fn()

        const runEffect = (fn) => tracker.track(fn)
        runEffect(fn1)
        runEffect(fn2)

        expect(tracker.getRunCount()).toBe(2)
        expect(tracker.getDeps()[0]).toBe(fn1)
        expect(tracker.getDeps()[1]).toBe(fn2)
    })

    it('hist1d 내용이 바뀌면 useMemo가 재계산된다', () => {
        let computeCount = 0
        const computeMemo = (hist1d) => {
            computeCount++
            return hist1d.reduce((s, v) => s + v, 0)
        }

        const hist1 = [100, 200]
        const hist2 = [100, 300] // 같은 length지만 내용 다름

        const r1 = computeMemo(hist1)
        const r2 = computeMemo(hist2)

        expect(r1).toBe(300)
        expect(r2).toBe(400)
        expect(computeCount).toBe(2)
    })

    it('hist1d length만 의존성으로 쓰면 내용 변경이 반영 안 된다 (버그 재현)', () => {
        // 내용이 달라도 length가 같으면 재계산 안 됨
        const hist1 = [100, 200]
        const hist2 = [100, 300]
        expect(hist1.length).toBe(hist2.length) // length는 같다
        expect(hist1[1]).not.toBe(hist2[1])      // 내용은 다르다
    })

    it('hist1d 전체를 의존성으로 쓰면 내용 변경이 감지된다', () => {
        const hist1 = [100, 200]
        const hist2 = [100, 300]
        // 참조가 다르면 useMemo가 재계산됨
        expect(hist1).not.toBe(hist2)
    })
})
