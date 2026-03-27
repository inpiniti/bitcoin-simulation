/**
 * 백엔드 뉴스 API 클라이언트
 * VITE_BACKEND_URL 환경 변수를 기반으로 백엔드에 요청합니다.
 */
import { format } from 'date-fns'

const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'https://inpiniti-bitcoin-ai-backend.hf.space'

/**
 * KST 기준 오늘 날짜를 'YYYY-MM-DD' 형식으로 반환합니다.
 * @returns {string}
 */
function getTodayKST() {
    // KST = UTC+9
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    const kstDate = new Date(now.getTime() + kstOffset)
    return format(kstDate, 'yyyy-MM-dd')
}

/**
 * 특정 날짜의 뉴스 목록을 조회합니다.
 *
 * @param {string} [date] - 'YYYY-MM-DD' 형식의 날짜. 미지정 시 KST 기준 오늘.
 * @returns {Promise<{ date: string, count: number, items: Array }>}
 */
export async function fetchNewsByDate(date) {
    const targetDate = date || getTodayKST()
    const url = `${BACKEND_URL}/news?date=${encodeURIComponent(targetDate)}`

    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`뉴스 조회 실패 (${response.status}): ${response.statusText}`)
    }

    return response.json()
}

/**
 * 뉴스 크롤링을 트리거합니다.
 *
 * @returns {Promise<Object>} 서버 응답
 */
export async function triggerNewsCrawl() {
    const url = `${BACKEND_URL}/news/crawl`

    const response = await fetch(url, { method: 'POST' })
    if (!response.ok) {
        throw new Error(`뉴스 크롤링 실패 (${response.status}): ${response.statusText}`)
    }

    return response.json()
}

/**
 * 뉴스 AI 분석을 트리거합니다.
 *
 * @returns {Promise<Object>} 서버 응답
 */
export async function triggerNewsAnalyze() {
    const url = `${BACKEND_URL}/news/analyze`

    const response = await fetch(url, { method: 'POST' })
    if (!response.ok) {
        throw new Error(`뉴스 분석 실패 (${response.status}): ${response.statusText}`)
    }

    return response.json()
}
