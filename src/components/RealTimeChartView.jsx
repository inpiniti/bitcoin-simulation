import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { fetchStockMinuteData, fetchForecast } from "@/lib/api"
import { addDerivedData } from "@/lib/dataProcessor"
import { Activity, Loader2, TrendingUp, RefreshCw, Pause, Play as PlayIcon } from "lucide-react"
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

// 시간 포맷팅 (HH:mm)
function formatTime(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return ''
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// 전체 날짜/시간 포맷팅
function formatFullDateTime(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleString('ko-KR')
}

// 커스텀 Tooltip
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null

    const data = payload[0]?.payload
    const isPrediction = data?.type === 'prediction'

    return (
        <div className="bg-[#252526] border border-[#3c3c3c] p-3 rounded-lg shadow-lg">
            <p className="text-[11px] text-[#888888] mb-1">{data?.fullDateTime || label}</p>
            <p className={cn(
                "text-lg font-mono font-bold",
                isPrediction ? "text-[#9cdcfe]" : "text-[#f7931a]"
            )}>
                ${data?.price?.toFixed(2) || data?.predictionPrice?.toFixed(2)}
            </p>
            {isPrediction && (
                <p className="text-[10px] text-[#ce9178] mt-1">AI 예측 (TimesFM)</p>
            )}
        </div>
    )
}

export function RealTimeChartView() {
    const { ticker, mode } = useStore()
    const [minuteData, setMinuteData] = useState([])
    const [forecastData, setForecastData] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [lastUpdate, setLastUpdate] = useState(null)
    const [nextUpdate, setNextUpdate] = useState(60)
    const [error, setError] = useState(null)
    const intervalRef = useRef(null)
    const countdownRef = useRef(null)

    // 통합 데이터 조회 (1분봉 + AI 예측)
    const loadAllData = useCallback(async () => {
        if (mode !== 'stock' || !ticker) return

        // 첫 로드 시에만 로딩 표시 (갱신 시 깜빡임 방지)
        if (minuteData.length === 0) setIsLoading(true)

        try {
            // 병렬 호출로 데이터 동시 조회
            const [rawData, forecastResult] = await Promise.all([
                fetchStockMinuteData(ticker),
                fetchForecast(ticker, 'minute')
            ])

            // 1분봉 데이터 처리
            if (rawData && rawData.length > 0) {
                const dataWithIndicators = addDerivedData(rawData)
                setMinuteData(dataWithIndicators)
                setLastUpdate(new Date())
                setError(null)
            } else {
                setError('데이터를 조회할 수 없습니다.')
            }

            // AI 예측 데이터 처리
            if (forecastResult && forecastResult.predictions) {
                setForecastData(forecastResult)
            }

        } catch (err) {
            console.error('Failed to load data:', err)
            // 기존 데이터가 있으면 에러 메시지만 살짝 표시하거나 로그만 남김
            if (minuteData.length === 0) {
                setError(err.message)
            }
        } finally {
            setIsLoading(false)
        }
    }, [ticker, mode]) // minuteData 제외하여 불필요한 의존성 제거

    // 초기 로드 및 티커 변경 시
    useEffect(() => {
        if (mode === 'stock' && ticker) {
            setMinuteData([])
            setForecastData(null)
            loadAllData()
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
        }
    }, [ticker, mode, loadAllData])

    // 자동 새로고침 (1분마다)
    useEffect(() => {
        if (isPaused || mode !== 'stock' || !ticker) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
            return
        }

        // 카운트다운 타이머
        setNextUpdate(60)
        countdownRef.current = setInterval(() => {
            setNextUpdate(prev => (prev > 0 ? prev - 1 : 60))
        }, 1000)

        // 1분마다 통합 데이터(차트+예측) 새로고침
        intervalRef.current = setInterval(() => {
            loadAllData()
            setNextUpdate(60)
        }, 60000)

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
        }
    }, [isPaused, ticker, mode, loadAllData])

    // 차트 데이터 생성
    const chartData = useMemo(() => {
        const data = minuteData.map(item => ({
            time: formatTime(item.timestamp),
            fullDateTime: formatFullDateTime(item.timestamp),
            price: item.close,
            type: 'historical'
        }))

        // AI 예측 데이터 추가
        if (forecastData?.predictions) {
            forecastData.predictions.forEach((pred) => {
                data.push({
                    time: formatTime(pred.date),
                    fullDateTime: formatFullDateTime(pred.date),
                    price: null,
                    // price(정수) 대신 priceFormatted(문자열, "$461.21")를 파싱하여 소수점 반영
                    predictionPrice: pred.priceFormatted
                        ? parseFloat(pred.priceFormatted.replace(/[$,]/g, ''))
                        : pred.price,
                    type: 'prediction'
                })
            })
        }

        return data
    }, [minuteData, forecastData])

    // Y축 도메인 계산
    const yDomain = useMemo(() => {
        const prices = chartData
            .map(d => d.price || d.predictionPrice)
            .filter(Boolean)
        if (prices.length === 0) return ['auto', 'auto']

        const min = Math.min(...prices)
        const max = Math.max(...prices)
        const padding = (max - min) * 0.05

        return [Math.floor(min - padding), Math.ceil(max + padding)]
    }, [chartData])

    // 현재가와 변동률 계산
    const priceInfo = useMemo(() => {
        if (minuteData.length < 2) return { current: 0, change: 0, changePercent: 0 }
        const current = minuteData[minuteData.length - 1]?.close || 0
        const first = minuteData[0]?.close || current
        const change = current - first
        const changePercent = first ? (change / first) * 100 : 0
        return { current, change, changePercent }
    }, [minuteData])

    // Coin 모드일 때
    if (mode === 'coin') {
        return (
            <div className="flex-1 flex items-center justify-center text-[#5a5a5a] bg-[#1e1e1e]">
                <div className="text-center">
                    <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">실시간 차트는 Stock 모드에서만 지원합니다.</p>
                    <p className="text-xs mt-2 text-[#4a4a4a]">
                        상단에서 Stock 모드를 선택해주세요.
                    </p>
                </div>
            </div>
        )
    }

    // 데이터 없음
    if (!isLoading && minuteData.length === 0 && !error) {
        return (
            <div className="flex-1 flex items-center justify-center text-[#5a5a5a] bg-[#1e1e1e]">
                <div className="text-center">
                    <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">실시간 차트를 표시할 데이터가 없습니다.</p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadAllData}
                        className="mt-4"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        데이터 로드
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
            {/* 컨트롤 바 */}
            <div className="h-12 px-4 flex items-center justify-between border-b border-[#3c3c3c] bg-[#252526]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[13px] text-[#cccccc]">
                        <Activity className="w-4 h-4 text-[#f7931a]" />
                        <span>REALTIME: {ticker} (1분봉+예측)</span>
                    </div>
                    {/* 현재가 정보 */}
                    {priceInfo.current > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-mono font-bold text-[#dcdcaa]">
                                ${priceInfo.current.toFixed(2)}
                            </span>
                            <span className={cn(
                                "text-sm font-mono",
                                priceInfo.change >= 0 ? "text-[#4ec9b0]" : "text-[#f14c4c]"
                            )}>
                                {priceInfo.change >= 0 ? '+' : ''}{priceInfo.change.toFixed(2)}
                                ({priceInfo.change >= 0 ? '+' : ''}{priceInfo.changePercent.toFixed(2)}%)
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* 카운트다운 */}
                    {!isPaused && (
                        <span className="text-[11px] text-[#6a6a6a] font-mono">
                            다음 업데이트: {nextUpdate}s
                        </span>
                    )}
                    {/* 일시정지/재개 */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsPaused(!isPaused)}
                        className={cn(
                            "h-7 text-xs gap-1",
                            isPaused ? "text-[#f14c4c]" : "text-[#4ec9b0]"
                        )}
                    >
                        {isPaused ? (
                            <>
                                <PlayIcon className="w-3 h-3" />
                                재개
                            </>
                        ) : (
                            <>
                                <Pause className="w-3 h-3" />
                                일시정지
                            </>
                        )}
                    </Button>
                    {/* 수동 새로고침 (통합) */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadAllData}
                        disabled={isLoading}
                        className="h-7 text-xs gap-1 text-[#cccccc]"
                    >
                        {isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <RefreshCw className="w-3 h-3" />
                        )}
                        데이터 새로고침
                    </Button>
                </div>
            </div>

            {/* 에러 표시 */}
            {error && (
                <div className="px-4 py-2 bg-[#f14c4c20] border-b border-[#f14c4c50] text-[#f14c4c] text-sm">
                    {error}
                </div>
            )}

            {/* 차트 영역 */}
            <div className="flex-1 p-4">
                {isLoading && minuteData.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center h-full">
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-[#f7931a]" />
                            <p className="text-sm text-[#6a6a6a]">데이터 로딩 중...</p>
                        </div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#3c3c3c" />
                            <XAxis
                                dataKey="time"
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
                                tickFormatter={(val) => `$${val}`}
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
                                name="실시간 가격"
                                stroke="#f7931a"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, fill: '#f7931a' }}
                                connectNulls={false}
                            />

                            {/* AI 예측 가격 (점선) */}
                            {forecastData && (
                                <Line
                                    type="monotone"
                                    dataKey="predictionPrice"
                                    name="AI 예측"
                                    stroke="#9cdcfe"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#9cdcfe' }}
                                    connectNulls={true}
                                />
                            )}

                            {/* 예측 시작점 표시선 */}
                            {forecastData && minuteData.length > 0 && (
                                <ReferenceLine
                                    x={formatTime(minuteData[minuteData.length - 1].timestamp)}
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
                )}
            </div>

            {/* 하단 정보 바 */}
            <div className="px-4 py-2 border-t border-[#3c3c3c] flex items-center justify-between text-xs text-[#888888]">
                <span>
                    데이터: <span className="text-[#9cdcfe]">{minuteData.length}개</span>
                    {forecastData && (
                        <>
                            {' | '}
                            AI 예측: <span className="text-[#ce9178]">{forecastData.predictionCount}개</span>
                        </>
                    )}
                </span>
                {lastUpdate && (
                    <span>
                        마지막 업데이트: {lastUpdate.toLocaleTimeString('ko-KR')}
                    </span>
                )}
            </div>
        </div>
    )
}
