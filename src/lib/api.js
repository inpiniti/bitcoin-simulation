const UPBIT_DAILY_URL = "https://api.upbit.com/v1/candles/days";

/**
 * 업비트 일봉 데이터를 조회합니다 (1년치).
 * @returns {Promise<Array>} 정규화된 일봉 데이터
 */
export async function fetchCoinDailyData() {
    const url = `${UPBIT_DAILY_URL}?market=KRW-BTC&count=365`;
    console.log('[API] Fetching Coin daily data from Upbit...');

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch Upbit daily candles");

    const candles = await response.json();

    // 정규화 및 역순 정렬 (과거 → 현재)
    const normalized = candles.map(c => ({
        timestamp: c.candle_date_time_kst,
        open: c.opening_price,
        high: c.high_price,
        low: c.low_price,
        close: c.trade_price,
        volume: c.candle_acc_trade_volume,
    })).reverse();

    console.log(`[API] Coin daily data loaded: ${normalized.length} items`);
    return normalized;
}


/**
 * Yahoo Finance API를 통해 주식 데이터 조회
 * @param {string} ticker - 종목 코드 (예: AAPL)
 * @param {string} interval - 데이터 간격 (기본: 1d)
 * @param {string} range - 데이터 범위 (기본: 365d)
 * @returns {Promise<Array>} 정규화된 캔들 데이터
 */
export async function fetchStockData(ticker, interval = '1d', range = '365d') {
    // Yahoo Finance 호환성을 위해 (.)을 (-)로 변환 (예: BRK.B -> BRK-B)
    const formattedTicker = ticker.replace(/\./g, '-');

    // CORS 문제를 회피하기 위해 Vite Proxy(/api/yahoo)를 사용합니다.
    const url = `/api/yahoo/v8/finance/chart/${formattedTicker}?interval=${interval}&range=${range}`;
    console.log(`Fetching stock data from: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch stock data for ${formattedTicker}: ${response.statusText}`);
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

    // 메타 정보 추가 (거래소 정보 등)
    if (result.meta) {
        let exchangeName = result.meta.exchangeName || result.meta.fullExchangeName;

        // Yahoo Finance 거래소 코드 매핑 표준화
        if (exchangeName === 'NYQ') exchangeName = 'NYS';       // NYSE
        else if (exchangeName === 'NMS') exchangeName = 'NAS';  // NasdaqGS
        else if (exchangeName === 'NGM') exchangeName = 'NAS';  // NasdaqGM
        else if (exchangeName === 'NCM') exchangeName = 'NAS';  // NasdaqCM
        else if (exchangeName === 'ASE') exchangeName = 'AMS';  // AMEX
        else if (exchangeName === 'PNK') exchangeName = 'OTC';  // Pink Sheets

        normalized.exchange = exchangeName;
    }

    console.log(`[API] Stock data loaded: ${normalized.length} items for ${ticker} (${range})`);
    return normalized;
}

/**
 * 1년치 일봉 조회 (하위 호환 및 기본 사용)
 */
export async function fetchStockOneYearData(ticker) {
    return fetchStockData(ticker, '1d', '365d');
}

/**
 * 50일치 일봉 조회 (전체 분석용)
 */
export async function fetchStockShortData(ticker) {
    return fetchStockData(ticker, '1d', '60d'); // 여유있게 60일 (거래일 기준 50일 확보 위해)
}



/**
 * Dataroma 크롤링 API를 통해 추천 종목 리스트 조회 (자산가 5인 이상)
 * @returns {Promise<Array>} { ticker, name, count } 배열
 */
export async function fetchRecommendedTickers() {
    // Vercel Serverless Function 호출
    // 개발 환경(Vite Proxy)에서는 /api/dataroma 로 호출하면 vite.config.js 설정이 필요할 수 있음.
    // 하지만 현재 vite.config.js에는 /api/yahoo만 설정되어 있음.
    // 로컬 테스트를 위해 vite.config.js에 추가하거나, 배포 환경을 가정하고 호출.
    // 여기서는 상대 경로로 호출.

    // 주의: 로컬 Vite 개발 서버에서 /api/dataroma를 호출하려면 
    // vite.config.js proxy 설정이 필요하지 않음 (로컬 파일/함수가 아니므로).
    // 만약 로컬에서 테스트하려면 별도 서버가 떠있거나, Mock이 필요함.
    // Vercel dev를 쓰지 않는 한 로컬에서 api/dataroma.js는 동작하지 않음.
    // -> 따라서 에러 처리 필수.

    const response = await fetch('/api/dataroma');
    if (!response.ok) {
        throw new Error(`Failed to fetch recommendations: ${response.statusText}`);
    }

    const json = await response.json();
    return json.stocks || [];
}

/**
 * 야후 파이낸스에서 종목 관련 뉴스 헤드라인 수집
 */
export async function fetchStockNews(ticker) {
    try {
        const formattedTicker = ticker.replace('.', '-');
        const url = `/api/yahoo/v1/finance/search?q=${formattedTicker}&quotesCount=1&newsCount=5`;
        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        return (data.news || []).map(item => item.title);
    } catch (err) {
        console.error('Fetch News Error:', err);
        return [];
    }
}

/**
 * Hugging Face FinBERT를 이용한 텍스트 감성 분석 (Proxy 이용)
 * 점수: -1 (부정) ~ 1 (긍정)
 */
export async function getSentimentScore(textList) {
    if (!textList || textList.length === 0) return 0;

    try {
        const text = textList.join(". ");

        // 브라우저에서 직접 호출하지 않고, 내부 프록시(/api/hf)를 거쳐 호출합니다.
        // 이를 통해 API 토큰 노출을 방지하고 CORS 문제를 해결합니다.
        const response = await fetch("/api/hf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                inputs: text,
                model: "ProsusAI/finbert"
            }),
        });

        if (!response.ok) return 0;

        const result = await response.json();

        // FinBERT 결과 구조: [[{ label: 'positive', score: 0.9 }, ...]]
        const scores = result[0];
        if (!scores) return 0;

        const pos = scores.find(s => s.label === 'positive')?.score || 0;
        const neg = scores.find(s => s.label === 'negative')?.score || 0;

        return pos - neg;
    } catch (err) {
        console.error('Sentiment Analysis Error:', err);
        return 0;
    }
}

/**
 * AI 가격 예측 API 호출 (TimesFM-2.5 모델 기반)
 * @param {string} symbol - 종목 코드 (예: AAPL)
 * @param {string} interval - 예측 간격 ('day' 또는 'minute')
 * @returns {Promise<Object|null>} 예측 결과 또는 null
 */
export async function fetchForecast(symbol, interval = 'day') {
    try {
        const response = await fetch('https://younginpiniti-bitcoin-ai-backend.hf.space/v1/forecast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Motia/1.0',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ symbol, interval }),
        });

        if (!response.ok) {
            console.error('Forecast API Error:', response.statusText);
            return null;
        }

        const data = await response.json();
        console.log(`[API] Forecast loaded for ${symbol}:`, data.predictionCount, 'predictions');
        return data;
    } catch (err) {
        console.error('Forecast API Error:', err);
        return null;
    }
}
