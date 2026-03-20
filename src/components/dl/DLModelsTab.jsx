import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function DLModelsTab({ serverModels, loadingModels, onDeleteModel, onRefresh }) {
    return (
        <div className="space-y-4">
            <Card className="bg-[#252526] border-[#3c3c3c] text-[#e1e1e1]">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>저장된 모델 리스트</CardTitle>
                            <CardDescription className="text-[#888888]">Supabase 서버에 저장된 AI 모델들을 관리합니다.</CardDescription>
                        </div>
                        {onRefresh && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRefresh}
                                disabled={loadingModels}
                                className="border-[#3c3c3c] text-[#e1e1e1]"
                            >
                                {loadingModels ? "로딩 중..." : "새로고침"}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {serverModels.length === 0 ? (
                            <div className="col-span-full text-center p-12 text-[#666666] border border-dashed border-[#3c3c3c] rounded-lg">
                                저장된 모델이 없습니다. 먼저 학습을 진행해 주세요.
                            </div>
                        ) : (
                            serverModels.map(model => (
                                <div key={model.id} className="p-4 bg-[#1e1e1e] rounded border border-[#3c3c3c] hover:border-[#007acc] transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold truncate mr-2" title={model.name}>{model.name}</div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => onDeleteModel(model.id)}
                                        >
                                            <span className="text-xs">✕</span>
                                        </Button>
                                    </div>
                                    <div className="text-xs text-[#888888] space-y-1">
                                        <div className="flex justify-between">
                                            <span>정확도:</span>
                                            <span className="text-green-500 font-bold">{(model.accuracy * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>샘플 수:</span>
                                            <span className="text-[#e1e1e1]">{model.sample_count || model.sampleCount || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>만든 날짜:</span>
                                            <span className="text-[#e1e1e1]">{new Date(model.created_at || model.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
