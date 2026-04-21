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

    const MODELS = [
        'gemini-flash-lite-latest',
        'gemini-flash-latest',
        'gemini-3.1-flash-lite-preview',
        'gemini-3-flash-preview',
        'gemini-3.1-pro-preview',
        'gemini-2.0-flash',
    ];

    for (const apiKey of orderedKeys) {
        for (const model of MODELS) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const apiResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: bodyText,
            });

            if (!apiResponse.ok) {
                const status = apiResponse.status;
                console.log(`[Gemini Proxy] key[...${apiKey.slice(-6)}] ${model} → ${status}`);
                // 429(할당량) or 403(권한) → 다음 키로 건너뜀 (모델 계속 시도할 필요 없음)
                if (status === 429 || status === 403) break;
                // 404(모델 없음) 등 기타 에러 → 같은 키, 다음 모델 시도
                continue;
            }

            console.log(`[Gemini Proxy] OK key [...${apiKey.slice(-6)}] model: ${model}`);
            return new Response(apiResponse.body, {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
    }

    return new Response(JSON.stringify({ error: '모든 Gemini 키가 429 에러 상태입니다.' }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
    });
}
