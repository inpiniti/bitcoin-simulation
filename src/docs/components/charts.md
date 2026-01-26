# Chart Components

데이터 시각화를 담당하는 차트 컴포넌트입니다. `Recharts` 라이브러리를 기반으로 하며, SVG로 그려지는 고성능 캔들스틱 차트를 포함합니다.

---

## ChartView
**Path:** `src/components/ChartView.jsx`

과거 데이터(일봉 등)를 시각화하는 메인 차트입니다. 캔들스틱(Candlestick) 차트와 이동평균선(MA), 볼린저 밴드(Bollinger Bands) 등의 기술적 지표를 오버레이(Overlay)하여 표시합니다. 또한 하단에 거래량(Volume) 바 차트와 RSI 지표를 서브 차트로 함께 렌더링합니다.

### Key Logic: `CandleStickLayer`
Recharts는 기본적으로 캔들스틱을 지원하지 않으므로, `Customized` 컴포넌트를 사용하여 SVG `rect`와 `line` 요소로 직접 캔들을 그리는 커스텀 레이어를 구현했습니다.
- **Y축 스케일링**: 데이터의 min/max 값을 기준으로 픽셀 좌표를 계산 (`scaleY`).
- **상승/하락 색상**: 시가와 종가를 비교하여 빨간색(상승)/파란색(하락) 적용.

### State Dependencies
- `hist`: 차트에 그릴 전체 캔들 데이터.
- `interval`: 현재 선택된 시간 간격.

### Example Usage
```jsx
// 데이터 로드 후 렌더링
<div className="h-[500px] w-full">
  <ChartView />
</div>
```

