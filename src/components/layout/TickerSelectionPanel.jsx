import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"
import { Search, Loader2 } from "lucide-react"
import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react"
import { kisWebSocket } from "@/lib/kisWebSocket"

// 개별 티커 아이템 컴포넌트
const TickerItem = memo(({ stock, isActive, onClick, onVisible }) => {
    const itemRef = useRef(null);
    const rtData = useStore(state => state.realtimePrices[stock.ticker]);
    const priceColor = rtData?.rate > 0 ? "text-[#f26d6d]" : rtData?.rate < 0 ? "text-[#3dabf5]" : "text-[#cccccc]";

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    onVisible(stock, true);
                } else {
                    onVisible(stock, false);
                }
            },
            { threshold: 0.1 }
        );

        if (itemRef.current) {
            observer.observe(itemRef.current);
        }

        return () => observer.disconnect();
    }, [stock, onVisible]);

    const handleInternalClick = useCallback(() => {
        onClick(stock.ticker, stock.name);
    }, [stock.ticker, stock.name, onClick]);

    return (
        <button
            ref={itemRef}
            onClick={handleInternalClick}
            className={cn(
                "flex items-center justify-between px-3 py-2 text-left transition-colors border-l-2",
                isActive
                    ? "bg-[#37373d] border-[#007acc]"
                    : "border-transparent hover:bg-[#2a2d2e]"
            )}
        >
            <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-[13px] font-bold",
                        isActive ? "text-white" : "text-[#cccccc]"
                    )}>
                        {stock.ticker}
                    </span>
                    {stock.exchange && (
                        <span className="text-[10px] text-[#666666]">{stock.exchange}</span>
                    )}
                </div>
                <span className="text-[11px] text-[#888888] truncate w-28" title={stock.name}>
                    {stock.name}
                </span>
            </div>

            <div className="flex flex-col items-end gap-0.5">
                {rtData ? (
                    <>
                        <span className={cn("text-[12px] font-medium font-mono", priceColor)}>
                            {Number(rtData.price).toLocaleString()}
                        </span>
                        <span className={cn("text-[10px]", priceColor)}>
                            {rtData.rate > 0 ? '+' : ''}{rtData.rate}%
                        </span>
                    </>
                ) : (
                    <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded",
                        isActive ? "bg-[#007acc] text-white" : "bg-[#3c3c3c] text-[#cccccc]"
                    )}>
                        {stock.count}
                    </span>
                )}
            </div>
        </button>
    );
});

TickerItem.displayName = "TickerItem";

/**
 * 사이드바의 티커 선택 패널 컴포넌트
 * 종목 그룹 선택, 검색, 그리고 실시간 뷰포트 구독 로직을 포함합니다.
 * 
 * @component
 * @returns {JSX.Element} 티커 선택 패널
 */
export function TickerSelectionPanel() {
    const {
        ticker,
        openTicker,
        tickerGroup,
        setTickerGroup,
        groupStocks,
        loadingGroupStocks,
        kisAuth,
        recommendedStocks,
    } = useStore()

    const [filterText, setFilterText] = useState('')
    const visibleStocksRef = useRef(new Map()); // 현재 화면에 보이는 종목 관리
    const debounceTimerRef = useRef(null);

    const filteredStocks = useMemo(() => {
        const stocks = (tickerGroup === 'superinvestor' ? recommendedStocks : groupStocks);
        if (!filterText) return stocks;
        const lowerFilter = filterText.toLowerCase();
        return stocks.filter(stock =>
            stock.ticker.toLowerCase().includes(lowerFilter) ||
            stock.name.toLowerCase().includes(lowerFilter)
        );
    }, [tickerGroup, recommendedStocks, groupStocks, filterText]);

    // WebSocket 연결 관리
    useEffect(() => {
        console.log('[WSDebug] kisAuth.isLoggedIn:', kisAuth.isLoggedIn);
        console.log('[WSDebug] kisAuth.approvalKey:', kisAuth.approvalKey ? 'EXISTS' : 'EMPTY');

        if (kisAuth.approvalKey) {
            console.log('[WSDebug] Attempting WebSocket connection...');
            kisWebSocket.connect(kisAuth.approvalKey);
        } else {
            console.log('[WSDebug] No approvalKey - WebSocket connection skipped');
        }
    }, [kisAuth.approvalKey, kisAuth.isLoggedIn]);

    // 뷰포트 가시성 핸들러 - useCallback으로 안정화하여 TickerItem의 useEffect 재실행 방지
    const handleVisible = useCallback((stock, isVisible) => {
        if (isVisible) {
            visibleStocksRef.current.set(stock.ticker, stock);
        } else {
            visibleStocksRef.current.delete(stock.ticker);
        }

        // 과도한 구독 요청 방지를 위한 디바운싱
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            const currentVisible = Array.from(visibleStocksRef.current.values()).map(stock => ({
                ...stock,
                exchange: stock.exchange || 'NAS' // 기본값 설정
            }));
            kisWebSocket.subscribeStocks(currentVisible);
        }, 200);
    }, []); // 의존성 없음 (Ref와 Singleton 사용)

    // 티커 클릭 핸들러
    const handleTickerClick = useCallback((ticker, name) => {
        openTicker(ticker, name);
    }, [openTicker]);

    return (
        <div className="flex flex-col h-full bg-[#252526]">
            <div className="p-2 space-y-2 border-b border-[#3c3c3c]">
                <select
                    value={tickerGroup}
                    onChange={(e) => setTickerGroup(e.target.value)}
                    className="w-full bg-[#3c3c3c] border border-[#555555] text-[12px] text-[#cccccc] p-1.5 rounded focus:outline-none focus:border-[#007acc]"
                >
                    <option value="superinvestor">🔥 투자그루 Top Picks</option>
                    <option value="indices">🌏 주요 지수 (Indices)</option>
                    <option value="sp500">🇺🇸 S&P 500</option>
                    <option value="qqq">🇺🇸 Nasdaq 100 (QQQ)</option>
                    <option value="kospi200">🇰🇷 KOSPI 200</option>
                    <option value="kosdaq150">🇰🇷 KOSDAQ 150</option>
                    <option value="myholdings" disabled={!kisAuth.isLoggedIn}>💼 내 보유종목</option>
                    <option value="volumesurge">📊 거래량 급증</option>
                </select>

                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search ticker..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full bg-[#3c3c3c] border border-[#555555] text-[12px] text-[#cccccc] pl-8 pr-2 py-1.5 rounded focus:outline-none focus:border-[#007acc]"
                    />
                    <Search className="w-3.5 h-3.5 text-[#888888] absolute left-2.5 top-1.5" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loadingGroupStocks ? (
                    <div className="flex flex-col items-center justify-center h-20 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-[#007acc]" />
                        <span className="text-[10px] text-[#888888]">Loading stocks...</span>
                    </div>
                ) : filteredStocks.length === 0 ? (
                    <div className="p-4 text-center text-[12px] text-[#666666] italic">
                        검색 결과가 없습니다.
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {filteredStocks.map((stock) => (
                            <TickerItem
                                key={stock.ticker}
                                stock={stock}
                                isActive={ticker === stock.ticker}
                                onClick={handleTickerClick}
                                onVisible={handleVisible}
                            />
                        ))}
                    </div>
                )}
            </div>


            <div className="px-3 py-1 bg-[#1e1e1e] border-t border-[#3c3c3c] text-[10px] text-[#666666] flex justify-between">
                <span>Total: {filteredStocks.length}</span>
                <span>{loadingGroupStocks ? 'Updating...' : 'Ready'}</span>
            </div>
        </div>
    )
}
