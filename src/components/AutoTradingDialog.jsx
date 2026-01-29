import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useStore } from "@/store/useStore"
import { Check, Clock, PlayCircle, ShieldAlert } from "lucide-react"

/**
 * 자동 매매 설정을 위한 다이얼로그 컴포넌트입니다.
 * 매매 활성화 여부, 대상 그룹, 전략 필터, 주문 수량 및 실행 시점 등을 설정할 수 있습니다.
 * 
 * @component
 * @param {Object} props - 컴포넌트 props
 * @param {boolean} props.isOpen - 다이얼로그 열림 상태
 * @param {function} props.onOpenChange - 다이얼로그 상태 변경 핸들러
 * @returns {JSX.Element} 자동 매매 설정 다이얼로그
 */
export function AutoTradingDialog({ isOpen, onOpenChange }) {
    const {
        autoTradeSettings,
        setAutoTradeSettings,
        autoTradeStatus,
        kisAuth,
        setGlobalError
    } = useStore()

    const [isRunning, setIsRunning] = useState(false)

    // 헬퍼: 현재 설정된 값 업데이트
    const updateSetting = (key, value) => {
        // 활성화 시도 시 로그인 체크
        if (key === 'isEnabled' && value === true && !kisAuth.isLoggedIn) {
            setGlobalError({
                title: "로그인 필요",
                description: "자동 매매를 활성화하려면 KIS 증권 계좌 로그인이 필요합니다.\n먼저 로그인을 진행해주세요."
            });
            return;
        }
        setAutoTradeSettings({ [key]: value })
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-[#1e1e1e] border-[#3c3c3c] text-[#cccccc]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <PlayCircle className="w-5 h-5 text-green-500" />
                        자동 매매 설정 (Auto Trading)
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* 1. 사용 여부 */}
                    <div className="flex items-center justify-between p-3 bg-[#2d2d2d] rounded-lg border border-[#3c3c3c]">
                        <div className="flex flex-col">
                            <span className="font-bold text-white text-[14px]">자동 매매 활성화</span>
                            <span className="text-[12px] text-[#888888]">설정된 시간에 자동으로 매수/매도를 실행합니다.</span>
                        </div>
                        <Switch
                            checked={autoTradeSettings.isEnabled && kisAuth.isLoggedIn}
                            onCheckedChange={(v) => updateSetting('isEnabled', v)}
                        />
                    </div>

                    {!kisAuth.isLoggedIn && (
                        <div className="p-3 bg-red-900/10 border border-red-900/30 rounded-md flex gap-2 items-start">
                            <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5" />
                            <div className="text-[12px] text-red-400">
                                <strong>알림:</strong> KIS 연동이 활성화되지 않았습니다.<br />
                                로그인이 완료되어야 실제 자동 매매 기능이 활성화됩니다.
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* 2. 대상 그룹 설정 */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] text-[#888888]">분석 대상 그룹</label>
                            <Select
                                value={autoTradeSettings.targetGroup}
                                onValueChange={(v) => updateSetting('targetGroup', v)}
                            >
                                <SelectTrigger className="w-full bg-[#3c3c3c] border-[#555555] h-8 text-[12px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#252526] border-[#3c3c3c] text-[#cccccc]">
                                    <SelectItem value="myholdings">💼 내 보유종목 (보유분만 관리)</SelectItem>
                                    <SelectItem value="sp500">🇺🇸 S&P 500</SelectItem>
                                    <SelectItem value="qqq">🇺🇸 Nasdaq 100</SelectItem>
                                    <SelectItem value="superinvestor">🔥 투자그루 Top Picks</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 3. 매매 전략 설정 */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] text-[#888888]">매매 전략 (필터)</label>
                            <div className="grid grid-cols-2 gap-2 p-3 bg-[#2d2d2d] rounded-lg border border-[#3c3c3c]">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoTradeSettings.useBB}
                                        onChange={(e) => updateSetting('useBB', e.target.checked)}
                                        className="w-3.5 h-3.5 accent-blue-500"
                                    />
                                    <span className="text-[12px]">BB (볼린저)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoTradeSettings.useTrend}
                                        onChange={(e) => updateSetting('useTrend', e.target.checked)}
                                        className="w-3.5 h-3.5 accent-blue-500"
                                    />
                                    <span className="text-[12px]">추세 (MA50)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoTradeSettings.useTrend20}
                                        onChange={(e) => updateSetting('useTrend20', e.target.checked)}
                                        className="w-3.5 h-3.5 accent-blue-500"
                                    />
                                    <span className="text-[12px]">추세 (MA20)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoTradeSettings.useRSI}
                                        onChange={(e) => updateSetting('useRSI', e.target.checked)}
                                        className="w-3.5 h-3.5 accent-blue-500"
                                    />
                                    <span className="text-[12px]">RSI (과매수 방지)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer col-span-2">
                                    <input
                                        type="checkbox"
                                        checked={autoTradeSettings.useVolumeFilter}
                                        onChange={(e) => updateSetting('useVolumeFilter', e.target.checked)}
                                        className="w-3.5 h-3.5 accent-blue-500"
                                    />
                                    <span className="text-[12px]">거래량 필터 (VMA20 초과)</span>
                                </label>
                            </div>
                            <p className="text-[10px] text-[#666666]">
                                * 선택된 필터 조건을 모두 충족해야 매매 신호가 발생합니다.
                            </p>
                        </div>

                        {/* V-Martingale (강화 매수) 설정 */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] text-[#888888]">V-Martingale (강화 매수)</label>
                            <div className="p-3 bg-[#2d2d2d] rounded-lg border border-[#3c3c3c] space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoTradeSettings.useVMartingale}
                                        onChange={(e) => updateSetting('useVMartingale', e.target.checked)}
                                        className="w-3.5 h-3.5 accent-yellow-500"
                                    />
                                    <span className="text-[12px]">V-Martingale 활성화</span>
                                </label>
                                {autoTradeSettings.useVMartingale && (
                                    <div className="flex items-center gap-2 pl-5">
                                        <span className="text-[11px] text-[#888888]">최소 수익률</span>
                                        <Select
                                            value={String(autoTradeSettings.vMartingaleProfitCut)}
                                            onValueChange={(v) => updateSetting('vMartingaleProfitCut', parseFloat(v))}
                                        >
                                            <SelectTrigger className="w-[80px] bg-[#3c3c3c] border-[#555555] h-7 text-[11px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#252526] border-[#3c3c3c] text-[#cccccc]">
                                                <SelectItem value="1">+1%</SelectItem>
                                                <SelectItem value="2">+2%</SelectItem>
                                                <SelectItem value="3">+3%</SelectItem>
                                                <SelectItem value="5">+5%</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-[#666666]">
                                * 활성화 시 보유 종목도 V자 반등 시그널에 따라 추가 매수됩니다.
                            </p>
                        </div>

                        {/* 3. 주문 수량 설정 */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] text-[#888888]">매수 주문 설정</label>
                            <div className="flex gap-2">
                                <Select
                                    value={autoTradeSettings.amountType}
                                    onValueChange={(v) => updateSetting('amountType', v)}
                                >
                                    <SelectTrigger className="w-[120px] bg-[#3c3c3c] border-[#555555] h-8 text-[12px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#252526] border-[#3c3c3c] text-[#cccccc]">
                                        <SelectItem value="quantity">수량 (주)</SelectItem>
                                        <SelectItem value="amount">금액 ($)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input
                                    type="number"
                                    className="bg-[#3c3c3c] border-[#555555] h-8 text-[12px]"
                                    value={autoTradeSettings.buyAmount}
                                    onChange={(e) => updateSetting('buyAmount', Number(e.target.value))}
                                />
                            </div>
                            <p className="text-[10px] text-[#666666]">
                                * '금액' 선택 시 현재가로 환산하여 주문됩니다. 잔고 부족 시 실패할 수 있습니다.
                            </p>
                        </div>

                        {/* 4. 시간 설정 */}
                        <div className="space-y-1.5">
                            <label className="text-[12px] text-[#888888]">실행 시점 (장 마감 전)</label>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-[#888888]" />
                                <span className="text-[12px]">장 마감</span>
                                <Input
                                    type="number"
                                    className="w-16 bg-[#3c3c3c] border-[#555555] h-8 text-[12px] text-center"
                                    value={autoTradeSettings.executionTimeMinutes}
                                    onChange={(e) => updateSetting('executionTimeMinutes', Number(e.target.value))}
                                />
                                <span className="text-[12px]">분 전 실행</span>
                            </div>
                            <p className="text-[10px] text-[#666666]">
                                * 서머타임 자동 적용 (Winter 06:00 종료 / Summer 05:00 종료)
                            </p>
                        </div>
                    </div>

                    {/* 최근 로그 */}
                    <div className="bg-[#111111] p-2 rounded-md h-32 overflow-y-auto border border-[#333333]">
                        <div className="text-[11px] text-[#666666] mb-1 font-bold sticky top-0 bg-[#111111] w-full">최근 실행 로그</div>
                        {autoTradeStatus.logs.length === 0 ? (
                            <div className="text-[10px] text-[#444444] text-center mt-8">- 기록 없음 -</div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {autoTradeStatus.logs.map((log, i) => (
                                    <div key={i} className="text-[10px] text-[#999999] flex gap-2">
                                        <span className="text-[#555555] whitespace-nowrap">
                                            {new Date(log.time).toLocaleTimeString()}
                                        </span>
                                        <span>{log.message}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between pt-2">
                    <Button
                        variant="destructive"
                        size="sm"
                        disabled={isRunning}
                        className="h-8 text-[12px] bg-red-900/50 hover:bg-red-800 border border-red-800 text-red-200 disabled:opacity-50"
                        onClick={async () => {
                            if (!kisAuth.isLoggedIn) {
                                setGlobalError({
                                    title: "로그인 필요",
                                    description: "즉시 실행(테스트) 기능을 사용하려면 KIS 로그인이 필요합니다."
                                });
                                return;
                            }

                            if (!confirm('테스트 모드로 즉시 실행하시겠습니까?\n실제 매매는 발생하지 않으며(수량 0 처리), 분석 로직만 검증합니다.')) return;

                            setIsRunning(true);
                            try {
                                const { executeAutoTrade } = await import('@/lib/autoTradeLogic');
                                await executeAutoTrade(true); // isTest = true
                            } catch (e) {
                                console.error(e);
                            } finally {
                                setIsRunning(false);
                            }
                        }}
                    >
                        {isRunning ? "⏳ 실행 중..." : "⚡ 즉시 실행 (테스트)"}
                    </Button>

                    <Button
                        variant="secondary"
                        size="sm"
                        className="bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white h-8 text-[12px]"
                        onClick={() => onOpenChange(false)}
                    >
                        닫기
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
