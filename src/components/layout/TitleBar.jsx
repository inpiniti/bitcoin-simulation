import { cn } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import { useState, useEffect, useRef } from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function TitleBar() {
    const {
        mode, ticker, setMode, setTicker,
        dataViewMode, toggleDataViewMode,
        recommendedStocks, loadingRecommendations, loadRecommendedTickers,
        analysisMode, setAnalysisMode, runMarketAnalysis, isAnalyzing
    } = useStore()
    const [localTicker, setLocalTicker] = useState(ticker)
    const skipBlurRef = useRef(false)

    // 로컬 Alert 상태 관리
    const [alertConfig, setAlertConfig] = useState({
        open: false,
        title: "",
        description: "",
        onConfirm: () => { },
        onCancel: () => { }
    })

    useEffect(() => {
        setLocalTicker(ticker)
    }, [ticker])

    const openAlert = (title, description, onConfirm, onCancel = null) => {
        setAlertConfig({
            open: true,
            title,
            description,
            onConfirm: () => {
                onConfirm()
                setAlertConfig(prev => ({ ...prev, open: false }))
            },
            onCancel: () => {
                if (onCancel) onCancel()
                setAlertConfig(prev => ({ ...prev, open: false }))
            }
        })
    }

    const handleModeChange = (newMode) => {
        if (mode === newMode) return;

        openAlert(
            "모드 변경",
            "모드를 변경하시겠습니까? 기존 데이터는 초기화됩니다.",
            () => setMode(newMode)
        )
    }

    const handleTickerSubmit = (e) => {
        if (e.key === 'Enter') {
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();

            if (localTicker !== ticker) {
                skipBlurRef.current = true
                openAlert(
                    "종목 변경",
                    `종목을 '${localTicker}'(으)로 변경하시겠습니까? 데이터가 초기화됩니다.`,
                    () => {
                        setTicker(localTicker)
                        skipBlurRef.current = false
                    },
                    () => {
                        setLocalTicker(ticker)
                        skipBlurRef.current = false
                    }
                )
            }
        }
    }

    const handleTickerBlur = () => {
        // Blur 시에는 변경 확정 없이 원래대로 되돌림 (혹은 Submit 유도)
        if (skipBlurRef.current) return;

        if (localTicker !== ticker) {
            setLocalTicker(ticker)
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
                    <div className="flex items-center gap-2 relative">
                        <span className="text-xs text-[#9d9d9d]">Ticker:</span>

                        {/* Combobox Wrapper */}
                        <div className="relative group">
                            <input
                                type="text"
                                className="bg-[#252526] text-[#cccccc] border border-[#3e3e42] rounded px-2 py-0.5 text-xs focus:border-[#007acc] focus:outline-none w-32 text-center uppercase pr-6" // 너비 증가, padding right 확보
                                value={localTicker}
                                onChange={(e) => setLocalTicker(e.target.value.toUpperCase())}
                                onKeyDown={handleTickerSubmit}
                                onBlur={handleTickerBlur}
                                onFocus={(e) => {
                                    // 포커스 시 추천 리스트 로드 및 갱신
                                    loadRecommendedTickers();
                                }}
                                placeholder="AAPL"
                            />
                            {/* Dropdown Indicator */}
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-[#666]">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7 10l5 5 5-5z" />
                                </svg>
                            </div>

                            {/* Dropdown Menu (Hover or Focus-within) */}
                            {recommendedStocks.length > 0 && (
                                <div className="absolute top-full left-0 w-64 bg-[#252526] border border-[#3e3e42] shadow-lg rounded-sm mt-1 z-50 hidden group-focus-within:block max-h-80 overflow-y-auto">
                                    <div className="px-2 py-1.5 text-[10px] text-[#6a9955] bg-[#1e1e1e] font-bold sticky top-0 border-b border-[#3e3e42]">
                                        🔥 Superinvestors' Top Picks
                                    </div>
                                    {recommendedStocks.map((stock) => (
                                        <button
                                            key={stock.ticker}
                                            className="w-full text-left px-2 py-1.5 hover:bg-[#094771] hover:text-white flex items-center justify-between group/item"
                                            onMouseDown={(e) => {
                                                e.preventDefault(); // Prevent input blur
                                                if (ticker !== stock.ticker) {
                                                    openAlert(
                                                        "종목 변경",
                                                        `'${stock.ticker}' (${stock.count} holders) 로 변경하시겠습니까?`,
                                                        () => {
                                                            setTicker(stock.ticker)
                                                            setLocalTicker(stock.ticker)
                                                        }
                                                    )
                                                }
                                            }}
                                        >
                                            <div>
                                                <span className="text-xs font-bold text-[#d4d4d4] w-12 inline-block">{stock.ticker}</span>
                                                <span className="text-[10px] text-[#9d9d9d] group-hover/item:text-[#cccccc] truncate max-w-[120px] inline-block align-bottom">{stock.name}</span>
                                            </div>
                                            <span className="text-[10px] bg-[#3c3c3c] text-[#cccccc] px-1 rounded-sm group-hover/item:bg-[#1e1e1e]">
                                                {stock.count}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {loadingRecommendations && (
                            <span className="text-[10px] text-[#007acc] animate-pulse">Loading...</span>
                        )}
                        {!loadingRecommendations && (
                            <span className="text-[10px] text-[#6d6d6d]">(Select or Input)</span>
                        )}
                    </div>
                )}
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-4">
                {/* Data View Toggle */}
                <button
                    onClick={toggleDataViewMode}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1 text-xs rounded-sm transition-colors border",
                        dataViewMode
                            ? "bg-[#2d2d2d] text-[#e1e1e1] border-[#555]"
                            : "bg-transparent text-[#9d9d9d] border-transparent hover:text-[#e1e1e1] hover:bg-[#2d2d2d]"
                    )}
                >
                    <span>{dataViewMode ? "👁️ Data View : ON" : "👁️ Data View : OFF"}</span>
                </button>

                {/* Market Analysis Button (Stock Mode Only) */}
                {mode === 'stock' && (
                    <button
                        onClick={() => {
                            if (analysisMode) {
                                setAnalysisMode(false); // 끄기
                            } else {
                                setAnalysisMode(true); // 켜기
                                runMarketAnalysis(); // 분석 실행
                            }
                        }}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1 text-xs rounded-sm transition-colors border",
                            analysisMode
                                ? "bg-[#094771] text-white border-[#007acc]"
                                : "bg-transparent text-[#9d9d9d] border-transparent hover:text-[#e1e1e1] hover:bg-[#2d2d2d]"
                        )}
                        disabled={isAnalyzing}
                    >
                        <span>
                            {isAnalyzing
                                ? "⏳ Analyzing..."
                                : analysisMode ? "Close Analysis" : "🔍 Analyze All"
                            }
                        </span>
                    </button>
                )}

                {/* Window Controls (Mock) */}
                <div className="flex items-center gap-4 text-[#7d7d7d]">
                    <button className="hover:text-[#cccccc] text-xs">−</button>
                    <button className="hover:text-[#cccccc] text-xs">□</button>
                    <button className="hover:text-[#cccccc] hover:bg-red-600 px-2 text-xs">×</button>
                </div>
            </div>

            {/* TitleBar Local Alert Dialog */}
            <AlertDialog open={alertConfig.open} onOpenChange={(open) => !open && setAlertConfig(prev => ({ ...prev, open: false }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertConfig.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {alertConfig.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={alertConfig.onCancel}>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={alertConfig.onConfirm}>확인</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}
