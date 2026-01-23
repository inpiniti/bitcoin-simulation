/**
 * Nasdaq API로부터 실적 및 기타 금융 데이터를 가져오는 Vercel 서버리스 함수입니다.
 * 
 * @param {import('@vercel/node').VercelRequest} request - HTTP 요청 객체
 * @param {import('@vercel/node').VercelResponse} response - HTTP 응답 객체
 * @returns {Promise<void>} Nasdaq API의 JSON 응답 반환
 */
export default async function handler(request, response) {
    // CORS Settings
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    const { url } = request;
    const nasdaqPath = url.replace(/^\/api\/nasdaq/, '/api');
    const TARGET_URL = `https://api.nasdaq.com${nasdaqPath}`;

    try {
        console.log(`[Vercel Function] Proxying to Nasdaq: ${TARGET_URL}`);

        const apiResponse = await fetch(TARGET_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://www.nasdaq.com',
                'Referer': 'https://www.nasdaq.com/'
            }
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`Nasdaq API returned ${apiResponse.status}: ${errorText.substring(0, 100)}`);
        }

        const data = await apiResponse.json();

        // Cache for 1 hour for earnings data
        response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
        response.status(200).json(data);
    } catch (error) {
        console.error('Nasdaq API Proxy Error:', error);
        response.status(500).json({ error: 'Failed to fetch data from Nasdaq', details: error.message });
    }
}
