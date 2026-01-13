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
import { KISLoginDialog } from "@/components/KISLoginDialog"
import { KISAccountDialog } from "@/components/KISAccountDialog"
import { KISOrderDialog } from "@/components/KISOrderDialog"
import { GlobalAlertDialog } from "@/components/GlobalAlertDialog"
import { AutoTradingDialog } from "@/components/AutoTradingDialog"
import { Search } from "lucide-react"

export function TitleBar() {
    const {
        mode, ticker, setMode, setTicker, openTicker,
        recommendedStocks, loadingRecommendations, loadRecommendedTickers,
        loadDailyData, hist, loadingInterval,
        tickerGroup, setTickerGroup,
        groupStocks, setGroupStocks, loadingGroupStocks, setLoadingGroupStocks, // Store에서 가져옴
        kisAuth, loginKIS, logoutKIS
    } = useStore()
    const [localTicker, setLocalTicker] = useState(ticker)
    const [filterText, setFilterText] = useState('') // 드롭다운 필터용 (포커스 시 리셋)
    const [loginDialogOpen, setLoginDialogOpen] = useState(false)
    const [accountDialogOpen, setAccountDialogOpen] = useState(false)
    const [autoTradeDialogOpen, setAutoTradeDialogOpen] = useState(false)
    const skipBlurRef = useRef(false)

    const isLoading = loadingInterval['1d'] || loadingInterval['STOCK_BASE']
    const hasData = (hist['1d']?.length || 0) > 0

    // 로컬 Alert 상태 관리
    const [alertConfig, setAlertConfig] = useState({
        open: false,
        title: "",
        description: "",
        onConfirm: () => { },
        onCancel: () => { }
    })

    // ... (omitted) ...

    return (
        <div className="h-[35px] bg-[#1e1e1e] flex items-center justify-between px-3 select-none border-b border-[#2b2b2b] shrink-0">
            {/* Left: App Title & Menu */}
            <div className="flex items-center gap-4">
                <span className="text-[#007acc] font-bold text-[13px] flex items-center gap-1.5">
                    <img src="/vite.svg" className="w-3.5 h-3.5" alt="Icon" />
                    Bitcoin Sim v2.0
                </span>
            </div>

            {/* Center: Stock Ticker Input */}
            <div className="flex-1 flex justify-center items-center">
                {mode === 'stock' && (
                    <div className="flex items-center gap-2 relative">
                        <span className="text-xs font-bold text-[#e1e1e1]">{ticker}</span>
                    </div>
                )}
                {mode === 'coin' && (
                    <span className="text-xs text-[#6d6d6d]">KRW-BTC (Daily)</span>
                )}
            </div>

            {/* Right: Status & Window Controls */}
            <div className="flex items-center gap-4">
                {/* Data Status */}
                <div className="flex items-center gap-2 text-[10px]">
                    {isLoading ? (
                        <span className="text-[#007acc] animate-pulse">📊 Loading Data...</span>
                    ) : hasData ? (
                        <span className="text-[#4ec9b0]">✓ {hist['1d'].length} days loaded</span>
                    ) : (
                        <span className="text-[#666]">No data</span>
                    )}
                </div>

                {/* Auto Trade Button (Stock Mode Only) */}
                {mode === 'stock' && kisAuth.isLoggedIn && (
                    <button
                        onClick={() => setAutoTradeDialogOpen(true)}
                        className={`px-2 py-0.5 text-[11px] rounded flex items-center gap-1 border ${useStore.getState().autoTradeSettings.isEnabled
                            ? "bg-[#2d2d2d] border-green-700 text-green-500 hover:bg-[#333]"
                            : "bg-[#2d2d2d] border-[#3c3c3c] text-[#888888] hover:bg-[#333]"
                            }`}
                        title="자동 매매 설정"
                    >
                        <span>Auto Trade</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${useStore.getState().autoTradeSettings.isEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                            }`}></span>
                    </button>
                )}

                {/* KIS Login/Account Button */}
                {kisAuth.isLoggedIn ? (
                    <button
                        onClick={() => setAccountDialogOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-sm transition-colors border bg-[#2d2d2d] text-[#4ec9b0] border-[#4ec9b0] hover:bg-[#1e1e1e]"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>KIS 계좌</span>
                    </button>
                ) : (
                    <button
                        onClick={() => setLoginDialogOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-sm transition-colors border bg-transparent text-[#9d9d9d] border-transparent hover:text-[#e1e1e1] hover:bg-[#2d2d2d]"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                            <polyline points="10 17 15 12 10 7" />
                            <line x1="15" y1="12" x2="3" y2="12" />
                        </svg>
                        <span>KIS 로그인</span>
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

            {/* KIS Login Dialog */}
            <KISLoginDialog
                open={loginDialogOpen}
                onOpenChange={setLoginDialogOpen}
                onLogin={loginKIS}
            />

            {/* KIS Account Dialog */}
            <KISAccountDialog
                open={accountDialogOpen}
                onOpenChange={setAccountDialogOpen}
                kisAuth={kisAuth}
                onLogout={async () => {
                    await logoutKIS()
                }}
            />

            {/* Auto Trading Dialog */}
            <AutoTradingDialog
                isOpen={autoTradeDialogOpen}
                onOpenChange={setAutoTradeDialogOpen}
            />
        </div>
    )
}
