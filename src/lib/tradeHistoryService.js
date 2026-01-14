/**
 * 매매 히스토리 서비스
 * Supabase DB를 통한 매매 기록 관리
 */
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient'

// re-export for external use
export { isSupabaseConfigured }

/**
 * 매수 기록 추가 (INSERT)
 * @param {Object} params
 * @param {string} params.accountNo - 계좌번호 (예: 12345678-01)
 * @param {string} params.ticker - 종목코드
 * @param {string} params.buyDate - 매수일 (YYYYMMDD)
 * @param {number} params.buyPrice - 매수가
 * @param {number} params.buyQty - 매수수량
 * @param {string} params.buyOrderNo - 매수주문번호
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function insertBuyRecord({ accountNo, ticker, buyDate, buyPrice, buyQty, buyOrderNo }) {
    if (!isSupabaseConfigured()) {
        console.warn('[TradeHistory] Supabase 미설정')
        return { success: false, error: 'Supabase 미설정' }
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
        return { success: false, error: 'Supabase 클라이언트 생성 실패' }
    }

    try {
        const { data, error } = await supabase
            .from('trade_history')
            .insert({
                account_no: accountNo,
                ticker: ticker.toUpperCase(),
                buy_date: buyDate,
                buy_price: buyPrice,
                buy_qty: buyQty,
                buy_order_no: buyOrderNo,
                status: 'HOLDING'
            })
            .select()

        if (error) {
            console.error('[TradeHistory] 매수 기록 실패:', error)
            return { success: false, error: error.message }
        }

        console.log('[TradeHistory] 매수 기록 성공:', data)
        return { success: true, data }
    } catch (e) {
        console.error('[TradeHistory] 매수 기록 예외:', e)
        return { success: false, error: e.message }
    }
}

/**
 * 매도 기록 업데이트 또는 삽입 (UPSERT)
 * - 기존에 HOLDING 상태인 동일 티커 레코드가 있으면 UPDATE
 * - 없으면 INSERT (프로그램 사용 전 보유 종목)
 * 
 * @param {Object} params
 * @param {string} params.accountNo - 계좌번호
 * @param {string} params.ticker - 종목코드
 * @param {string} params.sellDate - 매도일 (YYYYMMDD)
 * @param {number} params.sellPrice - 매도가
 * @param {number} params.sellQty - 매도수량
 * @param {string} params.sellOrderNo - 매도주문번호
 * @param {number} [params.avgBuyPrice] - 평균 매수가 (기존 보유종목용)
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function upsertSellRecord({ accountNo, ticker, sellDate, sellPrice, sellQty, sellOrderNo, avgBuyPrice }) {
    if (!isSupabaseConfigured()) {
        console.warn('[TradeHistory] Supabase 미설정')
        return { success: false, error: 'Supabase 미설정' }
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
        return { success: false, error: 'Supabase 클라이언트 생성 실패' }
    }

    try {
        // 1. 기존 HOLDING 레코드 조회 (매도일, 매도가가 비어있는 레코드)
        const { data: existingRecords, error: selectError } = await supabase
            .from('trade_history')
            .select('*')
            .eq('account_no', accountNo)
            .eq('ticker', ticker.toUpperCase())
            .eq('status', 'HOLDING')
            .is('sell_date', null)
            .order('created_at', { ascending: true })
            .limit(1)

        if (selectError) {
            console.error('[TradeHistory] 기존 레코드 조회 실패:', selectError)
            return { success: false, error: selectError.message }
        }

        // 2. 이익률 계산
        let profitRate = 0
        let buyPrice = avgBuyPrice || 0

        if (existingRecords && existingRecords.length > 0) {
            // 기존 레코드가 있으면 UPDATE
            const existing = existingRecords[0]
            buyPrice = existing.buy_price || avgBuyPrice || sellPrice

            if (buyPrice > 0) {
                profitRate = ((sellPrice - buyPrice) / buyPrice) * 100
            }

            const { data, error } = await supabase
                .from('trade_history')
                .update({
                    sell_date: sellDate,
                    sell_price: sellPrice,
                    sell_qty: sellQty,
                    sell_order_no: sellOrderNo,
                    profit_rate: Math.round(profitRate * 100) / 100,
                    status: 'COMPLETED',
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)
                .select()

            if (error) {
                console.error('[TradeHistory] 매도 업데이트 실패:', error)
                return { success: false, error: error.message }
            }

            console.log('[TradeHistory] 매도 업데이트 성공:', data)
            return { success: true, data }
        } else {
            // 기존 레코드 없음 → INSERT (프로그램 사용 전 보유 종목)
            // 매수일은 오늘, 매수가는 avgBuyPrice (잔고에서 추출)
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
            buyPrice = avgBuyPrice || sellPrice

            if (buyPrice > 0) {
                profitRate = ((sellPrice - buyPrice) / buyPrice) * 100
            }

            const { data, error } = await supabase
                .from('trade_history')
                .insert({
                    account_no: accountNo,
                    ticker: ticker.toUpperCase(),
                    buy_date: today, // 프로그램 최초 인식일
                    buy_price: buyPrice,
                    buy_qty: sellQty, // 매도 수량과 동일
                    sell_date: sellDate,
                    sell_price: sellPrice,
                    sell_qty: sellQty,
                    sell_order_no: sellOrderNo,
                    profit_rate: Math.round(profitRate * 100) / 100,
                    status: 'COMPLETED'
                })
                .select()

            if (error) {
                console.error('[TradeHistory] 매도 삽입 실패:', error)
                return { success: false, error: error.message }
            }

            console.log('[TradeHistory] 매도 삽입 성공 (기존 보유종목):', data)
            return { success: true, data }
        }
    } catch (e) {
        console.error('[TradeHistory] 매도 기록 예외:', e)
        return { success: false, error: e.message }
    }
}

/**
 * 매매 히스토리 조회
 * @param {string} accountNo - 계좌번호
 * @param {Object} [options]
 * @param {string} [options.status] - 상태 필터 (HOLDING, COMPLETED)
 * @param {number} [options.limit] - 조회 건수
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getTradeHistory(accountNo, options = {}) {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase 미설정', data: [] }
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
        return { success: false, error: 'Supabase 클라이언트 생성 실패', data: [] }
    }

    try {
        let query = supabase
            .from('trade_history')
            .select('*')
            .eq('account_no', accountNo)
            .order('created_at', { ascending: false })

        if (options.status) {
            query = query.eq('status', options.status)
        }

        if (options.limit) {
            query = query.limit(options.limit)
        }

        const { data, error } = await query

        if (error) {
            console.error('[TradeHistory] 조회 실패:', error)
            return { success: false, error: error.message, data: [] }
        }

        return { success: true, data }
    } catch (e) {
        console.error('[TradeHistory] 조회 예외:', e)
        return { success: false, error: e.message, data: [] }
    }
}
