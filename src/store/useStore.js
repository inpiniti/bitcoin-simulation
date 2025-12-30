import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { fetchOneYearData } from '@/lib/api'
import { aggregateToInterval, addSlopeData, generateTrades, calculateFixedQuantityResult, calculateMartingaleResult, INTERVALS } from '@/lib/dataProcessor'

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

                // Loading states (로딩 상태는 persist에서 제외)
                loadingInterval: {},
                loadingSimul: {},

                // Progress for 1m fetch
                fetchProgress: { current: 0, total: 0 },

                // Currently active interval for simulation
                activeInterval: null,

                // Currently selected simulation result to display
                selectedResult: null,

                // Actions
                setFetchProgress: (current, total) => set({ fetchProgress: { current, total } }),

                /**
                 * 1분 데이터 로드 (API 호출)
                 */
                loadHist1m: async () => {
                    const state = get();
                    if (state.hist['1m'].length > 0) return; // 이미 로드됨

                    set((s) => ({ loadingInterval: { ...s.loadingInterval, '1m': true } }));

                    try {
                        const rawData = await fetchOneYearData((current, total) => {
                            set({ fetchProgress: { current, total } });
                        });

                        // 기울기 추가
                        const dataWithSlope = addSlopeData(rawData);

                        set((s) => ({
                            hist: { ...s.hist, '1m': dataWithSlope },
                            loadingInterval: { ...s.loadingInterval, '1m': false },
                        }));
                    } catch (error) {
                        console.error('Failed to load 1m data:', error);
                        set((s) => ({ loadingInterval: { ...s.loadingInterval, '1m': false } }));
                    }
                },

                /**
                 * 특정 간격 데이터 생성 (1분 데이터 기반)
                 */
                loadHistInterval: async (interval) => {
                    const state = get();
                    if (state.hist[interval] && state.hist[interval].length > 0) return; // 이미 생성됨
                    if (state.hist['1m'].length === 0) {
                        console.error('1분 데이터가 먼저 로드되어야 합니다.');
                        return;
                    }

                    set((s) => ({ loadingInterval: { ...s.loadingInterval, [interval]: true } }));

                    // 비동기 처리 시뮬레이션 (UI 블로킹 방지)
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const aggregated = aggregateToInterval(state.hist['1m'], INTERVALS[interval]);
                    const dataWithSlope = addSlopeData(aggregated);

                    set((s) => ({
                        hist: { ...s.hist, [interval]: dataWithSlope },
                        loadingInterval: { ...s.loadingInterval, [interval]: false },
                    }));
                },

                /**
                 * 시뮬레이션 실행 (수량 고정)
                 */
                runFixedSimulation: async (interval) => {
                    const state = get();
                    const key = `${interval}_fixed`;

                    if (state.simul[key]) return; // 이미 실행됨

                    set((s) => ({ loadingSimul: { ...s.loadingSimul, [key]: true } }));

                    await new Promise(resolve => setTimeout(resolve, 100));

                    const data = state.hist[interval];
                    const trades = generateTrades(data);
                    const result = calculateFixedQuantityResult(trades);

                    set((s) => ({
                        simul: { ...s.simul, [key]: result },
                        loadingSimul: { ...s.loadingSimul, [key]: false },
                    }));
                },

                /**
                 * 마틴게일 시뮬레이션 실행
                 */
                runMartingaleSimulation: async (interval, multiplier) => {
                    const state = get();
                    const key = `${interval}_martingale_${multiplier}`;

                    if (state.simul[key]) return;

                    set((s) => ({ loadingSimul: { ...s.loadingSimul, [key]: true } }));

                    await new Promise(resolve => setTimeout(resolve, 100));

                    const data = state.hist[interval];
                    const trades = generateTrades(data);
                    const result = calculateMartingaleResult(trades, 100000, multiplier);

                    set((s) => ({
                        simul: { ...s.simul, [key]: result },
                        loadingSimul: { ...s.loadingSimul, [key]: false },
                    }));
                },

                setActiveInterval: (interval) => set({ activeInterval: interval }),
                setSelectedResult: (result) => set({ selectedResult: result }),

                /**
                 * 스토어 초기화 (데이터 삭제)
                 */
                clearAllData: () => set({
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
                    simul: {},
                    activeInterval: null,
                    selectedResult: null,
                }),
            }),
            {
                name: 'bitcoin-simulation-storage', // IndexedDB 키 이름
                storage: createJSONStorage(() => indexedDBStorage),
                // 로딩 상태 등은 persist에서 제외
                partialize: (state) => ({
                    hist: state.hist,
                    simul: state.simul,
                    activeInterval: state.activeInterval,
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
