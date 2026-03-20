import { useState, useEffect, useMemo, useRef } from "react"
import { useStore } from "@/store/useStore"
import { fetchStockHistory } from "@/lib/api"
import { processStockDataForML, processStockDataForPrediction } from "@/lib/mlProcessor"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Brain, Activity, Save, Play, CheckCircle, Database, BarChart2, Loader2, AlertCircle, TrendingUp, TrendingDown, Target, Zap } from "lucide-react"



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
    const [trainPeriod, setTrainPeriod] = useState("365") // "30" | "365" | "1825" | "max"
    const [trainData, setTrainData] = useState(null)
    const [training, setTraining] = useState(false)
    const [trainProgress, setTrainProgress] = useState(0)
    const [trainResult, setTrainResult] = useState(null)
    const [modelName, setModelName] = useState("")

    // 서버 사이드 학습 상태 (WebSocket)
    const [serverTraining, setServerTraining] = useState(false)
    const [serverCollectProgress, setServerCollectProgress] = useState(0)
    const [serverTrainProgress, setServerTrainProgress] = useState(0)
    const [serverTrainResult, setServerTrainResult] = useState(null)
    const [serverTrainError, setServerTrainError] = useState(null)
    const wsRef = useRef(null)

    // 예측 상태
    const [predTicker, setPredTicker] = useState("BTC-USD")
    const [selectedModelId, setSelectedModelId] = useState("")
    const [predicting, setPredicting] = useState(false)
    const [predResult, setPredResult] = useState(null)
    const [allPredResults, setAllPredResults] = useState([]) // 전체 백테스팅 결과
    const [predTargetType, setPredTargetType] = useState("single") // "single" | "group"
    const [predAllTime, setPredAllTime] = useState(false) // 전체 기간 예측 여부

    // 매수/매도 범위 설정 (슬라이더용)
    const [buyThreshold, setBuyThreshold] = useState(50) // 이 확률 이상이면 매수
    const [sellThreshold, setSellThreshold] = useState(50) // 이 확률 미만이면 매도

    // 자동 최적 범위 계산
    const optimalRange = useMemo(() => {
        // 유효한 결과만 필터링 (actual이 존재하는 것)
        const validResults = allPredResults.filter(r => r.actual !== null && r.actual !== undefined)

        // 디버깅용 로그
        console.log(`[OptimalRange] Total: ${allPredResults.length}, Valid (with actual): ${validResults.length}`)

        // 데이터가 없으면 null
        if (validResults.length === 0) return null

        // 다양한 임계값 조합 테스트 (더 넓은 범위)
        let bestResult = null
        let bestScore = -Infinity

        for (let bt = 50; bt <= 95; bt += 1) {
            for (let st = 5; st <= 50; st += 1) {
                // 매수 범위: bt% 이상
                const buyResults = validResults.filter(r => r.probability * 100 >= bt)
                const buyCount = buyResults.length

                // 매도 범위: st% 미만
                const sellResults = validResults.filter(r => r.probability * 100 < st)
                const sellCount = sellResults.length

                // 최소 1건 이상 있어야 평균 계산 가능
                if (buyCount === 0 || sellCount === 0) continue

                const buySum = buyResults.reduce((sum, r) => sum + r.actual, 0)
                const sellSum = sellResults.reduce((sum, r) => sum + r.actual, 0)
                const buyAvg = buySum / buyCount
                const sellAvg = sellSum / sellCount

                // 점수: 매수 평균 - 매도 평균 (매수는 높을수록, 매도는 낮을수록 좋음)
                // 샘플 수에 따른 신뢰도 가중치 (로그 스케일)
                const sampleWeight = Math.log10(Math.min(buyCount, sellCount) + 1)
                const score = (buyAvg - sellAvg) * sampleWeight

                if (score > bestScore) {
                    bestScore = score
                    bestResult = {
                        buyThreshold: bt,
                        sellThreshold: st,
                        buySum,
                        sellSum,
                        buyCount,
                        sellCount,
                        buyAvg,
                        sellAvg,
                        score
                    }
                }
            }
        }

        // 결과가 없으면 기본값 제공 (50/50 기준)
        if (!bestResult) {
            const buyResults = validResults.filter(r => r.probability >= 0.5)
            const sellResults = validResults.filter(r => r.probability < 0.5)
            const buyCount = buyResults.length || 1
            const sellCount = sellResults.length || 1
            const buySum = buyResults.reduce((sum, r) => sum + r.actual, 0)
            const sellSum = sellResults.reduce((sum, r) => sum + r.actual, 0)

            bestResult = {
                buyThreshold: 50,
                sellThreshold: 50,
                buySum,
                sellSum,
                buyCount,
                sellCount,
                buyAvg: buySum / buyCount,
                sellAvg: sellSum / sellCount,
                score: 0
            }
        }

        return bestResult
    }, [allPredResults])


    // 현재 슬라이더 설정에 따른 합산 계산
    const currentRangeStats = useMemo(() => {
        const validResults = allPredResults.filter(r => r.actual !== null)
        if (validResults.length === 0) return null

        const buyResults = validResults.filter(r => r.probability * 100 >= buyThreshold)
        const sellResults = validResults.filter(r => r.probability * 100 < sellThreshold)

        return {
            buySum: buyResults.reduce((sum, r) => sum + r.actual, 0),
            buyCount: buyResults.length,
            buyAvg: buyResults.length > 0 ? buyResults.reduce((sum, r) => sum + r.actual, 0) / buyResults.length : 0,
            sellSum: sellResults.reduce((sum, r) => sum + r.actual, 0),
            sellCount: sellResults.length,
            sellAvg: sellResults.length > 0 ? sellResults.reduce((sum, r) => sum + r.actual, 0) / sellResults.length : 0
        }
    }, [allPredResults, buyThreshold, sellThreshold])

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
                const days = trainPeriod === 'max' ? 'max' : parseInt(trainPeriod)
                const candles = await fetchStockHistory(trainTicker, days)
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
                            const days = trainPeriod === 'max' ? 'max' : parseInt(trainPeriod)
                            const candles = await fetchStockHistory(stock.ticker, days)
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

            // 데이터 요약 로그 출력
            console.log(`[DeepLearning] Data collection complete.`);
            console.log(`- Mode: ${trainMode}`);
            console.log(`- Target: ${trainMode === 'single' ? trainTicker : tickerGroup}`);
            console.log(`- Samples: ${allFeatures.length}`);
            console.log(`- Period: ${trainPeriod === 'max' ? 'Full History (Stablized Max)' : trainPeriod + ' days'}`);

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
            // 0. 데이터 샘플링 (브라우저 메모리 및 전송 제한 대응)
            // 2,600만 건 등 초대형 데이터는 브라우저에서 JSON으로 변환할 수 없습니다 (Invalid string length)
            const MAX_SAMPLES = 1000000; // 최대 100만 건으로 제한 (메모리 및 서버 부하 고려)
            let finalFeatures = trainData.features;
            let finalLabels = trainData.labels;

            if (trainData.features.length > MAX_SAMPLES) {
                console.log(`[XGB] Data too large (${trainData.features.length.toLocaleString()}). Sampling to ${MAX_SAMPLES.toLocaleString()} items...`);

                const sampledFeatures = [];
                const sampledLabels = [];
                const step = Math.floor(trainData.features.length / MAX_SAMPLES);

                // 데이터의 대표성을 위해 균등 간격으로 샘플링
                for (let i = 0; i < trainData.features.length && sampledFeatures.length < MAX_SAMPLES; i += step) {
                    sampledFeatures.push(trainData.features[i]);
                    sampledLabels.push(trainData.labels[i]);
                }

                finalFeatures = sampledFeatures;
                finalLabels = sampledLabels;
                console.log(`[XGB] Sampling complete: ${finalFeatures.length.toLocaleString()} samples remaining.`);
            }

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
                    features: finalFeatures,
                    labels: finalLabels
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
                            const rawFeatures = processed.rawFeatures || [processed.rawFeature]
                            const actuals = processed.actuals || [processed.actual]

                            features.forEach((feat, idx) => {
                                allFeatures.push(feat)
                                metadataList.push({
                                    ticker,
                                    date: dates[idx],
                                    rawFeature: rawFeatures[idx], // 개별 feature 값
                                    actual: actuals[idx] // 실제 다음날 변동률
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
                    features: allFeatures,
                    labels: [] // 예측용이라 레이블 없음
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

                if (!uploadRes.ok) {
                    const errorBody = await uploadRes.text()
                    console.error("Supabase Upload Error:", errorBody)
                    throw new Error(`데이터 업로드 실패: ${errorBody}`)
                }
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

            // 전체 결과 저장 (테이블 표시용)
            setAllPredResults(finalResults)

            // 첫 번째 결과는 요약 카드에 표시
            setPredResult(finalResults[0])

            console.log(`[Prediction] ${finalResults.length}건 예측 완료`)

        } catch (e) {
            console.error(e)
            alert("예측 실패: " + e.message)
        } finally {
            setPredicting(false)
        }
    }

    // 서버 사이드 학습 (WebSocket)
    const handleServerTrain = () => {
        if (serverTraining) return

        const identifier = trainMode === 'single' ? trainTicker : tickerGroup.toUpperCase()
        const autoModelName = modelName || `XGB_${identifier}_${new Date().toISOString().slice(0, 10)}`
        if (!modelName) setModelName(autoModelName)

        setServerTraining(true)
        setServerCollectProgress(0)
        setServerTrainProgress(0)
        setServerTrainResult(null)
        setServerTrainError(null)

        // WebSocket 연결 (vite proxy: /api/ws → backend /ws)
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/train`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            ws.send(JSON.stringify({
                group: trainMode === 'group' ? tickerGroup : undefined,
                ticker: trainMode === 'single' ? trainTicker : undefined,
                period: trainPeriod === 'max' ? 3650 : parseInt(trainPeriod),
                modelName: autoModelName,
            }))
        }

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                if (msg.type === 'collection') {
                    setServerCollectProgress(msg.progress)
                } else if (msg.type === 'training') {
                    setServerTrainProgress(msg.progress)
                } else if (msg.type === 'complete') {
                    setServerCollectProgress(100)
                    setServerTrainProgress(100)
                    setServerTrainResult(msg.result)
                    setServerTraining(false)
                    fetchModelsFromSupabase()
                } else if (msg.type === 'error') {
                    setServerTrainError(msg.message)
                    setServerTraining(false)
                }
            } catch (e) {
                console.error('[WS] 메시지 파싱 실패:', e)
            }
        }

        ws.onerror = (err) => {
            console.error('[WS] 연결 오류:', err)
            setServerTrainError('WebSocket 연결 오류가 발생했습니다.')
            setServerTraining(false)
        }

        ws.onclose = () => {
            if (serverTraining) {
                setServerTraining(false)
            }
        }
    }

    const handleCancelServerTrain = () => {
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        setServerTraining(false)
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
                            <Tabs value={trainMode} onValueChange={v => { setTrainMode(v); setServerTrainResult(null); setServerTrainError(null); }} className="w-full">
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

                                    {/* 학습 기간 */}
                                    <div className="space-y-2">
                                        <label className="text-xs text-[#888888]">학습 데이터 기간</label>
                                        <select
                                            className="w-full bg-[#252526] border border-[#3c3c3c] rounded p-2 text-sm"
                                            value={trainPeriod}
                                            onChange={e => setTrainPeriod(e.target.value)}
                                            disabled={serverTraining}
                                        >
                                            <option value="30">1개월 (~30일)</option>
                                            <option value="365">1년 (~365일)</option>
                                            <option value="1825">5년 (~1,825일)</option>
                                            <option value="max">MAX (전체 기간)</option>
                                        </select>
                                        <div className="text-xs text-[#888888]">
                                            {trainPeriod === '30' && '최근 1개월 데이터로 학습합니다.'}
                                            {trainPeriod === '365' && '최근 1년 데이터로 학습합니다. (기본값)'}
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
                                        <Button
                                            onClick={handleCancelServerTrain}
                                            variant="outline"
                                            className="w-full border-red-800 text-red-400 hover:bg-red-900/20"
                                        >
                                            취소
                                        </Button>
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
                                    onClick={handleServerTrain}
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
                                    onClick={() => { setServerTrainResult(null); setServerCollectProgress(0); setServerTrainProgress(0); setServerTrainError(null); }}
                                    variant="outline"
                                    className="w-full border-[#3c3c3c]"
                                >
                                    새로운 학습 시작하기
                                </Button>
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
                                                <th className="p-2 text-[#888888] text-right">30일%</th>
                                                <th className="p-2 text-[#888888] text-right">7일%</th>
                                                <th className="p-2 text-[#888888] text-right">1일%</th>
                                                <th className="p-2 text-[#888888] text-right">예측확률</th>
                                                <th className="p-2 text-[#888888] text-right">실제변동</th>
                                                <th className="p-2 text-[#888888] text-center">적중</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allPredResults.slice(0, 500).map((r, idx) => {
                                                const isHit = r.actual !== null && (
                                                    (r.prediction === 1 && r.actual >= 2) ||
                                                    (r.prediction === 0 && r.actual < 2)
                                                )
                                                return (
                                                    <tr key={idx} className="border-b border-[#2c2c2c] hover:bg-[#2a2a2a]">
                                                        <td className="p-2 text-[#e1e1e1]">{new Date(r.date).toLocaleDateString()}</td>
                                                        <td className="p-2 font-mono text-[#007acc]">{r.ticker}</td>
                                                        <td className={`p-2 text-center ${r.rawFeature?.consecutiveDays > 0 ? 'text-green-400' : r.rawFeature?.consecutiveDays < 0 ? 'text-red-400' : ''}`}>
                                                            {r.rawFeature?.consecutiveDays || 0}
                                                        </td>
                                                        <td className={`p-2 text-right ${r.rawFeature?.change30d > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {r.rawFeature?.change30d?.toFixed(1) || '0.0'}%
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
                                                        <td className={`p-2 text-right font-bold ${r.actual >= 2 ? 'text-green-400' : r.actual !== null ? 'text-red-400' : 'text-[#666]'}`}>
                                                            {r.actual !== null ? `${r.actual >= 0 ? '+' : ''}${r.actual.toFixed(1)}%` : '-'}
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            {r.actual !== null ? (
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

