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

    const { ticker } = request.query;

    if (!ticker) {
        response.status(400).json({ error: 'Ticker required' });
        return;
    }

    try {
        const TARGET_URL = `https://finance.yahoo.com/quote/${ticker}`;
        console.log(`[Vercel] Scraping Quote: ${TARGET_URL}`);

        const apiResponse = await fetch(TARGET_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!apiResponse.ok) {
            throw new Error(`Failed to fetch quote page: ${apiResponse.status}`);
        }

        const html = await apiResponse.text();
        const $ = cheerio.load(html);

        const getValue = (label) => {
            // Yahoo Summary Page uses List Items <li>
            let val = $(`li:contains("${label}")`).find('span').last().text().trim();
            if (val && val !== label) return val;

            // Table fallback
            val = $(`td:contains("${label}")`).next().text().trim();
            if (val) return val;

            return null;
        };

        // Try to get Price
        const price = $('fin-streamer[data-field="regularMarketPrice"]').text().trim() ||
            $('span[data-testid="qsp-price"]').text().trim();

        const quote = {
            marketCap: getValue('Market Cap'),
            trailingPE: getValue('PE Ratio (TTM)'),
            beta: getValue('Beta (5Y Monthly)'),
            eps: getValue('EPS (TTM)'),
            regularMarketPrice: price
        };

        // Cache for 5 minutes
        response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
        response.status(200).json(quote);
    } catch (error) {
        console.error('Company Quote Error:', error);
        response.status(500).json({ error: 'Failed to fetch company quote', details: error.message });
    }
}
