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
        { role: 'assistant', text: `안녕하세요! ${ticker}에 대해 궁금한 점을 한국어나 영어로 물어보세요.` }
    ])

    /** @type {['idle' | 'loading' | 'ready' | 'error', function]} AI 모델 서버 연결 상태 */
    const [aiStatus, setAiStatus] = useState('ready')

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
     * Gemini의 경우 별도의 워밍업이 필요하지 않으므로 ready 상태로 유지합니다.
     */
    const checkAI = async () => {
        setAiStatus('ready')
    }

    // 티커 변경 시 대화 및 컨텍스트 초기화
    useEffect(() => {
        setMessages([{ role: 'assistant', text: `안녕하세요! ${ticker}에 대해 궁금한 점을 한국어나 영어로 물어보세요.` }])
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

                const context = `
                    Company Ticker: ${ticker}
                    Sector: ${sector}
                    Industry: ${industry}
                    Founded: ${founded}
                    Headquarters: ${location}
                    Employees: ${employees}
                    Products: ${products}
                    Official Website: ${website}
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
     * 사용자의 질문을 Gemini API로 전송하고 답변을 받아 메시지 목록에 추가합니다.
     */
    const handleSend = async (text = input) => {
        if (!text.trim() || loading) return

        // 사용자 메시지 추가
        const userMsg = { role: 'user', text }
        setMessages(prev => [...prev, userMsg])
        setInput("")
        setLoading(true)

        try {
            let currentContext = contextData
            if (!currentContext) {
                currentContext = await loadContext()
            }

            // Gemini API 호출 (Vite Proxy 이용)
            const response = await fetch("/api/gemini", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    // model 필드 제거 -> 서버 설정(gemini-pro)을 따름
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    text: `You are a professional financial advisor. Answer the user's question about the following company using the provided context. 
                                    If the question is in Korean, answer in Korean.
                                    Keep the answer concise and informative.
                                    
                                    CONTEXT:
                                    ${currentContext || "No detailed information available for this ticker."}
                                    
                                    USER QUESTION: ${text}`
                                }
                            ]
                        }
                    ]
                }),
            })

            if (!response.ok) throw new Error("API Error")

            const result = await response.json()

            // Gemini 리턴 포맷 처리
            const answerText = result.candidates?.[0]?.content?.parts?.[0]?.text || "시스템 오류로 답변을 생성할 수 없습니다."

            setMessages(prev => [...prev, { role: 'assistant', text: answerText }])

        } catch (e) {
            console.error(e)
            setMessages(prev => [...prev, { role: 'assistant', text: "오류가 발생했습니다. Gemini API 설정을 확인해주세요." }])
        } finally {
            setLoading(false)
        }
    }

    const quickQuestions = [
        "주요 사업 모델은 무엇인가요?",
        "회사가 언제 설립되었나요?",
        "본사는 어디에 위치해 있나요?",
        "주요 제품이나 서비스는 무엇인가요?",
        "공식 웹사이트는 어디인가요?"
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
                    <div className="flex items-center gap-1 text-[10px] text-green-500"><Wifi className="w-3 h-3" /> Ready</div>
                    <span className="text-xs text-[#666666]">Powered by Google Gemini 1.5 Flash</span>
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
                            placeholder="기업에 대해 궁금한 점을 물어보세요 (한글/영어 지원)"
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
                        * AI 답변은 기업 개요 데이터에 기반하며 Google Gemini 1.5 Flash 공식 API를 사용합니다.
                    </p>
                </div>
            </div>
        </div>
    )
}
