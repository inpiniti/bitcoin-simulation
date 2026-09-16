/**
 * Gemini AI 스트리밍 프록시 - Vercel Edge Runtime
 * Edge Runtime은 true streaming(ReadableStream)을 지원합니다.
 * /api/simple/gemini 요청을 처리합니다.
 */
export const config = { runtime: 'edge', maxDuration: 30 };

/**
 * 성능순 모델 우선순위 (Fallback 체인)
 * 1. 고성능 Flash 라인 (키별 20 RPD) : 3.8 → 3.7 → 3.6 → 3.5 → 3 → 2.5 Flash
 * 2. 대용량 Lite 라인 (키별 500 RPD) : 3.5 Flash Lite → 3.1 Flash Lite
 * 3. 최하위 백업 Lite (키별 20 RPD)  : 2.5 Flash Lite
 *
 * 상태 저장 없이 매 요청 최상위 모델부터 시도하며,
 * 일일 할당량(RPD) 소진으로 429가 발생하면 다음 키 및 다음 모델로 자동 폴백됩니다.
 * 태평양 자정에 구글 할당량이 리셋되면 다시 최상위 모델(3.8 Flash)로 자동 복귀합니다.
 */
const MODELS = [
    // ── 1계층: 고성능 Flash 모델 (키당 일 20회) ──
    'gemini-3.8-flash',      // 20 RPD (최상위 플래그십)
    'gemini-3.7-flash',      // 20 RPD
    'gemini-3.6-flash',      // 20 RPD
    'gemini-3.5-flash',      // 20 RPD
    'gemini-3-flash',        // 20 RPD
    'gemini-2.5-flash',      // 20 RPD
    // ── 2계층: 대용량 Flash Lite 모델 (키당 일 500회) ──
    'gemini-3.5-flash-lite', // 500 RPD (경량 최고 성능)
    'gemini-3.1-flash-lite', // 500 RPD (넉넉한 할당량 백업)
    // ── 3계층: 최종 백업 Lite 모델 (키당 일 20회) ──
    'gemini-2.5-flash-lite', // 20 RPD
];

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
 * 소진(429) 및 오류 상태 인메모리 캐시 (Key+Model -> 만료 타임스탬프 ms)
 * Vercel Edge 인스턴스가 살아있는 동안 유지되며,
 * 이미 소진된 모델/키는 API 호출(fetch) 자체를 건너뛰어(0ms) 다음 모델로 즉시 직행합니다.
 */
const cooldownMap = new Map();

/** 특정 키+모델이 쿨다운(스킵 대상) 상태인지 확인 */
function isCoolingDown(apiKey, model) {
    const key = `${apiKey.slice(-8)}:${model}`;
    const expireAt = cooldownMap.get(key);
    if (!expireAt) return false;
    if (Date.now() > expireAt) {
        cooldownMap.delete(key);
        return false;
    }
    return true;
}

/** 쿨다운 등록 (만료 시간 설정) */
function setCooldown(apiKey, model, durationMs, reason) {
    const key = `${apiKey.slice(-8)}:${model}`;
    cooldownMap.set(key, Date.now() + durationMs);
    console.log(`[Gemini Edge] Cooldown set key[...${apiKey.slice(-6)}] ${model} (${reason}): ${Math.round(durationMs / 1000)}s`);
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
    // 모델 우선 순회 — 상위 성능 모델부터 시도하며, 소진(429) 시 다음 순위 모델로 내려갑니다.
    // 이미 소진된 모델/키는 cooldownMap에 의해 API 호출 없이 즉시 스킵됩니다.
    for (const model of MODELS) {
        for (const apiKey of orderedKeys) {
            // 이미 일일 소진(RPD) 또는 분당 제한(RPM)에 걸린 키+모델은 fetch 없이 0ms 즉시 통과
            if (isCoolingDown(apiKey, model)) {
                continue;
            }

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

                // 429(할당량 초과)
                if (status === 429) {
                    const isDaily = errBody.includes('PerDay') || errBody.includes('per day') || errBody.includes('quota_limit_value');
                    if (isDaily) {
                        // 하루 한도(RPD) 소진 → 6시간 동안 호출 차단 (다음 요청은 이 모델/키를 0ms 즉시 스킵)
                        setCooldown(apiKey, model, 6 * 60 * 60 * 1000, 'Daily RPD Quota Exceeded');
                    } else {
                        // 분당 제한(RPM/TPM) → 60초 쿨다운
                        setCooldown(apiKey, model, 60 * 1000, 'RPM/TPM Rate Limit');
                    }
                    continue; // 같은 모델의 다음 키 시도
                }

                // 403(권한 오류 / 키 문제) → 1시간 쿨다운
                if (status === 403) {
                    setCooldown(apiKey, model, 60 * 60 * 1000, 'Forbidden (403)');
                    continue;
                }

                // 404(모델 미지원 / 오타 등) → 24시간 동안 모든 키에서 해당 모델 호출 건너뜀
                if (status === 404) {
                    for (const k of apiKeys) {
                        setCooldown(k, model, 24 * 60 * 60 * 1000, 'Model Not Found (404)');
                    }
                    break;
                }

                // 그 외(400 요청 오류 등) → 키를 바꿔도 같으므로 다음 모델로
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
