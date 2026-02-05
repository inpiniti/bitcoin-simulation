export default async function handler(req, res) {
    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // 경로 추출
        // /api/xgb/predict -> /predict
        const fullUrl = req.url || '';
        let targetPath = fullUrl.replace(/^\/api\/xgb\/?/, ''); // 뒤쪽 슬래시도 포함해서 제거

        // 쿼리 스트링 분리
        const [pathOnly, search] = targetPath.split('?');
        targetPath = pathOnly;
        const queryString = search ? `?${search}` : '';

        // 슬래시 정리
        if (targetPath.startsWith('/')) targetPath = targetPath.substring(1);
        if (targetPath === '') targetPath = ''; // 루트 경로 처리

        // 타겟 URL 설정 (Hugging Face Backend)
        const baseUrl = 'https://younginpiniti-bitcoin-ai-backend.hf.space/v1/xgb';
        const targetUrl = targetPath ? `${baseUrl}/${targetPath}${queryString}` : `${baseUrl}${queryString}`;

        console.log(`[XGB Proxy] ${req.method} ${fullUrl} -> ${targetUrl}`);

        const headers = {
            "Content-Type": "application/json"
        };

        // Authorization 헤더가 있으면 전달 (혹시 나중에 필요할 경우)
        if (req.headers.authorization) {
            headers["Authorization"] = req.headers.authorization;
        }

        const options = {
            method: req.method,
            headers,
        };

        if (req.body && (req.method === 'POST' || req.method === 'PUT')) {
            options.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
        }

        const response = await fetch(targetUrl, options);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[XGB Proxy Error] Status: ${response.status}`, errorText);
            return res.status(response.status).send(errorText);
        }

        // 응답이 JSON이면 파싱해서 반환, 아니면 텍스트 반환
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            return res.status(response.status).json(data);
        } else {
            const text = await response.text();
            return res.status(response.status).send(text);
        }

    } catch (error) {
        console.error('[XGB Proxy Fatal Error]:', error);
        return res.status(500).json({ error: 'Internal Proxy Error', message: error.message });
    }
}
