import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { GitBranch, Check, X, Loader2 } from "lucide-react"

export function StatusBar() {
    const { activeInterval, hist, fetchProgress, loadingInterval, selectedResult } = useStore()

    const dataCount = activeInterval ? hist[activeInterval]?.length : 0
    const isLoading = Object.values(loadingInterval).some(Boolean)

    return (
        <div className="h-6 bg-[#007acc] flex items-center px-2 text-white text-[11px] select-none">
            {/* Left */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    main
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {fetchProgress.total > 0
                            ? `데이터 로딩 중... ${fetchProgress.current}/${fetchProgress.total}`
                            : '처리 중...'}
                    </div>
                ) : (
                    <div className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        준비됨
                    </div>
                )}
            </div>

            {/* Center */}
            <div className="flex-1 text-center">
                {activeInterval && (
                    <span>
                        활성 간격: <strong>{activeInterval}</strong> |
                        데이터: <strong>{dataCount.toLocaleString()}</strong>개
                    </span>
                )}
            </div>

            {/* Right */}
            <div className="flex items-center gap-3">
                {selectedResult && (
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[10px]",
                        selectedResult.summary?.totalProfit >= 0 ? "bg-green-600" : "bg-red-600"
                    )}>
                        {selectedResult.summary?.totalProfit >= 0 ? '+' : ''}
                        {selectedResult.summary?.totalProfit?.toLocaleString()}원
                    </span>
                )}
                <span>UTF-8</span>
                <span>Bitcoin Simulation v1.0</span>
            </div>
        </div>
    )
}
