---
description: JSDoc 및 코드 문서화 워크플로우
---

# 문서화 워크플로우

코드에 JSDoc 주석과 문서화를 자동으로 추가하는 워크플로우입니다.

## 사용 시점

- 새 함수/컴포넌트 작성 후
- 기존 코드에 문서화가 필요할 때
- `/docs` 명령어로 명시적 호출 시

## 문서화 대상

### 1. React 컴포넌트
```jsx
/**
 * 주식 차트를 표시하는 컴포넌트
 * 
 * @component
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.ticker - 종목 코드 (예: "AAPL")
 * @param {Array<Object>} props.data - 차트 데이터 배열
 * @param {boolean} [props.showPrediction=false] - AI 예측 라인 표시 여부
 * @returns {JSX.Element} 차트 컴포넌트
 * 
 * @example
 * <StockChart ticker="AAPL" data={priceData} showPrediction />
 */
function StockChart({ ticker, data, showPrediction = false }) {
  // ...
}
```

### 2. 커스텀 Hook
```jsx
/**
 * 주식 데이터를 가져오는 커스텀 Hook
 * 
 * @param {string} ticker - 종목 코드
 * @param {Object} options - 옵션
 * @param {number} [options.interval='1d'] - 데이터 간격
 * @returns {Object} 데이터 상태 객체
 * @returns {Array} returns.data - 주식 데이터 배열
 * @returns {boolean} returns.isLoading - 로딩 상태
 * @returns {Error|null} returns.error - 에러 객체
 * 
 * @example
 * const { data, isLoading, error } = useStockData('AAPL');
 */
function useStockData(ticker, options = {}) {
  // ...
}
```

### 3. 유틸리티 함수
```javascript
/**
 * 볼린저 밴드를 계산합니다
 * 
 * @param {number[]} prices - 가격 배열
 * @param {number} [period=20] - 이동평균 기간
 * @param {number} [multiplier=2] - 표준편차 승수
 * @returns {Object} 볼린저 밴드 값
 * @returns {number} returns.upper - 상단 밴드
 * @returns {number} returns.middle - 중간선 (SMA)
 * @returns {number} returns.lower - 하단 밴드
 * 
 * @throws {Error} 가격 배열이 기간보다 짧으면 에러 발생
 */
function calculateBollingerBands(prices, period = 20, multiplier = 2) {
  // ...
}
```

### 4. Zustand Store
```javascript
/**
 * 시뮬레이션 상태 관리 스토어
 * 
 * @typedef {Object} SimulationState
 * @property {string} ticker - 현재 선택된 종목
 * @property {Object} settings - 시뮬레이션 설정
 * @property {Array} results - 시뮬레이션 결과
 * 
 * @typedef {Object} SimulationActions
 * @property {function} setTicker - 종목 변경
 * @property {function} runSimulation - 시뮬레이션 실행
 * @property {function} reset - 상태 초기화
 */
```

## 체크리스트

- [ ] 모든 export된 함수에 JSDoc 추가
- [ ] 컴포넌트 props에 타입 명시
- [ ] @example 예제 코드 포함
- [ ] @throws 에러 케이스 명시
- [ ] @returns 반환값 상세 설명

## 파일별 문서화 실행

```
사용자: "StockChart 컴포넌트 문서화해줘"

에이전트:
1. 해당 파일 열기
2. 함수 시그니처 분석
3. JSDoc 주석 생성
4. 파일 업데이트
```
