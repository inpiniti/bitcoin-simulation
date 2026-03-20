import { useState, useEffect, Suspense, lazy } from "react"
import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { useShallow } from "zustand/react/shallow"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { FileCode, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LineChart as LineChartIcon, TableIcon, Play, Loader2, Database, List, BarChart2 } from "lucide-react"
import { TickerTabBar } from "./TickerTabBar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

// 패널들을 지연 로딩(Lazy Loading)으로 전환하여 초기 번들 크기 최적화
const ChartView = lazy(() => import("../ChartView").then(m => ({ default: m.ChartView })))
const AnalysisPanel = lazy(() => import("../AnalysisPanel").then(m => ({ default: m.AnalysisPanel })))
const StockDiscussionPanel = lazy(() => import("../StockDiscussionPanel").then(m => ({ default: m.StockDiscussionPanel })))
const OverviewPanel = lazy(() => import("../OverviewPanel").then(m => ({ default: m.OverviewPanel })))
const NewsPanel = lazy(() => import("../NewsPanel").then(m => ({ default: m.NewsPanel })))
const FinancialQAPanel = lazy(() => import("../FinancialQAPanel").then(m => ({ default: m.FinancialQAPanel })))
const PortfolioDashboard = lazy(() => import("../PortfolioDashboard").then(m => ({ default: m.PortfolioDashboard })))
const EarningsImpactPanel = lazy(() => import("../EarningsImpactPanel").then(m => ({ default: m.EarningsImpactPanel })))
const DeepLearningPanel = lazy(() => import("../DeepLearningPanel").then(m => ({ default: m.DeepLearningPanel })))
const DocsPanel = lazy(() => import("../docs/DocsPanel").then(m => ({ default: m.DocsPanel })))
const IntroScreen = lazy(() => import("../IntroScreen").then(m => ({ default: m.IntroScreen })))
const AutomationSettingsPanel = lazy(() => import("../automation/AutomationSettingsPanel").then(m => ({ default: m.AutomationSettingsPanel })))


// 페이지당 거래 수
const ITEMS_PER_PAGE = 50

// 날짜 포맷팅 함수
function formatDateTime(timestamp) {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return timestamp?.slice(0, 16) || '-'

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 가격 포맷팅 함수
function formatBtcPrice(price) {
    if (!price) return '-'
    return Math.round(price).toLocaleString()
}

/**
 * Main editor area component that renders different panels based on the current view mode.
 * Handles pagination for data tables and switching between simulation, analysis, charts, etc.
 * 
 * @component
 * @returns {JSX.Element} The rendered EditorArea component
 */
export function EditorArea() {
    const { selectedResult, viewMode, hist, ticker, activeTickers, openTicker, interval } = useStore(useShallow(state => ({
        selectedResult: state.selectedResult,
        viewMode: state.viewMode,
        hist: state.hist,
        ticker: state.ticker,
        activeTickers: state.activeTickers,
        openTicker: state.openTicker,
        interval: state.interval,
    })))
    const [currentPage, setCurrentPage] = useState(1)

    // 페이지네이션 초기화
    useEffect(() => {
        setCurrentPage(1)
    }, [viewMode, selectedResult])

    // 안전장치: 현재 티커가 있는데 탭 목록에 없으면 추가 (새로고침 직후 등 대비)
    useEffect(() => {
        if (ticker && activeTickers && !activeTickers.includes(ticker)) {
            openTicker(ticker)
        }
    }, [ticker, activeTickers, openTicker])

    const data = hist[interval] || []

    const renderContent = () => {
        // 탭이 하나도 없으면 소개 화면 표시 (단, 티커와 무관한 독립 패널 모드는 제외)
        const independentModes = ['docs', 'portfolio', 'analyze', 'deepLearning', 'automation']
        if ((!activeTickers || activeTickers.length === 0) && !independentModes.includes(viewMode)) {
            return <IntroScreen />
        }

        // Overview Mode
        if (viewMode === 'overview') {
            return <OverviewPanel />
        }

        // News Mode
        if (viewMode === 'news') {
            return <NewsPanel />
        }

        // Analysis Mode
        if (viewMode === 'analyze') {
            return <AnalysisPanel />
        }

        // Discussion View Mode
        if (viewMode === 'discussion') {
            return <StockDiscussionPanel />
        }

        // QA Mode
        if (viewMode === 'qa') {
            return <FinancialQAPanel />
        }

        // Portfolio Dashboard Mode
        if (viewMode === 'portfolio') {
            return <PortfolioDashboard />
        }

        // Earnings Impact Mode
        if (viewMode === 'earnings') {
            return <EarningsImpactPanel />
        }

        // Deep Learning Mode
        if (viewMode === 'deepLearning') {
            return <DeepLearningPanel />
        }

        // Automation Settings Mode
        if (viewMode === 'automation') {
            return <AutomationSettingsPanel />
        }

        // Chart View Mode
        if (viewMode === 'chartView') {
            return <ChartView />
        }

        // Docs View Mode
        if (viewMode === 'docs') {
            return <DocsPanel />
        }


        // Data View Mode
        if (viewMode === 'dataView') {
            if (!data || data.length === 0) {
                return (
                    <div className="flex-1 bg-[#1e1e1e] flex items-center justify-center">
                        <div className="text-center text-[#5a5a5a]">
                            <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                            <p className="text-sm">데이터가 없습니다.</p>
                            <p className="text-xs mt-2 text-[#4a4a4a]">
                                상단에서 Coin/Stock 모드를 선택하면 자동으로 데이터가 로드됩니다.
                            </p>
                        </div>
                    </div>
                )
            }

            const sortedData = [...data].reverse()
            const totalItems = sortedData.length
            const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
            const validPage = Math.min(Math.max(1, currentPage), totalPages)
            const startIndex = (validPage - 1) * ITEMS_PER_PAGE
            const endIndex = startIndex + ITEMS_PER_PAGE
            const currentItems = sortedData.slice(startIndex, endIndex)

            const goToPage = (page) => {
                if (page >= 1 && page <= totalPages) {
                    setCurrentPage(page)
                }
            }

            return (
                <div className="flex-1 bg-[#1e1e1e] flex flex-col h-full overflow-hidden">
                    <div className="h-9 bg-[#252526] flex items-center border-b border-[#3c3c3c] px-4 justify-between shrink-0">
                        <div className="flex items-center gap-2 text-[13px] text-[#cccccc]">
                            <TableIcon className="w-4 h-4 text-[#569cd6]" />
                            <span>DATA VIEW: {interval === '1d' ? '1d' : '1m'} ({totalItems.toLocaleString()} rows)</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-[#3c3c3c] hover:bg-transparent">
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 sticky top-0 bg-[#1e1e1e]">날짜 (Date)</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">Open</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">Close</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e] bg-[#252526]">Median</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">Slope</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">RSI(14)</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">MA50</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-center sticky top-0 bg-[#1e1e1e]">BB Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentItems.map((item, idx) => {
                                    let bbText = "-";
                                    let bbColor = "text-[#808080]";
                                    if (item.bbStatus === 2) { bbText = "Upper Break"; bbColor = "text-[#f14c4c]"; }
                                    else if (item.bbStatus === 1) { bbText = "Upper Zone"; bbColor = "text-[#ce9178]"; }
                                    else if (item.bbStatus === -1) { bbText = "Lower Zone"; bbColor = "text-[#9cdcfe]"; }
                                    else if (item.bbStatus === -2) { bbText = "Lower Break"; bbColor = "text-[#4ec9b0]"; }
                                    else if (item.bbStatus === 0) { bbText = "Mean"; }

                                    return (
                                        <TableRow key={idx} className="border-[#3c3c3c] hover:bg-[#2a2a2a]">
                                            <TableCell className="font-mono text-[#4fc1ff] text-xs py-1.5">
                                                {formatDateTime(item.timestamp)}
                                            </TableCell>
                                            <TableCell className="font-mono text-[#d4d4d4] text-xs text-right py-1.5">
                                                {item.open?.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="font-mono text-[#dcdcaa] text-xs text-right py-1.5">
                                                {item.close?.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="font-mono text-[#dcdcaa] text-xs text-right py-1.5 font-bold bg-[#252526]/50">
                                                {item.median?.toLocaleString()}
                                            </TableCell>
                                            <TableCell className={cn(
                                                "font-mono text-xs text-right py-1.5",
                                                item.slope > 0 ? "text-[#4ec9b0]" : item.slope < 0 ? "text-[#f14c4c]" : "text-[#808080]"
                                            )}>
                                                {item.slope > 0 ? '+' : ''}{item.slope?.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="font-mono text-[#ce9178] text-xs text-right py-1.5">
                                                {item.rsi?.toFixed(1) || '-'}
                                            </TableCell>
                                            <TableCell className="font-mono text-[#d4d4d4] text-xs text-right py-1.5">
                                                {item.ma50?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '-'}
                                            </TableCell>
                                            <TableCell className={cn("font-mono text-xs text-center py-1.5 font-medium", bbColor)}>
                                                {bbText} <span className="text-[10px] opacity-70">({item.bbStatus})</span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-4 py-2 border-t border-[#3c3c3c] flex items-center justify-between bg-[#1e1e1e] shrink-0">
                            <div className="text-[11px] text-[#6a6a6a]">
                                {startIndex + 1} - {Math.min(endIndex, totalItems)} / {totalItems} rows
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30" onClick={() => goToPage(1)} disabled={validPage === 1}>
                                    <ChevronsLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30" onClick={() => goToPage(validPage - 1)} disabled={validPage === 1}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="text-[11px] text-[#cccccc] px-2 min-w-[3rem] text-center">
                                    {validPage} / {totalPages}
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30" onClick={() => goToPage(validPage + 1)} disabled={validPage === totalPages}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30" onClick={() => goToPage(totalPages)} disabled={validPage === totalPages}>
                                    <ChevronsRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )
        }

        // Simulation Mode (Default)
        if (!selectedResult) {
            return (
                <div className="flex-1 bg-[#1e1e1e] flex items-center justify-center">
                    <div className="text-center text-[#5a5a5a]">
                        <Play className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-sm">시뮬레이션 결과가 없습니다.</p>
                        <p className="text-xs mt-2 text-[#4a4a4a]">
                            1. 데이터가 로드되면<br />
                            2. Sidebar에서 전략 설정 후 실행
                        </p>
                    </div>
                </div>
            )
        }

        const { summary, trades, aiData, options } = selectedResult

        // 페이징 계산
        const totalItems = trades?.length || 0
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
        const endIndex = startIndex + ITEMS_PER_PAGE
        const currentTrades = trades?.slice(startIndex, endIndex) || []

        const handlePageChange = (page) => {
            if (page >= 1 && page <= totalPages) {
                setCurrentPage(page)
            }
        }

        return (
            <div className="flex-1 flex overflow-hidden">
                {/* Summary Panel */}
                <div className="w-72 border-r border-[#3c3c3c] p-4 overflow-auto">
                    <h3 className="text-[11px] text-[#569cd6] uppercase tracking-wider mb-4">요약 정보</h3>

                    <div className="space-y-4">
                        <div>
                            <span className="text-[11px] text-[#6a9955]">// 총 수익</span>
                            <p className={cn(
                                "text-xl font-mono font-bold",
                                summary.totalProfit >= 0 ? "text-[#4ec9b0]" : "text-[#f14c4c]"
                            )}>
                                {summary.totalProfit >= 0 ? '+' : ''}{summary.totalProfit?.toLocaleString()}원
                            </p>
                        </div>

                        <div>
                            <span className="text-[11px] text-[#6a9955]">// 승률</span>
                            <p className="text-xl font-mono text-[#dcdcaa]">
                                {summary.winRate?.toFixed(1)}%
                            </p>
                        </div>

                        <div>
                            <span className="text-[11px] text-[#6a9955]">// 거래 결과</span>
                            <p className="text-lg font-mono text-[#ce9178]">
                                {summary.wins}승 {summary.losses}패
                            </p>
                        </div>

                        <div>
                            <span className="text-[11px] text-[#6a9955]">// 사이클 수</span>
                            <p className="text-lg font-mono text-[#9cdcfe]">
                                {summary.totalCycles}회
                            </p>
                        </div>

                        {summary.maxMultiplier && (
                            <div>
                                <span className="text-[11px] text-[#6a9955]">// 최대 배율</span>
                                <p className="text-lg font-mono text-[#c586c0]">
                                    {summary.maxMultiplier?.toFixed(2)}x
                                </p>
                            </div>
                        )}

                        <div>
                            <span className="text-[11px] text-[#6a9955]">// 총 수수료</span>
                            <p className="text-lg font-mono text-[#808080]">
                                {Math.round(summary.totalFees || 0)?.toLocaleString()}원
                            </p>
                        </div>

                        {/* 전략 옵션 표시 */}
                        {selectedResult.options && (
                            <div className="pt-4 border-t border-[#3c3c3c] space-y-2">
                                <span className="text-[11px] text-[#569cd6] uppercase tracking-wider">적용된 전략</span>
                                <div className="flex flex-wrap gap-1">
                                    <span className="text-[10px] px-1.5 py-0.5 bg-[#3c3c3c] text-[#cccccc] rounded">
                                        {selectedResult.options.moneyManagement === 'cumulative' ? '누적(복리)' : '고정(단리)'}
                                    </span>
                                    {selectedResult.options.useBB && <span className="text-[10px] px-1.5 py-0.5 bg-[#0e639c] text-white rounded">BB필터</span>}
                                    {selectedResult.options.useTrend && <span className="text-[10px] px-1.5 py-0.5 bg-[#0e639c] text-white rounded">추세(50)</span>}
                                    {selectedResult.options.useTrend20 && <span className="text-[10px] px-1.5 py-0.5 bg-[#0e639c] text-white rounded">추세(20)</span>}
                                    {selectedResult.options.useRSI && <span className="text-[10px] px-1.5 py-0.5 bg-[#0e639c] text-white rounded">RSI</span>}
                                    {selectedResult.options.useVolumeFilter && <span className="text-[10px] px-1.5 py-0.5 bg-[#dcdcaa] text-black rounded font-bold">거래량</span>}
                                    {selectedResult.options.useStopLoss && <span className="text-[10px] px-1.5 py-0.5 bg-[#f14c4c] text-white rounded">손절</span>}
                                    {selectedResult.options.useTakeProfit && <span className="text-[10px] px-1.5 py-0.5 bg-[#4ec9b0] text-black rounded font-bold">익절</span>}
                                    {selectedResult.options.useTrailingStop && <span className="text-[10px] px-1.5 py-0.5 bg-[#ce9178] text-white rounded">추적손절</span>}
                                    {selectedResult.options.useVMartingale && (
                                        <span className="text-[10px] px-1.5 py-0.5 bg-[#ffcc00] text-black rounded font-bold">
                                            V-마틴({selectedResult.options.vMartingaleMultiplierMode === 'fixed' ? '1배' : '2배'})
                                        </span>
                                    )}
                                    {selectedResult.options.martingaleMultiplier > 1.0 && <span className="text-[10px] px-1.5 py-0.5 bg-[#c586c0] text-white rounded">마틴({selectedResult.options.martingaleMultiplier}x)</span>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Trade Table with Tabs */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Tabs defaultValue="trades" className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 py-2 border-b border-[#3c3c3c] flex items-center gap-4">
                            <TabsList className="bg-transparent h-7 gap-0 p-0">
                                <TabsTrigger
                                    value="trades"
                                    className="data-[state=active]:bg-[#1e1e1e] data-[state=active]:text-[#569cd6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#569cd6] h-7 px-3 text-[11px] flex items-center gap-1"
                                >
                                    <List className="w-3 h-3" /> 거래내역 ({totalItems})
                                </TabsTrigger>
                                {aiData && (
                                    <TabsTrigger
                                        value="data"
                                        className="data-[state=active]:bg-[#1e1e1e] data-[state=active]:text-[#569cd6] rounded-none border-b-2 border-transparent data-[state=active]:border-[#569cd6] h-7 px-3 text-[11px] flex items-center gap-1"
                                    >
                                        <Database className="w-3 h-3" /> 데이터 뷰 ({aiData.length})
                                    </TabsTrigger>
                                )}
                            </TabsList>
                        </div>

                        {/* 거래내역 탭 */}
                        <TabsContent value="trades" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
                            <ScrollArea className="flex-1">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-[#3c3c3c] hover:bg-transparent">
                                            <TableHead className="text-[#569cd6] text-[11px] h-8 sticky top-0 bg-[#1e1e1e]">#</TableHead>
                                            <TableHead className="text-[#569cd6] text-[11px] h-8 sticky top-0 bg-[#1e1e1e]">매수 시간</TableHead>
                                            <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">구매액</TableHead>
                                            <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">매수 시세</TableHead>
                                            <TableHead className="text-[#569cd6] text-[11px] h-8 sticky top-0 bg-[#1e1e1e]">매도 시간</TableHead>
                                            <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">판매액</TableHead>
                                            <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">매도 시세</TableHead>
                                            <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">손익</TableHead>
                                            <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">수익률</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentTrades.map((trade, idx) => (
                                            <TableRow key={startIndex + idx} className="border-[#3c3c3c] hover:bg-[#2a2a2a]">
                                                <TableCell className="font-mono text-[#d4d4d4] text-xs py-1.5">{trade.cycle}</TableCell>
                                                <TableCell className="font-mono text-[#4fc1ff] text-xs py-1.5">{formatDateTime(trade.buy.timestamp)}</TableCell>
                                                <TableCell className="font-mono text-[#d4d4d4] text-xs text-right py-1.5">{trade.buyCost?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                                <TableCell className="font-mono text-[#dcdcaa] text-xs text-right py-1.5">{formatBtcPrice(trade.buy.price)}</TableCell>
                                                <TableCell className="font-mono text-[#ce9178] text-xs py-1.5">{formatDateTime(trade.sell.timestamp)}</TableCell>
                                                <TableCell className="font-mono text-[#d4d4d4] text-xs text-right py-1.5">{trade.sellRevenue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                                <TableCell className="font-mono text-[#dcdcaa] text-xs text-right py-1.5">{formatBtcPrice(trade.sell.price)}</TableCell>
                                                <TableCell className={cn(
                                                    "font-mono text-xs text-right py-1.5 font-semibold",
                                                    trade.realProfit >= 0 ? "text-[#4ec9b0]" : "text-[#f14c4c]"
                                                )}>
                                                    {trade.realProfit >= 0 ? '+' : ''}{Math.round(trade.realProfit)?.toLocaleString()}
                                                </TableCell>
                                                <TableCell className={cn(
                                                    "font-mono text-xs text-right py-1.5 font-semibold",
                                                    trade.realProfitRate >= 0 ? "text-[#4ec9b0]" : "text-[#f14c4c]"
                                                )}>
                                                    {trade.realProfitRate >= 0 ? '+' : ''}{trade.realProfitRate?.toFixed(2)}%
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>

                            {/* 페이징 컨트롤 */}
                            {totalPages > 1 && (
                                <div className="px-4 py-2 border-t border-[#3c3c3c] flex items-center justify-between shrink-0">
                                    <div className="text-[11px] text-[#6a6a6a]">
                                        {startIndex + 1} - {Math.min(endIndex, totalItems)} / {totalItems}건
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
                                            <ChevronsLeft className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <div className="text-[11px] text-[#cccccc] px-2">{currentPage} / {totalPages}</div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}>
                                            <ChevronsRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* 데이터 뷰 탭 (AI 전용) */}
                        {aiData && (
                            <TabsContent value="data" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
                                <ScrollArea className="flex-1">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-[#3c3c3c] hover:bg-transparent">
                                                <TableHead className="text-[#569cd6] text-[11px] h-8 sticky top-0 bg-[#1e1e1e]">날짜</TableHead>
                                                <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">예측 확률</TableHead>
                                                <TableHead className="text-[#569cd6] text-[11px] h-8 text-center sticky top-0 bg-[#1e1e1e]">신호</TableHead>
                                                <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">연속일</TableHead>
                                                <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">1일%</TableHead>
                                                <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">7일%</TableHead>
                                                <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">30일%</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {aiData.slice(0, 500).map((item, idx) => {
                                                const isBuy = item.probability >= (options?.aiBuyThreshold || 0.6)
                                                const isSell = item.probability < (options?.aiSellThreshold || 0.4)
                                                return (
                                                    <TableRow
                                                        key={idx}
                                                        className={cn(
                                                            "border-[#3c3c3c] hover:bg-[#2a2a2a]",
                                                            isBuy ? "bg-[#4ec9b0]/5" : isSell ? "bg-[#f14c4c]/5" : ""
                                                        )}
                                                    >
                                                        <TableCell className="font-mono text-[#4fc1ff] text-xs py-1.5">
                                                            {new Date(item.date).toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell className={cn(
                                                            "font-mono text-xs text-right py-1.5 font-bold",
                                                            item.probability > 0.5 ? "text-[#4ec9b0]" : "text-[#f14c4c]"
                                                        )}>
                                                            {(item.probability * 100).toFixed(1)}%
                                                        </TableCell>
                                                        <TableCell className="text-center py-1.5">
                                                            {isBuy ? (
                                                                <Badge className="bg-[#4ec9b0] text-black text-[10px] hover:bg-[#4ec9b0]/80">BUY</Badge>
                                                            ) : isSell ? (
                                                                <Badge className="bg-[#f14c4c] text-white text-[10px] hover:bg-[#f14c4c]/80">SELL</Badge>
                                                            ) : (
                                                                <span className="text-[#808080] text-[10px]">HOLD</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className={cn(
                                                            "font-mono text-xs text-right py-1.5",
                                                            (item.consecutiveDays || 0) > 0 ? "text-[#4ec9b0]" : (item.consecutiveDays || 0) < 0 ? "text-[#f14c4c]" : "text-[#808080]"
                                                        )}>
                                                            {item.consecutiveDays || 0}
                                                        </TableCell>
                                                        <TableCell className={cn(
                                                            "font-mono text-xs text-right py-1.5",
                                                            (item.change1d || 0) > 0 ? "text-[#4ec9b0]" : "text-[#f14c4c]"
                                                        )}>
                                                            {(item.change1d || 0).toFixed(1)}%
                                                        </TableCell>
                                                        <TableCell className={cn(
                                                            "font-mono text-xs text-right py-1.5",
                                                            (item.change7d || 0) > 0 ? "text-[#4ec9b0]" : "text-[#f14c4c]"
                                                        )}>
                                                            {(item.change7d || 0).toFixed(1)}%
                                                        </TableCell>
                                                        <TableCell className={cn(
                                                            "font-mono text-xs text-right py-1.5",
                                                            (item.change30d || 0) > 0 ? "text-[#4ec9b0]" : "text-[#f14c4c]"
                                                        )}>
                                                            {(item.change30d || 0).toFixed(1)}%
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                                {aiData.length > 500 && (
                                    <div className="px-4 py-2 border-t border-[#3c3c3c] text-center">
                                        <span className="text-[11px] text-[#6a6a6a]">
                                            최근 500건만 표시 (전체: {aiData.length}건)
                                        </span>
                                    </div>
                                )}
                            </TabsContent>
                        )}
                    </Tabs>
                </div>
            </div>
        )

    }



    return (
        <div className="flex-1 bg-[#1e1e1e] flex flex-col h-full overflow-hidden">
            {/* 항상 표시되는 탭 바 */}
            <TickerTabBar />

            <div className="flex-1 flex flex-col overflow-hidden relative">
                <Suspense fallback={
                    <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
                        <Loader2 className="w-8 h-8 animate-spin text-[#007acc]" />
                    </div>
                }>
                    {renderContent()}
                </Suspense>
            </div>
        </div>
    )
}
