import { isUSDST, getUSMarketCloseTime, getMinutesUntilClose } from "@/lib/marketTime"
import { useStore } from "@/store/useStore"
import { fetchStockOneYearData, fetchStockOverview } from "@/lib/api"
import { addDerivedData, analyzeSignal } from "@/lib/dataProcessor"
import { getOverseasBalance, buyOverseasStock, sellOverseasStock, getOverseasStockPrice, getOverseasStockPriceWithExchangeSearch } from "@/lib/kisApi"
import { addPendingOrder, clearPendingOrders, startSettlementMonitoring, isSettlementMonitoringActive } from "@/lib/orderTracker"

/**
 * 자동 매매 실행 로직 (Core)
 * 1분마다 호출됨.
 */
export async function executeAutoTrade(isTest = false) {
    const store = useStore.getState();
    const { autoTradeSettings, kisAuth } = store;

    // 1. 기본 체크
    if (!isTest && !autoTradeSettings.isEnabled) return;
    if (!kisAuth.isLoggedIn) {
        store.addAutoTradeLog("오류: KIS 로그인이 필요합니다.");
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (!isTest && store.autoTradeStatus.lastRunDate === todayStr) {
        // 이미 오늘 실행함
        return;
    }

    // 2. 시간 체크
    const minutesLeft = getMinutesUntilClose();

    // 테스트 모드이거나, 설정된 시간 범위 내일 때 실행
    if (isTest || (minutesLeft <= autoTradeSettings.executionTimeMinutes && minutesLeft > 1)) {
        // TRIGGER
        if (!isTest) {
            store.setLastRunDate(todayStr); // 실행 플래그
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

async function runAutoTradeProcess(store, isTest = false) {
    const { autoTradeSettings, kisAuth } = store;

    // 자동 매매 전용 전략 옵션 구성
    const autoTradeStrategyOptions = {
        useBB: autoTradeSettings.useBB,
        useTrend: autoTradeSettings.useTrend,
        useTrend20: autoTradeSettings.useTrend20,
        useRSI: autoTradeSettings.useRSI,
        useVolumeFilter: autoTradeSettings.useVolumeFilter,
        // 손절/익절은 자동 매매에서 미사용 (신호 분석용)
        useStopLoss: false,
        useTakeProfit: false,
        useTrailingStop: false,
    };

    // 1. 보유 종목 조회 (Holdings)
    store.addAutoTradeLog("보유 종목 조회 중...");
    const balanceRes = await getOverseasBalance(kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, kisAuth.accountNo, kisAuth.accountCode);

    if (!balanceRes.success) {
        throw new Error("잔고 조회 실패: " + balanceRes.error);
    }

    const holdings = balanceRes.holdings.filter(h => Number(h.ccld_qty_smtl1) > 0);
    const holdingTickers = new Set(holdings.map(h => h.pdno)); // 티커 목록
    store.addAutoTradeLog(`보유 종목: ${holdings.length}개`);

    // 2-1. 매수 대상 종목 로드 (Target Group)
    store.addAutoTradeLog(`[매수 분석] 그룹 종목 로드 중 (${autoTradeSettings.targetGroup})...`);

    let targetStocks = [];
    if (autoTradeSettings.targetGroup === 'myholdings') {
        // 내 보유종목을 타겟으로 하면 추가 매수 리스트는 안 나옴 (보유종목 제외 필터 때문)
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

    // 로컬 데이터 캐시 (중복 조회 방지)
    const localDataCache = {};

    const loadData = async (ticker) => {
        if (localDataCache[ticker]) return localDataCache[ticker];
        try {
            const data = await fetchStockOneYearData(ticker);
            if (data && data.length >= 20) {
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

    // Chunk processing for Buying
    const CHUNK_SIZE = 5;
    for (let i = 0; i < targetStocks.length; i += CHUNK_SIZE) {
        const chunk = targetStocks.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (stock) => {
            // 보유 종목은 매수 대상에서 제외 (기존 로직 유지)
            if (holdingTickers.has(stock.ticker)) return;

            const data = await loadData(stock.ticker);
            if (!data) return;

            const { signal, reason } = analyzeSignal(data, autoTradeStrategyOptions);
            if (signal === 'BUY') {
                buyList.push({ ticker: stock.ticker, reason, price: data[data.length - 1].close });
            }
        }));
        await new Promise(r => setTimeout(r, 200));
    }

    // 4. 매도 분석 (My Holdings)
    store.addAutoTradeLog(`[매도 분석] 보유 종목 ${holdings.length}개 스캔...`);

    const sellList = [];
    const buyTickers = new Set(buyList.map(item => item.ticker));

    for (const holding of holdings) {
        const ticker = holding.pdno;

        // 앞 단계에서 매수 결정된 종목은 매도 대상에서 제외 (Condition)
        if (buyTickers.has(ticker)) continue;

        const data = await loadData(ticker);
        if (!data) continue;

        const { signal, reason } = analyzeSignal(data, autoTradeStrategyOptions);

        // SELL 신호 발생 시 매도 리스트 추가
        if (signal === 'SELL') {
            // store.addAutoTradeLog(` -> ${ticker}: SELL (${reason})`); // 너무 많으면 로그 지저분해지므로 생략
            sellList.push({ ticker: ticker, reason, qty: holding.ccld_qty_smtl1, price: data[data.length - 1].close });
        }
    }

    store.addAutoTradeLog(`분석 완료: 매수 ${buyList.length}건, 매도 ${sellList.length}건`);

    // 4. 매도 실행 (먼저 현금 확보)
    for (const item of sellList) {
        store.addAutoTradeLog(`[매도] ${item.ticker} (${item.reason}) 실행...`);

        // 1. 거래소 및 현재가 확인
        const marketInfo = await getOverseasStockPriceWithExchangeSearch(kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, item.ticker);

        let tradePrice = item.price; // 기본값 (야후 데이터)
        let exchange = 'NAS';

        if (marketInfo.success) {
            tradePrice = Number(marketInfo.price);
            exchange = marketInfo.exchange;
        } else {
            // 시세 조회 실패 시 야후 데이터 사용
            if (!tradePrice || isNaN(tradePrice) || tradePrice <= 0) {
                store.addAutoTradeLog(`[매도 스킵] ${item.ticker}: 시세 조회 실패 및 유효한 가격 없음`);
                continue;
            }
            store.addAutoTradeLog(`[경고] 시세/거래소 조회 실패: ${item.ticker}, 기본값(NAS/$${tradePrice}) 사용`);
        }

        // 가격 포맷팅: 소수점 2자리, 1$ 이상
        tradePrice = Math.round(tradePrice * 100) / 100;
        if (tradePrice < 1) {
            store.addAutoTradeLog(`[매도 스킵] ${item.ticker}: 가격이 $1 미만 ($${tradePrice})`);
            continue;
        }

        // [TEST 모드] API 호출 진행 (단, 수량 0으로 설정하여 실패 유도)
        let sellQty = Number(item.qty);
        if (isTest) {
            sellQty = 0;
            store.addAutoTradeLog(`[TEST] 테스트 모드 (수량 0)`);
        }

        // 매도 주문 (현재가격으로 지정가 주문)
        const res = await sellOverseasStock(
            kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, kisAuth.accountNo, kisAuth.accountCode,
            item.ticker,
            sellQty,
            tradePrice, // 지정가 (소수점 2자리)
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

    // 5. 매수 실행
    for (const item of buyList) {
        store.addAutoTradeLog(`[매수] ${item.ticker} (${item.reason}) 실행...`);

        // 1. 거래소 및 현재가 확인
        const marketInfo = await getOverseasStockPriceWithExchangeSearch(kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, item.ticker);

        let tradePrice = item.price; // 기본값 (야후 데이터)
        let exchange = 'NAS';

        if (marketInfo.success) {
            tradePrice = Number(marketInfo.price);
            exchange = marketInfo.exchange;
        } else {
            // 시세 조회 실패 시 야후 데이터 사용
            if (!tradePrice || isNaN(tradePrice) || tradePrice <= 0) {
                store.addAutoTradeLog(`[매수 스킵] ${item.ticker}: 시세 조회 실패 및 유효한 가격 없음`);
                continue;
            }
            store.addAutoTradeLog(`[경고] 시세/거래소 조회 실패: ${item.ticker}, 기본값(NAS/$${tradePrice}) 사용`);
        }

        // 가격 유효성 검증
        tradePrice = Math.round(tradePrice * 100) / 100;
        if (tradePrice < 1) {
            store.addAutoTradeLog(`[매수 스킵] ${item.ticker}: 가격이 $1 미만 ($${tradePrice})`);
            continue;
        }

        // 수량 계산
        let qty = 0;

        if (autoTradeSettings.amountType === 'quantity') {
            qty = Number(autoTradeSettings.buyAmount);
        } else {
            // 금액 기준 ($)
            qty = Math.floor(Number(autoTradeSettings.buyAmount) / tradePrice);
            // 최소 1주 보장
            if (qty === 0) {
                store.addAutoTradeLog(`[매수 보정] 설정금액($${autoTradeSettings.buyAmount}) < 현재가($${tradePrice}) -> 1주로 주문`);
                qty = 1;
            }
        }

        // [TEST 모드] 수량 0으로 강제 설정
        if (isTest) {
            qty = 0;
            store.addAutoTradeLog(`[TEST] 테스트 모드 (수량 0)`);
        }

        if (qty <= 0 && !isTest) {
            store.addAutoTradeLog(`[매수 스킵] ${item.ticker}: 수량 오류`);
            continue;
        }

        // KIS 주문 API 호출 (지정가: 현재가의 +1%? 즉시 체결 유도)
        const orderPrice = tradePrice * 1.01;
        // 소수점 2자리 (미국주식)
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
            // 주문 추적 목록에 추가 (테스트 모드 제외)
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

    // 6. 체결 모니터링 시작 (테스트 모드 제외)
    if (!isTest && !isSettlementMonitoringActive()) {
        // 10분(600000ms) 간격으로 체결 확인
        startSettlementMonitoring(kisAuth, 600000);
    }
}
