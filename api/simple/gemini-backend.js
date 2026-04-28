/**
 * 백엔드용 Gemini 프록시 — 단순 단일 relay
 * 키 로테이션/재시도는 백엔드(bitcoin-ai-backend)에서 담당.
 * 여기서는 키 1개, 모델 1개만 시도하고 결과를 즉시 반환한다.
 */
export const config = { runtime: 'edge' };

function parseApiKeys() {
    const raw = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    return raw.split(',').map(k => k.trim()).filter(Boolean);
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const apiKeys = parseApiKeys();
    if (apiKeys.length === 0) {
        return new Response(JSON.stringify({ error: 'Gemini API Key missing' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    let bodyText = '';
    try {
        bodyText = await req.text();
    } catch {
        return new Response('Invalid Body', { status: 400 });
    }

    // 키 1개 랜덤 선택 — 재시도/로테이션은 백엔드가 담당
    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
    const model = 'gemini-2.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyText,
            signal: AbortSignal.timeout(20000), // Vercel 25초 한도 안에 여유 있게
        });

        console.log(`[Gemini Proxy] key[...${apiKey.slice(-6)}] ${model} → ${apiResponse.status}`);

        if (apiResponse.ok) {
            return new Response(apiResponse.body, {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // 실패 시 상태코드 그대로 반환 → 백엔드가 다른 키로 재시도
        const errText = await apiResponse.text();
        return new Response(errText, {
            status: apiResponse.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (e) {
        console.log(`[Gemini Proxy] timeout key[...${apiKey.slice(-6)}] ${model}: ${e.message}`);
        return new Response(JSON.stringify({ error: 'timeout' }), {
            status: 504,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
}
