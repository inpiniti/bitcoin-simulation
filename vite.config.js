import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

process.title = 'My-Vite-App';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [
            react(),
            {
                name: 'configure-server',
                configureServer(server) {
                    // Cron API 미들웨어 (Serverless Functions Simulation)
                    server.middlewares.use('/api/cron', async (req, res, next) => {
                        try {
                            const urlObj = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
                            const pathName = urlObj.pathname.split('/api/cron/')[1]; // 'start', 'originData', etc.

                            // [path].js 파일이 처리할 path 파라미터가 없으면 next() (다른 미들웨어나 프록시가 처리할 수도 있음)
                            if (!pathName) {
                                return next();
                            }

                            console.log(`[Cron Middleware] Processing: ${pathName}`);

                            // Global Fetch Polyfill (for Node environment compatibility)
                            if (!global.fetch) {
                                try {
                                    const nodeFetch = await import('node-fetch');
                                    global.fetch = nodeFetch.default;
                                    global.Headers = nodeFetch.Headers;
                                    global.Request = nodeFetch.Request;
                                    global.Response = nodeFetch.Response;
                                } catch (e) {
                                    console.warn('[Cron Middleware] node-fetch not found, global.fetch might be missing.');
                                }
                            }

                            // Vercel Serverless Function 환경 흉내 (req.query, req.body, res.status, res.json)
                            req.query = Object.fromEntries(urlObj.searchParams.entries());
                            req.query.path = pathName; // 핵심: path 파라미터 주입

                            // res 헬퍼 함수 추가
                            res.status = (code) => {
                                res.statusCode = code;
                                return res;
                            };
                            res.json = (data) => {
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify(data));
                                return res;
                            };

                            // Body Parsing
                            if (req.method === 'POST') {
                                const buffers = [];
                                for await (const chunk of req) {
                                    buffers.push(chunk);
                                }
                                const bodyStr = Buffer.concat(buffers).toString();
                                try {
                                    req.body = JSON.parse(bodyStr);
                                } catch (e) {
                                    req.body = {};
                                }
                            } else {
                                req.body = {};
                            }

                            // 환경변수 주입 (Module Import 시점의 process.env 확보)
                            Object.assign(process.env, env);

                            // 핸들러 동적 임포트 및 실행
                            const handlerModule = await import('./api/cron/[path].js');
                            const handler = handlerModule.default;

                            await handler(req, res);

                        } catch (e) {
                            console.error('[Cron Middleware Error]', e);
                            if (!res.headersSent) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ error: e.message, stack: e.stack }));
                            }
                        }
                    });

                    // DataSet & TradingView API 미들웨어 (로컬 개발용)
                    const datasetServices = ['insertdataset', 'selectdataset', 'updatedataset', 'tradingview'];
                    for (const svc of datasetServices) {
                        server.middlewares.use(`/api/simple/${svc}`, async (req, res, next) => {
                            try {
                                const urlObj = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
                                console.log(`[Simple/${svc} Middleware] ${req.method} ${urlObj.pathname}`);

                                if (!global.fetch) {
                                    try {
                                        const nodeFetch = await import('node-fetch');
                                        global.fetch = nodeFetch.default;
                                    } catch (e) { /* ignore */ }
                                }

                                // Vercel Serverless Function 환경 흉내
                                req.query = Object.fromEntries(urlObj.searchParams.entries());
                                req.query.path = svc;

                                res.status = (code) => { res.statusCode = code; return res; };
                                res.json = (data) => {
                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(JSON.stringify(data));
                                    return res;
                                };

                                if (req.method === 'POST') {
                                    const buffers = [];
                                    for await (const chunk of req) { buffers.push(chunk); }
                                    const bodyStr = Buffer.concat(buffers).toString();
                                    try { req.body = JSON.parse(bodyStr); } catch { req.body = {}; }
                                } else {
                                    req.body = {};
                                }

                                Object.assign(process.env, env);

                                const handlerModule = await import('./api/simple/[path].js');
                                await handlerModule.default(req, res);
                            } catch (e) {
                                console.error(`[Simple/${svc} Middleware Error]`, e);
                                if (!res.headersSent) {
                                    res.statusCode = 500;
                                    res.end(JSON.stringify({ error: e.message }));
                                }
                            }
                        });
                    }

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
                    // NYSE 시장 휴장일
                    server.middlewares.use('/api/market-holidays', async (req, res) => {
                        try {
                            const { default: handler } = await import('./api/market-holidays.js');
                            await handler(req, res);
                        } catch (e) {
                            console.error('[market-holidays middleware]', e);
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

                            // 타임아웃이 포함된 fetch (node-fetch는 timeout 옵션을 지원함)
                            const apiResponse = await fetch(TARGET_URL, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                                    'Referer': 'https://www.dataroma.com/',
                                    'Connection': 'keep-alive',
                                    'Upgrade-Insecure-Requests': '1',
                                    'Sec-Fetch-Dest': 'document',
                                    'Sec-Fetch-Mode': 'navigate',
                                    'Sec-Fetch-Site': 'none',
                                    'Sec-Fetch-User': '?1',
                                    'Cache-Control': 'max-age=0'
                                },
                                timeout: 15000 // 15초 타임아웃 설정
                            });
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

                    // 지수 종목 리스트 (S&P 500, QQQ, KOSPI 200, US All) 통합 미들웨어
                    server.middlewares.use('/api/index-stocks', async (req, res, next) => {
                        try {
                            const urlObj = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
                            const index = urlObj.pathname.split('/').pop();
                            const cheerio = await import('cheerio');
                            const fetch = (await import('node-fetch')).default || global.fetch;

                            // usall: Nasdaq Trader 공개 FTP 파일에서 미국 전체 종목 조회
                            // (api.nasdaq.com은 Cloudflare 봇 방어로 차단되므로 nasdaqtrader.com 사용)
                            if (index === 'usall') {
                                console.log('[Vite Dev] Fetching US All stocks from Nasdaq Trader FTP files...');

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
                                    const lines = text.split('\n').slice(1); // 헤더 제거
                                    lines.forEach(line => {
                                        const cols = line.split('|');
                                        if (cols.length < 7) return;
                                        const ticker = cols[0].trim();
                                        const name = cols[1].trim();
                                        const testIssue = cols[3].trim();
                                        const etf = cols[6].trim();
                                        // 테스트 종목과 ETF 제외, 유효한 티커만
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
                                    const lines = text.split('\n').slice(1); // 헤더 제거
                                    lines.forEach(line => {
                                        const cols = line.split('|');
                                        if (cols.length < 7) return;
                                        const ticker = cols[0].trim();
                                        const name = cols[1].trim();
                                        const exchangeCode = cols[2].trim(); // N=NYSE, A=AMEX, P=Arca, Z=BATS
                                        const etf = cols[4].trim();
                                        const testIssue = cols[6].trim();
                                        // 테스트 종목과 ETF 제외, NYSE/AMEX만
                                        if (ticker && testIssue !== 'Y' && etf !== 'Y' && !ticker.includes('File Creation Time') && ticker.length <= 5) {
                                            const exchange = exchangeCode === 'N' ? 'NYS' : exchangeCode === 'A' ? 'AMS' : 'NYS';
                                            allStocks.push({ ticker, name, count: exchangeCode === 'N' ? 'NYSE' : 'AMEX', exchange });
                                        }
                                    });
                                    console.log(`[usall] NYSE/AMEX stocks: ${allStocks.length - nyseStartCount}`);
                                }

                                console.log(`[usall] Total US stocks: ${allStocks.length}`);
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify(allStocks));
                                return;
                            }

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
                                        ticker = ticker.replace(/\n/g, '').trim();
                                        if (ticker) stocks.push({ ticker: ticker.replace(/\./g, '-'), name, count: actualSector, exchange: 'NYS/NAS' });
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
                                        ticker = ticker.replace(/\n/g, '').trim();
                                        if (ticker) stocks.push({ ticker: ticker.replace(/\./g, '-'), name, count: sector, exchange: 'NAS' });
                                    });
                                    return stocks;
                                };
                            } else if (index === 'kospi200') {
                                targetUrl = 'https://ko.wikipedia.org/wiki/%EC%BD%94%EC%8A%A4%ED%94%BC_200';
                                parser = ($) => {
                                    const stocks = [];
                                    const table = $('table.wikitable').filter((i, el) => $(el).text().includes('삼성전자')).first();
                                    table.find('tbody tr').each((i, el) => {
                                        const tds = $(el).find('td');
                                        if (tds.length < 2) return;
                                        const name = $(tds[0]).text().trim();
                                        let ticker = $(tds[1]).text().trim();
                                        const sector = $(tds[2]).text().trim();
                                        ticker = ticker.replace(/\n/g, '').trim();
                                        if (ticker && /^\d{6}$/.test(ticker)) {
                                            stocks.push({ ticker, name, count: sector, exchange: 'KOSPI' });
                                        }
                                    });
                                    return stocks;
                                };
                            }

                            if (!targetUrl) return next();

                            const apiResponse = await fetch(targetUrl);
                            const html = await apiResponse.text();
                            const $ = cheerio.load(html);
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(parser($)));
                        } catch (e) {
                            console.error(e);
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });


                    // Gemini API Proxy (Local Dev)
                    server.middlewares.use('/api/gemini', async (req, res, next) => {
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
                        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

                        if (req.method === 'OPTIONS') {
                            res.statusCode = 200;
                            res.end();
                            return;
                        }

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
                            const body = JSON.parse(bodyStr);

                            const apiKey = env.VITE_GEMINI_API_KEY;
                            console.log('[Gemini Proxy] Request received, API Key exists:', !!apiKey);

                            if (!apiKey) {
                                console.error('[Gemini Proxy] API Key is missing in env');
                                res.statusCode = 500;
                                res.end(JSON.stringify({ error: 'Gemini API Key missing' }));
                                return;
                            }

                            const model = body.model || "gemini-3-flash-preview";
                            const fetch = (await import('node-fetch')).default || global.fetch;

                            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: body.contents,
                                    generationConfig: body.generationConfig || {
                                        temperature: 0.7,
                                        topK: 40,
                                        topP: 0.95,
                                        maxOutputTokens: 1024,
                                    }
                                })
                            });

                            if (!response.ok) {
                                const errorText = await response.text();
                                console.error(`[Gemini Proxy] API Error (${response.status}):`, errorText);
                                res.statusCode = response.status;
                                res.setHeader('Content-Type', 'application/json');
                                res.end(errorText);
                                return;
                            }

                            const data = await response.json();
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(data));
                        } catch (e) {
                            console.error('Gemini Proxy Error:', e);
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });

                    // Hugging Face Proxy (Local Dev)
                    server.middlewares.use('/api/hf', async (req, res, next) => {
                        // CORS 및 OPTIONS 처리
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
                        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

                        if (req.method === 'OPTIONS') {
                            res.statusCode = 200;
                            res.end();
                            return;
                        }

                        // GET 요청 시 헬스체크
                        if (req.method === 'GET') {
                            res.statusCode = 200;
                            res.end(JSON.stringify({ status: 'ok', message: 'HF Proxy (Dev) is running' }));
                            return;
                        }

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
                            const { inputs, model = "ProsusAI/finbert", options = {} } = body;

                            const token = env.VITE_HF_TOKEN || env.HF_TOKEN;
                            const fetch = (await import('node-fetch')).default || global.fetch;

                            const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                },
                                body: JSON.stringify({
                                    inputs: inputs || "ping",
                                    options: {
                                        wait_for_model: true,
                                        ...options
                                    }
                                })
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

                    // 회사 정보 통합 미들웨어
                    server.middlewares.use('/api/company', async (req, res, next) => {
                        try {
                            const urlObj = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
                            const segments = urlObj.pathname.split('/');
                            const type = segments.pop();
                            const ticker = urlObj.searchParams.get('ticker');

                            if (!ticker) {
                                res.statusCode = 400;
                                res.end(JSON.stringify({ error: 'Ticker required' }));
                                return;
                            }

                            const cheerio = await import('cheerio');
                            const fetch = (await import('node-fetch')).default || global.fetch;

                            if (type === 'profile') {
                                const yahooUrl = `https://finance.yahoo.com/quote/${ticker}`;
                                const yahooResponse = await fetch(yahooUrl, {
                                    headers: { 'User-Agent': 'Mozilla/5.0' }
                                });
                                let companyName = ticker;
                                if (yahooResponse.ok) {
                                    const $yahoo = cheerio.load(await yahooResponse.text());
                                    const titleMatch = $yahoo('title').text().match(/^(.+?)\s*\(/);
                                    if (titleMatch) companyName = titleMatch[1].trim();
                                }
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ assetProfile: { longBusinessSummary: `${companyName} 정보`, country: 'US' } }));
                            } else if (type === 'quote') {
                                const response = await fetch(`https://finance.yahoo.com/quote/${ticker}`, {
                                    headers: { 'User-Agent': 'Mozilla/5.0' }
                                });
                                const $ = cheerio.load(await response.text());
                                const price = $('fin-streamer[data-field="regularMarketPrice"]').text().trim() ||
                                    $('span[data-testid="qsp-price"]').text().trim();
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ regularMarketPrice: price }));
                            } else {
                                next();
                            }
                        } catch (e) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });

                    // XGBoost API 미들웨어 (E2BIG 에러 방지를 위해 프록시 대신 미들웨어 사용)
                    server.middlewares.use('/api/xgb', async (req, res, next) => {
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
                        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

                        if (req.method === 'OPTIONS') {
                            res.statusCode = 200;
                            res.end();
                            return;
                        }

                        if (req.method !== 'POST') {
                            res.statusCode = 405;
                            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
                            return;
                        }

                        try {
                            // 요청 본문을 스트림으로 수집
                            const buffers = [];
                            for await (const chunk of req) {
                                buffers.push(chunk);
                            }
                            const bodyStr = Buffer.concat(buffers).toString();
                            const body = JSON.parse(bodyStr);

                            // 경로 추출 (예: /api/xgb/train -> /v1/xgb/train)
                            const urlObj = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
                            const subPath = urlObj.pathname.replace(/^\/api\/xgb/, '');
                            const targetUrl = `${process.env.BACKEND_URL || 'https://younginpiniti-bitcoin-ai-backend.hf.space'}/v1/xgb${subPath}`;

                            console.log('[XGB Middleware] Forwarding to:', targetUrl);
                            console.log('[XGB Middleware] Body size:', bodyStr.length, 'bytes');

                            const fetch = (await import('node-fetch')).default || global.fetch;
                            const apiResponse = await fetch(targetUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'User-Agent': 'Motia/1.0'
                                },
                                body: bodyStr
                            });

                            const responseText = await apiResponse.text();
                            console.log('[XGB Middleware] Response status:', apiResponse.status);

                            res.statusCode = apiResponse.status;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(responseText);
                        } catch (e) {
                            console.error('[XGB Middleware] Error:', e);
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: 'Failed to spawn process: ' + e.message }));
                        }
                    });

                    // Gemini AI 스트리밍 미들웨어 (Direct SSE + 모델 폴백)
                    // configureServer 미들웨어는 proxy보다 먼저 실행됩니다.
                    server.middlewares.use('/api/simple/gemini', async (req, res) => {
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
                        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

                        if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }
                        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }

                        try {
                            const buffers = [];
                            for await (const chunk of req) buffers.push(chunk);
                            const body = JSON.parse(Buffer.concat(buffers).toString());

                            // 콤마 구분으로 여러 키 지원
                            const rawKey = env.VITE_GEMINI_API_KEY || '';
                            const apiKeys = rawKey.split(',').map(k => k.trim()).filter(Boolean);
                            if (apiKeys.length === 0) {
                                res.statusCode = 500;
                                res.end(JSON.stringify({ error: 'Gemini API Key missing' }));
                                return;
                            }

                            const fetch = (await import('node-fetch')).default || global.fetch;
                            const contents = body.contents || [];
                            const genConfig = { maxOutputTokens: 2048, temperature: 0.7 };

                            const models = [
                                'gemini-flash-lite-latest',
                                'gemini-flash-latest',
                                'gemini-3.1-flash-lite-preview',
                                'gemini-3-flash-preview',
                                'gemini-3.1-pro-preview',
                            ];

                            // 랜덤 키부터 시작 (키 로테이션)
                            const startIdx = Math.floor(Math.random() * apiKeys.length);
                            const orderedKeys = [
                                ...apiKeys.slice(startIdx),
                                ...apiKeys.slice(0, startIdx),
                            ];

                            let streamed = false;
                            outer: for (const apiKey of orderedKeys) {
                                for (const model of models) {
                                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
                                    const apiResponse = await fetch(url, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ contents, generationConfig: genConfig }),
                                    });

                                    if (!apiResponse.ok) {
                                        const status = apiResponse.status;
                                        console.log(`[Gemini] key[...${apiKey.slice(-6)}] ${model} → ${status}`);
                                        if (status === 429 || status === 403) break; // 다음 키로
                                        continue; // 다음 모델로
                                    }

                                    console.log(`[Gemini] OK key[...${apiKey.slice(-6)}] model: ${model}`);
                                    res.statusCode = 200;
                                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

                                    let buf = '';
                                    for await (const chunk of apiResponse.body) {
                                        buf += chunk.toString();
                                        const lines = buf.split('\n');
                                        buf = lines.pop() || '';
                                        for (const line of lines) {
                                            if (!line.startsWith('data: ')) continue;
                                            const raw = line.slice(6).trim();
                                            if (!raw || raw === '[DONE]') continue;
                                            try {
                                                const json = JSON.parse(raw);
                                                const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                                                if (text) res.write(text);
                                            } catch { /* skip malformed */ }
                                        }
                                    }
                                    res.end();
                                    streamed = true;
                                    break outer;
                                }
                            }

                            if (!streamed) {
                                res.statusCode = 503;
                                res.end('Gemini API 할당량 초과 또는 사용 가능한 모델 없음. 잠시 후 다시 시도해주세요.');
                            }
                        } catch (e) {
                            console.error('[Gemini Stream Error]', e);
                            if (!res.headersSent) {
                                res.statusCode = 500;
                                res.end(e.message);
                            }
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
                '/api/simple/forecast': {
                    target: process.env.BACKEND_URL || 'https://younginpiniti-bitcoin-ai-backend.hf.space',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/simple\/forecast/, '/v1/forecast'),
                    configure: (proxy, _options) => {
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            proxyReq.setHeader('User-Agent', 'Motia/1.0');
                        });
                    },
                },
                '/api/simple/dataroma': {
                    target: 'https://www.dataroma.com',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/simple\/dataroma/, '/m/g/portfolio.php?o=c'),
                },
                '/api/simple/discussion': {
                    target: 'http://localhost:5173', // Placeholder or use actual logic
                },
                // '/api/simple/gemini' → configureServer 미들웨어에서 스트리밍 처리 (Vercel AI SDK)
                '/api/simple/hf': {
                    target: 'https://router.huggingface.co',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/simple\/hf/, '/hf-inference/models/ProsusAI/finbert'),
                },
                '/api/simple/whale': {
                    target: process.env.BACKEND_URL || 'https://younginpiniti-bitcoin-ai-backend.hf.space',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/simple\/whale/, '/v1/whale'),
                    configure: (proxy, _options) => {
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            proxyReq.setHeader('User-Agent', 'Motia/1.0');
                        });
                    },
                },
                // '/api/xgb'는 위 configureServer 미들웨어에서 처리 (E2BIG 에러 방지)
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
