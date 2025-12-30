import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { ChevronDown, ChevronRight, Loader2, Lock, TrendingUp, Zap } from "lucide-react"
import { useState } from "react"

const STRATEGIES = [
    { key: 'fixed', label: '수량 고정', multiplier: null, icon: Lock },
    { key: 'martingale_1.1', label: '1.1x 마틴게일', multiplier: 1.1, icon: TrendingUp },
    { key: 'martingale_1.2', label: '1.2x 마틴게일', multiplier: 1.2, icon: TrendingUp },
    { key: 'martingale_1.3', label: '1.3x 마틴게일', multiplier: 1.3, icon: TrendingUp },
    { key: 'martingale_1.4', label: '1.4x 마틴게일', multiplier: 1.4, icon: TrendingUp },
    { key: 'martingale_1.5', label: '1.5x 마틴게일', multiplier: 1.5, icon: TrendingUp },
    { key: 'martingale_2', label: '2x 마틴게일', multiplier: 2, icon: Zap },
]

export function Sidebar() {
    const [isExpanded, setIsExpanded] = useState(true)
    const {
        mode,
        ticker,
        activeInterval,
        hist,
        simul,
        loadingSimul,
        runFixedSimulation,
        runMartingaleSimulation,
        setSelectedResult
    } = useStore()

    const isDisabled = !activeInterval || hist[activeInterval]?.length === 0

    const getSimulKey = (strategy) => {
        const suffix = strategy.multiplier
            ? `martingale_${strategy.multiplier}`
            : `fixed`
        return `${mode}_${ticker}_${activeInterval}_${suffix}`
    }

    const handleClick = async (strategy) => {
        if (isDisabled) return

        const simulKey = getSimulKey(strategy)
        const hasResult = simul[simulKey]

        if (hasResult) {
            setSelectedResult({ key: simulKey, ...simul[simulKey] })
        } else {
            if (strategy.multiplier) {
                await runMartingaleSimulation(activeInterval, strategy.multiplier)
            } else {
                await runFixedSimulation(activeInterval)
            }
            // Store might have updated, need to read fresh state or rely on key consistency
            const result = useStore.getState().simul[simulKey]
            if (result) {
                setSelectedResult({ key: simulKey, ...result })
            }
        }
    }

    return (
        <div className="w-60 bg-[#252526] border-r border-[#3c3c3c] flex flex-col">
            {/* Header */}
            <div className="h-9 flex items-center px-4 text-[11px] text-[#bbbbbb] uppercase tracking-wider">
                시뮬레이션 전략
            </div>

            {/* Explorer Section */}
            <div className="flex-1 overflow-auto">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-[11px] text-[#cccccc] font-semibold hover:bg-[#2a2a2a]"
                >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    매매 전략 ({STRATEGIES.length})
                </button>

                {isExpanded && (
                    <div className="pl-4">
                        {STRATEGIES.map((strategy) => {
                            const simulKey = activeInterval ? getSimulKey(strategy) : null
                            const hasResult = simulKey ? simul[simulKey] : false
                            const isLoading = simulKey ? loadingSimul[simulKey] : false
                            const Icon = strategy.icon

                            return (
                                <button
                                    key={strategy.key}
                                    onClick={() => handleClick(strategy)}
                                    disabled={isDisabled || isLoading}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-2 py-1 text-[13px] text-left transition-colors",
                                        isDisabled && "opacity-40 cursor-not-allowed",
                                        hasResult && "text-[#4ec9b0]",
                                        !hasResult && !isDisabled && "text-[#cccccc] hover:bg-[#2a2a2a]",
                                        isLoading && "text-[#f7931a]"
                                    )}
                                >
                                    {isLoading
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Icon className="w-4 h-4" />
                                    }
                                    {strategy.label}
                                    {hasResult && (
                                        <span className="ml-auto text-[10px] text-[#6a9955]">✓</span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Info */}
            {isDisabled && (
                <div className="p-4 text-[11px] text-[#6a6a6a] border-t border-[#3c3c3c]">
                    왼쪽 Activity Bar에서<br />간격을 먼저 선택하세요.
                </div>
            )}
        </div>
    )
}
