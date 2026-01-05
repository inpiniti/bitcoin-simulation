export default async function handler(request, response) {
    // CORS 설정
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // 서버 측 환경변수에서 토큰 가져오기 (Vercel 설정에서 HF_TOKEN으로 이름 설정 필요)
    // 로컬 개발 시에는 .env 파일의 VITE_HF_TOKEN을 재사용하거나 HF_TOKEN을 따로 선언
    const hfToken = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN;

    try {
        const { inputs, model = "ProsusAI/finbert" } = request.body;

        if (!inputs) {
            return response.status(400).json({ error: 'Inputs are required' });
        }

        const targetUrl = `https://api-inference.huggingface.co/models/${model}`;

        const headers = {
            "Content-Type": "application/json"
        };

        if (hfToken) {
            headers["Authorization"] = `Bearer ${hfToken}`;
        }

        const apiResponse = await fetch(targetUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ inputs }),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`HF API Error (${apiResponse.status}): ${errorText}`);
            return response.status(apiResponse.status).send(errorText);
        }

        const data = await apiResponse.json();
        response.status(200).json(data);
    } catch (error) {
        console.error('HF Proxy Error:', error);
        response.status(500).json({ error: 'Failed to analyze sentiment' });
    }
}
