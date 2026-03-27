/**
 * Gemini API 멀티 키 로드 밸런서
 * VITE_GEMINI_API_KEY 환경 변수에서 쉼표로 구분된 여러 키를 파싱하여
 * 라운드 로빈 방식으로 분배합니다.
 */

// 키 목록 파싱 (쉼표 구분, 공백 제거)
const rawKeys = (import.meta.env.VITE_GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean)

// 각 키의 상태 관리 { key: string, rateLimitedUntil: number }
const keyStates = rawKeys.map(key => ({ key, rateLimitedUntil: 0 }))

// 라운드 로빈 인덱스 (모듈 레벨 상태)
let currentIndex = 0

/**
 * 다음 사용 가능한 Gemini API 키를 반환합니다.
 * Rate-limited 키는 냉각 시간이 지날 때까지 건너뜁니다.
 * 사용 가능한 키가 없으면 null을 반환합니다.
 *
 * @returns {string|null} API 키 또는 null
 */
export function getNextKey() {
    if (keyStates.length === 0) return null

    const now = Date.now()
    const total = keyStates.length

    // 한 바퀴를 돌면서 사용 가능한 키 탐색
    for (let i = 0; i < total; i++) {
        const idx = (currentIndex + i) % total
        const state = keyStates[idx]

        if (state.rateLimitedUntil <= now) {
            // 다음 호출을 위해 인덱스를 전진
            currentIndex = (idx + 1) % total
            return state.key
        }
    }

    // 모든 키가 Rate-limited 상태
    console.warn('[GeminiKeyManager] 모든 Gemini API 키가 rate-limited 상태입니다.')
    return null
}

/**
 * 특정 키를 일정 시간 동안 Rate-limited 상태로 표시합니다.
 * 429 응답을 받았을 때 호출합니다.
 *
 * @param {string} key - Rate-limited 상태로 표시할 API 키
 * @param {number} [cooldownMs=60000] - 냉각 시간 (밀리초, 기본 60초)
 */
export function markRateLimited(key, cooldownMs = 60000) {
    const state = keyStates.find(s => s.key === key)
    if (state) {
        state.rateLimitedUntil = Date.now() + cooldownMs
        console.warn(`[GeminiKeyManager] 키 ...${key.slice(-6)} rate-limited. ${cooldownMs / 1000}초 후 재사용 가능.`)
    }
}

/**
 * 현재 등록된 키 수를 반환합니다.
 * @returns {number}
 */
export function getKeyCount() {
    return keyStates.length
}
