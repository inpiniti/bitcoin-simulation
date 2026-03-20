import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { isUSDST } from "@/lib/marketTime"
import { isMarketHoliday, isNonTradingDay, getHolidayDates, loadMarketHolidays } from "@/lib/marketHolidays"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

// ─── 지수 가격 훅 ────────────────────────────────────────────────────────────
const INDICES = [
    { symbol: '^GSPC', label: 'S&P500' },
    { symbol: '^IXIC', label: 'NASDAQ' },
]

function useIndexPrices() {
    const [indices, setIndices] = useState([])

    useEffect(() => {
        const fetch5d = async (symbol) => {
            try {
                const res = await fetch(`/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`)
                if (!res.ok) return null
                const json = await res.json()
                const result = json?.chart?.result?.[0]
                if (!result) return null
                const closes = result.indicators.quote[0].close.filter(v => v != null)
                if (closes.length < 2) return null
                const price = closes[closes.length - 1]
                const prev = closes[closes.length - 2]
                const rate = ((price - prev) / prev) * 100
                return { price, rate }
            } catch {
                return null
            }
        }

        const load = async () => {
            const results = await Promise.all(
                INDICES.map(async (idx) => {
                    const data = await fetch5d(idx.symbol)
                    return { label: idx.label, ...data }
                })
            )
            setIndices(results.filter(r => r.price != null))
        }

        load()
        const id = setInterval(load, 5 * 60 * 1000)
        return () => clearInterval(id)
    }, [])

    return indices
}

// ─── 시장 상태 훅 ─────────────────────────────────────────────────────────────
function useMarketStatus() {
    const [status, setStatus] = useState(null)

    useEffect(() => {
        const calc = () => {
            const now = new Date()
            const isSummer = isUSDST(now)

            // 현재 ET 시각 계산
            const etDate = new Date(now.getTime() - (isSummer ? 4 : 5) * 3600 * 1000)
            const etDay = etDate.getDay() // 0=Sun, 6=Sat
            const etTotal = etDate.getUTCHours() * 60 + etDate.getUTCMinutes()

            const PRE_OPEN  = 4 * 60          // 04:00 ET
            const OPEN      = 9 * 60 + 30     // 09:30 ET
            const CLOSE     = 16 * 60         // 16:00 ET
            const AFTER_END = 20 * 60         // 20:00 ET

            // 주말
            if (etDay === 0 || etDay === 6) {
                return { label: '휴장', sub: '주말', color: '#888', minutesLeft: null }
            }

            // 공휴일 (ET 날짜 기준)
            const etDateOnly = new Date(etDate.getUTCFullYear(), etDate.getUTCMonth(), etDate.getUTCDate())
            if (isMarketHoliday(etDateOnly)) {
                return { label: '휴장', sub: '공휴일', color: '#888', minutesLeft: null }
            }

            if (etTotal >= OPEN && etTotal < CLOSE) {
                const left = CLOSE - etTotal
                return { label: '정규장', sub: null, color: '#4ec9b0', minutesLeft: left }
            }
            if (etTotal >= PRE_OPEN && etTotal < OPEN) {
                return { label: '프리마켓', sub: null, color: '#dac422', minutesLeft: null }
            }
            if (etTotal >= CLOSE && etTotal < AFTER_END) {
                return { label: '애프터마켓', sub: null, color: '#f0a040', minutesLeft: null }
            }
            // 야간 (영업일이지만 모든 세션 외)
            return { label: '야간', sub: null, color: '#bbb', minutesLeft: null }
        }

        setStatus(calc())
        const id = setInterval(() => setStatus(calc()), 30000)
        return () => clearInterval(id)
    }, [])

    return status
}

// ─── 시장 캘린더 팝오버 ───────────────────────────────────────────────────────
function MarketCalendar({ children }) {
    const today = new Date()
    const [selected, setSelected] = useState(today)
    const [holidayDates, setHolidayDates] = useState([])

    useEffect(() => {
        const currentYear = today.getFullYear()
        loadMarketHolidays([currentYear - 1, currentYear, currentYear + 1]).then(() => {
            setHolidayDates(getHolidayDates())
        })
    }, [])

    // 주말 + 공휴일 = 선택 불가
    const isDisabled = (date) => isNonTradingDay(date)

    // 공휴일만 별도 스타일 (주말은 DayPicker가 자동 처리)
    const bookedDates = holidayDates

    return (
        <Popover>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent
                align="start"
                side="top"
                sideOffset={6}
                className="w-auto p-0 bg-[#1e1e1e] border border-[#3e3e42] shadow-xl"
            >
                <div className="px-4 pt-3 pb-1 text-xs text-[#9d9d9d] border-b border-[#3e3e42]">
                    <span className="font-semibold text-white">미국 시장 휴장일</span>
                    <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#f44747]" />
                            공휴일
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#555]" />
                            주말
                        </span>
                    </div>
                </div>
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={(d) => d && !isDisabled(d) && setSelected(d)}
                    disabled={isDisabled}
                    modifiers={{ holiday: bookedDates }}
                    modifiersClassNames={{ holiday: "rdp-holiday" }}
                    defaultMonth={today}
                />
            </PopoverContent>
        </Popover>
    )
}

// ─── 메인 StatusBar ───────────────────────────────────────────────────────────
export function StatusBar() {
    const {
        hist, loadingInterval, selectedResult, isAnalyzing, analysisProgress,
        ticker, interval, realtimePrices, wsStatus, autoTradeSettings
    } = useStore()

    const dataCount = hist[interval]?.length || 0
    const isLoading = loadingInterval[interval] || loadingInterval['STOCK_BASE']
    const marketStatus = useMarketStatus()
    const rtPrice = realtimePrices[ticker]
    const indexPrices = useIndexPrices()

    return (
        <div className="h-6 bg-[#007acc] flex items-center px-2 text-white text-[11px] select-none gap-3">
            {/* Left */}
            <div className="flex items-center gap-3 shrink-0">
                {/* 시장 상태 — 클릭 시 캘린더 */}
                {marketStatus && (
                    <MarketCalendar>
                        <button
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                            title="시장 캘린더 보기"
                        >
                            <span style={{ color: marketStatus.color }} className="font-medium">
                                ● {marketStatus.label}
                            </span>
                            {marketStatus.sub && (
                                <span className="text-[#aaa]">({marketStatus.sub})</span>
                            )}
                            {marketStatus.minutesLeft != null && (
                                <span className="opacity-70">
                                    ({Math.floor(marketStatus.minutesLeft / 60)}h {marketStatus.minutesLeft % 60}m 남음)
                                </span>
                            )}
                        </button>
                    </MarketCalendar>
                )}

                {/* WebSocket 연결 */}
                {wsStatus?.connected ? (
                    <span className="text-[#4ec9b0]">⚡ 실시간</span>
                ) : (
                    <span className="text-[#bbb]">⚡ 오프라인</span>
                )}

                {/* 자동 매매 */}
                {autoTradeSettings?.isEnabled && (
                    <span className="text-green-300 font-medium">🤖 자동매매 ON</span>
                )}

                {/* 데이터 로딩 */}
                {isLoading && (
                    <div className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        데이터 로딩...
                    </div>
                )}

                {/* 분석 진행 */}
                {isAnalyzing && (
                    <div className="flex items-center gap-1 bg-[#094771] px-2 rounded-sm">
                        <Loader2 className="w-3 h-3 animate-spin text-orange-300" />
                        <span className="text-orange-100">
                            분석 {analysisProgress.current}/{analysisProgress.total}
                        </span>
                    </div>
                )}
            </div>

            {/* Center: 지수 + 현재 종목 */}
            <div className="flex-1 flex justify-center items-center gap-4">
                {indexPrices.map(idx => (
                    <span key={idx.label} className="flex items-center gap-1">
                        <span className="opacity-70">{idx.label}</span>
                        <span className="font-medium">{idx.price?.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                        <span className={cn("font-medium", idx.rate >= 0 ? "text-[#4ec9b0]" : "text-red-300")}>
                            {idx.rate >= 0 ? '+' : ''}{idx.rate?.toFixed(2)}%
                        </span>
                    </span>
                ))}
                {indexPrices.length > 0 && <span className="opacity-40">|</span>}
                <span>
                    {ticker} ({interval}) | 데이터: <strong>{dataCount.toLocaleString()}</strong>개
                    {rtPrice?.price && (
                        <span className="ml-2">
                            ${rtPrice.price.toLocaleString()}
                            {rtPrice.rate != null && (
                                <span className={cn("ml-1", rtPrice.rate >= 0 ? "text-[#4ec9b0]" : "text-red-300")}>
                                    {rtPrice.rate >= 0 ? '+' : ''}{rtPrice.rate?.toFixed(2)}%
                                </span>
                            )}
                        </span>
                    )}
                </span>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3 shrink-0">
                {selectedResult && (
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[10px]",
                        selectedResult.summary?.totalProfit >= 0 ? "bg-green-600" : "bg-red-600"
                    )}>
                        {selectedResult.summary?.totalProfit >= 0 ? '+' : ''}
                        {selectedResult.summary?.totalProfit?.toLocaleString()}원
                    </span>
                )}
                <span>주식 시뮬레이터 v2.0</span>
            </div>
        </div>
    )
}
