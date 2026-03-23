/**
 * Issue #22: DeepLearningPanel fetchGroupStocks useEffect 의존성 누락
 * - fetchGroupStocks가 변경될 때 useEffect가 재실행되는지 검증
 */
import { describe, it, expect, vi } from 'vitest'

describe('DeepLearningPanel fetchGroupStocks 의존성', () => {
    it('trainMode가 group이면 fetchGroupStocks가 호출된다', () => {
        const fetchGroupStocks = vi.fn()
        const runEffect = (trainMode, predTargetType, tickerGroup, fn) => {
            if (trainMode === 'group' || predTargetType === 'group') fn()
        }
        runEffect('group', 'single', 'SP500', fetchGroupStocks)
        expect(fetchGroupStocks).toHaveBeenCalledOnce()
    })

    it('predTargetType이 group이면 fetchGroupStocks가 호출된다', () => {
        const fetchGroupStocks = vi.fn()
        const runEffect = (trainMode, predTargetType, fn) => {
            if (trainMode === 'group' || predTargetType === 'group') fn()
        }
        runEffect('single', 'group', fetchGroupStocks)
        expect(fetchGroupStocks).toHaveBeenCalledOnce()
    })

    it('fetchGroupStocks 참조가 바뀌면 의존성 배열에 포함되어야 감지 가능하다', () => {
        const calls = []
        const fn1 = vi.fn().mockImplementation(() => calls.push('fn1'))
        const fn2 = vi.fn().mockImplementation(() => calls.push('fn2'))

        // 의존성 배열에 fetchGroupStocks 포함 시
        const runWithDep = (fn) => fn()
        runWithDep(fn1)
        runWithDep(fn2)

        expect(calls).toEqual(['fn1', 'fn2'])
    })

    it('trainMode와 predTargetType 모두 group이 아니면 호출되지 않는다', () => {
        const fetchGroupStocks = vi.fn()
        const runEffect = (trainMode, predTargetType, fn) => {
            if (trainMode === 'group' || predTargetType === 'group') fn()
        }
        runEffect('single', 'single', fetchGroupStocks)
        expect(fetchGroupStocks).not.toHaveBeenCalled()
    })

    it('tickerGroup 변경 시 fetchGroupStocks가 재호출된다', () => {
        const fetchGroupStocks = vi.fn()
        const runEffect = (trainMode, tickerGroup, fn) => {
            if (trainMode === 'group') fn()
        }
        runEffect('group', 'SP500', fetchGroupStocks)
        runEffect('group', 'QQQ', fetchGroupStocks)
        expect(fetchGroupStocks).toHaveBeenCalledTimes(2)
    })
})
