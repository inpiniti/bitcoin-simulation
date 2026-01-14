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
 * 검색 API로 productCode 획득 후 댓글 API 호출
 */
async function fetchTossDiscussion(ticker) {
    try {
        const symbol = ticker.toUpperCase();
        const TOSS_BASE_URL = 'https://wts-cert-api.tossinvest.com/api';

        // Step 1: 티커로 productCode 검색
        const screenerResponse = await fetch(`${TOSS_BASE_URL}/v3/search-all/wts-auto-complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
            },
            body: JSON.stringify({
                query: symbol,
                sections: [
                    { type: 'SCREENER' },
                    { type: 'NEWS' },
                    { type: 'PRODUCT', option: { addIntegratedSearchResult: true } },
                    { type: 'TICS' }
                ]
            })
        });

        if (!screenerResponse.ok) {
            console.error(`[Toss] Screener API Error: ${screenerResponse.status}`);
            return [];
        }

        const screenerData = await screenerResponse.json();

        // productCode 추출
        let productCode = null;
        try {
            if (Array.isArray(screenerData?.result)) {
                for (const section of screenerData.result) {
                    if (section?.type === 'PRODUCT' && section?.data?.items?.length) {
                        productCode = section.data.items[0]?.productCode;
                        if (productCode) break;
                    }
                }
            } else if (screenerData?.result?.data?.items?.length) {
                productCode = screenerData.result.data.items[0]?.productCode;
            }
        } catch (e) {
            console.error('[Toss] Error extracting productCode:', e.message);
        }

        if (!productCode) {
            console.warn(`[Toss] Could not find productCode for: ${symbol}`);
            return [];
        }

        console.log(`[Toss] Found productCode: ${productCode}`);

        // Step 2: productCode로 댓글 조회
        const communityResponse = await fetch(`${TOSS_BASE_URL}/v3/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
            },
            body: JSON.stringify({
                subjectId: productCode,
                subjectType: 'STOCK',
                commentSortType: 'RECENT'
            })
        });

        if (!communityResponse.ok) {
            console.error(`[Toss] Community API Error: ${communityResponse.status}`);
            return [];
        }

        const communityData = await communityResponse.json();

        // 댓글 추출 (다양한 응답 구조 지원)
        let comments = [];
        try {
            if (Array.isArray(communityData?.result?.comments)) {
                comments = communityData.result.comments;
            } else if (Array.isArray(communityData?.result?.comments?.body)) {
                comments = communityData.result.comments.body;
            } else if (Array.isArray(communityData?.comments)) {
                comments = communityData.comments;
            } else if (Array.isArray(communityData)) {
                comments = communityData;
            }
        } catch (e) {
            console.warn('[Toss] Error extracting comments:', e.message);
        }

        return comments.slice(0, 30).map(comment => ({
            source: 'Toss',
            id: comment.id,
            user: comment.author?.nickname || 'Anonymous',
            text: comment.message || '',
            date: comment.updatedAt || new Date().toISOString(),
            sentiment: null
        }));
    } catch (error) {
        console.error("Failed to fetch Toss discussion:", error);
        return [];
    }
}

// Naver, Stocktwits, Toss 지원
// Reddit, Yahoo 삭제됨

export default async function handler(request) {
    const url = new URL(request.url);
    const ticker = url.searchParams.get('ticker');
    const source = url.searchParams.get('source'); // 'naver' | 'stocktwits' | 'toss' | 'all'

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
