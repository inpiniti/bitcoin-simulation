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
 * @returns {Promise<Array>} 정규화된 캔들 데이터 (isRegular 필드 포함)
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

    // tradingPeriods 확인 (장 운영 시간 정보)
    const tradingPeriods = result.meta.tradingPeriods;
    const regularPeriods = tradingPeriods && tradingPeriods.regular ? tradingPeriods.regular.flat() : [];

    const { open, high, low, close, volume } = indicators;

    // 데이터 정규화 및 병합 (Upbit 데이터 구조와 호환성 유지)
    const normalized = timestamps.map((t, i) => {
        // 데이터 누락(null) 처리
        if (open[i] == null || high[i] == null || low[i] == null || close[i] == null) return null;

        const date = new Date(t * 1000);
        const isoDate = date.toISOString();

        // 정규장 여부 확인 (timestamp t는 unix timestamp)
        // 일봉(1d)은 항상 정규장으로 간주, 분봉(1m)은 tradingPeriods 기준 판단
        const isRegular = interval === '1d'
            ? true
            : (regularPeriods.length > 0 ? regularPeriods.some(p => t >= p.start && t < p.end) : true);

        return {
            // 표준 필드
            timestamp: isoDate,
            isRegular,
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
 * 주식 과거 데이터 조회 (일봉)
 * @param {string} ticker - 종목 코드
 * @param {number|string} days - 조회 기간 (일 단위 또는 Yahoo range 형식)
 * @returns {Promise<Array>} 정규화된 캔들 데이터
 */
export async function fetchStockHistory(ticker, days = 365) {
    const range = typeof days === 'number' ? `${days}d` : days;
    return fetchStockData(ticker, '1d', range);
}


/**
 * 1분봉 데이터 조회 (최근 7일치)
 * 실시간 시뮬레이션 차트에서 사용
 * @param {string} ticker - 종목 코드 (예: AAPL)
 * @returns {Promise<Array>} 정규화된 1분봉 데이터
 */
export async function fetchStockMinuteData(ticker) {
    // 1분봉 조회 시 장전/장후 데이터(includePrePost) 포함
    // 야후 파이낸스 API의 1분봉 최대 조회 범위인 7일로 확장
    return fetchStockData(ticker, '1m', '7d', true);
}

/**
 * KOSPI 200 종목 리스트를 한국어 위키백과에서 가져옵니다.
 * @returns {Promise<Array>} { ticker, name, count } 배열
 */
export async function fetchKospi200Tickers() {
    try {
        const response = await fetch('/api/index-stocks/kospi200');
        if (!response.ok) throw new Error('Failed to fetch KOSPI 200 list');
        const stocks = await response.json();
        return stocks;
    } catch (error) {
        console.warn('KOSPI 200 리스트 로드 실패 (Fallback 사용):', error);
        // 실패 시 기존의 50개 샘플 리스트 반환
        return [
            { ticker: "005930", name: "삼성전자", count: "전기전자", exchange: "KOSPI" },
            { ticker: "000660", name: "SK하이닉스", count: "전기전자", exchange: "KOSPI" },
            { ticker: "373220", name: "LG에너지솔루션", count: "전기전자", exchange: "KOSPI" },
            // ... (원하는 만큼 추가하거나 메시지로 설명)
        ];
    }
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
            // Cold Start나 일시적 서버 오류일 경우 조용히 처리 (사용자 경험 보호)
            console.warn(`[AI Forecast] 예측 서버 응답 없음 (${response.status}). 잠시 후 다시 시도하세요.`);
            return null;
        }

        const data = await response.json();
        console.log(`[API] Forecast loaded for ${symbol}:`, data.predictionCount, 'predictions');
        return data;
    } catch (err) {
        // 네트워크 에러 등 (Failed to fetch)
        console.warn(`[AI Forecast] API 연결 실패: ${err.message}. (서버가 절전 모드일 수 있음)`);
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
            fetch(`/api/company/profile?ticker=${formattedTicker}`),
            fetch(`/api/company/quote?ticker=${formattedTicker}`)
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

/**
 * Nasdaq API를 이용한 실적 데이터 조회
 * @param {string} ticker 
 */
export async function fetchEarningsData(ticker) {
    const symbol = ticker.toUpperCase().replace(/\./g, '-');
    const url = `/api/nasdaq/company/${symbol}/earnings-surprise`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Nasdaq fetch failed for ${ticker}`);

        const json = await response.json();
        const data = json.data;

        if (!data || !data.earningsSurpriseTable || !data.earningsSurpriseTable.rows) {
            return null;
        }

        // Nasdaq 데이터를 우리 앱 형식에 매핑
        const history = data.earningsSurpriseTable.rows.map(row => ({
            quarter: { fmt: row.dateReported || 'Unknown' },
            actual: { raw: parseFloat(row.actualEPS) || 0, fmt: row.actualEPS },
            estimate: { raw: parseFloat(row.consensusEPS) || 0, fmt: row.consensusEPS },
            surprisePercent: {
                raw: (parseFloat(row.surprisePcnt) || 0) / 100,
                fmt: (row.surprisePcnt || '0') + '%'
            }
        }));

        return {
            history: history,
            trend: [],
            calendar: {
                earningsDate: history.length > 0 ? [history[0].quarter] : []
            }
        };
    } catch (e) {
        console.error(`Earnings fetch failed for ${ticker} from Nasdaq:`, e);
        return null;
    }
}
/**
 * AI 모델의 상태를 확인하고 워밍업을 시도합니다.
 * Hugging Face Inference API의 특성상 일정 시간 미사용 시 모델이 절전 모드로 전환되므로,
 * 본격적인 요청 전 모델을 활성화시키기 위해 사용합니다.
 * 
 * @async
 * @param {string} [model="deepset/roberta-base-squad2"] - 대상 모델 식별자
 * @returns {Promise<{status: 'ready'|'loading'|'error', estimated_time?: number, message?: string}>} 서버 상태 객체
 * 
 * @example
 * const result = await warmupAIModel("deepset/roberta-base-squad2");
 * if (result.status === 'loading') console.log(`Wait for ${result.estimated_time}s`);
 */
export async function warmupAIModel(model = "deepset/roberta-base-squad2") {
    // QA 모델 여부 확인 (구조화된 입력을 요구함)
    const isQA = model.includes("squad") || model.includes("qa") || model.includes("roberta");
    const inputs = isQA ? { question: "warmup", context: "The AI is warming up." } : "warmup";

    try {
        const response = await fetch("/api/hf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                inputs,
                options: { wait_for_model: true }
            }),
        });

        if (response.status === 503) {
            const data = await response.json();
            return { status: 'loading', ...data };
        }

        if (response.ok) {
            return { status: 'ready' };
        }

        // 400 에러 등이 발생해도 서버 자체는 살아있으므로 ready로 간주할지 고민해봐야 함.
        // 여기선 모델 활성화 여부가 중요하므로, 에러 텍스트를 로그로 남김.
        const errorText = await response.text();
        console.warn(`AI Warmup Response (${response.status}):`, errorText);

        return { status: 'ready', message: 'Model exists but returned error for warmup input' };
    } catch (err) {
        console.error('AI Warmup Network Error:', err);
        return { status: 'error' };
    }
}
