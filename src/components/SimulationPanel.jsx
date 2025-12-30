import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"

const STRATEGIES = [
    { key: 'fixed', label: '수량 고정', multiplier: null },
    { key: 'martingale_1.1', label: '1.1 마틴게일', multiplier: 1.1 },
    { key: 'martingale_1.2', label: '1.2 마틴게일', multiplier: 1.2 },
    { key: 'martingale_1.3', label: '1.3 마틴게일', multiplier: 1.3 },
    { key: 'martingale_1.4', label: '1.4 마틴게일', multiplier: 1.4 },
    { key: 'martingale_1.5', label: '1.5 마틴게일', multiplier: 1.5 },
    { key: 'martingale_2', label: '마틴게일', multiplier: 2 },
]

export function SimulationPanel() {
    const {
        activeInterval,
        hist,
        simul,
        loadingSimul,
        runFixedSimulation,
        runMartingaleSimulation,
        setSelectedResult
    } = useStore()

    const isDisabled = !activeInterval || hist[activeInterval]?.length === 0

    const handleClick = async (strategy) => {
        if (isDisabled) return

        const simulKey = strategy.multiplier
            ? `${activeInterval}_martingale_${strategy.multiplier}`
            : `${activeInterval}_fixed`

        const hasResult = simul[simulKey]

        if (hasResult) {
            // 이미 결과가 있으면 표시
            setSelectedResult({ key: simulKey, ...simul[simulKey] })
        } else {
            // 결과가 없으면 시뮬레이션 실행
            if (strategy.multiplier) {
                await runMartingaleSimulation(activeInterval, strategy.multiplier)
            } else {
                await runFixedSimulation(activeInterval)
            }
            // 실행 후 결과 표시
            const result = useStore.getState().simul[simulKey]
            if (result) {
                setSelectedResult({ key: simulKey, ...result })
            }
        }
    }

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-600">시뮬레이션 매매</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                {STRATEGIES.map((strategy) => {
                    const simulKey = strategy.multiplier
                        ? `${activeInterval}_martingale_${strategy.multiplier}`
                        : `${activeInterval}_fixed`

                    const hasResult = simul[simulKey]
                    const isLoading = loadingSimul[simulKey]

                    return (
                        <Button
                            key={strategy.key}
                            variant={hasResult ? "secondary" : "outline"}
                            className={cn(
                                "w-full justify-center",
                                isDisabled && "opacity-50 cursor-not-allowed",
                                hasResult && "bg-white hover:bg-gray-50 border",
                                !hasResult && !isDisabled && "bg-gray-100 text-gray-500"
                            )}
                            disabled={isDisabled || isLoading}
                            onClick={() => handleClick(strategy)}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    로딩 중...
                                </>
                            ) : (
                                strategy.label
                            )}
                        </Button>
                    )
                })}
            </CardContent>
        </Card>
    )
}
