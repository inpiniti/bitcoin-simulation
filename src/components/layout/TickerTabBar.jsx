import { useRef, useEffect } from "react"
import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"
import { X, FileCode2 } from "lucide-react"

export function TickerTabBar() {
    const { activeTickers, ticker: activeTicker, setTicker, closeTicker, tickerNames } = useStore()
    const scrollContainerRef = useRef(null)

    // activeTicker가 변경되면 스크롤을 해당 탭으로 이동 (옵션)
    useEffect(() => {
        if (activeTicker && scrollContainerRef.current) {
            // 간단하게 구현: 여기서는 스크롤 로직을 생략하거나 추후 보강
        }
    }, [activeTicker])

    if (!activeTickers || activeTickers.length === 0) return null

    return (
        <div className="h-9 bg-[#252526] flex items-center border-b border-[#3c3c3c] overflow-hidden">
            <div
                ref={scrollContainerRef}
                className="flex items-center h-full overflow-x-auto no-scrollbar"
            >
                {activeTickers.map(t => {
                    const isActive = t === activeTicker
                    return (
                        <div
                            key={t}
                            className={cn(
                                "group flex items-center h-full px-3 min-w-[120px] max-w-[200px] border-r border-[#3c3c3c] cursor-pointer select-none text-[13px] relative transition-colors",
                                isActive
                                    ? "bg-[#1e1e1e] text-[#ffffff]"
                                    : "bg-[#2d2d2d] text-[#969696] hover:bg-[#2a2a2b]"
                            )}
                            onClick={() => setTicker(t)}
                        >
                            {isActive && (
                                <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#007acc] z-10" />
                            )}

                            <FileCode2 className={cn(
                                "w-3.5 h-3.5 mr-2 shrink-0",
                                isActive ? "text-[#e8b56d]" : "text-[#757575]" // JS file icon color approx
                            )} />

                            <span className="truncate flex-1" title={`${tickerNames[t] || ''} (${t})`}>
                                {tickerNames[t] || t}
                            </span>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    closeTicker(t)
                                }}
                                className={cn(
                                    "ml-2 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[#4d4d4d] transition-all",
                                    isActive && "opacity-100" // 활성 탭은 X 버튼 항상 보임? VSCode는 hover시에만 보임. 일단 hover시로 통일하되 활성은 잘 보이게
                                )}
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* 빈 공간 (탭이 없을 때 혹은 남은 공간) */}
            <div className="flex-1 h-full bg-[#252526]" />
        </div>
    )
}
