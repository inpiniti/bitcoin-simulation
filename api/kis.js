// Vercel Serverless Function for Korea Investment Securities API Proxy (Single File Handler)
export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, authorization, appkey, appsecret, tr_id, custtype'
    )

    // OPTIONS 요청 처리 (Preflight)
    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    try {
        // 경로 추출 (URL 기반)
        // req.url은 Vercel에서 인덱스 경로를 포함할 수 있으므로 보정
        const fullUrl = req.url || '';
        let targetPath = fullUrl.replace(/^\/api\/kis/, '');

        // 쿼리 스트링 분리
        const [pathOnly, search] = targetPath.split('?');
        targetPath = pathOnly;
        const queryString = search ? `?${search}` : '';

        // 슬래시 중복 제거 및 시작 슬래시 제거
        if (targetPath.startsWith('/')) targetPath = targetPath.substring(1);

        // 기본 도메인 설정 (실전투자 9443포트)
        const domain = 'openapi.koreainvestment.com:9443';
        const targetUrl = `https://${domain}/${targetPath}${queryString}`;

        // 요청 헤더 구성
        const headers = {};

        // 원본 요청의 헤더 중 필요한 것들을 복사 (호스트 관련 제외)
        const skipHeaders = ['host', 'connection', 'content-length'];
        Object.keys(req.headers).forEach(key => {
            if (!skipHeaders.includes(key.toLowerCase())) {
                headers[key] = req.headers[key];
            }
        });

        // 필수 헤더 강제 설정 (있을 경우 덮어쓰기)
        if (!headers['content-type']) {
            headers['content-type'] = 'application/json; charset=utf-8';
        }

        // User-Agent 설정 (비어있으면 기본값)
        if (!headers['user-agent']) {
            headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        }

        const options = {
            method: req.method,
            headers,
        }

        // POST/PUT 요청인 경우 body 처리
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            if (req.body) {
                options.body = (typeof req.body === 'object') ? JSON.stringify(req.body) : req.body;
            } else {
                // 바디가 비어있는데 POST인 경우 등 예외 처리 (필요시)
            }
        }

        console.log(`[KIS Proxy] ${req.method} -> ${targetUrl}`);

        const response = await fetch(targetUrl, options);

        // 응답 상태 코드 복사
        const responseStatus = response.status;

        // 응답 처리
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[KIS Proxy Upstream Error] Status: ${responseStatus}`, errorText);

            try {
                // JSON 형태의 에러면 JSON으로 전달
                const errorJson = JSON.parse(errorText);
                return res.status(responseStatus).json(errorJson);
            } catch (e) {
                // 그렇지 않으면 텍스트로 전달
                return res.status(responseStatus).send(errorText);
            }
        }

        const data = await response.json();
        return res.status(responseStatus).json(data);

    } catch (error) {
        console.error('[KIS Proxy Handler Fatal Error]:', error);
        if (error.cause) console.error('[KIS Proxy Error Cause]:', error.cause);

        return res.status(500).json({
            error: 'Internal Proxy Error',
            message: error.message,
            cause: error.cause ? String(error.cause) : undefined,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
