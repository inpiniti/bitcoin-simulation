
/**
 * Naver Finance (Overseas) Discussion API
 * URL: /api/naver/discussion/list
 * Method: GET
 */
export async function fetchNaverDiscussion(ticker) {
    try {
        // Naver uses {TICKER}.O for overseas stocks typically
        const itemCode = `${ticker.toUpperCase()}.O`;
        const params = new URLSearchParams({
            discussionType: 'foreignStock',
            itemCode: itemCode,
            pageSize: '50',
            isHolderOnly: 'false',
            excludesItemNews: 'false',
            isItemNewsOnly: 'false'
        });

        const response = await fetch(`/api/naver/discussion/list?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Naver API Error: ${response.statusText}`);
        }

        const json = await response.json();
        // Naver structure: result.posts[]
        if (json && json.result && Array.isArray(json.result.posts)) {
            return json.result.posts.map(post => ({
                source: 'Naver',
                id: post.discussionId,
                user: post.writer?.nickname || 'Anonymous',
                text: (post.contentSwReplaced || post.contentSwReplacedButImg || post.contents || '').replace(/<br\s*\/?>/gi, '\n'),
                date: post.writtenAt, // ISO string likely
                sentiment: null // Naver doesn't provide structured sentiment easily
            }));
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch Naver discussion:", error);
        return [];
    }
}

/**
 * Stocktwits API
 * URL: /api/stocktwits/streams/symbol/{ticker}.json
 * Method: GET
 */
export async function fetchStocktwitsDiscussion(ticker) {
    try {
        const symbol = ticker.toUpperCase();
        const response = await fetch(`/api/stocktwits/streams/symbol/${symbol}.json`);

        if (!response.ok) {
            if (response.status === 404) return []; // Ticker not found
            throw new Error(`Stocktwits API Error: ${response.statusText}`);
        }

        const json = await response.json();

        if (json && json.messages) {
            return json.messages.map(msg => ({
                source: 'Stocktwits',
                id: msg.id,
                user: msg.user?.username || 'Anonymous',
                text: msg.body,
                date: msg.created_at,
                sentiment: msg.entities?.sentiment?.basic || null // 'Bullish' | 'Bearish'
            }));
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch Stocktwits discussion:", error);
        return [];
    }
}

/**
 * Reddit API
 * URL: /api/reddit/search.json?q={ticker}&sort=new
 * Method: GET
 */
export async function fetchRedditDiscussion(ticker) {
    try {
        // Search for the ticker in recent posts
        const query = `$${ticker.toUpperCase()}`;
        const response = await fetch(`/api/reddit/search.json?q=${encodeURIComponent(query)}&sort=new&limit=25`);

        if (!response.ok) {
            throw new Error(`Reddit API Error: ${response.statusText}`);
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
 * Yahoo Finance (OpenWeb/Spot.IM) API
 * URL: /api/yahoo-conversation/v1/messages-v2/read
 * Method: POST
 */
export async function fetchYahooDiscussion(ticker) {
    try {
        // Spot ID for Yahoo Finance is constant: sp_Dw69v66P
        const SPOT_ID = 'sp_Dw69v66P';
        const conversationId = `${SPOT_ID}_${ticker.toUpperCase()}`;

        const response = await fetch(`/api/yahoo-conversation/v1/messages-v2/read`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-spot-id': SPOT_ID
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                count: 20,
                sort_by: "newest" // best, newest, oldest
            })
        });

        if (!response.ok) {
            throw new Error(`Yahoo Conversation API Error: ${response.statusText}`);
        }

        const json = await response.json();

        if (json && json.messages) {
            return json.messages.map(msg => {
                // Yahoo comments are rich text, but usually content[0].text exists
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
                    sentiment: null // OpenWeb sometimes has it, but it's complex to extract
                };
            });
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch Yahoo discussion:", error);
        return [];
    }
}
