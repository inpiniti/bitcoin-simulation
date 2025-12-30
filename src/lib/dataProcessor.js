/**
 * 간격별 데이터 생성 및 기울기 계산 유틸리티
 */

// 간격 설정 (분 단위)
export const INTERVALS = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '2h': 120,
    '1d': 1440,
    '2d': 2880,
    '1w': 10080,
};

/**
 * 1분봉 데이터를 특정 간격으로 변환
 * @param {Array} data1min - 1분봉 데이터 배열
 * @param {number} intervalMinutes - 변환할 간격 (분)
 * @returns {Array} 변환된 데이터
 */
export function aggregateToInterval(data1min, intervalMinutes) {
    if (intervalMinutes === 1) return data1min;

    const result = [];
    for (let i = 0; i < data1min.length; i += intervalMinutes) {
        const chunk = data1min.slice(i, i + intervalMinutes);
        if (chunk.length === 0) continue;

        const aggregated = {
            timestamp: chunk[0].timestamp || chunk[0].candle_date_time_kst,
            open: chunk[0].opening_price || chunk[0].open,
            high: Math.max(...chunk.map(c => c.high_price || c.high)),
            low: Math.min(...chunk.map(c => c.low_price || c.low)),
            close: chunk[chunk.length - 1].trade_price || chunk[chunk.length - 1].close,
            volume: chunk.reduce((sum, c) => sum + (c.candle_acc_trade_volume || c.volume || 0), 0),
        };
        result.push(aggregated);
    }
    return result;
}

/**
 * 기울기(Slope) 데이터 추가
 * 첫 번째 로우는 이전 가격이 없으므로 undefined로 기록
 * @param {Array} data - 캔들 데이터 배열
 * @returns {Array} 기울기가 추가된 데이터
 */
export function addSlopeData(data) {
    return data.map((item, index) => {
        const currentPrice = item.close;
        const prevPrice = index > 0 ? data[index - 1].close : undefined;
        const slope = prevPrice !== undefined ? currentPrice - prevPrice : undefined;

        return {
            ...item,
            slope,
        };
    });
}

/**
 * 기울기 변화에 따른 매매 기록 생성
 * - undefined에서 양수/음수로 변하는 경우는 무시
 * - 음수 -> 양수: 매수
 * - 양수 -> 음수: 매도
 * @param {Array} dataWithSlope - 기울기가 포함된 데이터
 * @returns {Array} 매매 기록 배열
 */
export function generateTrades(dataWithSlope) {
    const trades = [];
    let currentPosition = null; // 'long' or null
    let buyRecord = null;

    for (let i = 1; i < dataWithSlope.length; i++) {
        const prev = dataWithSlope[i - 1];
        const curr = dataWithSlope[i];

        // undefined에서 변경되는 경우 무시
        if (prev.slope === undefined) continue;

        const prevSign = prev.slope > 0 ? 'positive' : prev.slope < 0 ? 'negative' : 'zero';
        const currSign = curr.slope > 0 ? 'positive' : curr.slope < 0 ? 'negative' : 'zero';

        // 음수 -> 양수: 매수 신호
        if (prevSign === 'negative' && currSign === 'positive' && currentPosition === null) {
            buyRecord = {
                type: 'buy',
                timestamp: curr.timestamp,
                price: curr.close,
                index: i,
            };
            currentPosition = 'long';
        }
        // 양수 -> 음수: 매도 신호
        else if (prevSign === 'positive' && currSign === 'negative' && currentPosition === 'long') {
            const sellRecord = {
                type: 'sell',
                timestamp: curr.timestamp,
                price: curr.close,
                index: i,
            };

            // 한 사이클(매수 + 매도) 완성
            const profit = sellRecord.price - buyRecord.price;
            const profitRate = (profit / buyRecord.price) * 100;

            trades.push({
                cycle: trades.length + 1,
                buy: buyRecord,
                sell: sellRecord,
                profit,
                profitRate,
            });

            currentPosition = null;
            buyRecord = null;
        }
    }

    return trades;
}

/**
 * 시뮬레이션 결과 계산 (수량 고정)
 * @param {Array} trades - 매매 기록
 * @param {number} quantity - 기본 수량 (KRW)
 * @returns {Object} 시뮬레이션 결과
 */
export function calculateFixedQuantityResult(trades, quantity = 100000) {
    let totalProfit = 0;
    let wins = 0;
    let losses = 0;

    const tradeDetails = trades.map(trade => {
        const btcAmount = quantity / trade.buy.price;
        const sellValue = btcAmount * trade.sell.price;
        const profit = sellValue - quantity;
        const profitRate = (profit / quantity) * 100;

        if (profit > 0) wins++;
        else losses++;

        totalProfit += profit;

        return {
            ...trade,
            quantity,
            btcAmount,
            sellValue,
            realProfit: profit,
            realProfitRate: profitRate,
        };
    });

    const totalCycles = trades.length;
    const winRate = totalCycles > 0 ? (wins / totalCycles) * 100 : 0;
    const totalProfitRate = (totalProfit / (quantity * totalCycles)) * 100;

    return {
        trades: tradeDetails,
        summary: {
            totalCycles,
            wins,
            losses,
            winRate,
            totalProfit,
            totalProfitRate,
        },
    };
}

/**
 * 마틴게일 전략 시뮬레이션
 * @param {Array} trades - 매매 기록
 * @param {number} baseQuantity - 기본 수량
 * @param {number} multiplier - 배율 (1.1, 1.2, ...)
 * @returns {Object} 시뮬레이션 결과
 */
export function calculateMartingaleResult(trades, baseQuantity = 100000, multiplier = 1.5) {
    let totalProfit = 0;
    let wins = 0;
    let losses = 0;
    let currentMultiplier = 1;
    let maxMultiplier = 1;

    const tradeDetails = trades.map(trade => {
        const quantity = baseQuantity * currentMultiplier;
        const btcAmount = quantity / trade.buy.price;
        const sellValue = btcAmount * trade.sell.price;
        const profit = sellValue - quantity;
        const profitRate = (profit / quantity) * 100;

        const usedMultiplier = currentMultiplier;

        if (profit > 0) {
            wins++;
            currentMultiplier = 1; // 승리 시 리셋
        } else {
            losses++;
            currentMultiplier *= multiplier; // 패배 시 배율 증가
            if (currentMultiplier > maxMultiplier) maxMultiplier = currentMultiplier;
        }

        totalProfit += profit;

        return {
            ...trade,
            quantity,
            multiplier: usedMultiplier,
            btcAmount,
            sellValue,
            realProfit: profit,
            realProfitRate: profitRate,
        };
    });

    const totalCycles = trades.length;
    const winRate = totalCycles > 0 ? (wins / totalCycles) * 100 : 0;

    return {
        trades: tradeDetails,
        summary: {
            totalCycles,
            wins,
            losses,
            winRate,
            totalProfit,
            maxMultiplier,
        },
    };
}
