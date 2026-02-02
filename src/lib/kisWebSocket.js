import { useStore } from "@/store/useStore";

// WebSocket URL 설정
// - 개발: 직접 KIS WebSocket 연결 (ws://)
// - 운영: Railway 프록시 경유 (wss://) - VITE_WS_PROXY_URL 환경변수로 설정
const WS_URL = import.meta.env.DEV
    ? "ws://ops.koreainvestment.com:21000"
    : import.meta.env.VITE_WS_PROXY_URL || "wss://YOUR_RAILWAY_APP.up.railway.app";


/**
 * KIS(한국투자증권) 실시간 WebSocket을 관리하는 싱글턴 클래스.
 * 
 * 뷰포트에 보이는 종목만 구독하여 효율적인 실시간 데이터 수신을 지원합니다.
 * 
 * ## 환경별 연결
 * - **개발환경**: `ws://ops.koreainvestment.com:21000` 직접 연결
 * - **운영환경**: Railway 프록시(`wss://`)를 경유하여 연결 (HTTPS 환경에서 ws:// 차단 우회)
 * 
 * ## 사용 예시
 * ```javascript
 * import { kisWebSocket } from '@/lib/kisWebSocket';
 * 
 * // 연결
 * kisWebSocket.connect(approvalKey);
 * 
 * // 종목 구독
 * kisWebSocket.subscribeStocks([{ ticker: 'AAPL', exchange: 'NAS' }]);
 * 
 * // 연결 종료
 * kisWebSocket.disconnect();
 * ```
 * 
 * @class
 */
class KISWebSocketManager {
    constructor() {
        this.socket = null;
        this.approvalKey = null;

        // 구독 관리: 소스별 키 집합
        this.viewportKeys = new Set();
        this.analysisKeys = new Set();

        this.subscribedTickers = new Set(); // 실제 활성 구독 (TR_ID|TR_KEY)

        this.isConnecting = false;
        this.reconnectTimer = null;
        this.pingTimer = null;
        this.messageQueue = [];
        this.updateBatch = {};
        this.flushTimer = null;
    }

    connect(approvalKey) {
        if (!approvalKey) return;
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.approvalKey = approvalKey;
        this.isConnecting = true;

        try {
            console.log("[KIS WS] Connecting to", WS_URL);
            this.socket = new WebSocket(WS_URL);

            this.socket.onopen = () => {
                console.log("[KIS WS] Connected");
                this.isConnecting = false;

                while (this.messageQueue.length > 0) {
                    this.sendJson(this.messageQueue.shift());
                }

                this.resubscribeAll();
                this.startPing();
                this.startFlushTimer();
                useStore.getState().setWsStatus({ connected: true });
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.socket.onclose = (event) => {
                console.log("[KIS WS] Closed:", event.code);
                this.isConnecting = false;
                this.stopPing();
                this.stopFlushTimer();
                if (event.code !== 1000) {
                    this.scheduleReconnect();
                }
                useStore.getState().setWsStatus({ connected: false, subscriptionCount: 0 });
            };

            this.socket.onerror = (error) => {
                console.error("[KIS WS] Error:", error);
                this.isConnecting = false;
                useStore.getState().setWsStatus({ connected: false });
            };

        } catch (e) {
            console.error("[KIS WS] Connection failed:", e);
            this.scheduleReconnect();
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close(1000, "User Disconnect");
            this.socket = null;
        }
        this.stopPing();
        this.stopFlushTimer();
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    }

    scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(this.approvalKey), 5000);
    }

    startPing() {
        this.stopPing();
        this.pingTimer = setInterval(() => {
            // KIS keep-alive logic if needed
        }, 30000);
    }

    stopPing() {
        if (this.pingTimer) clearInterval(this.pingTimer);
    }

    /**
     * 뷰포트에 보이는 종목들로 구독 리스트 업데이트 (Source: Viewport)
     * @param {Array<{ticker: string, exchange: string}>} visibleStocks 
     */
    subscribeStocks(visibleStocks) {
        const newKeys = new Set();
        visibleStocks.forEach(stock => {
            const trInfo = this.getTrInfo(stock);
            if (trInfo) {
                newKeys.add(`${trInfo.tr_id}|${trInfo.tr_key}`);
            }
        });

        this.viewportKeys = newKeys;
        this.syncSubscriptions();
    }

    /**
     * 실시간 분석 대상 종목 구독 (Source: Analysis)
     * @param {Array<{ticker: string, exchange: string}>} analysisStocks 
     */
    subscribeAnalysis(analysisStocks) {
        const newKeys = new Set();
        analysisStocks.forEach(stock => {
            const trInfo = this.getTrInfo(stock);
            if (trInfo) {
                newKeys.add(`${trInfo.tr_id}|${trInfo.tr_key}`);
            }
        });

        this.analysisKeys = newKeys;
        this.syncSubscriptions();
    }

    /**
     * 구독 상태 동기화 (Union of Viewport & Analysis)
     */
    syncSubscriptions() {
        if (!this.approvalKey) return;

        // 1. 필요한 모든 키의 합집합 생성 (단, 분석 중이면 분석 리스트에만 집중)
        // 사용자의 요청: "분석창에서는 기존 티커선택창에서 보이는 종목만 구독하는건 안해야 하고, 오로지 지금 실시간 분석중인 4개 종목에 대해서만 구독"
        const isAnalysisActive = this.analysisKeys.size > 0;
        const neededKeys = isAnalysisActive ? new Set(this.analysisKeys) : new Set(this.viewportKeys);

        // 2. 더 이상 필요없는 구독 해제 (Current - Needed)
        for (const oldKey of this.subscribedTickers) {
            if (!neededKeys.has(oldKey)) {
                const [tr_id, tr_key] = oldKey.split('|');
                this.sendJson({
                    header: {
                        approval_key: this.approvalKey,
                        custtype: "P",
                        tr_type: "2", // 해제
                        "content-type": "utf-8"
                    },
                    body: {
                        input: { tr_id, tr_key }
                    }
                });
                this.subscribedTickers.delete(oldKey);
            }
        }

        // 3. 새로운 구독 요청 (Needed - Current)
        for (const newKey of neededKeys) {
            if (!this.subscribedTickers.has(newKey)) {
                const [tr_id, tr_key] = newKey.split('|');
                this.sendJson({
                    header: {
                        approval_key: this.approvalKey,
                        custtype: "P",
                        tr_type: "1", // 등록
                        "content-type": "utf-8"
                    },
                    body: {
                        input: { tr_id, tr_key }
                    }
                });
                this.subscribedTickers.add(newKey);
            }
        }

        // 스토어 구독 개수 업데이트
        useStore.getState().setWsStatus({ subscriptionCount: this.subscribedTickers.size });
    }

    resubscribeAll() {
        const isAnalysisActive = this.analysisKeys.size > 0;
        const neededKeys = isAnalysisActive ? this.analysisKeys : this.viewportKeys;

        for (const key of neededKeys) {
            const [tr_id, tr_key] = key.split('|');
            this.sendJson({
                header: {
                    approval_key: this.approvalKey,
                    custtype: "P",
                    tr_type: "1",
                    "content-type": "utf-8"
                },
                body: {
                    input: { tr_id, tr_key }
                }
            });
        }
    }

    getTrInfo(stock) {
        const ticker = (stock.ticker || '').trim();
        const exchange = stock.exchange;
        const isDomestic = /^\d{6}$/.test(ticker);

        if (isDomestic || ['KOSPI', 'KOSDAQ', 'KONEX', 'KS', 'KQ'].includes(exchange)) {
            return { tr_id: 'H0STCNT0', tr_key: ticker };
        } else {
            let marketCode = 'NAS';
            const ex = (exchange || '').toUpperCase();
            if (ex === 'NYS' || ex === 'NYSE') marketCode = 'NYS';
            else if (ex === 'AMS' || ex === 'AMEX') marketCode = 'AMS';
            else if (ex === 'NAS' || ex === 'NASDAQ') marketCode = 'NAS';
            return { tr_id: 'HDFSCNT0', tr_key: `D${marketCode}${ticker}` };
        }
    }

    /**
     * 특정 티커가 현재 활발하게 구독 중인지 확인 (TR_KEY 기준)
     */
    isSubscribed(ticker, exchange) {
        const trInfo = this.getTrInfo({ ticker, exchange });
        if (!trInfo) return false;
        return this.subscribedTickers.has(`${trInfo.tr_id}|${trInfo.tr_key}`);
    }

    /**
     * 현재 구독 중인 티커 리스트 반환
     */
    getSubscribedTickerList() {
        return Array.from(this.subscribedTickers).map(k => k.split('|')[1]);
    }

    /**
     * 현재 활성 구독 개수 반환
     */
    getActiveSubscriptionsCount() {
        return this.subscribedTickers.size;
    }


    sendJson(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
            this.messageQueue.push(data);
        }
    }

    handleMessage(message) {
        const firstChar = message.charAt(0);
        if (firstChar !== '0' && firstChar !== '1') {
            try {
                const json = JSON.parse(message);
                if (json.body && json.body.msg1) {
                    const msg = json.body.msg1;
                    console.log(`[KIS WS Msg] ${msg}`);
                }
            } catch (e) { }
            return;
        }

        const parts = message.split('|');
        if (parts.length < 4) return;

        const trId = parts[1];
        const rawData = parts[3];
        if (!rawData) return;

        if (trId === 'H0STCNT0') {
            this.parseDomestic(rawData);
        } else if (trId === 'HDFSCNT0') {
            this.parseOverseas(rawData);
        }
    }

    parseDomestic(rawData) {
        const fields = rawData.split('^');
        if (fields.length < 6) return;
        const ticker = fields[0];
        this.updateBatch[ticker] = {
            price: parseFloat(fields[2]),
            change: parseFloat(fields[4]),
            rate: parseFloat(fields[5]),
            volume: parseFloat(fields[11])
        };
    }

    parseOverseas(rawData) {
        const fields = rawData.split('^');
        if (fields.length < 15) return;
        const ticker = fields[1];
        this.updateBatch[ticker] = {
            price: parseFloat(fields[11]),
            change: parseFloat(fields[13]),
            rate: parseFloat(fields[14]),
            volume: parseFloat(fields[19])
        };
    }

    startFlushTimer() {
        this.stopFlushTimer();
        let flushCount = 0;
        this.flushTimer = setInterval(() => {
            if (Object.keys(this.updateBatch).length > 0) {
                const batch = this.updateBatch;
                this.updateBatch = {};
                useStore.getState().batchUpdateRealtimePrices(batch);

                // 10회마다 메모리 상태 로깅 (약 5초마다)
                flushCount++;
                if (flushCount % 10 === 0) {
                    const stats = useStore.getState().debugMemoryStats();
                    console.log('[WS Flush]', flushCount, '회 실행, 배치 크기:', Object.keys(batch).length);
                }
            }
        }, 500);
    }

    stopFlushTimer() {
        if (this.flushTimer) clearInterval(this.flushTimer);
    }
}

export const kisWebSocket = new KISWebSocketManager();
