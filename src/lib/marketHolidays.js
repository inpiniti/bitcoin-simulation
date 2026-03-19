/**
 * NYSE 주식 시장 휴장일 관리
 * /api/market-holidays 엔드포인트에서 동적으로 가져옵니다.
 */

let cache = {
    dates: new Set(),   // "YYYY-MM-DD" Set for O(1) lookup
    meta: [],           // [{ date, name }]
    fetchedYears: new Set(),
    lastFetch: 0,
}

/**
 * NYSE 휴장일 로드 (메모리 캐시, 24시간 유효)
 * @param {number[]} years - 가져올 연도 목록 (기본: 올해 + 내년)
 */
export async function loadMarketHolidays(years) {
    const currentYear = new Date().getFullYear()
    const targetYears = years ?? [currentYear, currentYear + 1]

    const missing = targetYears.filter(y => !cache.fetchedYears.has(y))
    if (missing.length === 0) return

    try {
        const res = await fetch(`/api/market-holidays?years=${missing.join(',')}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()

        for (const [year, list] of Object.entries(json.holidays)) {
            cache.fetchedYears.add(Number(year))
            for (const item of list) {
                cache.dates.add(item.date)
                cache.meta.push(item)
            }
        }
        cache.lastFetch = Date.now()
    } catch (e) {
        console.warn('[marketHolidays] fetch failed, falling back to empty:', e.message)
    }
}

/**
 * 특정 날짜가 NYSE 공휴일인지 확인
 * @param {Date} date
 * @returns {boolean}
 */
export function isMarketHoliday(date) {
    const str = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return cache.dates.has(str)
}

/**
 * 특정 날짜가 거래 불가능한 날인지 확인 (주말 + 공휴일)
 * @param {Date} date
 * @returns {boolean}
 */
export function isNonTradingDay(date) {
    const day = date.getDay()
    return day === 0 || day === 6 || isMarketHoliday(date)
}

/**
 * 로드된 공휴일 Date 배열 반환 (달력 표시용)
 * @returns {Date[]}
 */
export function getHolidayDates() {
    return cache.meta.map(({ date }) => {
        const [y, m, d] = date.split('-').map(Number)
        return new Date(y, m - 1, d)
    })
}
