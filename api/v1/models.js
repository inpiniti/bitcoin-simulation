/**
 * OpenAI 호환 모델 목록 엔드포인트 (GET /api/v1/models)
 * VS Code (Continue, Cline, Roo Code 등)에서 모델 목록을 조회할 때 사용됩니다.
 */
export const config = { runtime: 'edge' };

const AVAILABLE_MODELS = [
    { id: 'gemini-auto', name: 'Gemini Auto (성능순 9단계 자동 폴백)' },
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (20 RPD)' },
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (20 RPD)' },
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (20 RPD)' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (20 RPD)' },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash (20 RPD)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (20 RPD)' },
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (500 RPD)' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (500 RPD)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (20 RPD)' },
];

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*',
            },
        });
    }

    const data = AVAILABLE_MODELS.map(m => ({
        id: m.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'google',
        permission: [],
        root: m.id,
        parent: null,
    }));

    return new Response(JSON.stringify({ object: 'list', data }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
        },
    });
}
