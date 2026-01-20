import { cn } from "@/lib/utils"
import { useState } from "react"
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
import { Loader2, LogIn, LogOut } from "lucide-react"

/**
 * 한국투자증권 API 로그인을 위한 다이얼로그 컴포넌트입니다.
 * 앱키, 앱시크릿, 계좌번호, 상품코드를 입력받아 액세스 토큰을 발급받습니다.
 * 
 * @component
 * @param {Object} props - 컴포넌트 props
 * @param {boolean} props.open - 다이얼로그 열림 상태
 * @param {function} props.onOpenChange - 다이얼로그 상태 변경 핸들러
 * @param {function} props.onLogin - 로그인 처리 함수
 * @returns {JSX.Element} KIS 로그인 다이얼로그
 */
export function KISLoginDialog({ open, onOpenChange, onLogin }) {
    const [appkey, setAppkey] = useState('')
    const [appsecret, setAppsecret] = useState('')
    const [accountNo, setAccountNo] = useState('')
    const [accountCode, setAccountCode] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        // 유효성 검사
        if (!appkey || !appsecret || !accountNo || !accountCode) {
            setError('모든 필드를 입력해주세요.')
            return
        }

        if (accountNo.length !== 8) {
            setError('계좌번호는 8자리여야 합니다.')
            return
        }

        if (accountCode.length !== 2) {
            setError('계좌상품코드는 2자리여야 합니다.')
            return
        }

        setIsLoading(true)

        try {
            const result = await onLogin(appkey, appsecret, accountNo, accountCode)

            if (result.success) {
                // 성공 시 다이얼로그 닫기 및 입력 필드 초기화
                setAppkey('')
                setAppsecret('')
                setAccountNo('')
                setAccountCode('')
                onOpenChange(false)
            } else {
                setError(result.error || '로그인에 실패했습니다.')
            }
        } catch (err) {
            setError(err.message || '로그인 중 오류가 발생했습니다.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-[#252526] border-[#3c3c3c]">
                <DialogHeader>
                    <DialogTitle className="text-[#cccccc] flex items-center gap-2">
                        <LogIn className="w-5 h-5 text-[#007acc]" />
                        한국투자증권 로그인
                    </DialogTitle>
                    <DialogDescription className="text-[#888888]">
                        API 키와 계좌 정보를 입력하여 로그인하세요.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="appkey" className="text-[#cccccc] text-xs">
                            앱키 (App Key)
                        </Label>
                        <Input
                            id="appkey"
                            type="password"
                            value={appkey}
                            onChange={(e) => setAppkey(e.target.value)}
                            placeholder="앱키를 입력하세요"
                            className="bg-[#1e1e1e] border-[#3c3c3c] text-[#cccccc] focus:border-[#007acc]"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="appsecret" className="text-[#cccccc] text-xs">
                            앱 시크릿 (App Secret)
                        </Label>
                        <Input
                            id="appsecret"
                            type="password"
                            value={appsecret}
                            onChange={(e) => setAppsecret(e.target.value)}
                            placeholder="앱 시크릿을 입력하세요"
                            className="bg-[#1e1e1e] border-[#3c3c3c] text-[#cccccc] focus:border-[#007acc]"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="accountNo" className="text-[#cccccc] text-xs">
                                계좌번호 (8자리)
                            </Label>
                            <Input
                                id="accountNo"
                                type="text"
                                value={accountNo}
                                onChange={(e) => setAccountNo(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                placeholder="12345678"
                                maxLength={8}
                                className="bg-[#1e1e1e] border-[#3c3c3c] text-[#cccccc] focus:border-[#007acc]"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="accountCode" className="text-[#cccccc] text-xs">
                                상품코드 (2자리)
                            </Label>
                            <Input
                                id="accountCode"
                                type="text"
                                value={accountCode}
                                onChange={(e) => setAccountCode(e.target.value.replace(/\D/g, '').slice(0, 2))}
                                placeholder="01"
                                maxLength={2}
                                className="bg-[#1e1e1e] border-[#3c3c3c] text-[#cccccc] focus:border-[#007acc]"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/50 rounded px-3 py-2">
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                            className="text-[#cccccc] hover:bg-[#2d2d2d]"
                        >
                            취소
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-[#007acc] hover:bg-[#005a9e] text-white"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    로그인 중...
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-4 h-4 mr-2" />
                                    로그인
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
