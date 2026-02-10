/**
 * 패스 없는 단일 엔드포인트 API 통합 핸들러
 * 
 * /api/simple/dataroma → DataRoma 스크래핑
 * /api/simple/forecast → HF Forecast 프록시
 * /api/simple/gemini → Gemini AI 프록시
 * /api/simple/hf → Hugging Face 프록시
 * /api/simple/whale → HF Whale 프록시
 * /api/simple/cron → 크론 작업 (티커 그룹 로딩)
 */

import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

export default async function handler(req, res) {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // URL에서 서비스명 추출: /api/simple/dataroma → 'dataroma'
    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.split('/').filter(Boolean); // ['api', 'simple', 'dataroma']
    const service = parts[2]; // 'dataroma'

    console.log(`[Simple API] Service: ${service}, Method: ${req.method}`);

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

    console.log(`[Dataroma] Found ${stocks.length} stocks with >= 5 holders.`);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ stocks });
}

// ==================== Forecast (HF Backend) ====================
async function handleForecast(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { symbol, interval = 'day' } = req.body;
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
    }

    const targetUrl = 'https://younginpiniti-bitcoin-ai-backend.hf.space/v1/forecast';
    const apiResponse = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Motia/1.0" },
        body: JSON.stringify({ symbol, interval }),
    });

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        return res.status(apiResponse.status).send(errorText);
    }

    const data = await apiResponse.json();
    return res.status(200).json(data);
}

// ==================== Gemini AI ====================
async function handleGemini(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('[Gemini Proxy] API Key is missing in env');
        return res.status(500).json({ error: 'Gemini API Key missing' });
    }

    const body = req.body;
    const model = body.model || "gemini-3-flash-preview";
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(targetUrl, {
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

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error(`[Gemini Proxy] API Error (${apiResponse.status}):`, errorText);
        return res.status(apiResponse.status).send(errorText);
    }

    const data = await apiResponse.json();
    return res.status(200).json(data);
}

// ==================== Hugging Face ====================
async function handleHf(req, res) {
    // GET 요청 시 헬스체크
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'ok', message: 'HF Proxy is running' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const hfToken = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN;

    const { inputs, model = "ProsusAI/finbert", options = {} } = req.body;
    if (!inputs && !options.wait_for_model) {
        return res.status(400).json({ error: 'Inputs are required' });
    }

    const targetUrl = `https://router.huggingface.co/hf-inference/models/${model}`;
    const headers = { "Content-Type": "application/json" };
    if (hfToken) {
        headers["Authorization"] = `Bearer ${hfToken}`;
    }

    const apiResponse = await fetch(targetUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
            inputs: inputs || "ping",
            options: { wait_for_model: true, ...options }
        }),
    });

    // 503은 모델 로딩 중
    if (apiResponse.status === 503) {
        const data = await apiResponse.json();
        return res.status(503).json(data);
    }

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error(`HF API Error (${apiResponse.status}): ${errorText}`);
        return res.status(apiResponse.status).send(errorText);
    }

    const data = await apiResponse.json();
    return res.status(200).json(data);
}

// ==================== Whale (HF Backend) ====================
async function handleWhale(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { symbol, interval = 'day' } = req.body;
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
    }

    const targetUrl = 'https://younginpiniti-bitcoin-ai-backend.hf.space/v1/whale';
    const apiResponse = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Motia/1.0" },
        body: JSON.stringify({ symbol, interval }),
    });

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        return res.status(apiResponse.status).send(errorText);
    }

    const data = await apiResponse.json();
    return res.status(200).json(data);
}

// ==================== Cron (티커 그룹 로딩) ====================
async function fetchGroupTickers(groupKey) {
    if (groupKey === 'superinvestor') {
        return [];
    }

    if (groupKey === 'indices') {
        return [
            { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
            { ticker: 'QQQ', name: 'Invesco QQQ Trust' },
            { ticker: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF Trust' },
            { ticker: 'IWM', name: 'iShares Russell 2000 ETF' },
        ];
    }

    return [];
}

async function handleCron(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const group = url.searchParams.get('group') || req.query?.group;
    if (group) {
        const tickers = await fetchGroupTickers(group);
        return res.status(200).json(tickers);
    }
    return res.status(400).json({ error: 'Group key is required' });
}

// ==================== Send (Email) ====================
async function handleSend(req, res) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        return res.status(500).json({ error: 'SMTP 설정 누락' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 465,
            secure: Number(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

        const now = new Date();
        const currentTime = now.toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const info = await transporter.sendMail({
            from: SMTP_FROM || SMTP_USER,
            to: req.body?.to || SMTP_USER,
            subject: req.body?.subject || `vercel > simulation > 테스트 메일 (${currentTime})`,
            html: req.body?.html || `<p>vercel > simulation > 에서 ${currentTime}에 전송한 테스트 메일입니다.</p>`,
        });

        return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('[Send] Email Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
