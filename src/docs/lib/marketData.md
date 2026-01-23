# Market Data Sources

지수(Index) 및 시장 시간 관련 데이터 소스입니다.

---

## S&P 500 Data
**Path:** `src/lib/sp500Data.js`

### getSP500Tickers
S&P 500 지수에 포함된 주요 종목 리스트를 반환합니다. 하드코딩된 리스트를 반환하며, 주기적으로 업데이트가 필요할 수 있습니다.

#### 구문 (Syntax)
```javascript
getSP500Tickers()
```

#### 반환값 (Return value)
`Array<string>` - `['AAPL', 'MSFT', 'AMZN', ...]`

---

## Market Time
**Path:** `src/lib/marketTime.js`

### isMarketOpen
해당 시장이 현재 개장 중인지 확인합니다. 장전/장후 시간은 포함하지 않고 정규장 시간만 체크합니다.

#### 구문 (Syntax)
```javascript
isMarketOpen(market)
```

#### 매개변수 (Parameters)
- `market` (string): `'US'` (미국: 23:30 ~ 06:00) 또는 `'KR'` (한국: 09:00 ~ 15:30).

#### 반환값 (Return value)
`boolean` - 개장 중이면 `true`.

#### 예제 (Example)
```javascript
if (isMarketOpen('US')) {
  console.log("미국장이 열렸습니다. 매매를 시작합니다.");
}
```

### getTimeToClose
장 마감까지 남은 시간을 `HH:MM:SS` 형식의 문자열로 반환합니다.

#### 구문 (Syntax)
```javascript
getTimeToClose()
```

#### 예제 (Example)
```javascript
// 남은 시간 표시
document.getElementById('timer').innerText = getTimeToClose();
```
