
/**
 * S&P 500 종목 리스트를 외부 소스(Wikipedia)에서 가져옵니다.
 * Yahoo Finance는 공식 API를 제공하지 않으므로, Wikipedia의 최신 리스트를 크롤링하여 사용합니다.
 */
export async function fetchSP500Tickers() {
    try {
        // Vite Dev Server에 설정된 크롤링 미들웨어 호출 (/api/sp500)
        // Production(Vercel) 배포 시에는 /api/sp500 서버리스 함수가 필요함 (추후 구현 필요)
        const response = await fetch('/api/sp500');

        if (!response.ok) {
            throw new Error('Failed to fetch S&P 500 list from Wikipedia Proxy');
        }

        const stocks = await response.json();

        if (!Array.isArray(stocks) || stocks.length === 0) {
            throw new Error('Invalid format or empty list');
        }

        // 이미 포맷이 맞춰져서 옴 { ticker, name, count(sector), exchange }
        return stocks;

    } catch (error) {
        console.warn('S&P 500 리스트 로드 실패 (Fallback 사용):', error);
        // 실패 시 내장된 Top 50 리스트 반환
        return SP500_TOP_50.map(item => ({
            ticker: item.ticker,
            name: item.name,
            count: 'Top 50 (Fallback)',
            exchange: 'NYS/NAS'
        }));
    }
}

/**
 * S&P 500 Top 50 Stocks (Fallback Static List)
 */
export const SP500_TOP_50 = [
    { ticker: 'AAPL', name: 'Apple Inc.' },
    { ticker: 'MSFT', name: 'Microsoft Corporation' },
    { ticker: 'GOOGL', name: 'Alphabet Inc.' },
    { ticker: 'AMZN', name: 'Amazon.com, Inc.' },
    { ticker: 'NVDA', name: 'NVIDIA Corporation' },
    { ticker: 'TSLA', name: 'Tesla, Inc.' },
    { ticker: 'META', name: 'Meta Platforms, Inc.' },
    { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.' }, // . 주의
    { ticker: 'LLY', name: 'Eli Lilly and Company' },
    { ticker: 'V', name: 'Visa Inc.' },
    { ticker: 'UNH', name: 'UnitedHealth Group' },
    { ticker: 'TSM', name: 'Taiwan Semiconductor' },
    { ticker: 'JPM', name: 'JPMorgan Chase & Co.' },
    { ticker: 'JNJ', name: 'Johnson & Johnson' },
    { ticker: 'XOM', name: 'Exxon Mobil Corporation' },
    { ticker: 'WMT', name: 'Walmart Inc.' },
    { ticker: 'PG', name: 'Procter & Gamble' },
    { ticker: 'MA', name: 'Mastercard Incorporated' },
    { ticker: 'AVGO', name: 'Broadcom Inc.' },
    { ticker: 'HD', name: 'The Home Depot' },
    { ticker: 'CVX', name: 'Chevron Corporation' },
    { ticker: 'MRK', name: 'Merck & Co.' },
    { ticker: 'ABBV', name: 'AbbVie Inc.' },
    { ticker: 'COST', name: 'Costco Wholesale' },
    { ticker: 'PEP', name: 'PepsiCo, Inc.' },
    { ticker: 'KO', name: 'The Coca-Cola Company' },
    { ticker: 'ADBE', name: 'Adobe Inc.' },
    { ticker: 'CSCO', name: 'Cisco Systems' },
    { ticker: 'BAC', name: 'Bank of America' },
    { ticker: 'MCD', name: 'McDonald\'s Corporation' },
    { ticker: 'TMO', name: 'Thermo Fisher Scientific' },
    { ticker: 'CRM', name: 'Salesforce, Inc.' },
    { ticker: 'PFE', name: 'Pfizer Inc.' },
    { ticker: 'NFLX', name: 'Netflix, Inc.' },
    { ticker: 'DHR', name: 'Danaher Corporation' },
    { ticker: 'ABT', name: 'Abbott Laboratories' },
    { ticker: 'ORCL', name: 'Oracle Corporation' },
    { ticker: 'AMD', name: 'Advanced Micro Devices' },
    { ticker: 'CMCSA', name: 'Comcast Corporation' },
    { ticker: 'NKE', name: 'NIKE, Inc.' },
    { ticker: 'DIS', name: 'The Walt Disney Company' },
    { ticker: 'INTC', name: 'Intel Corporation' },
    { ticker: 'VZ', name: 'Verizon Communications' },
    { ticker: 'WFC', name: 'Wells Fargo & Company' },
    { ticker: 'QCOM', name: 'Qualcomm Incorporated' },
    { ticker: 'BMY', name: 'Bristol-Myers Squibb' },
    { ticker: 'TXN', name: 'Texas Instruments' },
    { ticker: 'RTX', name: 'Raytheon Technologies' },
    { ticker: 'HON', name: 'Honeywell International' },
    { ticker: 'AMGN', name: 'Amgen Inc.' }
];
