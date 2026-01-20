import { useState } from "react"
import { useStore } from "@/store/useStore"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { KISOrderDialog } from "@/components/KISOrderDialog" // Import Dialog

/**
 * 시장 스캔 결과를 표 형태로 표시하는 컴포넌트입니다.
 * 종목별 매매 신호, 현재가, 24시간 변동률, AI 감성 분석 결과를 보여줍니다.
 * 
 * @component
 * @returns {JSX.Element} 시장 분석 결과 패널
 */
export function AnalysisPanel() {
    const { analysisResult, isAnalyzing, setTicker, setAnalysisMode } = useStore()

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
            {/* Header */}
            <div className="p-4 border-b border-[#3e3e42] flex justify-between items-center bg-[#252526]">
                <div>
                    <h2 className="text-lg font-bold text-[#e1e1e1]">Market Scanner Result</h2>
                    <p className="text-xs text-[#9d9d9d]">Click BUY/SELL signal to execute order.</p>
                </div>
                <div className="text-xs text-[#777]">
                    Total: {analysisResult.length} scanned
                </div>
            </div>

            <ScrollArea className="flex-1">
                <Table>
                    <TableHeader className="bg-[#2d2d2d] sticky top-0 z-10">
                        <TableRow className="border-[#3e3e42] hover:bg-transparent">
                            <TableHead className="text-[#9d9d9d] w-[140px]">Ticker</TableHead>
                            <TableHead className="text-[#9d9d9d] w-[100px]">Signal</TableHead>
                            <TableHead className="text-[#9d9d9d] text-right">Price</TableHead>
                            <TableHead className="text-[#9d9d9d] text-right">Change (24h)</TableHead>
                            <TableHead className="text-[#9d9d9d] text-center w-[120px]">AI Sentiment</TableHead>
                            <TableHead className="text-[#9d9d9d]">Reason / Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {analysisResult.map((item) => (
                            <TableRow
                                key={item.ticker}
                                className="border-[#2d2d2d] hover:bg-[#2a2d2e] cursor-pointer transition-colors"
                                onClick={() => handleRowClick(item.ticker)}
                            >
                                <TableCell className="font-medium text-[#cccccc]">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white">{item.ticker}</span>
                                        <span className="text-[10px] text-[#777] truncate max-w-[120px]">{item.name}</span>
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
                                <TableCell className="text-right text-[#cccccc] font-mono">
                                    {item.price ? item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                </TableCell>
                                <TableCell className={`text-right font-mono font-medium ${item.changeRate > 0 ? 'text-[#f23645]' : item.changeRate < 0 ? 'text-[#089981]' : 'text-[#9d9d9d]'}`}>
                                    {item.changeRate ? `${item.changeRate > 0 ? '+' : ''}${item.changeRate.toFixed(2)}%` : '-'}
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
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>

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
