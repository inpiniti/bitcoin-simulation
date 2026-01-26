# Real-time WebSocket Service

**Path:** `src/lib/kisWebSocket.js`

한국투자증권(KIS) Open API의 웹소켓을 관리하여 실시간 현재가 데이터를 수신합니다.

---

## 뷰포트 기반 동적 구독 (Viewport-based Subscription)

이 시스템은 KIS 웹소켓의 단일 세션 제한 및 종목 수 제한(최대 40개)을 효과적으로 관리하기 위해 **Viewport-based Subscription** 전략을 사용합니다.

### 핵심 동작 원리
1. **단일 연결 유지**: 동일한 AppKey로 중복 접속이 불가능하므로 하나의 안정적인 소켓 연결만 유지합니다.
2. **동적 가시성 감지**: `TickerSelectionPanel`에서 `IntersectionObserver`를 사용하여 현재 사용자 화면에 보이는 종목들을 감지합니다.
3. **실시간 위임**: 화면에 나타나는 종목은 즉시 `Subscribe`(등록)하고, 사라지는 종목은 `Unsubscribe`(해제)하여 40개 슬롯을 동적으로 재활용합니다.
4. **배치 업데이트**: 수신된 대량의 데이터는 500ms 주기로 묶어서 Zustand 스토어에 한 번에 반영하여 렌더링 성능을 확보합니다.

---

## KISWebSocketManager

### connect
웹소켓 서버에 접속하고 인증을 수행합니다.

#### 구문 (Syntax)
```javascript
kisWebSocket.connect(approvalKey)
```

### subscribeStocks
인자로 전달된 종목 리스트를 기반으로 구독 상태를 갱신합니다. 기존 구독 리스트와 비교하여 필요한 것만 새로 등록하거나 해제합니다.

#### 구문 (Syntax)
```javascript
kisWebSocket.subscribeStocks(visibleStocks)
```

#### 매개변수 (Parameters)
- `visibleStocks` (Array): `{ ticker, exchange }` 객체의 배열.

---

## Example (사용 예시)

```javascript
// 컴포넌트 내에서 뷰포트 가시성 감지 시 호출
const handleVisible = (stock, isVisible) => {
    if (isVisible) {
        visibleStocksRef.current.set(stock.ticker, stock);
    } else {
        visibleStocksRef.current.delete(stock.ticker);
    }
    
    // 디바운싱 후 업데이트
    kisWebSocket.subscribeStocks(Array.from(visibleStocksRef.current.values()));
};
```

---

## 운영 환경 인프라 (Railway Proxy)

운영 환경(HTTPS)에서는 브라우저 보안 정책으로 인해 KIS의 비보안 웹소켓(`ws://`)에 직접 연결할 수 없습니다. 이를 해결하기 위해 Railway에 배포된 WebSocket 프록시 서버를 경유합니다.

### 아키텍처 (Architecture)
`브라우저 (wss://)` ──▶ `Railway Proxy (wss → ws 변환)` ──▶ `KIS WebSocket (ws://)`

### 관련 환경 변수
- `VITE_WS_PROXY_URL`: 운영 환경에서 사용할 프록시 서버 주소 (예: `wss://your-app.up.railway.app`)
- 설정되지 않은 경우 기본 프록시 주소로 시도합니다.
