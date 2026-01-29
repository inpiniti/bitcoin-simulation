import { useState, useRef, useEffect } from "react"
import { useStore } from "@/store/useStore"
import { fetchStockOverview, warmupAIModel } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Bot, User, Loader2, Send, Lightbulb, Wifi, WifiOff } from "lucide-react"

/**
 * AI 기반 금융 Q&A 패널 컴포넌트
 * Wikipedia 및 Yahoo Finance에서 수집된 기업 정보를 바탕으로 사용자의 질문에 답변합니다.
 * 
 * @component
 * @returns {JSX.Element} FinancialQAPanel 컴포넌트
 */
export function FinancialQAPanel() {
    const { ticker } = useStore()

    /** @type {[Array<{role: string, text: string, score?: number}>, function]} 대화 메시지 목록 */
    const [messages, setMessages] = useState([
        { role: 'assistant', text: `안녕하세요! ${ticker}에 대해 궁금한 점을 물어보세요.` }
    ])

    /** @type {['idle' | 'loading' | 'ready' | 'error', function]} AI 모델 서버 연결 상태 */
    const [aiStatus, setAiStatus] = useState('idle')

    /** @type {[string, function]} AI 모델 로딩 시 출력할 상태 메시지 */
    const [aiStatusMessage, setAiStatusMessage] = useState("")

    /** @type {[string, function]} 사용자 입력 텍스트 */
    const [input, setInput] = useState("")

    /** @type {[boolean, function]} 답변 생성 중 여부 */
    const [loading, setLoading] = useState(false)

    /** @type {[string | null, function]} AI에게 전달할 기업 정보 컨텍스트 */
    const [contextData, setContextData] = useState(null)

    const scrollRef = useRef(null)

    /**
     * AI 모델 서버의 워밍업 상태를 주기적으로 확인합니다.
     * 모델이 로딩 중(503)일 경우 재시도하며 상태 메시지를 업데이트합니다.
     */
    const checkAI = async () => {
        setAiStatus('loading')

        const result = await warmupAIModel("deepset/roberta-base-squad2")
        if (result.status === 'loading') {
            setAiStatus('loading')
            const estimated = result.estimated_time ? ` (예상 대기: ${Math.round(result.estimated_time)}초)` : ""
            setAiStatusMessage(`AI 모델을 깨우는 중입니다${estimated}...`)

            // 모델이 로딩 중이면 5초 후 재시도
            setTimeout(checkAI, 5000)
        } else if (result.status === 'ready') {
            setAiStatus('ready')
            setAiStatusMessage("")
        } else {
            setAiStatus('error')
            setAiStatusMessage("AI 서버 연결에 문제가 있습니다.")
        }
    }

    // 티커 변경 시 대화 및 컨텍스트 초기화
    useEffect(() => {
        setMessages([{ role: 'assistant', text: `안녕하세요! ${ticker}에 대해 궁금한 점을 물어보세요.` }])
        setContextData(null)
        loadContext()
        checkAI()
    }, [ticker])

    // 스크롤 자동 이동
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    /**
     * 현재 선택된 티커의 기업 개요 및 주요 정보를 수집하여 자연어 형태의 컨텍스트를 생성합니다.
     * 
     * @async
     * @returns {Promise<string|null>} 생성된 컨텍스트 문자열
     */
    const loadContext = async () => {
        try {
            const data = await fetchStockOverview(ticker)
            if (data && data.profile) {
                const p = data.profile
                const summary = p.longBusinessSummary || ""
                const sector = p.sector || ""
                const industry = p.industry || ""
                const employees = p.fullTimeEmployees && p.fullTimeEmployees !== '-' ? p.fullTimeEmployees : "unknown number of"
                const website = p.website || ""
                const location = p.headquarters && p.headquarters !== '-' ? p.headquarters : (p.city ? `${p.city}, ${p.country}` : "Global")
                const founded = p.founded && p.founded !== '-' ? `It was founded in ${p.founded}.` : ""
                const products = p.products && p.products !== '-' ? `The company's products include ${p.products}.` : ""

                // 자연어 모델이 이해하기 쉬운 상세 문장형 컨텍스트로 변경
                const context = `
                    The company ticker is ${ticker}. 
                    It operates in the ${sector} sector and ${industry} industry. 
                    ${founded}
                    The company is headquartered in ${location}. 
                    The total number of employees is ${employees}. 
                    ${products}
                    The official website is ${website}. 
                    Business Summary: ${summary}
                `.trim()
                setContextData(context)
                return context
            }
        } catch (e) {
            console.error("Context Load Failed", e)
        }
        return null
    }

    /**
     * 사용자의 질문을 서버로 전송하고 AI 답변을 받아 메시지 목록에 추가합니다.
     * 한글 질문 시 영어 질문 권유 메시지를 리턴하며, AI 서버가 503일 경우 재시도를 안내합니다.
     * 
     * @async
     * @param {string} [text=input] 전송할 질문 텍스트
     */
    const handleSend = async (text = input) => {
        if (!text.trim() || loading) return

        // 사용자 메시지 추가
        const userMsg = { role: 'user', text }
        setMessages(prev => [...prev, userMsg])
        setInput("")

        // 한글 포함 여부 체크 (QA 모델은 영어 특화이므로)
        const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)
        if (hasKorean) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: "죄송합니다. 현재 AI 데이터는 영어로만 학습되어 있어, 원활한 답변을 위해 영어로 질문해 주시기를 부탁드립니다. (예: Who is the CEO?)"
            }])
            return
        }

        setLoading(true)

        try {
            // Context가 없으면 로드하고, 로드된 값을 직접 변수에 할당 (stale state 방지)
            let currentContext = contextData
            if (!currentContext) {
                currentContext = await loadContext()
            }

            // API 호출 (Deepset RoBERTa QA)
            const response = await fetch("/api/hf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "deepset/roberta-base-squad2",
                    inputs: {
                        question: text,
                        context: currentContext || `Information about ${ticker} is currently unavailable.`
                    },
                    options: {
                        wait_for_model: true
                    }
                }),
            })

            // 만약 여기서도 503이 나오면 (워밍업 중일 때 질문한 경우)
            if (response.status === 503) {
                setMessages(prev => [...prev, { role: 'assistant', text: "AI 모델이 현재 로딩 중입니다. 서버가 깨어나는 데 약 20~40초가 소요될 수 있습니다. 잠시 후 질문을 다시 보내주세요." }])
                // 워밍업 다시 체크
                checkAI()
                return
            }

            if (!response.ok) throw new Error("API Error")

            const result = await response.json()
            // RoBERTa QA 리턴 포맷: { score: ..., start: ..., end: ..., answer: "..." }

            let answerText = result.answer

            // 답변 신뢰도가 너무 낮거나 없으면
            if (!answerText || result.score < 0.005) {
                answerText = "수집된 데이터(Wikipedia/Yahoo) 내에서 답변을 찾을 수 없습니다."
            }

            setMessages(prev => [...prev, { role: 'assistant', text: answerText, score: result.score }])

        } catch (e) {
            console.error(e)
            setMessages(prev => [...prev, { role: 'assistant', text: "오류가 발생했습니다. 잠시 후 다시 시도해주세요." }])
        } finally {
            setLoading(false)
        }
    }

    const quickQuestions = [
        "What is the main business?",
        "When was the company founded?",
        "Where is the headquarters located?",
        "What products or services do they provide?",
        "What is the official website?"
    ]

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc]">
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#3c3c3c] bg-[#252526]">
                <Bot className="w-5 h-5 text-[#007acc]" />
                <div className="flex flex-col">
                    <span className="font-bold text-[#e1e1e1]">AI Financial QA</span>
                    {aiStatusMessage && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Loader2 className="w-2.5 h-2.5 animate-spin text-[#007acc]" />
                            <span className="text-[10px] text-[#007acc] animate-pulse">{aiStatusMessage}</span>
                        </div>
                    )}
                </div>
                <div className="ml-auto flex items-center gap-3">
                    {aiStatus === 'ready' && <div className="flex items-center gap-1 text-[10px] text-green-500"><Wifi className="w-3 h-3" /> Ready</div>}
                    {aiStatus === 'error' && <div className="flex items-center gap-1 text-[10px] text-red-500"><WifiOff className="w-3 h-3" /> Offline</div>}
                    <span className="text-xs text-[#666666]">Powered by deepset/roberta-base-squad2</span>
                </div>
            </div>

            {/* 메시지 영역 */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-3xl mx-auto">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-[#007acc]/20 flex items-center justify-center shrink-0">
                                    <Bot className="w-5 h-5 text-[#007acc]" />
                                </div>
                            )}
                            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-[#007acc] text-white rounded-tr-none'
                                : 'bg-[#2d2d2d] text-[#e1e1e1] rounded-tl-none border border-[#3c3c3c]'
                                }`}>
                                {msg.text}
                                {msg.score && (
                                    <div className="mt-1 text-[10px] text-[#888888] flex justify-end">
                                        Confidence: {(msg.score * 100).toFixed(1)}%
                                    </div>
                                )}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-[#3c3c3c] flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 text-[#cccccc]" />
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#007acc]/20 flex items-center justify-center shrink-0">
                                <Bot className="w-5 h-5 text-[#007acc]" />
                            </div>
                            <div className="bg-[#2d2d2d] px-4 py-3 rounded-2xl rounded-tl-none border border-[#3c3c3c]">
                                <Loader2 className="w-4 h-4 animate-spin text-[#888888]" />
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* 추천 질문 & 입력 (Footer) */}
            <div className="p-4 bg-[#252526] border-t border-[#3c3c3c]">
                <div className="max-w-3xl mx-auto space-y-3">
                    {/* 추천 질문 */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {quickQuestions.map((q, i) => (
                            <button
                                key={i}
                                disabled={loading}
                                onClick={() => handleSend(q)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#3c3c3c] hover:bg-[#4c4c4c] border border-[#555555] text-xs text-[#cccccc] whitespace-nowrap transition-colors"
                            >
                                <Lightbulb className="w-3 h-3 text-yellow-500" />
                                {q}
                            </button>
                        ))}
                    </div>

                    {/* 입력창 */}
                    <div className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder="기업에 대해 궁금한 점을 영어로 질문하세요 (예: Who is the CEO?)"
                            className="bg-[#1e1e1e] border-[#3c3c3c] text-[#cccccc] focus:ring-[#007acc]"
                            disabled={loading}
                        />
                        <Button
                            onClick={() => handleSend()}
                            disabled={loading || !input.trim()}
                            className="bg-[#007acc] hover:bg-[#0063a5]"
                            size="icon"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                    <p className="text-[10px] text-[#666666] text-center">
                        * AI 답변은 기업 개요(Wikipedia/Yahoo) 데이터에 기반하며 부정확할 수 있습니다. QA 모델 특성상 영어 질문이 권장됩니다.
                    </p>
                </div>
            </div>
        </div>
    )
}
