// Vercel Serverless Function for Korea Investment Securities API Proxy
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
        // 경로 및 쿼리 파라미터 분리
        const { path, ...queryParams } = req.query
        const targetPath = Array.isArray(path) ? path.join('/') : path || ''

        // 쿼리 스트링 재구성 (GET 요청 등에 필수)
        const queryString = new URLSearchParams(queryParams).toString()
        const targetUrl = `https://openapi.koreainvestment.com:9443/${targetPath}${queryString ? '?' + queryString : ''}`

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
            // Vercel은 JSON body를 자동으로 파싱하여 객체로 제공할 수 있음
            options.body = (typeof req.body === 'object') ? JSON.stringify(req.body) : req.body
        }

        console.log(`[KIS Proxy] ${req.method} ${targetUrl}`)

        const response = await fetch(targetUrl, options)
        const data = await response.json()

        res.status(response.status).json(data)
    } catch (error) {
        console.error('[KIS Proxy Error]:', error)
        res.status(500).json({ error: error.message })
    }
}
