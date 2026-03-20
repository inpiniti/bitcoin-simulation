/**
 * 실시간 분석 업데이트 헬퍼 함수
 * batchUpdateRealtimePrices에서 분리된 순수 함수들
 */
import { addDerivedData, analyzeSignal } from '@/lib/dataProcessor'

/**
 * 단일 티커의 분석 데이터와 가상매매 로직을 처리한다.
 * @returns {{ analysisEntry, updatedResult, positions, trades, analysisUpdated, tradesUpdated }}
 */
export function processTickerRealtime({
    ticker,
    data,
    tickerEntry,
    analysisResult,
    positions,
    trades,
    strategyOptions,
}) {
    let analysisUpdated = false
    let tradesUpdated = false

    if (!tickerEntry?.data?.length) {
        return { analysisEntry: tickerEntry, updatedResult: analysisResult, positions, trades, analysisUpdated, tradesUpdated }
    }

    const price = data.price
    const lastIndex = tickerEntry.data.length - 1
    const originalLastCandle = tickerEntry.data[lastIndex]

    // 1. 마지막 캔들 업데이트
    const newLastCandle = {
        ...originalLastCandle,
        close: price,
        high: Math.max(originalLastCandle.high, price),
        low: Math.min(originalLastCandle.low, price),
    }
    const newData = [...tickerEntry.data]
    newData[lastIndex] = newLastCandle

    // 2. 신호 재계산
    const dataWithSlope = addDerivedData(newData)
    const analysis = analyzeSignal(dataWithSlope, { ...strategyOptions, isRealtimeMode: true })

    // 3. 분석 결과 리스트 업데이트
    let updatedResult = analysisResult
    const resultIdx = analysisResult.findIndex(r => r.ticker === ticker)
    if (resultIdx !== -1) {
        const prevCandle = newData.length >= 2 ? newData[newData.length - 2] : null
        const changeRate = prevCandle ? ((price - prevCandle.close) / prevCandle.close * 100) : 0
        updatedResult = [...analysisResult]
        updatedResult[resultIdx] = {
            ...updatedResult[resultIdx],
            price,
            changeRate,
            signal: analysis.signal,
            reason: analysis.reason,
            slope: dataWithSlope[dataWithSlope.length - 1].slope,
            bbStatus: dataWithSlope[dataWithSlope.length - 1].bbStatus,
            timestamp: Date.now(),
        }
    }
    analysisUpdated = true

    // 4. 가상매매 처리
    const result = executePaperTrade({
        ticker, price, analysis, positions, trades, strategyOptions, originalLastCandle,
    })
    positions = result.positions
    trades = result.trades
    tradesUpdated = result.tradesUpdated

    // 5. 분석 데이터 저장
    const analysisEntry = { ...tickerEntry, data: newData }

    return { analysisEntry, updatedResult, positions, trades, analysisUpdated, tradesUpdated }
}

/**
 * 가상매매(Paper Trading) 로직
 */
function executePaperTrade({ ticker, price, analysis, positions, trades, strategyOptions, originalLastCandle }) {
    let tradesUpdated = false
    const currentPosition = positions[ticker]
    const isVMartingale = strategyOptions.useVMartingale
    const timestamp = new Date().toISOString()

    if (analysis.signal === 'BUY') {
        if (!currentPosition || isVMartingale) {
            const entryCount = currentPosition ? (currentPosition.entryCount || 0) : 0
            let canAddBuy = true

            if (currentPosition && isVMartingale) {
                const addBuyThreshold = strategyOptions.vMartingaleAddBuyThreshold || 0
                if (addBuyThreshold < 0) {
                    const currentLossRate = ((price - currentPosition.avgPrice) / currentPosition.avgPrice) * 100
                    if (currentLossRate > addBuyThreshold) canAddBuy = false
                }
            }

            const lastBuyTime = currentPosition?.lastTime
            if (canAddBuy && lastBuyTime !== originalLastCandle.timestamp) {
                const multiplier = isVMartingale
                    ? (strategyOptions.vMartingaleMultiplierMode === 'fixed' ? 1 : Math.pow(2, entryCount))
                    : 1
                const qty = multiplier
                const cost = price * qty

                positions = { ...positions }
                if (!currentPosition) {
                    positions[ticker] = {
                        avgPrice: price, totalQty: qty, totalCost: cost,
                        lastTime: originalLastCandle.timestamp,
                        entryCount: 1, startTime: timestamp,
                    }
                } else {
                    const nextQty = currentPosition.totalQty + qty
                    const nextCost = currentPosition.totalCost + cost
                    positions[ticker] = {
                        ...currentPosition,
                        avgPrice: nextCost / nextQty, totalQty: nextQty, totalCost: nextCost,
                        lastTime: originalLastCandle.timestamp, entryCount: entryCount + 1,
                    }
                }

                trades = [
                    {
                        id: Date.now() + Math.random(),
                        time: timestamp, type: 'BUY', ticker, price, quantity: qty,
                        entryCount: entryCount + 1,
                        reason: analysis.reason + (entryCount > 0 ? ` (V-Martingale #${entryCount + 1})` : ''),
                    },
                    ...trades.slice(0, 99),
                ]
                tradesUpdated = true
            }
        }
    } else if (analysis.signal === 'SELL' && currentPosition) {
        const { avgPrice, totalQty } = currentPosition
        const profit = (price - avgPrice) * totalQty
        const profitRate = ((price - avgPrice) / avgPrice) * 100

        trades = [
            {
                id: Date.now() + Math.random(),
                time: timestamp, type: 'SELL', ticker, price, quantity: totalQty,
                profit, profitRate, reason: analysis.reason,
            },
            ...trades.slice(0, 99),
        ]
        positions = { ...positions }
        delete positions[ticker]
        tradesUpdated = true
    }

    return { positions, trades, tradesUpdated }
}
