import * as cheerio from 'cheerio';

/**
 * 주요 지수 및 시장별 종목 리스트를 반환하는 서버리스 함수
 * 
 * @param {Object} request - Vercel 요청 객체
 * @param {string} request.query.index - 조회할 인덱스 유형 ('sp500', 'qqq', 'kospi200', 'usall')
 * @param {Object} response - Vercel 응답 객체
 * 
 * @description
 * - sp500, qqq, kospi200: Wikipedia에서 크롤링하여 실시간 구성 종목 파싱
 * - usall: Nasdaq Trader FTP 공개 파일에서 미국 전체 시장 종목 파싱 (주식만 포함, ETF 제외)
 */
export default async function handler(request, response) {
    // CORS Settings
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    const { index } = request.query;

    let targetUrl = '';
    let parser = null;

    if (index === 'sp500') {
        targetUrl = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';
        parser = ($) => {
            const stocks = [];
            $('#constituents tbody tr').each((i, el) => {
                const tds = $(el).find('td');
                if (tds.length === 0) return;
                let ticker = $(tds[0]).text().trim();
                const name = $(tds[1]).text().trim();
                const actualSector = $(tds[2]).text().trim();
                ticker = ticker.replace(/\n/g, '').replace(/\s+/g, '').trim();
                if (ticker) {
                    stocks.push({
                        ticker: ticker.replace(/\./g, '-'),
                        name,
                        count: actualSector,
                        exchange: 'NYS/NAS'
                    });
                }
            });
            return stocks;
        };
    } else if (index === 'qqq') {
        targetUrl = 'https://en.wikipedia.org/wiki/Nasdaq-100';
        parser = ($) => {
            const stocks = [];
            $('#constituents tbody tr').each((i, el) => {
                const tds = $(el).find('td');
                if (tds.length === 0) return;
                let ticker = $(tds[0]).text().trim();
                const name = $(tds[1]).text().trim();
                const sector = $(tds[2]).text().trim();
                ticker = ticker.replace(/\n/g, '').replace(/\s+/g, '').trim();
                if (ticker) {
                    stocks.push({
                        ticker: ticker.replace(/\./g, '-'),
                        name,
                        count: sector,
                        exchange: 'NAS'
                    });
                }
            });
            return stocks;
        };
    } else if (index === 'kospi200') {
        targetUrl = 'https://ko.wikipedia.org/wiki/%EC%BD%94%EC%8A%A4%ED%94%BC_200';
        parser = ($) => {
            const stocks = [];
            const table = $('table.wikitable').filter((i, el) => $(el).text().includes('삼성전자')).first();
            if (!table || table.length === 0) return [];
            table.find('tbody tr').each((i, el) => {
                const tds = $(el).find('td');
                if (tds.length < 2) return;
                const name = $(tds[0]).text().trim();
                let ticker = $(tds[1]).text().trim();
                const sector = $(tds[2])?.text().trim() || '-';
                ticker = ticker.replace(/\n/g, '').replace(/\s+/g, '').trim();
                if (ticker && /^\d{6}$/.test(ticker)) {
                    stocks.push({
                        ticker,
                        name,
                        count: sector,
                        exchange: 'KOSPI'
                    });
                }
            });
            return stocks;
        };
    } else if (index === 'usall') {
        // 나스닥 + 뉴욕 전체 종목 조회 (Nasdaq Trader FTP 공개 파일)
        // api.nasdaq.com은 Cloudflare 봇 방어로 차단되므로 nasdaqtrader.com 사용
        try {
            console.log(`[Vercel Function] Fetching US All stocks from Nasdaq Trader FTP files...`);

            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            };

            const [nasdaqRes, otherRes] = await Promise.all([
                fetch('https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt', { headers }),
                fetch('https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt', { headers }),
            ]);

            const allStocks = [];

            // NASDAQ 종목 파싱 (파이프 구분)
            // 형식: Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares
            if (nasdaqRes.ok) {
                const text = await nasdaqRes.text();
                const lines = text.split('\n').slice(1);
                lines.forEach(line => {
                    const cols = line.split('|');
                    if (cols.length < 7) return;
                    const ticker = cols[0].trim();
                    const name = cols[1].trim();
                    const testIssue = cols[3].trim();
                    const etf = cols[6].trim();
                    if (ticker && testIssue !== 'Y' && etf !== 'Y' && !ticker.includes('File Creation Time') && ticker.length <= 5) {
                        allStocks.push({ ticker, name, count: 'NASDAQ', exchange: 'NAS' });
                    }
                });
                console.log(`[usall] NASDAQ stocks: ${allStocks.length}`);
            }

            // NYSE/AMEX 종목 파싱
            // 형식: ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
            const nyseStartCount = allStocks.length;
            if (otherRes.ok) {
                const text = await otherRes.text();
                const lines = text.split('\n').slice(1);
                lines.forEach(line => {
                    const cols = line.split('|');
                    if (cols.length < 7) return;
                    const ticker = cols[0].trim();
                    const name = cols[1].trim();
                    const exchangeCode = cols[2].trim();
                    const etf = cols[4].trim();
                    const testIssue = cols[6].trim();
                    if (ticker && testIssue !== 'Y' && etf !== 'Y' && !ticker.includes('File Creation Time') && ticker.length <= 5) {
                        const exchange = exchangeCode === 'N' ? 'NYS' : exchangeCode === 'A' ? 'AMS' : 'NYS';
                        allStocks.push({ ticker, name, count: exchangeCode === 'N' ? 'NYSE' : 'AMEX', exchange });
                    }
                });
                console.log(`[usall] NYSE/AMEX stocks: ${allStocks.length - nyseStartCount}`);
            }

            console.log(`[usall] Total US stocks: ${allStocks.length}`);

            if (allStocks.length === 0) {
                throw new Error('No stocks fetched from Nasdaq Trader FTP files');
            }

            // 24시간 캐시 적용
            response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
            response.status(200).json(allStocks);
        } catch (error) {
            console.error('US All Stocks Error:', error);
            response.status(500).json({ error: 'Failed to fetch US all stocks', details: error.message });
        }
        return;
    } else {
        response.status(400).json({ error: 'Invalid index type' });
        return;
    }

    try {
        console.log(`[Vercel Function] Fetching ${index} from Wikipedia: ${targetUrl}`);
        const apiResponse = await fetch(targetUrl);

        if (!apiResponse.ok) {
            throw new Error(`Failed to fetch Wikipedia: ${apiResponse.statusText}`);
        }

        const html = await apiResponse.text();
        const $ = cheerio.load(html);
        const stocks = parser($);

        console.log(`[${index}] Found ${stocks.length} stocks.`);

        if (stocks.length === 0) {
            throw new Error("No stocks parsed. Markup structure might have changed.");
        }

        // Cache for 24 hours
        response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
        response.status(200).json(stocks);
    } catch (error) {
        console.error(`${index} Proxy Error:`, error);
        response.status(500).json({ error: `Failed to fetch ${index} data`, details: error.message });
    }
}
