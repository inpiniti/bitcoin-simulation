import { useState, useEffect } from "react"
import { useStore } from "@/store/useStore"
import { fetchNaverDiscussion, fetchStocktwitsDiscussion, fetchTossDiscussion } from "@/lib/discussionApi"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { MessageSquare, RefreshCw, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

function formatTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString();
}

export function StockDiscussionPanel() {
    const { ticker } = useStore()
    const [activeTab, setActiveTab] = useState('Naver') // 'Naver' | 'Stocktwits' | 'Reddit' | 'Yahoo' | 'Toss'
    const [discussions, setDiscussions] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const fetchData = async () => {
        if (!ticker) return;

        setLoading(true);
        setError(null);
        setDiscussions([]);

        try {
            let data = [];
            if (activeTab === 'Naver') {
                data = await fetchNaverDiscussion(ticker);
            } else if (activeTab === 'Stocktwits') {
                data = await fetchStocktwitsDiscussion(ticker);
            } else if (activeTab === 'Toss') {
                data = await fetchTossDiscussion(ticker);
            }
            // Sort by date desc
            data.sort((a, b) => new Date(b.date) - new Date(a.date));
            setDiscussions(data);
        } catch (err) {
            console.error(err);
            setError("데이터를 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [ticker, activeTab]);

    return (
        <div className="flex-1 bg-[#1e1e1e] flex flex-col h-full overflow-hidden">
            {/* Header / Tabs */}
            <div className="h-9 bg-[#252526] flex items-center border-b border-[#3c3c3c] px-4 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[13px] text-[#cccccc] mr-4">
                        <MessageSquare className="w-4 h-4 text-[#ce9178]" />
                        <span>STOCK DISCUSSION: {ticker}</span>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center h-full">
                        {['Naver', 'Stocktwits', 'Toss'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "text-xs px-3 h-9 border-b-2 transition-colors hover:bg-[#2d2d2d]",
                                    activeTab === tab
                                        ? "border-[#ce9178] text-white font-medium"
                                        : "border-transparent text-[#969696]"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#666]">
                        {discussions.length} posts
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-[#cccccc] hover:bg-[#3c3c3c]"
                        onClick={fetchData}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {loading && discussions.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80 z-10">
                        <span className="text-[#ce9178] text-sm flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Loading discussions...
                        </span>
                    </div>
                )}

                {error && (
                    <div className="p-8 text-center text-[#f14c4c] text-sm">
                        {error}
                    </div>
                )}

                {!loading && !error && discussions.length === 0 && (
                    <div className="p-8 text-center text-[#666] text-sm">
                        게시글이 없습니다.
                    </div>
                )}

                <ScrollArea className="h-full">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-[#3c3c3c] hover:bg-transparent">
                                <TableHead className="text-[#569cd6] text-[11px] h-8 w-[140px] sticky top-0 bg-[#1e1e1e]">Date</TableHead>
                                <TableHead className="text-[#569cd6] text-[11px] h-8 w-[120px] sticky top-0 bg-[#1e1e1e]">User</TableHead>
                                <TableHead className="text-[#569cd6] text-[11px] h-8 sticky top-0 bg-[#1e1e1e]">Content</TableHead>
                                <TableHead className="text-[#569cd6] text-[11px] h-8 w-[80px] text-center sticky top-0 bg-[#1e1e1e]">Sentiment</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {discussions.map((post) => (
                                <TableRow key={`${post.source}-${post.id}`} className="border-[#3c3c3c] hover:bg-[#2a2a2a] group">
                                    <TableCell className="font-mono text-[#858585] text-[10px] py-2 align-top w-[140px]">
                                        {formatTime(post.date)}
                                    </TableCell>
                                    <TableCell className="font-medium text-[#d4d4d4] text-[11px] py-2 align-top w-[120px] truncate">
                                        {post.user}
                                    </TableCell>
                                    <TableCell className="text-[#cccccc] text-[12px] py-2 align-top whitespace-pre-wrap leading-relaxed">
                                        <div className="max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
                                            {post.text}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center py-2 align-top w-[80px]">
                                        {post.sentiment === 'Bullish' && (
                                            <span className="text-[10px] bg-[#0c2d1c] text-[#4ec9b0] px-1.5 py-0.5 rounded border border-[#0f4a2a]">Bullish</span>
                                        )}
                                        {post.sentiment === 'Bearish' && (
                                            <span className="text-[10px] bg-[#3a0d0d] text-[#f14c4c] px-1.5 py-0.5 rounded border border-[#5a1d1d]">Bearish</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    )
}
