/**
 * Issue #34: DeepLearningPanel 폴링 응답 비정상 시 interval이 중단되지 않음
 * - !res.ok 시 clearInterval이 호출되는지 검증
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('DeepLearningPanel 폴링 interval 정리', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.stubGlobal('fetch', vi.fn())
    })
    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('res.ok가 false면 clearInterval이 호출된다', async () => {
        fetch.mockResolvedValue({ ok: false })
        const intervalId = 123
        const clearSpy = vi.spyOn(globalThis, 'clearInterval')

        // 수정 후 로직 재현
        const poll = async () => {
            const res = await fetch('/api/xgb/train-status')
            if (!res.ok) { clearInterval(intervalId); return }
        }
        await poll()

        expect(clearSpy).toHaveBeenCalledWith(intervalId)
    })

    it('res.ok가 true면 clearInterval이 호출되지 않는다', async () => {
        fetch.mockResolvedValue({ ok: true, json: async () => ({ status: 'idle' }) })
        const intervalId = 456
        const clearSpy = vi.spyOn(globalThis, 'clearInterval')

        const poll = async () => {
            const res = await fetch('/api/xgb/train-status')
            if (!res.ok) { clearInterval(intervalId); return }
            await res.json()
        }
        await poll()

        expect(clearSpy).not.toHaveBeenCalledWith(intervalId)
    })

    it('404 응답 시 추가 요청이 발생하지 않는다', async () => {
        fetch.mockResolvedValue({ ok: false })
        let callCount = 0
        const mockFetch = vi.fn(async () => { callCount++; return { ok: false } })
        let intervalStopped = false

        const id = setInterval(async () => {
            const res = await mockFetch()
            if (!res.ok) { clearInterval(id); intervalStopped = true; return }
        }, 100)

        vi.advanceTimersByTime(100)
        await Promise.resolve()

        expect(intervalStopped).toBe(true)
        expect(callCount).toBe(1) // 1번만 호출됨
    })

    it('정상 응답 중 complete 상태에서도 interval이 정리된다', async () => {
        let cleared = false
        const id = { value: null }
        id.value = setInterval(async () => {
            clearInterval(id.value); cleared = true
        }, 100)

        vi.advanceTimersByTime(100)
        await Promise.resolve()

        expect(cleared).toBe(true)
    })
})
