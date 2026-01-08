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
        const url = new URL(req.url, `http://${req.headers.host}`)
        const pathname = url.pathname

        // '/api/kis/' 제거하여 타겟 경로 추출
        // 예: /api/kis/oauth2/tokenP -> oauth2/tokenP
        let targetPath = pathname.replace(/^\/api\/kis/, '');
        if (targetPath.startsWith('/')) targetPath = targetPath.substring(1);

        const search = url.search // ?query=string

        const targetUrl = `https://openapi.koreainvestment.com:9443/${targetPath}${search}`

        // 요청 헤더 복사 (필요한 것만)
        const headers = {
            'Content-Type': req.headers['content-type'] || 'application/json; charset=utf-8',
        }

        // KIS API 전용 헤더 추가
        if (req.headers['authorization']) headers['authorization'] = req.headers['authorization']
        if (req.headers['appkey']) headers['appkey'] = req.headers['appkey']
        if (req.headers['appsecret']) headers['appsecret'] = req.headers['appsecret']
        if (req.headers['tr_id']) headers['tr_id'] = req.headers['tr_id']
        if (req.headers['custtype']) headers['custtype'] = req.headers['custtype']

        const options = {
            method: req.method,
            headers,
        }

        // POST 요청인 경우 body 추가
        if (req.method === 'POST' && req.body) {
            options.body = (typeof req.body === 'object') ? JSON.stringify(req.body) : req.body
        }

        console.log(`[KIS Proxy] ${req.method} ${targetUrl}`)

        const response = await fetch(targetUrl, options)

        // 응답 처리
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[KIS Proxy Error] Upstream ${response.status}:`, errorText);
            // JSON으로 파싱 시도 후 실패하면 text 그대로 전달
            try {
                res.status(response.status).json(JSON.parse(errorText));
            } catch (e) {
                res.status(response.status).send(errorText);
            }
            return;
        }

        const data = await response.json()
        res.status(response.status).json(data)

    } catch (error) {
        console.error('[KIS Proxy Handler Error]:', error)
        res.status(500).json({ error: error.message })
    }
}
