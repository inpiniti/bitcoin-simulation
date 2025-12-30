import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { FileCode, X } from "lucide-react"

export function EditorArea() {
    const { selectedResult, setSelectedResult } = useStore()

    if (!selectedResult) {
        return (
            <div className="flex-1 bg-[#1e1e1e] flex items-center justify-center">
                <div className="text-center text-[#5a5a5a]">
                    <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">시뮬레이션 결과가 없습니다.</p>
                    <p className="text-xs mt-2 text-[#4a4a4a]">
                        1. Activity Bar에서 간격 선택<br />
                        2. Sidebar에서 전략 클릭
                    </p>
                </div>
            </div>
        )
    }

    const { key, summary, trades } = selectedResult

    return (
        <div className="flex-1 bg-[#1e1e1e] flex flex-col">
            {/* Tab Bar */}
            <div className="h-9 bg-[#252526] flex items-center border-b border-[#3c3c3c]">
                <div className="flex items-center gap-2 px-4 h-full bg-[#1e1e1e] border-r border-[#3c3c3c] text-[13px] text-[#cccccc]">
                    <FileCode className="w-4 h-4 text-[#f7931a]" />
                    {key}.result
                    <button
                        onClick={() => setSelectedResult(null)}
                        className="ml-2 hover:bg-[#3c3c3c] rounded p-0.5"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Content */}
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
                    </div>
                </div>

                {/* Trade Table */}
                <div className="flex-1 flex flex-col">
                    <div className="px-4 py-2 border-b border-[#3c3c3c]">
                        <h3 className="text-[11px] text-[#569cd6] uppercase tracking-wider">거래 내역</h3>
                    </div>
                    <ScrollArea className="flex-1">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-[#3c3c3c] hover:bg-transparent">
                                    <TableHead className="text-[#569cd6] text-[11px] h-8">#</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8">매수 시간</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right">구매액</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right">판매액</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right">BTC</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right">손익</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right">수익률</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {trades?.slice(0, 200).map((trade, idx) => (
                                    <TableRow key={idx} className="border-[#3c3c3c] hover:bg-[#2a2a2a]">
                                        <TableCell className="font-mono text-[#d4d4d4] text-xs py-1">{trade.cycle}</TableCell>
                                        <TableCell className="font-mono text-[#ce9178] text-xs py-1">
                                            {trade.buy.timestamp?.slice(0, 16)}
                                        </TableCell>
                                        <TableCell className="font-mono text-[#d4d4d4] text-xs text-right py-1">
                                            {trade.quantity?.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="font-mono text-[#d4d4d4] text-xs text-right py-1">
                                            {Math.round(trade.sellValue)?.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="font-mono text-[#dcdcaa] text-xs text-right py-1">
                                            {trade.btcAmount?.toFixed(6)}
                                        </TableCell>
                                        <TableCell className={cn(
                                            "font-mono text-xs text-right py-1",
                                            trade.realProfit >= 0 ? "text-[#4ec9b0]" : "text-[#f14c4c]"
                                        )}>
                                            {trade.realProfit >= 0 ? '+' : ''}{Math.round(trade.realProfit)?.toLocaleString()}
                                        </TableCell>
                                        <TableCell className={cn(
                                            "font-mono text-xs text-right py-1",
                                            trade.realProfitRate >= 0 ? "text-[#4ec9b0]" : "text-[#f14c4c]"
                                        )}>
                                            {trade.realProfitRate >= 0 ? '+' : ''}{trade.realProfitRate?.toFixed(2)}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                    {trades?.length > 200 && (
                        <div className="px-4 py-2 border-t border-[#3c3c3c] text-[11px] text-[#6a6a6a]">
                            처음 200개만 표시 (전체: {trades.length}개)
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
