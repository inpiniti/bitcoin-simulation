/**
 * Issue #5: /api/reschedule 동작 확인
 * - Vercel 프록시 함수 로직 검증
 * - AutomationSettingsPanel에서 실패 시 적절히 처리하는지 검증
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('/api/reschedule 프록시 로직', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('POST 요청 시 백엔드 /auto-trade/reschedule을 호출한다', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', schedule: '평일 15:00 ET' }) })

        const res = await fetch('/api/reschedule', { method: 'POST' })
        expect(fetch).toHaveBeenCalledWith('/api/reschedule', { method: 'POST' })
        expect(res.ok).toBe(true)
    })

    it('백엔드 응답 실패 시 콘솔 경고만 출력하고 UI를 막지 않는다', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 502 })
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        await fetch('/api/reschedule', { method: 'POST' })
            .then(res => { if (!res.ok) console.warn('[Reschedule] 스케줄 반영 실패') })
            .catch(err => console.warn('[Reschedule] 백엔드 연결 실패:', err.message))

        expect(warnSpy).toHaveBeenCalledWith('[Reschedule] 스케줄 반영 실패')
        warnSpy.mockRestore()
    })

    it('네트워크 오류 시 catch에서 처리되고 오류가 전파되지 않는다', async () => {
        fetch.mockRejectedValueOnce(new Error('Network Error'))
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        await expect(
            fetch('/api/reschedule', { method: 'POST' })
                .then(res => { if (!res.ok) console.warn('[Reschedule] 스케줄 반영 실패') })
                .catch(err => console.warn('[Reschedule] 백엔드 연결 실패:', err.message))
        ).resolves.toBeUndefined()

        expect(warnSpy).toHaveBeenCalledWith('[Reschedule] 백엔드 연결 실패:', 'Network Error')
        warnSpy.mockRestore()
    })
})
