import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    LayoutDashboard,
    LineChart,
    Zap,
    Search,
    Brain,
    Bitcoin,
    TrendingUp,
    PlayCircle
} from "lucide-react"
import { useStore } from "@/store/useStore"

/**
 * Introduction screen component displayed when no specific view is active.
 * Provides quick access to main features like Simulation, Market Scanner, AI Forecast, and Real-time Trading.
 * 
 * @component
 * @returns {JSX.Element} The rendered IntroScreen component
 */
export function IntroScreen() {
    const { setMode, setTickerGroup } = useStore()

    const handleStartSimulation = () => {
        setMode('stock')
        // 필요하다면 특정 뷰나 동작을 트리거
    }

    return (
        <div className="flex-1 h-full bg-[#1e1e1e] flex flex-col items-center justify-center p-8 overflow-y-auto select-none">
            <div className="max-w-3xl w-full space-y-12 animate-in fade-in zoom-in duration-500">

                {/* Header Section */}
                <div className="text-center space-y-6">
                    <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl mb-2 backdrop-blur-sm border border-white/5 shadow-2xl">
                        <Bitcoin className="w-16 h-16 text-blue-400 mr-[-10px]" />
                        <TrendingUp className="w-16 h-16 text-purple-400 ml-[-10px]" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 pb-2">
                            Advanced Trading Simulator
                        </h1>
                        <p className="text-xl text-muted-foreground font-light">
                            AI 기반 비트코인 & 주식 매매 전략 검증 시스템
                        </p>
                    </div>
                </div>

                {/* Quick Actions / Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Feature 1: Simulation */}
                    <Card className="p-6 bg-[#252526] border-[#3c3c3c] hover:bg-[#2a2a2a] transition-all cursor-default group shadow-lg hover:shadow-blue-500/10 hover:border-blue-500/30">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                                <PlayCircle className="w-8 h-8 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-200 mb-1">Strategy Simulation</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    과거 1년치 데이터를 기반으로 다양한 매매 전략을 검증하고 승률을 분석하세요.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Feature 2: Market Analysis */}
                    <Card className="p-6 bg-[#252526] border-[#3c3c3c] hover:bg-[#2a2a2a] transition-all cursor-default group shadow-lg hover:shadow-purple-500/10 hover:border-purple-500/30">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-500/10 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                                <Search className="w-8 h-8 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-200 mb-1">Market Scanner</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    전체 시장을 스캔하여 매수/매도 신호가 발생한 종목을 실시간으로 포착하세요.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Feature 3: AI Forecast */}
                    <Card className="p-6 bg-[#252526] border-[#3c3c3c] hover:bg-[#2a2a2a] transition-all cursor-default group shadow-lg hover:shadow-pink-500/10 hover:border-pink-500/30">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-pink-500/10 rounded-xl group-hover:bg-pink-500/20 transition-colors">
                                <Brain className="w-8 h-8 text-pink-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-200 mb-1">AI Price Forecast</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    TimesFM 모델을 활용하여 미래 가격 추이를 예측하고 변동성을 대비하세요.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Feature 4: Real-time Data */}
                    <Card className="p-6 bg-[#252526] border-[#3c3c3c] hover:bg-[#2a2a2a] transition-all cursor-default group shadow-lg hover:shadow-green-500/10 hover:border-green-500/30">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-green-500/10 rounded-xl group-hover:bg-green-500/20 transition-colors">
                                <Zap className="w-8 h-8 text-green-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-200 mb-1">Real-time Trading</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    한국투자증권(KIS) API와 연동하여 실계좌 잔고를 조회하고 자동 매매를 수행하세요.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Getting Started Section */}
                <div className="space-y-4 pt-4 border-t border-[#3c3c3c]/50">
                    <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Getting Started</h2>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a2a] rounded-md border border-[#3c3c3c]">
                            <LayoutDashboard className="w-4 h-4 text-gray-500" />
                            <span>Select Mode</span>
                        </div>
                        <span className="text-gray-600">→</span>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a2a] rounded-md border border-[#3c3c3c]">
                            <Search className="w-4 h-4 text-gray-500" />
                            <span>Choose Ticker</span>
                        </div>
                        <span className="text-gray-600">→</span>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a2a] rounded-md border border-[#3c3c3c]">
                            <LineChart className="w-4 h-4 text-gray-500" />
                            <span>Analyze & Trade</span>
                        </div>
                    </div>
                </div>

                <div className="text-center pt-8">
                    <p className="text-xs text-gray-600">
                        Press <kbd className="px-1.5 py-0.5 bg-[#2a2a2a] border border-[#3c3c3c] rounded text-gray-400 mx-1">F1</kbd> to open command palette (Coming Soon)
                    </p>
                </div>

            </div>
        </div>
    )
}
