import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { useState, useEffect, useRef } from 'react';
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
import { AutoTradingDialog } from '@/components/AutoTradingDialog';
import { Search, Clock, Zap } from 'lucide-react';
import { getMinutesUntilClose } from '@/lib/marketTime';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://younginpiniti-bitcoin-ai-backend.hf.space';
const PING_INTERVAL_MS = 60_000; // 1분마다 상태 확인

function ServerStatus() {
  const [status, setStatus] = useState('checking'); // "checking" | "online" | "offline" | "waking"

  const checkStatus = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/`, {
        signal: AbortSignal.timeout(8000),
      });
      setStatus(res.ok ? 'online' : 'offline');
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>{badge}</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => window.open(`${BACKEND_URL}/redoc`, '_blank')}
        >
          서버 page 이동 →
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function AutoTradeTimer({ executionTimeMinutes, isEnabled }) {
  const { reloginKIS } = useStore();
  const [timeLeft, setTimeLeft] = useState('');
  const reloginAttemptedRef = useRef(false); // 재로그인 중복 방지 플래그

  useEffect(() => {
    if (!isEnabled) return;

    const updateTimer = () => {
      const minUntilClose = getMinutesUntilClose();
      const minUntilExecution = minUntilClose - executionTimeMinutes;

      // 자동 매매 5분 전 재로그인 (토큰 만료 방지)
      if (minUntilExecution === 5 && !reloginAttemptedRef.current) {
        console.log('[AutoTrade] 실행 5분 전 KIS 재로그인 시도...');
        reloginKIS().then((result) => {
          if (result.success) {
            console.log('[AutoTrade] KIS 재로그인 성공');
          } else {
            console.error('[AutoTrade] KIS 재로그인 실패:', result.error);
          }
        });
        reloginAttemptedRef.current = true;
      }

      // 재로그인 플래그 리셋 (다음 날 실행을 위해 시간이 충분히 지났을 때)
      if (minUntilExecution > 30) {
        reloginAttemptedRef.current = false;
      }

      if (minUntilExecution > 0) {
        const hours = Math.floor(minUntilExecution / 60);
        const mins = minUntilExecution % 60;
        setTimeLeft(`${hours}h ${mins}m 후 실행`);
      } else if (minUntilExecution > -10) {
        setTimeLeft('실행 중/완료');
      } else {
        setTimeLeft('내일 실행 예정');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // 1분 갱신
    return () => clearInterval(interval);
  }, [executionTimeMinutes, isEnabled, reloginKIS]);

  if (!isEnabled || !timeLeft) return null;

  return (
    <div className="flex items-center gap-1 text-[10px] text-[#dac422] bg-[#3a3a2a] px-1.5 py-0.5 rounded border border-[#5a5a3a]">
      <Clock className="w-3 h-3" />
      <span>{timeLeft}</span>
    </div>
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
    mode,
    ticker,
    setMode,
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
  } = useStore();
  const [localTicker, setLocalTicker] = useState(ticker);
  const [filterText, setFilterText] = useState(''); // 드롭다운 필터용 (포커스 시 리셋)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [autoTradeDialogOpen, setAutoTradeDialogOpen] = useState(false);
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

  const handleModeChange = (newMode) => {
    if (mode === newMode) return;

    openAlert(
      '모드 변경',
      '모드를 변경하시겠습니까? 기존 데이터는 초기화됩니다.',
      () => setMode(newMode),
    );
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

        {/* Auto Trade Button (Stock Mode Only) */}
        {mode === 'stock' && (
          <div className="flex items-center gap-2">
            <AutoTradeTimer
              executionTimeMinutes={
                useStore.getState().autoTradeSettings.executionTimeMinutes
              }
              isEnabled={useStore.getState().autoTradeSettings.isEnabled}
            />
            <button
              onClick={() => setAutoTradeDialogOpen(true)}
              className={`px-2 py-0.5 text-[11px] rounded flex items-center gap-1 border ${
                useStore.getState().autoTradeSettings.isEnabled
                  ? 'bg-[#2d2d2d] border-green-700 text-green-500 hover:bg-[#333]'
                  : 'bg-[#2d2d2d] border-[#3c3c3c] text-[#888888] hover:bg-[#333]'
              }`}
              title="자동 매매 설정"
            >
              <span>Auto Trade</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  useStore.getState().autoTradeSettings.isEnabled
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-gray-500'
                }`}
              ></span>
            </button>
          </div>
        )}

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

      {/* Auto Trading Dialog */}
      <AutoTradingDialog
        isOpen={autoTradeDialogOpen}
        onOpenChange={setAutoTradeDialogOpen}
      />
    </div>
  );
}
