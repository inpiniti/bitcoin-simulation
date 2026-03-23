import { useState, useEffect, useMemo, useRef } from "react"
import { useStore } from "@/store/useStore"
import { useShallow } from "zustand/react/shallow"
import { fetchStockHistory } from "@/lib/api"
import { processStockDataForPrediction } from "@/lib/mlProcessor"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Brain, Activity, Save, Database } from "lucide-react"
import { DLServerTrainingTab } from "@/components/dl/DLServerTrainingTab"
import { DLPredictionTab } from "@/components/dl/DLPredictionTab"
import { DLModelsTab } from "@/components/dl/DLModelsTab"



export function DeepLearningPanel() {
    const { tickerGroup, setTickerGroup, fetchGroupStocks, groupStocks } = useStore(useShallow(state => ({
        tickerGroup: state.tickerGroup,
        setTickerGroup: state.setTickerGroup,
        fetchGroupStocks: state.fetchGroupStocks,
        groupStocks: state.groupStocks,
    })))

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

    // 서버 사이드 학습 상태 (WebSocket)
    const [serverTraining, setServerTraining] = useState(false)
    const [serverCollectProgress, setServerCollectProgress] = useState(0)
    const [serverTrainProgress, setServerTrainProgress] = useState(0)
    const [serverTrainResult, setServerTrainResult] = useState(null)
    const [serverTrainError, setServerTrainError] = useState(null)
    const wsRef = useRef(null)

    // 재접속 시 서버 진행 상태 복원 (폴링)
    const pollRef = useRef(null)
    useEffect(() => {
        const abortController = new AbortController()

        const checkStatus = async () => {
            try {
                const res = await fetch('/api/xgb/train-status', { signal: abortController.signal })
                if (!res.ok) { clearInterval(pollRef.current); return }
                const job = await res.json()

                if (job.status === 'collecting') {
                    setServerTraining(true)
                    setServerCollectProgress(job.collect_progress ?? 0)
                    setServerTrainProgress(0)
                } else if (job.status === 'training') {
                    setServerTraining(true)
                    setServerCollectProgress(100)
                    setServerTrainProgress(job.train_progress ?? 10)
                } else if (job.status === 'complete' && job.result) {
                    setServerTraining(false)
                    setServerCollectProgress(100)
                    setServerTrainProgress(100)
                    setServerTrainResult(job.result)
                    fetchModelsFromSupabase()
                    clearInterval(pollRef.current)
                } else if (job.status === 'error') {
                    setServerTraining(false)
                    setServerTrainError(job.error)
                    clearInterval(pollRef.current)
                } else {
                    // idle — 진행 중인 작업 없음
                    clearInterval(pollRef.current)
                }
            } catch (e) {
                if (e?.name !== 'AbortError') {
                    // AbortError는 언마운트 시 정상 취소이므로 무시
                }
            }
        }

        // 마운트 시 즉시 한 번 확인 (폴링은 serverTraining 변경 시 아래 useEffect가 처리)
        checkStatus()

        return () => {
            abortController.abort()
            clearInterval(pollRef.current)
        }
    }, [])

    // serverTraining 변경 시 폴링 시작/중지
    useEffect(() => {
        clearInterval(pollRef.current)
        if (!serverTraining) return

        const abortController = new AbortController()

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch('/api/xgb/train-status', { signal: abortController.signal })
                if (!res.ok) { clearInterval(pollRef.current); return }
                const job = await res.json()

                if (job.status === 'collecting') {
                    setServerCollectProgress(job.collect_progress ?? 0)
                } else if (job.status === 'training') {
                    setServerCollectProgress(100)
                    setServerTrainProgress(job.train_progress ?? 10)
                } else if (job.status === 'complete' && job.result) {
                    setServerTraining(false)
                    setServerCollectProgress(100)
                    setServerTrainProgress(100)
                    setServerTrainResult(job.result)
                    fetchModelsFromSupabase()
                    clearInterval(pollRef.current)
                } else if (job.status === 'error') {
                    setServerTraining(false)
                    setServerTrainError(job.error)
                    clearInterval(pollRef.current)
                }
            } catch (e) {
                if (e?.name !== 'AbortError') {
                    // AbortError는 언마운트 시 정상 취소이므로 무시
                }
            }
        }, 5000)

        return () => {
            abortController.abort()
            clearInterval(pollRef.current)
        }
    }, [serverTraining])

    // 컴포넌트 언마운트 시 WebSocket 정리
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [])

    // 학습 상태
    const [trainMode, setTrainMode] = useState("single") // "single" | "group"
    const [trainTicker, setTrainTicker] = useState("AAPL")
    const [trainPeriod, setTrainPeriod] = useState("365") // "30" | "365" | "1825" | "max"
    const [modelName, setModelName] = useState("")

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
    }, [trainMode, predTargetType, tickerGroup, fetchGroupStocks])


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

        // HuggingFace 백엔드에 직접 WebSocket 연결 (Vercel 프록시 미경유)
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://younginpiniti-bitcoin-ai-backend.hf.space'
        const wsUrl = backendUrl.replace(/^https/, 'wss').replace(/^http/, 'ws') + '/ws/train'
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
            setServerTraining(prev => prev ? false : prev)
        }
    }

    // 학습 결과 초기화 핸들러
    const handleResetTrainResult = () => {
        setServerTrainResult(null)
        setServerCollectProgress(0)
        setServerTrainProgress(0)
        setServerTrainError(null)
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
                <TabsContent value="train">
                    <DLServerTrainingTab
                        trainMode={trainMode}
                        setTrainMode={setTrainMode}
                        trainTicker={trainTicker}
                        setTrainTicker={setTrainTicker}
                        tickerGroup={tickerGroup}
                        setTickerGroup={setTickerGroup}
                        trainPeriod={trainPeriod}
                        setTrainPeriod={setTrainPeriod}
                        modelName={modelName}
                        setModelName={setModelName}
                        serverTraining={serverTraining}
                        serverCollectProgress={serverCollectProgress}
                        serverTrainProgress={serverTrainProgress}
                        serverTrainResult={serverTrainResult}
                        serverTrainError={serverTrainError}
                        onStartTrain={handleServerTrain}
                        onResetResult={handleResetTrainResult}
                        wsRef={wsRef}
                    />
                </TabsContent>

                {/* 예측 탭 */}
                <TabsContent value="predict">
                    <DLPredictionTab
                        serverModels={serverModels}
                        selectedModelId={selectedModelId}
                        setSelectedModelId={setSelectedModelId}
                        predTargetType={predTargetType}
                        setPredTargetType={setPredTargetType}
                        predTicker={predTicker}
                        setPredTicker={setPredTicker}
                        tickerGroup={tickerGroup}
                        setTickerGroup={setTickerGroup}
                        groupStocks={groupStocks}
                        predAllTime={predAllTime}
                        setPredAllTime={setPredAllTime}
                        predicting={predicting}
                        predResult={predResult}
                        allPredResults={allPredResults}
                        buyThreshold={buyThreshold}
                        setBuyThreshold={setBuyThreshold}
                        sellThreshold={sellThreshold}
                        setSellThreshold={setSellThreshold}
                        optimalRange={optimalRange}
                        currentRangeStats={currentRangeStats}
                        onPredict={handlePredict}
                    />
                </TabsContent>

                {/* 모델 관리 탭 */}
                <TabsContent value="models">
                    <DLModelsTab
                        serverModels={serverModels}
                        loadingModels={loadingModels}
                        onDeleteModel={handleDeleteModel}
                        onRefresh={fetchModelsFromSupabase}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
