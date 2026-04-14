import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { Loader2, Lock, TrendingUp, Zap, Coins, ShieldAlert, Target, BarChart3, List, Settings2, Brain, Database, Activity } from "lucide-react"
import { useState, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { TickerSelectionPanel } from "./TickerSelectionPanel"
import { DocsSidebarContent } from "../docs/DocsSidebarContent"

export function Sidebar() {
    const {
        hist,
        strategyOptions,
        updateStrategyOptions,
        runSimulation,
        viewMode,
        runMarketAnalysis,
        isAnalyzing,
        isSimulating,
        stopAnalysis,
        startRealtimeAnalysis,
        stopRealtimeAnalysis,
        isRealtimeAnalysis,
        interval,
        wsStatus,
        setGlobalError,
        aiModels,
        loadingAiModels,
        fetchAiModels
    } = useStore()

    useEffect(() => {
        fetchAiModels()
    }, [fetchAiModels])

    const [activeTab, setActiveTab] = useState('strategy') // 'strategy' | 'ticker'
    const [prevViewMode, setPrevViewMode] = useState(viewMode)

    // viewMode가 변경되면 탭 상태 초기화
    if (viewMode !== prevViewMode) {
        setPrevViewMode(viewMode)
        if (viewMode === 'simulation' || viewMode === 'analyze') {
            setActiveTab('strategy')
        } else {
            setActiveTab('ticker')
        }
    }

    const hasData = (hist[interval]?.length || 0) > 0
    const isAnalyzeMode = viewMode === 'analyze'
    const showStrategy = (viewMode === 'simulation' || viewMode === 'analyze')

    const handleOptionChange = (key, value) => {
        updateStrategyOptions({ [key]: value })
    }

    if (viewMode === 'docs') {
        return (
            <div className="w-64 bg-[#252526] border-r border-[#3c3c3c] flex flex-col overflow-hidden">
                <DocsSidebarContent />
            </div>
        )
    }

    if (showStrategy) {
        // 시뮬레이션 및 분석 모드: 탭 UI 사용
        return (
            <div className="w-64 bg-[#252526] border-r border-[#3c3c3c] flex flex-col overflow-hidden">
                {/* Tab Header */}
                <div className="h-9 flex items-center border-b border-[#3c3c3c]">
                    <button
                        onClick={() => setActiveTab('strategy')}
                        className={cn(
                            "flex-1 h-full flex-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-colors relative flex items-center justify-center",
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
                            "flex-1 h-full flex-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-colors relative flex items-center justify-center",
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

                            {/* 2. 전략 모드 선택 */}
                            <section className="space-y-2">
                                <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5" /> 전략 모델
                                </h3>
                                <div className="grid grid-cols-2 gap-2 bg-[#1e1e1e] p-1 rounded border border-[#333]">
                                    <button
                                        onClick={() => handleOptionChange('strategyMode', 'rule')}
                                        className={cn(
                                            "py-1.5 text-[11px] rounded transition-colors font-medium",
                                            strategyOptions.strategyMode !== 'ai' // Default to rule if undefined
                                                ? "bg-[#333] text-white shadow-sm"
                                                : "text-[#888] hover:text-[#ccc]"
                                        )}
                                    >
                                        일반 (Rule)
                                    </button>
                                    <button
                                        onClick={() => handleOptionChange('strategyMode', 'ai')}
                                        className={cn(
                                            "py-1.5 text-[11px] rounded transition-colors font-medium flex items-center justify-center gap-1",
                                            strategyOptions.strategyMode === 'ai'
                                                ? "bg-[#0e639c] text-white shadow-sm"
                                                : "text-[#888] hover:text-[#ccc]"
                                        )}
                                    >
                                        <Brain className="w-3 h-3" />
                                        AI 딥러닝
                                    </button>
                                </div>
                            </section>

                            {strategyOptions.strategyMode === 'ai' ? (
                                // --- AI Deep Learning UI ---
                                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                    <section className="space-y-2">
                                        <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2">
                                            <Database className="w-3.5 h-3.5" /> 모델 선택
                                        </h3>
                                        <select
                                            value={strategyOptions.aiModelId || ''}
                                            onChange={(e) => handleOptionChange('aiModelId', e.target.value)}
                                            className="w-full bg-[#3c3c3c] border border-[#555555] text-[12px] text-[#cccccc] p-2 rounded focus:outline-none focus:border-[#007acc]"
                                        >
                                            <option value="">모델을 선택하세요</option>
                                            {loadingAiModels ? (
                                                <option disabled>로딩 중...</option>
                                            ) : (
                                                aiModels.length > 0 ? (
                                                    aiModels.map(model => (
                                                        <option key={model.id} value={model.id}>
                                                            {model.name} ({new Date(model.created_at).toLocaleDateString()})
                                                        </option>
                                                    ))
                                                ) : (
                                                    <option disabled>사용 가능한 모델 없음</option>
                                                )
                                            )}
                                        </select>
                                    </section>

                                    <section className="space-y-4">
                                        <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2">
                                            <Activity className="w-3.5 h-3.5" /> 확률 임계값 설정
                                        </h3>

                                        {/* 매수 임계값 */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-[#888]">매수 조건 (이상)</span>
                                                <span className="text-green-400 font-bold">
                                                    {Math.round((strategyOptions.aiBuyThreshold ?? 0.6) * 100)}%
                                                </span>
                                            </div>
                                            <Slider
                                                value={[Math.round((strategyOptions.aiBuyThreshold ?? 0.6) * 100)]}
                                                onValueChange={(v) => handleOptionChange('aiBuyThreshold', v[0] / 100)}
                                                max={100}
                                                step={1}
                                                className="[&_[role=slider]]:bg-green-500"
                                            />
                                        </div>

                                        {/* 매도 임계값 */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-[#888]">매도 조건 (미만)</span>
                                                <span className="text-red-400 font-bold">
                                                    {Math.round((strategyOptions.aiSellThreshold ?? 0.4) * 100)}%
                                                </span>
                                            </div>
                                            <Slider
                                                value={[Math.round((strategyOptions.aiSellThreshold ?? 0.4) * 100)]}
                                                onValueChange={(v) => handleOptionChange('aiSellThreshold', v[0] / 100)}
                                                max={100}
                                                step={1}
                                                className="[&_[role=slider]]:bg-red-500"
                                            />
                                        </div>
                                    </section>

                                    <section className="space-y-2 pt-2 border-t border-[#3c3c3c]">
                                        <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2">
                                            <ShieldAlert className="w-3.5 h-3.5" /> 리스크 관리 (AI 공통)
                                        </h3>
                                        <div className="space-y-2">
                                            {[
                                                { id: 'useStopLoss', label: '손절매 (-2%)', desc: '도달 시 즉시 손절' },
                                                { id: 'useTakeProfit', label: '익절매 (+5%)', desc: '도달 시 즉시 익절' }
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
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            ) : (
                                // --- Existing Rule-Based UI ---
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
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
                                </div>
                            )}

                            {/* 4. V-Martingale */}
                            <section className="space-y-2">
                                <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5 text-[#ffcc00]" /> V-Martingale (강화 매수)
                                </h3>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 group cursor-pointer">
                                        <div className="relative flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={strategyOptions.useVMartingale}
                                                onChange={(e) => handleOptionChange('useVMartingale', e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={cn(
                                                "w-4 h-4 rounded border transition-colors flex items-center justify-center",
                                                strategyOptions.useVMartingale ? "bg-[#ffcc00] border-[#ffcc00]" : "border-[#555555] group-hover:border-[#777777]"
                                            )}>
                                                {strategyOptions.useVMartingale && <div className="w-2 h-2 bg-black rounded-sm" />}
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[13px] text-[#cccccc]">V-Martingale 활성화</span>
                                            <span className="text-[10px] text-[#666666]">V반등 시 비중확대, 목표수익 시 매도</span>
                                        </div>
                                    </label>

                                    {strategyOptions.useVMartingale && (
                                        <div className="space-y-3 pl-7 border-l border-[#444444] ml-2">
                                            <div className="space-y-1">
                                                <span className="text-[11px] text-[#999999]">배팅 모드 (비중 강화)</span>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleOptionChange('vMartingaleMultiplierMode', 'double')}
                                                        className={cn(
                                                            "flex-1 py-1.5 px-2 border rounded text-[10px] transition-all",
                                                            strategyOptions.vMartingaleMultiplierMode === 'double'
                                                                ? "bg-[#ffcc00] border-[#ccaa00] text-black font-bold shadow-[0_0_8px_rgba(255,204,0,0.3)]"
                                                                : "bg-[#333333] border-[#444444] text-[#888888] hover:bg-[#3c3c3c]"
                                                        )}
                                                    >
                                                        2배 (마틴)
                                                    </button>
                                                    <button
                                                        onClick={() => handleOptionChange('vMartingaleMultiplierMode', 'fixed')}
                                                        className={cn(
                                                            "flex-1 py-1.5 px-2 border rounded text-[10px] transition-all",
                                                            strategyOptions.vMartingaleMultiplierMode === 'fixed'
                                                                ? "bg-[#ffcc00] border-[#ccaa00] text-black font-bold shadow-[0_0_8px_rgba(255,204,0,0.3)]"
                                                                : "bg-[#333333] border-[#444444] text-[#888888] hover:bg-[#3c3c3c]"
                                                        )}
                                                    >
                                                        1배 (고정)
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-[11px] text-[#999999]">최소 매도 수익률</span>
                                                <select
                                                    value={strategyOptions.vMartingaleProfitCut}
                                                    onChange={(e) => handleOptionChange('vMartingaleProfitCut', parseFloat(e.target.value))}
                                                    className="w-full bg-[#3c3c3c] border border-[#555555] text-[12px] text-[#cccccc] p-1 rounded focus:outline-none focus:border-[#ffcc00]"
                                                >
                                                    <option value={1.0}>+1.0% 이상</option>
                                                    <option value={2.0}>+2.0% 이상 (권장)</option>
                                                    <option value={3.0}>+3.0% 이상</option>
                                                    <option value={5.0}>+5.0% 이상</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-[11px] text-[#999999]">추가 매수 조건 (평단가)</span>
                                                <select
                                                    value={strategyOptions.vMartingaleAddBuyThreshold || 0}
                                                    onChange={(e) => handleOptionChange('vMartingaleAddBuyThreshold', parseFloat(e.target.value))}
                                                    className="w-full bg-[#3c3c3c] border border-[#555555] text-[12px] text-[#cccccc] p-1 rounded focus:outline-none focus:border-[#ffcc00]"
                                                >
                                                    <option value={0}>제한없음 (항상 추가 매수)</option>
                                                    <option value={-1}>-1% 이하 손실 시</option>
                                                    <option value={-2}>-2% 이하 손실 시</option>
                                                    <option value={-3}>-3% 이하 손실 시</option>
                                                    <option value={-5}>-5% 이하 손실 시</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* 5. 마틴게일 */}
                            <section className="space-y-2">
                                <h3 className="text-[12px] font-bold text-[#cccccc] flex items-center gap-2 font-mono">
                                    <Coins className="w-3.5 h-3.5" /> 마틴게일 (패배시 배수)
                                </h3>
                                <select
                                    disabled={strategyOptions.useVMartingale}
                                    value={strategyOptions.martingaleMultiplier}
                                    onChange={(e) => handleOptionChange('martingaleMultiplier', parseFloat(e.target.value))}
                                    className={cn(
                                        "w-full bg-[#3c3c3c] border border-[#555555] text-[12px] text-[#cccccc] p-1.5 rounded focus:outline-none focus:border-[#007acc]",
                                        strategyOptions.useVMartingale && "opacity-50 cursor-not-allowed"
                                    )}
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
                    ) : (
                        <div className="flex-1 h-full relative">
                            <TickerSelectionPanel />
                        </div>
                    )}
                </div>

                {/* Footer (Always visible in Sim/Analyze mode) */}
                <div className="p-4 border-t border-[#3c3c3c] flex flex-col gap-2 bg-[#252526]">
                    <button
                        disabled={!hasData || isSimulating}
                        onClick={() => {
                            if (isAnalyzing) {
                                stopAnalysis()
                                return
                            }

                            if (isAnalyzeMode) {
                                runMarketAnalysis()
                                return
                            }
                            runSimulation()
                        }}
                        className={cn(
                            "w-full py-2.5 text-[13px] font-bold rounded flex items-center justify-center gap-2 transition-all",
                            (!hasData || isSimulating)
                                ? "bg-[#333333] text-[#666666] cursor-not-allowed"
                                : isAnalyzing
                                    ? "bg-[#c72e2e] hover:bg-[#f44336] text-white shadow-lg active:scale-95"
                                    : (isAnalyzeMode ? "bg-[#094771] hover:bg-[#007acc]" : "bg-[#0e639c] hover:bg-[#1177bb]") + " text-white shadow-lg active:scale-95"
                        )}
                    >
                        {(isAnalyzing || isSimulating) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Zap className={cn("w-4 h-4", isAnalyzeMode ? "text-[#9cdcfe]" : "fill-white")} />
                        )}
                        {isAnalyzing ? "분석 중지 (취소)" : isSimulating ? "예측 중..." : (isAnalyzeMode ? "전체 시장 분석 실행" : "시뮬레이션 실행")}
                    </button>

                    {/* 실시간 분석 버튼 (Analyze 모드 전용) */}
                    {isAnalyzeMode && (
                        <button
                            disabled={!hasData || isAnalyzing}
                            onClick={(e) => {
                                // aria-hidden 경고 방지를 위해 버튼 포커스 해제
                                e.currentTarget.blur();

                                if (isRealtimeAnalysis) {
                                    stopRealtimeAnalysis()
                                } else {
                                    // 웹소켓 연결 상태 체크
                                    if (!wsStatus.connected) {
                                        setGlobalError({
                                            title: "실시간 분석 불가",
                                            description: "웹소켓이 연결되어 있지 않습니다. KIS 로그인을 완료한 후 다시 시도해주세요."
                                        });
                                        return;
                                    }

                                    // 시간 간격 체크 (실시간 분석은 분봉(Min) 기준)
                                    if (interval !== '1m') {
                                        setGlobalError({
                                            title: "설정 변경 필요",
                                            description: "실시간 분석은 분봉(Min) 데이터 기반으로 작동합니다. 상단 타이틀바의 간격을 'Min'으로 변경 후 다시 시도해주세요."
                                        });
                                        return;
                                    }

                                    startRealtimeAnalysis()
                                }
                            }}
                            className={cn(
                                "w-full py-2.5 text-[13px] font-bold rounded flex items-center justify-center gap-2 transition-all mt-2",
                                isRealtimeAnalysis
                                    ? "bg-[#c72e2e] hover:bg-[#f44336] text-white animate-pulse"
                                    : "bg-[#2d2d2d] border border-[#3c3c3c] text-[#cccccc] hover:bg-[#3c3c3c] hover:border-[#007acc]"
                            )}
                        >
                            {isRealtimeAnalysis ? (
                                <>
                                    <div className="w-2 h-2 rounded-full bg-white animate-ping mr-1" />
                                    실시간 분석 중지
                                </>
                            ) : (
                                <>
                                    <Target className="w-4 h-4 text-[#4ec9b0]" />
                                    실시간 분석 (Live 40)
                                </>
                            )}
                        </button>
                    )}
                    {!hasData && (
                        <p className="text-[10px] text-[#888888] text-center">
                            데이터({interval}) 로딩 대기 중...
                        </p>
                    )}
                </div>
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
