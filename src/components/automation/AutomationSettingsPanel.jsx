import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Edit, Save, RefreshCw, Eye, EyeOff, Bot, Database, ChevronDown, ChevronRight, ClipboardList, MessageCircle, CheckCircle2, XCircle } from 'lucide-react';
import { DataSetInitDialog } from './DataSetInitDialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';

/**
 * 자동 매매 봇 설정 패널 컴포넌트
 * 
 * Supabase의 `automation_settings` 테이블을 활용하여
 * 자동 매매 시나리오 설정(이름, 실행시간, 조건, API키 등)을 관리합니다.
 * 
 * @component
 * @returns {JSX.Element} AutomationSettingsPanel 컴포넌트
 */
export function AutomationSettingsPanel() {
    const {
        automationConfigList,
        loadAutomationConfigs,
        saveAutomationConfig,
        deleteAutomationConfig,
        loadingAutomation,
        aiModels,
        fetchAiModels,
        autoTradeDlLogs,
        loadingAutoTradeDlLogs,
        fetchAutoTradeDlLogs,
    } = useStore();

    useEffect(() => {
        loadAutomationConfigs();
        fetchAiModels();
        fetchAutoTradeDlLogs();
    }, []);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showSecret, setShowSecret] = useState(false);
    const [isDataSetDialogOpen, setIsDataSetDialogOpen] = useState(false);
    const [expandedLogId, setExpandedLogId] = useState(null);
    const [kakaoConnected, setKakaoConnected] = useState(false);

    // 카카오 OAuth 팝업 핸들러
    const handleKakaoConnect = () => {
        if (!editingId) return;
        const restApiKey = import.meta.env.VITE_KAKAO_REST_API_KEY;
        if (!restApiKey) return alert('VITE_KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.');
        const redirectUri = encodeURIComponent(`${window.location.origin}/api/kakao-callback`);
        const url = `https://kauth.kakao.com/oauth/authorize?client_id=${restApiKey}&redirect_uri=${redirectUri}&response_type=code&scope=talk_message&state=${editingId}`;

        const popup = window.open(url, 'kakao_oauth', 'width=500,height=650,scrollbars=yes');

        // 팝업에서 postMessage 수신
        const onMessage = (e) => {
            if (e.data === 'kakao_connected') {
                setKakaoConnected(true);
                loadAutomationConfigs();
                window.removeEventListener('message', onMessage);
            }
        };
        window.addEventListener('message', onMessage);

        // 팝업 닫힘 감지 (fallback)
        const timer = setInterval(() => {
            if (popup?.closed) {
                clearInterval(timer);
                window.removeEventListener('message', onMessage);
                loadAutomationConfigs();
            }
        }, 500);
    };

    // 미장 기준 실행 시간 옵션 (ET 기준, America/New_York 타임존으로 DST 자동 처리)
    const MARKET_TIME_OPTIONS = [
        { value: 'market_open',      label: '🔔 장 시작 (09:30 ET)',         desc: '개장 직후' },
        { value: 'market_open_30m',  label: '⏱ 장 시작 30분 후 (10:00 ET)', desc: '초기 변동성 안정 후' },
        { value: 'market_open_1h',   label: '⏱ 장 시작 1시간 후 (10:30 ET)', desc: '추천: 트렌드 확인 후 매수' },
        { value: 'market_close_2h',  label: '⏳ 장 마감 2시간 전 (14:00 ET)', desc: '여유있게 분석' },
        { value: 'market_close_1h',  label: '⏳ 장 마감 1시간 전 (15:00 ET)', desc: '추천: 당일 매도/매수 기본값' },
        { value: 'market_close_30m', label: '⚡ 장 마감 30분 전 (15:30 ET)',  desc: '마지막 기회' },
        { value: 'market_close',     label: '🔕 장 마감 시 (16:00 ET)',       desc: '장 종료 직후' },
    ];

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        execution_time: 'market_close_1h',
        email: 'wjd0r@icloud.com',
        kis_account: '',
        kis_appkey: '',
        kis_secret: '',
        sell_condition: 20,
        sell_profit_condition: 20,
        buy_condition: 60,
        prevent_loss_sell: false,
        ai_model_key: '',
        ticker_group_key: 'superinvestor',
        is_active: true,
        trade_enabled: false
    });

    const resetForm = () => {
        setFormData({
            name: '',
            execution_time: 'market_close_1h',
            email: 'wjd0r@icloud.com',
            kis_account: '',
            kis_appkey: '',
            kis_secret: '',
            sell_condition: 20,
            sell_profit_condition: 20,
            buy_condition: 60,
            prevent_loss_sell: false,
            ai_model_key: '',
            ticker_group_key: 'superinvestor',
            is_active: true,
            trade_enabled: false
        });
        setEditingId(null);
        setShowSecret(false);
    };

    const handleOpenDialog = (config = null) => {
        if (config) {
            setEditingId(config.id);
            setKakaoConnected(!!config.kakao_access_token);
            setFormData({
                name: config.name || '',
                execution_time: config.execution_time || 'market_close_1h',
                email: config.email || 'wjd0r@icloud.com',
                kis_account: config.kis_account || '',
                kis_appkey: config.kis_appkey || '',
                kis_secret: config.kis_secret || '',
                sell_condition: config.sell_condition ?? 20,
                sell_profit_condition: config.sell_profit_condition ?? 20,
                buy_condition: config.buy_condition || 60,
                prevent_loss_sell: !!config.prevent_loss_sell,
                ai_model_key: config.ai_model_key || '',
                ticker_group_key: config.ticker_group_key || 'superinvestor',
                is_active: config.is_active !== false,
                trade_enabled: !!config.trade_enabled
            });
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        // Validation
        if (!formData.name) return alert('설정 이름을 입력해주세요.');
        if (!formData.kis_appkey || !formData.kis_secret) return alert('KIS API 키를 입력해주세요.');

        const payload = { ...formData };
        if (editingId) payload.id = editingId;

        const result = await saveAutomationConfig(payload);
        if (result.success) {
            setIsDialogOpen(false);
            resetForm();
            // 백엔드 스케줄 즉시 반영 (비동기, 실패해도 무시)
            fetch('/api/reschedule', { method: 'POST' }).catch(() => {});
        } else {
            alert('저장 실패: ' + result.error);
        }
    };

    const handleDelete = async (id) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            await deleteAutomationConfig(id);
        }
    };

    return (
        <div className="h-full flex flex-col p-4 bg-[#1e1e1e] text-[#cccccc]">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                        <Bot className="w-6 h-6 text-[#007acc]" />
                        자동 매매 봇 설정
                    </h2>
                    <p className="text-[#858585] text-sm mt-1">
                        Git Action 봇이 실행할 매매 시나리오를 관리합니다. (Supabase 저장)
                    </p>
                </div>
            </div>

            <Tabs defaultValue="settings" className="flex-1 flex flex-col min-h-0">
                <TabsList className="bg-[#252526] border border-[#3c3c3c] mb-4 w-fit">
                    <TabsTrigger value="settings" className="data-[state=active]:bg-[#007acc] data-[state=active]:text-white text-[#858585]">
                        <Bot className="w-4 h-4 mr-2" />
                        설정 관리
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="data-[state=active]:bg-[#007acc] data-[state=active]:text-white text-[#858585]">
                        <ClipboardList className="w-4 h-4 mr-2" />
                        실행 로그
                    </TabsTrigger>
                </TabsList>

                {/* ── 설정 탭 ── */}
                <TabsContent value="settings" className="flex-1 flex flex-col min-h-0 mt-0">
                    <div className="flex justify-end gap-2 mb-3">
                        <Button variant="outline" size="sm" onClick={() => loadAutomationConfigs()} disabled={loadingAutomation} className="bg-[#252526] border-[#3c3c3c] text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white">
                            <RefreshCw className={`w-4 h-4 mr-2 ${loadingAutomation ? 'animate-spin' : ''}`} />
                            새로고침
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setIsDataSetDialogOpen(true)} className="bg-[#252526] border-[#3c3c3c] text-[#4ec9b0] hover:bg-[#3c3c3c] hover:text-white">
                            <Database className="w-4 h-4 mr-2" />
                            미리 데이터 생성
                        </Button>
                        <Button onClick={() => handleOpenDialog()} className="bg-[#007acc] hover:bg-[#0062a3] text-white border-none">
                            <Plus className="w-4 h-4 mr-2" />
                            새 설정 추가
                        </Button>
                    </div>

                    <Card className="flex-1 flex flex-col bg-[#252526] border-[#3c3c3c] min-h-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white">시나리오 목록</CardTitle>
                            <CardDescription className="text-[#858585]">등록된 자동 매매 설정 리스트입니다.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-[#3c3c3c] hover:bg-transparent">
                                            <TableHead className="text-[#858585]">이름</TableHead>
                                            <TableHead className="text-[#858585]">실행 시간</TableHead>
                                            <TableHead className="text-[#858585]">대상 그룹</TableHead>
                                            <TableHead className="text-[#858585]">매수 조건</TableHead>
                                            <TableHead className="text-[#858585]">매도 조건</TableHead>
                                            <TableHead className="text-[#858585]">스케줄</TableHead>
                                            <TableHead className="text-[#858585]">실제매매</TableHead>
                                            <TableHead className="text-right text-[#858585]">관리</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {automationConfigList.length === 0 ? (
                                            <TableRow className="border-[#3c3c3c]">
                                                <TableCell colSpan={7} className="text-center py-8 text-[#858585]">
                                                    등록된 설정이 없습니다. '새 설정 추가' 버튼을 눌러보세요.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            automationConfigList.map((config) => (
                                                <TableRow key={config.id} className="border-[#3c3c3c] hover:bg-[#2a2a2a]">
                                                    <TableCell className="font-medium text-[#d4d4d4]">{config.name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="border-[#4ec9b0] text-[#4ec9b0] bg-[#4ec9b0]/10">
                                                            {MARKET_TIME_OPTIONS.find(o => o.value === config.execution_time)?.label ?? config.execution_time}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-[#ce9178]">{config.ticker_group_key}</TableCell>
                                                    <TableCell className="text-[#dcdcaa]">{config.buy_condition > 0 ? `확률 > ${config.buy_condition}%` : '-'}</TableCell>
                                                    <TableCell className="text-[#dcdcaa]">
                                                        <div className="flex flex-col gap-0.5 text-xs">
                                                            <span>확률 ≤ {config.sell_condition ?? 20}%</span>
                                                            <span>수익 ≥ {config.sell_profit_condition ?? 20}%</span>
                                                            {config.prevent_loss_sell && <span className="text-[#569cd6]">🛡️ 손실매도방지</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={config.is_active ? 'bg-[#007acc] hover:bg-[#0062a3]' : 'bg-[#3c3c3c] text-[#858585] hover:bg-[#4a4a4a]'}>
                                                            {config.is_active ? 'ON' : 'OFF'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={config.trade_enabled ? 'border-orange-500 text-orange-500 bg-orange-500/10' : 'border-[#3c3c3c] text-[#858585]'}>
                                                            {config.trade_enabled ? '실제매매' : '모의매매'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(config)} className="hover:bg-[#3c3c3c]">
                                                                <Edit className="w-4 h-4 text-[#569cd6]" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(config.id)} className="hover:bg-[#3c3c3c]">
                                                                <Trash2 className="w-4 h-4 text-[#f14c4c]" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── 실행 로그 탭 ── */}
                <TabsContent value="logs" className="flex-1 flex flex-col min-h-0 mt-0">
                    <div className="flex justify-end mb-3">
                        <Button variant="outline" size="sm" onClick={() => fetchAutoTradeDlLogs()} disabled={loadingAutoTradeDlLogs} className="bg-[#252526] border-[#3c3c3c] text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white">
                            <RefreshCw className={`w-4 h-4 mr-2 ${loadingAutoTradeDlLogs ? 'animate-spin' : ''}`} />
                            새로고침
                        </Button>
                    </div>

                    <Card className="flex-1 flex flex-col bg-[#252526] border-[#3c3c3c] min-h-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white">실행 로그</CardTitle>
                            <CardDescription className="text-[#858585]">최근 50건의 자동매매 실행 기록입니다. 행을 클릭하면 상세 로그를 확인할 수 있습니다.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden">
                            <ScrollArea className="h-full">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-[#3c3c3c] hover:bg-transparent">
                                            <TableHead className="text-[#858585] w-8"></TableHead>
                                            <TableHead className="text-[#858585]">실행일시</TableHead>
                                            <TableHead className="text-[#858585]">구분</TableHead>
                                            <TableHead className="text-[#858585]">그룹</TableHead>
                                            <TableHead className="text-[#858585]">보유</TableHead>
                                            <TableHead className="text-[#858585]">매수신호</TableHead>
                                            <TableHead className="text-[#858585]">매도신호</TableHead>
                                            <TableHead className="text-[#858585]">매수주문</TableHead>
                                            <TableHead className="text-[#858585]">매도주문</TableHead>
                                            <TableHead className="text-[#858585]">상태</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {autoTradeDlLogs.length === 0 ? (
                                            <TableRow className="border-[#3c3c3c]">
                                                <TableCell colSpan={10} className="text-center py-8 text-[#858585]">
                                                    {loadingAutoTradeDlLogs ? '로딩 중...' : '실행 로그가 없습니다.'}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            autoTradeDlLogs.map((log) => (
                                                <React.Fragment key={log.id}>
                                                    <TableRow
                                                        className="border-[#3c3c3c] hover:bg-[#2a2a2a] cursor-pointer"
                                                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                                    >
                                                        <TableCell className="text-[#858585]">
                                                            {expandedLogId === log.id
                                                                ? <ChevronDown className="w-4 h-4" />
                                                                : <ChevronRight className="w-4 h-4" />}
                                                        </TableCell>
                                                        <TableCell className="text-[#d4d4d4] text-xs whitespace-nowrap">
                                                            {new Date(log.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={log.is_test ? 'border-[#569cd6] text-[#569cd6]' : 'border-orange-500 text-orange-500'}>
                                                                {log.is_test ? '테스트' : '실매매'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-[#ce9178] text-xs">{log.target_group ?? '-'}</TableCell>
                                                        <TableCell className="text-[#858585] text-center">{log.holdings_count ?? '-'}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge className={log.buy_signals > 0 ? 'bg-[#4ec9b0]/20 text-[#4ec9b0] border-[#4ec9b0]' : 'bg-transparent text-[#555] border-[#3c3c3c]'} variant="outline">
                                                                {log.buy_signals ?? 0}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge className={log.sell_signals > 0 ? 'bg-[#f14c4c]/20 text-[#f14c4c] border-[#f14c4c]' : 'bg-transparent text-[#555] border-[#3c3c3c]'} variant="outline">
                                                                {log.sell_signals ?? 0}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center text-[#4ec9b0] text-sm font-bold">{log.buy_orders ?? 0}</TableCell>
                                                        <TableCell className="text-center text-[#f14c4c] text-sm font-bold">{log.sell_orders ?? 0}</TableCell>
                                                        <TableCell>
                                                            {log.error
                                                                ? <Badge className="bg-[#f14c4c]/20 text-[#f14c4c] border-[#f14c4c]" variant="outline">오류</Badge>
                                                                : <Badge className="bg-[#4ec9b0]/20 text-[#4ec9b0] border-[#4ec9b0]" variant="outline">완료</Badge>}
                                                        </TableCell>
                                                    </TableRow>
                                                    {expandedLogId === log.id && (
                                                        <TableRow className="border-[#3c3c3c] bg-[#1a1a1a]">
                                                            <TableCell colSpan={10} className="p-0">
                                                                <div className="p-3 font-mono text-xs text-[#9cdcfe] space-y-0.5 max-h-64 overflow-y-auto">
                                                                    {log.error && (
                                                                        <div className="text-[#f14c4c] mb-2">⚠️ 오류: {log.error}</div>
                                                                    )}
                                                                    {(log.logs ?? []).map((line, i) => (
                                                                        <div key={i} className={
                                                                            line.includes('BUY') ? 'text-[#4ec9b0]' :
                                                                            line.includes('SELL') ? 'text-[#f14c4c]' :
                                                                            line.includes('오류') || line.includes('실패') ? 'text-[#f14c4c]' :
                                                                            'text-[#858585]'
                                                                        }>{line}</div>
                                                                    ))}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#252526] border-[#3c3c3c] text-[#cccccc]">
                    <DialogHeader>
                        <DialogTitle className="text-white">{editingId ? '설정 수정' : '새 자동 매매 설정 추가'}</DialogTitle>
                        <DialogDescription className="text-[#858585]">
                            봇이 실행할 매매 규칙과 API 키 정보를 입력하세요.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[#cccccc]">설정 이름 (Alias)</Label>
                                <Input
                                    className="bg-[#3c3c3c] border-[#555555] text-white placeholder:text-[#666666]"
                                    placeholder="예: 공격적 매매 전략 1"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[#cccccc]">실행 시간 (미장 기준 ET · DST 자동)</Label>
                                <Select
                                    value={formData.execution_time}
                                    onValueChange={(val) => setFormData({ ...formData, execution_time: val })}
                                >
                                    <SelectTrigger className="bg-[#3c3c3c] border-[#555555] text-white">
                                        <SelectValue placeholder="실행 시간 선택" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#252526] border-[#3c3c3c] text-[#cccccc]">
                                        {MARKET_TIME_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                <span>{opt.label}</span>
                                                <span className="ml-2 text-xs text-[#858585]">{opt.desc}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-[#858585]">썸머타임(EDT)/겨울(EST) 모두 자동 처리됩니다.</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c]">
                            <div className="space-y-0.5">
                                <Label className="text-white text-base">스케줄 활성화</Label>
                                <p className="text-[#858585] text-xs">정해진 시간에 자동으로 분석을 시작합니다.</p>
                            </div>
                            <Switch
                                checked={formData.is_active}
                                onCheckedChange={(val) => setFormData({ ...formData, is_active: val })}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded-lg border border-orange-900/30">
                            <div className="space-y-0.5">
                                <Label className="text-orange-500 text-base">실제 매매 활성화</Label>
                                <p className="text-[#858585] text-xs">체크 해제 시 실제 주문은 나가지 않고 리포트만 발송됩니다.</p>
                            </div>
                            <Switch
                                checked={formData.trade_enabled}
                                onCheckedChange={(val) => setFormData({ ...formData, trade_enabled: val })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[#cccccc]">알림 받을 이메일</Label>
                            <Input
                                className="bg-[#3c3c3c] border-[#555555] text-white placeholder:text-[#666666]"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        {/* 카카오톡 연동 */}
                        <div className="flex items-center justify-between p-4 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c]">
                            <div className="space-y-0.5">
                                <Label className="text-white text-base flex items-center gap-2">
                                    <MessageCircle className="w-4 h-4 text-[#FAE100]" />
                                    카카오톡 매매 리포트
                                </Label>
                                <p className="text-[#858585] text-xs">
                                    매매 실행 후 본인 카카오톡으로 결과를 전송합니다.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {kakaoConnected ? (
                                    <span className="flex items-center gap-1 text-[#4ec9b0] text-xs">
                                        <CheckCircle2 className="w-4 h-4" /> 연동됨
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[#858585] text-xs">
                                        <XCircle className="w-4 h-4" /> 미연동
                                    </span>
                                )}
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={!editingId}
                                    onClick={handleKakaoConnect}
                                    className="bg-[#FAE100] hover:bg-[#f0d800] text-black border-none text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {kakaoConnected ? '재연동' : '카카오 연동'}
                                </Button>
                            </div>
                        </div>
                        {!editingId && (
                            <p className="text-xs text-[#858585] -mt-2 ml-1">
                                💡 카카오 연동은 저장 후 수정 시 가능합니다.
                            </p>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[#cccccc]">티커 그룹 (Target)</Label>
                                <Select
                                    value={formData.ticker_group_key}
                                    onValueChange={(val) => setFormData({ ...formData, ticker_group_key: val })}
                                >
                                    <SelectTrigger className="bg-[#3c3c3c] border-[#555555] text-white">
                                        <SelectValue placeholder="그룹 선택" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#252526] border-[#3c3c3c] text-[#cccccc]">
                                        <SelectItem value="superinvestor">🔥 투자그루 Top Picks</SelectItem>
                                        <SelectItem value="indices">🌏 주요 지수 (Indices)</SelectItem>
                                        <SelectItem value="sp500">🇺🇸 S&P 500</SelectItem>
                                        <SelectItem value="nasdaq100">🇺🇸 Nasdaq 100 (QQQ)</SelectItem>
                                        <SelectItem value="usall">🇺🇸 나스닥+뉴욕 전체</SelectItem>
                                        <SelectItem value="kospi200">🇰🇷 KOSPI 200</SelectItem>
                                        <SelectItem value="kosdaq150">🇰🇷 KOSDAQ 150</SelectItem>
                                        <SelectItem value="myholdings">💼 내 보유종목</SelectItem>
                                        <SelectItem value="volumesurge">📊 거래량 급증</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[#cccccc]">AI 모델 (Model Key)</Label>
                                <Select
                                    value={formData.ai_model_key}
                                    onValueChange={(val) => setFormData({ ...formData, ai_model_key: val })}
                                >
                                    <SelectTrigger className="bg-[#3c3c3c] border-[#555555] text-white">
                                        <SelectValue placeholder="AI 모델 선택 (없으면 공란)" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#252526] border-[#3c3c3c] text-[#cccccc]">
                                        <SelectItem value="default">기본 모델</SelectItem>
                                        {aiModels.map(m => (
                                            <SelectItem key={m.id} value={m.id}>
                                                [{new Date(m.created_at).toLocaleDateString()}] {m.name || m.id} (정확도: {((m.accuracy || 0) * 100).toFixed(1)}%)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-3 p-4 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c]">
                            <Label className="text-white text-base font-semibold">매매 조건</Label>
                            <div className="grid grid-cols-2 gap-4">
                                {/* 매수 조건 */}
                                <div className="space-y-2">
                                    <Label className="text-[#4ec9b0] text-sm">📈 매수 — 확률</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            className="bg-[#3c3c3c] border-[#555555] text-white"
                                            type="number"
                                            value={formData.buy_condition}
                                            onChange={(e) => setFormData({ ...formData, buy_condition: Number(e.target.value) })}
                                        />
                                        <span className="text-sm text-[#858585] whitespace-nowrap">% 이상</span>
                                    </div>
                                </div>

                                {/* 매도 조건 — 확률 */}
                                <div className="space-y-2">
                                    <Label className="text-[#f14c4c] text-sm">📉 매도 — 확률 (OR)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            className="bg-[#3c3c3c] border-[#555555] text-white"
                                            type="number"
                                            value={formData.sell_condition}
                                            onChange={(e) => setFormData({ ...formData, sell_condition: Number(e.target.value) })}
                                        />
                                        <span className="text-sm text-[#858585] whitespace-nowrap">% 이하</span>
                                    </div>
                                    <p className="text-xs text-[#666]">모델이 상승 확률을 이 값 이하로 보면 매도</p>
                                </div>

                                {/* 매도 조건 — 수익률 */}
                                <div className="space-y-2 col-span-2">
                                    <Label className="text-[#dac422] text-sm">💰 매도 — 익절 수익률 (OR)</Label>
                                    <div className="flex items-center gap-2 max-w-[50%]">
                                        <Input
                                            className="bg-[#3c3c3c] border-[#555555] text-white"
                                            type="number"
                                            value={formData.sell_profit_condition}
                                            onChange={(e) => setFormData({ ...formData, sell_profit_condition: Number(e.target.value) })}
                                        />
                                        <span className="text-sm text-[#858585] whitespace-nowrap">% 이상 수익 시 익절</span>
                                    </div>
                                    <p className="text-xs text-[#666]">확률과 무관하게 수익률이 이 값 이상이면 매도</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-[#3c3c3c]">
                                <div className="space-y-0.5">
                                    <Label className="text-[#569cd6] text-sm">🛡️ 손실 중 매도 방지</Label>
                                    <p className="text-xs text-[#666]">현재가가 평균단가보다 낮으면 매도 신호가 와도 매도하지 않습니다.</p>
                                </div>
                                <Switch
                                    checked={formData.prevent_loss_sell}
                                    onCheckedChange={(val) => setFormData({ ...formData, prevent_loss_sell: val })}
                                />
                            </div>
                        </div>

                        <div className="space-y-4 border border-[#3c3c3c] p-4 rounded-lg bg-[#1e1e1e]">
                            <div className="flex justify-between items-center">
                                <Label className="text-base font-semibold text-white">KIS 한국투자증권 설정</Label>
                                <Button variant="ghost" size="sm" onClick={() => setShowSecret(!showSecret)} className="text-[#858585] hover:text-white hover:bg-[#3c3c3c]">
                                    {showSecret ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                                    키 보기
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[#cccccc]">계좌번호 (앞 8자리-뒤 2자리)</Label>
                                <Input
                                    className="bg-[#3c3c3c] border-[#555555] text-white placeholder:text-[#666666]"
                                    placeholder="12345678-01"
                                    value={formData.kis_account}
                                    onChange={(e) => setFormData({ ...formData, kis_account: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[#cccccc]">App Key</Label>
                                <Input
                                    className="bg-[#3c3c3c] border-[#555555] text-white"
                                    type={showSecret ? "text" : "password"}
                                    value={formData.kis_appkey}
                                    onChange={(e) => setFormData({ ...formData, kis_appkey: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[#cccccc]">App Secret</Label>
                                <Input
                                    className="bg-[#3c3c3c] border-[#555555] text-white"
                                    type={showSecret ? "text" : "password"}
                                    value={formData.kis_secret}
                                    onChange={(e) => setFormData({ ...formData, kis_secret: e.target.value })}
                                />
                                <p className="text-xs text-[#f14c4c] mt-1">
                                    주의: API 키는 Supabase 데이터베이스에 저장됩니다. (보안 유의)
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-[#3c3c3c] border-[#555555] text-[#cccccc] hover:bg-[#4a4a4a] hover:text-white">취소</Button>
                        <Button onClick={handleSave} className="bg-[#007acc] hover:bg-[#0062a3] text-white">
                            <Save className="w-4 h-4 mr-2" />
                            저장하기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataSetInitDialog open={isDataSetDialogOpen} onOpenChange={setIsDataSetDialogOpen} />
        </div>
    );
}
