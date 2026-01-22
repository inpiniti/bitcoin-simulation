import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [
            react(),
            {
                name: 'configure-server',
                configureServer(server) {
                    // 종목 토론 API 미들웨어
                    server.middlewares.use('/api/discussion', async (req, res, next) => {
                        try {
                            const urlObj = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
                            const ticker = urlObj.searchParams.get('ticker');
                            const source = urlObj.searchParams.get('source');

                            if (!ticker) {
                                res.statusCode = 400;
                                res.end(JSON.stringify({ error: 'Ticker required' }));
                                return;
                            }

                            const fetch = (await import('node-fetch')).default || global.fetch;
                            let result = [];

                            // Naver 조회
                            if (source === 'naver' || source === 'all') {
                                try {
                                    const itemCode = `${ticker.toUpperCase()}.O`;
                                    const params = new URLSearchParams({
                                        discussionType: 'foreignStock',
                                        itemCode: itemCode,
                                        pageSize: '50',
                                        isHolderOnly: 'false',
                                        excludesItemNews: 'false',
                                        isItemNewsOnly: 'false'
                                    });

                                    const response = await fetch(`https://m.stock.naver.com/front-api/discussion/list?${params.toString()}`, {
                                        headers: {
                                            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
                                            'Accept': 'application/json',
                                            'Referer': 'https://m.stock.naver.com/'
                                        }
                                    });

                                    if (response.ok) {
                                        const json = await response.json();
                                        if (json && json.result && Array.isArray(json.result.posts)) {
                                            result = result.concat(json.result.posts.map(post => ({
                                                source: 'Naver',
                                                id: post.discussionId,
                                                user: post.writer?.nickname || 'Anonymous',
                                                text: (post.contentSwReplaced || post.contentSwReplacedButImg || post.contents || '').replace(/<br\s*\/?>/gi, '\n'),
                                                date: post.writtenAt,
                                                sentiment: null
                                            })));
                                        }
                                    }
                                } catch (e) {
                                    console.warn('Naver fetch error:', e.message);
                                }
                            }

                            // Stocktwits 조회
                            if (source === 'stocktwits' || source === 'all') {
                                try {
                                    const symbol = ticker.toUpperCase();
                                    const apiUrl = `https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`;
                                    console.log('[Stocktwits] Fetching:', apiUrl);

                                    const response = await fetch(apiUrl, {
                                        headers: {
                                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                            'Accept': 'application/json',
                                            'Referer': 'https://stocktwits.com/'
                                        }
                                    });

                                    console.log('[Stocktwits] Response status:', response.status, response.statusText);

                                    if (response.ok) {
                                        const json = await response.json();
                                        console.log('[Stocktwits] Response has messages:', !!json?.messages, 'count:', json?.messages?.length || 0);
                                        if (json && json.messages) {
                                            result = result.concat(json.messages.slice(0, 30).map(msg => ({
                                                source: 'Stocktwits',
                                                id: msg.id,
                                                user: msg.user?.username || 'Anonymous',
                                                text: msg.body,
                                                date: msg.created_at,
                                                sentiment: msg.entities?.sentiment?.basic || null
                                            })));
                                        }
                                    } else {
                                        const errorText = await response.text();
                                        console.warn('[Stocktwits] Error response:', errorText.substring(0, 200));
                                    }
                                } catch (e) {
                                    console.warn('[Stocktwits] Fetch error:', e.message);
                                }
                            }

                            // Reddit 조회
                            if (source === 'reddit' || source === 'all') {
                                try {
                                    const query = `$${ticker.toUpperCase()}`;
                                    const response = await fetch(
                                        `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=25`,
                                        {
                                            headers: {
                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                            }
                                        }
                                    );

                                    if (response.ok) {
                                        const json = await response.json();
                                        if (json && json.data && Array.isArray(json.data.children)) {
                                            result = result.concat(json.data.children.map(child => {
                                                const post = child.data;
                                                const date = new Date(post.created_utc * 1000).toISOString();
                                                return {
                                                    source: 'Reddit',
                                                    id: post.id,
                                                    user: post.author,
                                                    text: `[${post.subreddit_name_prefixed}] ${post.title}\n${post.selftext ? post.selftext.substring(0, 200) : ''}`,
                                                    date: date,
                                                    sentiment: null
                                                };
                                            }));
                                        }
                                    }
                                } catch (e) {
                                    console.warn('Reddit fetch error:', e.message);
                                }
                            }

                            // Yahoo 조회 (OpenWeb API)
                            if (source === 'yahoo' || source === 'all') {
                                try {
                                    const SPOT_ID = 'sp_Dw69v66P';
                                    const conversationId = `${SPOT_ID}_${ticker.toUpperCase()}`;

                                    // OpenWeb API 엔드포인트들 (도메인이 변경될 수 있음)
                                    const apiUrls = [
                                        'https://open-amp.api.openweb.com/v1/messages-v2/read',
                                        'https://api-v2.spot.im/v1/messages-v2/read',
                                        'https://open-api.spot.im/v1/messages-v2/read'
                                    ];

                                    let success = false;
                                    for (const apiUrl of apiUrls) {
                                        if (success) break;

                                        console.log('[Yahoo] Trying:', apiUrl, 'conversation_id:', conversationId);

                                        try {
                                            const response = await fetch(apiUrl, {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'x-spot-id': SPOT_ID,
                                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                                    'Origin': 'https://finance.yahoo.com',
                                                    'Referer': 'https://finance.yahoo.com/'
                                                },
                                                body: JSON.stringify({
                                                    conversation_id: conversationId,
                                                    count: 20,
                                                    sort_by: "newest"
                                                })
                                            });

                                            console.log('[Yahoo] Response status:', response.status, response.statusText);

                                            if (response.ok) {
                                                const json = await response.json();
                                                console.log('[Yahoo] Response has messages:', !!json?.messages, 'count:', json?.messages?.length || 0);
                                                if (json && json.messages) {
                                                    result = result.concat(json.messages.map(msg => {
                                                        let text = "";
                                                        if (msg.content && Array.isArray(msg.content)) {
                                                            text = msg.content.map(c => c.text || "").join(" ");
                                                        }
                                                        return {
                                                            source: 'Yahoo',
                                                            id: msg.id,
                                                            user: msg.user_name || 'Anonymous',
                                                            text: text || 'No content',
                                                            date: new Date(msg.written_at * 1000).toISOString(),
                                                            sentiment: null
                                                        };
                                                    }));
                                                    success = true;
                                                }
                                            }
                                        } catch (urlError) {
                                            console.warn('[Yahoo] URL error:', apiUrl, urlError.message);
                                        }
                                    }

                                    if (!success) {
                                        console.warn('[Yahoo] All endpoints failed for:', conversationId);
                                    }
                                } catch (e) {
                                    console.warn('[Yahoo] Fetch error:', e.message);
                                }
                            }

                            // Toss 조회 (검색 API -> 댓글 API)
                            if (source === 'toss' || source === 'all') {
                                try {
                                    const symbol = ticker.toUpperCase();
                                    const TOSS_BASE_URL = 'https://wts-cert-api.tossinvest.com/api';

                                    // Step 1: 티커로 productCode 검색
                                    const screenerResponse = await fetch(`${TOSS_BASE_URL}/v3/search-all/wts-auto-complete`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
                                        },
                                        body: JSON.stringify({
                                            query: symbol,
                                            sections: [
                                                { type: 'SCREENER' },
                                                { type: 'NEWS' },
                                                { type: 'PRODUCT', option: { addIntegratedSearchResult: true } },
                                                { type: 'TICS' }
                                            ]
                                        })
                                    });

                                    if (!screenerResponse.ok) {
                                        console.warn('[Toss] Screener API returned:', screenerResponse.status);
                                    } else {
                                        const screenerData = await screenerResponse.json();

                                        // productCode 추출
                                        let productCode = null;
                                        try {
                                            if (Array.isArray(screenerData?.result)) {
                                                for (const section of screenerData.result) {
                                                    if (section?.type === 'PRODUCT' && section?.data?.items?.length) {
                                                        productCode = section.data.items[0]?.productCode;
                                                        if (productCode) break;
                                                    }
                                                }
                                            } else if (screenerData?.result?.data?.items?.length) {
                                                productCode = screenerData.result.data.items[0]?.productCode;
                                            }
                                        } catch (e) {
                                            console.warn('[Toss] Error extracting productCode:', e.message);
                                        }

                                        if (productCode) {
                                            console.log('[Toss] Found productCode:', productCode);

                                            // Step 2: productCode로 댓글 조회
                                            const communityResponse = await fetch(`${TOSS_BASE_URL}/v3/comments`, {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
                                                },
                                                body: JSON.stringify({
                                                    subjectId: productCode,
                                                    subjectType: 'STOCK',
                                                    commentSortType: 'RECENT'
                                                })
                                            });

                                            if (communityResponse.ok) {
                                                const communityData = await communityResponse.json();

                                                // 댓글 추출 (다양한 응답 구조 지원)
                                                let comments = [];
                                                try {
                                                    if (Array.isArray(communityData?.result?.comments)) {
                                                        comments = communityData.result.comments;
                                                    } else if (Array.isArray(communityData?.result?.comments?.body)) {
                                                        comments = communityData.result.comments.body;
                                                    } else if (Array.isArray(communityData?.comments)) {
                                                        comments = communityData.comments;
                                                    } else if (Array.isArray(communityData)) {
                                                        comments = communityData;
                                                    }
                                                } catch (e) {
                                                    console.warn('[Toss] Error extracting comments:', e.message);
                                                }

                                                console.log('[Toss] Found comments:', comments.length);

                                                result = result.concat(comments.slice(0, 30).map(comment => ({
                                                    source: 'Toss',
                                                    id: comment.id,
                                                    user: comment.author?.nickname || 'Anonymous',
                                                    text: comment.message || '',
                                                    date: comment.updatedAt || new Date().toISOString(),
                                                    sentiment: null
                                                })));
                                            } else {
                                                console.warn('[Toss] Community API Error:', communityResponse.status);
                                            }
                                        } else {
                                            console.warn('[Toss] Could not find productCode for:', symbol);
                                        }
                                    }
                                } catch (e) {
                                    console.warn('[Toss] Fetch error:', e.message);
                                }
                            }

                            // 날짜순 정렬
                            result.sort((a, b) => new Date(b.date) - new Date(a.date));

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(result));
                        } catch (e) {
                            console.error('Discussion API Error:', e);
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });
                    server.middlewares.use('/api/dataroma', async (req, res, next) => {
                        try {
                            const cheerio = await import('cheerio');
                            const fetch = (await import('node-fetch')).default || global.fetch;

                            const TARGET_URL = 'https://www.dataroma.com/m/g/portfolio.php?o=c';
                            console.log(`[Vite Dev] Fetching Dataroma: ${TARGET_URL}`);

                            const apiResponse = await fetch(TARGET_URL);
                            if (!apiResponse.ok) throw new Error(apiResponse.statusText);

                            const html = await apiResponse.text();
                            const $ = cheerio.load(html);
                            const stocks = [];

                            $('#grid tbody tr').each((i, el) => {
                                const tds = $(el).find('td');
                                if (tds.length < 4) return;

                                const ticker = $(tds[0]).text().trim();
                                const name = $(tds[1]).text().trim();
                                const count = parseInt($(tds[3]).text().trim(), 10);

                                if (ticker && !isNaN(count) && count >= 5) {
                                    stocks.push({ ticker, name, count });
                                }
                            });

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ stocks }));
                        } catch (e) {
                            console.error(e);
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });

                    server.middlewares.use('/api/sp500', async (req, res, next) => {
                        try {
                            const cheerio = await import('cheerio');
                            const fetch = (await import('node-fetch')).default || global.fetch;

                            const TARGET_URL = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';
                            console.log(`[Vite Dev] Fetching S&P 500 from Wikipedia: ${TARGET_URL}`);

                            const apiResponse = await fetch(TARGET_URL);
                            if (!apiResponse.ok) throw new Error(apiResponse.statusText);

                            const html = await apiResponse.text();
                            const $ = cheerio.load(html);
                            const stocks = [];

                            // Wikipedia table id="constituents"
                            $('#constituents tbody tr').each((i, el) => {
                                const tds = $(el).find('td');
                                if (tds.length === 0) return;

                                // 1st column: Symbol, 2nd column: Security (Name), 3rd: GICS Sector
                                let ticker = $(tds[0]).text().trim();
                                const name = $(tds[1]).text().trim();
                                const sector = $(tds[3]).text().trim(); // 4th column is Sector usually? Let's verify. 
                                // Wikipedia columns: Symbol, Security, GICS Sector, GICS Sub-Industry...
                                // So Sector is index 2 (3rd column).
                                const actualSector = $(tds[2]).text().trim();

                                // Fix ticker format (BF.B -> BF-B for Yahoo)
                                // Wikipedia uses dot, Yahoo uses hyphen.
                                // But usually Wikipedia links might have text. .text() gets it.

                                // Handle \n or extra spaces
                                ticker = ticker.replace(/\n/g, '').trim();

                                if (ticker) {
                                    stocks.push({
                                        ticker: ticker.replace(/\./g, '-'), // Exchange compatibility
                                        name,
                                        count: actualSector,
                                        exchange: 'NYS/NAS'
                                    });
                                }
                            });

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(stocks));
                        } catch (e) {
                            console.error(e);
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });

                    // Nasdaq 100 Wikipedia Scraper
                    server.middlewares.use('/api/qqq', async (req, res, next) => {
                        try {
                            const cheerio = await import('cheerio');
                            const fetch = (await import('node-fetch')).default || global.fetch;

                            const TARGET_URL = 'https://en.wikipedia.org/wiki/Nasdaq-100';
                            console.log(`[Vite Dev] Fetching Nasdaq 100 from Wikipedia: ${TARGET_URL}`);

                            const apiResponse = await fetch(TARGET_URL);
                            if (!apiResponse.ok) throw new Error(apiResponse.statusText);

                            const html = await apiResponse.text();
                            const $ = cheerio.load(html);
                            const stocks = [];

                            // Wikipedia table id="constituents"
                            $('#constituents tbody tr').each((i, el) => {
                                const tds = $(el).find('td');
                                if (tds.length === 0) return;

                                // For Nasdaq 100: Company (0), Ticker (1) -> Adjusted to Ticker(0), Company(1) based on user report
                                let ticker = $(tds[0]).text().trim();
                                let name = $(tds[1]).text().trim();
                                let sector = $(tds[2]).text().trim();

                                // Clean up
                                ticker = ticker.replace(/\n/g, '').trim();

                                if (ticker) {
                                    stocks.push({
                                        ticker: ticker.replace(/\./g, '-'),
                                        name,
                                        count: sector,
                                        exchange: 'NAS'
                                    });
                                }
                            });

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(stocks));
                        } catch (e) {
                            console.error(e);
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });


                    // Hugging Face Proxy (Local Dev)
                    server.middlewares.use('/api/hf', async (req, res, next) => {
                        if (req.method !== 'POST') {
                            res.statusCode = 405;
                            res.end();
                            return;
                        }
                        try {
                            const buffers = [];
                            for await (const chunk of req) {
                                buffers.push(chunk);
                            }
                            const bodyStr = Buffer.concat(buffers).toString();
                            if (!bodyStr) {
                                res.statusCode = 400;
                                res.end(JSON.stringify({ error: 'Body required' }));
                                return;
                            }
                            const body = JSON.parse(bodyStr);
                            const { inputs, model = "ProsusAI/finbert" } = body;

                            const token = env.VITE_HF_TOKEN || env.HF_TOKEN;

                            const fetch = (await import('node-fetch')).default || global.fetch;
                            const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                },
                                body: JSON.stringify({ inputs })
                            });

                            res.statusCode = response.status;
                            res.setHeader('Content-Type', 'application/json');
                            const respBody = await response.text();
                            res.end(respBody);
                        } catch (e) {
                            console.error('HF Proxy Error:', e);
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });

                    // Company Profile Scraper (Yahoo + Wikipedia)
                    server.middlewares.use('/api/company-profile', async (req, res, next) => {
                        try {
                            const urlObj = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
                            const ticker = urlObj.searchParams.get('ticker');

                            if (!ticker) {
                                res.statusCode = 400;
                                res.end(JSON.stringify({ error: 'Ticker required' }));
                                return;
                            }

                            const cheerio = await import('cheerio');
                            const fetch = (await import('node-fetch')).default || global.fetch;

                            // Step 1: Yahoo Finance에서 회사 이름 가져오기
                            const yahooUrl = `https://finance.yahoo.com/quote/${ticker}`;
                            console.log(`[Company Profile] Fetching company name from Yahoo: ${yahooUrl}`);

                            const yahooResponse = await fetch(yahooUrl, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                }
                            });

                            let companyName = ticker;

                            if (yahooResponse.ok) {
                                const yahooHtml = await yahooResponse.text();
                                const $yahoo = cheerio.load(yahooHtml);

                                // 페이지 타이틀에서 회사명 추출
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
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({
                                    assetProfile: {
                                        longBusinessSummary: `${companyName} (${ticker})에 대한 Wikipedia 정보를 찾을 수 없습니다.`,
                                        sector: '-',
                                        industry: '-',
                                        website: '',
                                        country: 'US',
                                        companyOfficers: []
                                    }
                                }));
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
                            });

                            // 참조 표시 제거
                            summary = summary.replace(/\[\d+\]/g, '').trim();

                            const data = {
                                assetProfile: {
                                    longBusinessSummary: summary || `${companyName} (${ticker})에 대한 정보입니다.`,
                                    sector: '-',
                                    industry: industry || '-',
                                    products: products || '-',
                                    services: services || '-',
                                    founded: founded || '-',
                                    headquarters: headquarters || '-',
                                    website: website,
                                    country: 'US',
                                    companyOfficers: []
                                }
                            };

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(data));
                        } catch (e) {
                            console.error('Profile Scrape Error:', e);
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });

                    // Company Quote Scraper (Bypass Yahoo API Crumb for Key Stats)
                    server.middlewares.use('/api/company-quote', async (req, res, next) => {
                        try {
                            const urlObj = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
                            const ticker = urlObj.searchParams.get('ticker');

                            if (!ticker) {
                                res.statusCode = 400;
                                res.end(JSON.stringify({ error: 'Ticker required' }));
                                return;
                            }

                            const cheerio = await import('cheerio');
                            const fetch = (await import('node-fetch')).default || global.fetch;

                            const TARGET_URL = `https://finance.yahoo.com/quote/${ticker}`;
                            console.log(`[Vite Dev] Scraping Quote: ${TARGET_URL}`);
                            const response = await fetch(TARGET_URL, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                                }
                            });

                            if (!response.ok) throw new Error('Failed to fetch quote page');

                            const html = await response.text();
                            const $ = cheerio.load(html);

                            const getValue = (label) => {
                                // Yahoo Summary Page uses List Items <li>
                                // <li class="..."><span class="...">Label</span> <span class="...">Value</span></li>
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

                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(quote));
                        } catch (e) {
                            console.error('Quote Scrape Error:', e);
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });
                }
            }
        ],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        server: {
            proxy: {
                '/api/yahoo': {
                    target: 'https://query2.finance.yahoo.com',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
                    configure: (proxy, _options) => {
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                            proxyReq.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8');
                            proxyReq.setHeader('Origin', 'https://finance.yahoo.com');
                            proxyReq.setHeader('Referer', 'https://finance.yahoo.com/');
                        });
                    },
                },
                '/api/kis': {
                    target: 'https://openapi.koreainvestment.com:9443',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/kis/, ''),
                },
                '/api/naver': {
                    target: 'https://m.stock.naver.com',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/naver/, '/front-api'),
                },
                '/api/stocktwits': {
                    target: 'https://api.stocktwits.com/api/2',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/stocktwits/, ''),
                    configure: (proxy, _options) => {
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                            proxyReq.setHeader('Referer', 'https://stocktwits.com/');
                        });
                    },
                },
                '/api/reddit': {
                    target: 'https://www.reddit.com',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/reddit/, ''),
                    configure: (proxy, _options) => {
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                        });
                    },
                },
                '/api/nasdaq': {
                    target: 'https://api.nasdaq.com',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/nasdaq/, '/api'),
                    configure: (proxy, _options) => {
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                            proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
                            proxyReq.setHeader('Accept-Language', 'en-US,en;q=0.9');
                            proxyReq.setHeader('Origin', 'https://www.nasdaq.com');
                            proxyReq.setHeader('Referer', 'https://www.nasdaq.com/');
                        });
                    },
                },
                '/api/forecast': {
                    target: 'https://younginpiniti-bitcoin-ai-backend.hf.space',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/forecast/, '/v1/forecast'),
                    configure: (proxy, _options) => {
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            proxyReq.setHeader('User-Agent', 'Motia/1.0');
                        });
                    },
                },
                '/api/whale': {
                    target: 'https://younginpiniti-bitcoin-ai-backend.hf.space',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/whale/, '/v1/whale'),
                    configure: (proxy, _options) => {
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            proxyReq.setHeader('User-Agent', 'Motia/1.0');
                        });
                    },
                },
                '/api/yahoo-conversation': {
                    target: 'https://api-v2.spot.im',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/yahoo-conversation/, ''),
                    configure: (proxy, _options) => {
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                            proxyReq.setHeader('Origin', 'https://finance.yahoo.com');
                        });
                    },
                },
                '/api/company-profile': {
                    target: 'http://localhost:5173', // Self-target for middleware intercept
                    changeOrigin: true,
                    bypass: (req, res) => {
                        // This block mimics the middleware logic but inside proxy config?
                        // No, putting it in 'server.middlewares' is better as done in the instruction.
                        // But I can't edit `server.middlewares` easily with ReplaceFileContent if it's far away.
                        // I'll stick to inserting into `server.middlewares` inside the `configureServer` block.
                    }
                }
            },
        },
    }
})
