import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { KISLoginDialog } from '@/components/KISLoginDialog';
import { KISAccountDialog } from '@/components/KISAccountDialog';
import { KISOrderDialog } from '@/components/KISOrderDialog';
import { GlobalAlertDialog } from '@/components/GlobalAlertDialog';
import { Search, Zap, Menu, X, RotateCcw, ChevronDown, Terminal, Layers, Maximize2, Minimize2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://younginpiniti-bitcoin-ai-backend.hf.space';
const PING_INTERVAL_MS = 60_000; // 1분마다 상태 확인

// ── 로그 라인 컬러링 ─────────────────────────────────────
function colorizeLog(text) {
  if (!text) return { text: '', color: '#c9d1d9' };
  const lower = text.toLowerCase();
  if (lower.includes('error') || lower.includes('exception') || lower.includes('traceback') || lower.includes('failed'))
    return { text, color: '#f85149' };
  if (lower.includes('warning') || lower.includes('warn'))
    return { text, color: '#e3b341' };
  if (lower.includes('info') || lower.includes('started') || lower.includes('running') || lower.includes('success') || lower.includes('ok'))
    return { text, color: '#3fb950' };
  if (lower.includes('debug'))
    return { text, color: '#8b949e' };
  return { text, color: '#c9d1d9' };
}

// ── 서버 로그 터미널 패널 ──────────────────────────────────
function ServerLogPanel({ logType, onClose }) {
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState('connecting'); // connecting | streaming | error | closed
  const [autoScroll, setAutoScroll] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [maximized, setMaximized] = useState(false);
  const bodyRef = useRef(null);
  const esRef = useRef(null);
  const lineCountRef = useRef(0);

  const title = logType === 'run' ? '컨테이너 로그' : '빌드 로그';
  const icon = logType === 'run' ? <Terminal className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />;

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setLines([]);
    lineCountRef.current = 0;
    setStatus('connecting');
    setErrorMsg('');

    // Vite 프록시를 통해 SSE 연결
    const es = new EventSource(`/api/hf-logs/${logType}`);
    esRef.current = es;

    es.onopen = () => setStatus('streaming');

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.error) {
          setStatus('error');
          setErrorMsg(data.error);
          es.close();
          return;
        }
        // HF log format: { timestamp, type, data } 또는 plain text
        const raw = data.data ?? data.message ?? e.data;
        if (!raw) return;
        lineCountRef.current += 1;
        setLines(prev => {
          const next = [...prev, { id: lineCountRef.current, raw, ...colorizeLog(raw) }];
          // 최대 2000 라인 유지
          return next.length > 2000 ? next.slice(next.length - 2000) : next;
        });
      } catch {
        // 파싱 실패 시 원문 그대로
        lineCountRef.current += 1;
        const raw = e.data;
        setLines(prev => {
          const next = [...prev, { id: lineCountRef.current, raw, ...colorizeLog(raw) }];
          return next.length > 2000 ? next.slice(next.length - 2000) : next;
        });
      }
    };

    es.onerror = () => {
      // 데이터를 받은 뒤 닫힌 경우 → 정상 종료 (빌드/컨테이너 완료)
      // 데이터 없이 닫힌 경우 → 실제 오류
      if (lineCountRef.current > 0) {
        setStatus('closed');
      } else {
        setStatus('error');
        setErrorMsg('스트림에 연결할 수 없습니다.');
      }
      es.close();
    };
  }, [logType]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  // 자동 스크롤
  useEffect(() => {
    if (autoScroll && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = () => {
    if (!bodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = bodyRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  const statusDot = {
    connecting: <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />,
    streaming: <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />,
    error: <span className="w-2 h-2 rounded-full bg-red-400" />,
    closed: <span className="w-2 h-2 rounded-full bg-gray-400" />,
  }[status];

  const statusText = {
    connecting: '연결 중...',
    streaming: `스트리밍 중 · ${lines.length}줄`,
    error: `오류: ${errorMsg}`,
    closed: `스트림 종료 · ${lines.length}줄`,
  }[status];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
      style={{ height: maximized ? 'calc(100vh - 35px)' : '340px' }}
    >
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-t border-[#30363d] shrink-0 select-none">
        <div className="flex items-center gap-2 text-[12px] text-[#8b949e]">
          <span className="flex items-center gap-1 text-[#c9d1d9] font-medium">
            {icon}
            {title}
          </span>
          <span className="w-px h-3 bg-[#30363d]" />
          {statusDot}
          <span className={status === 'error' ? 'text-red-400' : ''}>{statusText}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoScroll(v => !v)}
            title="자동 스크롤"
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border transition-colors',
              autoScroll
                ? 'border-[#388bfd] text-[#388bfd] bg-[#388bfd1a]'
                : 'border-[#30363d] text-[#8b949e] hover:border-[#8b949e]'
            )}
          >
            <ChevronDown className="w-3 h-3" />
            Auto
          </button>
          <button
            onClick={() => setLines([])}
            title="지우기"
            className="px-2 py-0.5 text-[10px] border border-[#30363d] text-[#8b949e] rounded hover:border-[#8b949e] transition-colors"
          >
            지우기
          </button>
          <button
            onClick={connect}
            title="재연결"
            className="p-1 text-[#8b949e] hover:text-[#c9d1d9] transition-colors rounded hover:bg-[#21262d]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMaximized(v => !v)}
            title={maximized ? '원래 크기로' : '전체 화면'}
            className="p-1 text-[#8b949e] hover:text-[#c9d1d9] transition-colors rounded hover:bg-[#21262d]"
          >
            {maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            title="닫기"
            className="p-1 text-[#8b949e] hover:text-[#c9d1d9] transition-colors rounded hover:bg-[#21262d]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 로그 본문 */}
      <div
        ref={bodyRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-[#0d1117] px-3 py-2 font-mono text-[11px] leading-5 select-text cursor-text"
        style={{ fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace' }}
      >
        {lines.length === 0 && status === 'connecting' && (
          <div className="text-[#8b949e] animate-pulse">HuggingFace Space 로그 스트림에 연결 중...</div>
        )}
        {lines.map(line => (
          <div key={line.id} style={{ color: line.color }}>
            {line.raw}
          </div>
        ))}
        {status === 'closed' && (
          <div className="mt-2 text-[#8b949e] border-t border-[#21262d] pt-2">
            ─ 스트림이 종료되었습니다.
          </div>
        )}
        {status === 'error' && (
          <div className="mt-2 text-red-400">
            ⚠ {errorMsg}
            <button onClick={connect} className="ml-2 underline hover:no-underline">재연결</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ServerStatus() {
  const [status, setStatus] = useState('checking'); // "checking" | "online" | "offline" | "waking"
  const [logPanel, setLogPanel] = useState(null); // null | 'run' | 'build'

  const checkStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) { setStatus('offline'); return; }
      const data = await res.json().catch(() => null);
      setStatus(data?.status === 'ok' ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    }
  };

  const wakeServer = async () => {
    setStatus('waking');
    try {
      await fetch(`${BACKEND_URL}/`, { signal: AbortSignal.timeout(30_000) });
    } catch {
      /* ignore */
    }
    setTimeout(checkStatus, 3000);
  };

  useEffect(() => {
    checkStatus();
    const id = setInterval(checkStatus, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const badge = (() => {
    if (status === 'checking')
      return (
        <div className="flex items-center gap-1 text-[10px] text-[#666] bg-[#252526] px-1.5 py-0.5 rounded border border-[#3e3e42]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#555] animate-pulse" />
          <span>Server...</span>
        </div>
      );
    if (status === 'waking')
      return (
        <div className="flex items-center gap-1 text-[10px] text-[#dac422] bg-[#3a3a2a] px-1.5 py-0.5 rounded border border-[#5a5a3a]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#dac422] animate-pulse" />
          <span>Waking...</span>
        </div>
      );
    if (status === 'online')
      return (
        <div className="flex items-center gap-1 text-[10px] text-[#4ec9b0] bg-[#252526] px-1.5 py-0.5 rounded border border-[#3e3e42]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ec9b0]" />
          <span>Server ON</span>
        </div>
      );
    // offline
    return (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1 text-[10px] text-[#f44747] bg-[#252526] px-1.5 py-0.5 rounded border border-[#3e3e42]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f44747]" />
          <span>Server OFF</span>
        </div>
        <button
          onClick={wakeServer}
          className="flex items-center gap-0.5 text-[10px] text-[#dac422] bg-[#3a3a2a] px-1.5 py-0.5 rounded border border-[#5a5a3a] hover:bg-[#4a4a3a] transition-colors"
          title="서버 깨우기"
        >
          <Zap className="w-2.5 h-2.5" />
          <span>Wake</span>
        </button>
      </div>
    );
  })();

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>{badge}</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => window.open(`${BACKEND_URL}/redoc`, '_blank')}
          >
            서버 API 문서
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setLogPanel('run')}>
            <Terminal className="w-3.5 h-3.5 mr-2 text-green-400" />
            컨테이너 로그
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setLogPanel('build')}>
            <Layers className="w-3.5 h-3.5 mr-2 text-blue-400" />
            빌드 로그
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {logPanel && (
        <ServerLogPanel
          logType={logPanel}
          onClose={() => setLogPanel(null)}
        />
      )}
    </>
  );
}

/**
 * 애플리케이션 상단 타이틀 바 컴포넌트입니다.
 * 모드 전환(코인/주식), 간격 선택, 데이터 로딩 상태 표시, 자동 매매 제어 및 KIS 계좌 연동을 담당합니다.
 *
 * @component
 * @returns {JSX.Element} 타이틀 바
 */
export function TitleBar() {
  const {
    ticker,
    setTicker,
    openTicker,
    recommendedStocks,
    loadingRecommendations,
    loadRecommendedTickers,
    loadDailyData,
    hist,
    loadingInterval,
    tickerGroup,
    setTickerGroup,
    groupStocks,
    setGroupStocks,
    loadingGroupStocks,
    setLoadingGroupStocks, // Store에서 가져옴
    kisAuth,
    loginKIS,
    logoutKIS,
    reloginKIS,
    interval,
    setInterval,
    toggleSidebar,
  } = useStore();
  const [localTicker, setLocalTicker] = useState(ticker);
  const [filterText, setFilterText] = useState(''); // 드롭다운 필터용 (포커스 시 리셋)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const skipBlurRef = useRef(false);

  const isLoading = loadingInterval[interval] || loadingInterval['STOCK_BASE'];
  const hasData = (hist[interval]?.length || 0) > 0;

  // 로컬 Alert 상태 관리
  const [alertConfig, setAlertConfig] = useState({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // 추천 종목 로드 (앱 시작 시 한 번만)
  useEffect(() => {
    loadRecommendedTickers();
  }, []);

  const { fetchGroupStocks } = useStore();

  // 티커 그룹 변경 시 종목 리스트 로드
  useEffect(() => {
    fetchGroupStocks();
  }, [tickerGroup, kisAuth.isLoggedIn, recommendedStocks]); // recommendedStocks 변경 시 반영

  const openAlert = (title, description, onConfirm, onCancel = null) => {
    setAlertConfig({
      open: true,
      title,
      description,
      onConfirm: () => {
        onConfirm();
        setAlertConfig((prev) => ({ ...prev, open: false }));
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setAlertConfig((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleTickerSubmit = (e) => {
    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();

      if (localTicker !== ticker) {
        skipBlurRef.current = true;
        openAlert(
          '종목 변경',
          `종목을 '${localTicker}'(으)로 변경하시겠습니까? 데이터가 초기화됩니다.`,
          () => {
            setTicker(localTicker);
            skipBlurRef.current = false;
          },
          () => {
            setLocalTicker(ticker);
            skipBlurRef.current = false;
          },
        );
      }
    }
  };

  const handleTickerBlur = () => {
    if (skipBlurRef.current) return;
    if (localTicker !== ticker) {
      setLocalTicker(ticker);
    }
  };

  return (
    <div className="h-[35px] bg-[#1e1e1e] flex items-center justify-between px-3 select-none border-b border-[#2b2b2b] shrink-0">
      {/* Left: App Title & Menu */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-1 rounded text-[#9d9d9d] hover:text-white hover:bg-[#2d2d2d] transition-colors"
          title="사이드바 토글"
        >
          <Menu className="w-4 h-4" />
        </button>

        <span className="text-[#4ec9b0] font-bold text-[13px] flex items-center gap-1.5">
          <img src="/stock.svg" className="w-3.5 h-3.5" alt="Icon" />
          주식 시뮬 v2.0
        </span>

        <div className="flex bg-[#252526] rounded-md p-0.5 border border-[#3e3e42]">
          <button
            onClick={() => setInterval('1d')}
            className={cn(
              'px-2 py-0.5 text-[10px] rounded-sm transition-colors',
              useStore.getState().interval === '1d'
                ? 'bg-[#424242] text-white font-medium'
                : 'text-[#777777] hover:text-[#cccccc]',
            )}
          >
            Day
          </button>
          <button
            onClick={() => setInterval('1m')}
            className={cn(
              'px-2 py-0.5 text-[10px] rounded-sm transition-colors',
              useStore.getState().interval === '1m'
                ? 'bg-[#424242] text-white font-medium'
                : 'text-[#777777] hover:text-[#cccccc]',
            )}
          >
            Min
          </button>
        </div>

        <ServerStatus />
      </div>

      {/* Center: Stock Ticker Input */}
      <div className="flex-1 flex justify-center items-center">
        <div className="flex items-center gap-2 relative">
          <span className="text-xs font-bold text-[#e1e1e1]">
            {useStore.getState().tickerNames[ticker]
              ? `${useStore.getState().tickerNames[ticker]} (${ticker})`
              : ticker}
          </span>
        </div>
      </div>

      {/* Right: Status & Window Controls */}
      <div className="flex items-center gap-4">
        {/* Data Status */}
        <div className="flex items-center gap-2 text-[10px]">
          {isLoading ? (
            <span className="text-[#007acc] animate-pulse">
              📊 Loading Data...
            </span>
          ) : hasData ? (
            <span className="text-[#4ec9b0]">
              ✓ {hist[interval].length} {interval === '1m' ? 'minutes' : 'days'}{' '}
              loaded
            </span>
          ) : (
            <span className="text-[#666]">No data</span>
          )}
        </div>

        {/* KIS Login/Account Button */}
        {kisAuth.isLoggedIn ? (
          <button
            onClick={() => setAccountDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-sm transition-colors border bg-[#2d2d2d] text-[#4ec9b0] border-[#4ec9b0] hover:bg-[#1e1e1e]"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>KIS 계좌</span>
          </button>
        ) : (
          <button
            onClick={() => setLoginDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-sm transition-colors border bg-transparent text-[#9d9d9d] border-transparent hover:text-[#e1e1e1] hover:bg-[#2d2d2d]"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            <span>KIS 로그인</span>
          </button>
        )}
      </div>

      {/* TitleBar Local Alert Dialog */}
      <AlertDialog
        open={alertConfig.open}
        onOpenChange={(open) =>
          !open && setAlertConfig((prev) => ({ ...prev, open: false }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={alertConfig.onCancel}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={alertConfig.onConfirm}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* KIS Login Dialog */}
      <KISLoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
        onLogin={loginKIS}
      />

      {/* KIS Account Dialog */}
      <KISAccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        kisAuth={kisAuth}
        onLogout={async () => {
          await logoutKIS();
        }}
        onRelogin={async () => {
          return await reloginKIS();
        }}
      />

    </div>
  );
}
