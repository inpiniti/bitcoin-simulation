export default async function handler(request, response) {
    // CORS 설정
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    // GET 요청 시 헬스체크 (기본 모델 상태 확인)
    if (request.method === 'GET') {
        return response.status(200).json({ status: 'ok', message: 'HF Proxy is running' });
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const hfToken = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN;

    try {
        const { inputs, model = "ProsusAI/finbert", options = {} } = request.body;

        if (!inputs && !options.wait_for_model) {
            return response.status(400).json({ error: 'Inputs are required' });
        }

        const targetUrl = `https://router.huggingface.co/hf-inference/models/${model}`;

        const headers = {
            "Content-Type": "application/json"
        };

        if (hfToken) {
            headers["Authorization"] = `Bearer ${hfToken}`;
        }

        const apiResponse = await fetch(targetUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                inputs: inputs || "ping", // inputs가 없으면 더미 데이터
                options: {
                    wait_for_model: true,
                    ...options
                }
            }),
        });

        // 503 Service Unavailable은 모델 로딩 중임을 의미
        if (apiResponse.status === 503) {
            const data = await apiResponse.json();
            return response.status(503).json(data);
        }

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`HF API Error (${apiResponse.status}): ${errorText}`);
            return response.status(apiResponse.status).send(errorText);
        }

        const data = await apiResponse.json();
        response.status(200).json(data);
    } catch (error) {
        console.error('HF Proxy Error:', error);
        response.status(500).json({ error: 'Failed to process HF request' });
    }
}
