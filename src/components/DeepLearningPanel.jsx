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
    const { tickerGroup, setTickerGroup, fetchGroupStocks, groupStocks } = useStore()

    // 서버 모델 목록 상태
    const [serverModels, setServerModels] = useState([])
    const [loadingModels, setLoadingModels] = useState(false)

    // Supabase에서 모델 목록 불러오기
    const fetchModelsFromSupabase = async () => {
        setLoadingModels(true)
        try {
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
            const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

            const res = await fetch(`${SUPABASE_URL}/rest/v1/ml_models?select=*&order=created_at.desc`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`
                }
            })
            if (res.ok) {
                const data = await res.json()
                setServerModels(data)
            }
        } catch (e) {
            console.error("Failed to load models:", e)
        } finally {
            setLoadingModels(false)
        }
    }

    useEffect(() => {
        fetchModelsFromSupabase()
    }, [])

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
    const [predTargetType, setPredTargetType] = useState("single") // "single" | "group"
    const [predAllTime, setPredAllTime] = useState(false) // 전체 기간 예측 여부

    // 그룹 데이터 로드 감시 (학습/예측 모드 둘 다 대응)
    useEffect(() => {
        if (trainMode === 'group' || predTargetType === 'group') {
            fetchGroupStocks()
        }
    }, [trainMode, predTargetType, tickerGroup])

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

                // 종목 수 제한 해제 (기존 40개 제한 제거)
                const targetStocks = groupStocks
                const total = targetStocks.length
                const BATCH_SIZE = 5 // 한 번에 5개씩 병렬 요청 (Rate Limit 고려)

                console.log(`[XGB] Fetching data for ${total} stocks...`)

                for (let i = 0; i < total; i += BATCH_SIZE) {
                    const batch = targetStocks.slice(i, i + BATCH_SIZE)

                    // 병렬 데이터 수집
                    const results = await Promise.all(batch.map(async (stock) => {
                        try {
                            const candles = await fetchStockHistory(stock.ticker, 365)
                            if (!candles || candles.length === 0) return null
                            return processStockDataForML(candles)
                        } catch (err) {
                            console.warn(`Failed to fetch ${stock.ticker}:`, err)
                            return null
                        }
                    }))

                    // 결과 병합
                    results.forEach(res => {
                        if (res) {
                            allFeatures = [...allFeatures, ...res.features]
                            allLabels = [...allLabels, ...res.labels]
                        }
                    })

                    // 진행률 업데이트
                    const currentProgress = Math.min(Math.round(((i + BATCH_SIZE) / total) * 100), 99)
                    setTrainProgress(currentProgress)

                    // 약간의 딜레이 (너무 빠른 요청 방지)
                    if (i + BATCH_SIZE < total) await new Promise(r => setTimeout(r, 100))
                }
            }

            if (allFeatures.length === 0) {
                alert("데이터가 부족합니다.")
                setTraining(false)
                return
            }

            // 사용자 요청: 모든 데이터 학습 (제한 없음)
            console.log(`[XGB] Total samples collected: ${allFeatures.length}`)
            // MAX_SAMPLES 제한 제거함



            setTrainData({ features: allFeatures, labels: allLabels, count: allFeatures.length })

            // 모델 이름 미리 생성 (사용자가 수정 가능)
            const identifier = trainMode === 'single' ? trainTicker : tickerGroup.toUpperCase()
            setModelName(`XGB_${identifier}_${new Date().toISOString().slice(0, 10)}`)

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
            // 1. Supabase에 학습 데이터 업로드
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
            const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

            if (!SUPABASE_URL || !SUPABASE_KEY) {
                throw new Error("Supabase 환경 변수가 설정되지 않았습니다.")
            }

            console.log("[XGB] Uploading training data to Supabase...")

            // Supabase REST API 호출
            const uploadRes = await fetch(`${SUPABASE_URL}/rest/v1/training_datasets`, {
                method: "POST",
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                },
                body: JSON.stringify({
                    features: trainData.features,
                    labels: trainData.labels
                })
            })

            if (!uploadRes.ok) {
                const errText = await uploadRes.text()
                throw new Error(`Failed to upload training data: ${errText}`)
            }

            const uploadData = await uploadRes.json()
            const datasetId = uploadData[0].id
            console.log(`[XGB] Training data uploaded. ID: ${datasetId}`)

            // 2. 백엔드에 학습 요청 (데이터셋 ID + 모델 이름 전달)
            const response = await fetch("/api/xgb/train", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    datasetId: datasetId,
                    modelName: modelName // 사용자가 지정한 이름 전송
                })
            })

            if (!response.ok) throw new Error("Train API Failed")

            const result = await response.json()
            setTrainResult(result) // { modelId, accuracy, ... }

            setTrainProgress(100)

            // 목록 갱신 및 완료 알림
            await fetchModelsFromSupabase()
            alert("모델 학습이 완료되었으며, 서버에 자동 저장되었습니다.")

        } catch (e) {
            console.error(e)
            alert("학습 실패: " + e.message)
        } finally {
            setTraining(false)
        }
    }

    // 3. 모델 삭제 (Supabase)
    const handleDeleteModel = async (id) => {
        if (!confirm("이 모델을 삭제하시겠습니까? (Supabase 서버에서도 삭제됩니다)")) return

        try {
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
            const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

            const res = await fetch(`${SUPABASE_URL}/rest/v1/ml_models?id=eq.${id}`, {
                method: "DELETE",
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`
                }
            })

            if (res.ok) {
                await fetchModelsFromSupabase()
                alert("모델이 삭제되었습니다.")
            } else {
                throw new Error("삭제 실패")
            }
        } catch (e) {
            console.error(e)
            alert("모델 삭제 중 오류 발생")
        }
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
            const model = serverModels.find(m => m.id.toString() === selectedModelId.toString())
            if (!model) {
                console.error("Selected Model not found in list:", selectedModelId, serverModels)
                throw new Error("선택한 모델을 찾을 수 없습니다.")
            }

            let predictionTargets = []

            // A. 예측 대상 수집
            if (predTargetType === 'single') {
                predictionTargets = [predTicker]
            } else {
                if (!groupStocks || groupStocks.length === 0) throw new Error("그룹 종목이 없습니다.")
                predictionTargets = groupStocks.map(s => s.ticker)
            }

            // B. 데이터 수집 및 전처리 (병렬 처리)
            const BATCH_SIZE = 5
            let allFeatures = []
            let metadataList = [] // 결과 매핑용 (ticker, date)

            for (let i = 0; i < predictionTargets.length; i += BATCH_SIZE) {
                const batch = predictionTargets.slice(i, i + BATCH_SIZE)
                await Promise.all(batch.map(async (ticker) => {
                    try {
                        // 전체 기간이면 365일치, 아니면 60일치만 가져와서 최소화
                        const days = predAllTime ? 365 : 60
                        const candles = await fetchStockHistory(ticker, days)

                        if (candles && candles.length > 30) {
                            // mlProcessor 수정된 함수 사용 (두번째 인자: allHistory)
                            const processed = processStockDataForPrediction(candles, predAllTime)

                            // 배열인지 단일 객체인지 확인하여 정규화
                            const features = processed.features || [processed.feature]
                            const dates = processed.dates || [processed.date]

                            features.forEach((feat, idx) => {
                                allFeatures.push(feat)
                                metadataList.push({
                                    ticker,
                                    date: dates[idx]
                                })
                            })
                        }
                    } catch (err) {
                        console.warn(`Failed to fetch/process for ${ticker}`, err)
                    }
                }))
            }

            if (allFeatures.length === 0) throw new Error("유효한 데이터가 없습니다.")

            console.log(`[Prediction] Total features: ${allFeatures.length}`)

            // C. 예측 실행 (데이터 크기에 따른 분기)
            let predictions = []
            const USE_DATASET_UPLOAD = allFeatures.length > 50 // 50개 이상이면 Supabase 업로드 방식 사용

            if (USE_DATASET_UPLOAD) {
                // 1. Supabase 업로드
                const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
                const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

                const datasetPayload = {
                    name: `Prediction-${Date.now()}`, // 필수 필드일 가능성 높음
                    features: allFeatures,
                    labels: [], // 예측용이라 레이블 없음
                    feature_names: ['consecutive', 'change1d', 'change7d', 'change30d'],
                    created_at: new Date().toISOString()
                }

                const uploadRes = await fetch(`${SUPABASE_URL}/rest/v1/training_datasets`, {
                    method: "POST",
                    headers: {
                        "apikey": SUPABASE_KEY,
                        "Authorization": `Bearer ${SUPABASE_KEY}`,
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    },
                    body: JSON.stringify(datasetPayload)
                })

                if (!uploadRes.ok) throw new Error("데이터 업로드 실패")
                const uploadResult = await uploadRes.json()
                const datasetId = uploadResult[0].id

                // 2. API 호출 (datasetId 전송)
                const apiRes = await fetch("/api/xgb/predict", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        modelId: model.id || model.model_id || model.modelId,
                        datasetId: datasetId
                    })
                })

                if (!apiRes.ok) throw new Error("Predict API Failed")
                const apiResult = await apiRes.json()
                predictions = apiResult.predictions

            } else {
                // 2. 직접 전송 (소량 데이터)
                const apiRes = await fetch("/api/xgb/predict", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        modelId: model.id || model.model_id || model.modelId,
                        features: allFeatures
                    })
                })

                if (!apiRes.ok) throw new Error("Predict API Failed")
                const apiResult = await apiRes.json()
                predictions = apiResult.predictions
            }

            // D. 결과 병합 및 검증
            if (!predictions || !Array.isArray(predictions)) {
                console.error("Invalid prediction result:", predictions)
                throw new Error("예측 결과를 받아오지 못했습니다.")
            }

            const finalResults = predictions.map((p, idx) => ({
                ...p,
                ...metadataList[idx]
            }))

            // 결과 정렬 (확률 높은 순)
            finalResults.sort((a, b) => b.probability - a.probability)

            // 단일 결과 호환성 유지 (UI 표시용)
            // 여러 개일 경우 리스트 처리가 필요하지만 일단 첫 번째(가장 높은 확률 or 단일)를 메인으로 설정
            // TODO: UI에 리스트 뷰 추가 필요
            setPredResult(finalResults[0])

            // 전체 결과는 콘솔이나 별도 상태로 저장 가능 (추후 UI 확장 시 사용)
            console.log("Prediction Results:", finalResults)

            // 결과가 여러개인 경우 알림
            if (finalResults.length > 1) {
                alert(`총 ${finalResults.length}건의 예측이 완료되었습니다. 상위 결과: ${finalResults[0].ticker} (${(finalResults[0].probability * 100).toFixed(1)}%)`)
            }

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
                    {serverModels.length > 0 && (
                        <Badge variant="outline" className="text-[#007acc] border-[#007acc]">
                            저장된 모델: {serverModels.length}개
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
                                    <div className="space-y-2 pt-2 border-t border-[#3c3c3c]">
                                        <label className="text-xs text-[#888888]">모델 이름 지정</label>
                                        <Input
                                            value={modelName}
                                            onChange={e => setModelName(e.target.value)}
                                            className="bg-[#252526] border-[#3c3c3c]"
                                            placeholder="저장할 모델 이름을 입력하세요"
                                        />
                                    </div>

                                    <Button
                                        onClick={handleTrain}
                                        disabled={training || !modelName}
                                        className="w-full bg-[#007acc] hover:bg-[#0063a5] py-6 text-lg font-bold shadow-lg"
                                    >
                                        {training ? "AI 모델 학습 진행 중..." : "AI 모델 학습 시작 (서버 저장)"}
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

                                <div className="space-y-2 text-center pt-2">
                                    <div className="text-sm text-green-500 font-bold mb-2">
                                        모델이 서버({modelName})에 안전하게 저장되었습니다.
                                    </div>
                                    <Button onClick={() => { setTrainResult(null); setTrainData(null); }} variant="outline" className="border-[#3c3c3c]">
                                        새로운 학습 시작하기
                                    </Button>
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
                                    onClick={handlePredict}
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
                </TabsContent>

                {/* 모델 관리 탭 */}
                <TabsContent value="models" className="space-y-4">
                    <Card className="bg-[#252526] border-[#3c3c3c] text-[#e1e1e1]">
                        <CardHeader>
                            <CardTitle>저장된 모델 리스트</CardTitle>
                            <CardDescription className="text-[#888888]">Supabase 서버에 저장된 AI 모델들을 관리합니다.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {serverModels.length === 0 ? (
                                    <div className="col-span-full text-center p-12 text-[#666666] border border-dashed border-[#3c3c3c] rounded-lg">
                                        저장된 모델이 없습니다. 먼저 학습을 진행해 주세요.
                                    </div>
                                ) : (
                                    serverModels.map(model => (
                                        <div key={model.id} className="p-4 bg-[#1e1e1e] rounded border border-[#3c3c3c] hover:border-[#007acc] transition-colors group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="font-bold truncate mr-2" title={model.name}>{model.name}</div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleDeleteModel(model.id)}
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
                                                    <span>샘플 수:</span>
                                                    <span className="text-[#e1e1e1]">{model.sample_count || model.sampleCount || '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>만든 날짜:</span>
                                                    <span className="text-[#e1e1e1]">{new Date(model.created_at || model.createdAt).toLocaleDateString()}</span>
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

