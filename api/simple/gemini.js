/**
 * Gemini AI 스트리밍 프록시 - Vercel Edge Runtime
 * Edge Runtime은 true streaming(ReadableStream)을 지원합니다.
 * /api/simple/gemini 요청을 처리합니다.
 */
export const config = { runtime: 'edge' };

const MODELS = [
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-pro-preview',
];

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

    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Gemini API Key missing' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    let contents;
    try {
        const body = await req.json();
        contents = body.contents || [];
    } catch {
        return new Response('Invalid JSON', { status: 400 });
    }

    const genConfig = { maxOutputTokens: 2048, temperature: 0.7 };

    for (const model of MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents, generationConfig: genConfig }),
        });

        if (!apiResponse.ok) {
            console.log(`[Gemini Edge] ${model} → ${apiResponse.status}, trying next...`);
            continue;
        }

        console.log(`[Gemini Edge] Streaming with: ${model}`);

        // SSE → plain text 스트림으로 변환
        const stream = new ReadableStream({
            async start(controller) {
                const reader = apiResponse.body.getReader();
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

        return new Response(stream, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
            },
        });
    }

    return new Response('Gemini API 할당량 초과 또는 사용 가능한 모델 없음.', { status: 503 });
}
