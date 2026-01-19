export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { symbol, interval = 'day' } = request.body;

    if (!symbol) {
        return response.status(400).json({ error: 'Symbol is required' });
    }

    try {
        const targetUrl = 'https://younginpiniti-bitcoin-ai-backend.hf.space/v1/forecast';

        const apiResponse = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Motia/1.0"
            },
            body: JSON.stringify({ symbol, interval }),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            return response.status(apiResponse.status).send(errorText);
        }

        const data = await apiResponse.json();
        response.status(200).json(data);
    } catch (error) {
        console.error('Forecast Proxy Error:', error);
        response.status(500).json({ error: 'Internal Server Error' });
    }
}
