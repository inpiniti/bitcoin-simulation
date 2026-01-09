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

    const TARGET_URL = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';

    try {
        console.log(`[Vercel Function] Fetching S&P 500 from Wikipedia: ${TARGET_URL}`);
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

            // 1st column: Symbol
            let ticker = $(tds[0]).text().trim();
            // 2nd column: Security (Name)
            const name = $(tds[1]).text().trim();
            // 3rd column: GICS Sector (index 3 in standard HTML count, index 2 in 0-based index?)
            // Wikipedia Table: [Symbol, Security, GICS Sector, GICS Sub-Industry, ...]
            // Index 0: Symbol, Index 1: Security, Index 2: GICS Sector
            const actualSector = $(tds[2]).text().trim();

            // Cleanup ticker (e.g. \n)
            ticker = ticker.replace(/\n/g, '').replace(/\s+/g, '').trim();

            if (ticker) {
                stocks.push({
                    ticker: ticker.replace(/\./g, '-'), // Exchange compatibility (BF.B -> BF-B)
                    name,
                    count: actualSector,
                    exchange: 'NYS/NAS'
                });
            }
        });

        console.log(`[S&P 500] Found ${stocks.length} stocks.`);

        if (stocks.length === 0) {
            throw new Error("No stocks parsed. Markup structure might have changed.");
        }

        // Cache for 24 hours (86400 seconds) since S&P 500 list doesn't change often
        response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
        response.status(200).json(stocks);
    } catch (error) {
        console.error('S&P 500 Proxy Error:', error);
        response.status(500).json({ error: 'Failed to fetch S&P 500 data', details: error.message });
    }
}
