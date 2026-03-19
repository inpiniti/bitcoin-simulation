import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { isUSDST, getUSMarketCloseTime } from "@/lib/marketTime"

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
        const id = setInterval(load, 5 * 60 * 1000) // 5분마다 갱신
        return () => clearInterval(id)
    }, [])

    return indices
}

function useMarketStatus() {
    const [status, setStatus] = useState(null)

    useEffect(() => {
        const calc = () => {
            const now = new Date()
            const isSummer = isUSDST(now)
            const offsetHours = isSummer ? 13 : 14 // KST = ET + 13(summer) or 14(winter)

            // 현재 ET 시간 계산
            const etHour = (now.getUTCHours() - (isSummer ? 4 : 5) + 24) % 24
            const etMin = now.getUTCMinutes()
            const etTotal = etHour * 60 + etMin
            const dayOfWeek = now.getDay() // 0=Sun, 6=Sat (KST 기준이지만 근사값으로 사용)

            // ET 기준 분 단위
            const OPEN = 9 * 60 + 30   // 9:30
            const CLOSE = 16 * 60      // 16:00
            const PRE = 4 * 60         // 4:00
            const AFTER = 20 * 60      // 20:00

            // 주말 체크 (ET 기준 간략화)
            const etDate = new Date(now.getTime() - (isSummer ? 4 : 5) * 3600000)
            const etDay = etDate.getDay()

            if (etDay === 0 || etDay === 6) {
                return { label: '휴장', color: '#888', bg: 'transparent', minutesLeft: null }
            }

            if (etTotal >= OPEN && etTotal < CLOSE) {
                const left = CLOSE - etTotal
                return { label: '정규장', color: '#4ec9b0', bg: '#094771', minutesLeft: left }
            }
            if (etTotal >= PRE && etTotal < OPEN) {
                return { label: '프리마켓', color: '#dac422', bg: 'transparent', minutesLeft: null }
            }
            if (etTotal >= CLOSE && etTotal < AFTER) {
                return { label: '애프터마켓', color: '#f0a040', bg: 'transparent', minutesLeft: null }
            }
            return { label: '휴장', color: '#888', bg: 'transparent', minutesLeft: null }
        }

        setStatus(calc())
        const id = setInterval(() => setStatus(calc()), 30000)
        return () => clearInterval(id)
    }, [])

    return status
}

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
                {/* 시장 상태 */}
                {marketStatus && (
                    <span style={{ color: marketStatus.color }} className="font-medium">
                        ● {marketStatus.label}
                        {marketStatus.minutesLeft != null && (
                            <span className="ml-1 opacity-80">
                                ({Math.floor(marketStatus.minutesLeft / 60)}h {marketStatus.minutesLeft % 60}m 남음)
                            </span>
                        )}
                    </span>
                )}

                {/* WebSocket 연결 */}
                {wsStatus?.connected ? (
                    <span className="text-[#4ec9b0]">⚡ 실시간</span>
                ) : (
                    <span className="text-[#888]">⚡ 오프라인</span>
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
                {indexPrices.length > 0 && (
                    <span className="opacity-40">|</span>
                )}
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
