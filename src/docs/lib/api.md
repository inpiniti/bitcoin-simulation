# API Service

**Path:** `src/lib/api.js`

Handles all external data fetching.

## Key Features
- **Proxy Support**: Automatically uses local proxy paths (`/api/...`) to avoid CORS.
- **Normalization**: Converts data from different sources (Upbit, Yahoo) into a unified candle format.
- **Error Handling**: Standardized error throwing for UI catcher.

## Major Functions
- `fetchCoinDailyData()`: Upbit API (KRW-BTC)
- `fetchStockData(ticker, interval, range)`: Yahoo Finance API via Proxy
- `fetchForecast(symbol)`: Custom AI API for price prediction
