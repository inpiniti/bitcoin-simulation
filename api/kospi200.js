import * as cheerio from 'cheerio';

/**
 * KOSPI 200 종목 리스트를 위키백과에서 스크래핑하여 반환하는 Vercel 서버리스 함수입니다.

 * 
 * @param {import('@vercel/node').VercelRequest} request - HTTP 요청 객체
 * @param {import('@vercel/node').VercelResponse} response - HTTP 응답 객체
 * @returns {Promise<void>} JSON 형식의 종목 리스트 반환
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

    const TARGET_URL = 'https://ko.wikipedia.org/wiki/%EC%BD%94%EC%8A%A4%ED%94%BC_200';

    try {
        console.log(`[Vercel Function] Fetching KOSPI 200 from Wikipedia: ${TARGET_URL}`);
        const apiResponse = await fetch(TARGET_URL);

        if (!apiResponse.ok) {
            throw new Error(`Failed to fetch Wikipedia: ${apiResponse.statusText}`);
        }

        const html = await apiResponse.text();
        const $ = cheerio.load(html);
        const stocks = [];

        // KOSPI 200 table is usually the one containing '삼성전자'
        const table = $('table.wikitable').filter((i, el) => $(el).text().includes('삼성전자')).first();

        if (!table || table.length === 0) {
            throw new Error("Could not find the KOSPI 200 table on Wikipedia.");
        }

        table.find('tbody tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length < 2) return;

            // Column 0: Company Name, Column 1: Ticker (6 digits), Column 2: Sector
            const name = $(tds[0]).text().trim();
            let ticker = $(tds[1]).text().trim();
            const sector = $(tds[2])?.text().trim() || '-';

            // Clean up ticker (ensure 6 digits)
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

        console.log(`[KOSPI 200] Found ${stocks.length} stocks.`);

        if (stocks.length === 0) {
            throw new Error("No stocks parsed from KOSPI 200 table.");
        }

        // Cache for 24 hours
        response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
        response.status(200).json(stocks);
    } catch (error) {
        console.error('KOSPI 200 Proxy Error:', error);
        response.status(500).json({ error: 'Failed to fetch KOSPI 200 data', details: error.message });
    }
}
