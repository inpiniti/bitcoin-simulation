import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { Loader2, TrendingUp, Wallet, FileText, CheckCircle2 } from "lucide-react"
import {
    getOverseasBalance,
    getUnfilledOrders,
    getPeriodProfit
} from "@/lib/kisApi"

const MENU_ITEMS = [
    { id: 'account', label: '계좌정보', icon: Wallet },
    { id: 'balance', label: '잔고', icon: TrendingUp },
    { id: 'profit', label: '손익', icon: FileText },
    { id: 'orders', label: '체결', icon: CheckCircle2 },
]

export function KISAccountDialog({ open, onOpenChange, kisAuth, onLogout }) {
    const [activeMenu, setActiveMenu] = useState('account')
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState({
        balance: null,
        orders: null,
        profit: null,
    })

    // 데이터 로드
    useEffect(() => {
        if (open && kisAuth.isLoggedIn) {
            loadData()
        }
    }, [open, activeMenu])

    const loadData = async () => {
        setLoading(true)
        try {
            const { accessToken, appkey, appsecret, accountNo, accountCode } = kisAuth

            if (activeMenu === 'balance' || activeMenu === 'account') {
                const result = await getOverseasBalance(accessToken, appkey, appsecret, accountNo, accountCode)
                if (result.success) {
                    setData(prev => ({ ...prev, balance: result }))
                }
            } else if (activeMenu === 'orders') {
                const result = await getUnfilledOrders(accessToken, appkey, appsecret, accountNo, accountCode)
                if (result.success) {
                    setData(prev => ({ ...prev, orders: result }))
                }
            } else if (activeMenu === 'profit') {
                // 최근 30일 손익 (UTC가 아닌 로컬 시간 기준 날짜 사용)
                const now = new Date()
                const past = new Date(now)
                past.setDate(now.getDate() - 30)

                const formatDate = (d) => {
                    const year = d.getFullYear()
                    const month = String(d.getMonth() + 1).padStart(2, '0')
                    const day = String(d.getDate()).padStart(2, '0')
                    return `${year}${month}${day}`
                }

                const endDate = formatDate(now)
                const startDate = formatDate(past)

                const result = await getPeriodProfit(accessToken, appkey, appsecret, accountNo, accountCode, startDate, endDate)
                if (result.success) {
                    setData(prev => ({ ...prev, profit: result }))
                }
            }
        } catch (error) {
            console.error('데이터 로드 오류:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        if (onLogout) {
            onLogout()
            onOpenChange(false)
        }
    }

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-[#007acc]" />
                </div>
            )
        }

        switch (activeMenu) {
            case 'account':
                return renderAccountInfo()
            case 'balance':
                return renderBalance()
            case 'profit':
                return renderProfit()
            case 'orders':
                return renderOrders()
            default:
                return null
        }
    }

    const renderAccountInfo = () => {
        const { accountNo, accountCode, tokenExpiry } = kisAuth
        const summary = data.balance?.summary || {}

        return (
            <div className="">
                {/* 계좌 기본 정보 */}
                <div className="grid grid-cols-2 gap-3 p-3 border-b border-[#3c3c3c]">
                    <div className="space-y-0.5">
                        <div className="text-[10px] text-[#888888] uppercase tracking-wide">계좌번호</div>
                        <div className="text-[#cccccc] font-mono">{accountNo}-{accountCode}</div>
                    </div>
                    <div className="space-y-0.5">
                        <div className="text-[10px] text-[#888888] uppercase tracking-wide">토큰 만료</div>
                        <div className="text-[#cccccc]">{tokenExpiry}</div>
                    </div>
                </div>

                {/* 계좌 요약 정보 */}
                {summary.tot_asst_amt && (
                    <div className="space-y-2 p-3">
                        <div className="text-xs text-[#cccccc] font-semibold">계좌 요약</div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-0.5">
                                <div className="text-[10px] text-[#888888] uppercase tracking-wide">총 자산</div>
                                <div className="text-base text-[#4ec9b0] font-semibold">
                                    ₩{parseFloat(summary.tot_asst_amt || 0).toLocaleString()}
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-[10px] text-[#888888] uppercase tracking-wide">예수금</div>
                                <div className="text-base text-[#cccccc] font-semibold">
                                    ₩{parseFloat(summary.tot_dncl_amt || 0).toLocaleString()}
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-[10px] text-[#888888] uppercase tracking-wide">출금가능</div>
                                <div className="text-base text-[#cccccc] font-semibold">
                                    ₩{parseFloat(summary.wdrw_psbl_tot_amt || 0).toLocaleString()}
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-[10px] text-[#888888] uppercase tracking-wide">평가금액</div>
                                <div className="text-base text-[#cccccc] font-semibold">
                                    ₩{parseFloat(summary.evlu_amt_smtl || 0).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const renderBalance = () => {
        if (!data.balance) return <div className="text-[#888888] text-xs">데이터를 불러오는 중...</div>

        const { holdings, summary } = data.balance
        return (
            <div className="flex flex-col h-full">
                {/* 요약 정보 */}
                <div className="grid grid-cols-3 gap-3 p-3 border-b border-[#3c3c3c] flex-shrink-0">
                    <div className="space-y-0.5">
                        <div className="text-[10px] text-[#888888] uppercase tracking-wide">평가금액</div>
                        <div className="text-base text-[#4ec9b0] font-semibold">
                            ${parseFloat(summary.evlu_amt_smtl || 0).toLocaleString()}
                        </div>
                    </div>
                    <div className="space-y-0.5">
                        <div className="text-[10px] text-[#888888] uppercase tracking-wide">평가손익</div>
                        <div className={cn(
                            "text-base font-semibold",
                            parseFloat(summary.tot_evlu_pfls_amt || 0) >= 0 ? "text-[#4ec9b0]" : "text-[#f48771]"
                        )}>
                            ${parseFloat(summary.tot_evlu_pfls_amt || 0).toLocaleString()}
                        </div>
                    </div>
                    <div className="space-y-0.5">
                        <div className="text-[10px] text-[#888888] uppercase tracking-wide">수익률</div>
                        <div className={cn(
                            "text-base font-semibold",
                            parseFloat(summary.evlu_erng_rt1 || 0) >= 0 ? "text-[#4ec9b0]" : "text-[#f48771]"
                        )}>
                            {parseFloat(summary.evlu_erng_rt1 || 0).toFixed(2)}%
                        </div>
                    </div>
                </div>

                {/* 보유 종목 리스트 */}
                <div className="flex-1 overflow-y-auto">
                    {holdings.length === 0 ? (
                        <div className="text-[#888888] text-xs text-center py-8">보유 종목이 없습니다</div>
                    ) : (
                        <div>
                            {holdings.map((holding, idx) => (
                                <div
                                    key={idx}
                                    className="py-1.5 px-3 hover:bg-[#2d2d2d] border-b border-[#3c3c3c] last:border-b-0 transition-colors cursor-pointer flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <span className="text-xs text-[#cccccc] font-medium truncate">{holding.prdt_name}</span>
                                        <span className="text-[10px] text-[#888888] font-mono">{holding.pdno}</span>
                                        <span className="text-[10px] text-[#888888]">{Number(holding.ccld_qty_smtl1).toFixed(0)}주</span>
                                        <span className="text-[10px] text-[#888888]">${parseFloat(holding.avg_unpr3 || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] text-[#888888]">
                                            ${parseFloat(holding.frcr_evlu_amt2 || 0).toLocaleString()}
                                        </span>
                                        <span className={cn(
                                            "text-xs font-medium min-w-[100px] text-right",
                                            parseFloat(holding.evlu_pfls_amt2 || 0) >= 0 ? "text-[#4ec9b0]" : "text-[#f48771]"
                                        )}>
                                            {parseFloat(holding.evlu_pfls_amt2 || 0) >= 0 ? '+' : ''}
                                            ${parseFloat(holding.evlu_pfls_amt2 || 0).toFixed(2)} ({parseFloat(holding.evlu_pfls_rt1 || 0).toFixed(2)}%)
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const renderProfit = () => {
        if (!data.profit) return <div className="text-[#888888] text-xs">데이터를 불러오는 중...</div>

        const { profits, summary } = data.profit
        return (
            <div className="flex flex-col h-full">
                {/* 요약 정보 */}
                <div className="grid grid-cols-2 gap-3 p-3 border-b border-[#3c3c3c] flex-shrink-0">
                    <div className="space-y-0.5">
                        <div className="text-[10px] text-[#888888] uppercase tracking-wide">총 실현손익</div>
                        <div className={cn(
                            "text-base font-semibold",
                            parseFloat(summary.ovrs_rlzt_pfls_tot_amt || 0) >= 0 ? "text-[#4ec9b0]" : "text-[#f48771]"
                        )}>
                            ${parseFloat(summary.ovrs_rlzt_pfls_tot_amt || 0).toLocaleString()}
                        </div>
                    </div>
                    <div className="space-y-0.5">
                        <div className="text-[10px] text-[#888888] uppercase tracking-wide">총 수익률</div>
                        <div className={cn(
                            "text-base font-semibold",
                            parseFloat(summary.tot_pftrt || 0) >= 0 ? "text-[#4ec9b0]" : "text-[#f48771]"
                        )}>
                            {parseFloat(summary.tot_pftrt || 0).toFixed(2)}%
                        </div>
                    </div>
                </div>

                {/* 손익 리스트 */}
                <div className="flex-1 overflow-y-auto mt-3">
                    {profits.length === 0 ? (
                        <div className="text-[#888888] text-xs text-center py-8">손익 내역이 없습니다</div>
                    ) : (
                        <div>
                            {profits.map((profit, idx) => (
                                <div
                                    key={idx}
                                    className="py-1.5 px-3 hover:bg-[#2d2d2d] border-b border-[#3c3c3c] last:border-b-0 transition-colors cursor-pointer flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <span className="text-xs text-[#cccccc] font-medium truncate">{profit.ovrs_item_name}</span>
                                        <span className="text-[10px] text-[#888888]">{profit.trad_day}</span>
                                        <span className="text-[10px] text-[#888888]">{profit.slcl_qty}주</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] text-[#888888]">{parseFloat(profit.pftrt || 0).toFixed(2)}%</span>
                                        <span className={cn(
                                            "text-xs font-medium min-w-[80px] text-right",
                                            parseFloat(profit.ovrs_rlzt_pfls_amt || 0) >= 0 ? "text-[#4ec9b0]" : "text-[#f48771]"
                                        )}>
                                            {parseFloat(profit.ovrs_rlzt_pfls_amt || 0) >= 0 ? '+' : ''}
                                            ${parseFloat(profit.ovrs_rlzt_pfls_amt || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const renderOrders = () => {
        if (!data.orders) return <div className="text-[#888888] text-xs">데이터를 불러오는 중...</div>

        const { orders } = data.orders
        return (
            <div className="flex-1 overflow-y-auto">
                {orders.length === 0 ? (
                    <div className="text-[#888888] text-xs text-center py-8">미체결 주문이 없습니다</div>
                ) : (
                    <div>
                        {orders.map((order, idx) => (
                            <div
                                key={idx}
                                className="py-1.5 px-3 hover:bg-[#2d2d2d] border-b border-[#3c3c3c] last:border-b-0 transition-colors cursor-pointer flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <span className="text-xs text-[#cccccc] font-medium truncate">{order.prdt_name}</span>
                                    <span className="text-[10px] text-[#888888] font-mono">{order.pdno}</span>
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                        order.sll_buy_dvsn_cd === '02' ? "bg-[#4ec9b0]/20 text-[#4ec9b0]" : "bg-[#f48771]/20 text-[#f48771]"
                                    )}>
                                        {order.sll_buy_dvsn_cd_name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-[10px]">
                                    <span className="text-[#888888]">주문 {order.ft_ord_qty}</span>
                                    <span className="text-[#888888]">체결 {order.ft_ccld_qty}</span>
                                    <span className="text-[#007acc] font-medium">미체결 {order.nccs_qty}</span>
                                    <span className="text-[#888888] min-w-[60px] text-right">
                                        ${parseFloat(order.ft_ord_unpr3 || 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <>
            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/50 z-50"
                    onClick={() => onOpenChange(false)}
                />
            )}

            {/* Modal */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div
                        className="w-[900px] h-[600px] bg-[#252526] border border-[#3c3c3c] shadow-2xl flex flex-col pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c] bg-[#2d2d2d]">
                            <div className="text-xs text-[#cccccc] font-medium">한국투자증권 계좌</div>
                            <button
                                onClick={() => onOpenChange(false)}
                                className="text-[#cccccc] hover:text-white hover:bg-[#3c3c3c] p-1 rounded transition-colors"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex flex-1 overflow-hidden">
                            {/* Left Menu */}
                            <div className="w-40 border-r border-[#3c3c3c] bg-[#1e1e1e] flex flex-col">
                                <div className="flex-1 p-1">
                                    {MENU_ITEMS.map((item) => {
                                        const Icon = item.icon
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveMenu(item.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors mb-0.5",
                                                    activeMenu === item.id
                                                        ? "bg-[#37373d] text-white"
                                                        : "text-[#cccccc] hover:bg-[#2d2d2d]"
                                                )}
                                            >
                                                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span className="truncate">{item.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Logout Button */}
                                <div className="border-t border-[#3c3c3c] p-1">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-[#f48771] hover:bg-[#f48771]/10"
                                    >
                                        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                            <polyline points="16 17 21 12 16 7" />
                                            <line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                        <span className="truncate">로그아웃</span>
                                    </button>
                                </div>
                            </div>

                            {/* Right Content */}
                            <div className="flex-1 overflow-hidden bg-[#1e1e1e] flex flex-col">
                                {renderContent()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
