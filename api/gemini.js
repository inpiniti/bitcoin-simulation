export default async function handler(request, response) {
    // CORS 설정
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('[Gemini Proxy] API Key is missing in env');
        return response.status(500).json({ error: 'Gemini API Key missing' });
    }

    try {
        const body = request.body;
        const model = body.model || "gemini-3-flash-preview";

        const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const apiResponse = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: body.contents,
                generationConfig: body.generationConfig || {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`[Gemini Proxy] API Error (${apiResponse.status}):`, errorText);
            return response.status(apiResponse.status).send(errorText);
        }

        const data = await apiResponse.json();
        response.status(200).json(data);
    } catch (error) {
        console.error('Gemini Proxy Error:', error);
        response.status(500).json({ error: error.message });
    }
}
