import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Brain, Database, Play, CheckCircle, Loader2, AlertCircle, Zap } from "lucide-react"

const STAGE_OPTIONS = [
    { key: 1,  label: '1단계',  desc: 'lookback: 1일' },
    { key: 2,  label: '2단계',  desc: 'lookback: 1~2일' },
    { key: 3,  label: '3단계',  desc: 'lookback: ~4일' },
    { key: 4,  label: '4단계',  desc: 'lookback: ~8일' },
    { key: 5,  label: '5단계',  desc: 'lookback: ~16일' },
    { key: 6,  label: '6단계',  desc: 'lookback: ~32일' },
    { key: 7,  label: '7단계',  desc: 'lookback: ~64일' },
    { key: 8,  label: '8단계',  desc: 'lookback: ~128일' },
    { key: 9,  label: '9단계',  desc: 'lookback: ~256일' },
    { key: 10, label: '10단계', desc: 'lookback: ~512일' },
    { key: 11, label: '11단계', desc: 'lookback: ~1024일' },
]

const ALL_PERIODS = [
    { value: '365',  label: '1년' },
    { value: '730',  label: '2년' },
    { value: '1825', label: '5년' },
    { value: 'max',  label: 'Max' },
]

export function DLServerTrainingTab({
    // training target
    trainMode,
    setTrainMode,
    trainTicker,
    setTrainTicker,
    tickerGroup,
    setTickerGroup,
    trainPeriod,
    setTrainPeriod,
    trainStage,
    setTrainStage,
    stageMinPeriod,
    modelName,
    setModelName,
    // server training state
    serverTraining,
    serverCollectProgress,
    serverTrainProgress,
    serverTrainResult,
    serverTrainError,
    // actions
    onStartTrain,
    onResetResult,
}) {
    const availablePeriods = ALL_PERIODS.filter(p => p.value === 'max' || parseInt(p.value) >= (stageMinPeriod?.[trainStage] ?? 365))
    return (
        <div className="space-y-6">
            <Card className="bg-[#252526] border-[#3c3c3c] text-[#e1e1e1]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-[#007acc]" />
                        서버 학습 설정
                    </CardTitle>
                    <CardDescription className="text-[#888888]">
                        서버에서 직접 데이터를 수집하고 학습합니다. 대규모 그룹(6,000+)도 처리 가능합니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* 학습 대상 선택 */}
                    <Tabs value={trainMode} onValueChange={v => { setTrainMode(v); onResetResult(); }} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-[#1e1e1e] border border-[#3c3c3c]">
                            <TabsTrigger value="single">단일 종목</TabsTrigger>
                            <TabsTrigger value="group">티커 그룹</TabsTrigger>
                        </TabsList>

                        <div className="mt-4 p-4 bg-[#1e1e1e] rounded border border-[#3c3c3c] space-y-4">
                            {trainMode === 'single' ? (
                                <div className="space-y-2">
                                    <label className="text-xs text-[#888888]">학습할 티커 (예: AAPL, BTC-USD)</label>
                                    <Input
                                        value={trainTicker}
                                        onChange={e => setTrainTicker(e.target.value)}
                                        className="bg-[#252526] border-[#3c3c3c]"
                                        placeholder="AAPL"
                                        disabled={serverTraining}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-xs text-[#888888]">대상 그룹 선택</label>
                                    <select
                                        className="w-full bg-[#252526] border border-[#3c3c3c] rounded p-2 text-sm"
                                        value={tickerGroup}
                                        onChange={e => setTickerGroup(e.target.value)}
                                        disabled={serverTraining}
                                    >
                                        <option value="sp500">S&P 500 (~500종목)</option>
                                        <option value="qqq">Nasdaq 100 (QQQ)</option>
                                        <option value="usall">🇺🇸 나스닥 + 뉴욕 전체 (6,000+)</option>
                                        <option value="kospi200">KOSPI 200</option>
                                    </select>
                                </div>
                            )}

                            {/* 피처 단계 */}
                            <div className="space-y-2">
                                <label className="text-xs text-[#888888]">피처 단계 (lookback)</label>
                                <div className="flex flex-wrap gap-1">
                                    {STAGE_OPTIONS.map(s => (
                                        <button
                                            key={s.key}
                                            onClick={() => !serverTraining && setTrainStage(s.key)}
                                            disabled={serverTraining}
                                            title={s.desc}
                                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                                                trainStage === s.key
                                                    ? 'bg-[#007acc] border-[#007acc] text-white'
                                                    : 'bg-[#1e1e1e] border-[#3c3c3c] text-[#888888] hover:border-[#007acc]'
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="text-xs text-[#888888]">
                                    {STAGE_OPTIONS.find(s => s.key === trainStage)?.desc}
                                    {(stageMinPeriod?.[trainStage] ?? 365) > 365 && (
                                        <span className="ml-2 text-yellow-500">※ 최소 {stageMinPeriod[trainStage] >= 1825 ? '5년' : '2년'} 이상 필요</span>
                                    )}
                                </div>
                            </div>

                            {/* 학습 기간 */}
                            <div className="space-y-2">
                                <label className="text-xs text-[#888888]">학습 데이터 기간</label>
                                <select
                                    className="w-full bg-[#252526] border border-[#3c3c3c] rounded p-2 text-sm"
                                    value={trainPeriod}
                                    onChange={e => setTrainPeriod(e.target.value)}
                                    disabled={serverTraining}
                                >
                                    {availablePeriods.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                                <div className="text-xs text-[#888888]">
                                    {trainPeriod === '365' && '최근 1년 데이터로 학습합니다.'}
                                    {trainPeriod === '730' && '최근 2년 데이터로 학습합니다.'}
                                    {trainPeriod === '1825' && '최근 5년 데이터로 학습합니다.'}
                                    {trainPeriod === 'max' && '전체 기간 데이터로 학습합니다.'}
                                </div>
                            </div>

                            {/* 모델 이름 */}
                            <div className="space-y-2">
                                <label className="text-xs text-[#888888]">모델 이름 (비워두면 자동 생성)</label>
                                <Input
                                    value={modelName}
                                    onChange={e => setModelName(e.target.value)}
                                    className="bg-[#252526] border-[#3c3c3c]"
                                    placeholder={`XGB_${trainMode === 'single' ? trainTicker : tickerGroup.toUpperCase()}_${new Date().toISOString().slice(0, 10)}`}
                                    disabled={serverTraining}
                                />
                            </div>
                        </div>
                    </Tabs>

                    {/* 진행 상황 표시 */}
                    {(serverTraining || serverCollectProgress > 0 || serverTrainProgress > 0) && !serverTrainResult && !serverTrainError && (
                        <div className="p-4 bg-[#1e1e1e] rounded border border-[#3c3c3c] space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {/* 수집 진행률 */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-[#888888] flex items-center gap-1">
                                            <Database className="w-3 h-3" /> 수집
                                        </span>
                                        <span className={serverCollectProgress === 100 ? "text-green-400" : "text-[#007acc]"}>
                                            {serverCollectProgress}%
                                        </span>
                                    </div>
                                    <Progress value={serverCollectProgress} className="h-3" />
                                    {serverCollectProgress === 100 && (
                                        <div className="text-xs text-green-400 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> 수집 완료
                                        </div>
                                    )}
                                </div>

                                {/* 학습 진행률 */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-[#888888] flex items-center gap-1">
                                            <Brain className="w-3 h-3" /> 학습
                                        </span>
                                        <span className={serverTrainProgress === 100 ? "text-green-400" : serverTrainProgress > 0 ? "text-[#007acc]" : "text-[#555555]"}>
                                            {serverTrainProgress}%
                                        </span>
                                    </div>
                                    <Progress value={serverTrainProgress} className="h-3" />
                                    {serverTrainProgress > 0 && serverTrainProgress < 100 && (
                                        <div className="text-xs text-[#888888] flex items-center gap-1">
                                            <Loader2 className="w-3 h-3 animate-spin" /> XGBoost 학습 중...
                                        </div>
                                    )}
                                </div>
                            </div>

                            {serverTraining && (
                                <div className="text-xs text-[#888888] text-center pt-1 space-y-0.5">
                                    <div>시간이 오래 걸립니다. 잠시만 기다려주세요.</div>
                                    <div className="text-[#555]">브라우저를 닫아도 서버에서 계속 학습하며, 완료 시 자동 저장됩니다.</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 오류 표시 */}
                    {serverTrainError && (
                        <div className="p-3 bg-red-900/20 border border-red-800 rounded flex items-start gap-2 text-sm text-red-400">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{serverTrainError}</span>
                        </div>
                    )}

                    {/* 학습하기 버튼 */}
                    {!serverTraining && !serverTrainResult && (
                        <Button
                            onClick={onStartTrain}
                            className="w-full bg-[#007acc] hover:bg-[#0063a5] py-6 text-lg font-bold shadow-lg"
                        >
                            <Play className="w-5 h-5 mr-2" />
                            학습하기 (서버에서 수집 → 학습)
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* 완료 결과 카드 */}
            {serverTrainResult && (
                <Card className="bg-[#252526] border-[#3c3c3c] text-[#e1e1e1] animate-in slide-in-from-bottom duration-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-500">
                            <CheckCircle className="w-5 h-5" />
                            모델 생성 완료
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col items-center justify-center p-4 bg-[#1e1e1e] rounded border border-[#3c3c3c]">
                                <span className="text-xs text-[#888888] mb-1">검증 정확도</span>
                                <span className="text-3xl font-bold text-green-500">{(serverTrainResult.accuracy * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4 bg-[#1e1e1e] rounded border border-[#3c3c3c]">
                                <span className="text-xs text-[#888888] mb-1">학습 샘플</span>
                                <span className="text-2xl font-bold">{(serverTrainResult.sampleCount || 0).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="text-sm text-green-500 font-bold text-center">
                            모델이 서버에 저장되었습니다.
                        </div>
                        <Button
                            onClick={onResetResult}
                            variant="outline"
                            className="w-full border-[#3c3c3c]"
                        >
                            새로운 학습 시작하기
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
