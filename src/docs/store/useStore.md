# Global Store (Zustand)

애플리케이션 전역 상태 관리를 위한 중앙 저장소입니다. `Zustand` 라이브러리를 사용하며, `devtools` 미들웨어로 디버깅을 지원하고, `persist` 미들웨어로 데이터를 브라우저 저장소(IndexedDB/LocalStorage)에 영구 저장합니다.

---

## State (상태)

스토어는 다음과 같은 상태 그룹으로 구성됩니다.

### Global Settings (전역 설정)

| State 이름 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `mode` | `'stock' \| 'coin'` | `'stock'` | 현재 앱 모드 (주식/코인). |
| `viewMode` | `string` | `'simulation'` | 현재 활성화된 메인 뷰 모드. (`'chart'`, `'analyze'` 등) |
| `ticker` | `string` | `'AAPL'` | 현재 선택된 종목 코드. |
| `interval` | `string` | `'1d'` | 캔들 데이터 시간 간격. (`'1d'`, `'1m'`) |
| `globalError` | `Object \| null` | `null` | 전역 에러 상태. 값이 있으면 `GlobalAlertDialog`가 표시됨. |

### Data & History (데이터)

| State 이름 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `hist` | `Array` | `[]` | 현재 종목의 과거 캔들 데이터 ("일봉"). |
| `data1m` | `Array` | `[]` | 현재 종목의 최근 "1분봉" 데이터. |
| `simul` | `Object \| null` | `null` | 시뮬레이션 결과 리포트 (`trades`, `summary`). |
| `dataCache` | `Object` | `{}` | API 응답 캐싱을 위한 객체. (`ticker`+`interval`이 키) |

### KIS Authentication (한국투자증권)

| State 이름 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `kisAuth.isLoggedIn` | `boolean` | `false` | 로그인 여부. |
| `kisAuth.appkey` | `string` | `''` | API App Key. |
| `kisAuth.accessToken` | `string` | `''` | 발급받은 접속 토큰 (Bearer Token). |

---

## Actions (액션)

상태를 변경하거나 비즈니스 로직을 수행하는 함수들입니다.

### setTicker
현재 선택된 종목(ticker)을 변경하고, 데이터 로딩 등을 초기화할 수 있습니다.

#### 구문 (Syntax)
```javascript
setTicker(ticker)
```

#### 예제 (Example)
```javascript
const setTicker = useStore((state) => state.setTicker);
setTicker('TSLA'); // 티커를 테슬라로 변경
```

### loadDailyData
현재 설정된 `ticker`와 `interval`에 맞는 데이터를 API에서 가져와 `hist` 상태에 저장합니다. 자동으로 `dataProcessor.addDerivedData`를 호출하여 보조지표를 계산합니다.

#### 구문 (Syntax)
```javascript
loadDailyData()
```

#### 반환값
`Promise<void>`

#### 예제 (Example)
```javascript
const { loadDailyData, hist } = useStore.getState();
await loadDailyData();
console.log(`데이터 로드 완료: ${hist.length}개 캔들`);
```

### runSimulation
현재 로드된 데이터(`hist`)와 전략 옵션(`strategyOptions`)을 사용하여 백테스팅 시뮬레이션을 실행하고, 결과를 `simul` 상태에 저장합니다.

#### 구문 (Syntax)
```javascript
runSimulation()
```

#### 예제 (Example)
```javascript
const runSim = useStore((state) => state.runSimulation);
runSim(); // 시뮬레이션 결과가 state.simul에 저장됨
```

### loginKIS
한국투자증권 API에 로그인하여 액세스 토큰을 발급받고 `kisAuth` 상태를 업데이트합니다.

#### 구문 (Syntax)
```javascript
loginKIS(appkey, appsecret, accountNo, accountCode)
```

#### 매개변수 (Parameters)
- `appkey`, `appsecret`: KIS Open API 키 쌍.
- `accountNo` (8자리), `accountCode` (2자리): 계좌 정보.

#### 반환값 (Return value)
`Promise<{ success: boolean, error?: string }>`

#### 예제 (Example)
```javascript
const result = await loginKIS('MY_KEY', 'MY_SECRET', '12345678', '01');
if (result.success) {
    console.log("로그인 성공!");
}
```

### runMarketAnalysis
선택된 종목 그룹(예: S&P 500)의 모든 종목에 대해 기술적 분석을 수행하고, 매매 신호가 발생한 종목을 `analysisResult` 상태에 저장합니다.

#### 구문 (Syntax)
```javascript
runMarketAnalysis(group)
```

#### 매개변수 (Parameters)
- `group` (string): 분석 대상 그룹 (`'sp500'`, `'myholdings'` 등).

#### 예제 (Example)
```javascript
// S&P 500 전 종목 스캔 시작
runMarketAnalysis('sp500');
```

### setGlobalError
전역 에러 상태를 설정하여 사용자에게 알림 팝업을 띄웁니다.

#### 구문 (Syntax)
```javascript
setGlobalError(error)
```

#### 예제 (Example)
```javascript
setGlobalError({
    title: "데이터 로드 실패",
    message: "네트워크 연결을 확인해주세요."
});
```

---

## Selectors (사용 예시)

컴포넌트에서 스토어 데이터를 구독(subscribe)하는 방법입니다.

### 기본 사용법
```javascript
import { useStore } from "@/store/useStore";

function MyComponent() {
    // 필요한 데이터만 선택하여 구독 (렌더링 최적화)
    const ticker = useStore((state) => state.ticker);
    const hist = useStore((state) => state.hist);
    
    return <div>Current: {ticker} ({hist.length} candles)</div>;
}
```

### 얕은 비교 (Shallow)
객체를 구독할 때는 `useShallow`를 사용하거나 개별 필드를 구독하는 것이 좋습니다.
```javascript
import { useShallow } from 'zustand/react/shallow';

const { mode, viewMode } = useStore(
    useShallow((state) => ({ mode: state.mode, viewMode: state.viewMode }))
);
```
