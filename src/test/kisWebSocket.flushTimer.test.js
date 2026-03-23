/**
 * Issue #15: kisWebSocket updateBatch 처리 중 race condition 가능성
 * - stopFlushTimer()가 updateBatch를 지우지 않는지 검증
 * - startFlushTimer() 재호출 시 배치 데이터 유지 검증
 * - disconnect() 시 배치 초기화 검증
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// KISWebSocketManager의 핵심 로직만 추출하여 테스트
class FlushTimerManager {
    constructor() {
        this.updateBatch = {}
        this.flushTimer = null
        this.flushedBatches = []
    }

    addToBatch(ticker, data) {
        this.updateBatch[ticker] = data
    }

    startFlushTimer() {
        this.stopFlushTimer()
        this.flushTimer = setInterval(() => {
            if (Object.keys(this.updateBatch).length > 0) {
                const batch = this.updateBatch
                this.updateBatch = {}
                this.flushedBatches.push(batch)
            }
        }, 500)
    }

    stopFlushTimer() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer)
            this.flushTimer = null
        }
        // 배치 유지 — 재시작 시 데이터 유실 방지
    }

    disconnect() {
        this.stopFlushTimer()
        this.updateBatch = {} // 연결 종료 시에만 명시적 초기화
    }
}

describe('kisWebSocket flushTimer - 배치 데이터 유실 방지', () => {
    let manager

    beforeEach(() => {
        vi.useFakeTimers()
        manager = new FlushTimerManager()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('stopFlushTimer() 후 updateBatch 데이터가 유지된다', () => {
        manager.addToBatch('AAPL', { price: 213 })
        manager.addToBatch('TSLA', { price: 180 })

        manager.startFlushTimer()
        manager.stopFlushTimer() // 재시작 전 stop

        expect(manager.updateBatch).toHaveProperty('AAPL')
        expect(manager.updateBatch).toHaveProperty('TSLA')
    })

    it('startFlushTimer() 재호출 시 이전 배치 데이터가 유지된다', () => {
        manager.addToBatch('AAPL', { price: 213 })

        manager.startFlushTimer()
        // 타이머 실행 전에 재호출
        manager.startFlushTimer()

        expect(manager.updateBatch).toHaveProperty('AAPL')
    })

    it('타이머 실행 시 배치가 처리된 후 updateBatch가 초기화된다', () => {
        manager.addToBatch('AAPL', { price: 213 })
        manager.startFlushTimer()

        vi.advanceTimersByTime(500)

        expect(manager.updateBatch).toEqual({})
        expect(manager.flushedBatches).toHaveLength(1)
        expect(manager.flushedBatches[0]).toHaveProperty('AAPL')
    })

    it('disconnect() 시 updateBatch가 초기화된다', () => {
        manager.addToBatch('AAPL', { price: 213 })
        manager.disconnect()

        expect(manager.updateBatch).toEqual({})
    })

    it('disconnect() 시 flushTimer가 정리된다', () => {
        manager.startFlushTimer()
        expect(manager.flushTimer).not.toBeNull()

        manager.disconnect()

        expect(manager.flushTimer).toBeNull()
    })

    it('배치 처리 중 새 데이터가 들어와도 유실되지 않는다', () => {
        manager.addToBatch('AAPL', { price: 213 })
        manager.startFlushTimer()

        // 타이머 직후 새 데이터 추가
        vi.advanceTimersByTime(500)
        manager.addToBatch('TSLA', { price: 180 }) // 새 배치에 들어가야 함

        expect(manager.updateBatch).toHaveProperty('TSLA')
        expect(manager.flushedBatches[0]).not.toHaveProperty('TSLA')
    })
})
