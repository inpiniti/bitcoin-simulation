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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useStore } from "@/store/useStore"
import { BarChart2, List, Database, TrendingUp, TrendingDown } from "lucide-react"

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

    const { summary, trades, aiData, options } = selectedResult

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg text-purple-600 flex items-center gap-2">
                        <BarChart2 className="w-5 h-5" />
                        시뮬레이션 결과
                        <Badge variant="outline">{selectedResult.key}</Badge>
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                {/* 요약 통계 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">수익률 :</span>
                        <p className={`text-xl font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {summary.totalProfit >= 0 ? '+' : ''}{Math.round(summary.totalProfit)?.toLocaleString()}원
                        </p>
                        <p className="text-xs text-muted-foreground">
                            ({summary.totalProfitRate?.toFixed(2)}%)
                        </p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">승률 :</span>
                        <p className="text-xl font-bold">{summary.winRate?.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">
                            {summary.wins}승 {summary.losses}패
                        </p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">
                            {summary.maxMultiplier ? '최대 배율 :' : '총 거래 :'}
                        </span>
                        <p className="text-xl font-bold">
                            {summary.maxMultiplier
                                ? `${summary.maxMultiplier?.toFixed(2)}x`
                                : `${summary.totalCycles}회`}
                        </p>
                    </div>

                    {summary.maxDrawdown !== undefined && (
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground">MDD :</span>
                            <p className="text-xl font-bold text-red-500">
                                -{summary.maxDrawdown?.toFixed(2)}%
                            </p>
                        </div>
                    )}
                    {summary.finalCapital !== undefined && (
                        <div className="space-y-1">
                            <span className="text-sm text-muted-foreground">최종 자산 :</span>
                            <p className="text-xl font-bold text-blue-500">
                                {Math.round(summary.finalCapital)?.toLocaleString()}원
                            </p>
                        </div>
                    )}
                </div>

                {/* 탭 시스템 */}
                <Tabs defaultValue="trades" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid grid-cols-2 w-[400px]">
                        <TabsTrigger value="trades" className="flex items-center gap-2">
                            <List className="w-4 h-4" /> 거래내역
                        </TabsTrigger>
                        <TabsTrigger value="data" className="flex items-center gap-2" disabled={!aiData}>
                            <Database className="w-4 h-4" /> 데이터 뷰 {!aiData && "(AI 전용)"}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="trades" className="flex-1 border rounded-md overflow-hidden mt-2">
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
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
                            {trades?.length > 100 && (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                    처음 100개 거래만 표시됩니다. (전체: {trades.length}개)
                                </p>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="data" className="flex-1 border rounded-md overflow-hidden mt-2">
                        {aiData ? (
                            <ScrollArea className="h-full">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead>날짜</TableHead>
                                            <TableHead className="text-right">예측 확률</TableHead>
                                            <TableHead className="text-right">추천</TableHead>
                                            <TableHead className="text-right">연속일</TableHead>
                                            <TableHead className="text-right">1일%</TableHead>
                                            <TableHead className="text-right">7일%</TableHead>
                                            <TableHead className="text-right">30일%</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {aiData.slice(0, 500).map((d, idx) => {
                                            const isBuy = d.probability >= (options?.aiBuyThreshold || 0.6)
                                            const isSell = d.probability < (options?.aiSellThreshold || 0.4)

                                            return (
                                                <TableRow key={idx} className={isBuy ? "bg-green-50" : isSell ? "bg-red-50" : ""}>
                                                    <TableCell className="text-xs">{new Date(d.date).toLocaleDateString()}</TableCell>
                                                    <TableCell className={`text-right font-bold ${d.probability > 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {(d.probability * 100).toFixed(1)}%
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {isBuy ? (
                                                            <Badge className="bg-green-600 text-white hover:bg-green-700">BUY</Badge>
                                                        ) : isSell ? (
                                                            <Badge className="bg-red-600 text-white hover:bg-red-700">SELL</Badge>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className={`text-right ${d.consecutiveDays > 0 ? 'text-green-600' : d.consecutiveDays < 0 ? 'text-red-600' : ''}`}>
                                                        {d.consecutiveDays || 0}
                                                    </TableCell>
                                                    <TableCell className={`text-right ${d.change1d > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {d.change1d?.toFixed(1)}%
                                                    </TableCell>
                                                    <TableCell className={`text-right ${d.change7d > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {d.change7d?.toFixed(1)}%
                                                    </TableCell>
                                                    <TableCell className={`text-right ${d.change30d > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {d.change30d?.toFixed(1)}%
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                                {aiData.length > 500 && (
                                    <p className="text-xs text-muted-foreground text-center py-2">
                                        최근 500건만 표시됩니다. (전체: {aiData.length}개)
                                    </p>
                                )}
                            </ScrollArea>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                <Database className="w-12 h-12 mb-2 opacity-20" />
                                <p>AI 시뮬레이션 데이터가 없습니다.</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}

    )
}
