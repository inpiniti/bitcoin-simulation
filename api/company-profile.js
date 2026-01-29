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
        // Step 1: Yahoo Finance에서 회사 이름 가져오기
        const yahooUrl = `https://finance.yahoo.com/quote/${ticker}`;
        console.log(`[Company Profile] Fetching company name from Yahoo: ${yahooUrl}`);

        const yahooResponse = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        let companyName = ticker; // 기본값은 티커

        if (yahooResponse.ok) {
            const yahooHtml = await yahooResponse.text();
            const $yahoo = cheerio.load(yahooHtml);

            // 페이지 타이틀에서 회사명 추출: "Apple Inc. (AAPL) Stock Price..."
            const title = $yahoo('title').text();
            const titleMatch = title.match(/^(.+?)\s*\(/);
            if (titleMatch) {
                companyName = titleMatch[1].trim();
            }

            // 또는 h1에서 추출
            if (companyName === ticker) {
                const h1Text = $yahoo('h1').first().text();
                if (h1Text && h1Text.length > ticker.length) {
                    companyName = h1Text.replace(/\(.*?\)/g, '').trim();
                }
            }
        }

        console.log(`[Company Profile] Found company name: ${companyName}`);

        // Step 2: Wikipedia Search API로 회사 페이지 찾기
        const searchQuery = encodeURIComponent(companyName);
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&format=json&srlimit=3`;

        const searchResponse = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockSimulator/1.0)' }
        });

        if (!searchResponse.ok) {
            throw new Error('Wikipedia search failed');
        }

        const searchData = await searchResponse.json();
        const searchResults = searchData.query?.search || [];

        if (searchResults.length === 0) {
            console.log(`[Wikipedia] No results for: ${companyName}`);
            response.status(200).json({
                assetProfile: {
                    longBusinessSummary: `${companyName} (${ticker})에 대한 Wikipedia 정보를 찾을 수 없습니다.`,
                    sector: '-',
                    industry: '-',
                    website: '',
                    country: 'US',
                    companyOfficers: []
                }
            });
            return;
        }

        // 첫 번째 검색 결과 사용
        const pageTitle = searchResults[0].title;
        const encodedTitle = encodeURIComponent(pageTitle);
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodedTitle}`;

        console.log(`[Wikipedia] Found page: ${pageTitle}`);

        // Step 3: Wikipedia 페이지 스크래핑
        const wikiResponse = await fetch(wikiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockSimulator/1.0)' }
        });

        if (!wikiResponse.ok) {
            throw new Error('Wikipedia page fetch failed');
        }

        const html = await wikiResponse.text();
        const $ = cheerio.load(html);

        // 첫 번째 문단 (요약) 추출
        let summary = '';
        $('.mw-parser-output > p').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && !text.startsWith('Coordinates:') && !text.includes('may refer to:')) {
                if (!summary) {
                    summary = text;
                }
            }
        });

        // Infobox에서 정보 추출
        let industry = '';
        let website = '';
        let products = '';
        let services = '';
        let founded = '';
        let headquarters = '';
        let employees = '';

        $('table.infobox tr').each((i, el) => {
            const th = $(el).find('th').text().trim().toLowerCase();
            // Clone td and remove style/script tags before getting text
            const tdClone = $(el).find('td').clone();
            tdClone.find('style, script').remove();
            const td = tdClone.text().trim();

            if (th.includes('industry')) {
                industry = td.replace(/\[.*?\]/g, '').trim();
            }
            if (th.includes('products')) {
                products = td.replace(/\[.*?\]/g, '').trim();
            }
            if (th.includes('services')) {
                services = td.replace(/\[.*?\]/g, '').trim();
            }
            if (th.includes('founded')) {
                founded = td.replace(/\[.*?\]/g, '').trim();
            }
            if (th.includes('headquarters') || th.includes('hq')) {
                headquarters = td.replace(/\[.*?\]/g, '').trim();
            }
            if (th.includes('website')) {
                website = $(el).find('td a').attr('href') || td;
            }
            // 직원 수 추출 (employees 또는 size 키워드)
            if (th.includes('employees') || th.includes('size')) {
                employees = td.replace(/\[.*?\]/g, '').split('(')[0].trim();
            }
        });

        // 참조 표시 제거 [1], [2] 등
        summary = summary.replace(/\[\d+\]/g, '').trim();

        // Cache for 24 hours
        response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
        response.status(200).json({
            assetProfile: {
                longBusinessSummary: summary || `${companyName} (${ticker})에 대한 정보입니다.`,
                sector: '-',
                industry: industry || '-',
                products: products || '-',
                services: services || '-',
                founded: founded || '-',
                headquarters: headquarters || '-',
                fullTimeEmployees: employees || '-',
                website: website,
                country: 'US',
                companyOfficers: []
            }
        });
    } catch (error) {
        console.error('Company Profile Error:', error);
        response.status(500).json({ error: 'Failed to fetch company profile', details: error.message });
    }
}
