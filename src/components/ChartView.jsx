import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { useShallow } from "zustand/react/shallow"
import { fetchForecast } from "@/lib/api"
import { LineChart as LineChartIcon, Loader2, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    ResponsiveContainer,
    ComposedChart,
    LineChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    Brush,
    Area,
    Cell,
    Customized,
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
 * 캔들스틱 레이어 (Customized Component)
 * Recharts의 props 전달 문제(yAxis 누락 등)를 해결하기 위해
 * 차트 크기(width, height)와 데이터(chartData)를 기반으로 직접 SVG를 그립니다.
 */
const CandleStickLayer = (props) => {
    const { width, height, data, yDomain } = props;

    // 차트 크기나 데이터가 유효하지 않으면 렌더링하지 않음 (초기 렌더링 방어)
    if (!width || width <= 0 || !height || height <= 0 || !data || !yDomain) return null;

    // 차트 여백 (ComposedChart의 margin과 일치시켜야 함)
    // margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
    // 하지만 Customized 컴포넌트 반환값은 이미 내부 offset이 적용된 SVG 그룹일 수 있음
    // 확인 결과 Customized는 차트 영역(Graphical Area) 기준으로 좌표를 줌.

    // yDomain이 없거나 데이터가 없으면 렌더링 불가
    if (!yDomain || data.length === 0) return null;

    const min = yDomain[0];
    const max = yDomain[1];

    const domainRange = max - min;

    if (domainRange <= 0) return null;

    // Y축 스케일 함수 (값 -> 픽셀)
    const scaleY = (value) => {
        if (value === null || value === undefined) return null;
        // SVG 좌표계: 상단이 0, 하단이 height
        // 값 위치 비율: (value - min) / (max - min)
        // 픽셀 위치: height - (비율 * height)
        return height - ((value - min) / domainRange) * height;
    };

    // X축: 데이터 개수만큼 균등 분할
    // ComposedChart의 XAxis가 'category' 타입이므로 밴드 스케일임.
    // 각 밴드의 너비 = width / data.length
    const bandWidth = width / data.length;
    // 캔들 너비는 밴드 너비의 70% 정도 사용
    const candleWidth = Math.max(1, bandWidth * 0.7);
    const offset = (bandWidth - candleWidth) / 2;

    return (
        <g>
            {data.map((d, i) => {
                // 필수 데이터 확인
                if (d.open == null || d.close == null || d.high == null || d.low == null) return null;
                if (d.dataKey === 'prediction') return null; // AI 예측 데이터는 건너뜀

                const x = (i * bandWidth) + offset;

                const yOpen = scaleY(d.open);
                const yClose = scaleY(d.close);
                const yHigh = scaleY(d.high);
                const yLow = scaleY(d.low);

                const isUp = d.close >= d.open;
                const color = isUp ? "#4ec9b0" : "#f48771"; // 상승(초록), 하락(빨강)

                const bodyTop = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(1, Math.abs(yOpen - yClose));

                return (
                    <g key={i}>
                        {/* 꼬리 (High - Low) */}
                        <line
                            x1={x + candleWidth / 2}
                            y1={yHigh}
                            x2={x + candleWidth / 2}
                            y2={yLow}
                            stroke={color}
                            strokeWidth={1}
                        />
                        {/* 몸통 (Open - Close) */}
                        <rect
                            x={x}
                            y={bodyTop}
                            width={candleWidth}
                            height={bodyHeight}
                            fill={color}
                            stroke="none"
                        />
                    </g>
                );
            })}
        </g>
    );
};


/**
 * 커스텀 툴팁
 */
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null

    const data = payload[0]?.payload
    // payload 순서: [Candle, MA20, MA50, BB_Upper, BB_Lower, ...]

    return (
        <div className="bg-[#252526] border border-[#3c3c3c] p-3 rounded-lg shadow-lg text-xs z-50">
            <p className="text-[#cccccc] mb-2 font-bold">{data?.fullDate}</p>

            {/* 캔들 데이터 */}
            {data.open !== undefined && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                    <span className="text-[#888888]">Open:</span>
                    <span className="text-right text-[#4fc1ff]">{data.open?.toLocaleString()}</span>
                    <span className="text-[#888888]">High:</span>
                    <span className="text-right text-[#4fc1ff]">{data.high?.toLocaleString()}</span>
                    <span className="text-[#888888]">Low:</span>
                    <span className="text-right text-[#4fc1ff]">{data.low?.toLocaleString()}</span>
                    <span className="text-[#888888]">Close:</span>
                    <span className={cn(
                        "text-right font-bold",
                        data.close > data.open ? "text-[#4ec9b0]" : "text-[#f48771]"
                    )}>{data.close?.toLocaleString()}</span>
                </div>
            )}

            {/* 보조지표 데이터 */}
            <div className="space-y-1 pt-2 border-t border-[#3c3c3c]">
                {payload.map((entry, idx) => {
                    if (entry.dataKey === 'open' || entry.dataKey === 'high' || entry.dataKey === 'low' || entry.dataKey === 'close') return null
                    // 예측 데이터
                    if (entry.dataKey === 'predictionPrice') {
                        return (
                            <div key={idx} className="flex justify-between gap-4">
                                <span style={{ color: entry.color }}>AI Forecast:</span>
                                <span className="text-[#cccccc]">{entry.value?.toLocaleString()}</span>
                            </div>
                        )
                    }
                    // MA & BB
                    if (['ma20', 'ma50', 'bbUpper', 'bbLower'].includes(entry.dataKey)) {
                        return (
                            <div key={idx} className="flex justify-between gap-4">
                                <span style={{ color: entry.color }}>
                                    {entry.name}:
                                </span>
                                <span className="text-[#cccccc]">{entry.value?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                        )
                    }
                    return null
                })}
            </div>
            {/* RSI 별도 표시 */}
            {data.rsi !== undefined && (
                <div className="flex justify-between gap-4 pt-1">
                    <span className="text-[#dcdcaa]">RSI(14):</span>
                    <span className={cn(
                        data.rsi > 70 ? "text-[#f48771]" : data.rsi < 30 ? "text-[#4ec9b0]" : "text-[#cccccc]"
                    )}>{data.rsi.toFixed(2)}</span>
                </div>
            )}
        </div>
    )
}

/**
 * 고성능 캔들스틱 차트 컴포넌트
 */
export function ChartView() {
    const { hist, ticker, mode, interval } = useStore(useShallow(state => ({
        hist: state.hist,
        ticker: state.ticker,
        mode: state.mode,
        interval: state.interval,
    })))
    const [isLoadingForecast, setIsLoadingForecast] = useState(false)
    const [forecastData, setForecastData] = useState(null)

    // 차트 옵션 기본 활성화
    const [showForecast, setShowForecast] = useState(true)
    const [showMA, setShowMA] = useState(true)
    const [showBB, setShowBB] = useState(true)
    const [showRSI, setShowRSI] = useState(true)

    // 데이터 준비
    const chartData = useMemo(() => {
        const data = hist[interval] || []
        if (!data || data.length === 0) return []

        // 초기 로딩 성능을 위해 최근 200개만 사용하거나, 전체 사용 후 Brush로 조절
        // Brush가 있으므로 전체 데이터를 넣되, 성능 이슈 시 슬라이싱 고려
        // 여기선 365개 정도는 문제 없으므로 전체 사용
        const formatted = data.map(item => ({
            ...item,
            date: interval === '1d'
                ? formatShortDate(item.timestamp)
                : new Date(item.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            fullDate: new Date(item.timestamp).toLocaleString('ko-KR'),
            // 캔들 필수 데이터
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            // 보조지표
            ma20: item.ma20,
            ma50: item.ma50,
            bbUpper: item.bbUpper,
            bbLower: item.bbLower,
            rsi: item.rsi,
        }))

        // AI 예측 데이터 병합
        if (showForecast && forecastData?.predictions) {
            forecastData.predictions.forEach(pred => {
                formatted.push({
                    date: formatShortDate(pred.date),
                    fullDate: new Date(pred.date).toLocaleDateString('ko-KR'),
                    predictionPrice: pred.priceFormatted
                        ? parseFloat(pred.priceFormatted.replace(/[$,]/g, ''))
                        : pred.price,
                    isPrediction: true
                })
            })
        }
        return formatted
    }, [hist, forecastData, showForecast, interval])



    // 예측 데이터 로드 (이전과 동일 로직)
    useEffect(() => {
        const load = async () => {
            if (interval !== '1d') {
                setForecastData(null);
                return;
            }
            const symbol = mode === 'coin' ? 'BTC-KRW' : ticker
            setIsLoadingForecast(true)
            try {
                const result = await fetchForecast(symbol, 'day')
                if (result && result.predictions) setForecastData(result)
            } catch (e) {
                console.error(e)
            } finally {
                setIsLoadingForecast(false)
            }
        }
        setForecastData(null)
        load()
    }, [ticker, mode, interval])

    // Y축 도메인 계산
    const yDomain = useMemo(() => {
        const prices = chartData
            .flatMap(d => [d.low, d.high, d.predictionPrice]) // High/Low 모두 고려
            .filter(v => v !== undefined && v !== null)

        if (prices.length === 0) return ['auto', 'auto']

        const min = Math.min(...prices)
        const max = Math.max(...prices)
        const padding = (max - min) * 0.1

        return [Math.floor(min - padding), Math.ceil(max + padding)]
    }, [chartData])

    if (!chartData.length) {
        return (
            <div className="flex-1 flex items-center justify-center text-[#5a5a5a] bg-[#1e1e1e]">
                <div className="text-center">
                    <LineChartIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">데이터 로딩 중 또는 데이터가 없습니다.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden relative">


            {/* 메인 차트 (가격 + MA + BB) */}
            <div className={cn("px-2 pt-2", showRSI ? "h-[70%]" : "h-full")}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                        syncId="mainId"
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#888888' }}
                            axisLine={false}
                            tickLine={false}
                            hide={showRSI} // RSI가 있으면 하단 X축은 RSI 차트가 담당
                        />
                        <YAxis
                            domain={yDomain}
                            tick={{ fontSize: 10, fill: '#888888' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => `$${value.toLocaleString()}`}
                            width={50}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />

                        {/* 캔들스틱 (Customized Layer) - 직접 그리기 */}
                        <Customized
                            component={(customProps) => (
                                <CandleStickLayer
                                    {...customProps}
                                    yDomain={yDomain}
                                    data={chartData}
                                />
                            )}
                        />

                        {/* 메인 종가 라인 (굵게 강조) */}
                        <Line
                            type="monotone"
                            dataKey="close"
                            stroke="#ffffff"
                            strokeWidth={2}
                            dot={false}
                            name="현재가(Close)"
                            isAnimationActive={false}
                            zIndex={10}
                        />

                        {/* 툴팁 트래킹용 투명 Bar */}
                        <Bar
                            dataKey="close"
                            fill="transparent"
                            isAnimationActive={false}
                        />

                        {/* 이동평균선 (MA) */}
                        {showMA && (
                            <>
                                <Line type="monotone" dataKey="ma20" stroke="#f2a900" dot={false} strokeWidth={1} name="MA20" />
                                <Line type="monotone" dataKey="ma50" stroke="#c586c0" dot={false} strokeWidth={1} name="MA50" />
                            </>
                        )}

                        {/* 볼린저 밴드 (BB) */}
                        {showBB && (
                            <>
                                <Line type="monotone" dataKey="bbUpper" stroke="#4fc1ff" strokeOpacity={0.5} dot={false} strokeWidth={1} name="BB Upper" />
                                <Line type="monotone" dataKey="bbLower" stroke="#4fc1ff" strokeOpacity={0.5} dot={false} strokeWidth={1} name="BB Lower" />
                            </>
                        )}



                        {!showRSI && <Brush dataKey="date" height={30} stroke="#424242" fill="#1e1e1e" />}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* RSI 차트 (보조) */}
            {showRSI && (
                <div className="h-[30%] px-2 pb-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                            syncId="mainId"
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: '#888888' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[0, 100]}
                                ticks={[30, 70]}
                                tick={{ fontSize: 10, fill: '#888888' }}
                                axisLine={false}
                                tickLine={false}
                                width={50}
                            />
                            <Tooltip content={<CustomTooltip />} />

                            <ReferenceLine y={70} stroke="#f48771" strokeDasharray="3 3" />
                            <ReferenceLine y={30} stroke="#4ec9b0" strokeDasharray="3 3" />

                            <Line
                                type="monotone"
                                dataKey="rsi"
                                stroke="#9cdcfe"
                                dot={false}
                                strokeWidth={1}
                                name="RSI(14)"
                                isAnimationActive={false}
                            />
                            <Brush dataKey="date" height={30} stroke="#424242" fill="#1e1e1e" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}
