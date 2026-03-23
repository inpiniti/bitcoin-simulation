import { useState, useRef, useEffect, useMemo } from "react"
import { useStore } from "@/store/useStore"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Bot, User, Loader2, Send, Lightbulb, Wifi, Copy, Check } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from "@/lib/utils"
import { processStockDataForPrediction } from "@/lib/mlProcessor"
import { getSupabaseClient } from "@/lib/supabaseClient"

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false)
    const handleCopy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-[#3c3c3c] text-[#666] hover:text-[#007acc] transition-all"
            title="복사하기"
        >
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </button>
    )
}

/** store 데이터로 AI 컨텍스트 문자열 생성 */
function buildMarketContext(ticker, hist1d, simul, selectedResult, autoPredictions = []) {
    const lines = [`[실시간 시장 데이터 - ${ticker}]`]

    // 최근 캔들 데이터 (최근 10개)
    const candles = hist1d?.slice(-10) ?? []
    if (candles.length > 0) {
        const last = candles[candles.length - 1]
        lines.push(`\n■ 현재가 정보 (최근 캔들: ${last.date ?? ''})`)
        lines.push(`  종가: $${last.close?.toFixed(2) ?? '-'}`)
        lines.push(`  시가: $${last.open?.toFixed(2) ?? '-'}`)
        lines.push(`  고가: $${last.high?.toFixed(2) ?? '-'}`)
        lines.push(`  저가: $${last.low?.toFixed(2) ?? '-'}`)
        lines.push(`  거래량: ${last.volume?.toLocaleString() ?? '-'}`)

        // 기술지표
        if (last.rsi !== undefined) lines.push(`  RSI: ${last.rsi?.toFixed(1)}`)
        if (last.ma20 !== undefined) lines.push(`  MA20: $${last.ma20?.toFixed(2)}`)
        if (last.ma50 !== undefined) lines.push(`  MA50: $${last.ma50?.toFixed(2)}`)
        if (last.bbUpper !== undefined) {
            lines.push(`  볼린저밴드: 상단 $${last.bbUpper?.toFixed(2)} / 중간 $${last.bbMean?.toFixed(2)} / 하단 $${last.bbLower?.toFixed(2)}`)
            const bbStatusMap = { 2: '강한 과매수(상단 돌파)', 1: '강세(중간~상단)', 0: '중립', '-1': '약세(중간~하단)', '-2': '강한 과매도(하단 이탈)' }
            lines.push(`  BB 위치: ${bbStatusMap[last.bbStatus] ?? last.bbStatus}`)
        }
        if (last.signal) lines.push(`  전략 시그널: ${last.signal}`)

        // 최근 10일 가격 추이
        lines.push(`\n■ 최근 ${candles.length}일 종가 추이`)
        lines.push(candles.map(c => `  ${c.date}: $${c.close?.toFixed(2)}`).join('\n'))

        // 수익률 계산
        if (candles.length >= 2) {
            const first = candles[0]
            const pct = ((last.close - first.close) / first.close * 100).toFixed(2)
            lines.push(`  → ${candles.length}일 수익률: ${pct}%`)
        }
    }

    // AI 예측 데이터 (최근 시뮬레이션 결과)
    const allResults = Object.values(simul ?? {}).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    const result = selectedResult ?? allResults[0]
    // AI(XGBoost) 결과 우선 탐색
    const aiResult = result?.aiData?.length > 0 ? result
        : allResults.find(r => r?.aiData?.length > 0)

    if (aiResult?.aiData?.length > 0) {
        const recentAi = aiResult.aiData.slice(0, 5)
        lines.push(`\n■ XGBoost AI 예측 데이터 (최근 ${recentAi.length}개)`)
        lines.push(`  ※ 매수 확률 0.6 이상 = 매수 신호, 0.4 이하 = 매도 신호`)
        recentAi.forEach(d => {
            lines.push(`  ${d.date}: 매수확률 ${(d.probability * 100).toFixed(1)}%`)
        })
        const latestProb = recentAi[0]?.probability
        if (latestProb !== undefined) {
            const signal = latestProb >= 0.6 ? '강한 매수 신호' : latestProb >= 0.5 ? '약한 매수 신호' : latestProb >= 0.4 ? '중립' : '매도 신호'
            lines.push(`  → 최신 AI 판단: ${signal} (${(latestProb * 100).toFixed(1)}%)`)
        }
    } else if (autoPredictions.length > 0) {
        const recentAuto = autoPredictions.slice(-5).reverse()
        lines.push(`\n■ XGBoost AI 자동 예측 (SP500 모델 적용, 최근 ${recentAuto.length}개)`)
        lines.push(`  ※ 매수 확률 0.6 이상 = 매수 신호, 0.4 이하 = 매도 신호`)
        recentAuto.forEach(d => {
            lines.push(`  ${d.date}: 매수확률 ${(d.probability * 100).toFixed(1)}%`)
        })
        const latestProb = recentAuto[0]?.probability
        if (latestProb !== undefined) {
            const signal = latestProb >= 0.6 ? '강한 매수 신호' : latestProb >= 0.5 ? '약한 매수 신호' : latestProb >= 0.4 ? '중립' : '매도 신호'
            lines.push(`  → 최신 AI 판단: ${signal} (${(latestProb * 100).toFixed(1)}%)`)
        }
    } else {
        lines.push(`\n■ XGBoost AI 예측 데이터: 없음`)
        lines.push(`  ※ AI 예측 데이터가 없으므로 기술적 지표만으로 분석합니다.`)
    }

    // 시뮬레이션 성과 요약
    const summaryResult = result ?? allResults[0]
    if (summaryResult?.summary) {
        const s = summaryResult.summary
        lines.push(`\n■ 백테스트 시뮬레이션 결과 (${summaryResult.strategyMode ?? '전략'} 모드)`)
        if (s.totalReturn !== undefined) lines.push(`  총 수익률: ${s.totalReturn?.toFixed(2)}%`)
        if (s.winRate !== undefined) lines.push(`  승률: ${(s.winRate * 100)?.toFixed(1)}%`)
        if (s.tradeCount !== undefined) lines.push(`  총 거래 횟수: ${s.tradeCount}회`)
        if (s.maxDrawdown !== undefined) lines.push(`  최대 낙폭(MDD): ${s.maxDrawdown?.toFixed(2)}%`)
    }

    return lines.join('\n')
}

export function FinancialQAPanel() {
    const { ticker, hist, simul, selectedResult, aiModels, fetchAiModels } = useStore()
    const hist1d = hist?.['1d'] ?? []

    const [messages, setMessages] = useState([
        { role: 'assistant', text: `안녕하세요! ${ticker}에 대해 궁금한 점을 물어보세요.\n현재 로드된 차트 데이터와 AI 예측 결과도 함께 활용합니다.` }
    ])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [autoPredictions, setAutoPredictions] = useState([])
    const [autoPredStatus, setAutoPredStatus] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
    const scrollRef = useRef(null)

    // SP500 모델이 있으면 자동 예측 실행 (aiData가 없을 때)
    useEffect(() => {
        const hasAiData = Object.values(simul ?? {}).some(r => r?.aiData?.length > 0)
        if (hasAiData || hist1d.length < 30) return

        const runAutoPrediction = async () => {
            // aiModels 없으면 먼저 로드
            let models = aiModels
            if (!models || models.length === 0) {
                await fetchAiModels()
                models = useStore.getState().aiModels
            }
            const sp500Model = models
                .filter(m => m.name?.includes('SP500') || m.name?.includes('sp500'))
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]

            if (!sp500Model) return

            setAutoPredStatus('loading')
            try {
                const { features, dates } = processStockDataForPrediction(hist1d, true)
                if (features.length === 0) { setAutoPredStatus('error'); return }

                let payload = { modelId: sp500Model.id }
                if (features.length > 50) {
                    const supabase = getSupabaseClient()
                    if (!supabase) { setAutoPredStatus('error'); return }
                    const { data: dsData, error: dsError } = await supabase
                        .from('training_datasets')
                        .insert([{ features, labels: [] }])
                        .select()
                    if (dsError || !dsData?.length) { setAutoPredStatus('error'); return }
                    payload.datasetId = dsData[0].id
                } else {
                    payload.features = features
                }

                const res = await fetch('/api/xgb/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                if (!res.ok) { setAutoPredStatus('error'); return }

                const resultData = await res.json()
                if (!Array.isArray(resultData.predictions)) { setAutoPredStatus('error'); return }

                const predictions = resultData.predictions.map((p, idx) => {
                    let prob = 0
                    if (typeof p === 'number') prob = p
                    else if (Array.isArray(p)) prob = p[1] ?? p[0]
                    else if (p && typeof p === 'object') prob = p.probability ?? p[1] ?? p.prob ?? 0
                    return { probability: prob, date: dates[idx] }
                })
                setAutoPredictions(predictions)
                setAutoPredStatus('done')
            } catch (e) {
                console.error('[AutoPred]', e)
                setAutoPredStatus('error')
            }
        }

        runAutoPrediction()
    }, [ticker, hist1d.length, aiModels, fetchAiModels])

    // 시장 컨텍스트를 메모이제이션
    const marketContext = useMemo(
        () => buildMarketContext(ticker, hist1d, simul, selectedResult, autoPredictions),
        [ticker, hist1d?.length, selectedResult, simul, autoPredictions]
    )

    useEffect(() => {
        setMessages([{
            role: 'assistant',
            text: `안녕하세요! ${ticker}에 대해 궁금한 점을 물어보세요.\n현재 로드된 차트 데이터와 AI 예측 결과도 함께 활용합니다.`
        }])
        setAutoPredictions([])
        setAutoPredStatus('idle')
    }, [ticker])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    const isMarketRelatedQuestion = (text) => {
        // 복합 키워드 (정확한 문자열 매칭)
        const exactPhrases = [
            'ai 예측', 'ai예측', 'xgboost', '딥러닝 모델', 'ai 모델', '예측 모델',
            '매수 타이밍', '매도 타이밍', '이동평균', '볼린저 밴드', '볼린저밴드',
        ]
        // 단독 키워드 (짧아서 오매칭 위험 낮은 것만)
        const singleKeywords = [
            '예측', '매수', '매도', 'rsi', '볼린저', '차트', '지표', '시그널',
            '수익률', '백테스트', '현재가', '기술적', '거래량', '낙폭',
            '과매수', '과매도', 'mdd', 'xgboost', '딥러닝',
            'predict', 'forecast', 'signal', 'indicator', 'technical',
            'bollinger', 'drawdown',
        ]
        const lower = text.toLowerCase()
        if (exactPhrases.some(p => lower.includes(p))) return true
        if (singleKeywords.some(k => lower.includes(k))) return true
        return false
    }

    const handleSend = async (text = input) => {
        if (!text.trim() || loading) return

        setMessages(prev => [...prev, { role: 'user', text }])
        setInput("")
        setLoading(true)
        setMessages(prev => [...prev, { role: 'assistant', text: '', streaming: true }])

        try {
            const hasMarketData = hist1d.length > 0
            const needsMarketContext = hasMarketData && isMarketRelatedQuestion(text)

            const prompt = needsMarketContext
                ? `You are a professional financial advisor and quantitative analyst.
The user is asking about the stock ticker: ${ticker}
If the question is in Korean, answer in Korean.
Use Markdown formatting (bolding, bullet points, or numbered lists) for readability.
Keep the answer concise and data-driven. Reference the actual numbers from the data below.

REAL-TIME MARKET DATA:
${marketContext}

USER QUESTION: ${text}`
                : `You are a knowledgeable AI assistant with expertise in finance, business, and global companies.
If the question is in Korean, answer in Korean.
Use Markdown formatting for readability. Keep the answer concise and informative.

IMPORTANT RULES:
- Answer ONLY based on your training knowledge. Do NOT mention any real-time market data, chart data, RSI, moving averages, AI predictions, or technical indicators.
- Do NOT say you cannot answer due to lack of market data. Just answer the question directly.
- The current ticker context is ${ticker}, use it only if relevant to the question.

USER QUESTION: ${text}`

            const response = await fetch("/api/simple/gemini", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }]
                }),
            })

            if (!response.ok) throw new Error("API Error")

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let streamedText = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                streamedText += decoder.decode(value, { stream: true })
                setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'assistant', text: streamedText, streaming: true }
                    return updated
                })
            }

            setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', text: streamedText }
                return updated
            })

        } catch (e) {
            console.error(e)
            setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', text: "오류가 발생했습니다. Gemini API 설정을 확인해주세요." }
                return updated
            })
        } finally {
            setLoading(false)
        }
    }

    const hasData = hist1d.length > 0
    const hasAiPrediction = selectedResult?.aiData?.length > 0 ||
        Object.values(simul ?? {}).some(r => r?.aiData?.length > 0)

    const quickQuestions = [
        "현재 기술적 지표로 봤을 때 매수 타이밍인가요?",
        "AI 예측 결과를 분석해주세요",
        "최근 가격 추세를 분석해주세요",
        "볼린저밴드와 RSI 기반으로 현황을 분석해주세요",
        "주요 사업 모델은 무엇인가요?",
    ]

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc]">
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#3c3c3c] bg-[#252526]">
                <Bot className="w-5 h-5 text-[#007acc]" />
                <div className="flex flex-col">
                    <span className="font-bold text-[#e1e1e1]">AI Financial QA</span>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    {hasData && (
                        <div className="flex items-center gap-1 text-[10px] text-yellow-500">
                            <span>●</span> 차트데이터 {hist1d.length}일
                        </div>
                    )}
                    {hasAiPrediction && (
                        <div className="flex items-center gap-1 text-[10px] text-purple-400">
                            <span>●</span> AI예측
                        </div>
                    )}
                    {!hasAiPrediction && autoPredStatus === 'loading' && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-400">
                            <Loader2 className="w-3 h-3 animate-spin" /> SP500예측중
                        </div>
                    )}
                    {!hasAiPrediction && autoPredStatus === 'done' && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-400">
                            <span>●</span> SP500모델
                        </div>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-green-500">
                        <Wifi className="w-3 h-3" /> Ready
                    </div>
                    <span className="text-xs text-[#666666]">Powered by Gemini Flash</span>
                </div>
            </div>

            {/* 메시지 영역 */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-3xl mx-auto">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="flex flex-col gap-2 shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-[#007acc]/20 flex items-center justify-center">
                                        <Bot className="w-5 h-5 text-[#007acc]" />
                                    </div>
                                    {!msg.streaming && msg.text && <CopyButton text={msg.text} />}
                                </div>
                            )}
                            <div className={cn(
                                "max-w-[85%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm transition-all",
                                msg.role === 'user'
                                    ? 'bg-[#007acc] text-white rounded-tr-none ml-auto'
                                    : 'bg-[#2d2d2d] text-[#e1e1e1] rounded-tl-none border border-[#3c3c3c]'
                            )}>
                                {msg.role === 'assistant' ? (
                                    msg.text === '' && msg.streaming ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-[#888888]" />
                                    ) : (
                                        <>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-1" {...props} />,
                                                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-1" {...props} />,
                                                    li: ({ node, ...props }) => <li className="marker:text-[#007acc]" {...props} />,
                                                    strong: ({ node, ...props }) => <strong className="font-bold text-[#569cd6]" {...props} />,
                                                    code: ({ node, inline, ...props }) => (
                                                        <code className={cn(
                                                            "bg-[#1e1e1e] px-1 py-0.5 rounded font-mono text-[0.9em]",
                                                            inline ? "text-[#ce9178]" : "block p-2 my-2 overflow-x-auto"
                                                        )} {...props} />
                                                    ),
                                                    hr: ({ node, ...props }) => <hr className="border-[#3c3c3c] my-3" {...props} />,
                                                    blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-[#007acc] pl-3 italic text-[#999] my-2" {...props} />
                                                }}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>
                                            {msg.streaming && (
                                                <span className="inline-block w-[2px] h-[14px] bg-[#007acc] ml-0.5 align-middle animate-pulse" />
                                            )}
                                        </>
                                    )
                                ) : (
                                    <div className="whitespace-pre-wrap">{msg.text}</div>
                                )}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-[#3c3c3c] flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 text-[#cccccc]" />
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* 추천 질문 & 입력 (Footer) */}
            <div className="p-4 bg-[#252526] border-t border-[#3c3c3c]">
                <div className="max-w-3xl mx-auto space-y-3">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {quickQuestions.map((q, i) => (
                            <button
                                key={i}
                                disabled={loading}
                                onClick={() => handleSend(q)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#3c3c3c] hover:bg-[#4c4c4c] border border-[#555555] text-xs text-[#cccccc] whitespace-nowrap transition-colors disabled:opacity-50"
                            >
                                <Lightbulb className="w-3 h-3 text-yellow-500" />
                                {q}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder="무엇이든 물어보세요 — 예측/차트 질문은 데이터 기반, 일반 질문은 AI 직접 답변"
                            className="bg-[#1e1e1e] border-[#3c3c3c] text-[#cccccc] focus:ring-[#007acc]"
                            disabled={loading}
                        />
                        <Button
                            onClick={() => handleSend()}
                            disabled={loading || !input.trim()}
                            className="bg-[#007acc] hover:bg-[#0063a5]"
                            size="icon"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    </div>
                    <p className="text-[10px] text-[#666666] text-center">
                        * 예측·차트·지표 관련 질문은 로드된 데이터 기반으로, 그 외 일반 질문은 Gemini가 직접 답변합니다.
                    </p>
                </div>
            </div>
        </div>
    )
}
