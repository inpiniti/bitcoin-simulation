import * as cheerio from 'cheerio';

export default async function handler(request, response) {
    // CORS 설정
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    const TARGET_URL = 'https://www.dataroma.com/m/g/portfolio.php?o=c'; // Most held stocks

    try {
        console.log(`Fetching Dataroma: ${TARGET_URL}`);
        const apiResponse = await fetch(TARGET_URL);

        if (!apiResponse.ok) {
            throw new Error(`Failed to fetch dataroma: ${apiResponse.statusText}`);
        }

        const html = await apiResponse.text();
        const $ = cheerio.load(html);
        const stocks = [];

        // 테이블 파싱 로직
        // Dataroma 구조: <table id="grid"> 내의 tr
        // 컬럼: [Stock Symbol] [Company Name] [Count] ...

        const table = $('#grid');
        if (!table.length) {
            throw new Error('Table #grid not found in Dataroma page');
        }

        table.find('tbody tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length < 4) return; // Ensure enough columns

            // 1. Ticker (Symbol) - class="sym"
            const ticker = $(tds[0]).text().trim(); // <a> 태그 안의 텍스트가 아니라 그냥 text()로 가져와도 됨

            // 2. Company Name - class="stock"
            const name = $(tds[1]).text().trim();

            // 3. Count (Hold Count) - class="cnt" (4번째 컬럼, index 3)
            // HTML 구조: <td class="cnt">35</td>
            const countText = $(tds[3]).text().trim();
            const count = parseInt(countText, 10);

            if (ticker && !isNaN(count)) {
                // 조건: 자산가 5명 이상
                if (count >= 5) {
                    stocks.push({ ticker, name, count });
                }
            }
        });

        console.log(`[Dataroma] Found ${stocks.length} stocks with >= 5 holders.`);

        // CDN 캐시 설정: 1시간 캐시, 24시간까지 백그라운드 갱신
        response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
        response.status(200).json({ stocks });
    } catch (error) {
        console.error('Dataroma Proxy Error:', error);
        response.status(500).json({ error: 'Failed to fetch recommendation data', details: error.message });
    }
}
