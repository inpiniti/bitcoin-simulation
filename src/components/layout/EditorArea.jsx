import { useState } from "react"
import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
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
import { FileCode, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

// 페이지당 거래 수
const ITEMS_PER_PAGE = 50

// 날짜 포맷팅 함수
function formatDateTime(timestamp) {
    if (!timestamp) return '-'
    // timestamp가 ISO 문자열이면 그대로 사용, Date 객체면 변환
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return timestamp?.slice(0, 16) || '-'

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 가격 포맷팅 함수 (BTC 시세)
function formatBtcPrice(price) {
    if (!price) return '-'
    return Math.round(price).toLocaleString()
}

export function EditorArea() {
    const { selectedResult, setSelectedResult } = useStore()
    const [currentPage, setCurrentPage] = useState(1)

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

    // 페이징 계산
    const totalItems = trades?.length || 0
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const currentTrades = trades?.slice(startIndex, endIndex) || []

    // 페이지 변경 핸들러
    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page)
        }
    }

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

                        <div>
                            <span className="text-[11px] text-[#6a9955]">// 총 수수료</span>
                            <p className="text-lg font-mono text-[#808080]">
                                {Math.round(summary.totalFees || 0)?.toLocaleString()}원
                            </p>
                        </div>
                    </div>
                </div>

                {/* Trade Table */}
                <div className="flex-1 flex flex-col">
                    <div className="px-4 py-2 border-b border-[#3c3c3c] flex items-center justify-between">
                        <h3 className="text-[11px] text-[#569cd6] uppercase tracking-wider">
                            거래 내역 ({totalItems}건)
                        </h3>
                    </div>
                    <ScrollArea className="flex-1">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-[#3c3c3c] hover:bg-transparent">
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 sticky top-0 bg-[#1e1e1e]">#</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 sticky top-0 bg-[#1e1e1e]">매수 시간</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">구매액</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">매수 BTC시세</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 sticky top-0 bg-[#1e1e1e]">매도 시간</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">판매액</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">매도 BTC시세</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">손익</TableHead>
                                    <TableHead className="text-[#569cd6] text-[11px] h-8 text-right sticky top-0 bg-[#1e1e1e]">수익률</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentTrades.map((trade, idx) => (
                                    <TableRow key={startIndex + idx} className="border-[#3c3c3c] hover:bg-[#2a2a2a]">
                                        {/* # (사이클 번호) */}
                                        <TableCell className="font-mono text-[#d4d4d4] text-xs py-1.5">
                                            {trade.cycle}
                                        </TableCell>
                                        {/* 매수 시간 */}
                                        <TableCell className="font-mono text-[#4fc1ff] text-xs py-1.5">
                                            {formatDateTime(trade.buy.timestamp)}
                                        </TableCell>
                                        {/* 구매액 */}
                                        <TableCell className="font-mono text-[#d4d4d4] text-xs text-right py-1.5">
                                            {trade.buyCost?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </TableCell>
                                        {/* 매수 BTC 시세 */}
                                        <TableCell className="font-mono text-[#dcdcaa] text-xs text-right py-1.5">
                                            {formatBtcPrice(trade.buy.price)}
                                        </TableCell>
                                        {/* 매도 시간 */}
                                        <TableCell className="font-mono text-[#ce9178] text-xs py-1.5">
                                            {formatDateTime(trade.sell.timestamp)}
                                        </TableCell>
                                        {/* 판매액 */}
                                        <TableCell className="font-mono text-[#d4d4d4] text-xs text-right py-1.5">
                                            {trade.sellRevenue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </TableCell>
                                        {/* 매도 BTC 시세 */}
                                        <TableCell className="font-mono text-[#dcdcaa] text-xs text-right py-1.5">
                                            {formatBtcPrice(trade.sell.price)}
                                        </TableCell>
                                        {/* 손익 */}
                                        <TableCell className={cn(
                                            "font-mono text-xs text-right py-1.5 font-semibold",
                                            trade.realProfit >= 0 ? "text-[#4ec9b0]" : "text-[#f14c4c]"
                                        )}>
                                            {trade.realProfit >= 0 ? '+' : ''}{Math.round(trade.realProfit)?.toLocaleString()}
                                        </TableCell>
                                        {/* 수익률 */}
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
                        <div className="px-4 py-2 border-t border-[#3c3c3c] flex items-center justify-between">
                            <div className="text-[11px] text-[#6a6a6a]">
                                {startIndex + 1} - {Math.min(endIndex, totalItems)} / {totalItems}건
                            </div>
                            <div className="flex items-center gap-1">
                                {/* 첫 페이지 */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30"
                                    onClick={() => goToPage(1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronsLeft className="h-4 w-4" />
                                </Button>
                                {/* 이전 페이지 */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30"
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>

                                {/* 페이지 번호 */}
                                <div className="flex items-center gap-1 mx-2">
                                    {(() => {
                                        const pages = []
                                        const maxVisible = 5
                                        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
                                        let end = Math.min(totalPages, start + maxVisible - 1)

                                        if (end - start + 1 < maxVisible) {
                                            start = Math.max(1, end - maxVisible + 1)
                                        }

                                        for (let i = start; i <= end; i++) {
                                            pages.push(
                                                <Button
                                                    key={i}
                                                    variant={i === currentPage ? "secondary" : "ghost"}
                                                    size="sm"
                                                    className={cn(
                                                        "h-7 w-7 text-xs",
                                                        i === currentPage
                                                            ? "bg-[#0e639c] text-white hover:bg-[#1177bb]"
                                                            : "text-[#cccccc] hover:bg-[#3c3c3c]"
                                                    )}
                                                    onClick={() => goToPage(i)}
                                                >
                                                    {i}
                                                </Button>
                                            )
                                        }
                                        return pages
                                    })()}
                                </div>

                                {/* 다음 페이지 */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30"
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                {/* 마지막 페이지 */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-30"
                                    onClick={() => goToPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronsRight className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="text-[11px] text-[#6a6a6a]">
                                {currentPage} / {totalPages} 페이지
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
