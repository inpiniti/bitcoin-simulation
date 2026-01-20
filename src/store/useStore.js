import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { fetchCoinDailyData, fetchStockOneYearData, fetchStockNews, getSentimentScore } from '@/lib/api'
import { addDerivedData, generateIntegratedTrades, calculateFixedQuantityResult, calculateCumulativeResult, calculateMartingaleResult, analyzeSignal } from '@/lib/dataProcessor'

// IndexedDB 스토리지 어댑터
const indexedDBStorage = {
    getItem: async (name) => {
        const value = await idbGet(name)
        return value ?? null
    },
    setItem: async (name, value) => {
        await idbSet(name, value)
    },
    removeItem: async (name) => {
        await idbDel(name)
    },
}

/**
 * 시뮬레이션 및 상용 거래를 위한 중앙 상태 관리 스토어 (Zustand)
 * 
 * @typedef {Object} StoreState
 * @property {string} mode - 현재 모드 ('stock' 또는 'coin')
 * @property {string} ticker - 현재 선택된 종목 코드
 * @property {string} viewMode - 현재 뷰 모드 ('simulation', 'dataView', 'chartView', 'analyze')
 * @property {Object} hist - 일봉 데이터 저장소
 * @property {Object} simul - 시뮬레이션 결과 저장소
 * @property {Object} dataCache - 티커별 데이터 캐시
 * @property {Object} strategyOptions - 매매 전략 설정
 * @property {Object} autoTradeSettings - 자동 매매 설정
 * @property {Object} kisAuth - 한국투자증권 인증 정보
 * 
 * @returns {StoreState} Zustand 스토어 객체
 */
export const useStore = create(
    devtools(
        persist(
            (set, get) => ({
                // Global Settings
                mode: 'stock', // 'coin' | 'stock' (Default)
                ticker: 'AAPL', // Stock ticker

                // View Mode (새로운 모드 시스템)
                viewMode: 'simulation', // 'simulation' | 'dataView' | 'chartView' | 'analyze'

                // History data - 일봉만 사용 (단순화)
                hist: {
                    '1d': [],
                },

                // Simulation results
                simul: {},
                dataCache: {}, // { [ticker]: { timestamp: number, data: array } }

                // Loading states
                loadingInterval: {},
                loadingSimul: {},

                // Currently selected simulation result to display
                selectedResult: null,

                // Recommended Stocks (DataRoma)
                recommendedStocks: [],
                lastRecommendedFetch: 0,
                loadingRecommendations: false,

                // Global Error State (for AlertDialog)
                globalError: null,

                // Strategy Options
                strategyOptions: {
                    moneyManagement: 'fixed', // 'fixed' | 'cumulative'
                    isCompound: false,
                    useBB: false,
                    useTrend: false,
                    useTrend20: false,
                    useRSI: false,
                    useVolumeFilter: false,
                    useStopLoss: false,
                    stopLossPcnt: -2.0,
                    useTakeProfit: false,
                    takeProfitPcnt: 5.0,
                    useTrailingStop: false,
                    trailingStopPcnt: -2.0,
                    martingaleMultiplier: 1.0,
                    useVMartingale: false,
                    vMartingaleProfitCut: 2.0,
                    baseQuantity: 100000,
                },

                // Auto Trading Settings
                autoTradeSettings: {
                    isEnabled: false,
                    targetGroup: 'myholdings', // 'myholdings', 'sp500', 'superinvestor', etc.
                    amountType: 'quantity', // 'quantity' | 'amount'
                    buyAmount: 1, // 수량(주) 또는 금액($)
                    executionTimeMinutes: 30, // 장 마감 N분 전
                    // 전략 옵션 (자동 매매 전용)
                    useBB: false, // 볼린저 밴드 필터
                    useTrend: false, // 추세 필터 (MA50)
                    useTrend20: false, // 추세 필터 (MA20)
                    useRSI: false, // RSI 필터
                    useVolumeFilter: false, // 거래량 필터
                    // V-Martingale (강화 매수) 설정
                    useVMartingale: false, // V-Martingale 활성화
                    vMartingaleProfitCut: 2.0, // 최소 매도 수익률 (%)
                },

                autoTradeStatus: {
                    lastRunDate: null, // YYYY-MM-DD
                    logs: [],
                },

                setAutoTradeSettings: (settings) => set(state => ({
                    autoTradeSettings: { ...state.autoTradeSettings, ...settings }
                })),

                addAutoTradeLog: (message) => set(state => ({
                    autoTradeStatus: {
                        ...state.autoTradeStatus,
                        logs: [{ time: new Date().toISOString(), message }, ...state.autoTradeStatus.logs].slice(0, 100) // 최근 100개 유지
                    }
                })),

                setLastRunDate: (dateStr) => set(state => ({
                    autoTradeStatus: { ...state.autoTradeStatus, lastRunDate: dateStr }
                })),

                // Market Analysis State & Actions
                analysisResult: [],
                isAnalyzing: false,
                analysisProgress: { current: 0, total: 0 },

                // Actions
                setViewMode: (viewMode) => set({ viewMode }),
                setGlobalError: (error) => set({ globalError: error }),

                updateStrategyOptions: (options) => set(state => ({
                    strategyOptions: { ...state.strategyOptions, ...options }
                })),

                // Ticker Group Selection
                tickerGroup: 'superinvestor', // 'superinvestor' | 'myholdings' | 'pricesurge' | 'pricedrop' | 'volumesurge'
                setTickerGroup: (group) => set({ tickerGroup: group }),

                // Korea Investment Securities (KIS) Authentication
                kisAuth: {
                    isLoggedIn: false,
                    appkey: '',
                    appsecret: '',
                    accountNo: '', // 계좌번호 앞 8자리
                    accountCode: '', // 계좌번호 뒤 2자리
                    accessToken: '',
                    tokenExpiry: null,
                },

                /**
                 * 한국투자증권(KIS) 로그인 및 액세스 토큰 발급
                 * 
                 * @param {string} appkey - KIS API 앱키
                 * @param {string} appsecret - KIS API 앱시크릿
                 * @param {string} accountNo - 계좌번호 (8자리)
                 * @param {string} accountCode - 계좌상품코드 (2자리)
                 * @returns {Promise<{success: boolean, error?: string}>} 로그인 성공 여부
                 */
                loginKIS: async (appkey, appsecret, accountNo, accountCode) => {
                    try {
                        const { getAccessToken } = await import('@/lib/kisApi')
                        const result = await getAccessToken(appkey, appsecret)

                        if (result.success) {
                            set({
                                kisAuth: {
                                    isLoggedIn: true,
                                    appkey,
                                    appsecret,
                                    accountNo,
                                    accountCode,
                                    accessToken: result.access_token,
                                    tokenExpiry: result.access_token_token_expired,
                                }
                            })
                            return { success: true }
                        } else {
                            return { success: false, error: result.error }
                        }
                    } catch (error) {
                        console.error('KIS 로그인 오류:', error)
                        return { success: false, error: error.message }
                    }
                },

                /**
                 * KIS 로그아웃 및 액세스 토큰 폐기
                 * @returns {Promise<void>}
                 */
                logoutKIS: async () => {
                    const state = get()
                    if (state.kisAuth.accessToken) {
                        try {
                            const { revokeAccessToken } = await import('@/lib/kisApi')
                            await revokeAccessToken(
                                state.kisAuth.appkey,
                                state.kisAuth.appsecret,
                                state.kisAuth.accessToken
                            )
                        } catch (error) {
                            console.error('토큰 폐기 오류:', error)
                        }
                    }

                    set({
                        kisAuth: {
                            isLoggedIn: false,
                            appkey: '',
                            appsecret: '',
                            accountNo: '',
                            accountCode: '',
                            accessToken: '',
                            tokenExpiry: null,
                        }
                    })
                },

                /**
                 * KIS 재로그인 (기존 세션을 유지하며 토큰만 재발급)
                 * @returns {Promise<{success: boolean, error?: string}>} 재로그인 성공 여부
                 */
                reloginKIS: async () => {
                    const state = get()
                    const { appkey, appsecret, accountNo, accountCode, accessToken } = state.kisAuth

                    // 인증 정보가 없으면 실패
                    if (!appkey || !appsecret || !accountNo || !accountCode) {
                        return { success: false, error: '저장된 인증 정보가 없습니다.' }
                    }

                    try {
                        // 1. 기존 토큰 폐기 시도 (실패해도 계속 진행)
                        if (accessToken) {
                            try {
                                const { revokeAccessToken } = await import('@/lib/kisApi')
                                await revokeAccessToken(appkey, appsecret, accessToken)
                                console.log('[KIS] 기존 토큰 폐기 완료')
                            } catch (error) {
                                console.warn('[KIS] 토큰 폐기 실패 (계속 진행):', error.message)
                            }
                        }

                        // 2. 새 토큰 발급
                        const { getAccessToken } = await import('@/lib/kisApi')
                        const result = await getAccessToken(appkey, appsecret)

                        if (result.success) {
                            set({
                                kisAuth: {
                                    isLoggedIn: true,
                                    appkey,
                                    appsecret,
                                    accountNo,
                                    accountCode,
                                    accessToken: result.access_token,
                                    tokenExpiry: result.access_token_token_expired,
                                }
                            })
                            console.log('[KIS] 재로그인 성공')
                            return { success: true }
                        } else {
                            // 토큰 발급 실패 시 로그아웃 상태로 변경
                            set(s => ({
                                kisAuth: {
                                    ...s.kisAuth,
                                    isLoggedIn: false,
                                    accessToken: '',
                                    tokenExpiry: null,
                                }
                            }))
                            return { success: false, error: result.error }
                        }
                    } catch (error) {
                        console.error('[KIS] 재로그인 오류:', error)
                        return { success: false, error: error.message }
                    }
                },

                // Group Stocks (Ticker Group Data)
                groupStocks: [],
                loadingGroupStocks: false,
                setGroupStocks: (stocks) => set({ groupStocks: stocks }),
                setLoadingGroupStocks: (loading) => set({ loadingGroupStocks: loading }),

                /**
                 * 그룹 종목 데이터 로드 (TitleBar, Sidebar 공통 사용)
                 */
                fetchGroupStocks: async () => {
                    const state = get();
                    const { tickerGroup, kisAuth, recommendedStocks, loadRecommendedTickers, setGroupStocks, setLoadingGroupStocks } = state;

                    if (tickerGroup === 'superinvestor') {
                        if (recommendedStocks.length === 0) {
                            await loadRecommendedTickers();
                        }
                        // loadRecommendedTickers가 비동기 완료 후 store 업데이트 이미 함.
                        // 다시 get() 해서 최신 상태 확인
                        const currentRecommended = get().recommendedStocks;
                        if (currentRecommended.length > 0) {
                            setGroupStocks(currentRecommended);
                        }
                        return;
                    }

                    if (tickerGroup === 'sp500') {
                        setLoadingGroupStocks(true);
                        try {
                            const { fetchSP500Tickers } = await import('@/lib/sp500Data');
                            const stocks = await fetchSP500Tickers();
                            setGroupStocks(stocks);
                        } catch (e) {
                            console.error('S&P 500 fetch error', e);
                            setGroupStocks([]);
                        } finally {
                            setLoadingGroupStocks(false);
                        }
                        return;
                    }

                    if (tickerGroup === 'kospi200') {
                        setLoadingGroupStocks(true);
                        try {
                            const { fetchKospi200Tickers } = await import('@/lib/api');
                            const stocks = await fetchKospi200Tickers();
                            setGroupStocks(stocks);
                        } catch (e) {
                            console.error('KOSPI 200 fetch error', e);
                            setGroupStocks([]);
                        } finally {
                            setLoadingGroupStocks(false);
                        }
                        return;
                    }

                    if (tickerGroup === 'kosdaq150') {
                        setLoadingGroupStocks(true);
                        try {
                            const { fetchKosdaq150Tickers } = await import('@/lib/api');
                            const stocks = await fetchKosdaq150Tickers();
                            setGroupStocks(stocks);
                        } catch (e) {
                            console.error('KOSDAQ 150 fetch error', e);
                            setGroupStocks([]);
                        } finally {
                            setLoadingGroupStocks(false);
                        }
                        return;
                    }

                    if (tickerGroup === 'qqq') {
                        setLoadingGroupStocks(true);
                        try {
                            const { fetchQQQTickers } = await import('@/lib/qqqData');
                            const stocks = await fetchQQQTickers();
                            setGroupStocks(stocks);
                        } catch (e) {
                            console.error('Nasdaq 100 fetch error', e);
                            setGroupStocks([]);
                        } finally {
                            setLoadingGroupStocks(false);
                        }
                        return;
                    }

                    if (tickerGroup === 'indices') {
                        setGroupStocks([
                            { ticker: '^GSPC', name: 'S&P 500', exchange: 'SNP' },
                            { ticker: '^NDX', name: 'Nasdaq 100', exchange: 'NAS' },
                            { ticker: '^IXIC', name: 'Nasdaq Composite', exchange: 'NAS' },
                            { ticker: '^DJI', name: 'Dow Jones Industrial Average', exchange: 'DJI' },
                            { ticker: '^RUT', name: 'Russell 2000', exchange: 'RUS' },
                            { ticker: '^VIX', name: 'CBOE Volatility Index', exchange: 'CBOE' },
                            { ticker: '^SOX', name: 'PHLX Semiconductor Sector', exchange: 'PHI' },
                            { ticker: 'GC=F', name: 'Gold Futures', exchange: 'COMEX' },
                            { ticker: 'CL=F', name: 'Crude Oil Futures', exchange: 'NYM' },
                            { ticker: 'BTC-USD', name: 'Bitcoin USD', exchange: 'CRYPTO' },
                            { ticker: '^KS11', name: 'KOSPI Composite Index', exchange: 'KOSPI' },
                            { ticker: '^KQ11', name: 'KOSDAQ Composite Index', exchange: 'KOSDAQ' },
                        ]);
                        return;
                    }

                    if (!kisAuth.isLoggedIn) {
                        setGroupStocks([]);
                        return;
                    }

                    setLoadingGroupStocks(true);
                    try {
                        const { accessToken, appkey, appsecret, accountNo, accountCode } = kisAuth;




                        if (tickerGroup === 'myholdings') {
                            const { getOverseasBalance } = await import('@/lib/kisApi');
                            const result = await getOverseasBalance(accessToken, appkey, appsecret, accountNo, accountCode);
                            if (result.success) {
                                setGroupStocks(result.holdings
                                    .filter(h => Number(h.ccld_qty_smtl1) > 0 && parseFloat(h.frcr_evlu_amt2) > 0)
                                    .map(h => ({
                                        ticker: h.pdno,
                                        name: h.prdt_name,
                                        count: parseInt(h.ccld_qty_smtl1 || 0),
                                        exchange: h.ovrs_excg_cd
                                    })));
                            }
                        } else if (tickerGroup === 'pricedrop') {
                            const { getPriceFluctuation } = await import('@/lib/kisApi');
                            const result = await getPriceFluctuation(accessToken, appkey, appsecret, 'fall', 'NAS', '8');
                            if (result.success) {
                                setGroupStocks(result.stocks.map(s => ({
                                    ticker: s.ticker,
                                    name: s.name,
                                    count: parseFloat(s.changeRate || 0).toFixed(2) + '%',
                                    exchange: 'NAS'
                                })));
                            }
                        } else if (tickerGroup === 'pricesurge') {
                            const { getPriceFluctuation } = await import('@/lib/kisApi');
                            const result = await getPriceFluctuation(accessToken, appkey, appsecret, 'rise', 'NAS', '8');
                            if (result.success) {
                                setGroupStocks(result.stocks.map(s => ({
                                    ticker: s.ticker,
                                    name: s.name,
                                    count: '+' + parseFloat(s.changeRate || 0).toFixed(2) + '%',
                                    exchange: 'NAS'
                                })));
                            }
                        } else if (tickerGroup === 'volumesurge') {
                            const { getVolumeSurge } = await import('@/lib/kisApi');
                            const result = await getVolumeSurge(accessToken, appkey, appsecret, 'NAS', '8');
                            if (result.success) {
                                setGroupStocks(result.stocks.map(s => ({
                                    ticker: s.ticker,
                                    name: s.name,
                                    count: parseFloat(s.volumeRate || 0).toFixed(0) + '%',
                                    exchange: 'NAS'
                                })));
                            }
                        }
                    } catch (error) {
                        console.error('그룹 종목 로드 오류:', error);
                    } finally {
                        setLoadingGroupStocks(false);
                    }
                },

                // 분석 중지
                stopAnalysis: () => set({ isAnalyzing: false }),

                /**
                 * 시장 스캐너 실행: 현재 로드된 모든 종목에 대해 전략 분석 수행
                 * @returns {Promise<void>}
                 */
                runMarketAnalysis: async () => {
                    const state = get();
                    let stocks = [];

                    // tickerGroup에 따라 분석 대상 결정
                    // 모든 그룹(superinvestor 포함)은 TitleBar 등에서 이미 groupStocks로 로드되어 있어야 함.
                    stocks = state.groupStocks;

                    if (stocks.length === 0) {
                        get().setGlobalError('분석할 종목 데이터가 없습니다. 종목이 로드되었는지 확인해주세요.');
                        return;
                    }

                    // 분석 실행
                    // KIS 데이터, Dataroma 데이터 모두 groupStocks에 { ticker, name, count, exchange? } 형태로 있음
                    // 거래소 정보는 상세 데이터 조회 시(fetchStockShortData) Yahoo Finance 메타데이터로 보정됨.

                    set({
                        isAnalyzing: true,
                        analysisResult: [],
                        analysisProgress: { current: 0, total: stocks.length }
                    });

                    const results = [];
                    const options = state.strategyOptions;
                    let processedCount = 0;

                    for (const stock of stocks) {
                        // 사용자 중지 체크
                        if (!get().isAnalyzing) break;

                        try {
                            const now = Date.now();
                            const today = new Date().toISOString().split('T')[0];

                            let rawData;
                            let exchange = stock.exchange || 'NAS';
                            const cachedEntry = state.dataCache[stock.ticker];

                            // KIS에서 가져온 티커가 Yahoo Finance 형식과 다를 수 있으므로 주의 (ex. 005930.KS)
                            // 현재 해외 주식이므로 대부분 호환될 것으로 예상 (AAPL, TSLA...)
                            if (cachedEntry && new Date(cachedEntry.timestamp).toISOString().split('T')[0] === today) {
                                rawData = cachedEntry.data;
                                if (cachedEntry.exchange) exchange = cachedEntry.exchange;
                            } else {
                                rawData = await fetchStockOneYearData(stock.ticker);
                                if (rawData && rawData.exchange) exchange = rawData.exchange;

                                if (rawData && rawData.length > 0) {
                                    set(s => ({
                                        dataCache: {
                                            ...s.dataCache,
                                            [stock.ticker]: { timestamp: now, data: rawData, exchange }
                                        }
                                    }));
                                }
                            }

                            if (!rawData || rawData.length < 20) {
                                results.push({ ticker: stock.ticker, signal: 'SKIP', reason: 'Not enough data' });
                                processedCount++;
                                set({
                                    analysisProgress: { current: processedCount, total: stocks.length },
                                    analysisResult: [...results]
                                });
                                continue;
                            }

                            const dataWithSlope = addDerivedData(rawData);
                            const analysis = analyzeSignal(dataWithSlope, options);

                            let sentimentScore = 0;
                            let newsHeadlines = [];
                            try {
                                newsHeadlines = await fetchStockNews(stock.ticker);
                                sentimentScore = await getSentimentScore(newsHeadlines);
                            } catch (err) {
                                console.warn(`News fetch failed for ${stock.ticker}`, err);
                            }

                            const lastCandle = dataWithSlope[dataWithSlope.length - 1];
                            const prevCandle = dataWithSlope[dataWithSlope.length - 2];

                            const changeRate = prevCandle
                                ? ((lastCandle.close - prevCandle.close) / prevCandle.close * 100)
                                : 0;

                            results.push({
                                ticker: stock.ticker,
                                name: stock.name || stock.ticker,
                                signal: analysis.signal,
                                reason: analysis.reason,
                                price: lastCandle.close,
                                changeRate: changeRate,
                                slope: lastCandle.slope,
                                bbStatus: lastCandle.bbStatus,
                                sentiment: sentimentScore,
                                news: newsHeadlines,
                                timestamp: lastCandle.timestamp,
                                exchange: exchange
                            });

                        } catch (e) {
                            console.warn(`Analysis failed for ${stock.ticker}:`, e);
                            results.push({
                                ticker: stock.ticker,
                                signal: 'ERROR',
                                reason: 'Load Failed',
                                price: 0
                            });
                        }

                        processedCount++;
                        set({
                            analysisProgress: { current: processedCount, total: stocks.length },
                            analysisResult: [...results]
                        });

                        await new Promise(r => setTimeout(r, 10));
                    }

                    const priority = { 'BUY': 0, 'SELL': 1, 'HOLD': 2, 'SKIP': 3, 'ERROR': 4 };
                    results.sort((a, b) => (priority[a.signal] ?? 99) - (priority[b.signal] ?? 99));

                    set({ analysisResult: results, isAnalyzing: false });
                },

                /**
                 * 추천 종목 로드 (24시간 캐시 적용)
                 */
                loadRecommendedTickers: async () => {
                    const state = get();
                    const now = Date.now();
                    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

                    if (state.recommendedStocks.length > 0 && (now - state.lastRecommendedFetch < TWENTY_FOUR_HOURS)) {
                        return;
                    }

                    set({ loadingRecommendations: true });
                    try {
                        const { fetchRecommendedTickers } = await import('@/lib/api');
                        const stocks = await fetchRecommendedTickers();
                        set({
                            recommendedStocks: stocks,
                            lastRecommendedFetch: now,
                            loadingRecommendations: false
                        });
                    } catch (error) {
                        console.error('Failed to load recommended tickers:', error);
                        set({ loadingRecommendations: false });
                    }
                },

                setMode: (mode) => {
                    const currentMode = get().mode;
                    if (currentMode !== mode) {
                        get().clearAllData();
                        set({ mode });

                        setTimeout(() => {
                            get().loadDailyData();
                        }, 0);
                    }
                },

                setTicker: (ticker) => {
                    const currentTicker = get().ticker;
                    const mode = get().mode;

                    if (currentTicker !== ticker) {
                        get().clearAllData();
                        set({ ticker });

                        setTimeout(() => {
                            get().loadDailyData();
                        }, 0);
                    }
                },

                // Ticker Tab Management
                activeTickers: [], // ['AAPL', 'TSLA', ...]
                tickerNames: {}, // { 'AAPL': 'Apple Inc.', ... }

                openTicker: (ticker, name) => {
                    const state = get();

                    // 이름 정보가 있으면 저장 (또는 업데이트)
                    if (name) {
                        set(s => ({
                            tickerNames: {
                                ...s.tickerNames,
                                [ticker]: name
                            }
                        }));
                    }

                    // 이미 있으면 활성화만
                    if (!state.activeTickers.includes(ticker)) {
                        set({ activeTickers: [...state.activeTickers, ticker] });
                    }
                    get().setTicker(ticker);
                },

                closeTicker: (tickerToClose) => {
                    const state = get();
                    const newTickers = state.activeTickers.filter(t => t !== tickerToClose);

                    // 닫을 때 이름 정보도 지울지? -> 굳이 안 지워도 됨 (캐시처럼 사용)
                    // const newNames = { ...state.tickerNames };
                    // delete newNames[tickerToClose];

                    set({ activeTickers: newTickers });

                    if (state.ticker === tickerToClose) {
                        // 닫은 탭이 현재 활성 탭이라면
                        if (newTickers.length > 0) {
                            // 마지막 탭으로 이동
                            const nextTicker = newTickers[newTickers.length - 1];
                            get().setTicker(nextTicker);
                        } else {
                            // 탭이 하나도 없으면
                            set({ ticker: '' }); // 또는 기본값
                        }
                    }
                },

                /**
                 * 선택된 종목의 일봉 데이터를 로드합니다 (캐시 또는 API).
                 * @returns {Promise<void>}
                 */
                loadDailyData: async () => {
                    const state = get();
                    const ticker = state.ticker;

                    // 티커가 없으면 중단
                    if (!ticker) return;

                    // 이미 데이터가 있고(length > 5), 현재 티커 데이터가 맞으면(확인 필요하지만 여기선 hist['1d']가 현재 티커꺼라고 가정) 리턴?
                    // 하지만 탭 전환 시 hist['1d']를 갈아끼워야 하므로 무조건 실행해야 함.

                    set((s) => ({ loadingInterval: { ...s.loadingInterval, '1d': true } }));

                    try {
                        const now = Date.now();
                        const today = new Date().toISOString().split('T')[0];
                        let rawData = null;

                        // 1. 캐시 확인 (Stock 모드일 때만)
                        if (state.mode === 'stock') {
                            const cachedEntry = state.dataCache[ticker];
                            if (cachedEntry && new Date(cachedEntry.timestamp).toISOString().split('T')[0] === today) {
                                console.log(`[Store] Using cached data for ${ticker}`);
                                rawData = cachedEntry.data;
                            }
                        }

                        // 2. 캐시 없으면 API 호출
                        if (!rawData) {
                            if (state.mode === 'coin') {
                                rawData = await fetchCoinDailyData();
                            } else {
                                rawData = await fetchStockOneYearData(ticker);
                            }

                            // 캐시 저장 (Stock만)
                            if (state.mode === 'stock' && rawData && rawData.length > 0) {
                                set(s => ({
                                    dataCache: {
                                        ...s.dataCache,
                                        [ticker]: {
                                            timestamp: now,
                                            data: rawData,
                                            // exchange 정보는 fetchStockShortData에서만 옴. 여기선 일단 패스하거나 보주 
                                        }
                                    }
                                }));
                            }
                        }

                        if (!rawData || rawData.length <= 5) {
                            console.warn(`[Warning] Fetched data count is too low (${rawData?.length}).`);
                        }

                        const dataWithSlope = addDerivedData(rawData);

                        set((s) => ({
                            hist: { ...s.hist, '1d': dataWithSlope },
                            loadingInterval: { ...s.loadingInterval, '1d': false },
                        }));

                    } catch (error) {
                        console.error('Failed to load daily data:', error);
                        set((s) => ({ loadingInterval: { ...s.loadingInterval, '1d': false } }));
                        get().setGlobalError({ title: '데이터 로드 실패', description: error.message });
                    }
                },

                /**
                 * 설정된 전략 옵션에 따라 통합 시뮬레이션을 실행합니다.
                 * @returns {Promise<void>}
                 */
                runSimulation: async () => {
                    const state = get();
                    const data = state.hist['1d'];

                    if (!data || data.length === 0) {
                        get().setGlobalError('데이터가 없습니다. 먼저 데이터를 로드해주세요.');
                        return;
                    }

                    const options = state.strategyOptions;

                    const trades = generateIntegratedTrades(data, options);

                    if (trades.length === 0) {
                        get().setGlobalError('해당 조건으로 발생한 매매 내역이 없습니다.');
                        return;
                    }

                    let result;
                    if (options.useVMartingale) {
                        const { calculateVMartingaleResult } = await import('@/lib/dataProcessor');
                        result = calculateVMartingaleResult(trades, options.baseQuantity);
                    } else if (options.martingaleMultiplier > 1.0) {
                        result = calculateMartingaleResult(trades, options.baseQuantity, options.martingaleMultiplier);
                    } else if (options.moneyManagement === 'cumulative') {
                        result = calculateCumulativeResult(trades, options.baseQuantity);
                    } else {
                        result = calculateFixedQuantityResult(trades, options.baseQuantity);
                    }

                    const key = `sim_${Date.now()}`;
                    const resultWithMeta = {
                        ...result,
                        options: { ...options }
                    };

                    set(s => ({
                        simul: { ...s.simul, [key]: resultWithMeta },
                        selectedResult: { key, ...resultWithMeta },
                        viewMode: 'simulation' // 시뮬레이션 실행 후 뷰 전환
                    }));
                },

                setSelectedResult: (result) => set({ selectedResult: result }),

                /**
                 * 스토어 초기화 (데이터 삭제)
                 */
                clearAllData: () => set({
                    hist: { '1d': [] },
                    simul: {},
                    selectedResult: null,
                    // recommendedStocks는 유지 (티커 변경 시 매번 로드 방지)
                }),
            }),
            {
                name: 'bitcoin-simulation-storage-v2',
                storage: createJSONStorage(() => indexedDBStorage),
                partialize: (state) => ({
                    mode: state.mode,
                    ticker: state.ticker,
                    activeTickers: state.activeTickers, // Persist active tabs
                    tickerNames: state.tickerNames, // 이름 맵 저장
                    hist: state.hist,
                    simul: state.simul,
                    viewMode: state.viewMode,
                    recommendedStocks: state.recommendedStocks,
                    lastRecommendedFetch: state.lastRecommendedFetch,
                    dataCache: state.dataCache,
                    kisAuth: state.kisAuth, // KIS 로그인 상태 저장
                    autoTradeSettings: state.autoTradeSettings,
                    autoTradeStatus: state.autoTradeStatus,
                }),
            }
        ),
        {
            name: 'BitcoinSimulation',
            enabled: import.meta.env.DEV,
            serialize: {
                replacer: (key, value) => {
                    if (key === 'hist' || key === 'simul' || key === 'dataCache') {
                        return '[대용량 데이터 생략]';
                    }
                    return value;
                }
            }
        }
    )
)
