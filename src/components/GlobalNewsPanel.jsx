/**
 * GlobalNewsPanel — 날짜별 뉴스 목록 + 상세 패널
 * Issue #67: 날짜 선택 + 뉴스 카드 목록
 * Issue #68: 뉴스 상세 패널 (주식 영향도 표시)
 */
import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { useStore } from '@/store/useStore'
import { fetchNewsByDate } from '@/lib/newsApi'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
    Newspaper,
    CalendarIcon,
    ExternalLink,
    X,
    TrendingUp,
    TrendingDown,
    Minus,
    ChevronRight,
} from 'lucide-react'

// ─── KST 오늘 날짜를 Date 객체로 반환 ───────────────────────────────────────
function getTodayKST() {
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    return new Date(now.getTime() + kstOffset)
}

// ─── 충격 레벨 Badge 색상 ──────────────────────────────────────────────────
function ImpactBadge({ level }) {
    const map = {
        high: { label: '높음', className: 'bg-red-900/50 text-red-300 border-red-700' },
        medium: { label: '중간', className: 'bg-yellow-900/50 text-yellow-300 border-yellow-700' },
        low: { label: '낮음', className: 'bg-green-900/50 text-green-300 border-green-700' },
    }
    const info = map[level] || { label: level || '-', className: 'bg-[#3c3c3c] text-[#888888]' }
    return (
        <Badge variant="outline" className={`text-xs shrink-0 ${info.className}`}>
            {info.label}
        </Badge>
    )
}

// ─── 방향 아이콘 ───────────────────────────────────────────────────────────
function DirectionIcon({ direction }) {
    if (direction === 'bullish') return <TrendingUp className="w-4 h-4 text-green-400 shrink-0" />
    if (direction === 'bearish') return <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
    return <Minus className="w-4 h-4 text-[#888888] shrink-0" />
}

// ─── 시장 Badge ───────────────────────────────────────────────────────────
function MarketBadge({ market }) {
    const map = {
        US: 'bg-blue-900/50 text-blue-300 border-blue-700',
        KOSPI: 'bg-purple-900/50 text-purple-300 border-purple-700',
        KOSDAQ: 'bg-indigo-900/50 text-indigo-300 border-indigo-700',
        CRYPTO: 'bg-orange-900/50 text-orange-300 border-orange-700',
    }
    return (
        <Badge variant="outline" className={`text-xs ${map[market] || 'bg-[#3c3c3c] text-[#888888]'}`}>
            {market}
        </Badge>
    )
}

// ─── 로딩 스켈레톤 ────────────────────────────────────────────────────────
function NewsCardSkeleton() {
    return (
        <Card className="bg-[#252526] border-[#3c3c3c]">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                    <Skeleton className="h-5 w-16 bg-[#3c3c3c]" />
                    <Skeleton className="h-5 flex-1 bg-[#3c3c3c]" />
                </div>
                <Skeleton className="h-4 w-3/4 bg-[#3c3c3c]" />
                <Skeleton className="h-4 w-1/2 bg-[#3c3c3c]" />
            </CardContent>
        </Card>
    )
}

// ─── 뉴스 상세 패널 (Issue #68) ───────────────────────────────────────────
function NewsDetailPanel({ news, onClose }) {
    const [marketFilter, setMarketFilter] = useState('전체')
    const markets = ['전체', 'US', 'KOSPI', 'KOSDAQ', 'CRYPTO']

    const stockImpacts = news.news_stock_impact || []
    const filteredStocks =
        marketFilter === '전체'
            ? stockImpacts
            : stockImpacts.filter(s => s.market === marketFilter)

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-[#3c3c3c]">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c] shrink-0">
                <h2 className="text-sm font-semibold text-[#e1e1e1] line-clamp-1 flex-1 mr-2">
                    {news.title}
                </h2>
                <button
                    onClick={onClose}
                    className="text-[#888888] hover:text-[#cccccc] transition-colors"
                    aria-label="닫기"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {/* 메타 정보 */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <ImpactBadge level={news.impact_level} />
                        <span className="text-xs text-[#888888]">{news.source}</span>
                        {news.published_at && (
                            <span className="text-xs text-[#888888]">
                                {news.published_at.slice(0, 16).replace('T', ' ')}
                            </span>
                        )}
                    </div>

                    {/* 요약 */}
                    {news.summary && (
                        <p className="text-sm text-[#cccccc] leading-relaxed">{news.summary}</p>
                    )}

                    {/* 시장 영향 */}
                    {news.market_impact && (
                        <div className="p-3 rounded-lg bg-[#252526] border border-[#3c3c3c]">
                            <p className="text-xs font-semibold text-[#9cdcfe] mb-1">시장 영향 분석</p>
                            <p className="text-sm text-[#cccccc] leading-relaxed whitespace-pre-wrap">
                                {news.market_impact}
                            </p>
                        </div>
                    )}

                    {/* 주식 영향 목록 */}
                    {stockImpacts.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-[#9cdcfe]">
                                종목별 영향 ({stockImpacts.length}개)
                            </p>

                            {/* 시장 필터 탭 */}
                            <Tabs value={marketFilter} onValueChange={setMarketFilter}>
                                <TabsList className="bg-[#252526] border border-[#3c3c3c] h-8 gap-0 p-0.5">
                                    {markets.map(m => (
                                        <TabsTrigger
                                            key={m}
                                            value={m}
                                            className="text-xs px-2 h-7 data-[state=active]:bg-[#007acc] data-[state=active]:text-white text-[#888888]"
                                        >
                                            {m}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>

                                <TabsContent value={marketFilter} className="mt-2 space-y-2">
                                    {filteredStocks.length === 0 ? (
                                        <p className="text-xs text-[#666666] py-2">해당 시장의 종목 영향 데이터가 없습니다.</p>
                                    ) : (
                                        filteredStocks.map((stock, idx) => (
                                            <div
                                                key={stock.id ?? idx}
                                                className="p-3 rounded-lg bg-[#252526] border border-[#3c3c3c] space-y-2"
                                            >
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <DirectionIcon direction={stock.direction} />
                                                    <span className="text-sm font-semibold text-[#e1e1e1]">
                                                        {stock.ticker}
                                                    </span>
                                                    {stock.name && (
                                                        <span className="text-xs text-[#888888]">{stock.name}</span>
                                                    )}
                                                    {stock.market && <MarketBadge market={stock.market} />}
                                                </div>

                                                {stock.reason && (
                                                    <p className="text-xs text-[#cccccc] leading-relaxed">
                                                        {stock.reason}
                                                    </p>
                                                )}

                                                {stock.confidence != null && (
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs text-[#888888]">
                                                            <span>신뢰도</span>
                                                            <span>{Math.round(stock.confidence * 100)}%</span>
                                                        </div>
                                                        <Progress
                                                            value={stock.confidence * 100}
                                                            className="h-1.5 bg-[#3c3c3c]"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}

                    {/* 원문 보기 버튼 */}
                    {news.url && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-[#3c3c3c] text-[#cccccc] hover:bg-[#2d2d2d] hover:text-white"
                            onClick={() => window.open(news.url, '_blank', 'noopener,noreferrer')}
                        >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            원문 보기
                        </Button>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}

// ─── 뉴스 카드 ─────────────────────────────────────────────────────────────
function NewsCard({ news, isSelected, onClick }) {
    return (
        <Card
            className={`bg-[#252526] border-[#3c3c3c] cursor-pointer transition-colors hover:border-[#007acc] ${
                isSelected ? 'border-[#007acc] bg-[#1a2a3a]' : ''
            }`}
            onClick={onClick}
        >
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                        {/* 제목 + 충격 레벨 */}
                        <div className="flex items-start gap-2">
                            <p className="text-sm font-medium text-[#e1e1e1] leading-snug flex-1 line-clamp-2">
                                {news.title}
                            </p>
                            <ImpactBadge level={news.impact_level} />
                        </div>

                        {/* 시장 영향 요약 (truncated) */}
                        {news.market_impact && (
                            <p className="text-xs text-[#888888] line-clamp-2 leading-relaxed">
                                {news.market_impact}
                            </p>
                        )}

                        {/* 소스 + 시간 */}
                        <div className="flex items-center gap-2 text-xs text-[#666666]">
                            {news.source && <span>{news.source}</span>}
                            {news.published_at && (
                                <span>{news.published_at.slice(0, 16).replace('T', ' ')}</span>
                            )}
                            {news.news_stock_impact?.length > 0 && (
                                <span className="ml-auto text-[#4fc3f7]">
                                    종목 {news.news_stock_impact.length}개
                                </span>
                            )}
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#555555] shrink-0 mt-0.5" />
                </div>
            </CardContent>
        </Card>
    )
}

// ─── 메인 GlobalNewsPanel (Issue #67) ─────────────────────────────────────
export function GlobalNewsPanel() {
    const {
        newsItems,
        newsSelectedDate,
        newsIsLoading,
        newsError,
        setNewsItems,
        setNewsSelectedDate,
        setNewsIsLoading,
        setNewsError,
    } = useStore()

    const [selectedNews, setSelectedNews] = useState(null)
    const [calendarOpen, setCalendarOpen] = useState(false)

    // 날짜 문자열 → Date 객체 (캘린더용)
    const todayKST = getTodayKST()
    const selectedDateObj = newsSelectedDate
        ? new Date(newsSelectedDate + 'T00:00:00')
        : todayKST

    const displayDate = newsSelectedDate || format(todayKST, 'yyyy-MM-dd')

    const loadNews = useCallback(async (date) => {
        setNewsIsLoading(true)
        setNewsError(null)
        setSelectedNews(null)
        try {
            const result = await fetchNewsByDate(date)
            setNewsItems(result.items || [])
        } catch (e) {
            setNewsError(e.message)
            setNewsItems([])
        } finally {
            setNewsIsLoading(false)
        }
    }, [setNewsIsLoading, setNewsError, setNewsItems])

    // 마운트 시 및 날짜 변경 시 뉴스 로드
    useEffect(() => {
        loadNews(newsSelectedDate || undefined)
    }, [newsSelectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleDateSelect = (date) => {
        if (!date) return
        const formatted = format(date, 'yyyy-MM-dd')
        setNewsSelectedDate(formatted)
        setCalendarOpen(false)
    }

    return (
        <div className="flex h-full overflow-hidden">
            {/* 좌측 뉴스 목록 */}
            <div className={`flex flex-col ${selectedNews ? 'w-1/2' : 'w-full'} transition-all duration-200`}>
                {/* 툴바 */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#3c3c3c] shrink-0 bg-[#252526]">
                    <Newspaper className="w-5 h-5 text-[#007acc] shrink-0" />
                    <h1 className="text-base font-semibold text-[#e1e1e1]">글로벌 뉴스</h1>

                    <div className="ml-auto flex items-center gap-2">
                        {/* 날짜 선택기 */}
                        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-[#3c3c3c] bg-[#1e1e1e] text-[#cccccc] hover:bg-[#2d2d2d] hover:text-white gap-2"
                                >
                                    <CalendarIcon className="w-4 h-4" />
                                    {displayDate}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-auto p-0 bg-[#252526] border-[#3c3c3c]"
                                align="end"
                            >
                                <Calendar
                                    mode="single"
                                    selected={selectedDateObj}
                                    onSelect={handleDateSelect}
                                    disabled={(date) => date > todayKST}
                                    className="text-[#cccccc]"
                                />
                            </PopoverContent>
                        </Popover>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadNews(newsSelectedDate || undefined)}
                            disabled={newsIsLoading}
                            className="text-[#888888] hover:text-[#cccccc]"
                        >
                            새로고침
                        </Button>
                    </div>
                </div>

                {/* 뉴스 카운트 */}
                {!newsIsLoading && !newsError && (
                    <div className="px-4 py-2 text-xs text-[#666666] border-b border-[#3c3c3c] shrink-0">
                        {displayDate} · {newsItems.length}개 뉴스
                    </div>
                )}

                {/* 목록 */}
                <ScrollArea className="flex-1 bg-[#1e1e1e]">
                    <div className="p-4 space-y-3 pb-12">
                        {newsIsLoading ? (
                            // 로딩 스켈레톤
                            Array.from({ length: 5 }).map((_, i) => (
                                <NewsCardSkeleton key={i} />
                            ))
                        ) : newsError ? (
                            // 에러 상태
                            <div className="flex flex-col items-center justify-center py-20 text-[#888888]">
                                <Newspaper className="w-12 h-12 mb-4 opacity-30" />
                                <p className="text-sm">뉴스를 불러올 수 없습니다.</p>
                                <p className="text-xs mt-1 text-[#555555]">{newsError}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-4 border-[#3c3c3c] text-[#888888]"
                                    onClick={() => loadNews(newsSelectedDate || undefined)}
                                >
                                    다시 시도
                                </Button>
                            </div>
                        ) : newsItems.length === 0 ? (
                            // 빈 상태
                            <div className="flex flex-col items-center justify-center py-20 text-[#888888]">
                                <Newspaper className="w-12 h-12 mb-4 opacity-30" />
                                <p className="text-sm">해당 날짜의 뉴스가 없습니다.</p>
                                <p className="text-xs mt-1 text-[#555555]">{displayDate}</p>
                            </div>
                        ) : (
                            newsItems.map((item) => (
                                <NewsCard
                                    key={item.id}
                                    news={item}
                                    isSelected={selectedNews?.id === item.id}
                                    onClick={() =>
                                        setSelectedNews(prev =>
                                            prev?.id === item.id ? null : item
                                        )
                                    }
                                />
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* 우측 상세 패널 (Issue #68) */}
            {selectedNews && (
                <div className="w-1/2 border-l border-[#3c3c3c]">
                    <NewsDetailPanel
                        news={selectedNews}
                        onClose={() => setSelectedNews(null)}
                    />
                </div>
            )}
        </div>
    )
}
