# Data Processor

**Path:** `src/lib/dataProcessor.js`

Pure utility functions for processing financial candle data.

## Key Functions

### `aggregateToInterval(data1min, intervalMinutes)`
- **Description**: Aggregates 1-minute candle data into larger intervals (e.g., 5m, 1h, 1d).
- **Purity**: Pure
- **Returns**: Array of aggregated candles.

### `addDerivedData(data)`
- **Description**: Adds technical indicators to candle data.
- **Indicators**:
  - Median Price: (Open + Close) / 2
  - Slope: Change in median price
  - RSI (14)
  - MA (20, 50)
  - Bollinger Bands (20, 2)
- **Purity**: Pure (Returns new array with added properties)

### `generateIntegratedTrades(data, options)`
- **Description**: Core simulation engine. Generates buy/sell signals based on provided strategy options.
- **Features**:
  - Validates entry conditions (Trend, BB, RSI, Volume)
  - Handles Stop Loss / Take Profit / Trailing Stop
  - Supports V-Martingale logic
- **Purity**: Pure (Deterministic output based on input data and options)
