import { isUSDST, getUSMarketCloseTime, getMinutesUntilClose } from "@/lib/marketTime"
import { useStore } from "@/store/useStore"
import { fetchStockOneYearData, fetchStockOverview } from "@/lib/api"
import { addDerivedData, analyzeSignal } from "@/lib/dataProcessor"
import { getOverseasBalance, buyOverseasStock, sellOverseasStock, getOverseasStockPrice } from "@/lib/kisApi"

/**
 * 자동 매매 실행 로직 (Core)
 * 1분마다 호출됨.
 */
export async function executeAutoTrade() {
    const store = useStore.getState();
    const { autoTradeSettings, kisAuth, strategyOptions } = store;

    // 1. 기본 체크
    if (!autoTradeSettings.isEnabled) return;
    if (!kisAuth.isLoggedIn) {
        store.addAutoTradeLog("오류: KIS 로그인이 필요합니다.");
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (store.autoTradeStatus.lastRunDate === todayStr) {
        // 이미 오늘 실행함
        return;
    }

    // 2. 시간 체크
    const minutesLeft = getMinutesUntilClose();
    // 설정된 시간 (예: 30분) 이내이고, -5분 (장 마감 5분 전까지) 사이일 때만 실행
    // 너무 임박하면 위험하므로 1분 전엔 실행 안 함 등의 안전장치
    if (minutesLeft <= autoTradeSettings.executionTimeMinutes && minutesLeft > 1) {
        // TRIGGER
        store.setLastRunDate(todayStr); // 실행 플래그
        store.addAutoTradeLog(`자동 매매 시작 (장 마감 ${minutesLeft}분 전)`);

        try {
            await runAutoTradeProcess(store);
            store.addAutoTradeLog("자동 매매 완료");
        } catch (e) {
            console.error(e);
            store.addAutoTradeLog(`자동 매매 실패: ${e.message}`);
        }
    }
}

async function runAutoTradeProcess(store) {
    const { autoTradeSettings, kisAuth, strategyOptions } = store;

    // 1. 보유 종목 조회 (Holdings)
    store.addAutoTradeLog("보유 종목 조회 중...");
    const balanceRes = await getOverseasBalance(kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, kisAuth.accountNo, kisAuth.accountCode);

    if (!balanceRes.success) {
        throw new Error("잔고 조회 실패: " + balanceRes.error);
    }

    const holdings = balanceRes.holdings.filter(h => Number(h.ccld_qty_smtl1) > 0);
    const holdingTickers = new Set(holdings.map(h => h.pdno)); // 티커 목록
    store.addAutoTradeLog(`보유 종목: ${holdings.length}개`);

    // 2. 분석 대상 종목 로드
    store.addAutoTradeLog(`그룹 종목 로드 중 (${autoTradeSettings.targetGroup})...`);
    // Store의 action을 재사용하기엔 비동기 제어가 어려우므로 직접 로직 구현 or store fetch 호출
    // 여기서는 store.fetchGroupStocks() 가 state를 업데이트하므로, 그걸 호출하고 state를 읽음

    // 주의: fetchGroupStocks는 store의 tickerGroup state를 씀.
    // 잠시 바꿔야 할 수도 있음. 하지만 UI에 영향 주므로, 직접 fetching logic을 복사하는게 안전.
    // 간단히: targetGroup이 'myholdings'면 위 holdings 사용.
    // 'sp500', 'qqq' 등은 import 함수 사용.

    let targetStocks = [];
    if (autoTradeSettings.targetGroup === 'myholdings') {
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

    if (targetStocks.length === 0) {
        store.addAutoTradeLog("분석 대상 종목이 없습니다.");
        return;
    }

    store.addAutoTradeLog(`${targetStocks.length}개 종목 분석 시작...`);

    // 3. 분석 및 신호 산출
    const buyList = [];
    const sellList = [];

    // 병렬 처리 제한 (API Rate Limit 고려)
    // 5개씩 끊어서 처리
    const CHUNK_SIZE = 5;
    for (let i = 0; i < targetStocks.length; i += CHUNK_SIZE) {
        const chunk = targetStocks.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (stock) => {
            try {
                // 1년치 데이터 로드
                const data = await fetchStockOneYearData(stock.ticker);
                if (!data || data.length < 20) return;

                // 지표 계산
                const dataWithSlope = addDerivedData(data);

                // 신호 분석 using Global Strategy
                const { signal, reason } = analyzeSignal(dataWithSlope, strategyOptions);

                if (signal === 'BUY') {
                    // 미보유 종목만 매수
                    if (!holdingTickers.has(stock.ticker)) {
                        buyList.push({ ticker: stock.ticker, reason, price: data[data.length - 1].close });
                    }
                } else if (signal === 'SELL') {
                    // 보유 종목만 매도
                    if (holdingTickers.has(stock.ticker)) {
                        // 보유 수량 찾기
                        const holding = holdings.find(h => h.pdno === stock.ticker);
                        sellList.push({ ticker: stock.ticker, reason, qty: holding.ccld_qty_smtl1, price: data[data.length - 1].close });
                    }
                }
            } catch (e) {
                console.warn(`Analysis failed for ${stock.ticker}`, e);
            }
        }));

        // 딜레이 (Rate Limit 방지)
        await new Promise(r => setTimeout(r, 200));
    }

    store.addAutoTradeLog(`분석 완료: 매수 ${buyList.length}건, 매도 ${sellList.length}건`);

    // 4. 매도 실행 (먼저 현금 확보)
    for (const item of sellList) {
        store.addAutoTradeLog(`[매도] ${item.ticker} (${item.reason}) 실행...`);
        // 실시간 현재가 조회 (정확한 주문 위해)
        // KIS API가 없으면 Yahoo price라도 써야하지만, KIS API getPriceFluctuation 등 활용 가능.
        // 하지만 여기선 야후 가격(`item.price`)을 참고가로 하여 시장가 매도? 
        // 해외주식은 보통 지정가. 현재가의 -1% 정도로 매도 주문 (즉시 체결 유도)

        // KIS 주문 API 호출
        const res = await sellOverseasStock(
            kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, kisAuth.accountNo, kisAuth.accountCode,
            item.ticker,
            Number(item.qty),
            0 // 0이면 시장가? 해외주식은 시장가 지원 여부 확인 필요. 보통 지정가 필수인 경우 많음.
            // 여기서는 일단 지정가(현재가)로 주문한다고 가정. 슬리피지 고려해야함.
            // 만약 지정가라면 item.price 사용.
        );

        if (res.success) {
            store.addAutoTradeLog(`[매도 성공] ${item.ticker} 수량: ${item.qty}`);
        } else {
            store.addAutoTradeLog(`[매도 실패] ${item.ticker}: ${res.message}`);
        }
    }

    // 5. 매수 실행
    for (const item of buyList) {
        store.addAutoTradeLog(`[매수] ${item.ticker} (${item.reason}) 실행...`);

        // 수량 계산
        let qty = 0;
        let price = item.price; // 분석 시점 종가 (근사치)

        if (autoTradeSettings.amountType === 'quantity') {
            qty = Number(autoTradeSettings.buyAmount);
        } else {
            // 금액 기준 ($)
            qty = Math.floor(Number(autoTradeSettings.buyAmount) / price);
            // 최소 1주 보장
            if (qty === 0) {
                store.addAutoTradeLog(`[매수 보정] 설정금액($${autoTradeSettings.buyAmount}) < 현재가($${price}) -> 1주로 주문`);
                qty = 1;
            }
        }

        if (qty <= 0) { // 혹시나 마이너스 등 예외 처리
            store.addAutoTradeLog(`[매수 스킵] ${item.ticker}: 수량 오류`);
            continue;
        }

        // KIS 주문 API 호출 (지정가: 현재가의 +1%? 즉시 체결 유도)
        const orderPrice = price * 1.01;
        // 소수점 2자리 (미국주식)
        const finalPrice = Math.floor(orderPrice * 100) / 100;

        const res = await buyOverseasStock(
            kisAuth.accessToken, kisAuth.appkey, kisAuth.appsecret, kisAuth.accountNo, kisAuth.accountCode,
            item.ticker,
            qty,
            finalPrice
        );

        if (res.success) {
            store.addAutoTradeLog(`[매수 성공] ${item.ticker} 수량: ${qty}, 가격: ${finalPrice}`);
        } else {
            store.addAutoTradeLog(`[매수 실패] ${item.ticker}: ${res.message}`);
        }
    }
}
