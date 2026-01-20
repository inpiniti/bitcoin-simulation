---
name: Trading Logic Guide
description: 매매 전략 및 보조지표 계산 로직 가이드
---

# 📊 매매 전략 및 지표 가이드

이 스킬은 `src/lib/dataProcessor.js`에 구현된 매매 전략과 보조지표의 계산 로직을 문서화합니다.

## 📌 핵심 파일 위치

| 파일 | 설명 |
|------|------|
| `src/lib/dataProcessor.js` | 지표 계산 및 시뮬레이션 로직 |
| `src/lib/autoTradeLogic.js` | 자동 매매 실행 로직 |
| `src/components/layout/Sidebar.jsx` | 전략 설정 UI |

## 📈 보조지표 계산 공식

### 1. 중간값 (Median Price)
```javascript
median = (open + close) / 2
```

### 2. 기울기 (Slope)
```javascript
slope = 현재_median - 이전_median
```
*   **양수**: 상승 추세
*   **음수**: 하락 추세
*   **0 전환점**: 매매 신호 발생

### 3. 볼린저 밴드 (Bollinger Bands)
```javascript
// 기본 설정
period = 20
multiplier = 2

// 계산
middle = SMA(close, period)
stdDev = StandardDeviation(close, period)
upper = middle + (stdDev * multiplier)
lower = middle - (stdDev * multiplier)
```

**BB Status 코드**
| 값 | 의미 | 매매 신호 |
|----|------|----------|
| -2 | 하단 이탈 (close < lower) | 매수 기회 |
| -1 | 하단 존 (lower ≤ close < middle) | 관망 |
| 0 | 중앙선 (close ≈ middle) | 중립 |
| +1 | 상단 존 (middle < close ≤ upper) | 관망 |
| +2 | 상단 돌파 (close > upper) | 매도 기회 |

### 4. RSI (Relative Strength Index)
```javascript
period = 14

// 계산
gain = 상승폭 평균
loss = 하락폭 평균
RS = gain / loss
RSI = 100 - (100 / (1 + RS))
```

**RSI 해석**
| 범위 | 의미 |
|------|------|
| RSI > 70 | 과매수 (Overbought) |
| 30 ≤ RSI ≤ 70 | 중립 |
| RSI < 30 | 과매도 (Oversold) |

### 5. 이동평균선 (Moving Average)
```javascript
MA20 = SMA(close, 20)  // 단기
MA50 = SMA(close, 50)  // 중기
```

### 6. 거래량 이동평균 (VMA)
```javascript
VMA20 = SMA(volume, 20)
```

## 🎯 매매 전략

### 기본 매수 조건
1. **기울기 전환**: 음수(-)에서 양수(+)로 변환

### 필터 조건 (선택적)
| 필터 | 조건 | 설명 |
|------|------|------|
| BB 필터 | `bbStatus === -2` | 직전 캔들 하단 이탈 |
| 추세 필터 (MA50) | `close > MA50` | 중기 상승 추세 |
| 추세 필터 (MA20) | `close > MA20` | 단기 상승 추세 |
| RSI 필터 | `RSI < 70` | 과매수 아님 |
| 거래량 필터 | `volume > VMA20` | 평균 이상 거래량 |

### 기본 매도 조건
1. **기울기 전환**: 양수(+)에서 음수(-)로 변환

### 손절/익절 조건
| 조건 | 기준 | 동작 |
|------|------|------|
| 손절 (Stop Loss) | 매수가 대비 -2% | 강제 매도 |
| 익절 (Take Profit) | 매수가 대비 +5% | 강제 매도 |
| 추적 손절 (Trailing Stop) | 최고가 대비 -2% | 강제 매도 |

## 🔧 새 전략 추가 시 체크리스트

1. [ ] `dataProcessor.js`에 필터 조건 추가
2. [ ] `Sidebar.jsx` 전략 옵션 UI 추가
3. [ ] `useStore.js` strategyOptions에 상태 추가
4. [ ] `autoTradeLogic.js` 자동 매매 로직에 반영
5. [ ] `README.md` 문서 업데이트
6. [ ] 시뮬레이션 테스트 수행

## 📊 수수료 및 슬리피지

```javascript
buyFee = 0.05%   // 매수 수수료
sellFee = 0.05%  // 매도 수수료
slippage = 0.1%  // 슬리피지
```

## 💡 전략 개발 팁

1. **백테스팅 필수**: 시뮬레이션 모드에서 최소 1년 데이터로 검증
2. **과적합 주의**: 너무 많은 필터는 오히려 수익률 저하
3. **시장 구분**: 상승장/하락장에 따른 전략 효과 차이 고려
4. **비용 반영**: 수수료와 슬리피지를 항상 계산에 포함
