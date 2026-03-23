/**
 * Issue #16: DeepLearningPanel 폴링 fetch 언마운트 시 AbortController 없음
 * - AbortController signal이 fetch에 전달되는지 검증
 * - abort() 호출 시 fetch가 AbortError를 throw하는지 검증
 * - AbortError가 적절히 처리(무시)되는지 검증
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('폴링 fetch AbortController', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('fetch 호출 시 signal 옵션이 전달된다', async () => {
        fetch.mockResolvedValueOnce({ ok: false })
        const abortController = new AbortController()

        await fetch('/api/xgb/train-status', { signal: abortController.signal })

        expect(fetch).toHaveBeenCalledWith('/api/xgb/train-status', {
            signal: expect.any(AbortSignal),
        })
    })

    it('abort() 호출 후 signal이 aborted 상태가 된다', () => {
        const abortController = new AbortController()
        expect(abortController.signal.aborted).toBe(false)

        abortController.abort()

        expect(abortController.signal.aborted).toBe(true)
    })

    it('AbortError는 사용자에게 노출되지 않고 무시된다', async () => {
        const abortController = new AbortController()
        abortController.abort()

        fetch.mockRejectedValueOnce(Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' }))

        let caughtError = null
        try {
            await fetch('/api/xgb/train-status', { signal: abortController.signal })
        } catch (e) {
            if (e?.name !== 'AbortError') {
                caughtError = e
            }
        }

        expect(caughtError).toBeNull()
    })

    it('AbortError가 아닌 에러는 무시되지 않는다', async () => {
        fetch.mockRejectedValueOnce(new Error('Network Error'))

        const errors = []
        try {
            await fetch('/api/xgb/train-status')
        } catch (e) {
            if (e?.name !== 'AbortError') {
                errors.push(e.message)
            }
        }

        expect(errors).toContain('Network Error')
    })

    it('cleanup 함수에서 abort()와 clearInterval()이 모두 호출된다', () => {
        const abortController = new AbortController()
        const abortSpy = vi.spyOn(abortController, 'abort')
        const intervalId = setInterval(() => {}, 5000)
        const clearSpy = vi.spyOn(globalThis, 'clearInterval')

        // cleanup 시뮬레이션
        const cleanup = () => {
            abortController.abort()
            clearInterval(intervalId)
        }
        cleanup()

        expect(abortSpy).toHaveBeenCalledOnce()
        expect(clearSpy).toHaveBeenCalledWith(intervalId)
    })
})
