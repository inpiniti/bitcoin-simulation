import { useState, useMemo } from "react"
import { useStore } from "@/store/useStore"
import { useShallow } from "zustand/react/shallow"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { KISOrderDialog } from "@/components/KISOrderDialog" // Import Dialog
import { RealtimeTradeLog } from "@/components/RealtimeTradeLog"
import { kisWebSocket } from "@/lib/kisWebSocket"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"
import { AnimatedTableRow } from "@/components/ui/AnimatedTableRow"
import { Sparkline } from "@/components/ui/Sparkline"

/**
 * 시장 스캔 결과를 표 형태로 표시하는 컴포넌트입니다.
 * 종목별 매매 신호, 현재가, 24시간 변동률, AI 감성 분석 결과를 보여줍니다.
 * 
 * @component
 * @returns {JSX.Element} 시장 분석 결과 패널
 */
export function AnalysisPanel() {
    const {
        analysisResult,
        isAnalyzing,
        isRealtimeAnalysis,
        realtimeAnalysisData,
        setTicker,
        setAnalysisMode,
    } = useStore(useShallow(state => ({
        analysisResult: state.analysisResult,
        isAnalyzing: state.isAnalyzing,
        isRealtimeAnalysis: state.isRealtimeAnalysis,
        realtimeAnalysisData: state.realtimeAnalysisData,
        setTicker: state.setTicker,
        setAnalysisMode: state.setAnalysisMode,
    })));

    // Order Dialog State
    const [orderDialogOpen, setOrderDialogOpen] = useState(false)
    const [orderConfig, setOrderConfig] = useState({ type: 'buy', ticker: '', price: 0, exchange: '' })

    // Loading state is handled in StatusBar

    if (!analysisResult || analysisResult.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-[#1e1e1e] text-[#9d9d9d]">
                {isAnalyzing ? (
                    <div className="text-center">
                        <p className="text-[#cccccc] animate-pulse">Scanning Market Data...</p>
                        <p className="text-xs text-[#666] mt-2">Please wait while we analyze tickers.</p>
                    </div>
                ) : (
                    <>
                        <p>No analysis results found.</p>
                        <p className="text-sm mt-2">Click 'Analyze All' button in the title bar to start.</p>
                    </>
                )}
            </div>
        )
    }

    const handleRowClick = (ticker) => {
        setTicker(ticker);
        setAnalysisMode(false);
    }

    const handleSignalClick = (e, item) => {
        e.stopPropagation() // 행 클릭 방지
        if (item.signal === 'BUY' || item.signal === 'SELL') {
            setOrderConfig({
                type: item.signal.toLowerCase(), // 'buy' or 'sell'
                ticker: item.ticker,
                price: item.price,
                exchange: item.exchange
            })
            setOrderDialogOpen(true)
        }
    }

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e]">
            <div className={`flex-1 overflow-hidden grid ${isRealtimeAnalysis ? 'grid-cols-[1fr_300px]' : 'grid-cols-1'}`}>
                {/* Left Side: Market Scanner Table */}
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-[#3e3e42] flex justify-between items-center bg-[#252526]">
                        <div>
                            <h2 className="text-lg font-bold text-[#e1e1e1] flex items-center gap-2">
                                Market Scanner Result
                                {isRealtimeAnalysis && (
                                    <Badge variant="destructive" className="animate-pulse px-1.5 py-0 text-[10px] bg-red-600 border-none rounded-sm">
                                        LIVE
                                    </Badge>
                                )}
                            </h2>
                            <p className="text-xs text-[#9d9d9d]">
                                Click BUY/SELL signal to execute order.
                                {isRealtimeAnalysis && (
                                    <span className="text-[#089981] ml-2">
                                        ● Priority Mode: Top 40 Analyzed Stocks Only
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="text-xs text-[#777] flex items-center gap-3">
                            {isRealtimeAnalysis && (
                                <button
                                    onClick={() => kisWebSocket.syncSubscriptions()}
                                    className="px-2 py-0.5 border border-[#444] rounded hover:bg-[#333] transition-colors text-[10px]"
                                >
                                    Resync WS
                                </button>
                            )}
                            Total: {analysisResult.length} scanned
                            {isRealtimeAnalysis && (
                                <WSStatusIndicator />
                            )}
                        </div>
                    </div>


                    <ScrollArea className="flex-1">
                        <Table className="w-full table-fixed">
                            <TableHeader className="bg-[#2d2d2d] sticky top-0 z-10">
                                <TableRow className="border-[#3e3e42] hover:bg-transparent">
                                    <TableHead className="text-[#9d9d9d] w-[140px]">Ticker</TableHead>
                                    <TableHead className="text-[#9d9d9d] w-[100px]">Signal</TableHead>
                                    {isRealtimeAnalysis && (
                                        <TableHead className="text-[#9d9d9d] w-[90px] text-center">Chart</TableHead>
                                    )}
                                    <TableHead className="text-[#9d9d9d] text-right">Price</TableHead>
                                    <TableHead className="text-[#9d9d9d] text-right">Change (24h)</TableHead>
                                    <TableHead className="text-[#9d9d9d] text-center w-[120px]">AI Sentiment</TableHead>
                                    <TableHead className="text-[#9d9d9d]">Reason / Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analysisResult.map((item) => (
                                    <AnimatedTableRow
                                        key={item.ticker}
                                        item={item}
                                        className="border-[#2d2d2d] hover:bg-[#2a2d2e] cursor-pointer transition-colors"
                                        onClick={() => handleRowClick(item.ticker)}
                                    >
                                        <TableCell className="font-medium text-[#cccccc]">
                                            <div className="flex items-center gap-2">
                                                {isRealtimeAnalysis && (
                                                    <div className="flex items-center" title={kisWebSocket.isSubscribed(item.ticker, item.exchange) ? "Live Connected" : "Not Subscribed"}>
                                                        {kisWebSocket.isSubscribed(item.ticker, item.exchange) ? (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#089981] animate-pulse" />
                                                        ) : (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#3c3c3c]" />
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-white">{item.ticker}</span>
                                                    <span className="text-[10px] text-[#777] truncate max-w-[120px]">{item.name}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={item.signal === 'BUY' ? 'destructive' : 'secondary'}
                                                onClick={(e) => handleSignalClick(e, item)}
                                                className={`rounded-sm px-2 py-0.5 text-[10px] uppercase cursor-pointer hover:scale-105 active:scale-95 transition-transform ${getSignalColorClass(item.signal)}`}
                                            >
                                                {item.signal}
                                            </Badge>
                                        </TableCell>
                                        {/* 스파크라인 차트 (실시간 분석 시에만 표시) */}
                                        {isRealtimeAnalysis && (
                                            <TableCell className="py-1">
                                                <SparklineCell
                                                    ticker={item.ticker}
                                                    realtimeAnalysisData={realtimeAnalysisData}
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell className="text-right text-[#cccccc] font-mono">
                                            {item.price ? (
                                                <AnimatedNumber
                                                    value={item.price}
                                                    className="text-[#cccccc]"
                                                />
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono font-medium ${item.changeRate > 0 ? 'text-[#f23645]' : item.changeRate < 0 ? 'text-[#089981]' : 'text-[#9d9d9d]'}`}>
                                            {item.changeRate !== undefined ? (
                                                <AnimatedNumber
                                                    value={item.changeRate}
                                                    format={v => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`}
                                                    flashOnUpdate={false}
                                                />
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.news && item.news.length > 0 ? (
                                                <Badge variant="outline" className={`text-[10px] h-5 ${item.sentiment > 0 ? 'text-[#089981] border-[#089981]' : item.sentiment < 0 ? 'text-[#f23645] border-[#f23645]' : 'text-[#9d9d9d] border-[#555]'}`}>
                                                    {item.sentiment > 0 ? 'POS' : item.sentiment < 0 ? 'NEG' : 'NEU'} ({item.sentiment.toFixed(2)})
                                                </Badge>
                                            ) : (
                                                <span className="text-[#555] text-[10px]">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-[#9d9d9d] text-xs">
                                            {item.reason}
                                        </TableCell>
                                    </AnimatedTableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>

                {/* Right Side: Realtime Trade Log */}
                {isRealtimeAnalysis && (
                    <RealtimeTradeLog />
                )}
            </div>

            <KISOrderDialog
                open={orderDialogOpen}
                onOpenChange={setOrderDialogOpen}
                orderType={orderConfig.type}
                ticker={orderConfig.ticker}
                currentPrice={orderConfig.price}
                initialExchange={orderConfig.exchange}
            />
        </div>
    )
}

/**
 * 스파크라인 셀 컴포넌트 (메모이제이션 적용)
 * realtimeAnalysisData에서 해당 티커의 close 데이터를 추출하여 Sparkline으로 표시
 */
function SparklineCell({ ticker, realtimeAnalysisData }) {
    // 해당 티커의 캔들 데이터에서 close 값만 추출 (메모이제이션)
    const closeData = useMemo(() => {
        const tickerData = realtimeAnalysisData[ticker];
        if (!tickerData || !tickerData.data || tickerData.data.length < 2) {
            return [];
        }
        // close 값만 추출 (최대 300개에서 샘플링은 Sparkline 내부에서 처리)
        return tickerData.data.map(candle => candle.close);
    }, [ticker, realtimeAnalysisData[ticker]?.data?.length, realtimeAnalysisData[ticker]?.data?.[realtimeAnalysisData[ticker]?.data?.length - 1]?.close]);

    if (closeData.length < 2) {
        return <span className="text-[10px] text-[#555]">-</span>;
    }

    return (
        <Sparkline
            data={closeData}
            width={80}
            height={24}
            maxPoints={30}
        />
    );
}

function WSStatusIndicator() {
    const wsStatus = useStore(state => state.wsStatus);
    return (
        <div className="flex items-center gap-2 ml-2">
            <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 border-none ${wsStatus.connected ? 'bg-[#089981]/20 text-[#089981]' : 'bg-[#f23645]/20 text-[#f23645]'}`}
            >
                {wsStatus.connected ? 'Connected' : 'Disconnected'}
            </Badge>
            <span className="text-[#888]">Active WS: {wsStatus.subscriptionCount}</span>
        </div>
    )

}

function getSignalColorClass(signal) {
    switch (signal) {
        case 'BUY': return 'bg-[#f23645] hover:bg-[#d12f3d] text-white border-none'; // Red
        case 'SELL': return 'bg-[#089981] hover:bg-[#067a68] text-white border-none'; // Green/Blue (TradingView uses Green for Up, Red for Down but Buy is Up. Wait.. in TradingView Green is Up/Buy, Red is Down/Sell.) 
        // 한국 주식: 빨강(상승/매수), 파랑(하락/매도)
        // 서구권(TradingView): 초록(상승/매수), 빨강(하락/매도)
        // 일단 한국식? 아니면 TradingView식? 
        // 사용자가 한국어를 쓰므로 한국식(빨강=상승/BUY, 파랑=하락/SELL)으로 가거나,
        // 위 코드에서는 ChangeRate에서 Positive=Red로 했음. 
        // 그럼 BUY = Red, SELL = Blue 로 가야 통일감 있음.
        case 'HOLD': return 'bg-[#3c3c3c] text-[#9d9d9d] hover:bg-[#4c4c4c]';
        case 'SKIP': return 'bg-transparent text-[#555] border border-[#555]';
        case 'ERROR': return 'bg-transparent text-red-500 border border-red-500';
        default: return '';
    }
}
