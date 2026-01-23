# External Integrations

외부 서드파티 서비스와의 연동 모듈입니다.

---

## Supabase Client
**Path:** `src/lib/supabaseClient.js`

### supabase
초기화된 Supabase 클라이언트 인스턴스입니다. 데이터베이스(PostgreSQL) CRUD 작업에 사용됩니다.

#### 예제 (Example)
```javascript
import { supabase } from '@/lib/supabaseClient';

// 'trade_logs' 테이블에 로그 저장
const { error } = await supabase
  .from('trade_logs')
  .insert([{ symbol: 'BTC', action: 'BUY', price: 60000 }]);
```

---

## Discussion API
**Path:** `src/lib/discussionApi.js`

### fetchDiscussions
네이버 증권, 스탁트윗(Stocktwits), 레딧(Reddit)에서 해당 티커의 게시글을 통합 수집합니다. 각 소스의 API를 병렬로 호출하여 데이터를 취합합니다.

#### 구문 (Syntax)
```javascript
fetchDiscussions(ticker)
```

#### 매개변수 (Parameters)
- `ticker` (string): 종목 코드 (예: `'AAPL'`, `'005930'`).

#### 반환값 (Return value)
`Promise<Array>` - 게시글 객체 배열.
- `id`: 고유 ID
- `source`: 출처 (`'naver'`, `'reddit'` 등)
- `text`: 본문 내용
- `sentiment`: (옵션) `'bullish'`, `'bearish'` 등

#### 예제 (Example)
```javascript
const posts = await fetchDiscussions('TSLA');
console.log(`총 ${posts.length}개의 토론글을 찾았습니다.`);
```

---

## Earnings Analysis
**Path:** `src/lib/earningsAnalysis.js`

### analyzeEarningsImpact
과거 실적 발표일 전후의 주가 변동성을 분석합니다. 실적 발표가 주가에 미치는 평균적인 영향(Impact)을 계산합니다.

#### 구문 (Syntax)
```javascript
analyzeEarningsImpact(ticker, historyData)
```

#### 반환값 (Return value)
`Object`
- `avgMove`: 실적 발표 다음날 평균 등락률 (%)
- `winRate`: 실적 발표 후 상승한 확률 (0~1)

#### 예제 (Example)
```javascript
const analysis = analyzeEarningsImpact('NVDA', dailyCandles);
console.log(`엔비디아는 실적 발표 후 평균 ${analysis.avgMove}% 움직입니다.`);
```
