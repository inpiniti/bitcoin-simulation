import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { fetchStockNews, getSentimentScore } from '@/lib/api'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Newspaper, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function NewsPanel() {
    const { ticker } = useStore()
    const [news, setNews] = useState([])
    const [sentiment, setSentiment] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!ticker) return

        const load = async () => {
            setLoading(true)
            setError(null)
            setSentiment(null)

            try {
                // 뉴스 가져오기
                const headlines = await fetchStockNews(ticker)
                setNews(headlines)

                // 감정 분석 (뉴스가 있을 경우)
                if (headlines.length > 0) {
                    const score = await getSentimentScore(headlines)
                    setSentiment(score)
                }
            } catch (e) {
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [ticker])

    const getSentimentInfo = (score) => {
        if (score === null) return { label: '-', color: 'text-[#888888]', icon: Minus, bgColor: 'bg-[#3c3c3c]' }
        if (score > 0.3) return { label: 'Bullish', color: 'text-[#4ade80]', icon: TrendingUp, bgColor: 'bg-[#22543d]' }
        if (score < -0.3) return { label: 'Bearish', color: 'text-[#f87171]', icon: TrendingDown, bgColor: 'bg-[#7f1d1d]' }
        return { label: 'Neutral', color: 'text-[#fbbf24]', icon: Minus, bgColor: 'bg-[#78350f]' }
    }

    const sentimentInfo = getSentimentInfo(sentiment)
    const SentimentIcon = sentimentInfo.icon

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-[#888888]">
                <Loader2 className="w-8 h-8 mb-4 animate-spin text-[#007acc]" />
                <p>뉴스 로딩 중...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-[#888888]">
                <Newspaper className="w-12 h-12 mb-4 opacity-50" />
                <p>뉴스를 불러올 수 없습니다.</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-full bg-[#1e1e1e] p-6">
            <div className="max-w-4xl mx-auto space-y-6 pb-12">

                {/* 헤더 섹션 */}
                <div className="flex flex-col gap-2 border-b border-[#3c3c3c] pb-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-[#e1e1e1]">
                            {ticker} <span className="text-[#888888] text-lg font-normal">News</span>
                        </h1>
                    </div>
                </div>

                {/* 감정 분석 카드 */}
                <Card className="bg-[#252526] border-[#3c3c3c]">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-[#cccccc] flex items-center gap-2">
                            <SentimentIcon className="w-4 h-4" />
                            AI Sentiment Analysis (FinBERT)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-6">
                            <div className={`px-6 py-4 rounded-lg ${sentimentInfo.bgColor}`}>
                                <p className={`text-3xl font-bold ${sentimentInfo.color}`}>
                                    {sentiment !== null ? (sentiment > 0 ? '+' : '') + sentiment.toFixed(2) : '-'}
                                </p>
                                <p className={`text-sm mt-1 ${sentimentInfo.color}`}>
                                    {sentimentInfo.label}
                                </p>
                            </div>
                            <div className="text-sm text-[#888888] space-y-1">
                                <p>• Score Range: -1.0 (Bearish) ~ +1.0 (Bullish)</p>
                                <p>• Based on {news.length} recent news headlines</p>
                                <p>• Analyzed using FinBERT (Financial BERT)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 뉴스 목록 */}
                <Card className="bg-[#252526] border-[#3c3c3c]">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-[#cccccc] flex items-center gap-2">
                            <Newspaper className="w-4 h-4" />
                            Recent Headlines
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {news.length === 0 ? (
                            <p className="text-[#888888] text-sm">최근 뉴스가 없습니다.</p>
                        ) : (
                            <div className="space-y-3">
                                {news.map((headline, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3 p-3 rounded-lg bg-[#1e1e1e] hover:bg-[#2d2d2d] transition-colors"
                                    >
                                        <Badge
                                            variant="secondary"
                                            className="bg-[#3c3c3c] text-[#9cdcfe] shrink-0 mt-0.5"
                                        >
                                            {i + 1}
                                        </Badge>
                                        <p className="text-sm text-[#d4d4d4] leading-relaxed">
                                            {headline}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 데이터 소스 안내 */}
                <div className="text-xs text-[#666666] text-center">
                    <p>News data from Yahoo Finance • Sentiment analysis by Hugging Face FinBERT</p>
                </div>
            </div>
        </ScrollArea>
    )
}
