import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { useState, useEffect } from "react"

export function TitleBar() {
    const { mode, ticker, setMode, setTicker } = useStore()
    const [localTicker, setLocalTicker] = useState(ticker)

    useEffect(() => {
        setLocalTicker(ticker)
    }, [ticker])

    const handleModeChange = (newMode) => {
        if (mode === newMode) return;
        if (confirm("모드를 변경하시겠습니까? 기존 데이터는 초기화됩니다.")) {
            setMode(newMode);
        }
    }

    const handleTickerSubmit = (e) => {
        if (e.key === 'Enter') {
            if (localTicker !== ticker) {
                if (confirm(`종목을 '${localTicker}'(으)로 변경하시겠습니까? 데이터가 초기화됩니다.`)) {
                    setTicker(localTicker);
                }
            }
        }
    }

    const handleTickerBlur = () => {
        if (localTicker !== ticker) {
            setLocalTicker(ticker) // Revert if not submitted
        }
    }

    return (
        <div className="h-10 bg-[#323233] flex items-center px-4 select-none justify-between border-b border-[#1e1e1e]">
            {/* Left: Branding & Mode Toggle */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <svg className={cn("w-5 h-5 transition-colors", mode === 'coin' ? "text-[#f7931a]" : "text-blue-500")} viewBox="0 0 24 24" fill="currentColor">
                        {/* Bitcoin Icon or Generic Chart Icon based on mode? keeping BTC icon for now or switching */}
                        {mode === 'coin' ? (
                            <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.546zM17.17 10.06c.23-1.57-.96-2.42-2.6-2.98l.53-2.13-1.3-.32-.52 2.07c-.34-.08-.69-.16-1.04-.24l.52-2.09-1.3-.32-.53 2.13c-.28-.06-.56-.13-.83-.2l-1.79-.45-.35 1.39s.96.22.94.24c.53.13.62.48.61.75l-.61 2.45c.04.01.08.02.14.04l-.14-.04-.86 3.44c-.07.16-.23.41-.6.31.01.02-.94-.24-.94-.24l-.64 1.49 1.69.42c.31.08.62.16.92.23l-.54 2.15 1.3.32.53-2.13c.36.1.7.19 1.04.27l-.53 2.12 1.3.32.54-2.14c2.21.42 3.87.25 4.57-1.75.56-1.61-.03-2.54-1.19-3.15.85-.2 1.49-.76 1.66-1.93zm-2.98 4.17c-.4 1.61-3.11.74-3.99.52l.71-2.86c.88.22 3.7.66 3.28 2.34zm.4-4.19c-.36 1.46-2.62.72-3.35.54l.65-2.59c.73.18 3.08.52 2.7 2.05z" />
                        ) : (
                            <path d="M3 3v18h18v-2H5V3H3zm4 14h2v-7H7v7zm4 0h2v-10h-2v10zm4 0h2v-4h-2v4z" />
                        )}
                    </svg>
                    <span className="text-sm font-bold text-[#e1e1e1]">
                        {mode === 'coin' ? "Bitcoin Sim" : "Stock Sim"}
                    </span>
                </div>

                <div className="flex bg-[#252526] rounded-md p-0.5 border border-[#3e3e42]">
                    <button
                        onClick={() => handleModeChange('coin')}
                        className={cn(
                            "px-3 py-1 text-xs rounded-sm transition-colors",
                            mode === 'coin'
                                ? "bg-[#454545] text-white font-medium"
                                : "text-[#9d9d9d] hover:text-white"
                        )}
                    >
                        Coin
                    </button>
                    <button
                        onClick={() => handleModeChange('stock')}
                        className={cn(
                            "px-3 py-1 text-xs rounded-sm transition-colors",
                            mode === 'stock'
                                ? "bg-[#007acc] text-white font-medium"
                                : "text-[#9d9d9d] hover:text-white"
                        )}
                    >
                        Stock
                    </button>
                </div>
            </div>

            {/* Center: Stock Ticker Input */}
            <div className="flex-1 flex justify-center items-center">
                {mode === 'stock' && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[#9d9d9d]">Ticker:</span>
                        <input
                            type="text"
                            className="bg-[#252526] text-[#cccccc] border border-[#3e3e42] rounded px-2 py-0.5 text-xs focus:border-[#007acc] focus:outline-none w-24 text-center uppercase"
                            value={localTicker}
                            onChange={(e) => setLocalTicker(e.target.value.toUpperCase())}
                            onKeyDown={handleTickerSubmit}
                            onBlur={handleTickerBlur}
                            placeholder="AAPL"
                        />
                        <span className="text-[10px] text-[#6d6d6d]">(Enter to Apply)</span>
                    </div>
                )}
            </div>

            {/* Right: Window Controls (Mock) */}
            <div className="flex items-center gap-4 text-[#7d7d7d]">
                <button className="hover:text-[#cccccc] text-xs">−</button>
                <button className="hover:text-[#cccccc] text-xs">□</button>
                <button className="hover:text-[#cccccc] hover:bg-red-600 px-2 text-xs">×</button>
            </div>
        </div>
    )
}
