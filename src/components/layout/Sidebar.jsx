import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { ChevronDown, ChevronRight, Loader2, Lock, TrendingUp, Zap, Coins } from "lucide-react"
import { useState } from "react"

export function Sidebar() {
    const {
        activeInterval,
        strategyOptions,
        updateStrategyOptions,
        runSimulation,
        analysisMode,
        runMarketAnalysis,
        isAnalyzing,
        isDisabled = !activeInterval
    } = useStore()

    const handleOptionChange = (key, value) => {
        updateStrategyOptions({ [key]: value })
    }

    return (
        <div className="w-64 bg-[#252526] border-r border-[#3c3c3c] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="h-9 flex items-center px-4 text-[11px] text-[#bbbbbb] uppercase tracking-wider border-b border-[#3c3c3c]">
                매매 전략 설정
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-6">
                {/* 1. 수량 & 자산관리 */}
                <section className="space-y-2">
                    <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5" /> 자산 관리
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => handleOptionChange('moneyManagement', 'fixed')}
                            className={cn(
                                "py-1.5 text-[12px] rounded border transition-colors",
                                strategyOptions.moneyManagement === 'fixed'
                                    ? "bg-[#0e639c] border-[#1177bb] text-white"
                                    : "bg-[#333333] border-[#444444] text-[#aaaaaa] hover:bg-[#3c3c3c]"
                            )}
                        >
                            고정 (단리)
                        </button>
                        <button
                            onClick={() => handleOptionChange('moneyManagement', 'cumulative')}
                            className={cn(
                                "py-1.5 text-[12px] rounded border transition-colors",
                                strategyOptions.moneyManagement === 'cumulative'
                                    ? "bg-[#0e639c] border-[#1177bb] text-white"
                                    : "bg-[#333333] border-[#444444] text-[#aaaaaa] hover:bg-[#3c3c3c]"
                            )}
                        >
                            누적 (복리)
                        </button>
                    </div>
                </section>

                {/* 2. 필터 설정 */}
                <section className="space-y-3">
                    <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5" /> 진입/청산 필터
                    </h3>
                    <div className="space-y-2">
                        {[
                            { id: 'useBB', label: '볼린저 밴드 (BB -2)', desc: '하단 이탈 시 매수' },
                            { id: 'useTrend', label: '추세 필터 (MA50)', desc: '정배열(MA위)일 때만 매수' },
                            { id: 'useRSI', label: 'RSI 필터 (70미만)', desc: '과매수 시 매수 금지' },
                            { id: 'useVolumeFilter', label: '거래량 필터', desc: '평균(VMA20) 이상 시 매수' },
                            { id: 'useStopLoss', label: '손절매 (-2%)', desc: '도달 시 즉시 손절' },
                            { id: 'useTakeProfit', label: '익절매 (+5%)', desc: '목표 도달 시 즉시 익절' },
                            { id: 'useTrailingStop', label: '추적 손절매 (-2%)', desc: '고점 대비 하락 시 매도' },
                        ].map(item => (
                            <label key={item.id} className="flex items-center gap-3 group cursor-pointer">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={strategyOptions[item.id]}
                                        onChange={(e) => handleOptionChange(item.id, e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={cn(
                                        "w-4 h-4 rounded border transition-colors flex items-center justify-center",
                                        strategyOptions[item.id] ? "bg-[#007acc] border-[#007acc]" : "border-[#555555] group-hover:border-[#777777]"
                                    )}>
                                        {strategyOptions[item.id] && <div className="w-2 h-2 bg-white rounded-sm" />}
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[13px] text-[#cccccc]">{item.label}</span>
                                    <span className="text-[10px] text-[#666666]">{item.desc}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </section>

                {/* 3. 마틴게일 */}
                <section className="space-y-2">
                    <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5" /> 마틴게일 배율
                    </h3>
                    <select
                        value={strategyOptions.martingaleMultiplier}
                        onChange={(e) => handleOptionChange('martingaleMultiplier', parseFloat(e.target.value))}
                        className="w-full bg-[#3c3c3c] border border-[#555555] text-[12px] text-[#cccccc] p-1.5 rounded focus:outline-none focus:border-[#007acc]"
                    >
                        <option value={1.0}>사용 안함 (1.0x)</option>
                        <option value={1.1}>1.1배 증가</option>
                        <option value={1.2}>1.2배 증가</option>
                        <option value={1.3}>1.3배 증가</option>
                        <option value={1.5}>1.5배 증가</option>
                        <option value={2.0}>2.0배 증가 (Classic)</option>
                    </select>
                </section>
            </div>

            {/* Run Button Container */}
            <div className="p-4 border-t border-[#3c3c3c] flex flex-col gap-2 bg-[#252526]">
                <button
                    disabled={!activeInterval || isAnalyzing}
                    onClick={() => {
                        if (analysisMode) {
                            runMarketAnalysis()
                        } else {
                            runSimulation()
                        }
                    }}
                    className={cn(
                        "w-full py-2.5 text-[13px] font-bold rounded flex items-center justify-center gap-2 transition-all",
                        activeInterval
                            ? (analysisMode ? "bg-[#094771] hover:bg-[#007acc]" : "bg-[#0e639c] hover:bg-[#1177bb]") + " text-white shadow-lg active:scale-95"
                            : "bg-[#333333] text-[#666666] cursor-not-allowed"
                    )}
                >
                    {isAnalyzing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Zap className={cn("w-4 h-4", analysisMode ? "text-[#9cdcfe]" : "fill-white")} />
                    )}
                    {isAnalyzing ? "분석 중..." : (analysisMode ? "시장 분석 실행" : "시뮬레이션 실행")}
                </button>
                {!activeInterval && (
                    <p className="text-[10px] text-[#888888] text-center">
                        Activity Bar에서 간격을 선택하세요
                    </p>
                )}
            </div>
        </div>
    )
}
