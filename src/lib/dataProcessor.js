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
    '3d': 4320,
    '4d': 5760,
    '5d': 7200,
    '6d': 8640,
    '7d': 10080,
    '8d': 11520,
    '9d': 12960,
    '10d': 14400,
    '11d': 15840,
    '12d': 17280,
    '13d': 18720,
    '14d': 20160,
    '15d': 21600,
    '16d': 23040,
    '17d': 24480,
    '18d': 25920,
    '19d': 27360,
    '20d': 28800,
    '1w': 10080,
};

// 수수료 및 슬리피지 설정
export const TRADING_COSTS = {
    buyFee: 0.0005,      // 매수 수수료 0.05%
    sellFee: 0.0005,     // 매도 수수료 0.05%
    slippage: 0.001,     // 슬리피지 0.1%
};

/**
 * 1분봉 데이터를 특정 간격으로 변환 (Sliding Window 방식)
 * @param {Array} data1min - 데이터 배열 (1분봉 또는 일봉)
 * @param {number} intervalMinutes - 윈도우 크기 (아이템 개수 단위)
 * @returns {Array} 변환된 데이터
 */
export function aggregateToInterval(data1min, intervalMinutes) {
    // 윈도우 크기가 1이면 원본 반환
    if (intervalMinutes <= 1) return data1min;

    const result = [];
    const len = data1min.length;

    // Performance Guard: 윈도우가 너무 크면 High/Low 계산 단순화 (120개 이상)
    const simplifyHighLow = intervalMinutes > 120;

    // 초기 볼륨 계산 (첫 윈도우)
    let currentVolume = 0;
    // 윈도우 크기가 데이터보다 크면 처리 불가, 빈 배열 반환
    if (len < intervalMinutes) return result;

    for (let j = 0; j < intervalMinutes; j++) {
        const c = data1min[j];
        currentVolume += (c.candle_acc_trade_volume || c.volume || 0);
    }

    // Sliding Window Loop (Stride = 1)
    // i는 윈도우의 시작 인덱스
    // 윈도우 범위: [i, i + intervalMinutes - 1]
    for (let i = 0; i <= len - intervalMinutes; i++) {
        const startIdx = i;
        const endIdx = i + intervalMinutes - 1;

        const first = data1min[startIdx];
        const last = data1min[endIdx];

        // 업데이트된 볼륨 (첫 번째 루프 제외하고 갱신)
        if (i > 0) {
            const outItem = data1min[i - 1];
            currentVolume -= (outItem.candle_acc_trade_volume || outItem.volume || 0);
            currentVolume += (last.candle_acc_trade_volume || last.volume || 0);
        }

        // High/Low 계산
        let high, low;
        if (simplifyHighLow) {
            // 성능을 위해 Open/Close 중 큰/작은 값 사용
            const o = first.opening_price || first.open;
            const c = last.trade_price || last.close;
            high = Math.max(o, c);
            low = Math.min(o, c);
        } else {
            // 정밀 계산 (부분 배열 순회)
            // 성능 최적화를 위해 slice 없이 직접 루프
            let maxVal = -Infinity;
            let minVal = Infinity;
            for (let k = startIdx; k <= endIdx; k++) {
                const item = data1min[k];
                const h = item.high_price || item.high;
                const l = item.low_price || item.low;
                if (h > maxVal) maxVal = h;
                if (l < minVal) minVal = l;
            }
            high = maxVal;
            low = minVal;
        }

        const aggregated = {
            timestamp: last.timestamp || last.candle_date_time_kst, // 캔들 완성 시점 (End Time)
            open: first.opening_price || first.open,
            high: high,
            low: low,
            close: last.trade_price || last.close,
            volume: currentVolume,
        };
        result.push(aggregated);
    }

    return result;
}

/**
 * RSI (Relative Strength Index) 계산
 */
export function calculateRSI(data, period = 14) {
    if (data.length <= period) return data.map(d => ({ ...d, rsi: undefined }));

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) gains += change;
        else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    const result = new Array(data.length);
    for (let i = 0; i <= period; i++) {
        result[i] = { ...data[i], rsi: undefined };
    }

    if (avgLoss === 0) result[period].rsi = 100;
    else {
        const rs = avgGain / avgLoss;
        result[period].rsi = 100 - (100 / (1 + rs));
    }

    for (let i = period + 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        let gain = 0, loss = 0;
        if (change > 0) gain = change;
        else loss = -change;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        if (avgLoss === 0) result[i] = { ...data[i], rsi: 100 };
        else {
            const rs = avgGain / avgLoss;
            result[i] = { ...data[i], rsi: 100 - (100 / (1 + rs)) };
        }
    }
    return result;
}

/**
 * MA (Moving Average) 계산
 */
export function calculateMA(data, period = 50, key = 'close') {
    return data.map((item, index) => {
        const targetKey = key === 'volume' ? 'vma' : 'ma';
        if (index < period - 1) return { ...item, [`${targetKey}${period}`]: undefined };
        const slice = data.slice(index - period + 1, index + 1);
        const sum = slice.reduce((acc, cur) => acc + (cur[key] || 0), 0);
        return { ...item, [`${targetKey}${period}`]: sum / period };
    });
}

/**
 * 데이터에 모든 파생 지표(Median, Slope, Bollinger Bands, RSI, MA50) 추가
 */
export function addDerivedData(data) {
    // 1. Median & Slope
    let processed = data.map((item, index) => {
        const median = (item.open + item.close) / 2;
        const prevMedian = index > 0 ? (data[index - 1].open + data[index - 1].close) / 2 : undefined;
        const slope = prevMedian !== undefined ? median - prevMedian : undefined;
        return { ...item, median, slope };
    });

    // 2. RSI (14)
    processed = calculateRSI(processed, 14);

    // 3. MA (50) & Volume MA (20)
    processed = calculateMA(processed, 50, 'close');
    processed = calculateMA(processed, 20, 'volume');

    // 4. Bollinger Bands (20, 2)
    const period = 20;
    const multiplier = 2;

    return processed.map((item, index, array) => {
        if (index < period - 1) {
            return { ...item, bbStatus: 0, bbUpper: undefined, bbLower: undefined, bbMean: undefined };
        }
        const slice = array.slice(index - period + 1, index + 1).map(d => d.median);
        const mean = slice.reduce((sum, val) => sum + val, 0) / period;
        const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
        const stdDev = Math.sqrt(variance);
        const upperBand = mean + (multiplier * stdDev);
        const lowerBand = mean - (multiplier * stdDev);

        let bbStatus = 0;
        const price = item.median;

        if (price > upperBand) bbStatus = 2;
        else if (price > mean && price <= upperBand) bbStatus = 1;
        else if (price >= lowerBand && price < mean) bbStatus = -1;
        else if (price < lowerBand) bbStatus = -2;

        return { ...item, bbUpper: upperBand, bbLower: lowerBand, bbMean: mean, bbStatus };
    });
}

/**
 * 기울기(Slope) 데이터 추가 (Legacy 호환용 Wrapper)
 * 내부적으로 addDerivedData를 호출하여 처리
 */
export function addSlopeData(data) {
    return addDerivedData(data);
}

/**
 * 통합 매매 엔진: 다양한 필터 및 손절/익절 조건 적용
 */
export function generateIntegratedTrades(data, options = {}) {
    const {
        useBB = false,
        useTrend = false,
        useRSI = false,
        useVolumeFilter = false, // 거래량 필터 추가
        useStopLoss = false,
        stopLossPcnt = -2.0,
        useTakeProfit = false,
        takeProfitPcnt = 5.0,
        useTrailingStop = false, // 추적 손절매 추가
        trailingStopPcnt = -2.0, // 고점 대비 하락폭
    } = options;

    const trades = [];
    let currentPosition = null;
    let buyRecord = null;
    let highestPriceDuringTrade = 0; // 추적 손절매용 최고가 기록

    for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];

        if (prev.slope === undefined) continue;

        const prevSign = prev.slope > 0 ? 'positive' : prev.slope < 0 ? 'negative' : 'zero';
        const currSign = curr.slope > 0 ? 'positive' : curr.slope < 0 ? 'negative' : 'zero';

        // --- 매수 판단 ---
        if (currentPosition === null) {
            let buySignal = (prevSign === 'negative' && currSign === 'positive');

            if (buySignal) {
                // 필터 체크
                if (useBB && prev.bbStatus !== -2) buySignal = false;
                if (useTrend && curr.ma50 && curr.close < curr.ma50) buySignal = false;
                if (useRSI && curr.rsi !== undefined && curr.rsi > 70) buySignal = false;
                if (useVolumeFilter && curr.vma20 && curr.volume < curr.vma20) buySignal = false; // 거래량 필터
            }

            if (buySignal) {
                buyRecord = {
                    type: 'buy',
                    timestamp: curr.timestamp,
                    price: curr.close,
                    index: i,
                    reason: 'Strategy Match'
                };
                currentPosition = 'long';
                highestPriceDuringTrade = curr.close; // 진입 시 최고가 초기화
            }
        }
        // --- 매도/청산 판단 ---
        else if (currentPosition === 'long') {
            let sellSignal = (prevSign === 'positive' && currSign === 'negative');
            let sellReason = 'Slope Down';

            // 보유 중 최고가 갱신 (추적 손절매용)
            if (curr.high > highestPriceDuringTrade) {
                highestPriceDuringTrade = curr.high;
            }

            // 강제 청산 (손절/익절/추적손절) 체크
            if (useStopLoss || useTakeProfit || useTrailingStop) {
                const currentProfitRate = ((curr.close - buyRecord.price) / buyRecord.price) * 100;
                const dropFromPeakPcnt = ((curr.close - highestPriceDuringTrade) / highestPriceDuringTrade) * 100;

                if (useStopLoss && currentProfitRate <= stopLossPcnt) {
                    sellSignal = true;
                    sellReason = `Stop Loss (${stopLossPcnt}%)`;
                } else if (useTakeProfit && currentProfitRate >= takeProfitPcnt) {
                    sellSignal = true;
                    sellReason = `Take Profit (${takeProfitPcnt}%)`;
                } else if (useTrailingStop && dropFromPeakPcnt <= trailingStopPcnt) {
                    // 고점에서 일정 수준 하락 시 매도
                    sellSignal = true;
                    sellReason = `Trailing Stop (${trailingStopPcnt}%)`;
                }
            }

            if (sellSignal) {
                const sellRecord = {
                    type: 'sell',
                    timestamp: curr.timestamp,
                    price: curr.close,
                    index: i,
                    reason: sellReason
                };

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
    }

    return trades;
}

/**
 * 기울기 변화에 따른 매매 기록 생성 (하위 호환 유지)
 */
export function generateTrades(dataWithSlope, strategy = 'standard') {
    if (strategy === 'fixedQtyBB') {
        return generateIntegratedTrades(dataWithSlope, { useBB: true });
    }
    return generateIntegratedTrades(dataWithSlope, { useBB: false });
}

/**
 * 수수료와 슬리피지를 적용한 실제 거래 비용 계산
 * @param {number} price - 현재 가격
 * @param {number} quantity - 투자금 (KRW)
 * @param {string} type - 'buy' 또는 'sell'
 * @param {Object} costs - 수수료/슬리피지 설정
 * @returns {Object} { actualPrice, fee, totalCost }
 */
function applyTradingCosts(price, quantity, type, costs = TRADING_COSTS) {
    if (type === 'buy') {
        // 매수: 가격이 슬리피지만큼 불리하게 적용
        const actualPrice = price * (1 + costs.slippage);
        const fee = quantity * costs.buyFee;
        const totalCost = quantity + fee;
        const btcAmount = quantity / actualPrice;

        return { actualPrice, fee, totalCost, btcAmount };
    } else {
        // 매도: 가격이 슬리피지만큼 불리하게 적용
        const actualPrice = price * (1 - costs.slippage);
        const grossRevenue = quantity * actualPrice; // quantity = btcAmount
        const fee = grossRevenue * costs.sellFee;
        const netRevenue = grossRevenue - fee;

        return { actualPrice, fee, netRevenue };
    }
}

/**
 * 시뮬레이션 결과 계산 (수량 고정) - 수수료/슬리피지 반영
 * @param {Array} trades - 매매 기록
 * @param {number} quantity - 기본 수량 (KRW)
 * @param {Object} costs - 수수료/슬리피지 설정
 * @returns {Object} 시뮬레이션 결과
 */
export function calculateFixedQuantityResult(trades, quantity = 100000, costs = TRADING_COSTS) {
    let totalProfit = 0;
    let totalFees = 0;
    let wins = 0;
    let losses = 0;

    const tradeDetails = trades.map(trade => {
        // 매수 계산 (수수료 + 슬리피지 적용)
        const buyResult = applyTradingCosts(trade.buy.price, quantity, 'buy', costs);
        const btcAmount = buyResult.btcAmount;
        const buyCost = buyResult.totalCost;
        const buyFee = buyResult.fee;
        const actualBuyPrice = buyResult.actualPrice;

        // 매도 계산 (수수료 + 슬리피지 적용)
        const sellResult = applyTradingCosts(trade.sell.price, btcAmount, 'sell', costs);
        const sellRevenue = sellResult.netRevenue;
        const sellFee = sellResult.fee;
        const actualSellPrice = sellResult.actualPrice;

        // 실질 손익
        const realProfit = sellRevenue - buyCost;
        const realProfitRate = (realProfit / buyCost) * 100;

        if (realProfit > 0) wins++;
        else losses++;

        totalProfit += realProfit;
        totalFees += buyFee + sellFee;

        return {
            ...trade,
            quantity,
            btcAmount,
            actualBuyPrice,
            actualSellPrice,
            buyCost,
            sellRevenue,
            buyFee,
            sellFee,
            totalFee: buyFee + sellFee,
            realProfit,
            realProfitRate,
            // 기존 호환성을 위해 유지
            sellValue: sellRevenue,
        };
    });

    const totalCycles = trades.length;
    const winRate = totalCycles > 0 ? (wins / totalCycles) * 100 : 0;
    const totalInvested = quantity * totalCycles;
    const totalProfitRate = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    return {
        trades: tradeDetails,
        summary: {
            totalCycles,
            wins,
            losses,
            winRate,
            totalProfit,
            totalProfitRate,
            totalFees,
            costs, // 사용된 수수료/슬리피지 설정 기록
        },
    };
}

/**
 * 시뮬레이션 결과 계산 (수량 누적/복리) - 수수료/슬리피지 반영
 * @param {Array} trades - 매매 기록
 * @param {number} initialCapital - 초기 자본금
 * @param {Object} costs - 수수료/슬리피지 설정
 * @returns {Object} 시뮬레이션 결과
 */
export function calculateCumulativeResult(trades, initialCapital = 100000, costs = TRADING_COSTS) {
    let currentCapital = initialCapital;
    let totalFees = 0;
    let wins = 0;
    let losses = 0;

    // MDD 계산용
    let peakCapital = initialCapital;
    let maxDrawdown = 0;

    const tradeDetails = trades.map(trade => {
        // 투자금 = 현재 자본금 전액
        const quantity = currentCapital;

        if (quantity <= 0) {
            return {
                ...trade,
                quantity: 0,
                btcAmount: 0,
                realProfit: 0,
                realProfitRate: 0,
                currentCapital: 0,
                note: 'Bankrupt'
            };
        }

        // --- 매수 (가진 돈 안에서 해결) ---
        // 가진 돈(quantity) = 실제매수금액(X) + 수수료(X * feeRate)
        // quantity = X * (1 + feeRate)
        // X = quantity / (1 + feeRate)
        const actualInvest = quantity / (1 + costs.buyFee);
        const buyFee = quantity - actualInvest;

        // 슬리피지 적용된 매수가격
        const actualBuyPrice = trade.buy.price * (1 + costs.slippage);
        const btcAmount = actualInvest / actualBuyPrice;

        // --- 매도 (전량 매도) ---
        const actualSellPrice = trade.sell.price * (1 - costs.slippage);
        const grossRevenue = btcAmount * actualSellPrice;
        const sellFee = grossRevenue * costs.sellFee;
        const netRevenue = grossRevenue - sellFee;

        // 실질 손익
        const realProfit = netRevenue - quantity;
        const realProfitRate = (realProfit / quantity) * 100;

        if (realProfit > 0) wins++;
        else losses++;

        totalFees += buyFee + sellFee;

        // 자본금 갱신
        currentCapital = netRevenue;

        // MDD 갱신
        if (currentCapital > peakCapital) peakCapital = currentCapital;
        const drawdown = (peakCapital - currentCapital) / peakCapital * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        return {
            ...trade,
            quantity, // 투입된 총 자본 (Fee 포함)
            btcAmount,
            actualBuyPrice,
            actualSellPrice,
            buyCost: quantity, // 매수 총 비용
            sellRevenue: netRevenue, // 매도 후 수령액
            buyFee,
            sellFee,
            totalFee: buyFee + sellFee,
            realProfit,
            realProfitRate,
            currentCapital, // 잔액
            sellValue: netRevenue, // UI 호환용
        };
    });

    const totalCycles = trades.length;
    const winRate = totalCycles > 0 ? (wins / totalCycles) * 100 : 0;
    // 누적식의 총 수익률 = (최종 자본 - 초기 자본) / 초기 자본
    const totalProfit = currentCapital - initialCapital;
    const totalProfitRate = (totalProfit / initialCapital) * 100;

    return {
        trades: tradeDetails,
        summary: {
            totalCycles,
            wins,
            losses,
            winRate,
            totalProfit,
            totalProfitRate,
            totalFees,
            maxDrawdown, // MDD 추가
            finalCapital: currentCapital,
            costs,
        },
    };
}

/**
 * 마틴게일 전략 시뮬레이션 - 수수료/슬리피지 반영
 * @param {Array} trades - 매매 기록
 * @param {number} baseQuantity - 기본 수량
 * @param {number} multiplier - 배율 (1.1, 1.2, ...)
 * @param {Object} costs - 수수료/슬리피지 설정
 * @returns {Object} 시뮬레이션 결과
 */
export function calculateMartingaleResult(trades, baseQuantity = 100000, multiplier = 1.5, costs = TRADING_COSTS) {
    let totalProfit = 0;
    let totalFees = 0;
    let wins = 0;
    let losses = 0;
    let currentMultiplier = 1;
    let maxMultiplier = 1;

    const tradeDetails = trades.map(trade => {
        const quantity = baseQuantity * currentMultiplier;

        // 매수 계산 (수수료 + 슬리피지 적용)
        const buyResult = applyTradingCosts(trade.buy.price, quantity, 'buy', costs);
        const btcAmount = buyResult.btcAmount;
        const buyCost = buyResult.totalCost;
        const buyFee = buyResult.fee;
        const actualBuyPrice = buyResult.actualPrice;

        // 매도 계산 (수수료 + 슬리피지 적용)
        const sellResult = applyTradingCosts(trade.sell.price, btcAmount, 'sell', costs);
        const sellRevenue = sellResult.netRevenue;
        const sellFee = sellResult.fee;
        const actualSellPrice = sellResult.actualPrice;

        // 실질 손익
        const realProfit = sellRevenue - buyCost;
        const realProfitRate = (realProfit / buyCost) * 100;

        const usedMultiplier = currentMultiplier;

        if (realProfit > 0) {
            wins++;
            currentMultiplier = 1; // 승리 시 리셋
        } else {
            losses++;
            currentMultiplier *= multiplier; // 패배 시 배율 증가
            if (currentMultiplier > maxMultiplier) maxMultiplier = currentMultiplier;
        }

        totalProfit += realProfit;
        totalFees += buyFee + sellFee;

        return {
            ...trade,
            quantity,
            multiplier: usedMultiplier,
            btcAmount,
            actualBuyPrice,
            actualSellPrice,
            buyCost,
            sellRevenue,
            buyFee,
            sellFee,
            totalFee: buyFee + sellFee,
            realProfit,
            realProfitRate,
            // 기존 호환성을 위해 유지
            sellValue: sellRevenue,
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
            totalFees,
            costs,
        },
    };
}

/**
 * 마지막 캔들 기준으로 현재 매매 신호를 분석 (Market Scanner용)
 * @param {Array} dataWithSlope - 지표가 포함된 데이터 배열
 * @param {Object} options - 전략 옵션 (useBB, useTrend, useRSI, useVolumeFilter 등)
 * @returns {Object} { signal: 'BUY'|'SELL'|'HOLD', reason: string }
 */
export function analyzeSignal(dataWithSlope, options = {}) {
    const {
        useBB = false,
        useTrend = false,
        useRSI = false,
        useVolumeFilter = false
    } = options;

    if (!dataWithSlope || dataWithSlope.length < 2) {
        return { signal: 'HOLD', reason: 'Insufficient Data' };
    }

    const lastIndex = dataWithSlope.length - 1;
    const curr = dataWithSlope[lastIndex];
    const prev = dataWithSlope[lastIndex - 1];

    // 기울기가 undefined이면 판단 불가
    if (curr.slope === undefined || prev.slope === undefined) {
        return { signal: 'HOLD', reason: 'Calculating...' };
    }

    const prevSign = prev.slope > 0 ? 'positive' : prev.slope < 0 ? 'negative' : 'zero';
    const currSign = curr.slope > 0 ? 'positive' : curr.slope < 0 ? 'negative' : 'zero';

    // 1. 매수 신호 판단 (기울기 양전)
    let buySignal = (prevSign === 'negative' && currSign === 'positive');
    let buyReason = 'Slope Up';

    if (buySignal) {
        // 필터 체크
        const failures = [];
        if (useBB && prev.bbStatus !== -2) failures.push('BB');
        if (useTrend && curr.ma50 && curr.close < curr.ma50) failures.push('Trend');
        if (useRSI && curr.rsi !== undefined && curr.rsi > 70) failures.push('RSI');
        if (useVolumeFilter && curr.vma20 && curr.volume < curr.vma20) failures.push('Volume');

        if (failures.length > 0) {
            buySignal = false;
            buyReason = `Slope Up (Locked: ${failures.join(', ')})`;
        } else {
            buyReason = 'Strategy Match (BUY)';
        }
    }

    if (buySignal) return { signal: 'BUY', reason: buyReason };

    // 2. 매도 신호 판단 (기울기 음전)
    if (prevSign === 'positive' && currSign === 'negative') {
        return { signal: 'SELL', reason: 'Slope Down' };
    }

    // 3. 변화 없음 (HOLD)
    let currentStatus = curr.slope > 0 ? 'Rising' : 'Falling';
    let extra = '';
    if (curr.bbStatus === 2) extra = ' (Overbought)';
    if (curr.bbStatus === -2) extra = ' (Oversold)';

    // 만약 기울기는 올랐는데 필터에 걸린 경우라면 Locked 이유를 보여줌
    if (!buySignal && (prevSign === 'negative' && currSign === 'positive')) {
        return { signal: 'HOLD', reason: buyReason };
    }

    return { signal: 'HOLD', reason: `Maintains ${currentStatus}${extra}` };
}
