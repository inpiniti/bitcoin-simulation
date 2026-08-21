/**
 * Gemini AI 스트리밍 프록시 - Vercel Edge Runtime
 * Edge Runtime은 true streaming(ReadableStream)을 지원합니다.
 * /api/simple/gemini 요청을 처리합니다.
 */
export const config = { runtime: 'edge' };

// 2026-08-19 3.5-flash-lite 우선, 무료 한도(키별 500 RPD) 소진 시 3.1-flash-lite로 폴백 — 순서가 우선순위.
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

/** 환경변수에서 API 키 목록을 파싱 (콤마 구분) */
function parseApiKeys() {
    const raw = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    return raw.split(',').map(k => k.trim()).filter(Boolean);
}

/** 배열에서 랜덤 요소 반환 */
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 함수 호출(function calling) 마커 — 응답은 plain text 스트림이라 텍스트가 아닌 파트를 실어 보낼 자리가 없다.
 * 그래서 functionCall 파트는 **파트 객체 전부**를 JSON으로 감싸 이 마커 사이에 끼워 넣는다.
 *
 * ⚠ 파트 전부여야 한다 — Gemini 3.x는 다음 턴에 functionCall 파트를 돌려보낼 때 `thoughtSignature`가
 *   함께 있어야 한다("Function call is missing a thought_signature", 400). functionCall만 뽑아 보내면
 *   후속 요청이 통째로 실패한다(2026-08-21 실측).
 * 호출 측(financial-app `features/help/helpChat.ts`)이 이 마커를 잘라 도구를 실행하고 파트를 그대로 되돌린다.
 * tools를 안 보내는 기존 호출(기업 탭 AI 요약)에는 functionCall 파트가 아예 없어 영향이 없다.
 */
const FN_OPEN = '[[FN_CALL]]';
const FN_CLOSE = '[[/FN_CALL]]';

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
                            // 파트를 **전부** 훑는다(옛 코드는 parts[0]만 봐서 두 번째 파트부터 조용히 버려졌다).
                            // 생각(thought) 파트는 내부 요약이라 사용자에게 흘리지 않는다.
                            for (const part of json.candidates?.[0]?.content?.parts ?? []) {
                                if (part?.thought === true) continue;
                                if (part?.functionCall) {
                                    const marker = `${FN_OPEN}${JSON.stringify(part)}${FN_CLOSE}`;
                                    controller.enqueue(new TextEncoder().encode(marker));
                                    continue;
                                }
                                if (typeof part?.text === 'string' && part.text) {
                                    controller.enqueue(new TextEncoder().encode(part.text));
                                }
                            }
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
    // 모델 우선 순회 — 3.5를 모든 키에서 소진한 뒤에만 3.1로 내려간다. 상태 저장 없이 매 요청 같은 순서로 시도하므로
    // 한도가 리셋되면(무료 등급 RPD, 태평양 자정) 다음 요청부터 자동으로 3.5로 복귀한다.
    for (const model of MODELS) {
        for (const apiKey of orderedKeys) {
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
                // 429(할당량) or 403(권한) → 같은 모델, 다음 키
                if (status === 429 || status === 403) continue;
                // 그 외(404 모델 없음, 400 요청 오류 등) → 키를 바꿔도 같으므로 다음 모델로
                break;
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
