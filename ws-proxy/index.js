/**
 * KIS WebSocket Proxy Server
 * 
 * 브라우저(wss) ↔ 이 서버(wss) ↔ KIS WebSocket(ws) 프록시
 * 
 * HTTPS 환경에서 ws:// 연결이 불가능한 문제를 해결합니다.
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3001;
const KIS_WS_URL = 'ws://ops.koreainvestment.com:21000';

// HTTP 서버 생성 (Health Check용)
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('KIS WebSocket Proxy Server\n\nConnect via WebSocket to use the proxy.');
    }
});

// WebSocket 서버 생성
const wss = new WebSocket.Server({ server });

console.log(`[Proxy] Starting KIS WebSocket Proxy on port ${PORT}`);

wss.on('connection', (clientSocket, req) => {
    console.log(`[Proxy] Client connected from ${req.socket.remoteAddress}`);

    let kisSocket = null;
    let isKisConnected = false;
    const messageQueue = [];

    /**
     * KIS WebSocket 서버에 연결합니다.
     * 클라이언트의 첫 메시지 수신 시 호출되며, 
     * 연결 성공 후 대기 중인 메시지를 순차적으로 전송합니다.
     * 
     * @private
     */
    let pingInterval = null;
    let pongTimeout = null;
    let isAlive = false;

    function connectToKIS() {
        console.log(`[Proxy] Connecting to KIS: ${KIS_WS_URL}`);

        kisSocket = new WebSocket(KIS_WS_URL);

        kisSocket.on('open', () => {
            console.log('[Proxy] Connected to KIS WebSocket');
            isKisConnected = true;
            isAlive = true;

            // 대기 중인 메시지 전송
            while (messageQueue.length > 0) {
                const msg = messageQueue.shift();
                kisSocket.send(msg);
                console.log('[Proxy] Sent queued message to KIS');
            }

            // KIS 연결이 열리면 클라이언트에게 ping 시작
            // KIS 자체는 ping을 보내지 않으므로, 프록시가 클라이언트와 KIS 모두에게 ping 수행
            startPingInterval();
        });

        kisSocket.on('message', (data) => {
            // KIS → Client
            if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(data.toString());
            }
        });

        // KIS 서버로부터 pong 대신 일반 데이터 수신으로 활성화 감지
        kisSocket.on('pong', () => {
            isAlive = true;
        });

        kisSocket.on('close', (code, reason) => {
            console.log(`[Proxy] KIS connection closed: ${code} ${reason}`);
            isKisConnected = false;
            stopPingInterval();

            // 클라이언트도 연결되어 있으면 닫기
            if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.close(1000, 'KIS connection closed');
            }
        });

        kisSocket.on('error', (error) => {
            console.error('[Proxy] KIS WebSocket error:', error.message);
            isKisConnected = false;
        });
    }

    /**
     * 주기적으로 ping을 보내 연결 상태를 확인합니다.
     * KIS WebSocket은 pong을 반환하지 않을 수 있으므로,
     * 클라이언트 연결도 함께 확인합니다.
     */
    function startPingInterval() {
        stopPingInterval(); // 기존 interval 정리

        pingInterval = setInterval(() => {
            // 클라이언트에게 ping 전송 (WebSocket 프로토콜 레벨)
            if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.ping();
            }

            // KIS 연결 상태 확인 (데이터 수신 여부로 판단)
            if (kisSocket && kisSocket.readyState === WebSocket.OPEN) {
                // KIS는 pong을 보내지 않을 수 있으므로, 연결 상태만 확인
                if (!isAlive && isKisConnected) {
                    console.log('[Proxy] KIS connection seems dead, reconnecting...');
                    kisSocket.terminate();
                    return;
                }
                isAlive = false; // 다음 데이터 수신 시 true로 설정됨
            }
        }, 25000); // 25초마다 ping (Railway idle timeout은 보통 60초)

        console.log('[Proxy] Ping interval started (25s)');
    }

    function stopPingInterval() {
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        if (pongTimeout) {
            clearTimeout(pongTimeout);
            pongTimeout = null;
        }
    }

    // 클라이언트로부터 pong 수신
    clientSocket.on('pong', () => {
        // 클라이언트 연결 활성화 확인
    });

    // KIS 데이터 수신 시 활성화 플래그 설정
    clientSocket.on('message', () => {
        isAlive = true;
    });

    // 클라이언트로부터 메시지 수신
    clientSocket.on('message', (data) => {
        const message = data.toString();

        // 첫 메시지 수신 시 KIS 연결 시작
        if (!kisSocket) {
            connectToKIS();
        }

        // Client → KIS
        if (isKisConnected && kisSocket.readyState === WebSocket.OPEN) {
            kisSocket.send(message);
            console.log('[Proxy] Forwarded message to KIS');
        } else {
            // KIS 연결 대기 중이면 큐에 저장
            messageQueue.push(message);
            console.log('[Proxy] Message queued (KIS not ready)');
        }
    });

    clientSocket.on('close', (code, reason) => {
        console.log(`[Proxy] Client disconnected: ${code}`);

        // KIS 연결도 닫기
        if (kisSocket && kisSocket.readyState === WebSocket.OPEN) {
            kisSocket.close(1000, 'Client disconnected');
        }
    });

    clientSocket.on('error', (error) => {
        console.error('[Proxy] Client WebSocket error:', error.message);
    });
});

// 서버 시작
server.listen(PORT, () => {
    console.log(`[Proxy] Server is running on port ${PORT}`);
    console.log(`[Proxy] Health check: http://localhost:${PORT}/health`);
    console.log(`[Proxy] WebSocket endpoint: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Proxy] SIGTERM received, shutting down...');
    wss.clients.forEach((client) => {
        client.close(1000, 'Server shutting down');
    });
    server.close(() => {
        console.log('[Proxy] Server closed');
        process.exit(0);
    });
});
