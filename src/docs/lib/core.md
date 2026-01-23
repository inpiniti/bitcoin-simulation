# Core Libraries

핵심 비즈니스 로직과 API 통신, 데이터 처리를 담당하는 라이브러리 모음입니다.

---

## API Service
**Path:** `src/lib/api.js`

### fetchCoinDailyData
업비트(Upbit) API를 통해 KRW-BTC(비트코인)의 일봉 데이터를 가져옵니다. 최근 365일치 데이터를 조회하며, 과거순(과거->현재)으로 정렬하여 반환합니다.

#### 구문 (Syntax)
```javascript
fetchCoinDailyData()
```

#### 반환값 (Return value)
`Promise<Array>` - 정규화된 캔들 객체의 배열을 반환합니다.
- `timestamp` (number): 캔들 생성 시각 (ms)
- `open` (number): 시가
- `high` (number): 고가
- `low` (number): 저가
- `close` (number): 종가
- `volume` (number): 거래량

#### 예제 (Example)
```javascript
const candles = await fetchCoinDailyData();
console.log(candles[0]); 
// { timestamp: 1672531200000, open: 21000000, high: 21500000, ... }
```

### convertToYahooSymbol
티커를 Yahoo Finance API와 호환되는 심볼 형식으로 변환합니다. 한국 종목(6자리 숫자)은 `.KS` 접미사를 붙이고, 미국 종목의 점(`.`)은 하이픈(`-`)으로 변경합니다.

#### 구문 (Syntax)
```javascript
convertToYahooSymbol(ticker)
```

#### 예제 (Example)
```javascript
convertToYahooSymbol('005930') // "005930.KS" (삼성전자)
convertToYahooSymbol('BRK.B')  // "BRK-B" (버크셔 해서웨이)
convertToYahooSymbol('AAPL')   // "AAPL" (변경 없음)
```

### fetchStockData
야후 파이낸스(Yahoo Finance)에서 주식 데이터를 가져옵니다. CORS 문제 해결을 위해 로컬 프록시(`/api/yahoo`)를 거쳐 요청합니다.

#### 구문 (Syntax)
```javascript
fetchStockData(ticker, interval, range, includePrePost)
```

#### 매개변수 (Parameters)
- `ticker` (string): 종목 코드 (예: `'AAPL'`, `'TSLA'`).
- `interval` (string): 데이터 간격. (`'1d'`, `'1m'`, `'5m'`, `'1wk'` 등)
- `range` (string): 데이터 조회 기간. (`'1d'`, `'1y'`, `'max'` 등)
- `includePrePost` (boolean): 장전/장후 거래 데이터 포함 여부 (기본값: `false`)

#### 예제 (Example)
```javascript
// 애플의 1년치 일봉 데이터 가져오기
const data = await fetchStockData('AAPL', '1d', '1y');
```

### fetchStockHistory
일봉 기준 과거 주가 데이터를 조회합니다. `fetchStockData`의 래퍼 함수로, 주로 장기 데이터를 가져오는 데 사용됩니다.

#### 구문 (Syntax)
```javascript
fetchStockHistory(ticker, days)
```

#### 매개변수 (Parameters)
- `ticker` (string): 종목 코드.
- `days` (number): 조회할 과거 일수 (예: `365`).

#### 예제 (Example)
```javascript
const history = await fetchStockHistory('TSLA', 30);
// 최근 30일간의 테슬라 주가 데이터 반환
```

### fetchStockMinuteData
최근 7일 치의 1분봉 데이터를 조회합니다. 실시간 시뮬레이션 및 단기 흐름 분석에 사용됩니다.

#### 구문 (Syntax)
```javascript
fetchStockMinuteData(ticker)
```

#### 예제 (Example)
```javascript
const minuteData = await fetchStockMinuteData('NVDA');
// 최근 7일간의 엔비디아 1분봉 데이터 (최대 수천 개)
```

### fetchStockOverview
기업의 개요(섹터, 산업, 시가총액 등) 및 주요 재무 정보를 조회합니다. 다양한 소스(API, 스크래핑)를 시도하여 데이터를 확보합니다.

#### 구문 (Syntax)
```javascript
fetchStockOverview(ticker)
```

#### 반환값 (Return value)
`Promise<Object>` - 기업 정보 객체.
- `summary`: 사업 개요 텍스트
- `price`: 현재 주가 정보
- `financials`: 시가총액, PER, EPS 등 주요 지표

#### 예제 (Example)
```javascript
const info = await fetchStockOverview('MSFT');
console.log(info.financials.MarketCap); // "3.1T"
```

### fetchStockNews
야후 파이낸스에서 해당 종목과 관련된 뉴스 헤드라인을 수집합니다.

#### 구문 (Syntax)
```javascript
fetchStockNews(ticker)
```

#### 예제 (Example)
```javascript
const news = await fetchStockNews('AAPL');
// [{ title: "Apple launches new iPhone", link: "...", ... }, ...]
```

### fetchEarningsData
나스닥(Nasdaq) API를 통해 기업의 실적(Earnings) 발표 기록을 조회합니다.

#### 구문 (Syntax)
```javascript
fetchEarningsData(ticker)
```

#### 예제 (Example)
```javascript
const earnings = await fetchEarningsData('TSLA');
console.log(earnings.lastEps); // 지난 분기 EPS
```

### fetchKospi200Tickers
KOSPI 200 지수에 포함된 주요 한국 주식 종목 리스트를 반환합니다.

#### 구문 (Syntax)
```javascript
fetchKospi200Tickers()
```

### fetchKosdaq150Tickers
KOSDAQ 150 지수 종목 리스트를 반환합니다.

#### 구문 (Syntax)
```javascript
fetchKosdaq150Tickers()
```

### fetchRecommendedTickers
Dataroma 등의 소스를 크롤링하여 슈퍼 인베스터들이 보유한 추천 종목 리스트를 조회합니다.

#### 구문 (Syntax)
```javascript
fetchRecommendedTickers()
```

### fetchForecast
가격 예측을 위해 커스텀 AI 추론 API (TimesFM 모델 등)를 호출합니다.

#### 구문 (Syntax)
```javascript
fetchForecast(symbol, interval)
```

#### 예제 (Example)
```javascript
const forecast = await fetchForecast('BTC-USD', 'day');
// { dates: [...], prices: [...], ... }
```

### fetchWhaleAnalysis
대량 보유자(Whale)의 수급 흐름을 분석하는 API를 호출합니다.

#### 구문 (Syntax)
```javascript
fetchWhaleAnalysis(symbol, interval)
```

### getSentimentScore
FinBERT(Hugging Face)를 사용하여 뉴스 헤드라인의 감성 점수를 계산합니다.

#### 구문 (Syntax)
```javascript
getSentimentScore(news)
```

---

## Data Processor
**Path:** `src/lib/dataProcessor.js`

### aggregateToInterval
1분 단위의 캔들 데이터를 더 큰 시간 간격(예: 5분, 60분)으로 병합(Resampling)합니다.

#### 구문 (Syntax)
```javascript
aggregateToInterval(data, minutes)
```

#### 예제 (Example)
```javascript
// 1분봉 데이터를 5분봉으로 변환
const data5m = aggregateToInterval(data1m, 5);
```

### calculateRSI
RSI (상대 강도 지수)를 계산합니다.

#### 구문 (Syntax)
```javascript
calculateRSI(data, period)
```

#### 매개변수 (Parameters)
- `data`: 종가(`close`) 프로퍼티를 가진 객체 배열
- `period` (number): 계산 기간 (기본값: 14)

#### 예제 (Example)
```javascript
const rsiValues = calculateRSI(candles, 14);
// 각 캔들 객체에 'rsi' 속성이 추가되지 않고, 별도의 계산 로직임 (보통 addDerivedData 내부에서 사용)
```

### calculateMA
단순 이동평균(SMA)을 계산합니다.

#### 구문 (Syntax)
```javascript
calculateMA(data, period, key)
```

#### 예제 (Example)
```javascript
// 종가 기준 20일 이동평균 계산
const ma20 = calculateMA(candles, 20, 'close');
console.log(ma20[ma20.length-1].ma);
```

### addDerivedData
캔들 데이터에 기술적 분석 지표(RSI, MA, 볼린저 밴드 등)를 계산하여 추가합니다.

#### 구문 (Syntax)
```javascript
addDerivedData(data)
```

#### 반환값 (Return value)
`Array` - 원본 데이터에 `rsi`, `ma20`, `ma50`, `bbUpper`, `bbLower`, `slope` 등이 추가된 새 배열.

### generateIntegratedTrades
과거 데이터와 전략 옵션을 바탕으로 매매 시뮬레이션을 수행합니다.

#### 구문 (Syntax)
```javascript
generateIntegratedTrades(data, options)
```

#### 예제 (Example)
```javascript
const result = generateIntegratedTrades(data, {
  useRSI: true,
  useBollinger: true,
  moneyManagement: 'cumulative'
});
console.log(`총 수익률: ${result.summary.returnRate}%`);
```

### analyzeSignal
현재 시점의 데이터와 옵션을 바탕으로 실시간 진입/청산 여부를 결정합니다.

#### 구문 (Syntax)
```javascript
analyzeSignal(dataWithSlope, options)
```

#### 반환값 (Return value)
`Object` - `{ signal: 'BUY' | 'SELL' | 'HOLD', reason: '...' }`

### calculateFixedQuantityResult
고정 수량(단리) 방식의 시뮬레이션 성과를 계산합니다. 매 거래마다 동일한 금액(또는 수량)을 투자합니다.

#### 구문 (Syntax)
```javascript
calculateFixedQuantityResult(trades, quantity, costs)
```

#### 매개변수 (Parameters)
- `trades`: `generateIntegratedTrades`에서 생성된 매매 로그.
- `quantity`: 1회당 매수 금액(또는 코인 수).
- `costs`: 거래 수수료율 객체.

### calculateCumulativeResult
복리(누적 자산 재투자) 방식의 시뮬레이션 성과를 계산합니다. 이익이 나면 투자금을 늘리고, 손실이 나면 줄입니다.

#### 구문 (Syntax)
```javascript
calculateCumulativeResult(trades, initialCapital, costs)
```

### calculateMartingaleResult
손실 시 배팅액을 늘리는 마틴게일 전략의 성과를 계산합니다. 손실을 보면 다음 진입 시 투자금을 `multiplier`배만큼 증액합니다.

#### 구문 (Syntax)
```javascript
calculateMartingaleResult(trades, baseQuantity, multiplier, costs)
```

### calculateVMartingaleResult
변동성(Volatility)에 따라 배팅 비중을 조절하는 V-마틴게일 전략의 성과를 계산합니다. 변동성이 낮을 때 비중을 높이고, 높을 때 낮춥니다(또는 전략에 따라 반대).

#### 구문 (Syntax)
```javascript
calculateVMartingaleResult(trades, baseQuantity, costs)
```

---

## Utilities
**Path:** `src/lib/utils.js`

### cn
Tailwind CSS 클래스 이름을 조건부로 결합하고, 충돌되는 클래스를 최적화합니다.

#### 구문 (Syntax)
```javascript
cn(...inputs)
```

#### 예제 (Example)
```javascript
cn('p-2', isSelected && 'bg-blue-500');
```
