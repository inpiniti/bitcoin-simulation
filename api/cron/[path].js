/**
 * 통합 자동매매 크론 핸들러 (/api/cron/[path])
 * 
 * 11단계 파이프라인 구조:
 * start -> originData -> preprocessingData -> predict -> strategy -> token -> balance -> sell -> buy -> report
 */

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// KIS API 베이스 경로 (프로덕션용)
const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

export default async function handler(req, res) {
    const { path } = req.query;
    const runId = req.query.runId || req.body?.runId;
    const settingId = req.query.settingId || req.body?.settingId;

    console.log(`[Cron API] Path: ${path}, RunId: ${runId}, SettingId: ${settingId}`);

    try {
        switch (path) {
            case 'start':
                return await handleStart(req, res);
            case 'originData':
                return await handleOriginData(req, res, settingId);
            case 'preprocessingData':
                return await handlePreprocessingData(req, res, runId);
            case 'predict':
                return await handlePredict(req, res, runId);
            case 'strategy':
                return await handleStrategy(req, res, runId);
            case 'token':
                return await handleToken(req, res, runId);
            case 'balance':
                return await handleBalance(req, res, runId);
            case 'sell':
                return await handleSell(req, res, runId);
            case 'buy':
                return await handleBuy(req, res, runId);
            case 'report':
                return await handleReport(req, res, runId);
            default:
                return res.status(404).json({ error: 'Unknown cron path' });
        }
    } catch (error) {
        console.error(`[Cron Error] ${path}:`, error);
        return res.status(500).json({ error: error.message });
    }
}

// ==================== 1. Start ====================
// 전체 활성 설정을 조회하고 실행 조건에 맞는 것들로 각각 originData 호출
async function handleStart(req, res) {
    const today = new Date().toISOString().slice(0, 10);

    // 1. 활성 설정 조회
    const { data: settings, error } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('is_active', true);

    if (error) throw error;

    const matchedCount = 0;
    const results = [];

    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const setting of settings) {
        // 이미 오늘 실행했는지 여부는 DB에서 체크 (last_run_date 컬럼이 있다고 가정하거나 run_logs 조회)
        // 여기서는 간단히 execution_time 체크만 우선 수행
        if (setting.execution_time <= currentTimeStr) {
            // 비동기로 다음 단계 호출 (Vercel 타임아웃 방지)
            const nextUrl = getNextUrl(req, 'originData', { settingId: setting.id });
            fetch(nextUrl).catch(e => console.error('Next hop failed:', e));
            results.push({ settingId: setting.id, status: 'triggered' });
        }
    }

    return res.status(200).json({ status: 'success', triggered: results });
}

// ==================== 2. Origin Data ====================
// 대상 그룹의 티커들을 수집하여 초기 상태 생성
async function handleOriginData(req, res, settingId) {
    if (!settingId) throw new Error('settingId is required');

    // 1. 설정 정보 조회
    const { data: setting, error: sError } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('id', settingId)
        .single();
    if (sError) throw sError;

    // 2. 티커 그룹 조회 (Indices, SuperInvestor 등)
    let tickers = [];
    if (setting.ticker_group_key === 'superinvestor') {
        const dataromaRes = await fetch(getAbsoluteUrl(req, '/api/simple/dataroma'));
        const { stocks } = await dataromaRes.json();
        tickers = stocks.map(s => s.ticker);
    } else {
        // 기타 그룹 처리 logic (Indices 등)
        tickers = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META'];
    }

    // 3. 실행 상태 저장 (새로운 run 생성)
    const { data: run, error: rError } = await supabase
        .from('cron_runs')
        .insert({
            setting_id: settingId,
            step: 'originData',
            status: 'processing',
            data: { tickers, setting }
        })
        .select()
        .single();

    if (rError) {
        // 테이블이 없을 경우를 대비한 대체 로직 또는 에러 보고
        throw new Error('cron_runs 테이블이 존재하지 않는 것 같습니다. SQL 설정을 확인해주세요.');
    }

    // 다음 단계 호출
    triggerNext(req, 'preprocessingData', run.id);
    return res.status(200).json({ runId: run.id, step: 'originData' });
}

// ==================== 3. Preprocessing ====================
// 각 티커의 과거 데이터를 가져와서 Feature 변환
async function handlePreprocessingData(req, res, runId) {
    const run = await getRun(runId);
    const { tickers } = run.data;

    const preprocessed = [];
    // 병렬로 데이터 수집 및 전처리 (과도한 병렬방지를 위해 청크 처리 권장하지만 여기선 심플하게)
    for (const ticker of tickers) {
        try {
            const candles = await fetchYahooHistory(ticker);
            const features = processStockDataForPrediction(candles);
            preprocessed.push({ ticker, ...features });
        } catch (e) {
            console.warn(`Skip ${ticker}:`, e.message);
        }
    }

    await updateRun(runId, 'preprocessingData', { ...run.data, preprocessed });
    triggerNext(req, 'predict', runId);
    return res.status(200).json({ runId, step: 'preprocessingData' });
}

// ==================== 4. Predict ====================
// XGBoost AI 예측
async function handlePredict(req, res, runId) {
    const run = await getRun(runId);
    const { preprocessed, setting } = run.data;

    const predictionResults = [];
    const modelId = setting.ai_model_key;

    // 배치 처리 (서버 부하 방지)
    for (const item of preprocessed) {
        try {
            const predRes = await fetch(getAbsoluteUrl(req, '/api/xgb/predict'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelId,
                    features: [item.feature]
                })
            });
            const data = await predRes.json();
            predictionResults.push({
                ticker: item.ticker,
                probability: data.predictions?.[0]?.probability || 0
            });
        } catch (e) {
            console.warn(`Predict fail for ${item.ticker}:`, e.message);
        }
    }

    await updateRun(runId, 'predict', { ...run.data, predictionResults });
    triggerNext(req, 'strategy', runId);
    return res.status(200).json({ runId, step: 'predict' });
}

// ==================== 5. Strategy ====================
// 임계값에 따른 BUY/SELL 목록 필터링
async function handleStrategy(req, res, runId) {
    const run = await getRun(runId);
    const { predictionResults, setting } = run.data;

    const buyCondition = setting.buy_condition || 60.0;
    const buyList = predictionResults.filter(p => p.probability * 100 >= buyCondition);

    // 매도는 현재 보유 중인 종목에 대해 수행하므로 여기서는 매수 후보만 일단 보관
    // 실제 필터링은 balance 단계 이후에 수행

    await updateRun(runId, 'strategy', { ...run.data, buyCandidates: buyList });
    triggerNext(req, 'token', runId);
    return res.status(200).json({ runId, step: 'strategy' });
}

// ==================== 6. Token ====================
// KIS 토큰 발급
async function handleToken(req, res, runId) {
    const run = await getRun(runId);
    const { setting } = run.data;

    const response = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            appkey: setting.kis_appkey,
            appsecret: setting.kis_secret
        })
    });

    const data = await response.json();
    if (!data.access_token) throw new Error('KIS Token발급 실패: ' + JSON.stringify(data));

    await updateRun(runId, 'token', { ...run.data, kisToken: data.access_token });
    triggerNext(req, 'balance', runId);
    return res.status(200).json({ runId, step: 'token' });
}

// ==================== 7. Balance ====================
// 잔고 조회 및 매수/매도 대상 최종 확정
async function handleBalance(req, res, runId) {
    const run = await getRun(runId);
    const { setting, kisToken, buyCandidates, predictionResults } = run.data;

    const accountParts = setting.kis_account?.split('-') || [];
    const cano = accountParts[0];
    const acnt_prdt_cd = accountParts[1] || '01';

    // 1. 잔고 조회
    const params = new URLSearchParams({
        'CANO': cano,
        'ACNT_PRDT_CD': acnt_prdt_cd,
        'WCRC_FRCR_DVSN_CD': '01',
        'NATN_CD': '840',
        'TR_MKET_CD': '00',
        'INQR_DVSN_CD': '00'
    });

    const balRes = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/trading/inquire-present-balance?${params}`, {
        headers: {
            'authorization': `Bearer ${kisToken}`,
            'appkey': setting.kis_appkey,
            'appsecret': setting.kis_secret,
            'tr_id': 'CTRP6504R'
        }
    });
    const balData = await balRes.json();
    const holdings = balData.output1 || [];
    const accountInfo = balData.output3?.[0] || {};
    const cash = parseFloat(accountInfo.frcr_dncl_amt_2 || 0); // 외화예수금(D+2)

    // 2. 필터링 로직
    // - 매도: 보유 중인 것 중 예측 확률이 낮거나 특정 조건 만족하는 것 (여기선 매수 리스트에 없는 보유종목 전량 매도 예시)
    const sellList = holdings.map(h => ({
        ticker: h.pdno,
        qty: parseInt(h.ovrs_cblc_qty),
        avgPrice: parseFloat(h.pchs_avg_pric)
    })).filter(h => !buyCandidates.find(b => b.ticker === h.ticker));

    // - 매수: 후보 중 현재 보유하지 않은 것만
    const finalBuyList = buyCandidates.filter(b => !holdings.find(h => h.pdno === b.ticker));

    await updateRun(runId, 'balance', { ...run.data, sellList, finalBuyList, cash });
    triggerNext(req, 'sell', runId);
    return res.status(200).json({ runId, step: 'balance' });
}

// ==================== 8. Sell ====================
// 매도 주문 실행
async function handleSell(req, res, runId) {
    const run = await getRun(runId);
    const { sellList, setting, kisToken } = run.data;

    const accountParts = setting.kis_account?.split('-') || [];
    const cano = accountParts[0];
    const prdt = accountParts[1] || '01';

    const sellResults = [];
    for (const item of sellList) {
        try {
            // 현재가 조회 후 매도
            const price = await getKisCurrentPrice(kisToken, setting, item.ticker);
            const orderRes = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/trading/order`, {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${kisToken}`,
                    'appkey': setting.kis_appkey,
                    'appsecret': setting.kis_secret,
                    'tr_id': 'TTTT1006U' // 해외 매도
                },
                body: JSON.stringify({
                    CANO: cano,
                    ACNT_PRDT_CD: prdt,
                    OVRS_EXCG_CD: 'NASD',
                    PDNO: item.ticker,
                    ORD_QTY: String(item.qty),
                    OVRS_ORD_UNPR: String(price),
                    ORD_SVR_DVSN_CD: '0',
                    ORD_DVSN: '00'
                })
            });
            sellResults.push({ ticker: item.ticker, status: 'ordered', res: await orderRes.json() });
        } catch (e) {
            sellResults.push({ ticker: item.ticker, status: 'error', error: e.message });
        }
    }

    await updateRun(runId, 'sell', { ...run.data, sellResults });
    triggerNext(req, 'buy', runId);
    return res.status(200).json({ runId, step: 'sell' });
}

// ==================== 9. Buy ====================
// 매수 주문 실행
async function handleBuy(req, res, runId) {
    const run = await getRun(runId);
    const { finalBuyList, cash, setting, kisToken } = run.data;

    if (finalBuyList.length === 0) {
        triggerNext(req, 'report', runId);
        return res.status(200).json({ runId, step: 'buy', message: 'No buy targets' });
    }

    const buyAmountPerTicker = cash / finalBuyList.length;
    const buyResults = [];

    const accountParts = setting.kis_account?.split('-') || [];
    const cano = accountParts[0];
    const prdt = accountParts[1] || '01';

    for (const item of finalBuyList) {
        try {
            const price = await getKisCurrentPrice(kisToken, setting, item.ticker);
            const qty = Math.floor(buyAmountPerTicker / price);

            if (qty > 0) {
                const orderRes = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/trading/order`, {
                    method: 'POST',
                    headers: {
                        'authorization': `Bearer ${kisToken}`,
                        'appkey': setting.kis_appkey,
                        'appsecret': setting.kis_secret,
                        'tr_id': 'TTTT1002U' // 해외 매수
                    },
                    body: JSON.stringify({
                        CANO: cano,
                        ACNT_PRDT_CD: prdt,
                        OVRS_EXCG_CD: 'NASD',
                        PDNO: item.ticker,
                        ORD_QTY: String(qty),
                        OVRS_ORD_UNPR: String(price),
                        ORD_SVR_DVSN_CD: '0',
                        ORD_DVSN: '00'
                    })
                });
                buyResults.push({ ticker: item.ticker, qty, price, res: await orderRes.json() });
            } else {
                buyResults.push({ ticker: item.ticker, qty: 0, reason: 'Insufficient funds' });
            }
        } catch (e) {
            buyResults.push({ ticker: item.ticker, status: 'error', error: e.message });
        }
    }

    await updateRun(runId, 'buy', { ...run.data, buyResults });
    triggerNext(req, 'report', runId);
    return res.status(200).json({ runId, step: 'buy' });
}

// ==================== 10. Report ====================
// 결과 이메일 발송
async function handleReport(req, res, runId) {
    const run = await getRun(runId);
    const { sellResults, buyResults, setting } = run.data;

    const emailBody = `
        <h2>자동매매 실행 리포트</h2>
        <p>설정: ${setting.name}</p>
        <p>실행 시간: ${new Date(run.created_at).toLocaleString()}</p>
        
        <h3>매도 내역</h3>
        <ul>
            ${(sellResults || []).map(r => `<li>${r.ticker}: ${r.status} ${r.error ? '(' + r.error + ')' : ''}</li>`).join('')}
        </ul>

        <h3>매수 내역</h3>
        <ul>
            ${(buyResults || []).map(r => `<li>${r.ticker}: ${r.qty}주 @ $${r.price}</li>`).join('')}
        </ul>
    `;

    // 이메일 발송 로직 (api/simple/send 재활용 가능하지만 직접 구현)
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: setting.email || process.env.SMTP_USER,
        subject: `[Trade Report] ${setting.name} - ${new Date().toLocaleDateString()}`,
        html: emailBody
    });

    await supabase.from('cron_runs').update({ status: 'completed', step: 'report' }).eq('id', runId);
    return res.status(200).json({ status: 'completed' });
}

// ==================== Utils ====================

function getAbsoluteUrl(req, path) {
    const host = req.headers.host;
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}${path}`;
}

function getNextUrl(req, nextPath, params = {}) {
    const url = new URL(getAbsoluteUrl(req, `/api/cron/${nextPath}`));
    Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
    return url.toString();
}

function triggerNext(req, nextPath, runId) {
    const url = getNextUrl(req, nextPath, { runId });
    console.log(`[Cron] Triggering next step: ${url}`);
    fetch(url).catch(e => console.error(`Failed to trigger ${nextPath}:`, e.message));
}

async function getRun(runId) {
    const { data, error } = await supabase.from('cron_runs').select('*').eq('id', runId).single();
    if (error) throw error;
    return data;
}

async function updateRun(runId, step, data) {
    const { error } = await supabase.from('cron_runs').update({ step, data, updated_at: new Date().toISOString() }).eq('id', runId);
    if (error) throw error;
}

async function fetchYahooHistory(ticker) {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=365d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const json = await res.json();
    const result = json.chart.result[0];
    const quotes = result.indicators.quote[0];
    const timestamps = result.timestamp;

    return timestamps.map((t, i) => ({
        date: new Date(t * 1000).toISOString(),
        open: quotes.open[i],
        high: quotes.high[i],
        low: quotes.low[i],
        close: quotes.close[i],
        volume: quotes.volume[i]
    }));
}

async function getKisCurrentPrice(token, setting, ticker) {
    const params = new URLSearchParams({ AUTH: '', EXCD: 'NAS', SYMB: ticker });
    const res = await fetch(`${KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price-detail?${params}`, {
        headers: {
            'authorization': `Bearer ${token}`,
            'appkey': setting.kis_appkey,
            'appsecret': setting.kis_secret,
            'tr_id': 'HHDFS76200200'
        }
    });
    const data = await res.json();
    return parseFloat(data.output.last);
}

// ML Processor Helpers (lib/mlProcessor.js 에서 가져옴/축약)
function processStockDataForPrediction(candles) {
    if (!candles || candles.length <= 30) throw new Error('Insufficient data');
    const i = candles.length - 1;
    const today = candles[i];

    let consecutiveDays = 0;
    if (today.close > candles[i - 1].close) {
        let temp = 1;
        while (i - temp > 0 && candles[i - temp].close > candles[i - temp - 1].close) { consecutiveDays++; temp++; }
        if (consecutiveDays === 0) consecutiveDays = 1;
    } else if (today.close < candles[i - 1].close) {
        let temp = 1;
        while (i - temp > 0 && candles[i - temp].close < candles[i - temp - 1].close) { consecutiveDays--; temp++; }
        if (consecutiveDays === 0) consecutiveDays = -1;
    }

    const getChangePct = (days) => {
        const past = candles[i - days];
        if (!past || past.close === 0) return 0;
        return ((today.close - past.close) / past.close) * 100;
    };

    return {
        feature: [consecutiveDays, getChangePct(1), getChangePct(7), getChangePct(30)]
    };
}
