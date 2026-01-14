/**
 * 주문 체결 추적 및 매매 히스토리 기록 모듈
 * 
 * 자동 매매 후 미체결 내역을 주기적으로 조회하여
 * 체결된 주문을 DB에 기록하는 역할을 담당합니다.
 */
import { getUnfilledOrdersWithDetails, getOverseasBalance } from './kisApi'
import { insertBuyRecord, upsertSellRecord } from './tradeHistoryService'
import { getMinutesUntilClose } from './marketTime'
import { useStore } from '@/store/useStore'

// 주문 추적 상태 (메모리 내 관리)
let pendingOrders = []       // 추적 중인 주문 목록
let monitoringInterval = null // 모니터링 인터벌 ID
let isMonitoring = false      // 모니터링 상태

/**
 * 주문 추적 목록에 주문 추가
 * 자동 매매 실행 후 호출
 * 
 * @param {Object} order
 * @param {string} order.ticker - 종목코드
 * @param {string} order.orderNo - 주문번호 (KIS 응답)
 * @param {string} order.orderType - 'buy' | 'sell'
 * @param {number} order.qty - 주문수량
 * @param {number} order.price - 주문가격
 * @param {string} order.orderDate - 주문일자 (YYYYMMDD)
 * @param {number} [order.avgBuyPrice] - 평균매수가 (매도 시 필요)
 */
export function addPendingOrder(order) {
    pendingOrders.push({
        ...order,
        addedAt: new Date().toISOString(),
        recorded: false  // DB 기록 여부
    })
    console.log(`[OrderTracker] 주문 추적 추가: ${order.orderType} ${order.ticker} (${order.orderNo})`)
}

/**
 * 추적 목록 초기화
 */
export function clearPendingOrders() {
    pendingOrders = []
    console.log('[OrderTracker] 추적 목록 초기화됨')
}

/**
 * 추적 목록 조회
 */
export function getPendingOrders() {
    return [...pendingOrders]
}

/**
 * 체결 확인 및 DB 기록 처리
 * 미체결 내역을 조회하여 체결 완료된 주문을 DB에 기록하고 추적 목록에서 제거
 * 
 * @param {Object} kisAuth - KIS 인증 정보
 * @returns {Promise<{processed: number, remaining: number}>}
 */
export async function processSettledOrders(kisAuth) {
    const store = useStore.getState()
    const { accessToken, appkey, appsecret, accountNo, accountCode } = kisAuth
    const fullAccountNo = `${accountNo}-${accountCode}`

    store.addAutoTradeLog('[체결 확인] 미체결 내역 조회 중...')

    // 1. 미체결 내역 조회
    const unfilledRes = await getUnfilledOrdersWithDetails(accessToken, appkey, appsecret, accountNo, accountCode)

    if (!unfilledRes.success) {
        store.addAutoTradeLog(`[체결 확인] 미체결 조회 실패: ${unfilledRes.error}`)
        return { processed: 0, remaining: pendingOrders.length }
    }

    const unfilledOrderNos = new Set(unfilledRes.orders.map(o => o.orderNo))
    store.addAutoTradeLog(`[체결 확인] 미체결 주문: ${unfilledRes.orders.length}건`)

    // 2. 보유종목 조회 (매도 시 평균 매수가 확인용)
    let holdingsMap = {}
    try {
        const balanceRes = await getOverseasBalance(accessToken, appkey, appsecret, accountNo, accountCode)
        if (balanceRes.success) {
            holdingsMap = Object.fromEntries(
                balanceRes.holdings.map(h => [h.pdno, {
                    avgPrice: Number(h.avg_unpr3 || h.pchs_avg_pric || 0),
                    qty: Number(h.ccld_qty_smtl1 || 0)
                }])
            )
        }
    } catch (e) {
        console.warn('[OrderTracker] 보유종목 조회 실패:', e.message)
    }

    // 3. 추적 목록에서 체결된 주문 확인 및 DB 기록
    let processed = 0
    const stillPending = []

    for (const order of pendingOrders) {
        // 이미 기록된 주문은 스킵
        if (order.recorded) {
            continue
        }

        // 미체결 목록에 없으면 체결 완료로 판단
        const isSettled = !unfilledOrderNos.has(order.orderNo)

        if (isSettled) {
            store.addAutoTradeLog(`[체결 완료] ${order.orderType.toUpperCase()} ${order.ticker} 주문번호: ${order.orderNo}`)

            try {
                if (order.orderType === 'buy') {
                    // 매수 체결 → INSERT
                    const result = await insertBuyRecord({
                        accountNo: fullAccountNo,
                        ticker: order.ticker,
                        buyDate: order.orderDate,
                        buyPrice: order.price,
                        buyQty: order.qty,
                        buyOrderNo: order.orderNo
                    })

                    if (result.success) {
                        store.addAutoTradeLog(`[DB 기록] 매수 기록 완료: ${order.ticker}`)
                        processed++
                    } else {
                        store.addAutoTradeLog(`[DB 오류] 매수 기록 실패: ${result.error}`)
                        stillPending.push(order) // 재시도 위해 유지
                    }
                } else if (order.orderType === 'sell') {
                    // 매도 체결 → UPDATE 또는 INSERT
                    const avgBuyPrice = order.avgBuyPrice || holdingsMap[order.ticker]?.avgPrice || 0

                    const result = await upsertSellRecord({
                        accountNo: fullAccountNo,
                        ticker: order.ticker,
                        sellDate: order.orderDate,
                        sellPrice: order.price,
                        sellQty: order.qty,
                        sellOrderNo: order.orderNo,
                        avgBuyPrice
                    })

                    if (result.success) {
                        store.addAutoTradeLog(`[DB 기록] 매도 기록 완료: ${order.ticker}`)
                        processed++
                    } else {
                        store.addAutoTradeLog(`[DB 오류] 매도 기록 실패: ${result.error}`)
                        stillPending.push(order)
                    }
                }
            } catch (e) {
                store.addAutoTradeLog(`[DB 예외] ${order.ticker}: ${e.message}`)
                stillPending.push(order)
            }
        } else {
            // 아직 미체결 → 계속 추적
            stillPending.push(order)
        }
    }

    // 4. 추적 목록 업데이트
    pendingOrders = stillPending
    store.addAutoTradeLog(`[체결 확인] 처리: ${processed}건, 대기: ${pendingOrders.length}건`)

    return { processed, remaining: pendingOrders.length }
}

/**
 * 체결 모니터링 시작
 * 10분 간격으로 체결 내역을 확인하고 DB에 기록
 * 
 * @param {Object} kisAuth - KIS 인증 정보
 * @param {number} [intervalMs=600000] - 조회 간격 (기본 10분)
 */
export function startSettlementMonitoring(kisAuth, intervalMs = 600000) {
    if (isMonitoring) {
        console.log('[OrderTracker] 이미 모니터링 중')
        return
    }

    if (pendingOrders.length === 0) {
        console.log('[OrderTracker] 추적할 주문 없음')
        return
    }

    const store = useStore.getState()
    isMonitoring = true

    store.addAutoTradeLog(`[모니터링 시작] ${Math.round(intervalMs / 60000)}분 간격 체결 확인`)

    const checkAndProcess = async () => {
        const minutesLeft = getMinutesUntilClose()

        // 종료 조건 1: 추적할 주문이 없음
        if (pendingOrders.length === 0) {
            store.addAutoTradeLog('[모니터링 종료] 모든 주문 체결 완료')
            stopSettlementMonitoring()
            return
        }

        // 종료 조건 2: 장 마감 1분 전 (마지막 조회 후 종료)
        if (minutesLeft <= 1 && minutesLeft > 0) {
            store.addAutoTradeLog('[마감 임박] 마지막 체결 확인...')
            await processSettledOrders(kisAuth)
            store.addAutoTradeLog('[모니터링 종료] 장 마감')
            stopSettlementMonitoring()
            return
        }

        // 장이 이미 마감됨 (다음 날로 넘어감)
        if (minutesLeft <= 0) {
            store.addAutoTradeLog('[모니터링 종료] 장 마감됨')
            stopSettlementMonitoring()
            return
        }

        // 체결 확인 및 DB 기록
        await processSettledOrders(kisAuth)
    }

    // 초기 실행 (1분 후)
    setTimeout(() => {
        checkAndProcess()
    }, 60000)

    // 주기적 실행
    monitoringInterval = setInterval(checkAndProcess, intervalMs)
}

/**
 * 체결 모니터링 중지
 */
export function stopSettlementMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval)
        monitoringInterval = null
    }
    isMonitoring = false
    clearPendingOrders()
    console.log('[OrderTracker] 모니터링 중지 및 상태 초기화')
}

/**
 * 모니터링 상태 확인
 */
export function isSettlementMonitoringActive() {
    return isMonitoring
}
