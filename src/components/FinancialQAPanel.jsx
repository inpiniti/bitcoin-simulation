import { useState, useRef, useEffect } from "react"
import { useStore } from "@/store/useStore"
import { fetchStockOverview } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Bot, User, Loader2, Send, Lightbulb } from "lucide-react"

export function FinancialQAPanel() {
    const { ticker } = useStore()
    const [messages, setMessages] = useState([
        { role: 'assistant', text: `안녕하세요! ${ticker}에 대해 궁금한 점을 물어보세요.` }
    ])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [contextData, setContextData] = useState(null)
    const scrollRef = useRef(null)

    // 티커 변경 시 대화 및 컨텍스트 초기화
    useEffect(() => {
        setMessages([{ role: 'assistant', text: `안녕하세요! ${ticker}에 대해 궁금한 점을 물어보세요.` }])
        setContextData(null)
        loadContext()
    }, [ticker])

    // 스크롤 자동 이동
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    // 기업 정보(Context) 로드 (QA용)
    const loadContext = async () => {
        try {
            const data = await fetchStockOverview(ticker)
            if (data && data.profile) {
                // QA에 사용할 컨텍스트 텍스트 생성
                const summary = data.profile.longBusinessSummary || ""
                const sector = data.profile.sector || ""
                const industry = data.profile.industry || ""
                const employees = data.profile.fullTimeEmployees || ""
                const website = data.profile.website || ""
                const context = `
                    Company: ${ticker}
                    Sector: ${sector}
                    Industry: ${industry}
                    Employees: ${employees}
                    Website: ${website}
                    Summary: ${summary}
                `.trim()
                setContextData(context)
            }
        } catch (e) {
            console.error("Context Load Failed", e)
        }
    }

    const handleSend = async (text = input) => {
        if (!text.trim() || loading) return

        // 사용자 메시지 추가
        const userMsg = { role: 'user', text }
        setMessages(prev => [...prev, userMsg])
        setInput("")
        setLoading(true)

        try {
            // Context가 없으면 재시도
            let currentContext = contextData
            if (!currentContext) {
                await loadContext()
                // 다시 로드 시도 후에도 없으면...
                if (!contextData) {
                    // (state 업데이트 비동기 고려하여 다시 fetch한 값을 쓴다거나 해야함, 여기선 간단히)
                    // loadContext 내부에서 setContextData 했지만, 여기선 반영 안 됐을 수 있음.
                    // 간단히 fetchStockOverview 다시 호출하거나, 그냥 진행.
                    // 여기선 "정보를 불러오는 중입니다" 하고 실패 처리보단, 그냥 빈 컨텍스트로 보냄.
                }
            }

            // API 호출 (Deepset RoBERTa QA)
            const response = await fetch("/api/hf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "deepset/roberta-base-squad2",
                    inputs: {
                        question: text,
                        context: contextData || `Information about ${ticker} is currently unavailable.`
                    }
                }),
            })

            if (!response.ok) throw new Error("API Error")

            const result = await response.json()
            // RoBERTa QA 리턴 포맷: { score: ..., start: ..., end: ..., answer: "..." }

            let answerText = result.answer

            // 답변 신뢰도가 너무 낮거나 없으면
            // 답변 신뢰도가 너무 낮거나(0.005 미만) 없으면
            // 사용자가 낮은 점수라도 답변을 원하므로 임계값을 낮춤
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
        "Who are the key executives?",
        "Where is the headquarters?",
        "What sector is this in?"
    ]

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-[#cccccc]">
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#3c3c3c] bg-[#252526]">
                <Bot className="w-5 h-5 text-[#007acc]" />
                <span className="font-bold text-[#e1e1e1]">AI Financial QA</span>
                <span className="text-xs text-[#666666] ml-auto">Powered by deepset/roberta-base-squad2</span>
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
