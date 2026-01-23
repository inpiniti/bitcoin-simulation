# Chart View

**Path:** `src/components/ChartView.jsx`

Renders the main price chart with technical indicators.

## Features
- **Candlestick Rendering**: Custom SVG drawing for performance optimization.
- **Indicators**: Toggles for MA, BB, RSI.
- **AI Forecast**: Renders prediction dashed lines.
- **Interactive**: Tooltip with detailed OHLC data.

## Usage
Dependent on global store state (`useStore`). Not a pure presentational component.
