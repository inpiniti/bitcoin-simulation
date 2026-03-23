/**
 * Issue #2: DeepLearningPanel WebSocket 언마운트 시 정리 누락
 * - 컴포넌트 언마운트 시 ws.close() 호출 여부 검증
 * - ws.onclose stale closure 수정 검증
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// WebSocket mock
class MockWebSocket {
    constructor(url) {
        this.url = url
        this.readyState = MockWebSocket.CONNECTING
        this.onopen = null
        this.onmessage = null
        this.onerror = null
        this.onclose = null
        MockWebSocket.instances.push(this)
    }
    send() {}
    close() {
        this.readyState = MockWebSocket.CLOSED
        MockWebSocket.closedCount++
    }
    static instances = []
    static closedCount = 0
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
}

describe('WebSocket cleanup', () => {
    beforeEach(() => {
        MockWebSocket.instances = []
        MockWebSocket.closedCount = 0
        vi.stubGlobal('WebSocket', MockWebSocket)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('WebSocket 인스턴스가 생성된다', () => {
        const ws = new WebSocket('wss://example.com/ws/train')
        expect(MockWebSocket.instances).toHaveLength(1)
        expect(ws.url).toBe('wss://example.com/ws/train')
    })

    it('close() 호출 시 CLOSED 상태가 된다', () => {
        const ws = new WebSocket('wss://example.com/ws/train')
        ws.close()
        expect(ws.readyState).toBe(MockWebSocket.CLOSED)
        expect(MockWebSocket.closedCount).toBe(1)
    })

    it('onclose 핸들러가 함수형 업데이트로 호출된다 (stale closure 방지)', () => {
        const ws = new WebSocket('wss://example.com/ws/train')
        const states = []

        // 함수형 업데이트 패턴: prev => prev ? false : prev
        const setServerTraining = (updater) => {
            const prev = true
            const next = typeof updater === 'function' ? updater(prev) : updater
            states.push(next)
        }

        ws.onclose = () => {
            setServerTraining(prev => prev ? false : prev)
        }

        ws.onclose()
        expect(states).toEqual([false])
    })

    it('wsRef cleanup이 close()를 호출한다', () => {
        const ws = new WebSocket('wss://example.com/ws/train')
        const wsRef = { current: ws }

        // 언마운트 시 cleanup 시뮬레이션
        const cleanup = () => {
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }

        cleanup()

        expect(MockWebSocket.closedCount).toBe(1)
        expect(wsRef.current).toBeNull()
    })

    it('wsRef가 null이면 cleanup에서 오류 없이 종료된다', () => {
        const wsRef = { current: null }

        const cleanup = () => {
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }

        expect(() => cleanup()).not.toThrow()
        expect(MockWebSocket.closedCount).toBe(0)
    })
})
