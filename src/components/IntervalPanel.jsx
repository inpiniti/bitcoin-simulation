import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"

const INTERVALS = [
    { key: '1m', label: '1분 간격' },
    { key: '5m', label: '5분 간격' },
    { key: '15m', label: '15분 간격' },
    { key: '1h', label: '1시간 간격' },
    { key: '2h', label: '2시간 간격' },
    { key: '1d', label: '1일 간격' },
    { key: '2d', label: '2일 간격' },
    { key: '1w', label: '일주일 간격' },
]

export function IntervalPanel() {
    const {
        hist,
        loadingInterval,
        fetchProgress,
        activeInterval,
        loadHist1m,
        loadHistInterval,
        setActiveInterval
    } = useStore()

    const handleClick = async (interval) => {
        const hasData = hist[interval].length > 0

        if (hasData) {
            // 이미 데이터가 있으면 활성화
            setActiveInterval(interval)
        } else {
            // 데이터가 없으면 로드
            if (interval === '1m') {
                await loadHist1m()
            } else {
                // 1분 데이터가 먼저 필요
                if (hist['1m'].length === 0) {
                    await loadHist1m()
                }
                await loadHistInterval(interval)
            }
            setActiveInterval(interval)
        }
    }

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg text-blue-600">과거 데이터</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                {INTERVALS.map(({ key, label }) => {
                    const hasData = hist[key].length > 0
                    const isLoading = loadingInterval[key]
                    const isActive = activeInterval === key

                    return (
                        <Button
                            key={key}
                            variant={hasData ? (isActive ? "default" : "secondary") : "outline"}
                            className={cn(
                                "w-full justify-center",
                                hasData && !isActive && "bg-white hover:bg-gray-50 border",
                                !hasData && "bg-gray-100 text-gray-500"
                            )}
                            disabled={isLoading}
                            onClick={() => handleClick(key)}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {key === '1m' && fetchProgress.total > 0
                                        ? `${Math.round((fetchProgress.current / fetchProgress.total) * 100)}%`
                                        : '로딩 중...'}
                                </>
                            ) : (
                                label
                            )}
                        </Button>
                    )
                })}
            </CardContent>
        </Card>
    )
}
