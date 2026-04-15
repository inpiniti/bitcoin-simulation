import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Activity, BarChart2, Loader2, TrendingUp, TrendingDown,
    Target, Zap, AlertCircle
} from "lucide-react"

export function DLPredictionTab({
    // model selection
    serverModels,
    selectedModelId,
    setSelectedModelId,
    // prediction target
    predTargetType,
    setPredTargetType,
    predTicker,
    setPredTicker,
    tickerGroup,
    setTickerGroup,
    groupStocks,
    predAllTime,
    setPredAllTime,
    // prediction state
    predicting,
    predResult,
    allPredResults,
    // threshold sliders
    buyThreshold,
    setBuyThreshold,
    sellThreshold,
    setSellThreshold,
    optimalRange,
    currentRangeStats,
    // actions
    onPredict,
}) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-[#252526] border-[#3c3c3c] text-[#e1e1e1]">
                    <CardHeader>
                        <CardTitle>예측 설정</CardTitle>
                        <CardDescription className="text-[#888888]">학습된 모델을 사용하여 미래 주가를 예측합니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs text-[#888888]">사용할 모델 선택</label>
                            <select
                                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 text-sm"
                                value={selectedModelId}
                                onChange={e => setSelectedModelId(e.target.value)}
                            >
                                <option value="">모델을 선택하세요</option>
                                {serverModels.map(m => (
                                    <option key={m.id} value={m.id}>
                                        [{new Date(m.created_at).toLocaleDateString()}] {m.name} (정확도: {(m.accuracy * 100).toFixed(1)}%)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <Tabs value={predTargetType} onValueChange={setPredTargetType} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-[#1e1e1e] border border-[#3c3c3c] mb-4">
                                <TabsTrigger value="single">단일 종목</TabsTrigger>
                                <TabsTrigger value="group">티커 그룹</TabsTrigger>
                            </TabsList>

                            {predTargetType === 'single' ? (
                                <div className="space-y-2">
                                    <label className="text-xs text-[#888888]">예측할 티커</label>
                                    <Input
                                        value={predTicker}
                                        onChange={e => setPredTicker(e.target.value)}
                                        className="bg-[#1e1e1e] border-[#3c3c3c]"
                                        placeholder="BTC-USD"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-xs text-[#888888]">대상 그룹 선택</label>
                                    <select
                                        className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 text-sm"
                                        value={tickerGroup}
                                        onChange={e => setTickerGroup(e.target.value)}
                                    >
                                        <option value="superinvestor">Super Investors (DataRoma)</option>
                                        <option value="sp500">S&P 500</option>
                                        <option value="qqq">Nasdaq 100 (QQQ)</option>
                                        <option value="usall">🇺🇸 나스닥+뉴욕 전체</option>
                                        <option value="kospi200">KOSPI 200</option>
                                        <option value="kosdaq150">KOSDAQ 150</option>
                                        <option value="myholdings">내 보유 종목</option>
                                    </select>
                                    <div className="text-xs text-[#888888] flex justify-between">
                                        <span>로드된 종목 수:</span>
                                        <span className="text-[#007acc] font-bold">{groupStocks.length}개</span>
                                    </div>
                                </div>
                            )}
                        </Tabs>

                        <div className="space-y-2 pt-2 border-t border-[#3c3c3c]">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="predAllTime"
                                    checked={predAllTime}
                                    onChange={e => setPredAllTime(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-[#007acc] focus:ring-[#007acc]"
                                />
                                <label htmlFor="predAllTime" className="text-sm text-[#e1e1e1] cursor-pointer selection:bg-none">
                                    전체 과거 내역 예측 (Trend Backtesting)
                                </label>
                            </div>
                            <p className="text-xs text-[#888888] pl-6">
                                체크 시 과거 모든 데이터에 대해 예측을 수행합니다. (시간이 더 소요될 수 있습니다)
                            </p>
                        </div>

                        <Button
                            onClick={onPredict}
                            disabled={predicting || !selectedModelId || (predTargetType === 'group' && groupStocks.length === 0)}
                            className="w-full bg-[#007acc] hover:bg-[#0063a5] py-6 text-lg font-bold shadow-lg mt-4"
                        >
                            {predicting ? <Loader2 className="animate-spin mr-2" /> : <Activity className="w-5 h-5 mr-2" />}
                            {predicting ? "AI 예측 분석 중..." : "예측 실행"}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="bg-[#252526] border-[#3c3c3c] text-[#e1e1e1] flex flex-col justify-center items-center overflow-hidden">
                    <CardContent className="w-full text-center space-y-4 py-8">
                        {!predResult && !predicting && (
                            <div className="text-[#666666] flex flex-col items-center p-12">
                                <BarChart2 className="w-16 h-16 mb-4 opacity-10" />
                                <p className="text-sm">모델과 티커를 선택하고 버튼을 누르면<br />AI가 내일의 변동을 분석합니다.</p>
                            </div>
                        )}

                        {predicting && (
                            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                                <Loader2 className="w-12 h-12 text-[#007acc] animate-spin" />
                                <p className="text-[#888888] animate-pulse">백엔드 AI 엔진에서 분석 중...</p>
                            </div>
                        )}

                        {predResult && (
                            <div className="animate-in fade-in zoom-in duration-500 space-y-6">
                                <div className="p-2 bg-[#1e1e1e] rounded inline-block px-4">
                                    <div className="text-xs text-[#888888] mb-1">Target Date</div>
                                    <div className="text-base font-bold text-[#007acc]">{new Date(predResult.date).toLocaleDateString()}의 다음 날</div>
                                </div>

                                <div className="relative w-56 h-56 mx-auto flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="112" cy="112" r="100" stroke="#1e1e1e" strokeWidth="16" fill="none" />
                                        <circle
                                            cx="112" cy="112" r="100"
                                            stroke={predResult.probability > 0.5 ? "#22c55e" : "#ef4444"}
                                            strokeWidth="16"
                                            fill="none"
                                            strokeDasharray={2 * Math.PI * 100}
                                            strokeDashoffset={2 * Math.PI * 100 * (1 - predResult.probability)}
                                            strokeLinecap="round"
                                            className="transition-all duration-1000 ease-out"
                                        />
                                    </svg>
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-5xl font-black text-white">{(predResult.probability * 100).toFixed(1)}%</span>
                                        <span className="text-xs text-[#888888] uppercase tracking-widest mt-1">Rise Prob.</span>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <Badge
                                        className={`text-xl px-8 py-2 font-bold shadow-lg ${predResult.prediction === 1
                                            ? "bg-green-600 hover:bg-green-600 text-white"
                                            : "bg-red-600 hover:bg-red-600 text-white"
                                            }`}
                                    >
                                        {predResult.prediction === 1 ? "추천: 매수 (BUY)" : "추천: 관망/매도 (SELL)"}
                                    </Badge>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 최적 범위 분석 (백테스팅 결과가 있을 때만) */}
            {allPredResults.length > 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                    {/* AI 자동 추천 범위 */}
                    <Card className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border-[#3c3c3c] text-[#e1e1e1]">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Zap className="w-5 h-5 text-yellow-400" />
                                AI 최적 범위 추천
                            </CardTitle>
                            <CardDescription className="text-[#888888]">
                                백테스팅 데이터를 분석하여 최적의 매수/매도 임계값을 자동 계산합니다.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {optimalRange ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-green-900/30 rounded-lg p-4 border border-green-700/50">
                                            <div className="flex items-center gap-2 mb-2">
                                                <TrendingUp className="w-4 h-4 text-green-400" />
                                                <span className="text-xs text-green-400 font-medium">매수 범위</span>
                                            </div>
                                            <div className="text-2xl font-bold text-green-400">{optimalRange.buyThreshold}% 이상</div>
                                            <div className="text-lg font-bold text-green-300 mt-2">
                                                평균: {optimalRange.buyAvg >= 0 ? '+' : ''}{optimalRange.buyAvg.toFixed(2)}%
                                            </div>
                                            <div className="text-xs text-[#888888] mt-1">
                                                {optimalRange.buyCount}건 (합계 {optimalRange.buySum >= 0 ? '+' : ''}{optimalRange.buySum.toFixed(1)}%)
                                            </div>
                                        </div>
                                        <div className="bg-red-900/30 rounded-lg p-4 border border-red-700/50">
                                            <div className="flex items-center gap-2 mb-2">
                                                <TrendingDown className="w-4 h-4 text-red-400" />
                                                <span className="text-xs text-red-400 font-medium">매도 범위</span>
                                            </div>
                                            <div className="text-2xl font-bold text-red-400">{optimalRange.sellThreshold}% 미만</div>
                                            <div className="text-lg font-bold text-red-300 mt-2">
                                                평균: {optimalRange.sellAvg >= 0 ? '+' : ''}{optimalRange.sellAvg.toFixed(2)}%
                                            </div>
                                            <div className="text-xs text-[#888888] mt-1">
                                                {optimalRange.sellCount}건 (합계 {optimalRange.sellSum >= 0 ? '+' : ''}{optimalRange.sellSum.toFixed(1)}%)
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-yellow-600/50 text-yellow-400 hover:bg-yellow-900/20"
                                        onClick={() => {
                                            setBuyThreshold(optimalRange.buyThreshold)
                                            setSellThreshold(optimalRange.sellThreshold)
                                        }}
                                    >
                                        <Target className="w-4 h-4 mr-2" />
                                        최적값 적용하기
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center text-[#666666] py-8">
                                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">최적 범위를 계산하려면 더 많은 데이터가 필요합니다.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 수동 범위 조절 */}
                    <Card className="bg-[#252526] border-[#3c3c3c] text-[#e1e1e1]">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Activity className="w-5 h-5" />
                                수동 범위 조절
                            </CardTitle>
                            <CardDescription className="text-[#888888]">
                                슬라이더로 매수/매도 임계값을 직접 조정해보세요.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-green-400" />
                                        매수 범위
                                    </label>
                                    <span className="text-green-400 font-bold">{buyThreshold}% 이상</span>
                                </div>
                                <Slider
                                    value={[buyThreshold]}
                                    onValueChange={(v) => setBuyThreshold(v[0])}
                                    min={10}
                                    max={100}
                                    step={1}
                                    className="[&_[role=slider]]:bg-green-500"
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm flex items-center gap-2">
                                        <TrendingDown className="w-4 h-4 text-red-400" />
                                        매도 범위
                                    </label>
                                    <span className="text-red-400 font-bold">{sellThreshold}% 미만</span>
                                </div>
                                <Slider
                                    value={[sellThreshold]}
                                    onValueChange={(v) => setSellThreshold(v[0])}
                                    min={0}
                                    max={90}
                                    step={1}
                                    className="[&_[role=slider]]:bg-red-500"
                                />
                            </div>

                            {/* 현재 설정에 따른 결과 */}
                            {currentRangeStats && (
                                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#3c3c3c]">
                                    <div className="text-center p-3 bg-green-900/20 rounded-lg">
                                        <div className="text-xs text-[#888888]">매수 시 평균</div>
                                        <div className={`text-xl font-bold ${currentRangeStats.buyAvg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {currentRangeStats.buyAvg >= 0 ? '+' : ''}{currentRangeStats.buyAvg.toFixed(2)}%
                                        </div>
                                        <div className="text-xs text-[#666666]">{currentRangeStats.buyCount}건 (합 {currentRangeStats.buySum.toFixed(0)}%)</div>
                                    </div>
                                    <div className="text-center p-3 bg-red-900/20 rounded-lg">
                                        <div className="text-xs text-[#888888]">매도 시 평균</div>
                                        <div className={`text-xl font-bold ${currentRangeStats.sellAvg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {currentRangeStats.sellAvg >= 0 ? '+' : ''}{currentRangeStats.sellAvg.toFixed(2)}%
                                        </div>
                                        <div className="text-xs text-[#666666]">{currentRangeStats.sellCount}건 (합 {currentRangeStats.sellSum.toFixed(0)}%)</div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 백테스팅 결과 테이블 */}
            {allPredResults.length > 1 && (
                <Card className="bg-[#252526] border-[#3c3c3c] text-[#e1e1e1] mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart2 className="w-5 h-5" />
                            백테스팅 결과 ({allPredResults.length.toLocaleString()}건)
                        </CardTitle>
                        <CardDescription className="text-[#888888]">
                            과거 데이터에 대한 예측 결과와 실제 변동률을 비교합니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-[#1e1e1e]">
                                    <tr className="border-b border-[#3c3c3c] text-left">
                                        <th className="p-2 text-[#888888]">날짜</th>
                                        <th className="p-2 text-[#888888]">티커</th>
                                        <th className="p-2 text-[#888888] text-center">연속일</th>
                                        <th className="p-2 text-[#888888] text-right">최대구간%</th>
                                        <th className="p-2 text-[#888888] text-right">7일%</th>
                                        <th className="p-2 text-[#888888] text-right">1일%</th>
                                        <th className="p-2 text-[#888888] text-right">예측확률</th>
                                        <th className="p-2 text-[#888888] text-right">실제변동</th>
                                        <th className="p-2 text-[#888888] text-center">적중</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allPredResults.slice(0, 500).map((r, idx) => {
                                        const isHit = r.actual != null && (
                                            (r.prediction === 1 && r.actual > 0) ||
                                            (r.prediction === 0 && r.actual <= 0)
                                        )
                                        const MAX_LB_KEYS = [1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1]
                                        const maxLbKey = MAX_LB_KEYS.map(n => `change${n}d`).find(k => r.rawFeature?.[k] != null)
                                        const maxLbVal = maxLbKey != null ? r.rawFeature[maxLbKey] : null
                                        return (
                                            <tr key={idx} className="border-b border-[#2c2c2c] hover:bg-[#2a2a2a]">
                                                <td className="p-2 text-[#e1e1e1]">{new Date(r.date).toLocaleDateString()}</td>
                                                <td className="p-2 font-mono text-[#007acc]">{r.ticker}</td>
                                                <td className={`p-2 text-center ${r.rawFeature?.consecutiveDays > 0 ? 'text-green-400' : r.rawFeature?.consecutiveDays < 0 ? 'text-red-400' : ''}`}>
                                                    {r.rawFeature?.consecutiveDays || 0}
                                                </td>
                                                <td className={`p-2 text-right ${maxLbVal > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {maxLbVal != null ? `${maxLbVal.toFixed(1)}%` : '-'}
                                                </td>
                                                <td className={`p-2 text-right ${r.rawFeature?.change7d > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {r.rawFeature?.change7d?.toFixed(1) || '0.0'}%
                                                </td>
                                                <td className={`p-2 text-right ${r.rawFeature?.change1d > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {r.rawFeature?.change1d?.toFixed(1) || '0.0'}%
                                                </td>
                                                <td className={`p-2 text-right font-bold ${r.probability > 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {(r.probability * 100).toFixed(1)}%
                                                </td>
                                                <td className={`p-2 text-right font-bold ${r.actual > 0 ? 'text-green-400' : r.actual != null ? 'text-red-400' : 'text-[#666]'}`}>
                                                    {r.actual != null ? `${r.actual >= 0 ? '+' : ''}${r.actual.toFixed(1)}%` : '-'}
                                                </td>
                                                <td className="p-2 text-center">
                                                    {r.actual != null ? (
                                                        isHit ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {allPredResults.length > 500 && (
                            <p className="text-xs text-[#666666] mt-2 text-center">상위 500건만 표시됩니다. (총 {allPredResults.length.toLocaleString()}건)</p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
