/**
 * 백엔드용 Gemini 프리 통합 프록시 (비스트리밍, JSON 응답 반환)
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

    // 로테이션
    const idx = Math.floor(Math.random() * apiKeys.length);
    const orderedKeys = [...apiKeys.slice(idx), ...apiKeys.slice(0, idx)];

    for (const apiKey of orderedKeys) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyText,
        });

        if (apiResponse.status === 429) {
            console.log(`[Gemini Proxy] 429 Rate Limit for key [...${apiKey.slice(-6)}]`);
            continue; // 다음 키로 시도
        }

        console.log(`[Gemini Proxy] OK key [...${apiKey.slice(-6)}]`);
        return new Response(apiResponse.body, {
            status: apiResponse.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

    return new Response(JSON.stringify({ error: '모든 Gemini 키가 429 에러 상태입니다.' }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
    });
}
