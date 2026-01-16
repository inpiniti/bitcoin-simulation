import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"
import { Search, Loader2 } from "lucide-react"
import { useState } from "react"

export function TickerSelectionPanel() {
    const {
        ticker,
        setTicker,
        openTicker, // 멀티 탭 지원을 위해 추가
        tickerGroup,
        setTickerGroup,
        groupStocks,
        loadingGroupStocks,
        kisAuth,
        recommendedStocks
    } = useStore()

    const [filterText, setFilterText] = useState('')

    const filteredStocks = (tickerGroup === 'superinvestor' ? recommendedStocks : groupStocks)
        .filter(stock =>
            filterText === "" ||
            stock.ticker.toLowerCase().includes(filterText.toLowerCase()) ||
            stock.name.toLowerCase().includes(filterText.toLowerCase())
        )

    return (
        <div className="flex flex-col h-full bg-[#252526]">
            {/* Header / Filter Area */}
            <div className="p-2 space-y-2 border-b border-[#3c3c3c]">
                {/* Group Selector */}
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

                {/* Search Input */}
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

            {/* List Area */}
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
                        {filteredStocks.map((stock) => {
                            const isActive = ticker === stock.ticker
                            return (
                                <button
                                    key={stock.ticker}
                                    onClick={() => openTicker(stock.ticker, stock.name)}
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
                                        <span className="text-[11px] text-[#888888] truncate w-32" title={stock.name}>
                                            {stock.name}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5">
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded",
                                            isActive ? "bg-[#007acc] text-white" : "bg-[#3c3c3c] text-[#cccccc]"
                                        )}>
                                            {stock.count}
                                        </span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Footer Summary */}
            <div className="px-3 py-1 bg-[#1e1e1e] border-t border-[#3c3c3c] text-[10px] text-[#666666] flex justify-between">
                <span>Total: {filteredStocks.length}</span>
                <span>{loadingGroupStocks ? 'Updating...' : 'Ready'}</span>
            </div>
        </div>
    )
}
