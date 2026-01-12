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
                    target: 'https://query1.finance.yahoo.com',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
                    configure: (proxy, _options) => {
                        proxy.on('proxyReq', (proxyReq, req, _res) => {
                            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                            proxyReq.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8');
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
