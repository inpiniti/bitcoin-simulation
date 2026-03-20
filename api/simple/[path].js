/**
 * 패스 없는 단일 엔드포인트 API 통합 핸들러
 * 
 * /api/simple/dataroma → DataRoma 스크래핑
 * /api/simple/forecast → HF Forecast 프록시
 * /api/simple/gemini → Gemini AI 프록시
 * /api/simple/hf → Hugging Face 프록시
 * /api/simple/whale → HF Whale 프록시
 * /api/simple/cron → 크론 작업 (티커 그룹 로딩)
 * /api/simple/send → 이메일 발송
 * /api/simple/discussion → 종목 토론 통합 조회
 */

import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req, res) {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PATCH,DELETE,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token, x-requested-with, accept, accept-version, content-length, content-md5, date, x-api-version, appkey, appsecret, tr_id, custtype');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // URL에서 서비스명 추출 (Vercel rewrite 및 직접 호출 대응)
    const allowedServices = ['dataroma', 'forecast', 'gemini', 'hf', 'whale', 'cron', 'discussion', 'insertdataset', 'selectdataset', 'tradingview', 'reschedule'];
    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.toLowerCase().split('/').filter(Boolean);

    // 1. query.path 우선 (Vercel dynamic route)
    // 2. 경로 목록 중 허용된 서비스가 있는지 확인
    // 3. 마지막 세그먼트 (fallback)
    const service = (req.query.path?.toLowerCase()) ||
        parts.find(p => allowedServices.includes(p)) ||
        parts[parts.length - 1];

    console.log(`[Simple API] Service: ${service}, Method: ${req.method}, Path: ${url.pathname}`);

    try {
        switch (service) {
            case 'dataroma':
                return await handleDataroma(req, res);
            case 'forecast':
                return await handleForecast(req, res);
            case 'gemini':
                return await handleGemini(req, res);
            case 'hf':
                return await handleHf(req, res);
            case 'whale':
                return await handleWhale(req, res);
            case 'cron':
                return await handleCron(req, res);
            case 'discussion':
                return await handleDiscussion(req, res);
            case 'insertdataset':
                return await handleInsertDataSet(req, res);
            case 'selectdataset':
                return await handleSelectDataSet(req, res);
            case 'tradingview':
                return await handleTradingView(req, res);
            case 'reschedule':
                return await handleReschedule(req, res);

            default:
                return res.status(404).json({ error: `Unknown service: ${service}` });
        }
    } catch (error) {
        console.error(`[Simple API Error] ${service}:`, error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}

// ==================== DataRoma ====================
async function handleDataroma(req, res) {
    const TARGET_URL = 'https://www.dataroma.com/m/g/portfolio.php?o=c';
    const apiResponse = await fetch(TARGET_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.dataroma.com/',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        },
        timeout: 20000
    });

    if (!apiResponse.ok) {
        throw new Error(`Failed to fetch dataroma: ${apiResponse.statusText}`);
    }

    const html = await apiResponse.text();
    const $ = cheerio.load(html);
    const stocks = [];

    const table = $('#grid');
    if (!table.length) {
        throw new Error('Table #grid not found in Dataroma page');
    }

    table.find('tbody tr').each((i, el) => {
        const tds = $(el).find('td');
        if (tds.length < 4) return;
        const ticker = $(tds[0]).text().trim();
        const name = $(tds[1]).text().trim();
        const countText = $(tds[3]).text().trim();
        const count = parseInt(countText, 10);

        if (ticker && !isNaN(count)) {
            if (count >= 5) {
                stocks.push({ ticker, name, count });
            }
        }
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ stocks });
}

// ==================== Forecast (HF Backend) ====================
async function handleForecast(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const { symbol, interval = 'day' } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    const targetUrl = `${process.env.BACKEND_URL || 'https://younginpiniti-bitcoin-ai-backend.hf.space'}/v1/forecast`;
    const apiResponse = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Motia/1.0" },
        body: JSON.stringify({ symbol, interval }),
    });

    if (!apiResponse.ok) return res.status(apiResponse.status).send(await apiResponse.text());
    return res.status(200).json(await apiResponse.json());
}

// ==================== Gemini AI (Direct SSE Streaming + 모델 폴백) ====================
async function handleGemini(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini API Key missing' });

    const contents = req.body?.contents || [];
    const genConfig = { maxOutputTokens: 2048, temperature: 0.7 };

    const models = [
        'gemini-flash-lite-latest',
        'gemini-flash-latest',
        'gemini-3.1-flash-lite-preview',
        'gemini-3-flash-preview',
        'gemini-3.1-pro-preview',
    ];

    let streamed = false;
    for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents, generationConfig: genConfig }),
        });

        if (!apiResponse.ok) {
            console.log(`[Gemini] ${model} → ${apiResponse.status}, trying next...`);
            continue;
        }

        console.log(`[Gemini] Streaming with model: ${model}`);
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
        break;
    }

    if (!streamed) {
        res.statusCode = 503;
        res.end('Gemini API 할당량 초과 또는 사용 가능한 모델 없음.');
    }
}

// ==================== Hugging Face ====================
async function handleHf(req, res) {
    if (req.method === 'GET') return res.status(200).json({ status: 'ok', message: 'HF Proxy is running' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const hfToken = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN;
    const { inputs, model = "ProsusAI/finbert", options = {} } = req.body;
    if (!inputs && !options.wait_for_model) return res.status(400).json({ error: 'Inputs are required' });

    const targetUrl = `https://router.huggingface.co/hf-inference/models/${model}`;
    const headers = { "Content-Type": "application/json" };
    if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

    const apiResponse = await fetch(targetUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ inputs: inputs || "ping", options: { wait_for_model: true, ...options } }),
    });

    if (apiResponse.status === 503) return res.status(503).json(await apiResponse.json());
    if (!apiResponse.ok) return res.status(apiResponse.status).send(await apiResponse.text());
    return res.status(200).json(await apiResponse.json());
}

// ==================== Whale (HF Backend) ====================
async function handleWhale(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const { symbol, interval = 'day' } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    const targetUrl = `${process.env.BACKEND_URL || 'https://younginpiniti-bitcoin-ai-backend.hf.space'}/v1/whale`;
    const apiResponse = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Motia/1.0" },
        body: JSON.stringify({ symbol, interval }),
    });

    if (!apiResponse.ok) return res.status(apiResponse.status).send(await apiResponse.text());
    return res.status(200).json(await apiResponse.json());
}

// ==================== Cron (티커 그룹 로딩) ====================
async function handleCron(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const group = url.searchParams.get('group') || req.query?.group;
    if (!group) return res.status(400).json({ error: 'Group key is required' });

    // 티커 그룹 데이터
    const groupTickers = {
        indices: [
            { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
            { ticker: 'QQQ', name: 'Invesco QQQ Trust' },
            { ticker: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF Trust' },
            { ticker: 'IWM', name: 'iShares Russell 2000 ETF' },
        ]
    };
    return res.status(200).json(groupTickers[group] || []);
}

// ==================== Discussion (통합 종목 토론) ====================
async function handleDiscussion(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ticker = url.searchParams.get('ticker') || req.query?.ticker;
    const source = url.searchParams.get('source') || req.query?.source || 'all';

    if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

    const results = [];
    const fetchPromises = [];

    if (source === 'naver' || source === 'all') fetchPromises.push(fetchNaver(ticker));
    if (source === 'stocktwits' || source === 'all') fetchPromises.push(fetchStocktwits(ticker));
    if (source === 'toss' || source === 'all') fetchPromises.push(fetchToss(ticker));

    const settledResults = await Promise.allSettled(fetchPromises);
    settledResults.forEach(r => { if (r.status === 'fulfilled') results.push(...r.value); });

    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.status(200).json(results);
}

async function fetchNaver(ticker) {
    try {
        const url = `https://m.stock.naver.com/front-api/discussion/list?discussionType=foreignStock&itemCode=${ticker.toUpperCase()}.O&pageSize=50`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://m.stock.naver.com/' } });
        const json = await res.json();
        return (json.result?.posts || []).map(p => ({
            source: 'Naver', id: p.discussionId, user: p.writer?.nickname || 'Anonymous',
            text: (p.contents || '').replace(/<br\s*\/?>/gi, '\n'), date: p.writtenAt
        }));
    } catch { return []; }
}

async function fetchStocktwits(ticker) {
    try {
        const res = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${ticker.toUpperCase()}.json`);
        const json = await res.json();
        return (json.messages || []).map(m => ({
            source: 'Stocktwits', id: m.id, user: m.user?.username || 'Anonymous', text: m.body, date: m.created_at
        }));
    } catch { return []; }
}

async function fetchToss(ticker) {
    // Toss logic simplified for brevity but kept functional
    try {
        const searchRes = await fetch('https://wts-cert-api.tossinvest.com/api/v3/search-all/wts-auto-complete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: ticker.toUpperCase(), sections: [{ type: 'PRODUCT' }] })
        });
        const searchJson = await searchRes.json();
        const productCode = searchJson.result?.[0]?.data?.items?.[0]?.productCode;
        if (!productCode) return [];

        const commentRes = await fetch('https://wts-cert-api.tossinvest.com/api/v3/comments', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subjectId: productCode, subjectType: 'STOCK', commentSortType: 'RECENT' })
        });
        const commentJson = await commentRes.json();
        return (commentJson.result?.comments || []).map(c => ({
            source: 'Toss', id: c.id, user: c.author?.nickname || 'Anonymous', text: c.message, date: c.updatedAt
        }));
    } catch { return []; }
}

// ==================== TradingView Screener (일괄 조회) ====================
/**
 * TradingView Screener API를 통해 모든 종목의 OHLCV + 지표 데이터를 한 번에 조회합니다.
 * @param {Object} req - POST { tickers?: string[], columns?: string[] }
 * @returns {{ data: Array<{ ticker, exchange, close, open, ... }> }}
 */
async function handleTradingView(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { tickers = [], columns } = req.body || {};

    // 기본 조회 컬럼 (OHLCV 위주)
    const defaultColumns = [
        'close', 'open', 'high', 'low', 'volume', 'exchange'
    ];

    const selectedColumns = columns || defaultColumns;

    const payload = {
        filter: tickers.length > 0 ? [] : [{ left: 'market_cap_basic', operation: 'nempty' }],
        options: { lang: 'en' },
        markets: ['america'],
        symbols: tickers.length > 0 ? {
            tickers: [
                ...tickers.map(t => `NASDAQ:${t}`),
                ...tickers.map(t => `NYSE:${t}`),
                ...tickers.map(t => `AMEX:${t}`)
            ]
        } : undefined,
        columns: selectedColumns,
        sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
        range: [0, tickers.length > 0 ? tickers.length * 3 : 500]
    };

    try {
        const apiResponse = await fetch('https://scanner.tradingview.com/america/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errText = await apiResponse.text();
            throw new Error(`TradingView API error: ${apiResponse.status} - ${errText}`);
        }

        const result = await apiResponse.json();

        // 결과를 ticker 기준으로 정리 (중복 제거: 같은 티커가 여러 거래소에 있을 수 있음)
        const tickerMap = new Map();
        const todayStr = new Date().toISOString().split('T')[0];

        for (const item of (result.data || [])) {
            const [exchange, ticker] = item.s.split(':');
            if (!tickerMap.has(ticker)) {
                // 야후 포맷과 유사하게 정리
                const row = {
                    ticker,
                    exchange,
                    date: todayStr // 오늘 날짜 명시
                };

                selectedColumns.forEach((col, i) => {
                    row[col] = item.d[i];
                });

                tickerMap.set(ticker, row);
            }
        }

        const data = Array.from(tickerMap.values());

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        return res.status(200).json({
            totalCount: result.totalCount || 0,
            count: data.length,
            columns: selectedColumns,
            data
        });
    } catch (e) {
        console.error('[TradingView Error]', e);
        return res.status(500).json({ error: e.message });
    }
}

// ==================== Reschedule (백엔드 스케줄 재설정) ====================
async function handleReschedule(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const backendUrl = process.env.BACKEND_URL || 'https://younginpiniti-bitcoin-ai-backend.hf.space';
    const targetUrl = `${backendUrl}/auto-trade/reschedule`;

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Cron-Secret': process.env.CRON_SECRET || '',
            },
        });
        const result = await response.json().catch(() => ({}));
        return res.status(response.ok ? 200 : response.status).json(result);
    } catch (error) {
        console.error('[Reschedule] 백엔드 호출 실패:', error.message);
        return res.status(500).json({ error: error.message });
    }
}

// ==================== InsertDataSet (DataSet 초기 등록) ====================
/**
 * 티커별 100일치 과거 데이터를 Yahoo Finance에서 수집하여 Supabase stock_dataset에 저장합니다.
 * 이미 등록된 티커는 스킵합니다.
 * @param {Object} req - POST { tickers: string[] }
 */
async function handleInsertDataSet(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

    const { tickers } = req.body || {};
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
        return res.status(400).json({ error: 'tickers 배열이 필요합니다.' });
    }

    const results = [];

    for (const ticker of tickers) {
        try {
            // 이미 등록되어 있는지 확인
            const { data: existing } = await supabase
                .from('stock_dataset')
                .select('ticker')
                .eq('ticker', ticker.toUpperCase())
                .limit(1);

            if (existing && existing.length > 0) {
                results.push({ ticker, status: 'skipped', message: '이미 등록되어 있습니다.' });
                continue;
            }

            // Yahoo Finance에서 100일치 데이터 수집
            const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=100d`;
            const yahooRes = await fetch(yahooUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });

            if (!yahooRes.ok) {
                results.push({ ticker, status: 'error', message: `Yahoo 데이터 조회 실패: ${yahooRes.status}` });
                continue;
            }

            const yahooData = await yahooRes.json();
            const chartResult = yahooData.chart?.result?.[0];
            if (!chartResult) {
                results.push({ ticker, status: 'error', message: 'Yahoo 데이터 파싱 실패' });
                continue;
            }

            const timestamps = chartResult.timestamp || [];
            const quote = chartResult.indicators?.quote?.[0] || {};

            // 캔들 데이터 구성
            const candles = timestamps.map((t, i) => ({
                date: new Date(t * 1000).toISOString().split('T')[0],
                open: quote.open?.[i],
                high: quote.high?.[i],
                low: quote.low?.[i],
                close: quote.close?.[i],
                volume: quote.volume?.[i]
            })).filter(c => c.close != null); // null 데이터 제거

            // Supabase에 저장
            const { error: insertError } = await supabase
                .from('stock_dataset')
                .insert({
                    ticker: ticker.toUpperCase(),
                    candles: candles,
                    last_updated: new Date().toISOString(),
                    data_count: candles.length
                });

            if (insertError) {
                results.push({ ticker, status: 'error', message: insertError.message });
            } else {
                results.push({ ticker, status: 'inserted', count: candles.length });
            }
        } catch (e) {
            results.push({ ticker, status: 'error', message: e.message });
        }
    }

    return res.status(200).json({
        success: true,
        total: tickers.length,
        inserted: results.filter(r => r.status === 'inserted').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: results.filter(r => r.status === 'error').length,
        results
    });
}

// ==================== SelectDataSet (DataSet 조회) ====================
/**
 * Supabase stock_dataset에서 데이터를 조회합니다.
 * @param {Object} req - GET ?tickers=AAPL,TSLA 또는 POST { tickers: string[] }
 */
async function handleSelectDataSet(req, res) {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

    let tickers = [];

    if (req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const tickerParam = url.searchParams.get('tickers') || req.query?.tickers;
        if (tickerParam) {
            tickers = tickerParam.split(',').map(t => t.trim().toUpperCase());
        }
    } else if (req.method === 'POST') {
        tickers = (req.body?.tickers || []).map(t => t.toUpperCase());
    }

    try {
        let query = supabase.from('stock_dataset').select('*');

        if (tickers.length > 0) {
            query = query.in('ticker', tickers);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}


