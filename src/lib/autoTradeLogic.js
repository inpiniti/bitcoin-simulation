import { isUSDST, getUSMarketCloseTime, getMinutesUntilClose } from "@/lib/marketTime"
import { useStore } from "@/store/useStore"
import { fetchStockHistory, fetchStockOverview } from "@/lib/api"
import { addDerivedData, analyzeSignal } from "@/lib/dataProcessor"
import { getOverseasBalance, buyOverseasStock, sellOverseasStock, getOverseasStockPrice, getOverseasStockPriceWithExchangeSearch } from "@/lib/kisApi"
import { addPendingOrder, clearPendingOrders, startSettlementMonitoring, isSettlementMonitoringActive } from "@/lib/orderTracker"

/**
 * 자동 매매 실행 로직 (Core)
 * 1분마다 호출되어 장 마감 시간을 체크하고, 조건 충족 시 매매 프로세스를 실행합니다.
 * 
 * @async
 * @param {boolean} [isTest=false] - 테스트 모드 여부 (true일 경우 수량 0으로 매매 시늉만 수행)
 * @returns {Promise<void>}
 */
export async function executeAutoTrade(isTest = false) {
    const store = useStore.getState();
    const { autoTradeSettings, kisAuth } = store;

    // 1. 기본 체크 (활성화 여부 및 로그인 상태)
    if (!isTest && !autoTradeSettings.isEnabled) return;
    if (!kisAuth.isLoggedIn) {
        store.addAutoTradeLog("오류: KIS 로그인이 필요합니다.");
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // 1일 1회 실행 원칙 체크
    if (!isTest && store.autoTradeStatus.lastRunDate === todayStr) {
        // [UX 개선] 사용자가 시스템 작동 여부를 확인할 수 있도록 매 시간 정각에 Heartbeat 로그 출력
        const now = new Date();
        if (now.getMinutes() === 0) {
            const logs = store.autoTradeLogs || [];
            const lastLog = logs[logs.length - 1];
            // 같은 분(minute) 내 중복 출력 방지
            if (!lastLog?.message?.includes("금일 매매 완료 대기 중")) {
                store.addAutoTradeLog(`[시스템] 금일 매매 완료 대기 중입니다. (Date: ${todayStr})`);
            }
        }
        return;
    }

    // 2. 시간 체크 (장 마감 N분 전)
    const minutesLeft = getMinutesUntilClose();

    // 테스트 모드이거나, 설정된 시간 범위 내일 때 실행 (장 마감 1분 전까지)
    if (isTest || (minutesLeft <= autoTradeSettings.executionTimeMinutes && minutesLeft > 1)) {
        // TRIGGER: 실행 상태로 전환
        if (!isTest) {
            store.setLastRunDate(todayStr); // 실행 플래그 설정 (재진입 방지)
        }

        const modeText = isTest ? "[TEST 모드]" : "";
        store.addAutoTradeLog(`${modeText} 자동 매매 시작 (장 마감 ${minutesLeft}분 전)`);

        try {
            await runAutoTradeProcess(store, isTest);
            store.addAutoTradeLog(`${modeText} 자동 매매 완료`);
        } catch (e) {
            console.error(e);
            store.addAutoTradeLog(`${modeText} 자동 매매 실패: ${e.message}`);
        }
    }
}

/**
 * 실제 매매 프로세스를 수행하는 내부 함수
 * 
 * flow:
 * 1. 보유 종목 조회
 * 2. 매수 대상 종목 데이터 로드 및 분석
 * 3. 매도 대상 종목(보유중) 분석 (수익률 체크 포함)
 * 4. 매도 주문 실행 (현금 확보)
 * 5. 매수 주문 실행
 * 6. 체결 모니터링 시작
 * 
 * @async
 * @param {Object} store - Zustand Store State
 * @param {boolean} isTest - 테스트 모드 여부
 */
async function runAutoTradeProcess(store, isTest = false) {
    const { autoTradeSettings, kisAuth } = store;

    // 자동 매매 전용 전략 옵션 구성
    const autoTradeStrategyOptions = {
        useBB: autoTradeSettings.useBB,
        useTrend: autoTradeSettings.useTrend,
        useTrend20: autoTradeSettings.useTrend20,
        useRSI: autoTradeSettings.useRSI,
        useVolumeFilter: autoTradeSettings.useVolumeFilter,
        // V-Martingale (복리 강화 매수) 설정
        useVMartingale: autoTradeSettings.useVMartingale,
        vMartingaleProfitCut: autoTradeSettings.vMartingaleProfitCut,
        // 손절/익절은 자동 매매 로직 내에서 별도 처리하므로 미사용
        useStopLoss: false,
        useTakeProfit: false,
        useTrailingStop: false,
    };

    // V-Martingale 매수 횟수 추적 (종목별)
    const vMartingaleBuyCount = {};

    // 1. 보유 종목 조회 (Holdings)
    store.addAutoTradeLog("보유 종목 조회 중...");
    const balanceRes = await getOverseasBalance(kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, kisAuth.accountNo, kisAuth.accountCode);

    if (!balanceRes.success) {
        throw new Error("잔고 조회 실패: " + balanceRes.error);
    }

    // 보유 수량이 있는 종목만 필터링
    const holdings = balanceRes.holdings.filter(h => Number(h.ccld_qty_smtl1) > 0);
    const holdingTickers = new Set(holdings.map(h => h.pdno)); // 티커 목록
    store.addAutoTradeLog(`보유 종목: ${holdings.length}개`);

    // 2-1. 매수 대상 종목 로드 (Target Group)
    store.addAutoTradeLog(`[매수 분석] 그룹 종목 로드 중 (${autoTradeSettings.targetGroup})...`);

    let targetStocks = [];
    if (autoTradeSettings.targetGroup === 'myholdings') {
        // 내 보유종목을 타겟으로 하면 추가 매수 리스트는 안 나옴 (보유종목 제외 필터 때문)
        // 단, V-Martingale 전략 사용 시에는 물타기가 가능하므로 의미 있음
        targetStocks = holdings.map(h => ({ ticker: h.pdno, name: h.prdt_name }));
    } else if (autoTradeSettings.targetGroup === 'sp500') {
        const { fetchSP500Tickers } = await import('@/lib/sp500Data');
        targetStocks = await fetchSP500Tickers();
    } else if (autoTradeSettings.targetGroup === 'qqq') {
        const { fetchQQQTickers } = await import('@/lib/qqqData');
        targetStocks = await fetchQQQTickers();
    } else if (autoTradeSettings.targetGroup === 'superinvestor') {
        const { fetchRecommendedTickers } = await import('@/lib/api');
        targetStocks = await fetchRecommendedTickers();
    }

    // 2-2. 매도 대상 종목 준비 (My Holdings)
    // holdings 변수 사용 (이미 조회됨)

    // 로컬 데이터 캐시 (중복 API 호출 방지 및 성능 최적화)
    const localDataCache = {};

    /**
     * 종목 과거 데이터 로드 및 지표 계산 헬퍼 함수
     */
    const loadData = async (ticker) => {
        if (localDataCache[ticker]) return localDataCache[ticker];
        try {
            const data = await fetchStockHistory(ticker);
            if (data && data.length >= 20) {
                // 기술적 지표(RSI, BB 등) 추가
                const dataWithSlope = addDerivedData(data);
                localDataCache[ticker] = dataWithSlope;
                return dataWithSlope;
            }
        } catch (e) {
            console.warn(`Data load failed: ${ticker}`, e);
        }
        return null;
    };

    // 3. 매수 분석 (Target Group)
    if (targetStocks.length > 0) {
        store.addAutoTradeLog(`[매수 분석] ${targetStocks.length}개 종목 스캔...`);
    } else {
        store.addAutoTradeLog(`[매수 분석] 대상 종목 없음`);
    }

    const buyList = [];

    // Chunk processing for Buying (병렬 처리로 속도 향상)
    const CHUNK_SIZE = 5;
    for (let i = 0; i < targetStocks.length; i += CHUNK_SIZE) {
        const chunk = targetStocks.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (stock) => {
            // V-Martingale 활성화 시 보유 종목도 매수 대상에 포함 (추가 매수)
            const isHolding = holdingTickers.has(stock.ticker);
            if (isHolding && !autoTradeSettings.useVMartingale) return;

            const data = await loadData(stock.ticker);
            if (!data) return;

            const { signal, reason } = analyzeSignal(data, autoTradeStrategyOptions);
            if (signal === 'BUY') {
                // V-Martingale: 보유 종목이라면 추가 매수 횟수 기록 (가상으로 1 증가)
                const buyCount = isHolding ? (vMartingaleBuyCount[stock.ticker] || 1) : 0;
                vMartingaleBuyCount[stock.ticker] = buyCount + 1;

                buyList.push({
                    ticker: stock.ticker,
                    reason: isHolding ? `V-Martingale Add (#${buyCount + 1})` : reason,
                    price: data[data.length - 1].close,
                    isVMartingale: isHolding,
                    vMartingaleLevel: buyCount
                });
            }
        }));
        await new Promise(r => setTimeout(r, 200)); // API Rate Limit 고려
    }

    // 4. 매도 분석 (My Holdings)
    store.addAutoTradeLog(`[매도 분석] 보유 종목 ${holdings.length}개 정밀 분석 시작...`);

    const sellList = [];
    const buyTickers = new Set(buyList.map(item => item.ticker));

    // 분석 통계 리포트용 (투명성 확보)
    let analyzeStats = { sellSignal: 0, holdSignal: 0, buySignalInHoldings: 0, vMartingailHold: 0 };

    for (const holding of holdings) {
        const ticker = holding.pdno;

        // 앞 단계에서 매수 결정된 종목은 매도 대상에서 제외 (Condition)
        if (buyTickers.has(ticker)) {
            analyzeStats.buySignalInHoldings++;
            continue;
        }

        const data = await loadData(ticker);
        if (!data) continue;

        const { signal, reason } = analyzeSignal(data, autoTradeStrategyOptions);

        // SELL 신호 발생 시 매도 로직 진입
        if (signal === 'SELL') {
            // V-Martingale 활성화 시: 최소 수익률 체크
            if (autoTradeSettings.useVMartingale) {
                // [BugFix] 수익률 계산 우선순위 변경: API 제공 값(evlu_pfls_rt1) 사용 -> 없으면 직접 계산
                // API 필드: evlu_pfls_rt1 (평가손익율), pchs_avg_pric (매입평균단가)
                let profitRate = parseFloat(holding.evlu_pfls_rt1 || holding.evlu_pfls_rt || '0');

                // API 값이 0이면 직접 계산 시도 (Backup Logic)
                if (profitRate === 0) {
                    const avgBuyPrice = parseFloat(holding.pchs_avg_pric) || parseFloat(holding.avg_buy_unpr3) || 0;
                    const currentPrice = data[data.length - 1].close;
                    if (avgBuyPrice > 0) {
                        profitRate = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
                    }
                }

                // 목표 수익률 미달 시 매도 보류 (강제 장기 보유)
                if (profitRate < autoTradeSettings.vMartingaleProfitCut) {
                    store.addAutoTradeLog(`[V-Martingale 홀드] ${ticker}: 수익률 ${profitRate.toFixed(2)}% < 목표 ${autoTradeSettings.vMartingaleProfitCut}% (신호: SELL)`);
                    analyzeStats.vMartingailHold++;
                    continue; // 매도 리스트에서 제외
                }
            }
            analyzeStats.sellSignal++;
            sellList.push({
                ticker: ticker,
                reason,
                qty: holding.ccld_qty_smtl1,
                price: data[data.length - 1].close,
                avgBuyPrice: parseFloat(holding.pchs_avg_pric) || 0
            });
        } else {
            // HOLD 또는 BUY 신호인 경우
            analyzeStats.holdSignal++;
            if (holdings.length <= 10) {
                store.addAutoTradeLog(`[매도 패스] ${ticker}: ${signal} 신호 유지 (${reason})`);
            }
        }
    }

    store.addAutoTradeLog(`[분석 완료] 매수진입: ${buyList.length}건, 매도확정: ${sellList.length}건 (HOLD: ${analyzeStats.holdSignal}, V-Hold: ${analyzeStats.vMartingailHold})`);

    // 5. 매도 실행 (현금 확보 우선)
    for (const item of sellList) {
        store.addAutoTradeLog(`[매도] ${item.ticker} (${item.reason}) 실행...`);

        // 1. 거래소 및 현재가 확인 (실시간 시세 조회)
        const marketInfo = await getOverseasStockPriceWithExchangeSearch(kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, item.ticker);

        let tradePrice = item.price; // 기본값 (야후 데이터)
        let exchange = 'NAS';

        if (marketInfo.success) {
            tradePrice = Number(marketInfo.price);
            exchange = marketInfo.exchange;
        } else {
            // 시세 조회 실패 시 야후 데이터 사용 (Fallback)
            if (!tradePrice || isNaN(tradePrice) || tradePrice <= 0) {
                store.addAutoTradeLog(`[매도 스킵] ${item.ticker}: 시세 조회 실패 및 유효한 가격 없음`);
                continue;
            }
            store.addAutoTradeLog(`[경고] 시세/거래소 조회 실패: ${item.ticker}, 기본값(NAS/$${tradePrice}) 사용`);
        }

        // 가격 포맷팅: 소수점 2자리, 1$ 이상 체크
        tradePrice = Math.round(tradePrice * 100) / 100;
        if (tradePrice < 1) {
            store.addAutoTradeLog(`[매도 스킵] ${item.ticker}: 가격이 $1 미만 ($${tradePrice})`);
            continue;
        }

        // [TEST 모드] API 호출 진행 (단, 수량 0으로 설정하여 실패 유도 -> 실제 체결 방지)
        let sellQty = Number(item.qty);
        if (isTest) {
            sellQty = 0;
            store.addAutoTradeLog(`[TEST] 테스트 모드 (수량 0)`);
        }

        // 매도 주문 실행 (지정가)
        const res = await sellOverseasStock(
            kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, kisAuth.accountNo, kisAuth.accountCode,
            item.ticker,
            sellQty,
            tradePrice,
            exchange
        );

        if (res.success) {
            store.addAutoTradeLog(`[매도 성공] ${item.ticker} 수량: ${sellQty}, 가격: $${tradePrice}`);
            // 주문 추적 목록에 추가 (테스트 모드 제외)
            if (!isTest && res.orderNo) {
                const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                addPendingOrder({
                    ticker: item.ticker,
                    orderNo: res.orderNo,
                    orderType: 'sell',
                    qty: sellQty,
                    price: tradePrice,
                    orderDate: todayStr,
                    avgBuyPrice: item.avgBuyPrice || 0
                });
            }
        } else {
            store.addAutoTradeLog(`[매도 실패] ${item.ticker}: ${res.error || res.message || '알 수 없는 오류'}`);
        }
    }

    // 6. 매수 실행
    for (const item of buyList) {
        store.addAutoTradeLog(`[매수] ${item.ticker} (${item.reason}) 실행...`);

        // 거래소 및 현재가 확인
        const marketInfo = await getOverseasStockPriceWithExchangeSearch(kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, item.ticker);

        let tradePrice = item.price;
        let exchange = 'NAS';

        if (marketInfo.success) {
            tradePrice = Number(marketInfo.price);
            exchange = marketInfo.exchange;
        } else {
            if (!tradePrice || isNaN(tradePrice) || tradePrice <= 0) {
                store.addAutoTradeLog(`[매수 스킵] ${item.ticker}: 시세 조회 실패`);
                continue;
            }
            store.addAutoTradeLog(`[경고] 시세 조회 실패: ${item.ticker}, 기본값 사용`);
        }

        tradePrice = Math.round(tradePrice * 100) / 100;
        if (tradePrice < 1) {
            store.addAutoTradeLog(`[매수 스킵] ${item.ticker}: 가격이 $1 미만 ($${tradePrice})`);
            continue;
        }

        // 수량 계산 로직
        let qty = 0;
        let baseQty = 0;

        if (autoTradeSettings.amountType === 'quantity') {
            baseQty = Number(autoTradeSettings.buyAmount);
        } else {
            // 금액 기준 ($)
            baseQty = Math.floor(Number(autoTradeSettings.buyAmount) / tradePrice);
            if (baseQty === 0) {
                store.addAutoTradeLog(`[매수 보정] 설정금액($${autoTradeSettings.buyAmount}) < 현재가($${tradePrice}) -> 1주로 주문`);
                baseQty = 1;
            }
        }

        // V-Martingale LevelMultiplier 적용
        if (item.isVMartingale && autoTradeSettings.useVMartingale) {
            const multiplier = Math.pow(2, item.vMartingaleLevel);
            qty = baseQty * multiplier;
            store.addAutoTradeLog(`[V-Martingale] ${item.ticker}: 레벨 ${item.vMartingaleLevel + 1}, 배수 ${multiplier}x, 수량 ${qty}주`);
        } else {
            qty = baseQty;
        }

        if (isTest) {
            qty = 0;
            store.addAutoTradeLog(`[TEST] 테스트 모드 (수량 0)`);
        }

        if (qty <= 0 && !isTest) {
            store.addAutoTradeLog(`[매수 스킵] ${item.ticker}: 수량 오류`);
            continue;
        }

        // 매수 주문 (지정가: 현재가 대비 +1% 높게 불러 즉시 체결 유도)
        const orderPrice = tradePrice * 1.01;
        const finalPrice = Math.floor(orderPrice * 100) / 100;

        const res = await buyOverseasStock(
            kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, kisAuth.accountNo, kisAuth.accountCode,
            item.ticker,
            qty,
            finalPrice,
            exchange
        );

        if (res.success) {
            store.addAutoTradeLog(`[매수 성공] ${item.ticker} 수량: ${qty}, 가격: $${finalPrice}`);
            if (!isTest && res.orderNo) {
                const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                addPendingOrder({
                    ticker: item.ticker,
                    orderNo: res.orderNo,
                    orderType: 'buy',
                    qty: qty,
                    price: finalPrice,
                    orderDate: todayStr
                });
            }
        } else {
            store.addAutoTradeLog(`[매수 실패] ${item.ticker}: ${res.error || res.message || '알 수 없는 오류'}`);
        }
    }

    // 7. 체결 모니터링 시작 (테스트 모드 제외)
    // 10분(600000ms) 간격으로 주기적 체결 확인 루틴을 백그라운드에서 실행
    if (!isTest && !isSettlementMonitoringActive()) {
        startSettlementMonitoring(kisAuth, 600000);
    }
}
