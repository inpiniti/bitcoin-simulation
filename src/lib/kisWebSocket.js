import { useStore } from "@/store/useStore";

const WS_URL = import.meta.env.DEV
    ? "ws://ops.koreainvestment.com:21000" // 로컬 개발 환경: 기존의 비보안 포트(21000) 사용
    : "wss://ops.koreainvestment.com:31000"; // 운영 환경(HTTPS): 보안 포트(31000) 및 WSS 사용


/**
 * 단일 웹소켓 연결을 통해 뷰포트에 보이는 종목만 구독 관리하는 매니저
 */
class KISWebSocketManager {
    constructor() {
        this.socket = null;
        this.approvalKey = null;
        this.subscribedTickers = new Set(); // 현재 구독 중인 "TR_ID|TR_KEY" 셋
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
            };

            this.socket.onerror = (error) => {
                console.error("[KIS WS] Error:", error);
                this.isConnecting = false;
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
     * 뷰포트에 보이는 종목들로 구독 리스트 동적 업데이트
     * @param {Array<{ticker: string, exchange: string}>} visibleStocks 
     */
    subscribeStocks(visibleStocks) {
        if (!this.approvalKey) return;

        const newTickerKeys = new Set();
        const subscribeList = [];

        for (const stock of visibleStocks) {
            const trInfo = this.getTrInfo(stock);
            if (trInfo) {
                const key = `${trInfo.tr_id}|${trInfo.tr_key}`;
                newTickerKeys.add(key);
                subscribeList.push({ ...trInfo, key });
            }
        }

        // 1. 현재 구독 중인데 새로운 뷰포트 리스트에 없는 것 해제
        for (const oldKey of this.subscribedTickers) {
            if (!newTickerKeys.has(oldKey)) {
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

        // 2. 새로운 뷰포트 리스트 중 아직 구독 안 한 것 등록
        for (const item of subscribeList) {
            if (!this.subscribedTickers.has(item.key)) {
                this.sendJson({
                    header: {
                        approval_key: this.approvalKey,
                        custtype: "P",
                        tr_type: "1", // 등록
                        "content-type": "utf-8"
                    },
                    body: {
                        input: { tr_id: item.tr_id, tr_key: item.tr_key }
                    }
                });
                this.subscribedTickers.add(item.key);
            }
        }
    }

    resubscribeAll() {
        for (const key of this.subscribedTickers) {
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
                    console.log(`[KIS WS Msg] ${json.body.msg1}`);
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
        this.flushTimer = setInterval(() => {
            if (Object.keys(this.updateBatch).length > 0) {
                const batch = this.updateBatch;
                this.updateBatch = {};
                useStore.getState().batchUpdateRealtimePrices(batch);
            }
        }, 500);
    }

    stopFlushTimer() {
        if (this.flushTimer) clearInterval(this.flushTimer);
    }
}

export const kisWebSocket = new KISWebSocketManager();
