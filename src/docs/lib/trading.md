# Trading Logic

자동 매매를 수행하고 주문 상태를 관리하는 비즈니스 로직입니다.

---

## Auto Trade Logic
**Path:** `src/lib/autoTradeLogic.js`

### decideTrade
현재 시장 상황과 계좌 상태를 분석하여 매매 행동(Buy/Sell/Hold)을 결정합니다. 전략에 따라 매수 수량까지 계산합니다.

#### 구문 (Syntax)
```javascript
decideTrade({ currentPrice, balance, holdings, settings, analysis })
```

#### 매개변수 (Parameters)
- `currentPrice` (number): 현재 시장 가격.
- `balance` (number): 사용 가능한 현금 잔고.
- `holdings` (Array): 현재 보유 중인 주식/코인 목록.
- `settings` (Object): 사용자 정의 설정 (목표 수익률, 손절률 등).
- `analysis` (Object): `analyzeSignal`로부터 받은 기술적 분석 결과.

#### 반환값 (Return value)
`Object`
- `action`: `'BUY'`, `'SELL'`, `'HOLD'`
- `quantity`: 매매할 수량 (0이면 없음)
- `reason`: 결정 사유 (로그용 텍스트)

#### 예제 (Example)
```javascript
const decision = decideTrade({
  currentPrice: 150,
  balance: 10000,
  holdings: [],
  settings: { targetProfit: 0.1 },
  analysis: { signal: 'BUY' }
});

if (decision.action === 'BUY') {
    // 150불에 매수 주문 실행
}
```

### analyzeSignal
자금 상황을 고려하지 않고, 기술적 지표만을 바탕으로 매수/매도 시그널을 판단합니다.

#### 구문 (Syntax)
```javascript
analyzeSignal(indicators, strategy)
```

#### 매개변수 (Parameters)
- `indicators` (Object): RSI, MA, BB 등의 값이 포함된 객체.
- `strategy` (string): 사용할 전략 이름 (예: `'standard'`, `'aggressive'`).

#### 예제 (Example)
```javascript
const signal = analyzeSignal(
  { rsi: 25, bbLower: 100, close: 99 }, 
  'standard'
);
// RSI 30 미만이고 볼린저 하단 돌파 시 -> 'BUY' 리턴
```

---

## Order Tracker
**Path:** `src/lib/orderTracker.js`

### createOrder
새로운 주문을 추적 시스템에 등록합니다. 주문 ID를 생성하고 상태를 'pending'(접수 대기)으로 설정합니다.

#### 구문 (Syntax)
```javascript
createOrder(details)
```

#### 예제 (Example)
```javascript
const orderId = createOrder({
  symbol: 'BTC',
  type: 'buy',
  price: 50000,
  quantity: 0.1
});
```

### updateOrderStatus
주문의 상태(접수 -> 체결/거부)를 업데이트합니다. 체결 시 체결 가격과 수량을 기록합니다.

#### 구문 (Syntax)
```javascript
updateOrderStatus(id, status, executionDetails)
```

#### 예제 (Example)
```javascript
updateOrderStatus('ord-123', 'filled', { filledPrice: 50050 });
```

### getPendingOrders
아직 체결되지 않은 미체결 주문 목록을 반환합니다. 주기적으로 주문 상태를 확인할 때 사용합니다.

#### 구문 (Syntax)
```javascript
getPendingOrders()
```
