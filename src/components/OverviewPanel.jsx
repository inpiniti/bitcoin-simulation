import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { fetchStockOverview, fetchStockNews, getSentimentScore, fetchWhaleAnalysis } from '@/lib/api'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Globe, Building2, TrendingUp, TrendingDown, Minus, Users, DollarSign, Brain } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function OverviewPanel() {
    const { ticker } = useStore()
    const [data, setData] = useState(null)
    const [sentiment, setSentiment] = useState(null)
    const [whaleData, setWhaleData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!ticker) return

        const load = async () => {
            setLoading(true)
            setError(null)
            setSentiment(null)
            setWhaleData(null)

            try {
                // 병렬로 데이터 요청
                const [result, newsHeadlines, whaleResult] = await Promise.all([
                    fetchStockOverview(ticker),
                    fetchStockNews(ticker),
                    fetchWhaleAnalysis(ticker)
                ])

                if (result) {
                    setData(result)
                } else {
                    setError('데이터를 불러올 수 없습니다.')
                }

                if (whaleResult) {
                    setWhaleData(whaleResult)
                }

                // 감정 분석 (백그라운드)
                if (newsHeadlines && newsHeadlines.length > 0) {
                    const score = await getSentimentScore(newsHeadlines)
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-[#888888]">
                <Loader2 className="w-8 h-8 mb-4 animate-spin text-[#007acc]" />
                <p>기업 정보 로딩 중...</p>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-[#888888]">
                <Building2 className="w-12 h-12 mb-4 opacity-50" />
                <p>{error || '기업 정보를 찾을 수 없습니다.'}</p>
            </div>
        )
    }

    const { profile, financials, stats, recommendation, earnings } = data

    // 포맷팅 헬퍼
    const fmtNum = (num, unit = '') => {
        if (!num || !num.fmt) return '-'
        return num.fmt + unit
    }

    return (
        <ScrollArea className="h-full bg-[#1e1e1e] p-6">
            <div className="max-w-4xl mx-auto space-y-6 pb-12">

                {/* 헤더 섹션 */}
                <div className="flex flex-col gap-2 border-b border-[#3c3c3c] pb-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-[#e1e1e1]">
                            {ticker} <span className="text-[#888888] text-lg font-normal">Overview</span>
                        </h1>
                        <div className="flex gap-2">
                            {profile.website && (
                                <a
                                    href={profile.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-[#007acc] hover:underline text-sm"
                                >
                                    <Globe className="w-4 h-4" /> Website
                                </a>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-[#cccccc]">
                        {profile.sector && <Badge variant="secondary" className="bg-[#2d2d2d] text-[#4ec9b0] hover:bg-[#3d3d3d]">{profile.sector}</Badge>}
                        {profile.industry && <Badge variant="secondary" className="bg-[#2d2d2d] text-[#9cdcfe] hover:bg-[#3d3d3d]">{profile.industry}</Badge>}
                        {profile.country && <span className="flex items-center text-[#888888]">📍 {profile.country}</span>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 기업 개요 (왼쪽 2/3) */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="bg-[#252526] border-[#3c3c3c]">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-[#cccccc] flex items-center gap-2">
                                    <Building2 className="w-4 h-4" />
                                    Business Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-[#d4d4d4] leading-relaxed max-h-[400px] overflow-y-auto pr-2 scrollbar-msg">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-3" {...props} />,
                                            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                            strong: ({ node, ...props }) => <strong className="font-bold text-[#569cd6]" {...props} />,
                                        }}
                                    >
                                        {profile.longBusinessSummary || "설명이 없습니다."}
                                    </ReactMarkdown>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 제품/서비스 정보 */}
                        <Card className="bg-[#252526] border-[#3c3c3c]">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-[#cccccc]">Company Info</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {profile.products && profile.products !== '-' && (
                                    <div>
                                        <span className="text-xs text-[#888888] uppercase">Products</span>
                                        <p className="text-sm text-[#d4d4d4] mt-1">{profile.products}</p>
                                    </div>
                                )}
                                {profile.services && profile.services !== '-' && (
                                    <div>
                                        <span className="text-xs text-[#888888] uppercase">Services</span>
                                        <p className="text-sm text-[#d4d4d4] mt-1">{profile.services}</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#3c3c3c]">
                                    {profile.founded && profile.founded !== '-' && (
                                        <div>
                                            <span className="text-xs text-[#888888] uppercase">Founded</span>
                                            <p className="text-sm text-[#e1e1e1]">{profile.founded}</p>
                                        </div>
                                    )}
                                    {profile.headquarters && profile.headquarters !== '-' && (
                                        <div>
                                            <span className="text-xs text-[#888888] uppercase">Headquarters</span>
                                            <p className="text-sm text-[#e1e1e1]">{profile.headquarters}</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 주요 임원 */}
                        {profile.companyOfficers?.length > 0 && (
                            <Card className="bg-[#252526] border-[#3c3c3c]">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold text-[#cccccc] flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        Key Executives
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-4">
                                        {profile.companyOfficers.slice(0, 3).map((officer, i) => (
                                            <div key={i} className="flex justify-between items-center border-b border-[#3c3c3c] last:border-0 pb-2 last:pb-0">
                                                <div>
                                                    <p className="text-sm font-medium text-[#e1e1e1]">{officer.name}</p>
                                                    <p className="text-xs text-[#888888]">{officer.title}</p>
                                                </div>
                                                {officer.totalPay?.fmt && (
                                                    <span className="text-xs text-[#dcdcaa] font-mono">{officer.totalPay.fmt}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* 주요 지표 (오른쪽 1/3) */}
                    <div className="space-y-6">
                        {/* AI 감점 분석 */}
                        <Card className="bg-[#252526] border-[#3c3c3c]">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-[#cccccc] flex items-center gap-2">
                                    <Brain className="w-4 h-4" />
                                    AI Sentiment
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {sentiment === null ? (
                                    <div className="flex items-center gap-2 text-[#888888]">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">분석 중...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className={`px-4 py-2 rounded-lg ${sentiment > 0.3 ? 'bg-[#22543d]' :
                                            sentiment < -0.3 ? 'bg-[#7f1d1d]' : 'bg-[#78350f]'
                                            }`}>
                                            <p className={`text-2xl font-bold ${sentiment > 0.3 ? 'text-[#4ade80]' :
                                                sentiment < -0.3 ? 'text-[#f87171]' : 'text-[#fbbf24]'
                                                }`}>
                                                {sentiment > 0 ? '+' : ''}{sentiment.toFixed(2)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className={`text-sm font-medium ${sentiment > 0.3 ? 'text-[#4ade80]' :
                                                sentiment < -0.3 ? 'text-[#f87171]' : 'text-[#fbbf24]'
                                                }`}>
                                                {sentiment > 0.3 ? 'Bullish' : sentiment < -0.3 ? 'Bearish' : 'Neutral'}
                                            </p>
                                            <p className="text-xs text-[#666666] mt-0.5">FinBERT Analysis</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* 세력 수급 분석 (Whale Analysis) */}
                        <Card className="bg-[#252526] border-[#3c3c3c]">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-[#cccccc] flex items-center gap-2">
                                    <Users className="w-4 h-4 text-[#a78bfa]" />
                                    Whale Analysis
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {loading ? (
                                    <div className="flex items-center gap-2 text-[#888888]">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">세력 데이터 분석 중...</span>
                                    </div>
                                ) : (whaleData ? (
                                    <>
                                        <div>
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className="text-xs text-[#888888]">Estimated Whale Price</span>
                                                <span className="text-base font-bold text-[#e1e1e1] font-mono">
                                                    ${whaleData.estimatedWhalePrice?.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xs text-[#666666]">Diff from Current</span>
                                                <span className={`text-xs font-mono ${whaleData.details?.vwapDiffPercent > 0 ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>
                                                    {whaleData.details?.vwapDiffPercent > 0 ? '+' : ''}{whaleData.details?.vwapDiffPercent?.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-[#1e1e1e] p-3 rounded-md border border-[#3c3c3c]">
                                            <p className="text-sm text-[#d4d4d4] leading-snug">
                                                {whaleData.summary || "데이터 없음"}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#3c3c3c]">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-[#888888]">OBV Trend</span>
                                                <span className={`text-xs font-medium ${whaleData.details?.obvTrend === 'up' ? 'text-[#4ade80]' :
                                                    whaleData.details?.obvTrend === 'down' ? 'text-[#f87171]' : 'text-[#cccccc]'
                                                    }`}>
                                                    {whaleData.details?.obvTrend?.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-[#888888]">MFI (Money Flow)</span>
                                                <span className="text-xs font-medium text-[#e1e1e1]">
                                                    {whaleData.details?.mfi?.toFixed(1)}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-[#666666]">분석 데이터가 없습니다.</div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Valuation */}
                        <Card className="bg-[#252526] border-[#3c3c3c]">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-[#cccccc] flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" />
                                    Key Statistics
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#888888]">Market Cap</span>
                                    <span className="text-[#e1e1e1] font-mono">{fmtNum(financials.marketCap) === '-' ? fmtNum(stats.enterpriseValue) : fmtNum(financials.marketCap)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#888888]">Enterprise Value</span>
                                    <span className="text-[#e1e1e1] font-mono">{fmtNum(stats.enterpriseValue)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#888888]">Trailing P/E</span>
                                    <span className="text-[#e1e1e1] font-mono">{fmtNum(stats.trailingPE)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#888888]">Forward P/E</span>
                                    <span className="text-[#e1e1e1] font-mono">{fmtNum(stats.forwardPE)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#888888]">Price/Book</span>
                                    <span className="text-[#e1e1e1] font-mono">{fmtNum(stats.priceToBook)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#888888]">Beta (5Y)</span>
                                    <span className="text-[#ce9178] font-mono">{fmtNum(stats.beta)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Analyst Ratings */}
                        <Card className="bg-[#252526] border-[#3c3c3c]">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-[#cccccc] flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    Analyst Rating
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-center">
                                    <span className="text-3xl font-bold text-[#4ec9b0]">
                                        {financials.recommendationKey ? financials.recommendationKey.toUpperCase().replace('_', ' ') : '-'}
                                    </span>
                                    <p className="text-xs text-[#888888] mt-1">Recommendation Key</p>
                                </div>

                                {financials.targetMeanPrice?.raw > 0 && (
                                    <div className="pt-2 border-t border-[#3c3c3c]">
                                        <div className="flex justify-between text-sm items-center">
                                            <span className="text-[#888888]">Target Price</span>
                                            <span className="text-[#4ec9b0] font-bold font-mono text-lg">
                                                {fmtNum(financials.targetMeanPrice)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs items-center mt-1">
                                            <span className="text-[#666666]">Current</span>
                                            <span className="text-[#d4d4d4] font-mono">
                                                {fmtNum(financials.currentPrice)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Profitability */}
                        <Card className="bg-[#252526] border-[#3c3c3c]">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-[#cccccc]">Profitability</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#888888]">Profit Margin</span>
                                    <span className="text-[#e1e1e1] font-mono">{fmtNum(stats.profitMargins)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#888888]">Operating Margin</span>
                                    <span className="text-[#e1e1e1] font-mono">{fmtNum(stats.operatingMargins)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#888888]">EPS</span>
                                    <span className="text-[#e1e1e1] font-mono">{fmtNum(financials.eps)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#888888]">ROA</span>
                                    <span className="text-[#e1e1e1] font-mono">{fmtNum(financials.returnOnAssets)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#888888]">ROE</span>
                                    <span className="text-[#e1e1e1] font-mono">{fmtNum(financials.returnOnEquity)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </ScrollArea>
    )
}
