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
                    secure: false, // 자체 서명된 인증서 허용 (프록시/방화벽 SSL 인터셉션 우회)
                    rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
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

            },
        },
    }
})
