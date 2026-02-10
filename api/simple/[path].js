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
 * /api/simple/kis → 한국투자증권 Proxy (경로 대응)
 */

import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

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
    const allowedServices = ['dataroma', 'forecast', 'gemini', 'hf', 'whale', 'cron', 'send', 'discussion', 'kis'];
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
            case 'send':
                return await handleSend(req, res);
            case 'discussion':
                return await handleDiscussion(req, res);
            case 'kis':
                return await handleKis(req, res);
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

    const targetUrl = 'https://younginpiniti-bitcoin-ai-backend.hf.space/v1/forecast';
    const apiResponse = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Motia/1.0" },
        body: JSON.stringify({ symbol, interval }),
    });

    if (!apiResponse.ok) return res.status(apiResponse.status).send(await apiResponse.text());
    return res.status(200).json(await apiResponse.json());
}

// ==================== Gemini AI ====================
async function handleGemini(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini API Key missing' });

    const body = req.body;
    const model = body.model || "gemini-3-flash-preview";
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: body.contents,
            generationConfig: body.generationConfig || { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 1024 }
        })
    });

    if (!apiResponse.ok) return res.status(apiResponse.status).send(await apiResponse.text());
    return res.status(200).json(await apiResponse.json());
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

    const targetUrl = 'https://younginpiniti-bitcoin-ai-backend.hf.space/v1/whale';
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

// ==================== Send (Email) ====================
async function handleSend(req, res) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return res.status(500).json({ error: 'SMTP 설정 누락' });

    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 465,
            secure: Number(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

        const info = await transporter.sendMail({
            from: SMTP_FROM || SMTP_USER,
            to: req.body?.to || SMTP_USER,
            subject: req.body?.subject || `Bitcoin Simulation Test Mail`,
            html: req.body?.html || `<p>Tesla Simulation at ${new Date().toLocaleString()}</p>`,
        });

        return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
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

// ==================== KIS Proxy ====================
async function handleKis(req, res) {
    const fullUrl = req.url || '';
    let targetPath = fullUrl.substring(fullUrl.indexOf('kis') + 3); // 'kis' 이후의 경로 추출
    if (targetPath.startsWith('/')) targetPath = targetPath.substring(1);

    // Vercel rewrite 상황에서 targetPath가 비어있을 수 있음
    if (!targetPath && req.query.path) {
        // req.query.path가 ['kis', 'oauth2', 'tokenP'] 처럼 배열로 오는 경우 대응
        if (Array.isArray(req.query.path)) {
            targetPath = req.query.path.slice(1).join('/');
        }
    }

    const [pathOnly, search] = targetPath.split('?');
    const targetUrl = `https://openapi.koreainvestment.com:9443/${pathOnly}${search ? '?' + search : ''}`;

    const headers = {};
    const skipHeaders = ['host', 'connection', 'content-length'];
    Object.keys(req.headers).forEach(k => { if (!skipHeaders.includes(k.toLowerCase())) headers[k] = req.headers[k]; });
    headers['content-type'] = headers['content-type'] || 'application/json; charset=utf-8';

    const options = { method: req.method, headers };
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        options.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, options);
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data || { error: 'Invalid Upstream Response' });
}
