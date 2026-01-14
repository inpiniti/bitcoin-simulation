/**
 * 종목 토론 API 클라이언트
 * Vercel 서버리스 함수를 통해 데이터를 조회합니다.
 * 로컬 개발 환경에서는 Vite 프록시를 사용합니다.
 */

const API_BASE = '/api/discussion';

/**
 * 통합 API 호출 함수
 * @param {string} ticker - 종목 티커
 * @param {string} source - 소스 ('naver' | 'stocktwits' | 'reddit' | 'yahoo' | 'toss')
 * @returns {Promise<Array>} 토론 게시글 목록
 */
async function fetchDiscussionFromAPI(ticker, source) {
    try {
        const response = await fetch(`${API_BASE}?ticker=${encodeURIComponent(ticker)}&source=${source}`);

        if (!response.ok) {
            console.warn(`Discussion API Error (${source}): ${response.status}`);
            return [];
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error(`Failed to fetch ${source} discussion:`, error);
        return [];
    }
}

/**
 * Naver Finance (Overseas) Discussion API
 */
export async function fetchNaverDiscussion(ticker) {
    // 프로덕션에서는 통합 API 사용
    if (import.meta.env.PROD) {
        return fetchDiscussionFromAPI(ticker, 'naver');
    }

    // 로컬 개발에서는 Vite 프록시 사용
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

        const response = await fetch(`/api/naver/discussion/list?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Naver API Error: ${response.statusText}`);
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
 * Stocktwits API
 */
export async function fetchStocktwitsDiscussion(ticker) {
    // 프로덕션과 로컬 모두 통합 API 사용 (Stocktwits는 직접 호출 불가)
    return fetchDiscussionFromAPI(ticker, 'stocktwits');
}

/**
 * Toss Invest API (토스증권 종목 토론)
 */
export async function fetchTossDiscussion(ticker) {
    // 프로덕션과 로컬 모두 통합 API 사용
    return fetchDiscussionFromAPI(ticker, 'toss');
}
