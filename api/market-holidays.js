/**
 * /api/market-holidays?years=2025,2026
 * NYSE 주식 시장 공식 휴장일을 반환합니다.
 *
 * NYSE 휴장일 = 미국 연방 공휴일 중 NYSE가 쉬는 날 + Good Friday
 * 참고: https://www.nyse.com/markets/hours-calendars
 */

// NYSE가 쉬는 연방공휴일 key 목록 (date-holidays 기준)
const NYSE_HOLIDAY_KEYS = new Set([
    "New Year's Day",
    "Martin Luther King Jr. Day",
    "Washington's Birthday",   // Presidents' Day
    "Memorial Day",
    "Juneteenth National Independence Day",
    "Independence Day",
    "Labor Day",
    "Thanksgiving Day",
    "Christmas Day",
])

/**
 * Easter Sunday 날짜 계산 (Anonymous Gregorian algorithm)
 * @param {number} year
 * @returns {Date}
 */
function getEaster(year) {
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1 // 0-indexed
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(year, month, day)
}

/**
 * NYSE observed date 규칙 적용
 * - 토요일 → 금요일
 * - 일요일 → 월요일
 */
function applyObserved(date) {
    const day = date.getDay()
    if (day === 6) { // Saturday → Friday
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
    }
    if (day === 0) { // Sunday → Monday
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    }
    return date
}

function toYMD(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

async function getNYSEHolidays(years) {
    const { default: Holidays } = await import('date-holidays')
    const hd = new Holidays('US')

    const results = {}

    for (const year of years) {
        const all = hd.getHolidays(year)
        const holidays = []

        // 연방 공휴일 중 NYSE 휴장일 필터
        for (const h of all) {
            if (h.type !== 'public') continue
            if (!NYSE_HOLIDAY_KEYS.has(h.name)) continue

            const date = new Date(h.date)
            const observed = applyObserved(date)
            holidays.push({
                date: toYMD(observed),
                name: h.name,
            })
        }

        // Good Friday 추가 (Easter - 2일)
        const easter = getEaster(year)
        const goodFriday = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2)
        holidays.push({
            date: toYMD(goodFriday),
            name: 'Good Friday',
        })

        // 날짜순 정렬
        holidays.sort((a, b) => a.date.localeCompare(b.date))
        results[year] = holidays
    }

    return results
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=86400') // 1일 캐시

    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    try {
        const url = new URL(req.url, `http://${req.headers.host}`)
        const yearsParam = url.searchParams.get('years') || ''
        const currentYear = new Date().getFullYear()
        const years = yearsParam
            ? yearsParam.split(',').map(Number).filter(y => y >= 2020 && y <= 2030)
            : [currentYear, currentYear + 1]

        const holidays = await getNYSEHolidays(years)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ holidays }))
    } catch (e) {
        console.error('[market-holidays]', e)
        res.statusCode = 500
        res.end(JSON.stringify({ error: e.message }))
    }
}
