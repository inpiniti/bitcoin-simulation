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

    const TARGET_URL = 'https://en.wikipedia.org/wiki/Nasdaq-100';

    try {
        console.log(`[Vercel Function] Fetching Nasdaq 100 from Wikipedia: ${TARGET_URL}`);
        const apiResponse = await fetch(TARGET_URL);

        if (!apiResponse.ok) {
            throw new Error(`Failed to fetch Wikipedia: ${apiResponse.statusText}`);
        }

        const html = await apiResponse.text();
        const $ = cheerio.load(html);
        const stocks = [];

        // Wikipedia table id="constituents"
        $('#constituents tbody tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length === 0) return;

            // For Nasdaq 100: 
            // 0: Company, 1: Ticker, 2: GICS Sector, 3: GICS Sub-Industry

            const name = $(tds[0]).text().trim();
            let ticker = $(tds[1]).text().trim();
            const sector = $(tds[2]).text().trim();

            // Cleanup ticker (remove newlines, extra spaces)
            ticker = ticker.replace(/\n/g, '').replace(/\s+/g, '').trim();

            if (ticker) {
                stocks.push({
                    ticker: ticker.replace(/\./g, '-'), // Exchange compatibility
                    name,
                    count: sector,
                    exchange: 'NAS'
                });
            }
        });

        console.log(`[Nasdaq 100] Found ${stocks.length} stocks.`);

        if (stocks.length === 0) {
            throw new Error("No stocks parsed. Markup structure might have changed.");
        }

        // Cache for 24 hours (86400 seconds)
        response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
        response.status(200).json(stocks);
    } catch (error) {
        console.error('Nasdaq 100 Proxy Error:', error);
        response.status(500).json({ error: 'Failed to fetch Nasdaq 100 data', details: error.message });
    }
}
