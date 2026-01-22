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
    if (intervalMinutes <= 1) return data1min;

    const result = [];
    const len = data1min.length;
    const simplifyHighLow = intervalMinutes > 120;

    if (len < intervalMinutes) return result;

    let currentVolume = 0;
    for (let j = 0; j < intervalMinutes; j++) {
        const c = data1min[j];
        currentVolume += (c.candle_acc_trade_volume || c.volume || 0);
    }

    for (let i = 0; i <= len - intervalMinutes; i++) {
        const startIdx = i;
        const endIdx = i + intervalMinutes - 1;
        const first = data1min[startIdx];
        const last = data1min[endIdx];

        if (i > 0) {
            const outItem = data1min[i - 1];
            currentVolume -= (outItem.candle_acc_trade_volume || outItem.volume || 0);
            currentVolume += (last.candle_acc_trade_volume || last.volume || 0);
        }

        let high, low;
        if (simplifyHighLow) {
            const o = first.opening_price || first.open;
            const c = last.trade_price || last.close;
            high = Math.max(o, c);
            low = Math.min(o, c);
        } else {
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
            timestamp: last.timestamp || last.candle_date_time_kst,
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
 * @param {Array<Object>} data - 캔들 데이터 배열
 * @param {number} [period=14] - 계산 기간
 * @returns {Array<Object>} RSI가 포함된 데이터 배열
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
 * @param {Array<Object>} data - 캔들 데이터 배열
 * @param {number} [period=50] - 계산 기간
 * @param {string} [key='close'] - 계산할 필드명
 * @returns {Array<Object>} 이평선 데이터가 포함된 배열
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
 * 데이터에 모든 파생 지표(RSI, MA, Bollinger Bands, Slope)를 추가합니다.
 * @param {Array<Object>} data - 원본 캔들 데이터 배열
 * @returns {Array<Object>} 지표가 추가된 데이터 배열
 */
export function addDerivedData(data) {
    let processed = data.map((item, index) => {
        const median = (item.open + item.close) / 2;
        const prevMedian = index > 0 ? (data[index - 1].open + data[index - 1].close) / 2 : undefined;
        const slope = prevMedian !== undefined ? median - prevMedian : undefined;
        return { ...item, median, slope };
    });

    processed = calculateRSI(processed, 14);
    processed = calculateMA(processed, 50, 'close');
    processed = calculateMA(processed, 20, 'close');
    processed = calculateMA(processed, 20, 'volume');

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

export function addSlopeData(data) {
    return addDerivedData(data);
}


/**
 * 통합 매매 엔진: 다양한 필터 및 손절/익절 조건을 적용하여 매매 내역을 생성합니다. (정규장 시간 외 매매 제한 포함)
 * @param {Array<Object>} data - 지표가 포함된 캔들 데이터
 * @param {Object} options - 매매 전략 옵션
 * @returns {Array<Object>} 생성된 매매 내역 배열
 */
export function generateIntegratedTrades(data, options = {}) {
    const {
        useBB = false,
        useTrend = false,
        useTrend20 = false,
        useRSI = false,
        useVolumeFilter = false,
        useStopLoss = false,
        stopLossPcnt = -2.0,
        useTakeProfit = false,
        takeProfitPcnt = 5.0,
        useTrailingStop = false,
        trailingStopPcnt = -2.0,
        useSellAtBB2 = false,
        useVMartingale = false,        // NEW: V-Martingale 전략
        vMartingaleProfitCut = 2.0,   // NEW: V-Martingale 매도 타겟
        vMartingaleMultiplierMode = 'double', // 배팅 모드 ('double': 2배, 'fixed': 1배)
    } = options;

    const trades = [];
    let currentPosition = null;
    let buyRecord = null;
    let entries = []; // V-Martingale용 다회 매수 기록
    let highestPriceDuringTrade = 0;

    for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];

        if (prev.slope === undefined) continue;

        const prevSign = prev.slope > 0 ? 'positive' : prev.slope < 0 ? 'negative' : 'zero';
        const currSign = curr.slope > 0 ? 'positive' : curr.slope < 0 ? 'negative' : 'zero';

        // --- 매수 판단 --- (포지션이 없거나, V-Martingale 사용 시 추가 매수 가능)
        if (currentPosition === null || useVMartingale) {
            let buySignal = (prevSign === 'negative' && currSign === 'positive');

            if (buySignal) {
                if (useBB && prev.bbStatus !== -2) buySignal = false;
                if (useTrend && curr.ma50 && curr.close < curr.ma50) buySignal = false;
                if (useTrend20 && curr.ma20 && curr.close < curr.ma20) buySignal = false;
                if (useRSI && curr.rsi !== undefined && curr.rsi > 70) buySignal = false;
                if (useVolumeFilter && curr.vma20 && curr.volume < curr.vma20) buySignal = false;
            }

            // 정규장 시간 외 매매 제한 (이동: 모든 필터 적용 후 최종 체크)
            if (curr.isRegular === false) buySignal = false;

            if (buySignal) {
                // 상한선 없이 무제한 지수 증가 (또는 고정 1배)
                const multiplier = useVMartingale
                    ? (vMartingaleMultiplierMode === 'fixed' ? 1 : Math.pow(2, entries.length))
                    : 1;

                const entry = {
                    type: 'buy',
                    timestamp: curr.timestamp,
                    price: curr.close,
                    index: i,
                    multiplier: multiplier,
                    reason: entries.length > 0 ? `V-Martingale Add (#${entries.length + 1})` : 'Strategy Match'
                };

                entries.push(entry);

                if (currentPosition === null) {
                    buyRecord = entry;
                    currentPosition = 'long';
                    highestPriceDuringTrade = curr.close;
                }
            }
        }

        // --- 매도/청산 판단 ---
        if (currentPosition === 'long') {
            let sellSignal = (prevSign === 'positive' && currSign === 'negative');
            let sellReason = 'Slope Down';


            if (curr.high > highestPriceDuringTrade) {
                highestPriceDuringTrade = curr.high;
            }

            if (useSellAtBB2 && prev.bbStatus >= 2) {
                sellSignal = true;
                sellReason = 'BB Upper Break (+2)';
            }

            if (useVMartingale && sellSignal) {
                const totalMultiplier = entries.reduce((sum, e) => sum + e.multiplier, 0);
                const avgPrice = entries.reduce((sum, e) => sum + (e.price * e.multiplier), 0) / totalMultiplier;
                const currentProfitRate = ((curr.close - avgPrice) / avgPrice) * 100;

                if (currentProfitRate < vMartingaleProfitCut) {
                    sellSignal = false;
                }
            }

            if (useStopLoss || useTakeProfit || useTrailingStop) {
                const basePrice = useVMartingale
                    ? (entries.reduce((sum, e) => sum + (e.price * e.multiplier), 0) / entries.reduce((sum, e) => sum + e.multiplier, 0))
                    : buyRecord.price;

                const currentProfitRate = ((curr.close - basePrice) / basePrice) * 100;
                const dropFromPeakPcnt = ((curr.close - highestPriceDuringTrade) / highestPriceDuringTrade) * 100;

                if (useStopLoss && currentProfitRate <= stopLossPcnt) {
                    sellSignal = true;
                    sellReason = `Stop Loss (${stopLossPcnt}%)`;
                } else if (useTakeProfit && currentProfitRate >= takeProfitPcnt) {
                    sellSignal = true;
                    sellReason = `Take Profit (${takeProfitPcnt}%)`;
                } else if (useTrailingStop && dropFromPeakPcnt <= trailingStopPcnt) {
                    sellSignal = true;
                    sellReason = `Trailing Stop (${trailingStopPcnt}%)`;
                }
            }

            // 정규장 시간 외 매도 제한 (최종 체크)
            if (curr.isRegular === false) {
                sellSignal = false;
            }

            if (sellSignal) {
                const sellRecord = {
                    type: 'sell',
                    timestamp: curr.timestamp,
                    price: curr.close,
                    index: i,
                    reason: sellReason
                };

                if (useVMartingale) {
                    const totalMultiplier = entries.reduce((sum, e) => sum + e.multiplier, 0);
                    const avgPrice = entries.reduce((sum, e) => sum + (e.price * e.multiplier), 0) / totalMultiplier;
                    const profit = sellRecord.price - avgPrice;
                    const profitRate = (profit / avgPrice) * 100;

                    trades.push({
                        cycle: trades.length + 1,
                        buy: buyRecord,
                        entries: [...entries],
                        sell: sellRecord,
                        avgPrice,
                        totalMultiplier,
                        profit,
                        profitRate,
                    });
                } else {
                    const profit = sellRecord.price - buyRecord.price;
                    const profitRate = (profit / buyRecord.price) * 100;
                    trades.push({
                        cycle: trades.length + 1,
                        buy: buyRecord,
                        sell: sellRecord,
                        profit,
                        profitRate,
                    });
                }

                currentPosition = null;
                buyRecord = null;
                entries = [];
            }
        }
    }

    return trades;
}

export function generateTrades(dataWithSlope, strategy = 'standard') {
    if (strategy === 'fixedQtyBB') {
        return generateIntegratedTrades(dataWithSlope, { useBB: true });
    }
    return generateIntegratedTrades(dataWithSlope, { useBB: false });
}

function applyTradingCosts(price, quantity, type, costs = TRADING_COSTS) {
    if (type === 'buy') {
        const actualPrice = price * (1 + costs.slippage);
        const fee = quantity * costs.buyFee;
        const totalCost = quantity + fee;
        const btcAmount = quantity / actualPrice;
        return { actualPrice, fee, totalCost, btcAmount };
    } else {
        const actualPrice = price * (1 - costs.slippage);
        const grossRevenue = quantity * actualPrice;
        const fee = grossRevenue * costs.sellFee;
        const netRevenue = grossRevenue - fee;
        return { actualPrice, fee, netRevenue };
    }
}

/**
 * 고정 수량 방식의 시뮬레이션 결과를 계산합니다.
 * @param {Array<Object>} trades - 매매 내역
 * @param {number} [quantity=100000] - 1회 매수 금액/수량
 * @param {Object} [costs=TRADING_COSTS] - 수수료 설정
 * @returns {Object} 시뮬레이션 결과 요약 및 상세 내역
 */
export function calculateFixedQuantityResult(trades, quantity = 100000, costs = TRADING_COSTS) {
    let totalProfit = 0;
    let totalFees = 0;
    let wins = 0;
    let losses = 0;

    const tradeDetails = trades.map(trade => {
        const buyResult = applyTradingCosts(trade.buy.price, quantity, 'buy', costs);
        const btcAmount = buyResult.btcAmount;
        const buyCost = buyResult.totalCost;
        const buyFee = buyResult.fee;
        const actualBuyPrice = buyResult.actualPrice;

        const sellResult = applyTradingCosts(trade.sell.price, btcAmount, 'sell', costs);
        const sellRevenue = sellResult.netRevenue;
        const sellFee = sellResult.fee;
        const actualSellPrice = sellResult.actualPrice;

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
            costs,
        },
    };
}

/**
 * 복리(누적) 방식의 시뮬레이션 결과를 계산합니다.
 * @param {Array<Object>} trades - 매매 내역
 * @param {number} [initialCapital=100000] - 초기 자본금
 * @param {Object} [costs=TRADING_COSTS] - 수수료 설정
 * @returns {Object} 시뮬레이션 결과 요약 및 상세 내역
 */
export function calculateCumulativeResult(trades, initialCapital = 100000, costs = TRADING_COSTS) {
    let currentCapital = initialCapital;
    let totalFees = 0;
    let wins = 0;
    let losses = 0;
    let peakCapital = initialCapital;
    let maxDrawdown = 0;

    const tradeDetails = trades.map(trade => {
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

        const actualInvest = quantity / (1 + costs.buyFee);
        const buyFee = quantity - actualInvest;
        const actualBuyPrice = trade.buy.price * (1 + costs.slippage);
        const btcAmount = actualInvest / actualBuyPrice;

        const actualSellPrice = trade.sell.price * (1 - costs.slippage);
        const grossRevenue = btcAmount * actualSellPrice;
        const sellFee = grossRevenue * costs.sellFee;
        const netRevenue = grossRevenue - sellFee;

        const realProfit = netRevenue - quantity;
        const realProfitRate = (realProfit / quantity) * 100;

        if (realProfit > 0) wins++;
        else losses++;

        totalFees += buyFee + sellFee;
        currentCapital = netRevenue;

        if (currentCapital > peakCapital) peakCapital = currentCapital;
        const drawdown = (peakCapital - currentCapital) / peakCapital * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        return {
            ...trade,
            quantity,
            btcAmount,
            actualBuyPrice,
            actualSellPrice,
            buyCost: quantity,
            sellRevenue: netRevenue,
            buyFee,
            sellFee,
            totalFee: buyFee + sellFee,
            realProfit,
            realProfitRate,
            currentCapital,
            sellValue: netRevenue,
        };
    });

    const totalCycles = trades.length;
    const winRate = totalCycles > 0 ? (wins / totalCycles) * 100 : 0;
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
            maxDrawdown,
            finalCapital: currentCapital,
            costs,
        },
    };
}

/**
 * 마틴게일 방식의 시뮬레이션 결과를 계산합니다.
 * @param {Array<Object>} trades - 매매 내역
 * @param {number} [baseQuantity=100000] - 기본 매수 단위
 * @param {number} [multiplier=1.5] - 손실 시 배수
 * @param {Object} [costs=TRADING_COSTS] - 수수료 설정
 * @returns {Object} 시뮬레이션 결과 요약 및 상세 내역
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
        const buyResult = applyTradingCosts(trade.buy.price, quantity, 'buy', costs);
        const btcAmount = buyResult.btcAmount;
        const buyCost = buyResult.totalCost;
        const buyFee = buyResult.fee;
        const actualBuyPrice = buyResult.actualPrice;

        const sellResult = applyTradingCosts(trade.sell.price, btcAmount, 'sell', costs);
        const sellRevenue = sellResult.netRevenue;
        const sellFee = sellResult.fee;
        const actualSellPrice = sellResult.actualPrice;

        const realProfit = sellRevenue - buyCost;
        const realProfitRate = (realProfit / buyCost) * 100;

        const usedMultiplier = currentMultiplier;

        if (realProfit > 0) {
            wins++;
            currentMultiplier = 1;
        } else {
            losses++;
            currentMultiplier *= multiplier;
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
 * V-Martingale(변동성 기반 분할 매수) 방식의 시뮬레이션 결과를 계산합니다.
 * @param {Array<Object>} trades - 매매 내역 (다회 매수 포함)
 * @param {number} [baseQuantity=100000] - 기본 매수 단위
 * @param {Object} [costs=TRADING_COSTS] - 수수료 설정
 * @returns {Object} 시뮬레이션 결과 요약 및 상세 내역
 */
export function calculateVMartingaleResult(trades, baseQuantity = 100000, costs = TRADING_COSTS) {
    let totalProfit = 0;
    let totalFees = 0;
    let wins = 0;
    let losses = 0;
    let maxMultiplier = 1;

    const tradeDetails = trades.map(trade => {
        let totalBuyCost = 0;
        let totalBtcAmount = 0;
        let cycleFees = 0;

        const entryDetails = trade.entries.map(entry => {
            const quantity = baseQuantity * entry.multiplier;
            const buyResult = applyTradingCosts(entry.price, quantity, 'buy', costs);

            totalBuyCost += buyResult.totalCost;
            totalBtcAmount += buyResult.btcAmount;
            cycleFees += buyResult.fee;

            if (entry.multiplier > maxMultiplier) maxMultiplier = entry.multiplier;

            return {
                ...entry,
                quantity,
                btcAmount: buyResult.btcAmount,
                actualBuyPrice: buyResult.actualPrice,
                buyFee: buyResult.fee
            };
        });

        const sellResult = applyTradingCosts(trade.sell.price, totalBtcAmount, 'sell', costs);
        const sellRevenue = sellResult.netRevenue;
        cycleFees += sellResult.fee;

        const realProfit = sellRevenue - totalBuyCost;
        const realProfitRate = (realProfit / totalBuyCost) * 100;

        if (realProfit > 0) wins++;
        else losses++;

        totalProfit += realProfit;
        totalFees += cycleFees;

        return {
            ...trade,
            entries: entryDetails,
            totalBtcAmount,
            totalBuyCost,
            sellRevenue,
            totalFee: cycleFees,
            realProfit,
            realProfitRate,
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
 * 현재 데이터와 전략 옵션에 따른 실시간 매매 신호를 분석합니다. (정규장 시간 외 매매 제한 포함)
 * @param {Array<Object>} dataWithSlope - 지표가 포함된 캔들 데이터
 * @param {Object} options - 매매 전략 옵션
 * @returns {Object} 분석 결과 (signal: 'BUY'|'SELL'|'HOLD', reason: string)
 */
export function analyzeSignal(dataWithSlope, options = {}) {
    const {
        useBB = false,
        useTrend = false,
        useTrend20 = false,
        useRSI = false,
        useVolumeFilter = false,
        useSellAtBB2 = false
    } = options;

    if (!dataWithSlope || dataWithSlope.length < 2) {
        return { signal: 'HOLD', reason: 'Insufficient Data' };
    }

    const lastIndex = dataWithSlope.length - 1;
    const curr = dataWithSlope[lastIndex];
    const prev = dataWithSlope[lastIndex - 1];

    if (curr.slope === undefined || prev.slope === undefined) {
        return { signal: 'HOLD', reason: 'Calculating...' };
    }

    const prevSign = prev.slope > 0 ? 'positive' : prev.slope < 0 ? 'negative' : 'zero';
    const currSign = curr.slope > 0 ? 'positive' : curr.slope < 0 ? 'negative' : 'zero';

    let buySignal = (prevSign === 'negative' && currSign === 'positive');
    let buyReason = 'Slope Up';

    if (buySignal) {
        const failures = [];
        if (useBB && prev.bbStatus !== -2) failures.push('BB');
        if (useTrend && curr.ma50 && curr.close < curr.ma50) failures.push('Trend(50)');
        if (useTrend20 && curr.ma20 && curr.close < curr.ma20) failures.push('Trend(20)');
        if (useRSI && curr.rsi !== undefined && curr.rsi > 70) failures.push('RSI');
        if (useVolumeFilter && curr.vma20 && curr.volume < curr.vma20) failures.push('Volume');

        if (failures.length > 0) {
            buySignal = false;
            buyReason = `Slope Up (Locked: ${failures.join(', ')})`;
        } else {
            buyReason = 'Strategy Match (BUY)';
        }
    }

    // 정규장 시간 외 매매 제한
    if (curr.isRegular === false) {
        if (buySignal) {
            buySignal = false;
            buyReason = 'Market Closed (Pre/Post)';
        }
    }

    if (buySignal) return { signal: 'BUY', reason: buyReason };

    if (useSellAtBB2 && curr.bbStatus >= 2) {
        return { signal: 'SELL', reason: 'BB Upper Break' };
    }

    if (prevSign === 'positive' && currSign === 'negative') {
        return { signal: 'SELL', reason: 'Slope Down' };
    }

    let currentStatus = curr.slope > 0 ? 'Rising' : 'Falling';
    let extra = '';
    if (curr.bbStatus === 2) extra = ' (Overbought)';
    if (curr.bbStatus === -2) extra = ' (Oversold)';

    if (!buySignal && (prevSign === 'negative' && currSign === 'positive')) {
        return { signal: 'HOLD', reason: buyReason };
    }

    return { signal: 'HOLD', reason: `Maintains ${currentStatus}${extra}` };
}
