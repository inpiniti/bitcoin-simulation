// 종목 토론 데이터 조회 Vercel Serverless Function
// Naver, Stocktwits, Reddit, Yahoo, Toss 통합 API

export const config = {
    runtime: 'edge', // Edge Runtime for better performance
};

/**
 * Naver Finance 종목토론 스크래핑
 */
async function fetchNaverDiscussion(ticker) {
    try {
        const itemCode = `${ticker.toUpperCase()}.O`;
        const params = new URLSearchParams({
            discussionType: 'foreignStock',
            itemCode: itemCode,
            pageSize: '50',
            isHolderOnly: 'false',
            excludesItemNews: 'false',
            isItemNewsOnly: 'false'
        });

        const response = await fetch(`https://m.stock.naver.com/front-api/discussion/list?${params.toString()}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'application/json',
                'Referer': 'https://m.stock.naver.com/'
            }
        });

        if (!response.ok) {
            console.error(`Naver API Error: ${response.status}`);
            return [];
        }

        const json = await response.json();
        if (json && json.result && Array.isArray(json.result.posts)) {
            return json.result.posts.map(post => ({
                source: 'Naver',
                id: post.discussionId,
                user: post.writer?.nickname || 'Anonymous',
                text: (post.contentSwReplaced || post.contentSwReplacedButImg || post.contents || '').replace(/<br\s*\/?>/gi, '\n'),
                date: post.writtenAt,
                sentiment: null
            }));
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch Naver discussion:", error);
        return [];
    }
}

/**
 * Stocktwits 스크래핑 (웹페이지에서 직접)
 */
async function fetchStocktwitsDiscussion(ticker) {
    try {
        const symbol = ticker.toUpperCase();
        // Stocktwits API는 봇 차단이 심하므로, 웹페이지 스크래핑 시도
        const response = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://stocktwits.com/'
            }
        });

        if (!response.ok) {
            console.error(`Stocktwits API Error: ${response.status}`);
            // 차단된 경우 빈 배열 반환
            return [];
        }

        const json = await response.json();

        if (json && json.messages) {
            return json.messages.slice(0, 30).map(msg => ({
                source: 'Stocktwits',
                id: msg.id,
                user: msg.user?.username || 'Anonymous',
                text: msg.body,
                date: msg.created_at,
                sentiment: msg.entities?.sentiment?.basic || null
            }));
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch Stocktwits discussion:", error);
        return [];
    }
}

/**
 * Reddit 종목 토론 조회
 */
async function fetchRedditDiscussion(ticker) {
    try {
        const query = `$${ticker.toUpperCase()}`;
        const response = await fetch(
            `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=25`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        );

        if (!response.ok) {
            console.error(`Reddit API Error: ${response.status}`);
            return [];
        }

        const json = await response.json();

        if (json && json.data && Array.isArray(json.data.children)) {
            return json.data.children.map(child => {
                const post = child.data;
                const date = new Date(post.created_utc * 1000).toISOString();
                return {
                    source: 'Reddit',
                    id: post.id,
                    user: post.author,
                    text: `[${post.subreddit_name_prefixed}] ${post.title}\n${post.selftext ? post.selftext.substring(0, 200) + (post.selftext.length > 200 ? '...' : '') : ''}`,
                    date: date,
                    sentiment: null
                };
            });
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch Reddit discussion:", error);
        return [];
    }
}

/**
 * Yahoo Finance 종목 토론 (OpenWeb API)
 */
async function fetchYahooDiscussion(ticker) {
    try {
        const symbol = ticker.toUpperCase();
        const SPOT_ID = 'sp_Dw69v66P';
        const conversationId = `${SPOT_ID}_${symbol}`;

        // OpenWeb API 엔드포인트들 (도메인이 변경될 수 있음)
        const apiUrls = [
            'https://open-amp.api.openweb.com/v1/messages-v2/read',
            'https://api-v2.spot.im/v1/messages-v2/read',
            'https://open-api.spot.im/v1/messages-v2/read'
        ];

        for (const apiUrl of apiUrls) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-spot-id': SPOT_ID,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Origin': 'https://finance.yahoo.com',
                        'Referer': 'https://finance.yahoo.com/'
                    },
                    body: JSON.stringify({
                        conversation_id: conversationId,
                        count: 20,
                        sort_by: "newest"
                    })
                });

                if (response.ok) {
                    const json = await response.json();
                    if (json && json.messages) {
                        return json.messages.map(msg => {
                            let text = "";
                            if (msg.content && Array.isArray(msg.content)) {
                                text = msg.content.map(c => c.text || "").join(" ");
                            } else {
                                text = "No content";
                            }

                            return {
                                source: 'Yahoo',
                                id: msg.id,
                                user: msg.user_name || 'Anonymous',
                                text: text,
                                date: new Date(msg.written_at * 1000).toISOString(),
                                sentiment: null
                            };
                        });
                    }
                }
            } catch (e) {
                console.warn(`Yahoo fetch failed for ${apiUrl}: ${e.message}`);
            }
        }

        return [];
    } catch (error) {
        console.error("Failed to fetch Yahoo discussion:", error);
        return [];
    }
}

/**
 * 토스증권 (Toss Invest) 종목 토론 스크래핑
 */
/**
 * 토스증권 (Toss Invest) 종목 토론 스크래핑
 */
async function fetchTossDiscussion(ticker) {
    try {
        const symbol = ticker.toUpperCase();

        // 0단계: 주요 종목 ISIN 하드코딩 매핑
        const isinMap = {
            'AAPL': 'US0378331005',
            'TSLA': 'US88160R1014',
            'MSFT': 'US5949181045',
            'AMZN': 'US0231351067',
            'GOOGL': 'US02079K3059',
            'NVDA': 'US67066G1040',
            'INTU': 'US4612021034',
            'AMD': 'US0079031078',
            'QQQ': 'US46090E1038',
            'SPY': 'US78462F1030',
            'TQQQ': 'US74347X8314',
            'SQQQ': 'US74347G4322',
            'SOXL': 'US25459W4583',
            'SOXS': 'US25460G5188'
        };

        // 1. ISIN 매핑 확인
        let isin = isinMap[symbol];

        // 2. 매핑 없으면 검색 API 시도 (하지만 현재 작동 불명확하므로 생략)
        // 3. 리다이렉트 시도 (페이지 fetch)
        if (!isin) {
            try {
                const pageUrl = `https://www.tossinvest.com/stocks/${symbol}`;
                const pageResponse = await fetch(pageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
                        'Accept': 'text/html'
                    },
                    redirect: 'manual'
                });
                const location = pageResponse.headers.get('location');
                if (location && location.includes('/stocks/')) {
                    const isinMatch = location.match(/\/stocks\/([A-Z0-9]+)/);
                    if (isinMatch) isin = isinMatch[1];
                }
            } catch (e) {
                console.warn(`Toss redirect check failed: ${e.message}`);
            }
        }

        if (isin) {
            // 토스증권 API 엔드포인트
            const response = await fetch(`https://www.tossinvest.com/api/community/v2/securities/${isin}/posts?size=30&sort=latest`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                    'Accept': 'application/json',
                    'Referer': 'https://tossinvest.com/'
                }
            });

            if (!response.ok) {
                console.error(`Toss API Error: ${response.status}`);
                return [];
            }

            const json = await response.json();

            if (json && Array.isArray(json.posts)) {
                return json.posts.slice(0, 30).map(post => ({
                    source: 'Toss',
                    id: post.id,
                    user: post.author?.displayName || post.author?.nickname || 'Anonymous',
                    text: post.content || post.body || '',
                    date: post.createdAt || post.created_at,
                    sentiment: null,
                    likes: post.likeCount || 0,
                    comments: post.commentCount || 0
                }));
            }
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch Toss discussion:", error);
        return [];
    }
}

export default async function handler(request) {
    const url = new URL(request.url);
    const ticker = url.searchParams.get('ticker');
    const source = url.searchParams.get('source'); // 'naver' | 'stocktwits' | 'reddit' | 'yahoo' | 'toss' | 'all'

    if (!ticker) {
        return new Response(JSON.stringify({ error: 'Ticker is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        let result = [];

        if (source === 'naver' || source === 'all') {
            const naverData = await fetchNaverDiscussion(ticker);
            result = result.concat(naverData);
        }

        if (source === 'stocktwits' || source === 'all') {
            const stocktwitsData = await fetchStocktwitsDiscussion(ticker);
            result = result.concat(stocktwitsData);
        }

        if (source === 'reddit' || source === 'all') {
            const redditData = await fetchRedditDiscussion(ticker);
            result = result.concat(redditData);
        }

        if (source === 'yahoo' || source === 'all') {
            const yahooData = await fetchYahooDiscussion(ticker);
            result = result.concat(yahooData);
        }

        if (source === 'toss' || source === 'all') {
            const tossData = await fetchTossDiscussion(ticker);
            result = result.concat(tossData);
        }

        // 날짜순 정렬 (최신순)
        result.sort((a, b) => new Date(b.date) - new Date(a.date));

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=60, stale-while-revalidate=120'
            }
        });
    } catch (error) {
        console.error('Discussion API Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
