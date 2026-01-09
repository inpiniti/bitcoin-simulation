import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { Loader2, Lock, TrendingUp, Zap, Coins, ShieldAlert, Target, BarChart3, List, Settings2 } from "lucide-react"
import { useState, useEffect } from "react"
import { TickerSelectionPanel } from "./TickerSelectionPanel"

export function Sidebar() {
    const {
        hist,
        strategyOptions,
        updateStrategyOptions,
        runSimulation,
        viewMode,
        runMarketAnalysis,
        isAnalyzing,
        stopAnalysis,
    } = useStore()

    const [activeTab, setActiveTab] = useState('strategy') // 'strategy' | 'ticker'

    // 뷰 모드가 변경되면 탭 상태 초기화 or 적절한 기본값 설정
    useEffect(() => {
        if (viewMode === 'simulation' || viewMode === 'analyze') {
            // 시뮬레이션/분석 모드에서는 전략 탭 기본
            setActiveTab('strategy')
        } else {
            // 그 외(데이터, 차트, 토론)에서는 티커 탭 강제 (사실상 탭 UI 없음)
            setActiveTab('ticker')
        }
    }, [viewMode])

    const hasData = (hist['1d']?.length || 0) > 0
    const isAnalyzeMode = viewMode === 'analyze'
    const showStrategy = (viewMode === 'simulation' || viewMode === 'analyze')

    const handleOptionChange = (key, value) => {
        updateStrategyOptions({ [key]: value })
    }

    // Strategy Content Component (Existing UI)
    const StrategyContent = () => (
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

            {/* 2. 진입/청산 필터 */}
            <section className="space-y-2">
                <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5" /> 진입/청산 필터
                </h3>
                <div className="space-y-2">
                    {[
                        { id: 'useBB', label: '볼린저 밴드 (BB -2)', desc: '하단 이탈 시 매수' },
                        { id: 'useTrend', label: '추세 필터 (MA50)', desc: '장기 추세 위일 때 매수' },
                        { id: 'useTrend20', label: '추세 필터 (MA20)', desc: '단기 추세 위일 때 매수' },
                        { id: 'useRSI', label: 'RSI 필터 (70미만)', desc: '과매수 시 매수 금지' },
                        { id: 'useVolumeFilter', label: '거래량 필터', desc: '평균(VMA20) 이상 시 매수' },
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

            {/* 3. 익절/손절/추적 */}
            <section className="space-y-2">
                <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5" /> 리스크 관리
                </h3>
                <div className="space-y-2">
                    {[
                        { id: 'useStopLoss', label: '손절매 (-2%)', desc: '도달 시 즉시 손절' },
                        { id: 'useTakeProfit', label: '익절매 (+5%)', desc: '도달 시 즉시 익절' },
                        { id: 'useTrailingStop', label: '추적 손절매 (-2%)', desc: '최고점 대비 하락 시' },
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
                                    strategyOptions[item.id] ? "bg-[#ce9178] border-[#ce9178]" : "border-[#555555] group-hover:border-[#777777]"
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

            {/* 4. 마틴게일 */}
            <section className="space-y-2">
                <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2">
                    <Coins className="w-3.5 h-3.5" /> 마틴게일 배율
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
    )

    const RunButtonFooter = () => (
        <div className="p-4 border-t border-[#3c3c3c] flex flex-col gap-2 bg-[#252526]">
            <button
                disabled={!hasData}
                onClick={() => {
                    if (isAnalyzing) {
                        stopAnalysis()
                        return
                    }

                    if (isAnalyzeMode) {
                        runMarketAnalysis()
                    } else {
                        runSimulation()
                    }
                }}
                className={cn(
                    "w-full py-2.5 text-[13px] font-bold rounded flex items-center justify-center gap-2 transition-all",
                    !hasData
                        ? "bg-[#333333] text-[#666666] cursor-not-allowed"
                        : isAnalyzing
                            ? "bg-[#c72e2e] hover:bg-[#f44336] text-white shadow-lg active:scale-95"
                            : (isAnalyzeMode ? "bg-[#094771] hover:bg-[#007acc]" : "bg-[#0e639c] hover:bg-[#1177bb]") + " text-white shadow-lg active:scale-95"
                )}
            >
                {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Zap className={cn("w-4 h-4", isAnalyzeMode ? "text-[#9cdcfe]" : "fill-white")} />
                )}
                {isAnalyzing ? "분석 중지 (취소)" : (isAnalyzeMode ? "시장 분석 실행" : "시뮬레이션 실행")}
            </button>
            {!hasData && (
                <p className="text-[10px] text-[#888888] text-center">
                    데이터 로딩 대기 중...
                </p>
            )}
        </div>
    )

    if (showStrategy) {
        // 시뮬레이션 및 분석 모드: 탭 UI 사용
        return (
            <div className="w-64 bg-[#252526] border-r border-[#3c3c3c] flex flex-col overflow-hidden">
                {/* Tab Header */}
                <div className="h-9 flex items-center border-b border-[#3c3c3c]">
                    <button
                        onClick={() => setActiveTab('strategy')}
                        className={cn(
                            "flex-1 h-full flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-colors relative",
                            activeTab === 'strategy' ? "text-[#e1e1e1] bg-[#1e1e1e]" : "text-[#888888] hover:text-[#cccccc] hover:bg-[#2d2d2d]"
                        )}
                    >
                        <Settings2 className="w-3 h-3" /> 매매 전략
                        {activeTab === 'strategy' && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#007acc]" />
                        )}
                    </button>
                    <div className="w-[1px] h-4 bg-[#3c3c3c]" />
                    <button
                        onClick={() => setActiveTab('ticker')}
                        className={cn(
                            "flex-1 h-full flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-colors relative",
                            activeTab === 'ticker' ? "text-[#e1e1e1] bg-[#1e1e1e]" : "text-[#888888] hover:text-[#cccccc] hover:bg-[#2d2d2d]"
                        )}
                    >
                        <List className="w-3 h-3" /> 티커 선택
                        {activeTab === 'ticker' && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#007acc]" />
                        )}
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col relative">
                    {activeTab === 'strategy' ? (
                        <StrategyContent />
                    ) : (
                        <div className="flex-1 h-full relative">
                            <TickerSelectionPanel />
                        </div>
                    )}
                </div>

                {/* Footer (Always visible in Sim/Analyze mode) */}
                <RunButtonFooter />
            </div>
        )
    }

    // 그 외 모드: 티커 선택 패널만 표시 (헤더 없음 or 심플 헤더)
    return (
        <div className="w-64 bg-[#252526] border-r border-[#3c3c3c] flex flex-col overflow-hidden">
            <div className="h-9 flex items-center px-4 text-[11px] text-[#bbbbbb] uppercase tracking-wider border-b border-[#3c3c3c]">
                티커 선택
            </div>
            <div className="flex-1 overflow-hidden relative">
                <TickerSelectionPanel />
            </div>
        </div>
    )
}
