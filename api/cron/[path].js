/**
 * 통합 자동매매 크론 핸들러 (/api/cron/[path])
 * 
 * 사용자 11단계 계획 준수:
 * 1. Git Action 트리거
 * 2. start: 설정 조회 및 필터링
 * 3. originData: 티커 수집 및 초기화
 * 4. preprocessingData: 과거 데이터 수집 및 특징 추출
 * 5. predict: AI 예측 API 호출
 * 6. strategy: 매수/매도 후보 확정
 * 7. tocken: KIS 토큰 발급
 * 8. balance: 현재 잔고 확인 및 필터링
 * 9. sell: 실제 매도 주문
 * 10. buy: 자금 배분 및 실제 매수 주문
 * 11. report: 최종 결과 리포팅
 */

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

export default async function handler(req, res) {
    const { path } = req.query;
    const runId = req.query.runId || req.body?.runId;
    const settingId = req.query.settingId || req.body?.settingId;

    console.log(`[Cron ${new Date().toISOString()}] >>> Step: ${path} | RunId: ${runId} | SettingId: ${settingId}`);

    try {
        switch (path) {
            case 'start': return await handleStart(req, res);
            case 'originData': return await handleOriginData(req, res, settingId);
            case 'preprocessingData': return await handlePreprocessingData(req, res, runId);
            case 'predict': return await handlePredict(req, res, runId);
            case 'strategy': return await handleStrategy(req, res, runId);
            case 'token': return await handleToken(req, res, runId);
            case 'balance': return await handleBalance(req, res, runId);
            case 'sell': return await handleSell(req, res, runId);
            case 'buy': return await handleBuy(req, res, runId);
            case 'report': return await handleReport(req, res, runId);
            default:
                return res.status(404).json({ error: `Unknown step: ${path}` });
        }
    } catch (error) {
        console.error(`[Cron Critical Error] ${path}:`, error);
        // 에러 발생 시에도 로그를 남기기 위해 시도
        if (runId) {
            await supabase.from('cron_runs').update({
                status: 'error',
                data: { last_error: error.message }
            }).eq('id', runId).catch(console.error);
        }
        return res.status(500).json({ error: error.message, stack: error.stack });
    }
}

// ---------------------------------------------------------
// 2. /api/cron/start
// ---------------------------------------------------------
async function handleStart(req, res) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    console.log(`[Step 2: Start] Checking settings at ${currentTimeStr}`);

    const { data: settings, error } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('is_active', true);

    if (error) throw error;

    const triggered = [];
    for (const setting of settings) {
        // 필터: 오늘 실행 여부 (단순화를 위해 마지막 실행 날짜 체크)
        if (setting.last_run_date === todayStr) {
            console.log(`[Start Skip] '${setting.name}' 이미 오늘 실행됨.`);
            continue;
        }

        // 필터: 실행 시간 지났는지 여부
        if (setting.execution_time > currentTimeStr) {
            console.log(`[Start Skip] '${setting.name}' 실행 시간(${setting.execution_time})이 아직 안 됨.`);
            continue;
        }

        console.log(`[Start Trigger] '${setting.name}' 시작합니다...`);

        // 11단계를 타기 위해 originData 호출
        await triggerNext(req, 'originData', null, setting.id);

        // 실행 날짜 업데이트
        await supabase.from('automation_settings').update({ last_run_date: todayStr }).eq('id', setting.id);
        triggered.push({ id: setting.id, name: setting.name });
    }

    return res.status(200).json({
        message: 'Start completed',
        triggeredCount: triggered.length,
        triggered
    });
}

// ---------------------------------------------------------
// 3. /api/cron/originData
// ---------------------------------------------------------
async function handleOriginData(req, res, settingId) {
    console.log(`[Step 3: OriginData] Fetching tickers for setting: ${settingId}`);

    const { data: setting, error: sError } = await supabase.from('automation_settings').select('*').eq('id', settingId).single();
    if (sError) throw sError;

    let tickers = [];
    if (setting.ticker_group_key === 'superinvestor') {
        const res = await fetch(getAbsoluteUrl(req, '/api/simple/dataroma'));
        const { stocks } = await res.json();
        tickers = stocks.map(s => s.ticker);
    } else {
        // 기본 티커 셋
        tickers = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META'];
    }

    // 새로운 실행(Run) 인스턴스 생성
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
    if (rError) throw rError;

    console.log(`[OriginData Success] Tickers count: ${tickers.length} | RunId: ${run.id}`);

    await triggerNext(req, 'preprocessingData', run.id);
    return res.status(200).json({ success: true, runId: run.id });
}

// ---------------------------------------------------------
// 4. /api/cron/preprocessingData
// ---------------------------------------------------------
async function handlePreprocessingData(req, res, runId) {
    const run = await getRun(runId);
    const { tickers } = run.data;
    console.log(`[Step 4: Preprocessing] Processing ${tickers.length} tickers...`);

    const preprocessed = [];
    for (const ticker of tickers) {
        try {
            const candles = await fetchYahooHistory(ticker);
            const features = extractFeatures(candles);
            preprocessed.push({ ticker, features });
        } catch (e) {
            console.warn(`[Preprocessing Skip] ${ticker}: ${e.message}`);
        }
    }

    await updateRun(runId, 'preprocessingData', { ...run.data, preprocessed });
    await triggerNext(req, 'predict', runId);
    return res.status(200).json({ success: true, count: preprocessed.length });
}

// ---------------------------------------------------------
// 5. /api/cron/predict
// ---------------------------------------------------------
async function handlePredict(req, res, runId) {
    const run = await getRun(runId);
    const { preprocessed, setting } = run.data;
    console.log(`[Step 5: Predict] Requesting predictions for ${preprocessed.length} items...`);

    const predictionResults = [];
    const modelId = setting.ai_model_key || 'default';

    for (const item of preprocessed) {
        try {
            const predRes = await fetch(getAbsoluteUrl(req, '/api/xgb/predict'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId, features: [item.features] })
            });
            const data = await predRes.json();
            predictionResults.push({
                ticker: item.ticker,
                probability: data.predictions?.[0]?.probability || 0
            });
        } catch (e) {
            console.error(`[Predict Error] ${item.ticker}: ${e.message}`);
        }
    }

    await updateRun(runId, 'predict', { ...run.data, predictionResults });
    await triggerNext(req, 'strategy', runId);
    return res.status(200).json({ success: true, count: predictionResults.length });
}

// ---------------------------------------------------------
// 6. /api/cron/strategy
// ---------------------------------------------------------
async function handleStrategy(req, res, runId) {
    const run = await getRun(runId);
    const { predictionResults, setting } = run.data;
    console.log(`[Step 6: Strategy] Applying thresholds...`);

    const buyThreshold = setting.buy_condition || 60.0;
    const buyCandidates = predictionResults.filter(p => p.probability * 100 >= buyThreshold);

    // 매도는 현재 보유 종목 중 전략에 맞지 않는 것들을 고르는 것인데, 
    // 실제 보유 여부는 balance 단계에서 알 수 있으므로 여기서는 후보만 추림.
    const sellThreshold = setting.sell_condition || 20.0; // 수익률 기준 등

    await updateRun(runId, 'strategy', { ...run.data, buyCandidates, sellThreshold });
    await triggerNext(req, 'token', runId);
    return res.status(200).json({ success: true, buyCandidatesCount: buyCandidates.length });
}

// ---------------------------------------------------------
// 7. /api/cron/token
// ---------------------------------------------------------
async function handleToken(req, res, runId) {
    const run = await getRun(runId);
    const { setting } = run.data;
    console.log(`[Step 7: Token] Issuing KIS token...`);

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
    if (!data.access_token) throw new Error(`KIS Token 발급 실패: ${JSON.stringify(data)}`);

    await updateRun(runId, 'token', { ...run.data, kisToken: data.access_token });
    await triggerNext(req, 'balance', runId);
    return res.status(200).json({ success: true });
}

// ---------------------------------------------------------
// 8. /api/cron/balance
// ---------------------------------------------------------
async function handleBalance(req, res, runId) {
    const run = await getRun(runId);
    const { setting, kisToken, buyCandidates } = run.data;
    console.log(`[Step 8: Balance] Checking account balance and holdings...`);

    const accountParts = setting.kis_account?.split('-') || [];
    const cano = accountParts[0];
    const prdt = accountParts[1] || '01';

    const balRes = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/trading/inquire-present-balance?CANO=${cano}&ACNT_PRDT_CD=${prdt}&WCRC_FRCR_DVSN_CD=01&NATN_CD=840&TR_MKET_CD=00&INQR_DVSN_CD=00`, {
        headers: {
            'authorization': `Bearer ${kisToken}`,
            'appkey': setting.kis_appkey,
            'appsecret': setting.kis_secret,
            'tr_id': 'CTRP6504R'
        }
    });
    const balData = await balRes.json();
    const holdings = balData.output1 || [];
    const cash = parseFloat(balData.output3?.[0]?.frcr_dncl_amt_2 || 0);

    // [필터링 로직]
    // 1. 매수: 후보 중 현재 잔고에 없는 것만 선정
    const finalBuyList = buyCandidates.filter(b => !holdings.find(h => h.pdno === b.ticker));

    // 2. 매도: 현재 보유 중인 것 중 매수 후보에 없는 것 (전략 이탈)
    const sellList = holdings.map(h => ({
        ticker: h.pdno,
        qty: parseInt(h.ovrs_cblc_qty),
        avgPrice: parseFloat(h.pchs_avg_pric)
    })).filter(h => !buyCandidates.find(b => b.ticker === h.ticker));

    console.log(`[Balance Result] Cash: ${cash} | FinalBuy: ${finalBuyList.length} | Sell: ${sellList.length}`);

    await updateRun(runId, 'balance', { ...run.data, sellList, finalBuyList, cash });
    await triggerNext(req, 'sell', runId);
    return res.status(200).json({ success: true, cash });
}

// ---------------------------------------------------------
// 9. /api/cron/sell
// ---------------------------------------------------------
async function handleSell(req, res, runId) {
    const run = await getRun(runId);
    const { sellList, setting, kisToken } = run.data;
    console.log(`[Step 9: Sell] Executing ${sellList.length} sell orders...`);

    const sellResults = [];
    if (sellList.length === 0) {
        console.log(`[Sell Skip] No targets.`);
    }

    for (const item of sellList) {
        try {
            const price = await getKisPrice(kisToken, setting, item.ticker);

            if (setting.trade_enabled) {
                const res = await callKisOrder(kisToken, setting, item.ticker, item.qty, price, 'TTTT1006U'); // 매도
                sellResults.push({ ticker: item.ticker, status: 'ordered', res });
            } else {
                sellResults.push({ ticker: item.ticker, status: 'simulated', price, qty: item.qty });
            }
        } catch (e) {
            sellResults.push({ ticker: item.ticker, status: 'error', message: e.message });
        }
    }

    await updateRun(runId, 'sell', { ...run.data, sellResults });
    await triggerNext(req, 'buy', runId);
    return res.status(200).json({ success: true, count: sellResults.length });
}

// ---------------------------------------------------------
// 10. /api/cron/buy
// ---------------------------------------------------------
async function handleBuy(req, res, runId) {
    const run = await getRun(runId);
    const { finalBuyList, cash, setting, kisToken } = run.data;
    console.log(`[Step 10: Buy] Distributing ${cash} USD to ${finalBuyList.length} tickers...`);

    const buyResults = [];
    if (finalBuyList.length > 0) {
        const amountPerStock = cash / finalBuyList.length;

        for (const item of finalBuyList) {
            try {
                const price = await getKisPrice(kisToken, setting, item.ticker);
                const qty = Math.floor(amountPerStock / price);

                if (qty > 0) {
                    if (setting.trade_enabled) {
                        const res = await callKisOrder(kisToken, setting, item.ticker, qty, price, 'TTTT1002U'); // 매수
                        buyResults.push({ ticker: item.ticker, qty, price, res });
                    } else {
                        buyResults.push({ ticker: item.ticker, status: 'simulated', qty, price });
                    }
                } else {
                    buyResults.push({ ticker: item.ticker, status: 'skipped', reason: 'Value too small' });
                }
            } catch (e) {
                buyResults.push({ ticker: item.ticker, status: 'error', message: e.message });
            }
        }
    }

    await updateRun(runId, 'buy', { ...run.data, buyResults });
    await triggerNext(req, 'report', runId);
    return res.status(200).json({ success: true, count: buyResults.length });
}

// ---------------------------------------------------------
// 11. /api/cron/report
// ---------------------------------------------------------
async function handleReport(req, res, runId) {
    const run = await getRun(runId);
    const { sellResults, buyResults, setting } = run.data;
    console.log(`[Step 11: Report] Sending email report to ${setting.email}...`);

    const sellLines = (sellResults || []).map(r => `<li>[매도] ${r.ticker}: ${r.status === 'simulated' ? '모의' : r.status} (${r.qty || 0}주)</li>`).join('');
    const buyLines = (buyResults || []).map(r => `<li>[매수] ${r.ticker}: ${r.status === 'simulated' ? '모의' : r.status} (${r.qty || 0}주 / $${r.price || 0})</li>`).join('');

    const html = `
        <h3>자동매매 실행 리포트 (${setting.trade_enabled ? '실전' : '모의'})</h3>
        <p><strong>전략명:</strong> ${setting.name}</p>
        <p><strong>수행시간:</strong> ${new Date(run.created_at).toLocaleString()}</p>
        <hr/>
        <h4>매도 결과</h4><ul>${sellLines || '<li>없음</li>'}</ul>
        <h4>매수 결과</h4><ul>${buyLines || '<li>없음</li>'}</ul>
    `;

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
        html
    });

    await supabase.from('cron_runs').update({ status: 'completed' }).eq('id', runId);
    console.log(`[Cron Pipeline Complete] RunId: ${runId}`);
    return res.status(200).json({ success: true, message: 'All steps completed' });
}

// ---------------------------------------------------------
// Utilities
// ---------------------------------------------------------

async function triggerNext(req, nextPath, runId, settingId) {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    const url = new URL(`${protocol}://${host}/api/cron/${nextPath}`);
    if (runId) url.searchParams.set('runId', runId);
    if (settingId) url.searchParams.set('settingId', settingId);

    console.log(`[Triggering] >>> ${url.toString()}`);

    // Vercel에서 비동기 호출 시 프로세스가 죽지 않도록 대기
    try {
        const response = await fetch(url.toString(), {
            headers: { 'Accept': 'application/json' }
        });
        const text = await response.text();
        console.log(`[Trigger Result] Step ${nextPath}: ${response.status}`);
    } catch (e) {
        console.error(`[Trigger Failed] Step ${nextPath}: ${e.message}`);
    }
}

async function getRun(id) {
    const { data, error } = await supabase.from('cron_runs').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
}

async function updateRun(id, step, data) {
    const { error } = await supabase.from('cron_runs').update({
        step,
        data,
        updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) throw error;
}

function getAbsoluteUrl(req, path) {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    return `${protocol}://${host}${path}`;
}

async function fetchYahooHistory(ticker) {
    const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=30d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const json = await res.json();
    return json.chart.result[0].timestamp.map((t, i) => ({
        date: new Date(t * 1000).toISOString(),
        close: json.chart.result[0].indicators.quote[0].close[i]
    }));
}

function extractFeatures(candles) {
    // 간단한 특징 추출 예시 (최근 변동성 등)
    if (candles.length < 5) return [0, 0, 0, 0];
    const last = candles[candles.length - 1].close;
    const prev = candles[candles.length - 2].close;
    return [
        last > prev ? 1 : -1,
        ((last - prev) / prev) * 100,
        0, 0 // 패딩
    ];
}

async function getKisPrice(token, setting, ticker) {
    const res = await fetch(`${KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price-detail?AUTH=&EXCD=NAS&SYMB=${ticker}`, {
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

async function callKisOrder(token, setting, ticker, qty, price, trId) {
    const accountParts = setting.kis_account?.split('-') || [];
    const res = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/trading/order`, {
        method: 'POST',
        headers: {
            'authorization': `Bearer ${token}`,
            'appkey': setting.kis_appkey,
            'appsecret': setting.kis_secret,
            'tr_id': trId
        },
        body: JSON.stringify({
            CANO: accountParts[0],
            ACNT_PRDT_CD: accountParts[1] || '01',
            OVRS_EXCG_CD: 'NASD',
            PDNO: ticker,
            ORD_QTY: String(qty),
            OVRS_ORD_UNPR: String(price),
            ORD_SVR_DVSN_CD: '0',
            ORD_DVSN: '00'
        })
    });
    return await res.json();
}
