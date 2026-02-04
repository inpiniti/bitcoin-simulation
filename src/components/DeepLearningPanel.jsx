import { useState, useEffect } from "react"
import { useStore } from "@/store/useStore"
import { fetchStockHistory } from "@/lib/api"
import { processStockDataForML, processStockDataForPrediction } from "@/lib/mlProcessor"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Brain, Activity, Save, Play, CheckCircle, Database, BarChart2, Loader2, AlertCircle } from "lucide-react"


export function DeepLearningPanel() {
    const { mlModels, saveMLModel, deleteMLModel, tickerGroup, setTickerGroup, fetchGroupStocks, groupStocks } = useStore()

    // 학습 상태
    const [trainMode, setTrainMode] = useState("single") // "single" | "group"
    const [trainTicker, setTrainTicker] = useState("AAPL")
    const [trainData, setTrainData] = useState(null)
    const [training, setTraining] = useState(false)
    const [trainProgress, setTrainProgress] = useState(0)
    const [trainResult, setTrainResult] = useState(null)
    const [modelName, setModelName] = useState("")

    // 예측 상태
    const [predTicker, setPredTicker] = useState("BTC-USD")
    const [selectedModelId, setSelectedModelId] = useState("")
    const [predicting, setPredicting] = useState(false)
    const [predResult, setPredResult] = useState(null)

    // 그룹 데이터 로드 감시
    useEffect(() => {
        if (trainMode === 'group') {
            fetchGroupStocks()
        }
    }, [trainMode, tickerGroup])

    // 1. 데이터 수집 및 전처리
    const handleFetchAndProcess = async () => {
        setTraining(true)
        setTrainProgress(0)
        setTrainData(null)
        setTrainResult(null)

        try {
            let allFeatures = []
            let allLabels = []

            if (trainMode === 'single') {
                setTrainProgress(30)
                const candles = await fetchStockHistory(trainTicker, 365)
                setTrainProgress(70)
                const { features, labels } = processStockDataForML(candles)
                allFeatures = features
                allLabels = labels
            } else {
                // 그룹 학습
                if (!groupStocks || groupStocks.length === 0) {
                    alert("그룹 종목이 없습니다. 그룹을 먼저 로드해주세요.")
                    setTraining(false)
                    return
                }

                // 너무 많은 종목은 브라우저 부하가 크므로 최대 40개로 제한 (또는 슬라이싱)
                const targetStocks = groupStocks.slice(0, 40)
                const total = targetStocks.length

                for (let i = 0; i < total; i++) {
                    const stock = targetStocks[i]
                    try {
                        const candles = await fetchStockHistory(stock.ticker, 365)
                        const { features, labels } = processStockDataForML(candles)
                        allFeatures = [...allFeatures, ...features]
                        allLabels = [...allLabels, ...labels]
                    } catch (err) {
                        console.warn(`Failed to fetch ${stock.ticker}:`, err)
                    }
                    setTrainProgress(Math.round(((i + 1) / total) * 100))
                }
            }

            if (allFeatures.length === 0) {
                alert("데이터가 부족합니다.")
                setTraining(false)
                return
            }

            // E2BIG 방지를 위해 서버로 보내는 샘플 수 제한 (최대 5,000개)
            const MAX_SAMPLES = 5000
            if (allFeatures.length > MAX_SAMPLES) {
                console.log(`[XGB] Downsampling: ${allFeatures.length} -> ${MAX_SAMPLES}`)

                // 무작위 다운샘플링
                const indices = Array.from({ length: allFeatures.length }, (_, i) => i)
                for (let i = indices.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [indices[i], indices[j]] = [indices[j], indices[i]]
                }
                const selectedIndices = indices.slice(0, MAX_SAMPLES)
                allFeatures = selectedIndices.map(i => allFeatures[i])
                allLabels = selectedIndices.map(i => allLabels[i])
            }


            setTrainData({ features: allFeatures, labels: allLabels, count: allFeatures.length })
            setTrainProgress(100)
        } catch (e) {
            console.error(e)
            alert("데이터 수집 실패")
        } finally {
            setTraining(false)
        }
    }

    // 2. 학습 요청 (XGBoost)
    const handleTrain = async () => {
        if (!trainData) return
        setTraining(true)
        setTrainProgress(0)

        try {
            // API 호출
            const response = await fetch("/api/xgb/train", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    features: trainData.features,
                    labels: trainData.labels
                })
            })

            if (!response.ok) throw new Error("Train API Failed")

            const result = await response.json()
            setTrainResult(result) // { modelJson, accuracy, ... }

            const identifier = trainMode === 'single' ? trainTicker : tickerGroup.toUpperCase()
            setModelName(`XGB_${identifier}_${new Date().toISOString().slice(0, 10)}`)
            setTrainProgress(100)

        } catch (e) {
            console.error(e)
            alert("학습 실패: " + e.message)
        } finally {
            setTraining(false)
        }
    }

    // 3. 모델 저장
    const handleSaveModel = () => {
        if (!trainResult || !modelName) return
        saveMLModel({
            name: modelName,
            modelJson: trainResult.modelJson,
            accuracy: trainResult.accuracy,
            featureCount: trainResult.featureCount
        })
        alert("모델이 저장되었습니다.")
        setTrainResult(null)
        setTrainData(null)
    }

    // 4. 예측 요청
    const handlePredict = async () => {
        if (!selectedModelId) {
            alert("모델을 선택해주세요.")
            return
        }
        setPredicting(true)
        setPredResult(null)

        try {
            const model = mlModels.find(m => m.id === selectedModelId)
            if (!model) throw new Error("Model not found")

            // 데이터 수집
            const candles = await fetchStockHistory(predTicker, 60)
            if (!candles || candles.length < 30) throw new Error("데이터 부족")

            // 전처리 (Prediction용)
            const { feature, date } = processStockDataForPrediction(candles)

            // API 호출
            const response = await fetch("/api/xgb/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    modelJson: model.modelJson,
                    features: [feature]
                })
            })

            if (!response.ok) throw new Error("Predict API Failed")

            const result = await response.json()
            const p = result.predictions[0]

            setPredResult({
                ...p,
                date,
                ticker: predTicker
            })

        } catch (e) {
            console.error(e)
            alert("예측 실패: " + e.message)
        } finally {
            setPredicting(false)
        }
    }

    return (
        <div className="h-full bg-[#1e1e1e] text-[#e1e1e1] p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Brain className="text-[#007acc]" />
                    Deep Learning Studio (XGBoost)
                </h1>
                <div className="flex gap-2">
                    {mlModels.length > 0 && (
                        <Badge variant="outline" className="text-[#007acc] border-[#007acc]">
                            저장된 모델: {mlModels.length}개
                        </Badge>
                    )}
                </div>
            </div>

            <Tabs defaultValue="predict" className="w-full">
                <TabsList className="bg-[#2d2d2d] mb-6 border border-[#3c3c3c]">
                    <TabsTrigger value="predict" className="data-[state=active]:bg-[#007acc] data-[state=active]:text-white">
                        <Activity className="w-4 h-4 mr-2" /> 예측 (Prediction)
                    </TabsTrigger>
                    <TabsTrigger value="train" className="data-[state=active]:bg-[#007acc] data-[state=active]:text-white">
                        <Database className="w-4 h-4 mr-2" /> 학습 (Training)
                    </TabsTrigger>
                    <TabsTrigger value="models" className="data-[state=active]:bg-[#007acc] data-[state=active]:text-white">
                        <Save className="w-4 h-4 mr-2" /> 모델 관리
                    </TabsTrigger>
                </TabsList>

                {/* 학습 탭 */}
                <TabsContent value="train" className="space-y-6">
                    <Card className="bg-[#252526] border-[#3c3c3c] text-[#e1e1e1]">
                        <CardHeader>
                            <CardTitle>1. 데이터 수집 및 전처리</CardTitle>
                            <CardDescription className="text-[#888888]">
                                학습 데이터를 준비합니다. 단일 종목 또는 특정 그룹 전체를 대상으로 데이터를 수집할 수 있습니다.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Tabs value={trainMode} onValueChange={setTrainMode} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 bg-[#1e1e1e] border border-[#3c3c3c]">
                                    <TabsTrigger value="single">단일 종목</TabsTrigger>
                                    <TabsTrigger value="group">티커 그룹</TabsTrigger>
                                </TabsList>

                                <div className="mt-4 p-4 bg-[#1e1e1e] rounded border border-[#3c3c3c] space-y-4">
                                    {trainMode === 'single' ? (
                                        <div className="space-y-2">
                                            <label className="text-xs text-[#888888]">학습할 티커 (예: AAPL, BTC-USD)</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={trainTicker}
                                                    onChange={e => setTrainTicker(e.target.value)}
                                                    className="bg-[#252526] border-[#3c3c3c]"
                                                    placeholder="AAPL"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <label className="text-xs text-[#888888]">대상 그룹 선택</label>
                                            <select
                                                className="w-full bg-[#252526] border border-[#3c3c3c] rounded p-2 text-sm"
                                                value={tickerGroup}
                                                onChange={e => setTickerGroup(e.target.value)}
                                            >
                                                <option value="superinvestor">Super Investors (DataRoma)</option>
                                                <option value="sp500">S&P 500</option>
                                                <option value="qqq">Nasdaq 100 (QQQ)</option>
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

                                    <Button
                                        onClick={handleFetchAndProcess}
                                        disabled={training}
                                        className="w-full bg-[#3c3c3c] hover:bg-[#4c4c4c]"
                                    >
                                        {training ? <Loader2 className="animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
                                        데이터 세트 수집 시작
                                    </Button>
                                </div>
                            </Tabs>

                            {training && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-[#888888]">
                                        <span>진행률</span>
                                        <span>{trainProgress}%</span>
                                    </div>
                                    <Progress value={trainProgress} className="h-2" />
                                </div>
                            )}

                            {trainData && (
                                <div className="p-4 bg-[#1e1e1e] rounded border border-[#3c3c3c] space-y-3 animate-in fade-in duration-300">
                                    <div className="flex items-center gap-2 text-sm text-green-500 font-bold mb-1">
                                        <CheckCircle className="w-4 h-4" /> 데이터 준비 완료
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="bg-[#252526] p-2 rounded">
                                            <div className="text-[#888888] mb-1">총 샘플 수</div>
                                            <div className="text-lg font-bold text-[#007acc]">{trainData.count.toLocaleString()}</div>
                                        </div>
                                        <div className="bg-[#252526] p-2 rounded">
                                            <div className="text-[#888888] mb-1">Feature 차원</div>
                                            <div className="text-lg font-bold text-[#007acc]">{trainData.features[0].length}</div>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleTrain}
                                        disabled={training}
                                        className="w-full bg-[#007acc] hover:bg-[#0063a5] py-6 text-lg font-bold shadow-lg"
                                    >
                                        {training ? "XGBoost 학습 중..." : "AI 모델 학습 시작 (XGBoost)"}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {trainResult && (
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
                                        <span className="text-3xl font-bold text-green-500">{(trainResult.accuracy * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-4 bg-[#1e1e1e] rounded border border-[#3c3c3c]">
                                        <span className="text-xs text-[#888888] mb-1">학습 샘플</span>
                                        <span className="text-2xl font-bold">{(trainResult.sampleCount || trainData.count).toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs text-[#888888]">모델 이름</label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={modelName}
                                            onChange={e => setModelName(e.target.value)}
                                            className="bg-[#1e1e1e] border-[#3c3c3c]"
                                        />
                                        <Button onClick={handleSaveModel} className="bg-green-600 hover:bg-green-700 font-bold px-6">
                                            저장하기
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* 예측 탭 */}
                <TabsContent value="predict" className="space-y-6">
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
                                        {mlModels.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} (정확도: {(m.accuracy * 100).toFixed(0)}%)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-[#888888]">예측할 티커</label>
                                    <Input
                                        value={predTicker}
                                        onChange={e => setPredTicker(e.target.value)}
                                        className="bg-[#1e1e1e] border-[#3c3c3c]"
                                        placeholder="BTC-USD"
                                    />
                                </div>
                                <Button
                                    onClick={handlePredict}
                                    disabled={predicting}
                                    className="w-full bg-[#007acc] hover:bg-[#0063a5] py-6 text-lg font-bold"
                                >
                                    {predicting ? <Loader2 className="animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                    상승 확률 예측하기
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
                </TabsContent>

                {/* 모델 관리 탭 */}
                <TabsContent value="models" className="space-y-4">
                    <Card className="bg-[#252526] border-[#3c3c3c] text-[#e1e1e1]">
                        <CardHeader>
                            <CardTitle>저장된 모델 리스트</CardTitle>
                            <CardDescription className="text-[#888888]">브라우저(IndexedDB)에 저장된 AI 모델들을 관리합니다.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {mlModels.length === 0 ? (
                                    <div className="col-span-full text-center p-12 text-[#666666] border border-dashed border-[#3c3c3c] rounded-lg">
                                        저장된 모델이 없습니다. 먼저 학습을 진행해 주세요.
                                    </div>
                                ) : (
                                    mlModels.map(model => (
                                        <div key={model.id} className="p-4 bg-[#1e1e1e] rounded border border-[#3c3c3c] hover:border-[#007acc] transition-colors group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="font-bold truncate mr-2" title={model.name}>{model.name}</div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        if (confirm("이 모델을 삭제하시겠습니까?")) deleteMLModel(model.id)
                                                    }}
                                                >
                                                    <span className="text-xs">✕</span>
                                                </Button>
                                            </div>
                                            <div className="text-xs text-[#888888] space-y-1">
                                                <div className="flex justify-between">
                                                    <span>정확도:</span>
                                                    <span className="text-green-500 font-bold">{(model.accuracy * 100).toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>피처 수:</span>
                                                    <span className="text-[#e1e1e1]">{model.featureCount}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>만든 날짜:</span>
                                                    <span className="text-[#e1e1e1]">{new Date(model.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

