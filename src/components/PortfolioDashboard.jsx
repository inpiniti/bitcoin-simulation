/**
 * 포트폴리오 대시보드 컴포넌트
 * 
 * 보유 종목의 시각적 분포, 리스크 지표(MDD, 변동성), 매매 신호 통합 표시
 * 
 * @component
 * @returns {JSX.Element} 포트폴리오 대시보드 UI
 */
import { useState, useEffect, useMemo } from "react"
import { useStore } from "@/store/useStore"
import { useShallow } from "zustand/react/shallow"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, RefreshCcw, PieChartIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { getOverseasBalance } from "@/lib/kisApi"
import { fetchStockHistory } from "@/lib/api"
import { addDerivedData, analyzeSignal } from "@/lib/dataProcessor"

// 섹터 색상 팔레트
const SECTOR_COLORS = {
    'Technology': '#007acc',
    'Healthcare': '#4ec9b0',
    'Financial': '#ce9178',
    'Consumer': '#dcdcaa',
    'Energy': '#f48771',
    'Industrial': '#9cdcfe',
    'Materials': '#c586c0',
    'Utilities': '#6a9955',
    'Real Estate': '#d7ba7d',
    'Communication': '#4fc1ff',
    'Other': '#858585',
}

// 종목별 색상 (섹터 없을 때 fallback)
const STOCK_COLORS = [
    '#007acc', '#4ec9b0', '#ce9178', '#dcdcaa', '#f48771',
    '#9cdcfe', '#c586c0', '#6a9955', '#d7ba7d', '#4fc1ff',
]

export function PortfolioDashboard() {
    const { kisAuth, strategyOptions, dataCache } = useStore(useShallow(state => ({
        kisAuth: state.kisAuth,
        strategyOptions: state.strategyOptions,
        dataCache: state.dataCache,
    })))
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [loadError, setLoadError] = useState(null)
    const [holdings, setHoldings] = useState([])
    const [summary, setSummary] = useState({})
    const [riskMetrics, setRiskMetrics] = useState({
        mdd: 0,
        volatility: 0,
        sharpeRatio: 0,
    })
    const [signals, setSignals] = useState({}) // ticker -> signal

    // 데이터 로드
    const loadPortfolioData = async () => {
        if (!kisAuth.isLoggedIn) {
            setLoading(false)
            return
        }

        try {
            const { accessToken, appkey, appsecret, accountNo, accountCode } = kisAuth
            const result = await getOverseasBalance(accessToken, appkey, appsecret, accountNo, accountCode)

            if (result.success) {
                const filteredHoldings = (result.holdings || []).filter(h =>
                    Number(h.ccld_qty_smtl1) > 0 && parseFloat(h.frcr_evlu_amt2) > 0
                )
                setHoldings(filteredHoldings)
                setSummary(result.summary || {})

                // 리스크 지표 계산 및 매매 신호 분석
                await calculateRiskAndSignals(filteredHoldings)
            }
        } catch (error) {
            console.error("포트폴리오 데이터 로드 오류:", error)
            setLoadError('포트폴리오 데이터를 불러오지 못했습니다. KIS 연결을 확인해주세요.')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    // 리스크 지표 계산 및 매매 신호 분석 (병렬 처리 + 캐시 활용)
    const calculateRiskAndSignals = async (holdingsList) => {
        if (holdingsList.length === 0) return

        const today = new Date().toISOString().split('T')[0]

        const analyzeHolding = async (holding) => {
            const ticker = holding.pdno
            // dataCache 우선 활용 (1d 당일 캐시)
            const cachedEntry = dataCache[ticker]
            let histData = (cachedEntry && new Date(cachedEntry.timestamp).toISOString().split('T')[0] === today)
                ? cachedEntry.data
                : await fetchStockHistory(ticker, 60)

            if (!histData || histData.length <= 20) return null

            const dataWithIndicators = addDerivedData(histData)
            const signalResult = analyzeSignal(dataWithIndicators, strategyOptions)

            const returns = []
            for (let i = 1; i < dataWithIndicators.length; i++) {
                const prevClose = dataWithIndicators[i - 1].close
                const currClose = dataWithIndicators[i].close
                if (prevClose > 0) returns.push((currClose - prevClose) / prevClose)
            }
            let annualVol = 0
            if (returns.length > 0) {
                const mean = returns.reduce((a, b) => a + b, 0) / returns.length
                const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length
                annualVol = Math.sqrt(variance) * Math.sqrt(252) * 100
            }

            let peak = dataWithIndicators[0].close
            let mdd = 0
            for (const item of dataWithIndicators) {
                if (item.close > peak) peak = item.close
                const drawdown = ((peak - item.close) / peak) * 100
                if (drawdown > mdd) mdd = drawdown
            }

            return { ticker, signal: signalResult, annualVol, mdd }
        }

        // 보유 종목 전체 병렬 처리
        const settled = await Promise.allSettled(holdingsList.map(analyzeHolding))

        const signalMap = {}
        let totalVolatility = 0, maxDrawdown = 0, validCount = 0

        for (const result of settled) {
            if (result.status !== 'fulfilled' || !result.value) continue
            const { ticker, signal, annualVol, mdd } = result.value
            signalMap[ticker] = signal
            if (annualVol > 0) { totalVolatility += annualVol; validCount++ }
            if (mdd > maxDrawdown) maxDrawdown = mdd
        }

        setSignals(signalMap)
        setRiskMetrics({
            mdd: maxDrawdown,
            volatility: validCount > 0 ? totalVolatility / validCount : 0,
            sharpeRatio: 0,
        })
    }

    useEffect(() => {
        loadPortfolioData()
    }, [kisAuth.isLoggedIn])

    // 파이 차트 데이터 (종목별 비중)
    const pieChartData = useMemo(() => {
        if (holdings.length === 0) return []

        const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.frcr_evlu_amt2 || 0), 0)

        return holdings.map((h, idx) => ({
            name: h.pdno,
            fullName: h.prdt_name,
            value: parseFloat(h.frcr_evlu_amt2 || 0),
            percentage: totalValue > 0 ? (parseFloat(h.frcr_evlu_amt2 || 0) / totalValue * 100) : 0,
            color: STOCK_COLORS[idx % STOCK_COLORS.length],
            profitRate: parseFloat(h.evlu_pfls_rt1 || 0),
        }))
    }, [holdings])

    // 새로고침 핸들러
    const handleRefresh = async () => {
        setRefreshing(true)
        await loadPortfolioData()
    }

    // 커스텀 툴팁
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload
            return (
                <div className="bg-[#252526] border border-[#3c3c3c] px-3 py-2 shadow-lg">
                    <div className="text-xs text-white font-medium">{data.fullName}</div>
                    <div className="text-[10px] text-[#888888]">{data.name}</div>
                    <div className="text-xs text-[#4fc1ff] mt-1">
                        ${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-[#888888]">
                        비중: {data.percentage.toFixed(1)}%
                    </div>
                    <div className={cn(
                        "text-xs",
                        data.profitRate >= 0 ? "text-[#4ec9b0]" : "text-[#f48771]"
                    )}>
                        수익률: {data.profitRate >= 0 ? '+' : ''}{data.profitRate.toFixed(2)}%
                    </div>
                </div>
            )
        }
        return null
    }

    // KIS 미로그인 시
    if (!kisAuth.isLoggedIn) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
                <div className="text-center text-[#888888]">
                    <PieChartIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <div className="text-sm">KIS 로그인이 필요합니다</div>
                    <div className="text-xs mt-1">상단의 [계좌] 버튼을 눌러 로그인하세요</div>
                </div>
            </div>
        )
    }

    // 로딩 중
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
                <Loader2 className="w-8 h-8 animate-spin text-[#007acc]" />
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">
            {/* 에러 배너 */}
            {loadError && (
                <div className="px-4 py-2 bg-[#5a1d1d] border-b border-[#f48771] text-[#f48771] text-xs flex items-center justify-between">
                    <span>{loadError}</span>
                    <button onClick={() => setLoadError(null)} className="ml-2 hover:text-white">✕</button>
                </div>
            )}

            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c] bg-[#252526]">
                <div className="flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-[#007acc]" />
                    <span className="text-xs text-[#cccccc] font-medium">포트폴리오 대시보드</span>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-1.5 text-[#cccccc] hover:text-white hover:bg-[#3c3c3c] rounded transition-colors disabled:opacity-50"
                >
                    <RefreshCcw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                </button>
            </div>

            {/* 메인 컨텐츠 */}
            <div className="flex-1 overflow-auto p-4">
                {/* 상단: 요약 카드 */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {/* 총 평가금액 */}
                    <div className="bg-[#252526] border border-[#3c3c3c] p-4 rounded-lg">
                        <div className="text-[10px] text-[#888888] uppercase tracking-wide mb-1">총 평가금액</div>
                        <div className="text-xl text-[#4fc1ff] font-semibold">
                            ${parseFloat(summary.evlu_amt_smtl || 0).toLocaleString()}
                        </div>
                    </div>

                    {/* 총 수익률 */}
                    <div className="bg-[#252526] border border-[#3c3c3c] p-4 rounded-lg">
                        <div className="text-[10px] text-[#888888] uppercase tracking-wide mb-1">총 수익률</div>
                        <div className={cn(
                            "text-xl font-semibold flex items-center gap-1",
                            parseFloat(summary.evlu_erng_rt1 || 0) >= 0 ? "text-[#4ec9b0]" : "text-[#f48771]"
                        )}>
                            {parseFloat(summary.evlu_erng_rt1 || 0) >= 0 ? (
                                <TrendingUp className="w-5 h-5" />
                            ) : (
                                <TrendingDown className="w-5 h-5" />
                            )}
                            {parseFloat(summary.evlu_erng_rt1 || 0).toFixed(2)}%
                        </div>
                    </div>

                    {/* MDD (최대 낙폭) */}
                    <div className="bg-[#252526] border border-[#3c3c3c] p-4 rounded-lg">
                        <div className="text-[10px] text-[#888888] uppercase tracking-wide mb-1">MDD (최대 낙폭)</div>
                        <div className={cn(
                            "text-xl font-semibold flex items-center gap-1",
                            riskMetrics.mdd > 20 ? "text-[#f48771]" : riskMetrics.mdd > 10 ? "text-[#ce9178]" : "text-[#4ec9b0]"
                        )}>
                            {riskMetrics.mdd > 15 && <AlertTriangle className="w-5 h-5" />}
                            -{riskMetrics.mdd.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-[#888888] mt-1">
                            {riskMetrics.mdd > 20 ? "⚠️ 고위험" : riskMetrics.mdd > 10 ? "주의" : "안정"}
                        </div>
                    </div>

                    {/* 변동성 */}
                    <div className="bg-[#252526] border border-[#3c3c3c] p-4 rounded-lg">
                        <div className="text-[10px] text-[#888888] uppercase tracking-wide mb-1">연환산 변동성</div>
                        <div className={cn(
                            "text-xl font-semibold",
                            riskMetrics.volatility > 40 ? "text-[#f48771]" : riskMetrics.volatility > 25 ? "text-[#ce9178]" : "text-[#4ec9b0]"
                        )}>
                            {riskMetrics.volatility.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-[#888888] mt-1">
                            {riskMetrics.volatility > 40 ? "⚠️ 고변동" : riskMetrics.volatility > 25 ? "중변동" : "저변동"}
                        </div>
                    </div>
                </div>

                {/* 중단: 차트 및 종목 리스트 */}
                <div className="grid grid-cols-2 gap-6">
                    {/* 파이 차트 */}
                    <div className="bg-[#252526] border border-[#3c3c3c] p-4 rounded-lg">
                        <div className="text-xs text-[#cccccc] font-medium mb-4">자산 비중</div>
                        {pieChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={pieChartData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        innerRadius={50}
                                        paddingAngle={2}
                                        label={({ name, percentage }) => `${name} (${percentage.toFixed(0)}%)`}
                                        labelLine={{ stroke: '#888888', strokeWidth: 1 }}
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[280px] flex items-center justify-center text-[#888888] text-xs">
                                보유 종목이 없습니다
                            </div>
                        )}
                    </div>

                    {/* 종목별 신호 및 추천 */}
                    <div className="bg-[#252526] border border-[#3c3c3c] p-4 rounded-lg">
                        <div className="text-xs text-[#cccccc] font-medium mb-4">종목별 매매 신호</div>
                        <div className="space-y-2 max-h-[280px] overflow-y-auto">
                            {holdings.length === 0 ? (
                                <div className="text-[#888888] text-xs text-center py-8">
                                    보유 종목이 없습니다
                                </div>
                            ) : (
                                holdings.map((holding, idx) => {
                                    const ticker = holding.pdno
                                    const signal = signals[ticker]
                                    const profitRate = parseFloat(holding.evlu_pfls_rt1 || 0)

                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-2 bg-[#1e1e1e] rounded hover:bg-[#2d2d2d] transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: STOCK_COLORS[idx % STOCK_COLORS.length] }}
                                                />
                                                <div>
                                                    <div className="text-xs text-[#cccccc] font-medium">{ticker}</div>
                                                    <div className="text-[10px] text-[#888888] truncate max-w-[120px]">
                                                        {holding.prdt_name}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {/* 수익률 */}
                                                <div className={cn(
                                                    "text-xs font-medium min-w-[60px] text-right",
                                                    profitRate >= 0 ? "text-[#4ec9b0]" : "text-[#f48771]"
                                                )}>
                                                    {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(2)}%
                                                </div>

                                                {/* 신호 */}
                                                <div className={cn(
                                                    "px-2 py-0.5 rounded text-[10px] font-medium min-w-[50px] text-center",
                                                    signal?.signal === 'BUY' && "bg-[#f23645]/20 text-[#f23645]",
                                                    signal?.signal === 'SELL' && "bg-[#089981]/20 text-[#089981]",
                                                    signal?.signal === 'HOLD' && "bg-[#3c3c3c] text-[#888888]",
                                                    !signal && "bg-[#3c3c3c] text-[#888888]"
                                                )}>
                                                    {signal?.signal || 'HOLD'}
                                                </div>

                                                {/* 추천 액션 */}
                                                <div className="text-[10px] text-[#888888] min-w-[60px] text-right">
                                                    {signal?.signal === 'SELL' && profitRate > 5 && '✨ 익절'}
                                                    {signal?.signal === 'SELL' && profitRate < -5 && '⚠️ 손절'}
                                                    {signal?.signal === 'BUY' && profitRate < -10 && '💡 추매'}
                                                    {signal?.signal === 'HOLD' && '유지'}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* 하단: 리스크 설명 */}
                <div className="mt-6 bg-[#252526] border border-[#3c3c3c] p-4 rounded-lg">
                    <div className="text-xs text-[#cccccc] font-medium mb-2">📊 리스크 지표 설명</div>
                    <div className="grid grid-cols-3 gap-4 text-[10px] text-[#888888]">
                        <div>
                            <span className="text-[#4fc1ff]">MDD (Maximum Drawdown)</span>: 고점 대비 최대 하락률입니다. 20% 이상이면 고위험으로 분류됩니다.
                        </div>
                        <div>
                            <span className="text-[#4fc1ff]">연환산 변동성</span>: 일일 수익률 표준편차를 연 단위로 환산한 값입니다. 40% 이상이면 고변동으로 분류됩니다.
                        </div>
                        <div>
                            <span className="text-[#4fc1ff]">매매 신호</span>: 현재 선택된 전략 옵션 기반으로 분석한 결과입니다. 분석 패널(🔍)과 동일한 로직을 사용합니다.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
