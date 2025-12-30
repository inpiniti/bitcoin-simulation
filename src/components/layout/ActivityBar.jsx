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
    { key: '1w', label: '1주', icon: CalendarRange },
]

export function ActivityBar() {
    const {
        hist,
        loadingInterval,
        activeInterval,
        loadHist1m,
        loadHistInterval,
        setActiveInterval
    } = useStore()

    const handleClick = async (interval) => {
        const hasData = hist[interval].length > 0

        if (hasData) {
            setActiveInterval(interval)
        } else {
            if (interval === '1m') {
                await loadHist1m()
            } else {
                if (hist['1m'].length === 0) {
                    await loadHist1m()
                }
                await loadHistInterval(interval)
            }
            setActiveInterval(interval)
        }
    }

    return (
        <div className="w-12 bg-[#333333] flex flex-col items-center py-2 gap-1">
            {INTERVALS.map(({ key, label, icon: Icon }) => {
                const hasData = hist[key].length > 0
                const isLoading = loadingInterval[key]
                const isActive = activeInterval === key

                return (
                    <button
                        key={key}
                        onClick={() => handleClick(key)}
                        disabled={isLoading}
                        title={`${label} 간격`}
                        className={cn(
                            "w-10 h-10 flex flex-col items-center justify-center rounded transition-all",
                            "text-[10px] gap-0.5",
                            isActive && "bg-[#1e1e1e] border-l-2 border-l-[#f7931a]",
                            hasData && !isActive && "text-[#cccccc] hover:bg-[#2a2a2a]",
                            !hasData && !isLoading && "text-[#5a5a5a] hover:bg-[#2a2a2a]",
                            isLoading && "text-[#f7931a]"
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
