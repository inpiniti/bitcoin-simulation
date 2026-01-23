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

---

## RealTimeChartView
**Path:** `src/components/RealTimeChartView.jsx`

최근 7일간의 **1분봉 데이터**를 실시간으로 보여주는 차트입니다. 장 중 실시간 흐름, 단기 급등락 패턴, 그리고 AI 예측 경로(Forecast)를 표시하는 데 최적화되어 있습니다.

### Features
- **자동 갱신**: 주기적으로(예: 1분) API를 호출하여 최신 캔들을 가져옵니다.
- **AI 예측 오버레이**: `fetchForecast` 결과가 있다면 미래 영역에 점선으로 예측 경로를 그립니다.
- **포커스 줌**: 최근 N개(예: 60분) 데이터에 집중하여 보여주는 줌 기능.

### State Dependencies
- `data1m`: 전역 스토어의 1분봉 데이터.
- `ticker`: 현재 종목.

### Example Usage
```jsx
// 실시간 탭에서 사용
<TabsContent value="realtime">
  <RealTimeChartView />
</TabsContent>
```
