import * as cheerio from 'cheerio';

async function handleProfile(ticker) {
    // Step 1: Yahoo Finance에서 회사 이름 가져오기
    const yahooUrl = `https://finance.yahoo.com/quote/${ticker}`;
    const yahooResponse = await fetch(yahooUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    let companyName = ticker;
    if (yahooResponse.ok) {
        const yahooHtml = await yahooResponse.text();
        const $yahoo = cheerio.load(yahooHtml);
        const title = $yahoo('title').text();
        const titleMatch = title.match(/^(.+?)\s*\(/);
        if (titleMatch) {
            companyName = titleMatch[1].trim();
        }
        if (companyName === ticker) {
            const h1Text = $yahoo('h1').first().text();
            if (h1Text && h1Text.length > ticker.length) {
                companyName = h1Text.replace(/\(.*?\)/g, '').trim();
            }
        }
    }

    // Step 2: Wikipedia Search API로 회사 페이지 찾기
    const searchQuery = encodeURIComponent(companyName);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchQuery}&format=json&srlimit=3`;
    const searchResponse = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockSimulator/1.0)' }
    });

    if (!searchResponse.ok) throw new Error('Wikipedia search failed');
    const searchData = await searchResponse.json();
    const searchResults = searchData.query?.search || [];

    if (searchResults.length === 0) {
        return {
            assetProfile: {
                longBusinessSummary: `${companyName} (${ticker})에 대한 Wikipedia 정보를 찾을 수 없습니다.`,
                sector: '-',
                industry: '-',
                website: '',
                country: 'US',
                companyOfficers: []
            }
        };
    }

    const pageTitle = searchResults[0].title;
    const encodedTitle = encodeURIComponent(pageTitle);
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodedTitle}`;
    const wikiResponse = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockSimulator/1.0)' }
    });

    if (!wikiResponse.ok) throw new Error('Wikipedia page fetch failed');
    const html = await wikiResponse.text();
    const $ = cheerio.load(html);

    let summary = '';
    $('.mw-parser-output > p').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && !text.startsWith('Coordinates:') && !text.includes('may refer to:')) {
            if (!summary) summary = text;
        }
    });

    let industry = '', website = '', products = '', services = '', founded = '', headquarters = '', employees = '';
    $('table.infobox tr').each((i, el) => {
        const th = $(el).find('th').text().trim().toLowerCase();
        const tdClone = $(el).find('td').clone();
        tdClone.find('style, script').remove();
        const td = tdClone.text().trim();

        if (th.includes('industry')) industry = td.replace(/\[.*?\]/g, '').trim();
        if (th.includes('products')) products = td.replace(/\[.*?\]/g, '').trim();
        if (th.includes('services')) services = td.replace(/\[.*?\]/g, '').trim();
        if (th.includes('founded')) founded = td.replace(/\[.*?\]/g, '').trim();
        if (th.includes('headquarters') || th.includes('hq')) headquarters = td.replace(/\[.*?\]/g, '').trim();
        if (th.includes('website')) website = $(el).find('td a').attr('href') || td;
        if (th.includes('employees') || th.includes('size')) employees = td.replace(/\[.*?\]/g, '').split('(')[0].trim();
    });

    summary = summary.replace(/\[\d+\]/g, '').trim();
    return {
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
    };
}

async function handleQuote(ticker) {
    const TARGET_URL = `https://finance.yahoo.com/quote/${ticker}`;
    const apiResponse = await fetch(TARGET_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    if (!apiResponse.ok) throw new Error(`Failed to fetch quote page: ${apiResponse.status}`);
    const html = await apiResponse.text();
    const $ = cheerio.load(html);

    const getValue = (label) => {
        let val = $(`li:contains("${label}")`).find('span').last().text().trim();
        if (val && val !== label) return val;
        val = $(`td:contains("${label}")`).next().text().trim();
        return val || null;
    };

    const price = $('fin-streamer[data-field="regularMarketPrice"]').text().trim() ||
        $('span[data-testid="qsp-price"]').text().trim();

    return {
        marketCap: getValue('Market Cap'),
        trailingPE: getValue('PE Ratio (TTM)'),
        beta: getValue('Beta (5Y Monthly)'),
        eps: getValue('EPS (TTM)'),
        regularMarketPrice: price
    };
}

export default async function handler(request, response) {
    // CORS Settings
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    const { type, ticker } = request.query;

    if (!ticker) {
        response.status(400).json({ error: 'Ticker required' });
        return;
    }

    try {
        if (type === 'profile') {
            const data = await handleProfile(ticker);
            response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
            response.status(200).json(data);
        } else if (type === 'quote') {
            const data = await handleQuote(ticker);
            response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
            response.status(200).json(data);
        } else {
            response.status(400).json({ error: 'Invalid type' });
        }
    } catch (error) {
        console.error(`Company ${type} Error:`, error);
        response.status(500).json({ error: `Failed to fetch company ${type}`, details: error.message });
    }
}
