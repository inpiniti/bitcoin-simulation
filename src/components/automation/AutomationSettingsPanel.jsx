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
import { Plus, Trash2, Edit, Save, RefreshCw, Eye, EyeOff, Bot } from 'lucide-react';
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
        fetchAiModels
    } = useStore();

    useEffect(() => {
        loadAutomationConfigs();
        fetchAiModels();
    }, []);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showSecret, setShowSecret] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        execution_time: '09:00',
        email: 'wjd0r@icloud.com',
        kis_account: '',
        kis_appkey: '',
        kis_secret: '',
        sell_condition: 20,
        buy_condition: 60,
        ai_model_key: '',
        ticker_group_key: 'superinvestor',
        is_active: true,
        trade_enabled: false
    });

    const resetForm = () => {
        setFormData({
            name: '',
            execution_time: '09:00',
            email: 'wjd0r@icloud.com',
            kis_account: '',
            kis_appkey: '',
            kis_secret: '',
            sell_condition: 20,
            buy_condition: 60,
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
            setFormData({
                name: config.name || '',
                execution_time: config.execution_time || '09:00',
                email: config.email || 'wjd0r@icloud.com',
                kis_account: config.kis_account || '',
                kis_appkey: config.kis_appkey || '',
                kis_secret: config.kis_secret || '',
                sell_condition: config.sell_condition || 20,
                buy_condition: config.buy_condition || 60,
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                        <Bot className="w-6 h-6 text-[#007acc]" />
                        자동 매매 봇 설정
                    </h2>
                    <p className="text-[#858585] text-sm mt-1">
                        Git Action 봇이 실행할 매매 시나리오를 관리합니다. (Supabase 저장)
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => loadAutomationConfigs()} disabled={loadingAutomation} className="bg-[#252526] border-[#3c3c3c] text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white">
                        <RefreshCw className={`w-4 h-4 mr-2 ${loadingAutomation ? 'animate-spin' : ''}`} />
                        새로고침
                    </Button>
                    <Button onClick={() => handleOpenDialog()} className="bg-[#007acc] hover:bg-[#0062a3] text-white border-none">
                        <Plus className="w-4 h-4 mr-2" />
                        새 설정 추가
                    </Button>
                </div>
            </div>

            <Card className="flex-1 flex flex-col bg-[#252526] border-[#3c3c3c]">
                <CardHeader>
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
                                                <Badge variant="outline" className="border-[#4ec9b0] text-[#4ec9b0] bg-[#4ec9b0]/10">{config.execution_time}</Badge>
                                            </TableCell>
                                            <TableCell className="text-[#ce9178]">{config.ticker_group_key}</TableCell>
                                            <TableCell className="text-[#dcdcaa]">{config.buy_condition > 0 ? `확률 > ${config.buy_condition}%` : '-'}</TableCell>
                                            <TableCell className="text-[#dcdcaa]">{config.sell_condition > 0 ? `수익 > ${config.sell_condition}%` : '-'}</TableCell>
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
                                <Label className="text-[#cccccc]">실행 시간 (Cron/Time)</Label>
                                <Input
                                    className="bg-[#3c3c3c] border-[#555555] text-white placeholder:text-[#666666]"
                                    placeholder="09:00"
                                    value={formData.execution_time}
                                    onChange={(e) => setFormData({ ...formData, execution_time: e.target.value })}
                                />
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

                        <div className="grid grid-cols-2 gap-4 p-4 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c]">
                            <div className="space-y-2">
                                <Label className="text-[#cccccc]">매수 조건 (확률 %)</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        className="bg-[#3c3c3c] border-[#555555] text-white"
                                        type="number"
                                        value={formData.buy_condition}
                                        onChange={(e) => setFormData({ ...formData, buy_condition: Number(e.target.value) })}
                                    />
                                    <span className="text-sm text-[#858585]">% 이상</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[#cccccc]">매도 조건 (수익률 %)</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        className="bg-[#3c3c3c] border-[#555555] text-white"
                                        type="number"
                                        value={formData.sell_condition}
                                        onChange={(e) => setFormData({ ...formData, sell_condition: Number(e.target.value) })}
                                    />
                                    <span className="text-sm text-[#858585]">% 도달 시</span>
                                </div>
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
        </div>
    );
}
