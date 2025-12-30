import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useStore } from "@/store/useStore"

export function ResultPanel() {
    const { selectedResult } = useStore()

    if (!selectedResult) {
        return (
            <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground">
                    <p>간격을 선택하고 시뮬레이션을 실행하세요.</p>
                    <p className="text-sm mt-2">
                        1. 왼쪽에서 간격 버튼을 클릭하여 데이터를 로드합니다.
                    </p>
                    <p className="text-sm">
                        2. 가운데에서 전략 버튼을 클릭하여 시뮬레이션을 실행합니다.
                    </p>
                </CardContent>
            </Card>
        )
    }

    const { summary, trades } = selectedResult

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg text-purple-600 flex items-center gap-2">
                    시뮬레이션 결과
                    <Badge variant="outline">{selectedResult.key}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                {/* 요약 통계 */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">수익률 :</span>
                        <p className={`text-xl font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {summary.totalProfit >= 0 ? '+' : ''}{summary.totalProfit?.toLocaleString()}원
                        </p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">승률 :</span>
                        <p className="text-xl font-bold">{summary.winRate?.toFixed(1)}%</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">
                            {summary.maxMultiplier ? '최대 배율 :' : '총 거래 :'}
                        </span>
                        <p className="text-xl font-bold">
                            {summary.maxMultiplier
                                ? `${summary.maxMultiplier?.toFixed(2)}x`
                                : `${summary.wins}승 ${summary.losses}패`}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">사이클 수 :</span>
                        <p className="text-xl font-bold">{summary.totalCycles}회</p>
                    </div>
                </div>

                {/* 거래 내역 테이블 */}
                <div className="flex-1 border rounded-md overflow-hidden">
                    <ScrollArea className="h-[300px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">사이클</TableHead>
                                    <TableHead>시간</TableHead>
                                    <TableHead className="text-right">구매액</TableHead>
                                    <TableHead className="text-right">판매액</TableHead>
                                    <TableHead className="text-right">수량</TableHead>
                                    <TableHead className="text-right">이익액</TableHead>
                                    <TableHead className="text-right">이익률</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {trades?.slice(0, 100).map((trade, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium">{trade.cycle}</TableCell>
                                        <TableCell className="text-xs">
                                            {trade.buy.timestamp?.slice(0, 16)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {trade.quantity?.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {Math.round(trade.sellValue)?.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {trade.btcAmount?.toFixed(6)}
                                        </TableCell>
                                        <TableCell className={`text-right ${trade.realProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {trade.realProfit >= 0 ? '+' : ''}{Math.round(trade.realProfit)?.toLocaleString()}
                                        </TableCell>
                                        <TableCell className={`text-right ${trade.realProfitRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {trade.realProfitRate >= 0 ? '+' : ''}{trade.realProfitRate?.toFixed(2)}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>

                {trades?.length > 100 && (
                    <p className="text-xs text-muted-foreground text-center">
                        처음 100개 거래만 표시됩니다. (전체: {trades.length}개)
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
