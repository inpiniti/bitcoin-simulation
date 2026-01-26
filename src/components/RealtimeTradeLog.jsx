import { useStore } from "@/store/useStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

/**
 * 실시간 가상 매매 로그 및 현재 포지션 상태를 표시하는 패널
 * @returns {JSX.Element}
 */
export function RealtimeTradeLog() {
    const { realtimeTrades, realtimePositions, realtimePrices, clearRealtimeTrades } = useStore()

    // 실현 손익 계산 (판매 완료된 건들)
    const realizedProfit = realtimeTrades
        .filter(t => t.type === 'SELL')
        .reduce((sum, t) => sum + (t.profit || 0), 0)

    // 평가 손익 계산 (보유 중인 포지션들)
    let totalFloatingProfit = 0
    const activePositions = Object.entries(realtimePositions).map(([ticker, pos]) => {
        const currentPrice = realtimePrices[ticker]?.price || pos.avgPrice
        const profit = (currentPrice - pos.avgPrice) * pos.totalQty
        const profitRate = ((currentPrice - pos.avgPrice) / pos.avgPrice) * 100
        totalFloatingProfit += profit
        return { ticker, ...pos, currentPrice, profit, profitRate }
    })

    const totalProfit = realizedProfit + totalFloatingProfit

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e] border-l border-[#3e3e42]">
            {/* 상단 요약 헤더 */}
            <div className="p-3 border-b border-[#3e3e42] flex justify-between items-center bg-[#252526]">
                <div className="flex flex-col">
                    <h2 className="text-sm font-bold text-[#e1e1e1] flex items-center gap-2">
                        Paper Trading
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-orange-900/30 text-orange-500 border-none">
                            Virtual
                        </Badge>
                    </h2>
                    <div className="flex flex-col gap-0.5 mt-1">
                        <span className={`text-xs font-mono font-bold ${totalProfit >= 0 ? 'text-[#f23645]' : 'text-[#089981]'}`}>
                            Total: {totalProfit > 0 ? '+' : ''}{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <div className="flex gap-2 text-[10px] text-[#888] font-mono">
                            <span>Realized: <span className={realizedProfit >= 0 ? 'text-[#f23645]' : 'text-[#089981]'}>{realizedProfit.toFixed(1)}</span></span>
                            <span>Floating: <span className={totalFloatingProfit >= 0 ? 'text-[#f23645]' : 'text-[#089981]'}>{totalFloatingProfit.toFixed(1)}</span></span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={clearRealtimeTrades}
                    className="text-[10px] text-[#888] hover:text-[#ccc] border border-[#444] rounded px-2 py-0.5"
                >
                    Clear
                </button>
            </div>

            {/* 현재 보유 포지션 섹션 */}
            <div className="bg-[#2d2d2d] px-3 py-1.5 text-[10px] text-[#999] font-bold border-b border-[#3e3e42]">
                ACTIVE POSITIONS ({activePositions.length})
            </div>

            <div className="max-h-[250px] overflow-y-auto bg-[#1a1a1a] border-b border-[#3e3e42]">
                {activePositions.length === 0 ? (
                    <div className="p-4 text-[11px] text-[#555] italic text-center">No active positions</div>
                ) : (
                    activePositions.map((pos) => (
                        <div key={pos.ticker} className="p-2.5 border-b border-[#2d2d2d] flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                                <span className="text-[12px] font-black text-white">{pos.ticker}</span>
                                <Badge className="bg-[#3c3c3c] text-[10px] px-1.5 py-0 border-none">Qty: {pos.totalQty}</Badge>
                            </div>
                            <div className="flex justify-between text-[11px] font-mono">
                                <div className="flex flex-col">
                                    <span className="text-[#888]">Avg: {pos.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                    <span className="text-[#888]">Cur: {pos.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex flex-col items-end justify-center">
                                    <span className={`font-bold ${pos.profit >= 0 ? 'text-[#f23645]' : 'text-[#089981]'}`}>
                                        {pos.profit > 0 ? '+' : ''}{pos.profit.toFixed(2)}
                                    </span>
                                    <span className={`text-[10px] ${pos.profit >= 0 ? 'text-[#f23645]' : 'text-[#089981]'}`}>
                                        ({pos.profitRate > 0 ? '+' : ''}{pos.profitRate.toFixed(2)}%)
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 매매 히스토리 섹션 */}
            <div className="bg-[#2d2d2d] px-3 py-1.5 text-[10px] text-[#999] font-bold border-b border-[#3e3e42]">
                TRADE HISTORY
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col">
                    {realtimeTrades.length === 0 ? (
                        <div className="flex items-center justify-center p-8 text-[#555] text-xs italic">
                            No trades executed yet.
                        </div>
                    ) : (
                        realtimeTrades.map((trade) => (
                            <div key={trade.id} className="border-b border-[#2d2d2d] p-2.5 hover:bg-[#2a2d2e] transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <Badge
                                            className={`rounded-[2px] px-1 py-0 text-[9px] h-4 leading-none border-none ${trade.type === 'BUY'
                                                    ? 'bg-[#f23645] text-white'
                                                    : 'bg-[#089981] text-white'
                                                }`}
                                        >
                                            {trade.type}
                                        </Badge>
                                        <span className="text-[12px] font-bold text-[#e1e1e1]">{trade.ticker}</span>
                                        <span className="text-[10px] text-[#666]">x{trade.quantity}</span>
                                    </div>
                                    <span className="text-[10px] text-[#666] font-mono">
                                        {trade.time.split('T')[1].split('.')[0]}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center text-[11px] font-mono">
                                    <span className="text-[#ccc]">{trade.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                    {trade.type === 'SELL' && (
                                        <span className={`font-bold ${trade.profit >= 0 ? 'text-[#f23645]' : 'text-[#089981]'}`}>
                                            {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)} ({trade.profitRate.toFixed(2)}%)
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1 text-[10px] text-[#555] truncate italic">
                                    {trade.reason}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
