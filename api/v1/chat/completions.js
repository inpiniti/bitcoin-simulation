/**
 * OpenAI 호환 Chat Completions 프록시 - Vercel Edge Runtime
 *
 * VS Code (Continue, Cline, Roo Code, Aider 등) 설정:
 *   - Provider  : OpenAI Compatible
 *   - Base URL  : https://simulation-inpiniti.vercel.app/api/v1
 *   - API Key   : (아무 문자열 - 더미)
 *   - Model     : gemini-auto  (또는 특정 모델 ID)
 *
 * 요청 포맷 : OpenAI   POST /v1/chat/completions
 * 응답 포맷 : OpenAI   SSE  data: {"choices":[{"delta":{"content":"..."}}]}
 * 내부 처리 : Gemini API v1beta streamGenerateContent (9단계 성능순 폴백 + 쿨다운 캐시)
 */
export const config = { runtime: 'edge' };

// ── 모델 우선순위 ────────────────────────────────────────────────────────────
// gemini-auto (기본값) 또는 특정 ID가 요청되면 해당 모델부터 시도합니다.
const ALL_MODELS = [
    // 1계층: 고성능 Flash (키당 일 20 RPD)
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash',
    'gemini-2.5-flash',
    // 2계층: 대용량 Flash Lite (키당 일 500 RPD)
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    // 3계층: 최종 백업 Lite (키당 일 20 RPD)
    'gemini-2.5-flash-lite',
];

// ── 쿨다운 캐시 ──────────────────────────────────────────────────────────────
// 소진(429) / 오류(403, 404)가 발생한 키+모델을 기억해서 다음 요청 시 fetch 없이 스킵합니다.
const cooldownMap = new Map();

function isCoolingDown(apiKey, model) {
    const k = `${apiKey.slice(-8)}:${model}`;
    const exp = cooldownMap.get(k);
    if (!exp) return false;
    if (Date.now() > exp) { cooldownMap.delete(k); return false; }
    return true;
}

function setCooldown(apiKey, model, durationMs, reason) {
    const k = `${apiKey.slice(-8)}:${model}`;
    cooldownMap.set(k, Date.now() + durationMs);
    console.log(`[OpenAI→Gemini] Cooldown key[...${apiKey.slice(-6)}] ${model} (${reason}) ${Math.round(durationMs / 1000)}s`);
}

// ── OpenAI messages → Gemini contents 변환 ───────────────────────────────────
function toGeminiContents(messages) {
    const contents = [];
    let systemText = '';

    for (const msg of messages) {
        const role = msg.role;
        const text = typeof msg.content === 'string'
            ? msg.content
            : (msg.content ?? []).map(p => (p.type === 'text' ? p.text : '')).join('');

        if (role === 'system') {
            systemText += (systemText ? '\n' : '') + text;
            continue;
        }
        // OpenAI role: 'user' | 'assistant' → Gemini role: 'user' | 'model'
        contents.push({ role: role === 'assistant' ? 'model' : 'user', parts: [{ text }] });
    }

    return { contents, systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined };
}

// ── 환경변수 파싱 ─────────────────────────────────────────────────────────────
function parseApiKeys() {
    const raw = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    return raw.split(',').map(k => k.trim()).filter(Boolean);
}

// ── OpenAI SSE 청크 직렬화 ────────────────────────────────────────────────────
function encodeChunk(id, model, content) {
    const payload = {
        id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta: { content }, finish_reason: null }],
    };
    return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function encodeDone(id, model) {
    const payload = {
        id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    };
    return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`);
}

// ── Gemini SSE → OpenAI SSE 변환 스트림 ──────────────────────────────────────
function geminiToOpenAIStream(body, completionId, resolvedModel) {
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
                            for (const part of json.candidates?.[0]?.content?.parts ?? []) {
                                // thought(내부 추론) 파트는 사용자에게 노출하지 않음
                                if (part?.thought === true) continue;
                                if (typeof part?.text === 'string' && part.text) {
                                    controller.enqueue(encodeChunk(completionId, resolvedModel, part.text));
                                }
                            }
                        } catch { /* skip malformed SSE */ }
                    }
                }
            } finally {
                controller.enqueue(encodeDone(completionId, resolvedModel));
                controller.close();
            }
        },
    });
}

// ── 비스트리밍 전체 응답 조립 ─────────────────────────────────────────────────
async function collectGeminiResponse(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let fullText = '';
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
                for (const part of json.candidates?.[0]?.content?.parts ?? []) {
                    if (part?.thought === true) continue;
                    if (typeof part?.text === 'string') fullText += part.text;
                }
            } catch { /* skip */ }
        }
    }
    return fullText;
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────
export default async function handler(req) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    const apiKeys = parseApiKeys();
    if (apiKeys.length === 0) {
        return new Response(
            JSON.stringify({ error: { message: 'Gemini API Key missing', type: 'server_error' } }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
    }

    let body;
    try { body = await req.json(); }
    catch { return new Response('Invalid JSON', { status: 400, headers: corsHeaders }); }

    const {
        messages = [],
        model: requestedModel = 'gemini-auto',
        stream = false,
        max_tokens,
        temperature = 0.7,
    } = body;

    // 요청 모델이 'gemini-auto'면 전체 폴백 체인, 아니면 해당 모델부터 시작
    const modelIndex = ALL_MODELS.indexOf(requestedModel);
    const MODELS = modelIndex >= 0 ? ALL_MODELS.slice(modelIndex) : ALL_MODELS;

    // OpenAI → Gemini 변환
    const { contents, systemInstruction } = toGeminiContents(messages);
    const genConfig = {
        temperature,
        ...(max_tokens ? { maxOutputTokens: max_tokens } : { maxOutputTokens: 8192 }),
    };

    // 키 로테이션 (랜덤 시작 → 순차 폴백)
    const startIdx = Math.floor(Math.random() * apiKeys.length);
    const orderedKeys = [...apiKeys.slice(startIdx), ...apiKeys.slice(0, startIdx)];

    const completionId = `chatcmpl-gemini-${Date.now()}`;
    let lastError = '';
    let resolvedModel = MODELS[0];

    for (const model of MODELS) {
        for (const apiKey of orderedKeys) {
            // 쿨다운 중인 키+모델은 fetch 없이 즉시 스킵
            if (isCoolingDown(apiKey, model)) continue;

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
            const geminiRes = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: genConfig,
                    ...(systemInstruction ? { systemInstruction } : {}),
                }),
            });

            if (!geminiRes.ok) {
                const status = geminiRes.status;
                const errBody = (await geminiRes.text().catch(() => '')).slice(0, 500);
                lastError = `${status} ${errBody}`;
                console.log(`[OpenAI→Gemini] key[...${apiKey.slice(-6)}] ${model} → ${status}`);

                if (status === 429) {
                    const isDaily = errBody.includes('PerDay') || errBody.includes('per day') || errBody.includes('quota_limit_value');
                    setCooldown(apiKey, model, isDaily ? 6 * 60 * 60 * 1000 : 60 * 1000, isDaily ? 'RPD Exhausted' : 'RPM/TPM');
                    continue;
                }
                if (status === 403) { setCooldown(apiKey, model, 60 * 60 * 1000, 'Forbidden'); continue; }
                if (status === 404) {
                    for (const k of apiKeys) setCooldown(k, model, 24 * 60 * 60 * 1000, 'Model Not Found');
                    break;
                }
                break; // 400 등은 키 교체해도 동일 → 다음 모델로
            }

            resolvedModel = model;
            console.log(`[OpenAI→Gemini] OK key[...${apiKey.slice(-6)}] model: ${model} stream: ${stream}`);

            // ── 스트리밍 응답 ──
            if (stream) {
                return new Response(geminiToOpenAIStream(geminiRes.body, completionId, resolvedModel), {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/event-stream; charset=utf-8',
                        'Cache-Control': 'no-cache',
                        'X-Accel-Buffering': 'no',
                        ...corsHeaders,
                    },
                });
            }

            // ── 비스트리밍 응답 (JSON 전체 반환) ──
            const fullText = await collectGeminiResponse(geminiRes.body);
            return new Response(JSON.stringify({
                id: completionId,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: resolvedModel,
                choices: [{
                    index: 0,
                    message: { role: 'assistant', content: fullText },
                    finish_reason: 'stop',
                }],
                usage: { prompt_tokens: -1, completion_tokens: -1, total_tokens: -1 },
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders },
            });
        }
    }

    // 전부 실패
    return new Response(JSON.stringify({
        error: { message: `Gemini API 호출 실패 (${lastError || '사용 가능한 키/모델 없음'})`, type: 'server_error' }
    }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders },
    });
}
