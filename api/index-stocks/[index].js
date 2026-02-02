import * as cheerio from 'cheerio';

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
