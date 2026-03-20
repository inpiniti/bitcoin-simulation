import { useRef, useEffect } from "react"
import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"
import { X, FileCode2 } from "lucide-react"
import {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
} from "@/components/ui/context-menu"

export function TickerTabBar() {
    const {
        activeTickers, ticker: activeTicker, setTicker, closeTicker, tickerNames,
        closeOtherTickers, closeRightTickers, closeLeftTickers, closeAllTickers,
    } = useStore()
    const scrollContainerRef = useRef(null)

    useEffect(() => {
        if (activeTicker && scrollContainerRef.current) {
            // 스크롤 로직 추후 보강
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
                    const idx = activeTickers.indexOf(t)
                    const hasLeft = idx > 0
                    const hasRight = idx < activeTickers.length - 1
                    const hasOthers = activeTickers.length > 1

                    return (
                        <ContextMenu key={t}>
                            <ContextMenuTrigger asChild>
                                <div
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
                                        isActive ? "text-[#e8b56d]" : "text-[#757575]"
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
                                            isActive && "opacity-100"
                                        )}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </ContextMenuTrigger>

                            <ContextMenuContent>
                                <ContextMenuItem onSelect={() => closeTicker(t)}>
                                    닫기
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                    onSelect={() => closeOtherTickers(t)}
                                    disabled={!hasOthers}
                                    className={!hasOthers ? "opacity-40 cursor-default pointer-events-none" : ""}
                                >
                                    다른 탭 닫기
                                </ContextMenuItem>
                                <ContextMenuItem
                                    onSelect={() => closeRightTickers(t)}
                                    disabled={!hasRight}
                                    className={!hasRight ? "opacity-40 cursor-default pointer-events-none" : ""}
                                >
                                    오른쪽 탭 닫기
                                </ContextMenuItem>
                                <ContextMenuItem
                                    onSelect={() => closeLeftTickers(t)}
                                    disabled={!hasLeft}
                                    className={!hasLeft ? "opacity-40 cursor-default pointer-events-none" : ""}
                                >
                                    왼쪽 탭 닫기
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onSelect={() => closeAllTickers()}>
                                    모두 닫기
                                </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    )
                })}
            </div>

            {/* 빈 공간 */}
            <div className="flex-1 h-full bg-[#252526]" />
        </div>
    )
}
