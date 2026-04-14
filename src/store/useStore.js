import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { fetchCoinDailyData, fetchStockHistory, fetchStockNews, getSentimentScore } from '@/lib/api'
import { addDerivedData, generateIntegratedTrades, generateAiTrades, calculateFixedQuantityResult, calculateCumulativeResult, calculateMartingaleResult, analyzeSignal } from '@/lib/dataProcessor'
import { processTickerRealtime } from './realtimeHelpers'

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

                // Real-time Analysis State
                isRealtimeAnalysis: false,
                realtimeAnalysisTickers: [], // tickers being analyzed
                realtimeAnalysisData: {}, // { [ticker]: { data: [], ... } }
                realtimeTrades: [], // [{ id, time, type:'BUY'|'SELL', ticker, price, quantity:1, profit, profitRate }] - 최대 100개
                realtimePositions: {}, // { [ticker]: { buyPrice, time } }
                clearRealtimeTrades: () => set({ realtimeTrades: [], realtimePositions: {} }),

                // 메모리 디버깅 함수 (개발 환경에서만 사용)
                debugMemoryStats: () => {
                    const state = get();
                    const stats = {
                        realtimeTrades: state.realtimeTrades.length,
                        realtimePositions: Object.keys(state.realtimePositions).length,
                        realtimePrices: Object.keys(state.realtimePrices).length,
                        realtimeAnalysisData: Object.keys(state.realtimeAnalysisData).length,
                        analysisResult: state.analysisResult.length,
                        dataCacheSize: Object.keys(state.dataCache).length,
                    };
                    console.log('[메모리 통계]', stats);

                    // 각 analysisData의 캔들 수 계산
                    let totalCandles = 0;
                    Object.values(state.realtimeAnalysisData).forEach(entry => {
                        if (entry.data) totalCandles += entry.data.length;
                    });
                    console.log('[메모리 통계] 총 캔들 수:', totalCandles);

                    return stats;
                },
                wsStatus: { connected: false, subscriptionCount: 0 },
                setWsStatus: (status) => set(s => ({ wsStatus: { ...s.wsStatus, ...status } })),


                // History data - 일봉 또는 분봉 사용
                interval: '1d', // '1d' | '1m'
                hist: {
                    '1d': [],
                    '1m': [],
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

                // AI Models
                aiModels: [],
                loadingAiModels: false,

                // Strategy Options
                strategyOptions: {
                    strategyMode: 'rule', // 'rule' | 'ai'
                    aiModelId: '',
                    aiBuyThreshold: 0.6,
                    aiSellThreshold: 0.4,
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
                    vMartingaleMultiplierMode: 'double', // 'double' | 'fixed'
                    vMartingaleAddBuyThreshold: 0, // 추가 매수 조건: 평단가 대비 N% 이하 손실 시 (0=제한없음, -1=-1%, -2=-2%, ...)
                    baseQuantity: 100000,
                },

                // Automation Config List (Supabase)
                automationConfigList: [],
                loadingAutomation: false,

                loadAutomationConfigs: async () => {
                    const supabase = getSupabaseClient();
                    if (!supabase) return; // Supabase not configured

                    set({ loadingAutomation: true });
                    try {
                        const { data, error } = await supabase
                            .from('automation_settings')
                            .select('*')
                            .order('created_at', { ascending: false });

                        if (error) throw error;
                        set({ automationConfigList: data || [] });
                    } catch (error) {
                        console.error('Failed to load automation configs:', error);
                        // 에러는 조용히 로그만 남기거나, 필요 시 상태 업데이트
                    } finally {
                        set({ loadingAutomation: false });
                    }
                },

                saveAutomationConfig: async (config) => {
                    const supabase = getSupabaseClient();
                    if (!supabase) return { success: false, error: 'Supabase Not Configured' };

                    set({ loadingAutomation: true });
                    try {
                        // id가 있으면 update, 없으면 insert
                        const { data, error } = await supabase
                            .from('automation_settings')
                            .upsert(config)
                            .select();

                        if (error) throw error;

                        // 목록 갱신을 위해 다시 로드 (간단한 방법)
                        await get().loadAutomationConfigs();
                        return { success: true, data };
                    } catch (error) {
                        console.error('Failed to save automation config:', error);
                        return { success: false, error: error.message };
                    } finally {
                        set({ loadingAutomation: false });
                    }
                },

                deleteAutomationConfig: async (id) => {
                    const supabase = getSupabaseClient();
                    if (!supabase) return { success: false, error: 'Supabase Not Configured' };

                    set({ loadingAutomation: true });
                    try {
                        const { error } = await supabase
                            .from('automation_settings')
                            .delete()
                            .eq('id', id);

                        if (error) throw error;

                        set(state => ({
                            automationConfigList: state.automationConfigList.filter(item => item.id !== id)
                        }));
                        return { success: true };
                    } catch (error) {
                        console.error('Failed to delete automation config:', error);
                        return { success: false, error: error.message };
                    } finally {
                        set({ loadingAutomation: false });
                    }
                },

                // auto_trade_dl_logs (Supabase)
                autoTradeDlLogs: [],
                loadingAutoTradeDlLogs: false,

                fetchAutoTradeDlLogs: async () => {
                    const supabase = getSupabaseClient();
                    if (!supabase) return;
                    set({ loadingAutoTradeDlLogs: true });
                    try {
                        const { data, error } = await supabase
                            .from('auto_trade_dl_logs')
                            .select('*')
                            .order('created_at', { ascending: false })
                            .limit(50);
                        if (error) throw error;
                        set({ autoTradeDlLogs: data || [] });
                    } catch (e) {
                        console.error('fetchAutoTradeDlLogs error:', e);
                    } finally {
                        set({ loadingAutoTradeDlLogs: false });
                    }
                },

                // Machine Learning Models
                mlModels: [],
                saveMLModel: (model) => set(state => ({
                    mlModels: [...state.mlModels, {
                        id: Date.now().toString(),
                        createdAt: new Date().toISOString(),
                        ...model
                    }]
                })),
                deleteMLModel: (id) => set(state => ({
                    mlModels: state.mlModels.filter(m => m.id !== id)
                })),

                // Simulation Running State
                isSimulating: false,

                // Market Analysis State & Actions
                analysisResult: [],
                isAnalyzing: false,
                analysisProgress: { current: 0, total: 0 },

                // Documentation Viewer State
                selectedDoc: null, // key of DOCS_DATA
                setSelectedDoc: (docKey) => set({ selectedDoc: docKey }),

                // News State (#67)
                newsItems: [],
                newsSelectedDate: null, // null = today (KST)
                newsIsLoading: false,
                newsError: null,
                setNewsSelectedDate: (date) => set({ newsSelectedDate: date }),
                setNewsItems: (items) => set({ newsItems: items }),
                setNewsIsLoading: (loading) => set({ newsIsLoading: loading }),
                setNewsError: (error) => set({ newsError: error }),

                // Actions
                setViewMode: (viewMode) => set({ viewMode }),
                setGlobalError: (error) => set({ globalError: error }),

                updateStrategyOptions: (options) => set(state => {
                    const newOptions = { ...state.strategyOptions, ...options };

                    let newAnalysisResult = state.analysisResult;

                    // 실시간 분석 중이라면, 변경된 전략으로 신호 즉시 재계산
                    if (state.isRealtimeAnalysis) {
                        newAnalysisResult = state.analysisResult.map(item => {
                            const tickerData = state.realtimeAnalysisData[item.ticker];
                            if (tickerData && tickerData.data && tickerData.data.length > 0) {
                                // 기존 데이터를 사용하여 계산
                                const dataWithSlope = addDerivedData(tickerData.data);
                                const analysis = analyzeSignal(dataWithSlope, { ...newOptions, isRealtimeMode: true });

                                // 신호와 이유 업데이트 (가격 등은 유지)
                                return {
                                    ...item,
                                    signal: analysis.signal,
                                    reason: analysis.reason
                                };
                            }
                            return item;
                        });
                    }

                    return {
                        strategyOptions: newOptions,
                        analysisResult: newAnalysisResult
                    };
                }),

                setInterval: (interval) => {
                    const currentInterval = get().interval;
                    if (currentInterval !== interval) {
                        set({ interval, hist: { ...get().hist, [interval]: [] } });
                        get().loadDailyData();
                    }
                },

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
                    approvalKey: '', // WebSocket Approval Key
                    tokenExpiry: null,
                },

                // Real-time Prices (WebSocket)
                realtimePrices: {}, // { [ticker]: { price: number, change: number, rate: number, volume: number } }
                updateRealtimePrice: (ticker, data) => set(state => ({
                    realtimePrices: {
                        ...state.realtimePrices,
                        [ticker]: { ...state.realtimePrices[ticker], ...data }
                    }
                })),
                batchUpdateRealtimePrices: (updates) => set(state => {
                    const newPrices = { ...state.realtimePrices };
                    let analysisData = state.realtimeAnalysisData;
                    let newAnalysisResult = state.analysisResult;
                    let newTrades = state.realtimeTrades;
                    let newPositions = state.realtimePositions;
                    let anyAnalysisUpdated = false;
                    let anyTradesUpdated = false;

                    const needsAnalysisUpdate = state.isRealtimeAnalysis &&
                        state.realtimeAnalysisTickers.some(t => updates[t]);

                    if (needsAnalysisUpdate) {
                        analysisData = { ...analysisData };
                    }

                    Object.entries(updates).forEach(([ticker, data]) => {
                        newPrices[ticker] = { ...newPrices[ticker], ...data };

                        if (state.isRealtimeAnalysis && state.realtimeAnalysisTickers.includes(ticker)) {
                            const { analysisEntry, updatedResult, positions, trades, analysisUpdated, tradesUpdated } =
                                processTickerRealtime({
                                    ticker,
                                    data,
                                    tickerEntry: analysisData[ticker],
                                    analysisResult: newAnalysisResult,
                                    positions: newPositions,
                                    trades: newTrades,
                                    strategyOptions: state.strategyOptions,
                                });

                            if (analysisUpdated) {
                                analysisData[ticker] = analysisEntry;
                                newAnalysisResult = updatedResult;
                                anyAnalysisUpdated = true;
                            }
                            if (tradesUpdated) {
                                newPositions = positions;
                                newTrades = trades;
                                anyTradesUpdated = true;
                            }
                        }
                    });

                    const newState = { realtimePrices: newPrices };
                    if (anyAnalysisUpdated) {
                        newState.realtimeAnalysisData = analysisData;
                        newState.analysisResult = newAnalysisResult;
                    }
                    if (anyTradesUpdated) {
                        newState.realtimeTrades = newTrades;
                        newState.realtimePositions = newPositions;
                    }
                    return newState;
                }),

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
                        const { getAccessToken, getWebSocketApprovalKey } = await import('@/lib/kisApi')

                        // 1. REST API Access Token 발급
                        const result = await getAccessToken(appkey, appsecret)

                        if (result.success) {
                            // 2. WebSocket Approval Key 발급 (병렬 처리 가능하지만 순차 처리로 안전하게)
                            let approvalKey = '';
                            // console.log('[KIS] Access Token 발급 성공, WebSocket 키 발급 시도...');
                            try {
                                const wsResult = await getWebSocketApprovalKey(appkey, appsecret);
                                // console.log('[KIS] WebSocket 키 발급 응답:', { success: wsResult.success, hasKey: !!wsResult.approval_key, error: wsResult.error });
                                if (wsResult.success) {
                                    approvalKey = wsResult.approval_key;
                                    // console.log('[KIS] WebSocket 키 발급 성공');
                                } else {
                                    console.warn('[KIS] 웹소켓 키 발급 실패 (REST API만 사용):', wsResult.error);
                                }
                            } catch (wsErr) {
                                console.error('[KIS] 웹소켓 키 발급 에러:', wsErr);
                            }

                            // console.log('[KIS] 최종 상태 - approvalKey:', approvalKey ? 'EXISTS' : 'EMPTY');
                            set({
                                kisAuth: {
                                    isLoggedIn: true,
                                    appkey,
                                    appsecret,
                                    accountNo,
                                    accountCode,
                                    accessToken: result.access_token,
                                    approvalKey: approvalKey,
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

                    // WebSocket 연결 명시적 종료
                    try {
                        const { kisWebSocket } = await import('@/lib/kisWebSocket');
                        kisWebSocket.disconnect();
                        console.log('[KIS] 로그아웃에 따른 WebSocket 연결 종료');
                    } catch (wsErr) {
                        console.warn('WebSocket 종료 중 오류:', wsErr);
                    }

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
                            approvalKey: '',
                            tokenExpiry: null,
                        },
                        realtimePrices: {} // 로그아웃 시 실시간 데이터 초기화
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
                                // console.log('[KIS] 기존 토큰 폐기 완료')
                            } catch (error) {
                                console.warn('[KIS] 토큰 폐기 실패 (계속 진행):', error.message)
                            }
                        }

                        // 2. 새 토큰 발급
                        const { getAccessToken, getWebSocketApprovalKey } = await import('@/lib/kisApi')
                        const result = await getAccessToken(appkey, appsecret)

                        if (result.success) {
                            // 3. WebSocket Approval Key 발급 (재로그인 시에도 필요!)
                            let approvalKey = '';
                            // console.log('[KIS] 재로그인: Access Token 발급 성공, WebSocket 키 발급 시도...');
                            try {
                                const wsResult = await getWebSocketApprovalKey(appkey, appsecret);
                                // console.log('[KIS] 재로그인: WebSocket 키 발급 응답:', { success: wsResult.success, hasKey: !!wsResult.approval_key, error: wsResult.error });
                                if (wsResult.success) {
                                    approvalKey = wsResult.approval_key;
                                    // console.log('[KIS] 재로그인: WebSocket 재연결 요청 완료');
                                } else {
                                    console.warn('[KIS] 재로그인: 웹소켓 키 발급 실패 (REST API만 사용):', wsResult.error);
                                }
                            } catch (wsErr) {
                                console.error('[KIS] 재로그인: 웹소켓 키 발급 에러:', wsErr);
                            }

                            // console.log('[KIS] 재로그인: 최종 상태 - approvalKey:', approvalKey ? 'EXISTS' : 'EMPTY');
                            set({
                                kisAuth: {
                                    isLoggedIn: true,
                                    appkey,
                                    appsecret,
                                    accountNo,
                                    accountCode,
                                    accessToken: result.access_token,
                                    approvalKey: approvalKey,
                                    tokenExpiry: result.access_token_token_expired,
                                }
                            })
                            // console.log('[KIS] 재로그인 성공')
                            return { success: true }
                        } else {
                            // 토큰 발급 실패 시 로그아웃 상태로 변경
                            set(s => ({
                                kisAuth: {
                                    ...s.kisAuth,
                                    isLoggedIn: false,
                                    accessToken: '',
                                    approvalKey: '',
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
                            setGroupStocks(stocks.map(s => ({ ...s, exchange: 'KOSPI' })));
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
                            setGroupStocks(stocks.map(s => ({ ...s, exchange: 'KOSDAQ' })));
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

                    if (tickerGroup === 'usall') {
                        setLoadingGroupStocks(true);
                        try {
                            const response = await fetch('/api/index-stocks/usall');
                            if (!response.ok) throw new Error('Failed to fetch US All stocks');
                            const stocks = await response.json();
                            setGroupStocks(stocks);
                        } catch (e) {
                            console.error('US All stocks fetch error', e);
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
                                    exchange: 'NAS' // 미국 랭킹이면 NAS
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
                                    exchange: 'NAS' // 미국 랭킹이면 NAS
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
                                    exchange: 'NAS' // 미국 랭킹이면 NAS
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
                    const BATCH_SIZE = 5;
                    const { fetchStockMinuteData, fetchStockHistory: fetchHistory } = await import('@/lib/api');
                    const today = new Date().toISOString().split('T')[0];
                    const interval = state.interval;

                    // 단일 종목 분석 (배치 내에서 병렬 실행)
                    const analyzeStock = async (stock) => {
                        const now = Date.now();
                        let rawData;
                        let exchange = stock.exchange || 'NAS';
                        const cachedEntry = state.dataCache[stock.ticker];

                        if (interval === '1d' && cachedEntry && new Date(cachedEntry.timestamp).toISOString().split('T')[0] === today) {
                            rawData = cachedEntry.data;
                            if (cachedEntry.exchange) exchange = cachedEntry.exchange;
                        } else {
                            rawData = interval === '1m'
                                ? await fetchStockMinuteData(stock.ticker)
                                : await fetchHistory(stock.ticker);

                            if (rawData && rawData.exchange) exchange = rawData.exchange;
                            if (interval === '1d' && rawData && rawData.length > 0) {
                                set(s => ({
                                    dataCache: { ...s.dataCache, [stock.ticker]: { timestamp: now, data: rawData, exchange } }
                                }));
                            }
                        }

                        if (!rawData || rawData.length < 20) {
                            return { ticker: stock.ticker, signal: 'SKIP', reason: 'Not enough data' };
                        }

                        const dataWithSlope = addDerivedData(rawData);
                        const analysis = analyzeSignal(dataWithSlope, options);

                        // 주가 데이터 조회와 뉴스 조회를 병렬 처리
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
                            ? ((lastCandle.close - prevCandle.close) / prevCandle.close * 100) : 0;

                        return {
                            ticker: stock.ticker,
                            name: stock.name || stock.ticker,
                            signal: analysis.signal,
                            reason: analysis.reason,
                            price: lastCandle.close,
                            changeRate,
                            slope: lastCandle.slope,
                            bbStatus: lastCandle.bbStatus,
                            sentiment: sentimentScore,
                            news: newsHeadlines,
                            timestamp: lastCandle.timestamp,
                            exchange,
                        };
                    };

                    // 5개씩 배치 병렬 처리
                    for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
                        if (!get().isAnalyzing) break;

                        const batch = stocks.slice(i, i + BATCH_SIZE);
                        const batchResults = await Promise.allSettled(batch.map(analyzeStock));

                        for (const settled of batchResults) {
                            if (settled.status === 'fulfilled') {
                                results.push(settled.value);
                            } else {
                                const stock = batch[batchResults.indexOf(settled)];
                                console.warn(`Analysis failed for ${stock?.ticker}:`, settled.reason);
                                results.push({ ticker: stock?.ticker, signal: 'ERROR', reason: 'Load Failed', price: 0 });
                            }
                        }

                        processedCount += batch.length;
                        set({
                            analysisProgress: { current: Math.min(processedCount, stocks.length), total: stocks.length },
                            analysisResult: [...results]
                        });

                        // 배치 간 짧은 딜레이로 API Rate Limit 방지
                        await new Promise(r => setTimeout(r, 50));
                    }

                    const priority = { 'BUY': 0, 'SELL': 1, 'HOLD': 2, 'SKIP': 3, 'ERROR': 4 };
                    results.sort((a, b) => (priority[a.signal] ?? 99) - (priority[b.signal] ?? 99));

                    set({ analysisResult: results, isAnalyzing: false });
                },

                /**
                 * 실시간 분석 시작 (최대 40개 종목)
                 */
                startRealtimeAnalysis: async () => {
                    const state = get();
                    const stocks = state.groupStocks.slice(0, 40); // Max 40
                    const interval = state.interval;

                    if (stocks.length === 0) {
                        get().setGlobalError('분석할 종목이 없습니다.');
                        return;
                    }

                    if (!state.kisAuth.approvalKey) {
                        get().setGlobalError('실시간 분석을 위해서는 KIS 로그인이 필요합니다.');
                        return;
                    }

                    // 1. 초기 상태 설정
                    set({
                        isAnalyzing: true,
                        isRealtimeAnalysis: true,
                        realtimeAnalysisTickers: stocks.map(s => s.ticker),
                        realtimeAnalysisData: {}, // 데이터 리셋
                        analysisResult: [], // 결과 리셋
                        analysisProgress: { current: 0, total: stocks.length }
                    });

                    const results = [];
                    const analysisData = {};
                    const options = state.strategyOptions;
                    let processed = 0;

                    const today = new Date().toISOString().split('T')[0];

                    // 2. 초기 데이터 로드 (순차적)
                    for (const stock of stocks) {
                        if (!get().isRealtimeAnalysis) break; // 중지 체크

                        try {
                            let rawData;
                            let exchange = stock.exchange || 'NAS';

                            if (interval === '1m') {
                                const { fetchStockMinuteData } = await import('@/lib/api');
                                const fullData = await fetchStockMinuteData(stock.ticker);
                                // 거래소 정보 보존 (slice 전에 추출!)
                                if (fullData && fullData.exchange) exchange = fullData.exchange;
                                // 최근 300개만 사용
                                rawData = fullData.slice(-300);
                            } else {
                                // 1d
                                const cachedEntry = state.dataCache[stock.ticker];
                                if (cachedEntry && new Date(cachedEntry.timestamp).toISOString().split('T')[0] === today) {
                                    rawData = cachedEntry.data;
                                    if (cachedEntry.exchange) exchange = cachedEntry.exchange;
                                } else {
                                    const { fetchStockHistory } = await import('@/lib/api');
                                    rawData = await fetchStockHistory(stock.ticker);
                                    if (rawData && rawData.exchange) exchange = rawData.exchange;

                                    // 캐시 저장 (1d만)
                                    if (rawData && rawData.length > 0) {
                                        set(s => ({
                                            dataCache: {
                                                ...s.dataCache,
                                                [stock.ticker]: { timestamp: Date.now(), data: rawData, exchange }
                                            }
                                        }));
                                    }
                                }
                            }

                            if (rawData && rawData.length > 0) {
                                const dataWithSlope = addDerivedData(rawData);
                                const analysis = analyzeSignal(dataWithSlope, options);

                                const lastCandle = dataWithSlope[dataWithSlope.length - 1];
                                const prevCandle = dataWithSlope.length >= 2 ? dataWithSlope[dataWithSlope.length - 2] : null;
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
                                    timestamp: lastCandle.timestamp,
                                    exchange: exchange,
                                    sentiment: 0 // 초기값, 필요시 로드
                                });

                                // 실시간 업데이트를 위한 데이터 저장
                                analysisData[stock.ticker] = { data: rawData, exchange };
                            } else {
                                results.push({ ticker: stock.ticker, signal: 'SKIP', reason: 'Insufficient Data' });
                            }

                        } catch (e) {
                            console.error(`Failed to init realtime for ${stock.ticker}`, e);
                            results.push({ ticker: stock.ticker, signal: 'ERROR', reason: 'Load Error' });
                        }

                        processed++;
                        set({ analysisProgress: { current: processed, total: stocks.length } });
                        await new Promise(r => setTimeout(r, 20)); // UI Blocking 방지
                    }

                    set({
                        analysisResult: results,
                        realtimeAnalysisData: analysisData,
                        isAnalyzing: false
                    });

                    // 3. WebSocket 구독
                    const { kisWebSocket } = await import('@/lib/kisWebSocket');
                    const subList = stocks.map(s => ({
                        ticker: s.ticker,
                        exchange: analysisData[s.ticker]?.exchange || s.exchange || 'NAS'
                    }));
                    console.log('[Realtime] WebSocket 구독 리스트:', subList.map(s => `${s.ticker}(${s.exchange})`).join(', '));
                    kisWebSocket.subscribeAnalysis(subList);
                },

                stopRealtimeAnalysis: async () => {
                    // console.log('[실시간 분석] 중지 및 메모리 정리 시작');

                    // 메모리 정리: 실시간 분석 관련 데이터 초기화
                    set({
                        isRealtimeAnalysis: false,
                        isAnalyzing: false,
                        realtimeAnalysisData: {}, // 캔들 데이터 해제
                        realtimeAnalysisTickers: [], // 분석 대상 티커 초기화
                        // realtimeTrades, realtimePositions는 사용자가 참고할 수 있으므로 유지
                    });

                    // WebSocket 구독 해제 (동기적으로 처리하여 메모리 누수 방지)
                    try {
                        const { kisWebSocket } = await import('@/lib/kisWebSocket');
                        kisWebSocket.subscribeAnalysis([]);
                    } catch {
                        // ignore
                    }

                    // console.log('[실시간 분석] 메모리 정리 완료');
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
                        const { fetchRecommendedTickers, fetchStockHistory } = await import('@/lib/api');
                        const stocks = await fetchRecommendedTickers();

                        // 각 종목의 거래소 정보 보강 (Yahoo Finance에서 조회)
                        console.log('[Store] Dataroma 종목 거래소 정보 조회 시작...');
                        const enrichedStocks = await Promise.all(
                            stocks.slice(0, 50).map(async (stock) => { // 최대 50개만 처리
                                try {
                                    const rawData = await fetchStockHistory(stock.ticker, 1); // 1일치만
                                    const exchange = rawData?.exchange || 'NAS';
                                    return { ...stock, exchange };
                                } catch (e) {
                                    console.warn(`${stock.ticker} 거래소 조회 실패, 기본값 NAS 사용`);
                                    return { ...stock, exchange: 'NAS' };
                                }
                            })
                        );
                        console.log('[Store] 거래소 정보가 추가된 종목:', enrichedStocks.slice(0, 5).map(s => `${s.ticker}(${s.exchange})`).join(', '));

                        set({
                            recommendedStocks: enrichedStocks,
                            lastRecommendedFetch: now,
                            loadingRecommendations: false
                        });
                    } catch (error) {
                        console.error('Failed to load recommended tickers:', error);
                        set({ loadingRecommendations: false });
                    }
                },

                fetchAiModels: async () => {
                    set({ loadingAiModels: true });
                    try {
                        const supabase = getSupabaseClient();
                        if (!supabase) {
                            console.warn('Supabase client not available');
                            set({ loadingAiModels: false });
                            return;
                        }

                        const { data, error } = await supabase
                            .from('ml_models')
                            .select('*')
                            .order('created_at', { ascending: false });

                        if (error) throw error;
                        set({ aiModels: data, loadingAiModels: false });
                    } catch (error) {
                        console.error('Failed to load AI models:', error);
                        set({ loadingAiModels: false });
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

                // Sidebar visibility
                sidebarOpen: true,
                toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),

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

                // 특정 탭 기준으로 다른 탭들을 닫는 배치 함수
                closeOtherTickers: (keep) => {
                    set({ activeTickers: [keep] });
                    get().setTicker(keep);
                },
                closeRightTickers: (pivot) => {
                    const state = get();
                    const idx = state.activeTickers.indexOf(pivot);
                    const newTickers = state.activeTickers.slice(0, idx + 1);
                    set({ activeTickers: newTickers });
                    if (!newTickers.includes(state.ticker)) get().setTicker(pivot);
                },
                closeLeftTickers: (pivot) => {
                    const state = get();
                    const idx = state.activeTickers.indexOf(pivot);
                    const newTickers = state.activeTickers.slice(idx);
                    set({ activeTickers: newTickers });
                    if (!newTickers.includes(state.ticker)) get().setTicker(pivot);
                },
                closeAllTickers: () => {
                    set({ activeTickers: [], ticker: '' });
                },

                /**
                 * 선택된 종목의 데이터를 로드합니다 (캐시 또는 API).
                 * interval 상태에 따라 일봉 또는 분봉을 로드합니다.
                 * @returns {Promise<void>}
                 */
                loadDailyData: async () => {
                    const state = get();
                    const ticker = state.ticker;
                    const interval = state.interval;

                    // 티커가 없으면 중단
                    if (!ticker) return;

                    set((s) => ({ loadingInterval: { ...s.loadingInterval, [interval]: true } }));

                    try {
                        const now = Date.now();
                        const today = new Date().toISOString().split('T')[0];
                        let rawData = null;

                        // 1. 캐시 확인 (Stock 모드 + 1d 일 때만)
                        if (state.mode === 'stock' && interval === '1d') {
                            const cachedEntry = state.dataCache[ticker];
                            if (cachedEntry && new Date(cachedEntry.timestamp).toISOString().split('T')[0] === today) {
                                // console.log(`[Store] Using cached data for ${ticker}`);
                                rawData = cachedEntry.data;
                            }
                        }

                        // 2. 캐시 없으면 API 호출
                        if (!rawData) {
                            if (state.mode === 'coin') {
                                // 코인은 현재 일봉만 지원 (추후 필요시 확장)
                                const { fetchCoinDailyData } = await import('@/lib/api');
                                rawData = await fetchCoinDailyData();
                            } else {
                                if (interval === '1m') {
                                    const { fetchStockMinuteData } = await import('@/lib/api');
                                    rawData = await fetchStockMinuteData(ticker);
                                } else {
                                    const { fetchStockHistory } = await import('@/lib/api');
                                    rawData = await fetchStockHistory(ticker);
                                }
                            }

                            // 캐시 저장 (Stock + 1d만)
                            if (state.mode === 'stock' && interval === '1d' && rawData && rawData.length > 0) {
                                set(s => ({
                                    dataCache: {
                                        ...s.dataCache,
                                        [ticker]: {
                                            timestamp: now,
                                            data: rawData,
                                        }
                                    }
                                }));
                            }
                        }

                        if (!rawData || rawData.length < 1) {
                            console.warn(`[Warning] Fetched data is empty or too low.`);
                        }

                        const dataWithSlope = addDerivedData(rawData);

                        set((s) => ({
                            hist: { ...s.hist, [interval]: dataWithSlope },
                            loadingInterval: { ...s.loadingInterval, [interval]: false },
                        }));

                    } catch (error) {
                        console.error(`Failed to load ${interval} data:`, error);
                        set((s) => ({ loadingInterval: { ...s.loadingInterval, [interval]: false } }));
                        get().setGlobalError({ title: '데이터 로드 실패', description: error.message });
                    }
                },

                /**
                 * 설정된 전략 옵션에 따라 통합 시뮬레이션을 실행합니다.
                 * @returns {Promise<void>}
                 */
                runSimulation: async () => {
                    const state = get();
                    const interval = state.interval;
                    const data = state.hist[interval];

                    if (!data || data.length === 0) {
                        get().setGlobalError('데이터가 없습니다. 먼저 데이터를 로드해주세요.');
                        return;
                    }

                    const options = state.strategyOptions;

                    let trades = [];

                    set({ isSimulating: true });
                    try {

                    if (options.strategyMode === 'ai') {
                        // AI 딥러닝 시뮬레이션
                        if (!options.aiModelId) {
                            get().setGlobalError('선택된 AI 모델이 없습니다. 사이드바에서 모델을 선택해주세요.');
                            return;
                        }

                        // 백엔드에서 ticker로 직접 데이터 수집 → 피처 추출 → 예측
                        try {
                            const ticker = get().ticker;
                            if (!ticker) {
                                throw new Error('ticker가 설정되지 않았습니다.');
                            }

                            // 로드된 데이터 일수 기준으로 백엔드에 요청 (불필요한 과거 데이터 방지)
                            const days = Math.min(data.length + 30, 730);

                            console.log(`[AI Sim] 백엔드 예측 요청: ticker=${ticker}, modelId=${options.aiModelId}, days=${days}`);

                            const response = await fetch('/api/xgb/predict', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ modelId: options.aiModelId, ticker, days })
                            });

                            if (!response.ok) {
                                const errText = await response.text();
                                console.error('[AI Sim] Prediction Server Error:', response.status, errText);
                                throw new Error(`AI 서버 오류 (${response.status}): ${errText}`);
                            }

                            const resultData = await response.json();
                            if (!resultData.predictions || !Array.isArray(resultData.predictions)) {
                                throw new Error('서버로부터 올바른 예측 데이터를 받지 못했습니다.');
                            }

                            // 백엔드가 date, rawFeatures(consecutiveDays 등)를 포함해 반환
                            const predictions = resultData.predictions.map((p) => ({
                                ...p,
                                probability: p.probability ?? 0,
                            }));

                            const maxProb = Math.max(...predictions.map(p => p.probability));
                            const minProb = Math.min(...predictions.map(p => p.probability));
                            console.log(`[AI Sim] Received ${predictions.length} predictions. Range: ${minProb.toFixed(3)}~${maxProb.toFixed(3)}, BuyThreshold: ${options.aiBuyThreshold}`);

                            // Trade 생성 (AI 전용 전략: 보조지표 등 기타 조건 무시)
                            trades = generateAiTrades(data, predictions, {
                                buyThreshold: options.aiBuyThreshold,
                                sellThreshold: options.aiSellThreshold,
                                useStopLoss: options.useStopLoss,
                                stopLossPcnt: options.stopLossPcnt,
                                useTakeProfit: options.useTakeProfit,
                                takeProfitPcnt: options.takeProfitPcnt,
                                useTrailingStop: options.useTrailingStop,
                                trailingStopPcnt: options.trailingStopPcnt
                            });

                            // [유저 요청] 데이터 뷰를 위한 상세 데이터 구성 (백엔드가 date, rawFeatures 포함 반환)
                            const aiData = predictions.map((p) => ({
                                date: p.date,
                                probability: p.probability,
                                consecutiveDays: p.consecutiveDays,
                                change1d: p.change1d,
                                change7d: p.change7d,
                                change30d: p.change30d,
                            })).sort((a, b) => new Date(b.date) - new Date(a.date));

                            const resultObj = {
                                aiData, // 상세 데이터 저장
                                strategyMode: 'ai'
                            };

                            // 결과 계산 후 메타데이터 합치기
                            let finalResult;
                            if (options.useVMartingale) {
                                const { calculateVMartingaleResult } = await import('@/lib/dataProcessor');
                                finalResult = calculateVMartingaleResult(trades, options.baseQuantity);
                            } else if (options.martingaleMultiplier > 1.0) {
                                finalResult = calculateMartingaleResult(trades, options.baseQuantity, options.martingaleMultiplier);
                            } else if (options.moneyManagement === 'cumulative') {
                                finalResult = calculateCumulativeResult(trades, options.baseQuantity);
                            } else {
                                finalResult = calculateFixedQuantityResult(trades, options.baseQuantity);
                            }

                            const key = `sim_${Date.now()}`;
                            const resultWithMeta = {
                                ...finalResult,
                                ...resultObj,
                                options: { ...options }
                            };

                            set(s => ({
                                simul: { ...s.simul, [key]: resultWithMeta },
                                selectedResult: { key, ...resultWithMeta },
                                viewMode: 'simulation'
                            }));

                            return; // AI 경로는 여기서 종료

                        } catch (e) {
                            console.error('AI Simulation Failed:', e);
                            get().setGlobalError({ title: 'AI 예측 실패', description: e.message });
                            return;
                        }

                    } else {
                        // 기존 룰 베이스
                        trades = generateIntegratedTrades(data, options);
                    }

                    if (trades.length === 0) {
                        if (options.strategyMode === 'ai') {
                            get().setGlobalError({
                                title: '매매 내역 없음',
                                description: `AI 모델의 예측 확률이 매수 임계값(${Math.round(options.aiBuyThreshold * 100)}%)을 충족하지 못했습니다.\n\n사이드바에서 "매수 조건(이상)" 슬라이더를 낮춰보세요.`
                            });
                        } else {
                            get().setGlobalError('해당 조건으로 발생한 매매 내역이 없습니다.');
                        }
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

                    } finally {
                        set({ isSimulating: false });
                    }
                },

                setSelectedResult: (result) => set({ selectedResult: result }),

                /**
                 * 스토어 초기화 (데이터 삭제)
                 */
                clearAllData: () => set({
                    hist: { '1d': [], '1m': [] },
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
                    interval: state.interval,
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
