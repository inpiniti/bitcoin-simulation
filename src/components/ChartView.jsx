import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { fetchForecast } from "@/lib/api"
import { LineChart as LineChartIcon, Loader2, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    Legend
} from "recharts"

/**
 * 날짜 포맷팅 (MM/DD)
 */
function formatShortDate(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return ''
    return `${date.getMonth() + 1}/${date.getDate()}`
}

/**
 * 커스텀 Tooltip
 */
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null

    const data = payload[0]?.payload
    const isPrediction = data?.type === 'prediction'

    return (
        <div className="bg-[#252526] border border-[#3c3c3c] p-3 rounded-lg shadow-lg">
            <p className="text-[11px] text-[#888888] mb-1">{data?.fullDate || label}</p>
            <p className={cn(
                "text-lg font-mono font-bold",
                isPrediction ? "text-[#9cdcfe]" : "text-[#4fc1ff]"
            )}>
                {data?.price?.toLocaleString() || data?.predictionPrice?.toLocaleString()}
            </p>
            {isPrediction && (
                <p className="text-[10px] text-[#ce9178] mt-1">AI 예측 (TimesFM)</p>
            )}
        </div>
    )
}

export function ChartView() {
    const { hist, ticker, mode } = useStore()
    const [isLoadingForecast, setIsLoadingForecast] = useState(false)
    const [forecastData, setForecastData] = useState(null)
    const [showForecast, setShowForecast] = useState(true)

    // 현재 일봉 히스토리 데이터
    const histData = useMemo(() => {
        const data = hist['1d'] || []
        if (!data || data.length === 0) return []

        // 최근 180일 데이터만 차트에 표시 (성능 및 가독성)
        const recentData = data.slice(-180)

        return recentData.map(item => ({
            date: formatShortDate(item.timestamp),
            fullDate: new Date(item.timestamp).toLocaleDateString('ko-KR'),
            price: item.close,
            type: 'historical'
        }))
    }, [hist])

    // 예측 데이터 로드
    const loadForecast = async () => {
        const symbol = mode === 'coin' ? 'BTC-KRW' : ticker

        setIsLoadingForecast(true)
        try {
            const result = await fetchForecast(symbol, 'day')
            if (result && result.predictions) {
                setForecastData(result)
            }
        } catch (err) {
            console.error('Failed to load forecast:', err)
        } finally {
            setIsLoadingForecast(false)
        }
    }

    // ticker 변경 시 예측 데이터 초기화
    useEffect(() => {
        setForecastData(null)
    }, [ticker, mode])

    // 차트 데이터 (히스토리 + 예측)
    const chartData = useMemo(() => {
        const combined = [...histData]

        if (showForecast && forecastData?.predictions) {
            forecastData.predictions.forEach((pred) => {
                combined.push({
                    date: formatShortDate(pred.date),
                    fullDate: new Date(pred.date).toLocaleDateString('ko-KR'),
                    price: null,
                    predictionPrice: pred.price,
                    type: 'prediction'
                })
            })
        }

        return combined
    }, [histData, forecastData, showForecast])

    // Y축 도메인 계산
    const yDomain = useMemo(() => {
        const prices = chartData
            .map(d => d.price || d.predictionPrice)
            .filter(Boolean)
        if (prices.length === 0) return ['auto', 'auto']

        const min = Math.min(...prices)
        const max = Math.max(...prices)
        const padding = (max - min) * 0.1

        return [Math.floor(min - padding), Math.ceil(max + padding)]
    }, [chartData])

    if (histData.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-[#5a5a5a] bg-[#1e1e1e]">
                <div className="text-center">
                    <LineChartIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">차트를 표시할 데이터가 없습니다.</p>
                    <p className="text-xs mt-2 text-[#4a4a4a]">
                        상단에서 Coin/Stock 모드를 선택하면 자동으로 데이터가 로드됩니다.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
            {/* 컨트롤 바 */}
            <div className="h-10 px-4 flex items-center justify-between border-b border-[#3c3c3c] bg-[#252526]">
                <div className="flex items-center gap-2 text-[13px] text-[#cccccc]">
                    <LineChartIcon className="w-4 h-4 text-[#4fc1ff]" />
                    <span>CHART VIEW: {mode === 'coin' ? 'BTC' : ticker} (1d, {histData.length} days)</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadForecast}
                        disabled={isLoadingForecast}
                        className={cn(
                            "h-7 text-xs gap-1",
                            forecastData ? "text-[#4ec9b0]" : "text-[#cccccc]"
                        )}
                    >
                        {isLoadingForecast ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <TrendingUp className="w-3 h-3" />
                        )}
                        AI 예측 로드
                    </Button>
                    {forecastData && (
                        <Button
                            variant={showForecast ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setShowForecast(!showForecast)}
                            className="h-7 text-xs"
                        >
                            {showForecast ? "예측 숨기기" : "예측 보기"}
                        </Button>
                    )}
                </div>
            </div>

            {/* 차트 영역 */}
            <div className="flex-1 p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3c3c3c" />
                        <XAxis
                            dataKey="date"
                            stroke="#6a6a6a"
                            tick={{ fill: '#888888', fontSize: 10 }}
                            tickLine={{ stroke: '#3c3c3c' }}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            domain={yDomain}
                            stroke="#6a6a6a"
                            tick={{ fill: '#888888', fontSize: 10 }}
                            tickLine={{ stroke: '#3c3c3c' }}
                            tickFormatter={(val) => mode === 'coin' ? `${(val / 1000000).toFixed(0)}M` : `$${val}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="top"
                            height={36}
                            formatter={(value) => (
                                <span className="text-xs text-[#888888]">{value}</span>
                            )}
                        />

                        {/* 실제 가격 (실선) */}
                        <Line
                            type="monotone"
                            dataKey="price"
                            name="실제 가격"
                            stroke="#4fc1ff"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: '#4fc1ff' }}
                            connectNulls={false}
                        />

                        {/* AI 예측 가격 (점선) */}
                        {showForecast && forecastData && (
                            <Line
                                type="monotone"
                                dataKey="predictionPrice"
                                name="AI 예측 (30일)"
                                stroke="#9cdcfe"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                                activeDot={{ r: 4, fill: '#9cdcfe' }}
                                connectNulls={true}
                            />
                        )}

                        {/* 예측 시작점 표시선 */}
                        {showForecast && forecastData && histData.length > 0 && (
                            <ReferenceLine
                                x={histData[histData.length - 1].date}
                                stroke="#ce9178"
                                strokeDasharray="3 3"
                                label={{
                                    value: "예측 시작",
                                    position: "top",
                                    fill: "#ce9178",
                                    fontSize: 10
                                }}
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* 예측 정보 (로드된 경우) */}
            {forecastData && (
                <div className="px-4 py-2 border-t border-[#3c3c3c] flex items-center justify-between text-xs text-[#888888]">
                    <span>
                        AI 모델: <span className="text-[#9cdcfe]">{forecastData.model}</span>
                        {' | '}
                        예측 기간: <span className="text-[#ce9178]">{forecastData.predictionCount}일</span>
                    </span>
                    <span>
                        생성일: {new Date(forecastData.generatedAt).toLocaleString('ko-KR')}
                    </span>
                </div>
            )}
        </div>
    )
}
