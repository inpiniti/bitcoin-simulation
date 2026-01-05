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
 * 데이터에 파생 지표(Median, Slope, Bollinger Bands) 추가
 * 1. Median: (Open + Close) / 2
 * 2. Slope: 현재 Median - 이전 Median
 * 3. Bollinger Bands: Median 기준 20-period, 2-multiplier
 * 
 * @param {Array} data - 캔들 데이터 배열
 * @returns {Array} 파생 지표가 추가된 데이터
 */
export function addDerivedData(data) {
    // 1. Median & Slope 계산
    const withMedianAndSlope = data.map((item, index) => {
        const median = (item.open + item.close) / 2;
        const prevMedian = index > 0 ? (data[index - 1].open + data[index - 1].close) / 2 : undefined;
        const slope = prevMedian !== undefined ? median - prevMedian : undefined;

        return {
            ...item,
            median,
            slope,
        };
    });

    // 2. Bollinger Bands 계산 (Median 기준)
    const period = 20;
    const multiplier = 2;

    return withMedianAndSlope.map((item, index, array) => {
        if (index < period - 1) {
            // 충분한 데이터가 없을 경우
            return { ...item, bbStatus: 0, bbUpper: undefined, bbLower: undefined, bbMean: undefined };
        }

        // 지난 20개(현재 포함)의 Median 데이터 가져오기
        const slice = array.slice(index - period + 1, index + 1).map(d => d.median);

        // 평균 (SMA - Middle Band)
        const mean = slice.reduce((sum, val) => sum + val, 0) / period;

        // 표준편차 (Standard Deviation)
        const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
        const stdDev = Math.sqrt(variance);

        // 상단/하단 밴드
        const upperBand = mean + (multiplier * stdDev);
        const lowerBand = mean - (multiplier * stdDev);

        // 상태값(Status) 결정 (Median Price 기준)
        // 2: 상단 밴드 이탈 (Price > Upper Band)
        // 1: 상단 구간 (Mean < Price <= Upper Band)
        // -1: 하단 구간 (Lower Band <= Price < Mean)
        // -2: 하단 밴드 이탈 (Price < Lower Band)
        let bbStatus = 0;
        const price = item.median;

        if (price > upperBand) bbStatus = 2;
        else if (price > mean && price <= upperBand) bbStatus = 1;
        else if (price >= lowerBand && price < mean) bbStatus = -1;
        else if (price < lowerBand) bbStatus = -2;

        return {
            ...item,
            bbUpper: upperBand,
            bbLower: lowerBand,
            bbMean: mean,
            bbStatus,
        };
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
 * 기울기 변화에 따른 매매 기록 생성
 * @param {Array} dataWithSlope - 기울기가 포함된 데이터
 * @param {string} strategy - 전략 ('standard' | 'fixedQtyBB')
 * @returns {Array} 매매 기록 배열
 */
export function generateTrades(dataWithSlope, strategy = 'standard') {
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

        let buySignal = false;
        let sellSignal = false;

        if (strategy === 'fixedQtyBB') {
            // [전략: 수량 고정 + BB]
            // 매수: 기울기 양전 AND (이전 캔들 BB Status == -2 (하단 이탈))
            if (prevSign === 'negative' && currSign === 'positive') {
                if (prev.bbStatus === -2) {
                    buySignal = true;
                }
            }
            // 매도: 기울기 음전 AND (보유 수량이 있을 때 -> currentPosition === 'long')
            else if (prevSign === 'positive' && currSign === 'negative') {
                sellSignal = true;
            }
        } else {
            // [기본 전략: Standard]
            // 매수: 기울기 양전
            if (prevSign === 'negative' && currSign === 'positive') {
                buySignal = true;
            }
            // 매도: 기울기 음전
            else if (prevSign === 'positive' && currSign === 'negative') {
                sellSignal = true;
            }
        }

        // 실제 매매 실행 로직
        // 매수 신호 & 포지션 없음
        if (buySignal && currentPosition === null) {
            buyRecord = {
                type: 'buy',
                timestamp: curr.timestamp,
                price: curr.close, // 매매는 여전히 실제 체결가(close) 기준
                index: i,
                reason: strategy === 'fixedQtyBB' ? 'Slope Up & BB Lower Break' : 'Slope Up'
            };
            currentPosition = 'long';
        }
        // 매도 신호 & 포지션 보유 중 (Long)
        else if (sellSignal && currentPosition === 'long') {
            const sellRecord = {
                type: 'sell',
                timestamp: curr.timestamp,
                price: curr.close, // 매매는 여전히 실제 체결가(close) 기준
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
 * @param {string} strategy - 전략 ('standard' | 'fixedQtyBB' 등)
 * @returns {Object} { signal: 'BUY'|'SELL'|'HOLD', reason: string }
 */
export function analyzeSignal(dataWithSlope, strategy = 'standard') {
    if (!dataWithSlope || dataWithSlope.length < 2) {
        return { signal: 'HOLD', reason: 'Insufficient Data' };
    }

    const lastIndex = dataWithSlope.length - 1;
    const curr = dataWithSlope[lastIndex];
    const prev = dataWithSlope[lastIndex - 1];

    // 기울기가 undefined이면 판단 불가
    if (curr.slope === undefined || prev.slope === undefined) {
        return { signal: 'HOLD', reason: 'Calculating Slope' };
    }

    const prevSign = prev.slope > 0 ? 'positive' : prev.slope < 0 ? 'negative' : 'zero';
    const currSign = curr.slope > 0 ? 'positive' : curr.slope < 0 ? 'negative' : 'zero';

    // 전략별 신호 판단
    // 전략 이름에 'BB'가 포함되어 있으면 볼린저 밴드 전략 적용 (대소문자 무관하게 체크)
    if (strategy && strategy.toLowerCase().includes('bb')) {
        // 매수: 기울기 양전(음->양) AND (직전 캔들의 BB Status가 -2(하단이탈) 였음)
        if (prevSign === 'negative' && currSign === 'positive') {
            if (prev.bbStatus === -2) {
                return { signal: 'BUY', reason: 'Slope Up & BB Rebound' };
            }
        }
        // 매도: 기울기 음전(양->음)
        else if (prevSign === 'positive' && currSign === 'negative') {
            return { signal: 'SELL', reason: 'Slope Down' };
        }
    } else {
        // Standard (기본 전략 - Slope만 봄)
        if (prevSign === 'negative' && currSign === 'positive') {
            return { signal: 'BUY', reason: 'Golden Cross (Slope)' };
        }
        else if (prevSign === 'positive' && currSign === 'negative') {
            return { signal: 'SELL', reason: 'Dead Cross (Slope)' };
        }
    }

    // 변화 없음 (HOLD)
    // 현재 상태가 상승세인지 하락세인지 정보 제공
    let currentStatus = curr.slope > 0 ? 'Rising' : 'Falling';

    // 추가 정보: BB 상태가 특이하면 표시
    let extra = '';
    if (curr.bbStatus === 2) extra = ' (Overbought)';
    if (curr.bbStatus === -2) extra = ' (Oversold)';

    return { signal: 'HOLD', reason: `Maintains ${currentStatus}${extra}` };
}
