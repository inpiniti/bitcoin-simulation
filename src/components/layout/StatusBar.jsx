import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { GitBranch, Check, Loader2 } from "lucide-react"

export function StatusBar() {
    const { hist, loadingInterval, selectedResult, isAnalyzing, analysisProgress, mode, ticker } = useStore()

    const dataCount = hist['1d']?.length || 0
    const isLoading = loadingInterval['1d'] || loadingInterval['STOCK_BASE']

    return (
        <div className="h-6 bg-[#007acc] flex items-center px-2 text-white text-[11px] select-none">
            {/* Left */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    main
                </div>

                {/* Data Loading Indicator */}
                {isLoading && (
                    <div className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        데이터 로딩...
                    </div>
                )}

                {/* Market Analysis Indicator */}
                {isAnalyzing && (
                    <div className="flex items-center gap-1 bg-[#094771] px-2 rounded-sm border border-[#3e3e42]">
                        <Loader2 className="w-3 h-3 animate-spin text-orange-300" />
                        <span className="text-orange-100">
                            분석 진행 중... {analysisProgress.current} / {analysisProgress.total}
                        </span>
                    </div>
                )}

                {!isLoading && !isAnalyzing && (
                    <div className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        준비됨
                    </div>
                )}
            </div>

            {/* Center */}
            <div className="flex-1 text-center">
                <span>
                    {mode === 'coin' ? 'BTC-KRW' : ticker} (1d) |
                    데이터: <strong>{dataCount.toLocaleString()}</strong>개
                </span>
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
                <span>Bitcoin Simulation v2.0</span>
            </div>
        </div>
    )
}
