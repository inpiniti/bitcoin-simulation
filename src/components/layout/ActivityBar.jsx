import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { Play, Table2, LineChart, Search, Loader2 } from "lucide-react"

const VIEW_MODES = [
    { key: 'simulation', label: '시뮬레이션', icon: Play, color: 'text-[#4ec9b0]' },
    { key: 'dataView', label: '데이터 뷰', icon: Table2, color: 'text-[#569cd6]' },
    { key: 'chartView', label: '차트 뷰', icon: LineChart, color: 'text-[#4fc1ff]' },
    { key: 'analyze', label: '분석', icon: Search, color: 'text-[#ce9178]' },
]

export function ActivityBar() {
    const {
        viewMode,
        setViewMode,
        isAnalyzing,
        loadingInterval,
    } = useStore()

    const isLoading = loadingInterval['1d'] || loadingInterval['STOCK_BASE']

    const handleClick = (mode) => {
        setViewMode(mode)
    }

    return (
        <div className="w-12 bg-[#333333] flex flex-col items-center py-3 gap-2">
            {VIEW_MODES.map(({ key, label, icon: Icon, color }) => {
                const isActive = viewMode === key
                const isCurrentLoading = key === 'analyze' && isAnalyzing

                return (
                    <button
                        key={key}
                        onClick={() => handleClick(key)}
                        disabled={isLoading}
                        title={label}
                        className={cn(
                            "w-10 h-10 flex flex-col items-center justify-center rounded-lg transition-all",
                            "text-[9px] gap-0.5 font-medium",
                            isActive && "bg-[#1e1e1e] border-l-2 border-l-[#007acc]",
                            isActive && color,
                            !isActive && "text-[#808080] hover:text-[#cccccc] hover:bg-[#2a2a2a]",
                            isLoading && "opacity-50 cursor-wait"
                        )}
                    >
                        {isCurrentLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Icon className="w-5 h-5" />
                        )}
                        <span className="truncate w-full text-center">{label}</span>
                    </button>
                )
            })}

            {/* 로딩 인디케이터 */}
            {isLoading && (
                <div className="mt-auto mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#f7931a]" />
                </div>
            )}
        </div>
    )
}
