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
 * @param {boolean} includePrePost - 장전/장후 데이터 포함 여부 (기본: false)
 * @returns {Promise<Array>} 정규화된 캔들 데이터
 */
/**
 * 티커를 Yahoo Finance 호환 심볼로 변환
 * - 6자리 숫자(한국 종목) -> XXXXXX.KS (코스피 200은 코스닥 종목이 거의 없으므로 기본 KS 적용)
 * - 점(.) -> 하이픈(-) (미국 주식, 예: BRK.B -> BRK-B)
 */
function convertToYahooSymbol(ticker) {
    if (/^\d{6}$/.test(ticker)) {
        return `${ticker}.KS`;
    }
    return ticker.replace(/\./g, '-');
}

/**
 * Yahoo Finance API를 통해 주식 데이터 조회
 * @param {string} ticker - 종목 코드 (예: AAPL)
 * @param {string} interval - 데이터 간격 (기본: 1d)
 * @param {string} range - 데이터 범위 (기본: 365d)
 * @param {boolean} includePrePost - 장전/장후 데이터 포함 여부 (기본: false)
 * @returns {Promise<Array>} 정규화된 캔들 데이터
 */
export async function fetchStockData(ticker, interval = '1d', range = '365d', includePrePost = false) {
    // Yahoo Finance 호환성을 위해 심볼 변환
    const formattedTicker = convertToYahooSymbol(ticker);

    // CORS 문제를 회피하기 위해 Vite Proxy(/api/yahoo)를 사용합니다.
    const url = `/api/yahoo/v8/finance/chart/${formattedTicker}?interval=${interval}&range=${range}&includePrePost=${includePrePost}`;
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

    // tradingPeriods 확인 (장 운영 시간 정보) - 필요 시 사용
    // const tradingPeriods = result.meta.tradingPeriods;

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
        else if (exchangeName === 'KOE') exchangeName = 'KOSPI'; // KOSPI
        else if (exchangeName === 'KOR') exchangeName = 'KOSPI'; // KOSPI

        normalized.exchange = exchangeName;
    }

    console.log(`[API] Stock data loaded: ${normalized.length} items for ${formattedTicker} (${range})`);
    return normalized;
}

/**
 * 1년치 일봉 조회 (하위 호환 및 기본 사용)
 */
export async function fetchStockOneYearData(ticker) {
    return fetchStockData(ticker, '1d', '365d');
}

/**
 * 1분봉 데이터 조회 (최근 1일치)
 * 실시간 시뮬레이션 차트에서 사용
 * @param {string} ticker - 종목 코드 (예: AAPL)
 * @returns {Promise<Array>} 정규화된 1분봉 데이터
 */
export async function fetchStockMinuteData(ticker) {
    // 1분봉 조회 시 장전/장후 데이터(includePrePost) 포함
    return fetchStockData(ticker, '1m', '1d', true);
}

/**
 * KOSPI 200 주요 종목 리스트 반환
 * @returns {Promise<Array>} { ticker, name, count } 배열
 */
export async function fetchKospi200Tickers() {
    // 주요 시가총액 상위 종목 (샘플)
    // 실제로는 더 많은 리스트를 추가하거나 외부 소스에서 가져와야 함.
    const kospiList = [
        { ticker: "005930", name: "삼성전자", count: 1 },
        { ticker: "000660", name: "SK하이닉스", count: 2 },
        { ticker: "373220", name: "LG에너지솔루션", count: 3 },
        { ticker: "207940", name: "삼성바이오로직스", count: 4 },
        { ticker: "005380", name: "현대차", count: 5 },
        { ticker: "005935", name: "삼성전자우", count: 6 },
        { ticker: "000270", name: "기아", count: 7 },
        { ticker: "068270", name: "셀트리온", count: 8 },
        { ticker: "105560", name: "KB금융", count: 9 },
        { ticker: "005490", name: "POSCO홀딩스", count: 10 },
        { ticker: "035420", name: "NAVER", count: 11 },
        { ticker: "055550", name: "신한지주", count: 12 },
        { ticker: "003550", name: "LG화학", count: 13 },
        { ticker: "051910", name: "LG화학", count: 14 },
        { ticker: "000810", name: "삼성화재", count: 15 },
        { ticker: "032830", name: "삼성생명", count: 16 },
        { ticker: "015760", name: "한국전력", count: 17 },
        { ticker: "018260", name: "삼성에스디에스", count: 18 },
        { ticker: "034730", name: "SK", count: 19 },
        { ticker: "003670", name: "포스코퓨처엠", count: 20 },
        { ticker: "086790", name: "하나금융지주", count: 21 },
        { ticker: "009150", name: "삼성전기", count: 22 },
        { ticker: "010130", name: "고려아연", count: 23 },
        { ticker: "017670", name: "SK텔레콤", count: 24 },
        { ticker: "000100", name: "유한양행", count: 25 },
        { ticker: "090430", name: "아모레퍼시픽", count: 26 },
        { ticker: "012330", name: "현대모비스", count: 27 },
        { ticker: "034020", name: "두산에너빌리티", count: 28 },
        { ticker: "316140", name: "우리금융지주", count: 29 },
        { ticker: "011200", name: "HMM", count: 30 },
        { ticker: "009540", name: "HD한국조선해양", count: 31 },
        { ticker: "066570", name: "LG전자", count: 32 },
        { ticker: "259960", name: "크래프톤", count: 33 },
        { ticker: "033780", name: "KT&G", count: 34 },
        { ticker: "003490", name: "대한항공", count: 35 },
        { ticker: "035720", name: "카카오", count: 36 },
        { ticker: "323410", name: "카카오뱅크", count: 37 },
        { ticker: "028260", name: "삼성물산", count: 38 },
        { ticker: "010950", name: "S-Oil", count: 39 },
        { ticker: "000720", name: "현대건설", count: 40 },
        { ticker: "024110", name: "기업은행", count: 41 },
        { ticker: "030200", name: "KT", count: 42 },
        { ticker: "006400", name: "삼성SDI", count: 43 },
        { ticker: "011170", name: "롯데케미칼", count: 44 },
        { ticker: "326030", name: "SK바이오팜", count: 45 },
        { ticker: "010120", name: "LS ELECTRIC", count: 46 },
        { ticker: "096770", name: "SK이노베이션", count: 47 },
        { ticker: "036570", name: "엔씨소프트", count: 48 },
        { ticker: "251270", name: "넷마블", count: 49 },
        { ticker: "352820", name: "하이브", count: 50 },
    ];
    return Promise.resolve(kospiList);
}

/**
 * KOSDAQ 150 주요 종목 리스트 반환
 * @returns {Promise<Array>} { ticker, name, count } 배열
 */
export async function fetchKosdaq150Tickers() {
    // 주요 시가총액 상위 종목 (샘플)
    const kosdaqList = [
        { ticker: "247540", name: "에코프로비엠", count: 1 },
        { ticker: "086520", name: "에코프로", count: 2 },
        { ticker: "091990", name: "셀트리온헬스케어", count: 3 }, // 합병 이슈가 있지만 예전 데이터 조회용으로 유지 or HLB 등
        { ticker: "028300", name: "HLB", count: 3 }, // 순위 조정
        { ticker: "022100", name: "포스코DX", count: 4 }, // 코스피 이전 이슈 확인 필요하지만 일단 리스트업
        { ticker: "066970", name: "엘앤에프", count: 5 }, // 코스피 이전 이슈
        { ticker: "196170", name: "알테오젠", count: 6 },
        { ticker: "035900", name: "JYP Ent.", count: 7 },
        { ticker: "293490", name: "카카오게임즈", count: 8 },
        { ticker: "036930", name: "주성엔지니어링", count: 9 }, // 예시
        { ticker: "403870", name: "HPSP", count: 10 },
        { ticker: "278280", name: "천보", count: 11 },
        { ticker: "214150", name: "클래시스", count: 12 },
        { ticker: "095610", name: "테스", count: 13 },
        { ticker: "039030", name: "이오테크닉스", count: 14 },
        { ticker: "145020", name: "휴젤", count: 15 },
        { ticker: "041510", name: "에스엠", count: 16 },
        { ticker: "025980", name: "아난티", count: 17 },
        { ticker: "005290", name: "동진쎄미켐", count: 18 },
        { ticker: "034230", name: "파라다이스", count: 19 },
        { ticker: "237690", name: "에스티팜", count: 20 },
        { ticker: "058470", name: "리노공업", count: 21 },
        { ticker: "096530", name: "씨젠", count: 22 },
        { ticker: "263750", name: "펄어비스", count: 23 },
        { ticker: "357780", name: "솔브레인", count: 24 },
        { ticker: "068760", name: "셀트리온제약", count: 25 },
        { ticker: "213420", name: "덕산네오룩스", count: 26 },
        { ticker: "112040", name: "위메이드", count: 27 },
        { ticker: "290650", name: "엘앤씨바이오", count: 28 },
        { ticker: "067160", name: "아프리카TV", count: 29 }, // SOOP으로 사명 변경되었으나 구 티커 유지
        { ticker: "032190", name: "다우데이타", count: 30 },
    ];
    return Promise.resolve(kosdaqList);
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
        // Yahoo Finance 호환성을 위해 심볼 변환 (KOSPI .KS 처리 포함)
        const formattedSymbol = convertToYahooSymbol(symbol);

        const response = await fetch('/api/forecast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Motia/1.0',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ symbol: formattedSymbol, interval }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Forecast API Error:', response.status, response.statusText, errorText);
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

/**
 * 세력 수급 분석 API 호출 (Whale Analysis)
 * @param {string} symbol - 종목 코드 (예: AAPL)
 * @param {string} interval - 데이터 간격 (기본: 'day')
 * @returns {Promise<Object|null>} 분석 결과 또는 null
 */
export async function fetchWhaleAnalysis(symbol, interval = 'day') {
    try {
        const response = await fetch('/api/whale', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Motia/1.0',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ symbol, interval }),
        });

        if (!response.ok) {
            console.error('Whale API Error:', response.statusText);
            return null;
        }

        const data = await response.json();
        console.log(`[API] Whale analysis loaded for ${symbol}`);
        return data;
    } catch (err) {
        console.error('Whale API Error:', err);
        return null;
    }
}
/**
 * 기업 개요 및 재무 정보 조회 (Hybrid: Double Scraper)
 * Yahoo Finance API v10/v7 모두 차단 시, Profile과 Quote 페이지를 각각 스크래핑합니다.
 * @param {string} ticker
 */
export async function fetchStockOverview(ticker) {
    const formattedTicker = ticker.replace(/\./g, '-');

    try {
        // 병렬 호출 (둘 다 로컬 미들웨어 스크래퍼)
        const [profileRes, quoteRes] = await Promise.all([
            fetch(`/api/company-profile?ticker=${formattedTicker}`),
            fetch(`/api/company-quote?ticker=${formattedTicker}`)
        ]);

        const profileData = profileRes.ok ? await profileRes.json() : null;
        const quoteData = quoteRes.ok ? await quoteRes.json() : null; // { marketCap, trailingPE, ... }

        // 스크래퍼 데이터는 이미 문자열이거나 null임. 포맷팅 불필요하나 구조 맞춤.
        const fmt = (val) => ({ fmt: val || '-' });

        return {
            profile: profileData?.assetProfile || {},
            financials: {
                marketCap: fmt(quoteData?.marketCap),
                currentPrice: fmt(quoteData?.regularMarketPrice),
                targetMeanPrice: fmt('-'),
                recommendationKey: '-', // 스크래핑 복잡도 높음
                returnOnAssets: fmt(quoteData?.eps ? `EPS: ${quoteData.eps}` : '-'), // EPS를 임시로 보여줌
                returnOnEquity: fmt('-'),
            },
            stats: {
                enterpriseValue: fmt('-'),
                trailingPE: fmt(quoteData?.trailingPE),
                forwardPE: fmt('-'),
                priceToBook: fmt('-'),
                beta: fmt(quoteData?.beta),
                profitMargins: fmt('-'),
                operatingMargins: fmt('-')
            },
            recommendation: [],
            earnings: { financialsChart: { yearly: [], quarterly: [] } }
        };
    } catch (e) {
        console.error(`Overview fetch failed for ${ticker}:`, e);
        return null;
    }
}

