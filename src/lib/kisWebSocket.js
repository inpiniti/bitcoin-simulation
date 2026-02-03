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
        this.healthCheckTimer = null; // 연결 상태 모니터링 타이머
        this.lastDataTime = null; // 마지막 데이터 수신 시간
        this.messageQueue = [];
        this.updateBatch = {};
        this.flushTimer = null;
        this.flushCount = 0; // 메모리 디버깅용 카운터 (클래스 멤버로 이동)
    }

    connect(approvalKey) {
        if (!approvalKey) return;

        // 기존 연결이 있으면 무조건 먼저 끊기 (중복 연결 방지)
        if (this.socket) {
            console.log('[KIS WS] 기존 연결 감지, 재연결을 위해 종료합니다.');
            this.socket.close(1000, 'Reconnecting');
            this.socket = null;
            this.stopPing();
            this.stopFlushTimer();
        }

        this.approvalKey = approvalKey;
        this.isConnecting = true;

        try {
            // console.log("[KIS WS] Connecting to", WS_URL);
            this.socket = new WebSocket(WS_URL);

            this.socket.onopen = () => {
                console.log("[KIS WS] Connected to:", WS_URL);
                this.isConnecting = false;
                this.lastDataTime = Date.now(); // 연결 시 초기화

                while (this.messageQueue.length > 0) {
                    this.sendJson(this.messageQueue.shift());
                }

                this.resubscribeAll();
                this.startPing();
                this.startFlushTimer();
                this.startHealthCheck(); // 연결 상태 모니터링 시작
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
                this.stopHealthCheck();
                if (event.code !== 1000) {
                    this.scheduleReconnect();
                }
                useStore.getState().setWsStatus({ connected: false, subscriptionCount: 0 });
            };

            this.socket.onerror = (error) => {
                console.error("[KIS WS] Error:", error);
                this.isConnecting = false;
                this.stopHealthCheck();
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

    /**
     * 새 approvalKey로 WebSocket 재연결 (재로그인 시 호출)
     * @param {string} newApprovalKey - 새로 발급받은 WebSocket 인증 키
     */
    reconnectWithNewKey(newApprovalKey) {
        // console.log('[KIS WS] 새 approvalKey로 재연결 시작...');

        // 1. 기존 연결 종료 (정상 종료 코드 1000으로 종료하여 재연결 스케줄 방지)
        if (this.socket) {
            this.socket.close(1000, 'Reconnecting with new key');
            this.socket = null;
        }

        // 2. 모든 타이머 정리
        this.stopPing();
        this.stopFlushTimer();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // 3. 새 키로 연결 시작
        this.approvalKey = newApprovalKey;
        this.isConnecting = false; // connect 함수에서 체크하므로 초기화
        this.connect(newApprovalKey);
    }

    startPing() {
        this.stopPing();
        // 주기적으로 더미 데이터를 보내 연결 유지 (Railway idle timeout 방지)
        this.pingTimer = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                // WebSocket ping frame은 브라우저에서 지원하지 않으므로 빈 객체 전송
                // 실제로는 아무 부작용 없음 (KIS는 이를 무시)
            }
        }, 20000); // 20초마다
    }

    stopPing() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    /**
     * 연결 상태 모니터링을 시작합니다.
     * 일정 시간 동안 데이터가 수신되지 않으면 연결을 재시도합니다.
     */
    startHealthCheck() {
        this.stopHealthCheck();

        // 60초마다 연결 상태 확인
        this.healthCheckTimer = setInterval(() => {
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                console.log('[KIS WS] Health Check: Socket not open, attempting reconnect...');
                this.scheduleReconnect();
                return;
            }

            // 구독 중인 종목이 있는데 90초간 데이터가 없으면 연결 문제로 간주
            if (this.subscribedTickers.size > 0 && this.lastDataTime) {
                const timeSinceLastData = Date.now() - this.lastDataTime;

                // 90초(1.5분) 이상 데이터 없으면 재연결 (시장 개장 시간 고려)
                if (timeSinceLastData > 90000) {
                    console.log(`[KIS WS] Health Check: No data for ${Math.round(timeSinceLastData / 1000)}s, reconnecting...`);

                    // 기존 연결 강제 종료 후 재연결
                    if (this.socket) {
                        this.socket.close(4000, 'Health check failed');
                    }
                    this.scheduleReconnect();
                }
            }
        }, 60000); // 60초마다 확인
    }

    /**
     * 연결 상태 모니터링을 중지합니다.
     */
    stopHealthCheck() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
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

            // 티커의 점(.)을 슬래시(/)로 변환, 하이픈(-)은 제거 (BRK.B → BRK/B)
            const cleanTicker = ticker.replace(/\./g, '/').replace(/-/g, '');
            const tr_key = `D${marketCode}${cleanTicker}`;
            console.log(`[KIS WS] getTrInfo: ${ticker} (${exchange}) → ${tr_key}`);
            return { tr_id: 'HDFSCNT0', tr_key };
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
        // 데이터 수신 시간 업데이트 (연결 상태 모니터링용)
        this.lastDataTime = Date.now();

        const firstChar = message.charAt(0);
        if (firstChar !== '0' && firstChar !== '1') {
            try {
                const json = JSON.parse(message);
                if (json.body && json.body.msg1) {
                    const msg = json.body.msg1;
                    // BRK.B 관련 에러 확인
                    const key = json.header?.tr_key || '';
                    if (key.includes('BRKB') || key.includes('BRK_B') || key.includes('BRK/B')) {
                        console.log('[KIS WS] BRK.B 관련 응답:', json);
                    }
                    // console.log(`[KIS WS Msg] ${msg}`);
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
        let ticker = fields[1];

        // 티커 정규화: KIS에서 BRK/B 등으로 올 경우 BRK.B로 변환하여 앱 내부 표준 유지
        if (ticker.includes('/') || ticker.includes('_')) {
            ticker = ticker.replace(/[\/_]/g, '.');
        }

        // BRK.B 디버깅
        if (ticker === 'BRKB' || ticker === 'BRK_B' || ticker === 'BRK.B') {
            console.log(`[KIS WS] ${ticker} 데이터 수신!`, fields.slice(0, 20));
        }

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

                // 120회마다 메모리 상태 로깅 (약 1분마다) - 콘솔 로그 축적 방지
                this.flushCount++;
                // 메모리 디버깅 로그 완전 비활성화
                // if (this.flushCount % 120 === 0) {
                //     const stats = useStore.getState().debugMemoryStats();
                //     console.log('[WS Flush]', this.flushCount, '회 실행, 메모리:', stats);
                // }
            }
        }, 500);
    }

    stopFlushTimer() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        // 배치 데이터도 정리
        this.updateBatch = {};
    }
}

export const kisWebSocket = new KISWebSocketManager();
