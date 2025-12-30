const UPBIT_CANDLE_URL = "https://api.upbit.com/v1/candles/minutes/1";

/**
 * 업비트 1분봉 데이터를 조회합니다.
 * @param {string} to - 마지막 캔들 시간 (ISO8601)
 * @returns {Promise<Array>}
 */
export async function fetchUpbitCandles(to = "") {
    const url = `${UPBIT_CANDLE_URL}?market=KRW-BTC&count=200${to ? `&to=${to}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch Upbit candles");
    return await response.json();
}

/**
 * 1초에 10번씩 호출하여 1년치(약 2628회) 데이터를 가져옵니다.
 * @param {Function} onProgress - 조회 진행 상황 콜백 (current, total)
 * @returns {Promise<Array>} 정규화된 캔들 데이터
 */
export async function fetchOneYearData(onProgress) {
    let allData = [];
    let lastTime = "";
    const totalCalls = 2628;

    for (let i = 0; i < totalCalls; i++) {
        try {
            const candles = await fetchUpbitCandles(lastTime);
            if (candles.length === 0) break;

            // 정규화
            const normalized = candles.map(c => ({
                timestamp: c.candle_date_time_kst,
                open: c.opening_price,
                high: c.high_price,
                low: c.low_price,
                close: c.trade_price,
                volume: c.candle_acc_trade_volume,
            }));

            allData = [...allData, ...normalized];
            lastTime = candles[candles.length - 1].candle_date_time_utc + "Z";

            if (onProgress) onProgress(i + 1, totalCalls);

            // 1초에 10번 호출을 위한 대기 (100ms)
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`Error at call ${i + 1}:`, error);
            // 에러 시 잠시 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return allData.reverse(); // 과거 순에서 현재 순으로 정렬
}

/**
 * Yahoo Finance API를 통해 주식 1년치 일봉 데이터 조회
 * @param {string} ticker - 종목 코드 (예: AAPL)
 * @returns {Promise<Array>} 정규화된 캔들 데이터
 */
export async function fetchStockOneYearData(ticker) {
    // CORS 문제를 회피하기 위해 Vite Proxy(/api/yahoo)를 사용합니다.
    // Proxy 설정: vite.config.js
    const url = `/api/yahoo/v8/finance/chart/${ticker}?interval=1d&range=365d`;
    console.log(`Fetching stock data from: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch stock data for ${ticker}: ${response.statusText}`);
    }

    const json = await response.json();
    const result = json.chart.result[0];

    if (!result) {
        throw new Error("No data found");
    }

    const timestamps = result.timestamp;
    const indicators = result.indicators.quote[0];

    const { open, high, low, close, volume } = indicators;

    // 데이터 정규화 및 병합 (Upbit 데이터 구조와 호환성 유지)
    const normalized = timestamps.map((t, i) => {
        // 데이터 누락(null) 처리
        if (open[i] == null || high[i] == null || low[i] == null || close[i] == null) return null;

        const date = new Date(t * 1000);
        const isoDate = date.toISOString();

        return {
            // 표준 필드
            timestamp: isoDate,
            open: Number(open[i]),
            high: Number(high[i]),
            low: Number(low[i]),
            close: Number(close[i]),
            volume: Number(volume[i]),

            // Upbit 호환 필드
            candle_date_time_kst: isoDate,
            opening_price: Number(open[i]),
            high_price: Number(high[i]),
            low_price: Number(low[i]),
            trade_price: Number(close[i]),
            candle_acc_trade_volume: Number(volume[i]),
        };
    }).filter(item => item !== null); // 필터링

    console.log(`[API] Stock data loaded: ${normalized.length} items for ${ticker}`);
    return normalized;
}


