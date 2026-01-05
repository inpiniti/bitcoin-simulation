import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { fetchOneYearData, fetchStockOneYearData, fetchStockShortData, fetchStockNews, getSentimentScore } from '@/lib/api'
import { aggregateToInterval, addSlopeData, generateTrades, calculateFixedQuantityResult, calculateCumulativeResult, calculateMartingaleResult, analyzeSignal, INTERVALS, addDerivedData } from '@/lib/dataProcessor'

// ... (existing code)



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
                mode: 'coin', // 'coin' | 'stock'
                ticker: 'AAPL', // Stock ticker

                // History data (with slope)
                hist: {
                    '1m': [],
                    '5m': [],
                    '15m': [],
                    '1h': [],
                    '2h': [],
                    '1d': [],
                    '2d': [],
                    '3d': [],
                    '4d': [],
                    '5d': [],
                    '6d': [],
                    '1w': [],
                },

                // Simulation results
                simul: {},
                dataCache: {}, // { [ticker]: { timestamp: number, data: array } }

                // Loading states
                loadingInterval: {},
                loadingSimul: {},

                // Progress for 1m fetch
                fetchProgress: { current: 0, total: 0 },

                // Currently active interval for simulation
                activeInterval: null,

                // Currently selected simulation result to display
                selectedResult: null,

                // Data View Mode (Toggle)
                dataViewMode: false,

                // Recommended Stocks (DataRoma)
                recommendedStocks: [],
                loadingRecommendations: false,

                // Global Error State (for AlertDialog)
                globalError: null,

                // Strategy Options
                strategyOptions: {
                    moneyManagement: 'fixed', // 'fixed' | 'cumulative'
                    isCompound: false,        // 단리/복리 (cumulative일 때 의미있음) 
                    useBB: false,
                    useTrend: false,
                    useRSI: false,
                    useVolumeFilter: false,
                    useStopLoss: false,
                    stopLossPcnt: -2.0,
                    useTakeProfit: false,
                    takeProfitPcnt: 5.0,
                    useTrailingStop: false,
                    trailingStopPcnt: -2.0,
                    martingaleMultiplier: 1.0, // 1.0 = No Martingale
                    baseQuantity: 100000,
                },

                // Actions
                setFetchProgress: (current, total) => set({ fetchProgress: { current, total } }),

                toggleDataViewMode: () => set((state) => ({ dataViewMode: !state.dataViewMode })),

                setGlobalError: (error) => set({ globalError: error }),

                updateStrategyOptions: (options) => set(state => ({
                    strategyOptions: { ...state.strategyOptions, ...options }
                })),

                // Market Analysis State & Actions
                analysisMode: false,
                analysisResult: [],
                isAnalyzing: false,
                analysisProgress: { current: 0, total: 0 },
                activeStrategy: 'fixed',

                setAnalysisMode: (mode) => set({ analysisMode: mode }),
                setActiveStrategy: (strategy) => set({ activeStrategy: strategy }),

                /**
                 * 시장 전체 분석 실행 (Market Scanner)
                 */
                runMarketAnalysis: async () => {
                    const state = get();
                    // 로드된 추천 종목이 없으면 로드 시도
                    if (state.recommendedStocks.length === 0) {
                        await state.loadRecommendedTickers();
                    }
                    const stocks = get().recommendedStocks;
                    if (stocks.length === 0) {
                        get().setGlobalError('분석할 추천 종목 데이터가 없습니다.');
                        return;
                    }

                    set({
                        isAnalyzing: true,
                        analysisResult: [],
                        analysisProgress: { current: 0, total: stocks.length }
                    });

                    const results = [];
                    // Stock 모드에서만 동작한다고 가정, 현재 Active Interval 사용
                    const interval = state.activeInterval || '1d';
                    const options = state.strategyOptions; // 현재 전략 옵션 가져오기

                    let processedCount = 0;

                    // API 부하 조절을 위해 순차 처리 (약간의 딜레이 포함 가능)
                    for (const stock of stocks) {
                        try {
                            const now = Date.now();
                            const today = new Date().toISOString().split('T')[0]; // "2024-01-05"

                            let rawData;
                            const cachedEntry = state.dataCache[stock.ticker];

                            // 캐시 체크: 데이터가 존재하고, 저장된 날짜가 오늘과 같다면 캐시 사용
                            if (cachedEntry && new Date(cachedEntry.timestamp).toISOString().split('T')[0] === today) {
                                rawData = cachedEntry.data;
                                console.log(`[Cache] Using cached data for ${stock.ticker}`);
                            } else {
                                // 1. 데이터 조회 (최근 60일 데이터로 50일 확보)
                                rawData = await fetchStockShortData(stock.ticker);

                                // 캐시 업데이트
                                if (rawData && rawData.length > 0) {
                                    set(s => ({
                                        dataCache: {
                                            ...s.dataCache,
                                            [stock.ticker]: { timestamp: now, data: rawData }
                                        }
                                    }));
                                }
                            }

                            // 데이터가 너무 적으면 스킵
                            if (rawData.length < 20) {
                                results.push({ ticker: stock.ticker, signal: 'SKIP', reason: 'Not enough data' });
                                continue;
                            }

                            // 2. Aggregate (Stock 모드 일봉 기준)
                            let aggregated = rawData;
                            if (interval !== '1d' && INTERVALS[interval] >= 1440) {
                                const intervalMinutes = INTERVALS[interval];
                                const stride = intervalMinutes / 1440;
                                aggregated = aggregateToInterval(rawData, Math.max(1, Math.floor(stride)));
                            }

                            // 3. 지표 추가 (Slope, BB)
                            const dataWithSlope = addSlopeData(aggregated);

                            // 4. 신호 분석 (마지막 캔들 기준)
                            const analysis = analyzeSignal(dataWithSlope, options);

                            // 5. AI 감성 분석 (News + FinBERT)
                            const newsHeadlines = await fetchStockNews(stock.ticker);
                            const sentimentScore = await getSentimentScore(newsHeadlines);

                            const lastCandle = dataWithSlope[dataWithSlope.length - 1];
                            const prevCandle = dataWithSlope[dataWithSlope.length - 2];

                            // 등락률 계산 (전일 종가 대비)
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
                                timestamp: lastCandle.timestamp
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

                        // UI 렌더링 양보를 위한 미세 딜레이
                        await new Promise(r => setTimeout(r, 10));
                    }

                    // 정렬: BUY > SELL > HOLD > ERROR
                    const priority = { 'BUY': 0, 'SELL': 1, 'HOLD': 2, 'SKIP': 3, 'ERROR': 4 };
                    results.sort((a, b) => {
                        const pA = priority[a.signal] ?? 99;
                        const pB = priority[b.signal] ?? 99;
                        return pA - pB;
                    });

                    set((s) => ({ analysisResult: results, isAnalyzing: false }));
                },

                /**
                 * 추천 종목 로드
                 */
                loadRecommendedTickers: async () => {
                    const state = get();
                    // 이미 로드되었으면 스킵
                    if (state.recommendedStocks.length > 0) return;

                    set({ loadingRecommendations: true });
                    try {
                        const { fetchRecommendedTickers } = await import('@/lib/api');
                        const stocks = await fetchRecommendedTickers();
                        set({ recommendedStocks: stocks, loadingRecommendations: false });
                    } catch (error) {
                        console.error('Failed to load recommended tickers:', error);
                        set({ loadingRecommendations: false });
                        // 실패해도 에러를 띄우지 않고 빈 배열 유지 (Input 사용 가능하게)
                    }
                },

                /**
                 * 파생 간격 데이터 자동 생성
                 * 기본 데이터(1m or 1d)가 로드된 후 호출됨
                 */
                autoGenerateIntervals: async () => {
                    const state = get();
                    const intervals = Object.keys(INTERVALS); // ['1m', '5m', ..., '1w']

                    // 모드에 따라 생성 가능한 간격 필터링
                    const targetIntervals = intervals.filter(iv => {
                        if (iv === 'STOCK_BASE') return false; // 예외
                        if (state.mode === 'coin') {
                            // 코인은 1m 이미 로드됨, 나머지는 모두 생성 가능
                            return iv !== '1m';
                        } else {
                            // 주식은 1d 미만 불가 (1d는 Base로 이미 로드됨)
                            return INTERVALS[iv] >= 1440 && iv !== '1d';
                        }
                    });

                    // 순차적 생성 (병렬 처리 시 UI 렉 발생 가능성 고려하여 순차 추천, 일단은 병렬 시도 후 문제되면 순차로 변경)
                    // 여기서는 안전하게 순차 처리
                    for (const iv of targetIntervals) {
                        // 이미 있거나 로딩 중이면 스킵 (loadHistInterval 내부에서 체크함)
                        await state.loadHistInterval(iv);
                    }

                    // 모든 생성이 완료된 후, 기본 간격을 Active 상태로 설정
                    // Coin -> 1m, Stock -> 1d
                    if (state.mode === 'coin') {
                        set({ activeInterval: '1m' });
                    } else {
                        set({ activeInterval: '1d' });
                    }
                },

                setMode: (mode) => {
                    const currentMode = get().mode;
                    if (currentMode !== mode) {
                        get().clearAllData();
                        set({ mode });

                        // 모드 변경 후 자동 데이터 로드 트리거
                        setTimeout(() => {
                            if (mode === 'coin') {
                                get().loadHist1m();
                            } else {
                                get().loadStockData();
                            }
                        }, 0);
                    }
                },

                setTicker: (ticker) => {
                    const currentTicker = get().ticker;
                    const mode = get().mode;

                    if (currentTicker !== ticker) {
                        get().clearAllData();
                        set({ ticker });

                        // 티커 변경 후 자동 데이터 로드 트리거 (주식 모드일 때만 유효하지만 코인도 티커 개념이 생긴다면 확장 가능)
                        if (mode === 'stock') {
                            setTimeout(() => {
                                get().loadStockData();
                            }, 0);
                        } else if (mode === 'coin') {
                            get().loadHist1m();
                        }
                    }
                },

                /**
                 * 1분 데이터 로드 (API 호출) - Coin Mode Only
                 */
                loadHist1m: async () => {
                    const state = get();
                    if (state.mode !== 'coin') return;
                    if (state.hist['1m'].length > 0) return;

                    set((s) => ({ loadingInterval: { ...s.loadingInterval, '1m': true } }));

                    try {
                        const rawData = await fetchOneYearData((current, total) => {
                            set({ fetchProgress: { current, total } });
                        });

                        const { addDerivedData } = await import('@/lib/dataProcessor');
                        const dataWithSlope = addDerivedData(rawData);

                        set((s) => ({
                            hist: { ...s.hist, '1m': dataWithSlope },
                            loadingInterval: { ...s.loadingInterval, '1m': false },
                        }));

                        // 자동 파생 데이터 생성
                        get().autoGenerateIntervals();

                    } catch (error) {
                        console.error('Failed to load 1m data:', error);
                        set((s) => ({ loadingInterval: { ...s.loadingInterval, '1m': false } }));
                        get().setGlobalError({ title: '데이터 로드 실패', description: error.message });
                    }
                },

                /**
                 * 주식 데이터 로드 (Yahoo API) - Stock Mode Only
                 */
                loadStockData: async () => {
                    const state = get();
                    if (state.mode !== 'stock') return;
                    if (state.hist['1d'].length > 5) return;

                    set((s) => ({ loadingInterval: { ...s.loadingInterval, 'STOCK_BASE': true } }));

                    try {
                        let rawData = await fetchStockOneYearData(state.ticker);

                        if (rawData.length <= 5) {
                            console.warn(`[Warning] Fetched data count is too low (${rawData.length}).`);
                        }

                        const { addDerivedData } = await import('@/lib/dataProcessor');
                        const dataWithSlope = addDerivedData(rawData);

                        set((s) => ({
                            hist: { ...s.hist, '1d': dataWithSlope },
                            loadingInterval: { ...s.loadingInterval, 'STOCK_BASE': false },
                        }));

                        // 자동 파생 데이터 생성
                        get().autoGenerateIntervals();

                    } catch (error) {
                        console.error(`Failed to load stock data for ${state.ticker}:`, error);
                        set((s) => ({ loadingInterval: { ...s.loadingInterval, 'STOCK_BASE': false } }));
                        get().setGlobalError({ title: '데이터 로드 실패', description: error.message });
                    }
                },

                /**
                 * 특정 간격 데이터 생성
                 * Coin Mode: 1분 데이터 기반
                 * Stock Mode: 1일 데이터 기반 (1일보다 작은 단위는 생성 불가)
                 */
                loadHistInterval: async (interval) => {
                    const state = get();
                    // 이미 생성된 데이터가 있고, 데이터 개수가 정상 범위(>1)라면 재사용.
                    // (이전 버그로 인해 1개만 생성된 경우를 필터링하기 위함)
                    if (state.hist[interval] && state.hist[interval].length > 1) return;

                    set((s) => ({ loadingInterval: { ...s.loadingInterval, [interval]: true } }));

                    // 비동기 처리 시뮬레이션 (UI 블로킹 방지)
                    await new Promise(resolve => setTimeout(resolve, 100));

                    try {
                        let baseData = [];

                        if (state.mode === 'coin') {
                            if (state.hist['1m'].length === 0) {
                                console.error('1분 데이터가 먼저 로드되어야 합니다.');
                                throw new Error('Base data not loaded');
                            }
                            baseData = state.hist['1m'];
                        } else {
                            // Stock Mode
                            if (state.hist['1d'].length === 0) {
                                // 1일 데이터가 없으면 먼저 로드 시도
                                await state.loadStockData();
                                // 로드 후 상태 갱신 확인
                                const newState = get();
                                if (newState.hist['1d'].length === 0) {
                                    get().setGlobalError({
                                        title: '데이터 로드 실패',
                                        description: '주식 기본 데이터(1일봉)를 로드하는 데 실패했습니다. 티커를 확인하거나 잠시 후 다시 시도해주세요.'
                                    });
                                    throw new Error('Failed to load base stock data');
                                }
                                baseData = newState.hist['1d'];
                            } else {
                                baseData = state.hist['1d'];
                            }

                            // Stock 모드에서 1일 미만 단위 요청 시 무시
                            const minutes = INTERVALS[interval];
                            if (minutes < 1440) { // 1440 = 24 * 60 (1일)
                                console.warn('Stock mode does not support intervals less than 1 day');
                                set((s) => ({ loadingInterval: { ...s.loadingInterval, [interval]: false } }));
                                return;
                            }
                        }

                        // Stock 모드일 때 1d 데이터를 또 1d로 변환하려 하면 비효율적이지만, aggregateToInterval이 잘 처리하는지 확인 필요.
                        // aggregateToInterval은 분 단위로 계산함. Stock 하루는 1440분으로 가정되는가?
                        // Stock 데이터는 시간 정보가 있지만, 갭이 큼. 
                        // 단순 캔들 병합(N개 캔들을 하나로) 방식이 아니라, 시간 기반 병합(aggregateToInterval)이라면 타임스탬프가 중요.
                        // Stock 일봉 데이터의 timestamp는 00:00:00 (UTC) or market open time.
                        // INTERVALS['1d'] = 1440. 
                        // Coin은 1분차트에 모든 분이 다 있음. Stock은 하루에 하나.
                        // aggregate logic needs to handle this.
                        // 현재 aggregate helper는 '분'을 가정하고 있음.
                        // Stock 1일 데이터를 기반으로 2일, 1주 등을 만들 때는
                        // "캔들 개수"로 묶거나 "날짜"로 묶어야 함.

                        // 임시 방편: Stock 모드이고 Interval이 1d인 경우, 이미 loadStockData에서 처리됨 (위에서 return 안됐다면 로직 흐름상 여기 옴).
                        // 만약 interval == '1d'이고 Stock 모드라면, loadStockData가 이미 채웠으므로 여기 올 일 없음 (맨 위 check).
                        // 즉, 여기는 2d, 1w 등을 만들러 온 것.

                        // Stock의 경우 Base가 '1d'인데 aggregateToInterval이 '1m'을 기대하면 안됨.
                        // aggregateToInterval 함수 수정이 필요할 수 있음. 혹은 여기서 분기.

                        let aggregated;
                        if (state.mode === 'stock') {
                            // Stock 모드는 기본 데이터가 1일봉(1440분)이므로,
                            // Aggregation 시 "분 단위"가 아니라 "일 단위(캔들 개수)"로 계산해야 함.
                            const intervalMinutes = INTERVALS[interval];
                            const stride = intervalMinutes / 1440;

                            aggregated = aggregateToInterval(baseData, Math.max(1, Math.floor(stride)));
                        } else {
                            // Coin 모드는 1분봉이므로 분 단위 그대로 Stride로 사용
                            aggregated = aggregateToInterval(baseData, INTERVALS[interval]);
                        }

                        const { addDerivedData } = await import('@/lib/dataProcessor');
                        const dataWithSlope = addDerivedData(aggregated);

                        set((s) => ({
                            hist: { ...s.hist, [interval]: dataWithSlope },
                            loadingInterval: { ...s.loadingInterval, [interval]: false },
                        }));

                    } catch (err) {
                        console.error(err);
                        set((s) => ({ loadingInterval: { ...s.loadingInterval, [interval]: false } }));
                    }
                },

                /**
                 * 통합 시뮬레이션 실행 (새로운 UI용)
                 */
                runSimulation: async () => {
                    const state = get();
                    const interval = state.activeInterval;
                    if (!interval) {
                        get().setGlobalError('간격을 먼저 선택해주세요.');
                        return;
                    }

                    const options = state.strategyOptions;
                    const data = state.hist[interval];
                    if (!data || data.length === 0) {
                        get().setGlobalError('데이터가 없습니다.');
                        return;
                    }

                    // 1. 매매 기록 생성 (필터 적용)
                    const { generateIntegratedTrades, calculateFixedQuantityResult, calculateCumulativeResult, calculateMartingaleResult } = await import('@/lib/dataProcessor');
                    const trades = generateIntegratedTrades(data, options);

                    if (trades.length === 0) {
                        get().setGlobalError('해당 조건으로 발생한 매매 내역이 없습니다.');
                        return;
                    }

                    // 2. 결과 계산 (자산 관리 방식 적용)
                    let result;
                    if (options.martingaleMultiplier > 1.0) {
                        // 마틴게일
                        result = calculateMartingaleResult(trades, options.baseQuantity, options.martingaleMultiplier);
                    } else if (options.moneyManagement === 'cumulative') {
                        // 누적 (복리)
                        result = calculateCumulativeResult(trades, options.baseQuantity);
                    } else {
                        // 고정 (단리)
                        result = calculateFixedQuantityResult(trades, options.baseQuantity);
                    }

                    // 3. 결과 저장 (Key 생성: strategy 기반)
                    const key = `custom_${Date.now()}`; // 고유 키 사용하되 UI에서는 최신 결과 표시
                    const resultWithMeta = {
                        ...result,
                        options: { ...options } // 당시 옵션 복사본 저장
                    };

                    set(s => ({
                        simul: { ...s.simul, [key]: resultWithMeta },
                        selectedResult: { key, ...resultWithMeta }
                    }));
                },

                setActiveInterval: (interval) => set({ activeInterval: interval }),
                setSelectedResult: (result) => set({ selectedResult: result }),

                /**
                 * 스토어 초기화 (데이터 삭제)
                 * Mode와 Ticker는 유지하고 데이터만 날릴 것인지?
                 * -> 사용자 요청: "주식으로 바꾸거나 또는 종목을 바꾸거나 할때, store는 초기화 하는게 좋을것 같다."
                 * -> 즉, 이 함수는 데이터 클리어 용도.
                 */
                clearAllData: () => set({
                    hist: {
                        '1m': [], '5m': [], '15m': [], '1h': [], '2h': [],
                        '1d': [], '2d': [], '3d': [], '4d': [], '5d': [], '6d': [], '1w': [],
                    },
                    simul: {},
                    // mode, ticker는 유지 (설정값이므로)
                    activeInterval: null,
                    selectedResult: null,
                    fetchProgress: { current: 0, total: 0 },
                }),
            }),
            {
                name: 'bitcoin-simulation-storage', // IndexedDB 키 이름
                storage: createJSONStorage(() => indexedDBStorage),
                // 로딩 상태 등은 persist에서 제외
                partialize: (state) => ({
                    mode: state.mode,
                    ticker: state.ticker,
                    hist: state.hist,
                    simul: state.simul,
                    // activeInterval, selectedResult는 UX상 유지하면 좋음
                    activeInterval: state.activeInterval,
                    dataViewMode: state.dataViewMode,
                    recommendedStocks: state.recommendedStocks,
                    dataCache: state.dataCache,
                }),
            }
        ),
        {
            name: 'BitcoinSimulation', // Redux DevTools에 표시될 이름
            enabled: import.meta.env.DEV, // 개발 환경에서만 DevTools 활성화
            // 대용량 데이터는 DevTools에서 제외하여 64MB 제한 초과 방지
            serialize: {
                replacer: (key, value) => {
                    // hist와 simul 데이터는 DevTools에서 제외
                    if (key === 'hist' || key === 'simul') {
                        return '[대용량 데이터 생략]';
                    }
                    return value;
                }
            }
        }
    )
)
