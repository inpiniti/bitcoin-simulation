import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { fetchCoinDailyData, fetchStockHistory, fetchStockNews, getSentimentScore } from '@/lib/api'
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
                    vMartingaleMultiplierMode: 'double', // 'double' | 'fixed'
                    vMartingaleAddBuyThreshold: 0, // 추가 매수 조건: 평단가 대비 N% 이하 손실 시 (0=제한없음, -1=-1%, -2=-2%, ...)
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
                    vMartingaleMultiplierMode: 'double', // 'double' | 'fixed'
                    vMartingaleAddBuyThreshold: 0, // 추가 매수 조건: 평단가 대비 N% 이하일 때 (0=제한없음)
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

                // Market Analysis State & Actions
                analysisResult: [],
                isAnalyzing: false,
                analysisProgress: { current: 0, total: 0 },

                // Documentation Viewer State
                selectedDoc: null, // key of DOCS_DATA
                setSelectedDoc: (docKey) => set({ selectedDoc: docKey }),

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
                    // 성능 최적화: 업데이트할 티커만 새 객체로 생성
                    const newPrices = { ...state.realtimePrices };
                    let analysisUpdated = false;
                    let analysisData = state.realtimeAnalysisData;
                    let newAnalysisResult = state.analysisResult;
                    let newTrades = state.realtimeTrades;
                    let newPositions = state.realtimePositions;
                    let tradesUpdated = false;

                    // Copy objects only if we need to modify them for analysis
                    // 최적화: 필요한 경우에만 얕은 복사를 수행
                    const needsAnalysisUpdate = state.isRealtimeAnalysis && state.realtimeAnalysisTickers.some(t => updates[t]);

                    if (needsAnalysisUpdate) {
                        analysisData = { ...analysisData };
                        newAnalysisResult = [...newAnalysisResult];
                        newTrades = [...newTrades];
                        newPositions = { ...newPositions };
                    }

                    Object.entries(updates).forEach(([ticker, data]) => {
                        newPrices[ticker] = { ...newPrices[ticker], ...data };

                        // Real-time Analysis Update
                        if (state.isRealtimeAnalysis && state.realtimeAnalysisTickers.includes(ticker)) {
                            const tickerEntry = analysisData[ticker];
                            if (tickerEntry && tickerEntry.data && tickerEntry.data.length > 0) {
                                // 1. Update Last Candle
                                const lastIndex = tickerEntry.data.length - 1;
                                const originalLastCandle = tickerEntry.data[lastIndex];

                                const price = data.price;
                                const newLastCandle = {
                                    ...originalLastCandle,
                                    close: price,
                                    high: Math.max(originalLastCandle.high, price),
                                    low: Math.min(originalLastCandle.low, price),
                                    // Volume handling: KIS sends daily accumulated volume. 
                                    // Usage of volume in 1m analysis might be inaccurate if we don't have start-of-minute volume.
                                    // We'll update the volume if provided (assuming daily chart) or ignore/approximate.
                                    // reliable 'volume' from socket is daily total.
                                    // For '1d', this is perfect. For '1m', this is accumulated.
                                    // Ideally we need volume delta, but let's just stick to price for strategy signal update.
                                };

                                const newData = [...tickerEntry.data];
                                newData[lastIndex] = newLastCandle;

                                // 2. Recalculate Analysis (Derived Data + Signal)
                                // Optimization: derived data calculation on 300 items is fast enough (~1-2ms).
                                const dataWithSlope = addDerivedData(newData);
                                const analysis = analyzeSignal(dataWithSlope, { ...state.strategyOptions, isRealtimeMode: true });

                                // 3. Update Result List
                                const resultIdx = newAnalysisResult.findIndex(r => r.ticker === ticker);
                                if (resultIdx !== -1) {
                                    const prevCandle = newData.length >= 2 ? newData[newData.length - 2] : null;
                                    const changeRate = prevCandle
                                        ? ((price - prevCandle.close) / prevCandle.close * 100)
                                        : 0;

                                    newAnalysisResult[resultIdx] = {
                                        ...newAnalysisResult[resultIdx],
                                        price: price,
                                        changeRate: changeRate,
                                        signal: analysis.signal,
                                        reason: analysis.reason,
                                        slope: dataWithSlope[dataWithSlope.length - 1].slope,
                                        bbStatus: dataWithSlope[dataWithSlope.length - 1].bbStatus,
                                        timestamp: Date.now() // Update timestamp to force refresh if needed
                                    };
                                }

                                // 4. Virtual Trading Logic (Paper Trading)
                                const currentPosition = newPositions[ticker];
                                const timestamp = new Date().toISOString();
                                const isVMartingale = state.strategyOptions.useVMartingale;

                                if (analysis.signal === 'BUY') {
                                    // 매수 진입 또는 추가 매수 (V-Martingale 시)
                                    if (!currentPosition || isVMartingale) {
                                        // V-Martingale 시 현재 몇 번째 매수인지 계산하여 수량 결정
                                        const entryCount = currentPosition ? (currentPosition.entryCount || 0) : 0;

                                        // V-Martingale 추가 매수 조건: 평단가 대비 손실률 체크
                                        let canAddBuy = true;
                                        if (currentPosition && isVMartingale) {
                                            const addBuyThreshold = state.strategyOptions.vMartingaleAddBuyThreshold || 0;
                                            if (addBuyThreshold < 0) {
                                                // 평단가 대비 현재 손실률 계산
                                                const currentLossRate = ((price - currentPosition.avgPrice) / currentPosition.avgPrice) * 100;
                                                // 손실률이 임계값보다 크면(덜 손실이면) 추가 매수 불가
                                                if (currentLossRate > addBuyThreshold) {
                                                    canAddBuy = false;
                                                    // console.log(`[V-Martingale] ${ticker} 추가 매수 스킵: 손실률 ${currentLossRate.toFixed(2)}% > 임계값 ${addBuyThreshold}%`);
                                                }
                                            }
                                        }

                                        // 이미 같은 캔들(시간대)에서 매수했는지 체크 (중복 피드백 방지)
                                        const lastBuyTime = currentPosition?.lastTime;
                                        if (canAddBuy && lastBuyTime !== originalLastCandle.timestamp) {
                                            const multiplier = isVMartingale
                                                ? (state.strategyOptions.vMartingaleMultiplierMode === 'fixed' ? 1 : Math.pow(2, entryCount))
                                                : 1;

                                            const qty = multiplier; // 가상 단위 수량
                                            const cost = price * qty;

                                            // console.log(`[Realtime Trade] ${ticker} BUY Signal! Entry #${entryCount + 1}, Qty: ${qty}`);

                                            if (!currentPosition) {
                                                // 첫 매수
                                                const timestampStr = new Date().toISOString();
                                                newPositions[ticker] = {
                                                    avgPrice: price,
                                                    totalQty: qty,
                                                    totalCost: cost,
                                                    lastTime: originalLastCandle.timestamp,
                                                    entryCount: 1,
                                                    startTime: timestampStr
                                                };
                                            } else {
                                                // 추가 매입 (물타기)
                                                const nextQty = currentPosition.totalQty + qty;
                                                const nextCost = currentPosition.totalCost + cost;
                                                newPositions[ticker] = {
                                                    ...currentPosition,
                                                    avgPrice: nextCost / nextQty,
                                                    totalQty: nextQty,
                                                    totalCost: nextCost,
                                                    lastTime: originalLastCandle.timestamp,
                                                    entryCount: entryCount + 1
                                                };
                                            }

                                            // 메모리 누수 방지: 거래 로그 최대 100개 유지
                                            if (newTrades.length >= 100) {
                                                newTrades = newTrades.slice(0, 99);
                                            }
                                            newTrades.unshift({
                                                id: Date.now() + Math.random(),
                                                time: new Date().toISOString(),
                                                type: 'BUY',
                                                ticker: ticker,
                                                price: price,
                                                quantity: qty,
                                                entryCount: entryCount + 1,
                                                reason: analysis.reason + (entryCount > 0 ? ` (V-Martingale #${entryCount + 1})` : '')
                                            });
                                            tradesUpdated = true;
                                        }
                                    }
                                } else if (analysis.signal === 'SELL' && currentPosition) {
                                    // 매도 청산 (전량 매도)
                                    const avgPrice = currentPosition.avgPrice;
                                    const totalQty = currentPosition.totalQty;
                                    const profit = (price - avgPrice) * totalQty;
                                    const profitRate = ((price - avgPrice) / avgPrice) * 100;

                                    // 메모리 누수 방지: 거래 로그 최대 100개 유지
                                    if (newTrades.length >= 100) {
                                        newTrades = newTrades.slice(0, 99);
                                    }
                                    newTrades.unshift({
                                        id: Date.now() + Math.random(),
                                        time: timestamp,
                                        type: 'SELL',
                                        ticker: ticker,
                                        price: price,
                                        quantity: totalQty,
                                        profit: profit,
                                        profitRate: profitRate,
                                        reason: analysis.reason
                                    });

                                    delete newPositions[ticker];
                                    tradesUpdated = true;
                                }

                                // 5. Save back to data state
                                analysisData[ticker] = { ...tickerEntry, data: newData };
                                analysisUpdated = true;
                            }
                        }
                    });

                    const newState = { realtimePrices: newPrices };
                    if (analysisUpdated) {
                        newState.realtimeAnalysisData = analysisData;
                        newState.analysisResult = newAnalysisResult;
                    }
                    if (tradesUpdated) {
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

                    for (const stock of stocks) {
                        // 사용자 중지 체크
                        if (!get().isAnalyzing) break;

                        try {
                            const now = Date.now();
                            const today = new Date().toISOString().split('T')[0];
                            const interval = state.interval;

                            let rawData;
                            let exchange = stock.exchange || 'NAS';
                            const cachedEntry = state.dataCache[stock.ticker];

                            // 1d일 때만 캐시 사용
                            if (interval === '1d' && cachedEntry && new Date(cachedEntry.timestamp).toISOString().split('T')[0] === today) {
                                rawData = cachedEntry.data;
                                if (cachedEntry.exchange) exchange = cachedEntry.exchange;
                            } else {
                                if (interval === '1m') {
                                    const { fetchStockMinuteData } = await import('@/lib/api');
                                    rawData = await fetchStockMinuteData(stock.ticker);
                                } else {
                                    const { fetchStockHistory } = await import('@/lib/api');
                                    rawData = await fetchStockHistory(stock.ticker);
                                }

                                if (rawData && rawData.exchange) exchange = rawData.exchange;

                                // 1d일 때만 캐시 저장
                                if (interval === '1d' && rawData && rawData.length > 0) {
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

                stopRealtimeAnalysis: () => {
                    // console.log('[실시간 분석] 중지 및 메모리 정리 시작');

                    // 메모리 정리: 실시간 분석 관련 데이터 초기화
                    set({
                        isRealtimeAnalysis: false,
                        isAnalyzing: false,
                        realtimeAnalysisData: {}, // 캔들 데이터 해제
                        realtimeAnalysisTickers: [], // 분석 대상 티커 초기화
                        // realtimeTrades, realtimePositions는 사용자가 참고할 수 있으므로 유지
                    });

                    // WebSocket 구독 해제
                    import('@/lib/kisWebSocket').then(({ kisWebSocket }) => {
                        kisWebSocket.subscribeAnalysis([]);
                    });

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
