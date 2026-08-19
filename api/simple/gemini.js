/**
 * Gemini AI 스트리밍 프록시 - Vercel Edge Runtime
 * Edge Runtime은 true streaming(ReadableStream)을 지원합니다.
 * /api/simple/gemini 요청을 처리합니다.
 */
export const config = { runtime: 'edge' };

// 2026-08-19 단일 모델 고정(gemini-3.5-flash-lite) — 폴백 모델 목록 제거.
const MODELS = ["gemini-3.5-flash-lite"];

/** 환경변수에서 API 키 목록을 파싱 (콤마 구분) */
function parseApiKeys() {
    const raw = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    return raw.split(',').map(k => k.trim()).filter(Boolean);
}

/** 배열에서 랜덤 요소 반환 */
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** SSE 응답 body → plain text ReadableStream 변환 */
function sseToTextStream(body) {
    return new ReadableStream({
        async start(controller) {
            const reader = body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    const lines = buf.split('\n');
                    buf = lines.pop() ?? '';
                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const raw = line.slice(6).trim();
                        if (!raw || raw === '[DONE]') continue;
                        try {
                            const json = JSON.parse(raw);
                            const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                            if (text) controller.enqueue(new TextEncoder().encode(text));
                        } catch { /* skip malformed */ }
                    }
                }
            } finally {
                controller.close();
            }
        },
    });
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

    let contents;
    let tools;
    let systemInstruction;
    let genConfig = { maxOutputTokens: 2048, temperature: 0.7 };
    try {
        const body = await req.json();
        contents = body.contents || [];
        // 호출 측이 넘기면 그대로 전달 — tools(예: [{ google_search: {} }] 검색 그라운딩),
        // systemInstruction, generationConfig(responseMimeType 등). 없으면 기존 기본값.
        tools = Array.isArray(body.tools) ? body.tools : undefined;
        systemInstruction = body.systemInstruction;
        if (body.generationConfig && typeof body.generationConfig === 'object') {
            genConfig = { ...genConfig, ...body.generationConfig };
        }
    } catch {
        return new Response('Invalid JSON', { status: 400 });
    }

    // 랜덤 키부터 시작해서 순서대로 폴백 (키 로테이션)
    const startIdx = Math.floor(Math.random() * apiKeys.length);
    const orderedKeys = [
        ...apiKeys.slice(startIdx),
        ...apiKeys.slice(0, startIdx),
    ];

    // 마지막 업스트림 오류(상태·본문 앞부분) — 전부 실패했을 때 503 본문에 실어 원인을 알 수 있게 한다.
    let lastError = '';
    for (const apiKey of orderedKeys) {
        for (const model of MODELS) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
            const apiResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: genConfig,
                    ...(tools ? { tools } : {}),
                    ...(systemInstruction ? { systemInstruction } : {}),
                }),
            });

            if (!apiResponse.ok) {
                const status = apiResponse.status;
                const errBody = (await apiResponse.text().catch(() => '')).slice(0, 500);
                lastError = `${status} ${errBody}`;
                console.log(`[Gemini Edge] key[...${apiKey.slice(-6)}] ${model} → ${status} ${errBody}`);
                // 429(할당량) or 403(권한) → 다음 키로 건너뜀
                if (status === 429 || status === 403) break;
                // 404(모델 없음) → 같은 키, 다음 모델 시도
                continue;
            }

            console.log(`[Gemini Edge] OK key[...${apiKey.slice(-6)}] model: ${model}`);
            return new Response(sseToTextStream(apiResponse.body), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache',
                },
            });
        }
    }

    return new Response(`Gemini API 호출 실패 (${lastError || "사용 가능한 키/모델 없음"})`, {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    });
}
