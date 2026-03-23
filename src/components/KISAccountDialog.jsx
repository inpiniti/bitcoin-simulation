import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { Loader2, TrendingUp, Wallet, FileText, CheckCircle2, History } from "lucide-react"
import {
    getOverseasBalance,
    getUnfilledOrders,
    getPeriodProfit
} from "@/lib/kisApi"
import { getTradeHistory, isSupabaseConfigured } from "@/lib/tradeHistoryService"

const MENU_ITEMS = [
    { id: 'account', label: '계좌정보', icon: Wallet },
    { id: 'balance', label: '잔고', icon: TrendingUp },
    { id: 'profit', label: '손익', icon: FileText },
    { id: 'orders', label: '체결', icon: CheckCircle2 },
    { id: 'history', label: '거래내역', icon: History },
]

export function KISAccountDialog({ open, onOpenChange, kisAuth, onLogout, onRelogin }) {
    const [activeMenu, setActiveMenu] = useState('account')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [data, setData] = useState({
        balance: null,
        orders: null,
        profit: null,
        history: null,
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
                    const filteredHoldings = (result.holdings || []).filter(h =>
                        Number(h.ccld_qty_smtl1) > 0 && parseFloat(h.frcr_evlu_amt2) > 0
                    )
                    setData(prev => ({ ...prev, balance: { ...result, holdings: filteredHoldings } }))
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
            } else if (activeMenu === 'history') {
                // 거래내역 조회 (Supabase)
                const fullAccountNo = `${accountNo}-${accountCode}`
                const result = await getTradeHistory(fullAccountNo, { limit: 50 })
                setData(prev => ({ ...prev, history: result }))
            }
        } catch (error) {
            console.error('데이터 로드 오류:', error)
            setError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
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

    // 재로그인 로딩 상태
    const [reloginLoading, setReloginLoading] = useState(false)

    const handleRelogin = async () => {
        if (onRelogin) {
            setReloginLoading(true)
            try {
                const result = await onRelogin()
                if (result.success) {
                    setError(null)
                    await loadData()
                } else {
                    console.error('재로그인 실패:', result.error)
                    setError('재로그인에 실패했습니다: ' + (result.error || '알 수 없는 오류'))
                }
            } catch (error) {
                console.error('재로그인 오류:', error)
                setError('재로그인 중 오류가 발생했습니다.')
            } finally {
                setReloginLoading(false)
            }
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
            case 'history':
                return renderHistory()
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

    const renderHistory = () => {
        // Supabase 미설정 시 안내 메시지
        if (!isSupabaseConfigured()) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center text-[#888888]">
                        <div className="text-sm mb-2">Supabase 설정이 필요합니다</div>
                        <div className="text-xs">
                            .env 파일에 VITE_SUPABASE_URL과<br />
                            VITE_SUPABASE_ANON_KEY를 설정해주세요
                        </div>
                    </div>
                </div>
            )
        }

        if (!data.history) {
            return <div className="text-[#888888] text-xs p-3">데이터를 불러오는 중...</div>
        }

        if (!data.history.success) {
            return <div className="text-red-400 text-xs p-3">조회 실패: {data.history.error}</div>
        }

        const records = data.history.data || []

        return (
            <div className="flex flex-col h-full">
                {/* 헤더 */}
                <div className="p-3 border-b border-[#3c3c3c] flex-shrink-0">
                    <div className="text-xs text-[#cccccc] font-semibold">
                        거래내역 ({records.length}건)
                    </div>
                </div>

                {/* 테이블 */}
                <div className="flex-1 overflow-auto">
                    {records.length === 0 ? (
                        <div className="text-[#888888] text-xs p-3 text-center">거래 내역이 없습니다</div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="bg-[#2d2d2d] sticky top-0">
                                <tr className="text-[#888888]">
                                    <th className="px-2 py-1.5 text-left font-medium">티커</th>
                                    <th className="px-2 py-1.5 text-left font-medium">매수일</th>
                                    <th className="px-2 py-1.5 text-right font-medium">매수가</th>
                                    <th className="px-2 py-1.5 text-left font-medium">매도일</th>
                                    <th className="px-2 py-1.5 text-right font-medium">매도가</th>
                                    <th className="px-2 py-1.5 text-right font-medium">수익률</th>
                                    <th className="px-2 py-1.5 text-center font-medium">상태</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((record) => {
                                    const profitColor = record.profit_rate > 0
                                        ? 'text-[#4ec9b0]'
                                        : record.profit_rate < 0
                                            ? 'text-[#f14c4c]'
                                            : 'text-[#cccccc]'

                                    const statusColor = record.status === 'COMPLETED'
                                        ? 'bg-[#4ec9b0]/20 text-[#4ec9b0]'
                                        : 'bg-[#007acc]/20 text-[#007acc]'

                                    return (
                                        <tr
                                            key={record.id}
                                            className="border-b border-[#3c3c3c] hover:bg-[#2d2d2d] transition-colors"
                                        >
                                            <td className="px-2 py-1.5 text-[#cccccc] font-medium">
                                                {record.ticker}
                                            </td>
                                            <td className="px-2 py-1.5 text-[#cccccc]">
                                                {record.buy_date ? new Date(record.buy_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-2 py-1.5 text-right text-[#cccccc]">
                                                {record.buy_price ? `$${parseFloat(record.buy_price).toFixed(2)}` : '-'}
                                            </td>
                                            <td className="px-2 py-1.5 text-[#cccccc]">
                                                {record.sell_date ? new Date(record.sell_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-2 py-1.5 text-right text-[#cccccc]">
                                                {record.sell_price ? `$${parseFloat(record.sell_price).toFixed(2)}` : '-'}
                                            </td>
                                            <td className={`px-2 py-1.5 text-right font-medium ${profitColor}`}>
                                                {record.profit_rate != null
                                                    ? `${record.profit_rate > 0 ? '+' : ''}${parseFloat(record.profit_rate).toFixed(2)}%`
                                                    : '-'
                                                }
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColor}`}>
                                                    {record.status === 'COMPLETED' ? '완료' : '보유중'}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
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
                        {/* 에러 배너 */}
                        {error && (
                            <div className="px-4 py-2 bg-[#5a1d1d] border-b border-[#f48771] text-[#f48771] text-xs flex items-center justify-between">
                                <span>{error}</span>
                                <button onClick={() => setError(null)} className="ml-2 hover:text-white">✕</button>
                            </div>
                        )}

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

                                {/* Relogin & Logout Buttons */}
                                <div className="border-t border-[#3c3c3c] p-1 space-y-0.5">
                                    {/* 재로그인 버튼 */}
                                    <button
                                        onClick={handleRelogin}
                                        disabled={reloginLoading}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-[#4ec9b0] hover:bg-[#4ec9b0]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {reloginLoading ? (
                                            <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
                                        ) : (
                                            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M23 4v6h-6" />
                                                <path d="M1 20v-6h6" />
                                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                            </svg>
                                        )}
                                        <span className="truncate">{reloginLoading ? '재로그인 중...' : '재로그인'}</span>
                                    </button>
                                    {/* 로그아웃 버튼 */}
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
