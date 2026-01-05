import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { Clock, Timer, Clock1, Clock2, Calendar, CalendarDays, CalendarRange, Loader2 } from "lucide-react"

const INTERVALS = [
    { key: '1m', label: '1분', icon: Clock },
    { key: '5m', label: '5분', icon: Timer },
    { key: '15m', label: '15분', icon: Clock1 },
    { key: '1h', label: '1시간', icon: Clock2 },
    { key: '2h', label: '2시간', icon: Clock2 },
    { key: '1d', label: '1일', icon: Calendar },
    { key: '2d', label: '2일', icon: CalendarDays },
    { key: '3d', label: '3일', icon: CalendarDays },
    { key: '4d', label: '4일', icon: CalendarDays },
    { key: '5d', label: '5일', icon: CalendarDays },
    { key: '6d', label: '6일', icon: CalendarDays },
    { key: '1w', label: '1주', icon: CalendarRange },
    { key: '8d', label: '8일', icon: CalendarDays },
    { key: '9d', label: '9일', icon: CalendarDays },
    { key: '10d', label: '10일', icon: CalendarDays },
    { key: '11d', label: '11일', icon: CalendarDays },
    { key: '12d', label: '12일', icon: CalendarDays },
    { key: '13d', label: '13일', icon: CalendarDays },
    { key: '14d', label: '14일', icon: CalendarDays },
    { key: '15d', label: '15일', icon: CalendarDays },
    { key: '16d', label: '16일', icon: CalendarDays },
    { key: '17d', label: '17일', icon: CalendarDays },
    { key: '18d', label: '18일', icon: CalendarDays },
    { key: '19d', label: '19일', icon: CalendarDays },
    { key: '20d', label: '20일', icon: CalendarDays },
]

export function ActivityBar() {
    const {
        mode,
        hist,
        loadingInterval,
        activeInterval,
        loadHist1m,
        loadHistInterval,
        setActiveInterval,
        analysisMode,
        runMarketAnalysis
    } = useStore()

    const handleClick = async (interval) => {
        // Stock 모드에서 1일 미만 간격 클릭 차단
        if (mode === 'stock' && ['1m', '5m', '15m', '1h', '2h'].includes(interval)) return;

        const hasData = (hist[interval]?.length || 0) > 0

        if (hasData) {
            setActiveInterval(interval)
        } else {
            if (mode === 'coin') {
                if (interval === '1m') {
                    await loadHist1m()
                } else {
                    if (hist['1m'].length === 0) {
                        await loadHist1m()
                    }
                    await loadHistInterval(interval)
                }
            } else {
                // Stock 모드: Store의 loadHistInterval이 1d 데이터 로드를 처리함
                await loadHistInterval(interval)
            }
            setActiveInterval(interval)
        }

        // 전체 분석 모드일 경우 구간 변경 시 즉시 재분석 실행
        if (analysisMode) {
            runMarketAnalysis()
        }
    }

    return (
        <div className="w-12 bg-[#333333] flex flex-col items-center py-2 gap-1 overflow-y-auto scrollbar-hide">
            {INTERVALS.map(({ key, label, icon: Icon }) => {
                const hasData = (hist[key]?.length || 0) > 0
                const isLoading = loadingInterval[key]
                const isActive = activeInterval === key

                // Stock 모드 시 비활성화 여부
                const isStockDisabled = mode === 'stock' && ['1m', '5m', '15m', '1h', '2h'].includes(key);
                const disabled = isLoading || isStockDisabled;

                return (
                    <button
                        key={key}
                        onClick={() => handleClick(key)}
                        disabled={disabled}
                        title={isStockDisabled ? "주식 모드 미지원" : `${label} 간격`}
                        className={cn(
                            "w-10 h-10 flex flex-col items-center justify-center rounded transition-all shrink-0",
                            "text-[10px] gap-0.5",
                            isActive && !isStockDisabled && "bg-[#1e1e1e] border-l-2 border-l-[#f7931a]",
                            hasData && !isActive && !isStockDisabled && "text-[#cccccc] hover:bg-[#2a2a2a]",
                            !hasData && !isLoading && !isStockDisabled && "text-[#5a5a5a] hover:bg-[#2a2a2a]",
                            isLoading && "text-[#f7931a]",
                            isStockDisabled && "opacity-20 cursor-not-allowed text-[#444]"
                        )}
                    >
                        {isLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Icon className="w-4 h-4" />
                        }
                        <span>{label}</span>
                    </button>
                )
            })}
        </div>
    )
}
