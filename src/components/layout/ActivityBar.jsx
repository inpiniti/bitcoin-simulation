import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { Play, Table2, LineChart, Search, Loader2, MessageSquare, BookOpen } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

const VIEW_MODES = [
    { key: 'overview', label: '개요 (Overview)', icon: BookOpen },
    { key: 'simulation', label: '시뮬레이션', icon: Play },
    { key: 'dataView', label: '데이터 뷰', icon: Table2 },
    { key: 'chartView', label: '차트 뷰', icon: LineChart },
    { key: 'analyze', label: '분석', icon: Search },
    { key: 'discussion', label: '종목 토론', icon: MessageSquare },
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
        <TooltipProvider delayDuration={300}>
            <div className="w-12 bg-[#333333] flex flex-col items-center py-2 gap-0.5">
                {VIEW_MODES.map(({ key, label, icon: Icon }) => {
                    const isActive = viewMode === key
                    const isCurrentLoading = key === 'analyze' && isAnalyzing

                    return (
                        <Tooltip key={key}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleClick(key)}
                                    disabled={isLoading}
                                    className={cn(
                                        "w-12 h-12 flex items-center justify-center transition-colors relative",
                                        // Active state - VS Code style left border
                                        isActive && "text-white",
                                        isActive && "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-white",
                                        // Inactive state
                                        !isActive && "text-[#858585] hover:text-[#cccccc]",
                                        // Loading state
                                        isLoading && "opacity-50 cursor-wait"
                                    )}
                                >
                                    {isCurrentLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <Icon className="w-6 h-6" />
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="bg-[#252526] border-[#454545] text-[#cccccc]">
                                <p>{label}</p>
                            </TooltipContent>
                        </Tooltip>
                    )
                })}

                {/* 로딩 인디케이터 */}
                {isLoading && (
                    <div className="mt-auto mb-2">
                        <Loader2 className="w-5 h-5 animate-spin text-[#f7931a]" />
                    </div>
                )}
            </div>
        </TooltipProvider>
    )
}
