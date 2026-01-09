
/**
 * Nasdaq 100 종목 리스트를 외부 소스(Wikipedia)에서 가져옵니다.
 * Yahoo Finance는 공식 API를 제공하지 않으므로, Wikipedia의 최신 리스트를 크롤링하여 사용합니다.
 */
export async function fetchQQQTickers() {
    try {
        // Vite Dev Server에 설정된 크롤링 미들웨어 호출 (/api/qqq)
        // Production(Vercel) 배포 시에는 /api/qqq 서버리스 함수가 필요함 (추후 구현 필요)
        const response = await fetch('/api/qqq');

        if (!response.ok) {
            throw new Error('Failed to fetch Nasdaq 100 list from Wikipedia Proxy');
        }

        const stocks = await response.json();

        if (!Array.isArray(stocks) || stocks.length === 0) {
            throw new Error('Invalid format or empty list');
        }

        // 이미 포맷이 맞춰져서 옴 { ticker, name, count(sector), exchange }
        return stocks;

    } catch (error) {
        console.warn('Nasdaq 100 리스트 로드 실패 (Fallback 사용):', error);
        // 실패 시 내장된 Top 20 리스트 반환
        return QQQ_TOP_20.map(item => ({
            ticker: item.ticker,
            name: item.name,
            count: 'Top 20 (Fallback)',
            exchange: 'NAS'
        }));
    }
}

/**
 * Nasdaq 100 Top 20 Stocks (Fallback Static List)
 */
export const QQQ_TOP_20 = [
    { ticker: 'AAPL', name: 'Apple Inc.' },
    { ticker: 'MSFT', name: 'Microsoft Corporation' },
    { ticker: 'AMZN', name: 'Amazon.com, Inc.' },
    { ticker: 'NVDA', name: 'NVIDIA Corporation' },
    { ticker: 'META', name: 'Meta Platforms, Inc.' },
    { ticker: 'AVGO', name: 'Broadcom Inc.' },
    { ticker: 'TSLA', name: 'Tesla, Inc.' },
    { ticker: 'GOOGL', name: 'Alphabet Inc.' },
    { ticker: 'GOOG', name: 'Alphabet Inc.' },
    { ticker: 'COST', name: 'Costco Wholesale Corporation' },
    { ticker: 'NFLX', name: 'Netflix, Inc.' },
    { ticker: 'AMD', name: 'Advanced Micro Devices, Inc.' },
    { ticker: 'PEP', name: 'PepsiCo, Inc.' },
    { ticker: 'LIN', name: 'Linde plc' },
    { ticker: 'ADBE', name: 'Adobe Inc.' },
    { ticker: 'CSCO', name: 'Cisco Systems, Inc.' },
    { ticker: 'TMUS', name: 'T-Mobile US, Inc.' },
    { ticker: 'QCOM', name: 'QUALCOMM Incorporated' },
    { ticker: 'INTC', name: 'Intel Corporation' },
    { ticker: 'TXN', name: 'Texas Instruments Incorporated' }
];
