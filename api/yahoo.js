export default async function handler(request, response) {
    // CORS 설정
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    // /api/yahoo 이후의 경로 가져오기
    // Vercel Rewrite를 통해 들어오므로 request.url은 원본 경로(/api/yahoo/...)를 유지할 수 있음
    // 만약 destination이 /api/yahoo 라면 request.url이 /api/yahoo?path=... 처럼 될 수도 있지만,
    // rewrite: source -> destination 방식에서는 request.url이 원본 URL임.
    // /api/yahoo/v8/finance/chart/AAPL...

    // 쿼리 스트링 파싱을 위해 URL 객체 사용
    const url = new URL(request.url, `http://${request.headers.host}`);

    // 경로 부분 추출 (/api/yahoo/v8/finance/chart/AAPL)
    const pathname = url.pathname;

    // /api/yahoo 제거
    const targetPath = pathname.replace(/^\/api\/yahoo/, '');

    // 쿼리 스트링 유지 (interval=1d&range=365d)
    const search = url.search;

    if (!targetPath) {
        return response.status(400).json({ error: 'Path is required' });
    }

    const targetUrl = `https://query1.finance.yahoo.com${targetPath}${search}`;
    console.log(`Proxying to: ${targetUrl}`);

    try {
        const apiResponse = await fetch(targetUrl);

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`Upstream API Error (${apiResponse.status}): ${errorText}`);
            return response.status(apiResponse.status).send(errorText);
        }

        const data = await apiResponse.json();

        // CDN 캐시 설정: 1시간 캐시, 24시간까지 백그라운드 갱신
        // 주식 일봉 데이터는 하루에 한 번 크게 변하므로 1시간 정도의 캐시는 합리적임
        response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

        response.status(200).json(data);
    } catch (error) {
        console.error('Yahoo Proxy Error:', error);
        response.status(500).json({ error: 'Failed to fetch data' });
    }
}
