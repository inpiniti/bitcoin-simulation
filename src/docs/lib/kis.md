# Korea Investment Securities (KIS) API

**Path:** `src/lib/kisApi.js`

한국투자증권 Open API와 통신하기 위한 전용 라이브러리입니다.

---

## Authentication (인증)

### getAccessToken
API Key와 Secret을 사용하여 접속 토큰(Access Token)을 발급받습니다. 발급받은 토큰은 메모리나 로컬 스토리지에 저장하여 사용합니다.

#### 구문 (Syntax)
```javascript
getAccessToken(appKey, appSecret)
```

#### 예제 (Example)
```javascript
try {
  const token = await getAccessToken('MY_APP_KEY', 'MY_SECRET');
  console.log('Token:', token);
} catch (e) {
  console.error('인증 실패:', e);
}
```

### revokeAccessToken
사용이 끝난 토큰을 폐기(Revoke)합니다. 보안을 위해 로그아웃 시 또는 앱 종료 시 호출하는 것이 권장됩니다.

#### 구문 (Syntax)
```javascript
revokeAccessToken(token, appKey, appSecret)
```

---

## Trading (매매)

### orderStock
주식 현금 매수 또는 매도 주문을 전송합니다.

#### 구문 (Syntax)
```javascript
orderStock(props)
```

#### 매개변수 (Parameters)
`props` 객체:
- `stockCode` (string): 종목 코드 (예: `'005930'`, `'AAPL'`)
- `orderType` (string): `'buy'` (매수) 또는 `'sell'` (매도)
- `price` (number): 주문 가격. (시장가의 경우 `0`)
- `quantity` (number): 주문 수량.
- `orderDivision` (string): 주문 구분 코드 (`'00'`: 지정가, `'01'`: 시장가)

#### 반환값 (Return value)
`Promise<Object>`:
- `RT_CD`: 결과 코드 (`0`이면 성공)
- `ODNO`: 주문 번호 (Order Number)

#### 예제 (Example)
```javascript
const res = await orderStock({
  stockCode: 'AAPL',
  orderType: 'buy',
  price: 150,
  quantity: 1,
  orderDivision: '00'
});
console.log(`주문 성공! 번호: ${res.ODNO}`);
```

### getDailyOrderHistory
일별 주문 체결 내역을 조회합니다. 특정 기간 동안의 체결/미체결 건을 확인할 수 있습니다.

#### 구문 (Syntax)
```javascript
getDailyOrderHistory(token, accountNo, startDate, endDate)
```

---

## Account (계좌)

### getOverseasBalance
해외 주식 잔고 및 평가 손익을 조회합니다. 현재 보유 중인 종목 리스트와 총 자산 가치를 반환합니다.

#### 구문 (Syntax)
```javascript
getOverseasBalance(token, accountNo_front, accountNo_back)
```

#### 예제 (Example)
```javascript
const balance = await getOverseasBalance(token, '12345678', '01');
balance.holdings.forEach(stock => {
  console.log(`${stock.name}: ${stock.profit_rate}% 수익 중`);
});
```
