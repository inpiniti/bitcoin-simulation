import React, { useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Database, Play, CheckCircle2, XCircle, SkipForward, Loader2 } from 'lucide-react';

/**
 * 티커 그룹 옵션 목록
 * AutomationSettingsPanel의 그룹과 동일
 */
const TICKER_GROUPS = [
    { value: 'superinvestor', label: '🔥 투자그루 Top Picks' },
    { value: 'sp500', label: '🇺🇸 S&P 500' },
    { value: 'nasdaq100', label: '🇺🇸 Nasdaq 100 (QQQ)' },
    { value: 'usall', label: '🇺🇸 나스닥+뉴욕 전체' },
    { value: 'kospi200', label: '🇰🇷 KOSPI 200' },
    { value: 'kosdaq150', label: '🇰🇷 KOSDAQ 150' },
];

/**
 * 그룹 키에 해당하는 티커 목록을 가져오는 함수
 * useStore의 fetchGroupStocks 로직을 참고하여 독립적으로 구현
 */
async function fetchTickersByGroup(groupKey) {
    switch (groupKey) {
        case 'superinvestor': {
            const res = await fetch('/api/simple/dataroma');
            if (!res.ok) throw new Error('DataRoma 조회 실패');
            const json = await res.json();
            return (json.stocks || []).map(s => s.ticker);
        }
        case 'sp500': {
            const { fetchSP500Tickers } = await import('@/lib/sp500Data');
            const stocks = await fetchSP500Tickers();
            return stocks.map(s => s.ticker);
        }
        case 'nasdaq100': {
            const { fetchQQQTickers } = await import('@/lib/qqqData');
            const stocks = await fetchQQQTickers();
            return stocks.map(s => s.ticker);
        }
        case 'usall': {
            const { fetchUSAllTickers } = await import('@/lib/api');
            const stocks = await fetchUSAllTickers();
            return stocks.map(s => s.ticker);
        }
        case 'kospi200': {
            const { fetchKospi200Tickers } = await import('@/lib/api');
            const stocks = await fetchKospi200Tickers();
            return stocks.map(s => s.ticker);
        }
        case 'kosdaq150': {
            const { fetchKosdaq150Tickers } = await import('@/lib/api');
            const stocks = await fetchKosdaq150Tickers();
            return stocks.map(s => s.ticker);
        }
        default:
            return [];
    }
}

/**
 * DataSet 사전 생성 다이얼로그
 * 
 * 선택한 그룹의 티커를 순회하며 /api/simple/insertdataset을 호출하여
 * Supabase에 100일치 과거 데이터를 미리 저장합니다.
 * 
 * @param {Object} props
 * @param {boolean} props.open - 다이얼로그 열림 여부
 * @param {Function} props.onOpenChange - 열림 상태 변경 핸들러
 */
export function DataSetInitDialog({ open, onOpenChange }) {
    const [selectedGroup, setSelectedGroup] = useState('superinvestor');
    const [isRunning, setIsRunning] = useState(false);
    const [isLoadingTickers, setIsLoadingTickers] = useState(false);
    const [tickerCount, setTickerCount] = useState(0);
    const [progress, setProgress] = useState(0);
    const [currentTicker, setCurrentTicker] = useState('');
    const [logs, setLogs] = useState([]);

    const addLog = useCallback((ticker, status, message) => {
        setLogs(prev => [{ ticker, status, message, time: new Date().toLocaleTimeString() }, ...prev]);
    }, []);

    const handleRun = useCallback(async () => {
        setIsRunning(true);
        setLogs([]);
        setProgress(0);
        setCurrentTicker('');

        try {
            // 1. 그룹에 해당하는 티커 목록 가져오기
            setIsLoadingTickers(true);
            addLog('SYSTEM', 'info', `${TICKER_GROUPS.find(g => g.value === selectedGroup)?.label} 그룹 티커 조회 중...`);
            const tickers = await fetchTickersByGroup(selectedGroup);
            setIsLoadingTickers(false);

            if (!tickers || tickers.length === 0) {
                addLog('SYSTEM', 'error', '티커 목록이 비어 있습니다.');
                setIsRunning(false);
                return;
            }

            setTickerCount(tickers.length);
            addLog('SYSTEM', 'info', `총 ${tickers.length}개 티커 발견. DataSet 생성 시작...`);

            // 2. 10개씩 배치로 insertDataSet 호출
            const BATCH_SIZE = 10;
            let processed = 0;

            for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
                const batch = tickers.slice(i, i + BATCH_SIZE);
                setCurrentTicker(batch.join(', '));

                try {
                    const res = await fetch('/api/simple/insertdataset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tickers: batch })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        const results = data.results || [];
                        for (const r of results) {
                            if (r.status === 'inserted') {
                                addLog(r.ticker, 'success', `${r.count}일치 데이터 저장 완료`);
                            } else if (r.status === 'skipped') {
                                addLog(r.ticker, 'skipped', '이미 등록됨 (스킵)');
                            } else {
                                addLog(r.ticker, 'error', r.error || '알 수 없는 오류');
                            }
                        }
                    } else {
                        for (const t of batch) {
                            addLog(t, 'error', `API 오류 (${res.status})`);
                        }
                    }
                } catch (e) {
                    for (const t of batch) {
                        addLog(t, 'error', `네트워크 오류: ${e.message}`);
                    }
                }

                processed += batch.length;
                setProgress(Math.round((processed / tickers.length) * 100));
            }

            addLog('SYSTEM', 'info', `✅ 완료! ${tickers.length}개 티커 처리됨.`);

        } catch (e) {
            addLog('SYSTEM', 'error', `오류 발생: ${e.message}`);
        } finally {
            setIsRunning(false);
            setCurrentTicker('');
        }
    }, [selectedGroup, addLog]);

    const statusIcon = (status) => {
        switch (status) {
            case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
            case 'skipped': return <SkipForward className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
            case 'error': return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
            default: return <Database className="w-3.5 h-3.5 text-[#007acc] shrink-0" />;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col bg-[#252526] border-[#3c3c3c] text-[#cccccc]">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <Database className="w-5 h-5 text-[#007acc]" />
                        DataSet 사전 생성
                    </DialogTitle>
                    <DialogDescription className="text-[#858585]">
                        선택한 그룹의 모든 종목에 대해 100일치 과거 데이터를 Supabase에 미리 저장합니다.
                        이미 등록된 종목은 자동으로 스킵됩니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2 flex-1 min-h-0 flex flex-col">
                    {/* 그룹 선택 */}
                    <div className="space-y-2">
                        <Label className="text-[#cccccc]">대상 그룹 선택</Label>
                        <Select
                            value={selectedGroup}
                            onValueChange={setSelectedGroup}
                            disabled={isRunning}
                        >
                            <SelectTrigger className="bg-[#3c3c3c] border-[#555555] text-white">
                                <SelectValue placeholder="그룹을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#252526] border-[#3c3c3c] text-[#cccccc]">
                                {TICKER_GROUPS.map(g => (
                                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 진행 상태 */}
                    {isRunning && (
                        <div className="space-y-2 p-3 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c]">
                            <div className="flex justify-between text-sm">
                                <span className="text-[#858585]">진행률</span>
                                <span className="text-white font-medium">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                            {currentTicker && (
                                <p className="text-xs text-[#858585] flex items-center gap-1.5">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    처리 중: {currentTicker}
                                </p>
                            )}
                        </div>
                    )}

                    {/* 실행 로그 */}
                    {logs.length > 0 && (
                        <div className="flex-1 min-h-0">
                            <Label className="text-[#858585] text-xs mb-1 block">실행 로그 ({logs.length}건)</Label>
                            <ScrollArea className="h-[240px] border border-[#3c3c3c] rounded-lg bg-[#1e1e1e]">
                                <div className="p-2 space-y-1">
                                    {logs.map((log, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-xs py-0.5">
                                            {statusIcon(log.status)}
                                            <span className="text-[#858585] shrink-0 w-[60px]">{log.time}</span>
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] px-1.5 py-0 shrink-0 border-[#3c3c3c] text-[#d4d4d4]"
                                            >
                                                {log.ticker}
                                            </Badge>
                                            <span className="text-[#cccccc] break-all">{log.message}</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isRunning}
                        className="bg-[#3c3c3c] border-[#555555] text-[#cccccc] hover:bg-[#4a4a4a] hover:text-white"
                    >
                        닫기
                    </Button>
                    <Button
                        onClick={handleRun}
                        disabled={isRunning || isLoadingTickers}
                        className="bg-[#007acc] hover:bg-[#0062a3] text-white"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                생성 중...
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4 mr-2" />
                                DataSet 생성 시작
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
