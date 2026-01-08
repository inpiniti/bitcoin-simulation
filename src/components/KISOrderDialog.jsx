import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { useStore } from "@/store/useStore"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, DollarSign, ShoppingCart } from "lucide-react"
import { orderOverseasStock, getOverseasCurrentPrice } from "@/lib/kisApi"

export function KISOrderDialog({ open, onOpenChange, orderType, ticker, currentPrice }) {
    const { kisAuth } = useStore()
    const [price, setPrice] = useState('0')
    const [quantity, setQuantity] = useState('1')
    const [exchange, setExchange] = useState('NAS')
    const [isLoading, setIsLoading] = useState(false)
    const [isPriceLoading, setIsPriceLoading] = useState(false)
    const [error, setError] = useState('')
    const [resultMsg, setResultMsg] = useState('')

    // 다이얼로그 열릴 때 초기화
    useEffect(() => {
        if (open) {
            setPrice(currentPrice ? String(currentPrice) : '0')
            setQuantity('1')
            setExchange('NAS') // Default
            setError('')
            setResultMsg('')
        }
    }, [open, currentPrice])

    // 실시간 가격 조회 (exchange 변경 시에도 동작)
    useEffect(() => {
        const fetchRealtimePrice = async () => {
            if (!open || !kisAuth.isLoggedIn || !ticker) return

            setIsPriceLoading(true)
            try {
                const result = await getOverseasCurrentPrice(
                    kisAuth.accessToken,
                    kisAuth.appkey,
                    kisAuth.appsecret,
                    exchange,
                    ticker
                )

                if (result.success && result.price) {
                    setPrice(result.price)
                }
            } catch (e) {
                console.warn('실시간 가격 조회 실패:', e)
            } finally {
                setIsPriceLoading(false)
            }
        }

        fetchRealtimePrice()
    }, [open, exchange, kisAuth.isLoggedIn, ticker, kisAuth.accessToken])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setResultMsg('')

        if (!kisAuth.isLoggedIn) {
            setError('로그인이 필요합니다. (TitleBar > KIS 로그인)')
            return
        }

        if (Number(price) <= 0 || Number(quantity) <= 0) {
            setError('가격과 수량은 0보다 커야 합니다.')
            return
        }

        // KIS API 가격 요구사항: 소수점 2자리, 1$ 이상
        const numericPrice = Number(price)
        if (numericPrice < 1.0) {
            setError('주문 가격은 1$ 이상이어야 합니다.')
            return
        }

        const formattedPrice = numericPrice.toFixed(2)

        setIsLoading(true)

        try {
            const result = await orderOverseasStock(
                kisAuth.accessToken,
                kisAuth.appkey,
                kisAuth.appsecret,
                kisAuth.accountNo,
                kisAuth.accountCode,
                orderType.toLowerCase(), // 'buy' or 'sell'
                exchange,
                ticker,
                formattedPrice, // 포맷팅된 가격 사용
                quantity
            )

            if (result.success) {
                setResultMsg(`주문 전송 성공! (주문번호: ${result.orderNo})`)
                // 성공 후 2초 뒤 닫기
                setTimeout(() => onOpenChange(false), 2000)
            } else {
                setError(`주문 실패: ${result.error} (Code: ${result.code})`)
            }
        } catch (err) {
            setError(err.message || '주문 중 오류가 발생했습니다.')
        } finally {
            setIsLoading(false)
        }
    }

    const isBuy = orderType === 'buy'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] bg-[#252526] border-[#3c3c3c] text-[#cccccc]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <ShoppingCart className={cn("w-5 h-5", isBuy ? "text-red-500" : "text-blue-500")} />
                        <span className={isBuy ? "text-red-400" : "text-blue-400"}>
                            {isBuy ? '해외주식 매수' : '해외주식 매도'} ({ticker})
                        </span>
                    </DialogTitle>
                    <DialogDescription className="text-[#888888] text-xs">
                        주문 정보를 입력하고 주문을 실행하세요.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {/* 거래소 선택 */}
                    <div className="space-y-1">
                        <Label className="text-xs text-[#bbbbbb]">거래소</Label>
                        <Select value={exchange} onValueChange={setExchange} disabled={isLoading}>
                            <SelectTrigger className="bg-[#1e1e1e] border-[#3c3c3c] h-8 text-xs">
                                <SelectValue placeholder="거래소 선택" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#252526] border-[#3c3c3c] text-[#cccccc]">
                                <SelectItem value="NAS">NASD (나스닥)</SelectItem>
                                <SelectItem value="NYS">NYSE (뉴욕)</SelectItem>
                                <SelectItem value="AMS">AMEX (아멕스)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-[#bbbbbb]">
                                주문 단가 (USD)
                                {isPriceLoading && <Loader2 className="inline ml-2 w-3 h-3 animate-spin text-[#007acc]" />}
                            </Label>
                            <div className="relative">
                                <DollarSign className="absolute left-2 top-2.5 w-3 h-3 text-[#666]" />
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="pl-6 bg-[#1e1e1e] border-[#3c3c3c] h-8 text-xs"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-[#bbbbbb]">수량</Label>
                            <Input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="bg-[#1e1e1e] border-[#3c3c3c] h-8 text-xs"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div className="bg-[#1e1e1e] p-3 rounded text-xs space-y-1 border border-[#3c3c3c]">
                        <div className="flex justify-between">
                            <span className="text-[#888]">총 주문금액</span>
                            <span className="font-bold text-[#dcdcaa]">
                                $ {(Number(price) * Number(quantity)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[#888]">예상 수수료(0.25%)</span>
                            <span className="font-mono text-[#888]">
                                $ {(Number(price) * Number(quantity) * 0.0025).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {error && (
                        <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900/50">
                            {error}
                        </div>
                    )}

                    {resultMsg && (
                        <div className="text-xs text-green-400 bg-green-900/20 p-2 rounded border border-green-900/50">
                            {resultMsg}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading} className="h-8 text-[#cccccc] hover:bg-[#333]">
                            취소
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className={cn("h-8 text-white text-xs", isBuy ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700")}
                        >
                            {isLoading && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                            {isBuy ? '매수 주문 전송' : '매도 주문 전송'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
