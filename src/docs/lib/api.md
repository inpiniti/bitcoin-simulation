# API Service

**Path:** `src/lib/api.js`

한국투자증권(KIS), Yahoo Finance, Upbit 등 다양한 외부 데이터 소스로부터 데이터를 가져오고 정규화하는 역할을 담당합니다.

---

## 핵심 기능

- **프록시 지원**: CORS 문제를 방지하기 위해 모든 외부 요청은 `/api/...` 경로를 통한 프록시로 처리됩니다.
- **데이터 정규화**: 서로 다른 소스의 데이터를 동일한 캔들(Candle) 객체 구조로 변환합니다.
- **AI 통합**: Hugging Face 및 커스텀 백엔드를 통한 감성 분석 및 가격 예측 기능을 제공합니다.

---

## 주요 함수 (Methods)

### fetchCoinDailyData
업비트(Upbit) API를 통해 비트코인(BTC) 1년치 일봉 데이터를 가져옵니다.

#### 구문 (Syntax)
```javascript
const btcData = await fetchCoinDailyData();
```

#### 반환값 (Return value)
`Promise<Array<Object>>` - 정규화된 캔들 데이터 배열.

---

### fetchStockData
Yahoo Finance API를 통해 주식 데이터를 조회합니다.

#### 구문 (Syntax)
```javascript
fetchStockData(ticker, interval = '1d', range = '365d', includePrePost = false)
```

#### 매개변수 (Parameters)
- `ticker` (string): 종목 티커 (예: "AAPL", "005930").
- `interval` (string): 데이터 간격 ("1m", "1d" 등).
- `range` (string): 데이터 범위 ("1d", "7d", "365d" 등).
- `includePrePost` (boolean): 장전/장후 데이터 포함 여부.

#### 반환값 (Return value)
`Promise<Array<Object>>` - 정규화된 캔들 데이터 배열.

---

### fetchKospi200Tickers
운영 환경의 `/api/kospi200` 엔드포인트를 통해 위키백과에서 KOSPI 200 종목 리스트를 가져옵니다.

#### 구문 (Syntax)
```javascript
const kospi200 = await fetchKospi200Tickers();
```

#### 반환값 (Return value)
`Promise<Array<Object>>` - `{ ticker, name, count, exchange }` 구조의 배열.

---

### fetchForecast
AI 모델(TimesFM-2.5)을 사용하여 향후 가격 예측 데이터를 가져옵니다.

#### 구문 (Syntax)
```javascript
fetchForecast(symbol, interval = 'day')
```

#### 매개변수 (Parameters)
- `symbol` (string): 종목 티커.
- `interval` (string): 예측 단위 ("day" 또는 "minute").

#### 반환값 (Return value)
`Promise<Object|null>` - 예측 가격 배열 및 타임스탬프를 포함한 객체.

---

### getSentimentScore
FinBERT 모델을 사용하여 뉴스 헤드라인의 감성 점수를 분석합니다.

#### 구문 (Syntax)
```javascript
const score = await getSentimentScore(textList)
```

#### 매개변수 (Parameters)
- `textList` (Array<string>): 뉴스 제목들의 배열.

#### 반환값 (Return value)
`Promise<number>` - -1(부정)에서 1(긍정) 사이의 점수.
