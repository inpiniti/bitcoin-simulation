import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { fetchCoinDailyData, fetchStockOneYearData, fetchStockShortData, fetchStockNews, getSentimentScore } from '@/lib/api'
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

export const useStore = create(
    devtools(
        persist(
            (set, get) => ({
                // Global Settings
                mode: 'stock', // 'coin' | 'stock'
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
                    baseQuantity: 100000,
                },

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
                 * KIS 로그인
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
                 * KIS 로그아웃
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

                // Group Stocks (Ticker Group Data)
                groupStocks: [],
                loadingGroupStocks: false,
                setGroupStocks: (stocks) => set({ groupStocks: stocks }),
                setLoadingGroupStocks: (loading) => set({ loadingGroupStocks: loading }),

                /**
                 * 시장 전체 분석 실행 (Market Scanner)
                 */
                runMarketAnalysis: async () => {
                    const state = get();
                    let stocks = [];

                    // tickerGroup에 따라 분석 대상 결정
                    if (state.tickerGroup === 'superinvestor') {
                        if (state.recommendedStocks.length === 0) {
                            await state.loadRecommendedTickers();
                        }
                        stocks = get().recommendedStocks;
                    } else {
                        // 'myholdings', 'pricedrop' 등은 TitleBar에서 이미 로드된 groupStocks 사용
                        stocks = state.groupStocks;
                    }

                    if (stocks.length === 0) {
                        get().setGlobalError('분석할 종목 데이터가 없습니다. 종목이 로드되었는지 확인해주세요.');
                        return;
                    }

                    // 분석 실행 (Superinvestor, My Holdings 등 모두 동일 로직)
                    // 단, Yahoo Finance/Upbit 데이터가 아닌 KIS 데이터 기반으로 분석하려면 로직 분기가 필요할 수 있음
                    // 현재는 모든 분석이 fetchStockShortData (Yahoo Finance) 기반으로 동작함.
                    // KIS 종목 코드(티커)가 Yahoo Finance와 호환된다면 문제 없음.

                    set({
                        isAnalyzing: true,
                        analysisResult: [],
                        analysisProgress: { current: 0, total: stocks.length }
                    });

                    const results = [];
                    const options = state.strategyOptions;
                    let processedCount = 0;

                    for (const stock of stocks) {
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
                                rawData = await fetchStockShortData(stock.ticker);
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
                                set({ analysisProgress: { current: processedCount, total: stocks.length } });
                                continue;
                            }

                            const dataWithSlope = addDerivedData(rawData);
                            const analysis = analyzeSignal(dataWithSlope, options);

                            // 뉴스 및 감성 분석은 시간이 오래 걸리므로 비동기 또는 생략 고려
                            // 일단 유지
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
                        set({ analysisProgress: { current: processedCount, total: stocks.length } });

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

                /**
                 * 일봉 데이터 로드 (Coin/Stock 공통)
                 */
                loadDailyData: async () => {
                    const state = get();
                    if (state.hist['1d'].length > 5) return;

                    set((s) => ({ loadingInterval: { ...s.loadingInterval, '1d': true } }));

                    try {
                        let rawData;

                        if (state.mode === 'coin') {
                            rawData = await fetchCoinDailyData();
                        } else {
                            rawData = await fetchStockOneYearData(state.ticker);
                        }

                        if (rawData.length <= 5) {
                            console.warn(`[Warning] Fetched data count is too low (${rawData.length}).`);
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
                 * 통합 시뮬레이션 실행
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
                    if (options.martingaleMultiplier > 1.0) {
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
                    recommendedStocks: [],
                    lastRecommendedFetch: 0,
                }),
            }),
            {
                name: 'bitcoin-simulation-storage-v2',
                storage: createJSONStorage(() => indexedDBStorage),
                partialize: (state) => ({
                    mode: state.mode,
                    ticker: state.ticker,
                    hist: state.hist,
                    simul: state.simul,
                    viewMode: state.viewMode,
                    recommendedStocks: state.recommendedStocks,
                    lastRecommendedFetch: state.lastRecommendedFetch,
                    dataCache: state.dataCache,
                    kisAuth: state.kisAuth, // KIS 로그인 상태 저장
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
