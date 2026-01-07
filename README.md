# Bitcoin & Stock Simulation (비트코인 및 주식 시뮬레이션)

비트코인과 주식의 1년치 과거 데이터를 기반으로 다양한 매매 전략을 시뮬레이션하는 도구입니다.

## 기술 스택 (Tech Stack)

- **Framework**: React (Vite)
- **State Management**: **Zustand**
- **Styling**: **Tailwind CSS**
- **UI Components**: **shadcn/ui** (모든 UI 요소는 shadcn/ui를 기반으로 구현)

## 화면 레이아웃 (Layout)

```text
+---------------------------------------------------------------------------------------+
|             비트코인 / 주식 시뮬레이션 (Simulation Tool)          [ 👁️ Data View ]    |
+---------------------------------------------------------------------------------------+
| [● Coin] [○ Stock]  |  종목코드: [ AAPL ] (Stock 선택 시 활성화)  |
+-----------------------+-----------------------+---------------------------------------+
|       과거 데이터     |    매매 전략 설정    |  (Simulation Mode Layout)             |
+-----------------------+-----------------------+   수익률 :                            |
| +-------------------+ | 자산관리: [고정/누적] |   승률 :                              |
| |  1분 ~ 2시간 간격 | | 계산방식: [단리/복리] |   최대 배율 :                         |
| | (Coin Only)       | | -----------------   |   사이클 수 :                         |
| | +-------------------+ | 필터:               |                                       |
| +-------------------+ | [ ] BB [ ] 추세      |   시간 | 구매액 | 판매액 | 수량 | ... |
| |     1일 간격      | | [ ] RSI [ ] 손절매   |  ------+--------+--------+------+----- |
| +-------------------+ | -----------------   |                                       |
| +-------------------+ | 마틴게일:            |                                       |
| |     2일 간격      | | [1.0x(안함) ~ 2.0x] |                                       |
| +-------------------+ | +-------------------+ |                                       |
| +-------------------+ | [ 시뮬레이션 실행 ] |                                       |
| |    일주일 간격    | | +-------------------+ |                                       |
| +-------------------+ |                       |                                       |
+-----------------------+-----------------------+---------------------------------------+

[ Data View Mode (Toggle ON) ]
+---------------------------------------------------------------------------------------+
| 날짜 (Date)      | 가격 (Median)  | 기울기 (Slope) | 볼린저 밴드 (BB Status)            |
+------------------+----------------+----------------+------------------------------------+
| 2023-01-01 09:00 | 25,000,000     | -              | 0 (Mean)                           |
| 2023-01-01 09:01 | 25,050,000     | +50,000        | 1 (Upper Zone)                     |
| 2023-01-01 09:02 | 25,200,000     | +150,000       | 2 (Upper Break)                    |
| ...              | ...            | ...            | ...                                |
+------------------+----------------+----------------+------------------------------------+
```

## 주요 기능 (Features)

- **자산 모드 전환**: 암호화폐(Coin)와 주식(Stock) 모드 지원.
- **종목 선택**: 주식 모드 시 티커(Ticker) 입력 가능 (예: AAPL, TSLA, NVDA).
- **데이터 소스 유연화**: 
    - **Coin**: Upbit API (1분봉 기반)
    - **Stock**: Yahoo Finance (일봉 기반, CORS Proxy 적용)
- **매매 전략 시뮬레이션**: 수량 고정, **수량 고정 + BB(볼린저 밴드)**, 그리고 다양한 배율의 마틴게일 전략 적용.
- **결과 분석**: 수익률, 승률, 최대 배율, 사이클 수 등 상세 지표 제공.
- **거래 내역**: 시간별 구매/판매 상세 내역 리스트 출력.

## 상세 구현 명세 (Implementation Details)

### 1. 주요 함수 및 로직 (Core Logic)

1.  **데이터 조회 (Data Fetching)**
    *   **Coin Mode**: Upbit API를 사용, 1초당 10회 호출 제한 준수하여 1년치 1분봉 데이터 수집 (`fetchOneYearData`).
    *   **Stock Mode**: Yahoo Finance 비공식 API 사용 (`fetchStockOneYearData`).
        *   URL: `/api/yahoo/v8/finance/chart/{ticker}?interval=1d&range=365d` (Vite Proxy 사용)
        *   주식은 **일봉(1 Day) 데이터**를 기본으로 사용.
        *   데이터 호환성을 위해 `close` 데이터를 `trade_price`로 매핑하여 저장.
    *   **자동 트리거**: 자산 모드(Coin/Stock) 또는 티커 변경 시, 해당 자산의 기본 데이터(Coin: 1분봉, Stock: 1일봉)를 자동으로 조회합니다.
    *   **API 호출 최적화 (Caching)**: 
        *   **브라우저 캐시**: `IndexedDB`를 통해 로드된 데이터를 영속적으로 저장 (Zustand Persist).
        *   **Vercel CDN 캐시**: Serverless Function(`api/yahoo.js`, `api/dataroma.js`)에 **Shared Cache Control**(S-Maxage)을 적용. 1시간 동안 캐시하며, 백그라운드에서 최신 데이터를 갱신(Stale-While-Revalidate)하여 외부 API 호출 제한을 방지하고 응답 속도를 극대화함.

2.  **간격별 데이터 생성 (Aggregation - Sliding Window)**
    *   기존의 비중복 구간 방식(1~3, 4~6)에서 **슬라이딩 윈도우 방식(Moving Window)**으로 변경되었습니다. (User Request)
    *   **Coin**: 1분 데이터를 기반으로 N분 간격의 캔들을 **매 1분마다** 생성 (Stride = 1).
        *   예: 5분 간격 -> (1~5분), (2~6분), (3~7분) ...
        *   데이터 포인트 수가 줄어들지 않고 유지됩니다.
    *   **Stock**: 1일 데이터를 기반으로 N일 간격의 캔들을 **매일** 생성.
        *   예: 3일 간격 -> (1~3일), (2~4일), (3~5일) ...
        *   **지원 간격 확장**: 1일 ~ 7일(1주) 뿐만 아니라, **8일 ~ 20일** 간격까지 확대하여 다양한 스윙 트레이딩 전략을 테스트할 수 있습니다.
    *   **목적**: 데이 트레이딩 및 단기 추세 포착을 위해 더 세밀한 진입점 분석 가능.
    *   **성능 최적화**: 윈도우 크기가 클 경우 High/Low 계산은 근사치(Open/Close 중 최대/최소)를 사용하거나 생략하여 브라우저 성능 저하를 방지합니다.
    *   `1분` ~ `2시간` 간격은 일봉 데이터로는 생성 불가하므로 비활성화.
    *   **자동 생성 (Auto Generation)**:
        *   기본 데이터 로드 완료 시 모든 파생 간격을 자동 생성합니다.
    *   **자동 선택 (Auto Selection)**:
        *   데이터 준비 시 기본 간격이 자동 선택됩니다.

3.  **파생 데이터 및 지표 계산 (Derived Data Calculation)**
    *   **중간값 (Median Price)**
        *   수식: `(Open + Close) / 2`
        *   목적: 시가와 종가의 평균 흐름을 반영하여 노이즈를 줄이고 대표성을 가짐.
    *   **기울기 (Slope)**
        *   수식: `현재 Median - 이전 Median`.
        *   **변경점**: 기존 `Close` 기준에서 `Median` 기준으로 변경됨.
        *   **예외 처리**: 데이터의 첫 번째 로우는 이전 가격이 없으므로 `undefined` 설정.
    *   **볼린저 밴드 (Bollinger Bands)**
        *   설정: 기간(Period) **20**, 승수(Multiplier) **2**.
        *   **상태값 (Status)**:
            *   `2`: 상단 밴드 이탈 (Price > Upper Band)
            *   `1`: 상단 구간 (Mean < Price <= Upper Band)
            *   `-1`: 하단 구간 (Lower Band <= Price < Mean)
            *   `-2`: 하단 밴드 이탈 (Price < Lower Band)
    *   **이동평균선 (Moving Average - MA)**
        *   설정: 기간(Period) **20**, **50** (추세 확인용).
        *   목적: 현재 가격이 MA 위에 있을 때만 상승 추세로 간주하여 매수 필터로 사용.
    *   **RSI (Relative Strength Index)**
        *   설정: 기간(Period) **14**.
        *   목적: 과매수(70 이상) 및 과매도(30 이하) 상태를 파악하여 매수 시점의 안정성 확보.
    *   **거래량 이동평균 (Volume MA)**
        *   설정: 기간(Period) **20**.
        *   목적: 현재 거래량이 평균보다 높은 '의미 있는 상승'인지 판별하기 위함.

  4.  **매매 기록 시스템 (Trading System)**
    *   기울기가 변할 때마다 매매 진행 (매수 + 매도 = 1 사이클).
    *   **매수 (Long) 조건**:
        *   **기본**: 기울기가 음수(-)에서 양수(+)로 변할 때.
        *   **BB 필터**: 활성화 시, 직전 캔들의 BB Status가 -2(하단 이탈)인 경우에만 진입.
        *   **추세 필터 (Trend)**: 활성화 시, `현재가 > MA50` (장계) 또는 `현재가 > MA20` (단기) 조건 충족 필요.
        *   **RSI 필터**: 활성화 시, `RSI < 70` (과매수 아님) 조건 충족 필요.
        *   **거래량 필터 (Volume)**: 활성화 시, `현재 거래량 > 거래량 MA20` 조건 충족 필요.
    *   **매도 (Short/Close) 조건**:
        *   **기본**: 기울기가 양수(+)에서 음수(-)로 변할 때.
        *   **손절 (Stop Loss)**: 활성화 시, 매수가 대비 **-2%** 도달 시 즉시 강제 매도.
        *   **익절 (Take Profit)**: 활성화 시, 매수가 대비 **+5%** 도달 시 즉시 강제 매도.
        *   **추적 손절매 (Trailing Stop)**: 활성화 시, 매수 이후 **최고가 대비 -2%**(가변) 하락 시 수익 보전 또는 손실 최소화를 위해 즉시 매도.
    *   **자산 관리 (Money Management)**:
        *   **고정 (Fixed)**: 모든 거래에 동일한 원금(예: 10만 원) 투입.
        *   **누적/복리 (Cumulative)**: 현재 잔고 전체를 다음 거래에 투입.
        *   **마틴게일 (Martingale)**: 손실 시 다음 거래 수량을 N배로 증가. 승리 시 1배로 초기화.
    *   **예외 처리**: `undefined` 관련 변화는 무시.

5.  **수수료 및 슬리피지 반영 (Fees & Slippage)**
    *   시뮬레이션에서 실제 거래 비용을 반영하여 현실적인 결과 산출.
    *   **설정값 (기본)**:
        *   매수 수수료: **0.05%** / 매도 수수료: **0.05%**
        *   슬리피지: **0.1%** (시장가 주문 시 체결 오차)
    *   **실질 손익 계산식**:
        ```
        매수 비용 = 투자금 × (1 + 매수수수료)
        실제 매수가 = 현재가 × (1 + 슬리피지)
        BTC/주식 수량 = 투자금 / 실제 매수가
        
        실제 매도가 = 현재가 × (1 - 슬리피지)
        판매 수익 = 수량 × 실제 매도가 × (1 - 매도수수료)
        
        실질 손익 = 판매 수익 - 매수 비용
        ```

### 2. UI 구성 요소 및 로직

#### 상단 컨트롤 (Top Controls)
*   **자산 토글 (Toggle)**: `Coin` / `Stock` 선택. 변경 시 확인 팝업 후 데이터 초기화.
*   **스마트 티커 선택 (Smart Ticker Selection)**:
    *   기본적으로 직접 입력 가능 (Enter 키 입력 시 변경 확인 팝업).
    *   **추천 모드**: Dataroma 크롤링을 통해 **슈퍼인베스터 5인 이상**이 보유한 우량 종목 리스트를 제공.
    *   UI: 콤보박스 (Select + Input) 형태.
*   **데이터 보기 (Data View Toggle)**: 시뮬레이션 UI ↔ 데이터 테이블 UI 전환.
    *   **ON**: 중앙 영역이 날짜별 상세 데이터 테이블로 변경됨.
    *   **OFF**: 기존 시뮬레이션 및 차트/결과 화면 표시.

#### 간격 버튼 (Interval Buttons)
*   **상태: 회색 (데이터 없음)**
    *   클릭 시 로딩.
    *   **Coin**: 1분 데이터 로드 후 파생 데이터 생성.
    *   **Stock**: 1일 데이터 로드 후 파생 데이터 생성.
*   **상태: 흰색 (데이터 있음)**
    *   클릭 시 해당 간격에 대한 시뮬레이션 버튼들을 활성화.
*   **상태: 비활성 (Unsupported)**
    *   **Stock Mode**에서 1분, 5분, 15분, 1시간, 2시간 버튼은 비활성화 처리됨 (일봉 데이터 한계).

#### 시뮬레이션 버튼 (Simulation Buttons)
*   클릭 시 선택된 전략(Fixed, Martingale)으로 시뮬레이션 실행 및 결과 저장.

#### 데이터 뷰어 (Data Viewer)
*   toggle ON 시 활성화되는 뷰.
*   **테이블 모드**: `날짜` | `가격 (Median)` | `기울기 (Slope)` | `볼린저 밴드 (Status)` 등 상세 데이터 조회.
*   **차트 모드 (New)**: 
    *   가격 데이터를 시각적인 라인 차트로 표시.
    *   **AI 가격 예측 (Forecast)**: 외부 AI 모델(TimesFM-2.5)을 호출하여 미래 30일 가격 예측 데이터를 조회.
    *   **API Endpoint**: `POST https://younginpiniti-bitcoin-ai-backend.hf.space/v1/forecast`
    *   **Payload**: `{ "symbol": "[TICKER]", "interval": "day" }`
    *   **시각적 구분**: 
        *   **과거 데이터 (Historical)**: 파란 계열 **실선(solid line)**으로 표시.
        *   **예측 데이터 (Prediction)**: 밝은 계열 **점선(dashed line)**으로 표시하여 명확히 구분.
    *   **차트 라이브러리**: Recharts (React 기반 경량 차트 라이브러리).

#### 시장 전체 분석 (Market Analysis / Scanner)
*   **목적**: 단일 종목 시뮬레이션이 아닌, 보유 중인 티커 리스트(추천 종목 등) 전체를 스캔하여 **현재 시점**에서의 매매 신호를 포착.
*   **진입점**: TitleBar 내 "전체 분석(Analyze All)" 버튼. (Stock Mode 전용)
*   **동작 방식**:
    1.  **대상**: 추천 종목 리스트 (`recommendedStocks`).
    2.  **데이터 조회**: 각 종목별로 **최근 50일치** 일봉 데이터를 로드. (전체 365일 대신 50일치만 조회하여 속도 최적화)
    3.  **분석 (Parsing)**:
        *   각 종목 데이터에 대해 `median`, `slope`, `bb`, `rsi`, `ma50`, `vma20` 등 모든 지표 계산.
        *   **AI 감성 분석 (Sentiment Analysis)**: 
            *   Yahoo Finance에서 해당 종목의 최신 뉴스 헤드라인 수집.
            *   Hugging Face **FinBERT** 모델을 통해 뉴스 긍정/부정 수치화.
            *   기술적 지표와 결합하여 최종 신뢰도 보정.
        *   **현재 Sidebar에서 설정된 모든 전략 옵션** (BB, 추세, RSI, 거래량 필터 등)을 **실시간으로 적용**하여 오늘(Last Candle)의 매매 신호를 판별.
        *   단순히 기울기만 보는 것이 아니라, 설정된 모든 락(Lock) 조건이 충족될 때만 'BUY' 신호를 출력함.
    4.  **결과 표시**:
        *   `EditorArea`에 분석 결과 테이블 출력.
        *   **컬럼**: `종목(Ticker)` | `신호(Signal)` | `현재가(Price)` | `기울기(Slope)` | `AI 감성` | `필터 상태`
        *   **신호**: 매수(Buy), 매도(Sell), 대기(Hold/Wait). 색상으로 구분하여 표시.

### 3. 확장성 및 구조 개선 (Architecture)

#### Data Provider 추상화
*   `fetchHistoricalData` 인터페이스를 통해 Upbit, Yahoo Finance 등 다양한 소스를 플러그인 형태로 지원 가능한 구조 (현재 `api.js` 내부 분기로 구현됨).

#### 자산별 파라미터 관리
| 구분 | 비트코인 (Coin) | 주식 (Stock) |
| :--- | :--- | :--- |
| **운영 시간** | 24시간 / 365일 | 장 운영 시간 (예: 평일 09:30~16:00) |
| **데이터** | 1분봉 정밀 데이터 | 1일봉(Daily) 데이터 |
| **통화** | KRW | USD (현재 수치는 원화로 가정하고 시뮬레이션) |

*   **Time-Gap 처리**: 주식의 장 시작(Open) 시 갭상승/하락을 별도 로직으로 처리 필요.
*   **환율 연동**: USD 주식 거래 시 환율 변동성 반영.

---

## 📁 파일 구조 (Project Structure)

```
bitcoin-simulation/
│
├── 📄 index.html              # 앱 진입점 HTML
├── 📄 package.json            # 프로젝트 의존성 및 스크립트 정의
├── 📄 package-lock.json       # 의존성 버전 잠금 파일
├── 📄 vite.config.js          # Vite 빌드 설정 (Proxy 포함)
├── 📄 tailwind.config.js      # Tailwind CSS 설정
├── 📄 postcss.config.js       # PostCSS 설정
├── 📄 jsconfig.json           # JavaScript 경로 별칭 설정
├── 📄 eslint.config.js        # ESLint 린터 설정
├── 📄 components.json         # shadcn/ui 컴포넌트 설정
├── 📄 vercel.json             # Vercel 배포 및 Serverless Function 설정
├── 📄 README.md               # 프로젝트 설명서 (현재 문서)
├── 📄 GEMINI.md               # AI 에이전트용 프로젝트 가이드
├── 📄 .gitignore              # Git 무시 파일 목록
│
├── 📁 api/                    # Vercel Serverless Functions
│   ├── 📄 yahoo.js            # Yahoo Finance API 프록시
│   └── 📄 dataroma.js         # Dataroma 크롤링 (슈퍼인베스터 데이터)
│
│
├── 📁 public/                 # 정적 파일 (빌드 시 복사)
│   └── 📄 vite.svg            # Vite 로고 아이콘
│
└── 📁 src/                    # 소스 코드 루트
    │
    ├── 📄 main.jsx            # React 앱 진입점 (ReactDOM 렌더링)
    ├── 📄 App.jsx             # 최상위 앱 컴포넌트 (레이아웃 구성)
    ├── 📄 App.css             # App 전용 스타일
    ├── 📄 index.css           # 글로벌 스타일 (Tailwind 포함)
    │
    ├── 📁 assets/             # 정적 에셋 (이미지, 아이콘 등)
    │   └── 📄 react.svg       # React 로고 아이콘
    │
    ├── 📁 components/         # React 컴포넌트
    │   │
    │   ├── 📄 IntervalPanel.jsx    # 과거 데이터 간격 선택 패널, 사용 안함(레거시)
    │   ├── 📄 SimulationPanel.jsx  # 시뮬레이션 전략 선택 패널, 사용 안함(레거시)
    │   ├── 📄 ResultPanel.jsx      # 시뮬레이션 결과 표시 패널, 사용 안함(레거시)
    │   │
    │   ├── 📁 layout/         # 레이아웃 컴포넌트 (VS Code 스타일)
    │   │   ├── 📄 index.js         # 레이아웃 컴포넌트 export 모음
    │   │   ├── 📄 TitleBar.jsx     # 상단 타이틀바 (모드 전환, 티커 입력)
    │   │   ├── 📄 ActivityBar.jsx  # 좌측 간격 선택 바 (1분~1주)
    │   │   ├── 📄 Sidebar.jsx      # 좌측 사이드바 (시뮬레이션 전략 목록)
    │   │   ├── 📄 EditorArea.jsx   # 중앙 에디터 영역 (결과 표시, 거래 내역)
    │   │   └── 📄 StatusBar.jsx    # 하단 상태바 (현재 상태, 수익률)
    │   │
    │   └── 📁 ui/             # shadcn/ui 기반 UI 컴포넌트
    │       ├── 📄 button.jsx       # 버튼 컴포넌트
    │       ├── 📄 card.jsx         # 카드 컴포넌트
    │       ├── 📄 badge.jsx        # 배지 컴포넌트
    │       ├── 📄 table.jsx        # 테이블 컴포넌트
    │       └── 📄 scroll-area.jsx  # 스크롤 영역 컴포넌트
    │
    ├── 📁 lib/                # 라이브러리 및 유틸리티
    │   ├── 📄 api.js               # API 호출 함수 (Upbit, Yahoo Finance)
    │   ├── 📄 dataProcessor.js     # 데이터 처리 (Aggregation, 기울기, 매매 생성)
    │   └── 📄 utils.js             # 공통 유틸리티 (cn 함수 등)
    │
    ├── 📁 store/              # 상태 관리 (Zustand)
    │   └── 📄 useStore.js          # 전역 상태 스토어 (데이터, 시뮬레이션 결과)
    │
    └── 📁 utils/              # 유틸리티 함수
        └── 📄 simulation.js        # 시뮬레이션 보조 함수 (더미 데이터 생성)
```

---

## 📂 상세 파일 설명 (Detailed File Descriptions)

### 🔧 루트 설정 파일 (Root Configuration)

| 파일명 | 역할 |
|--------|------|
| `index.html` | Vite 앱의 HTML 진입점. `<div id="root">` 포함 |
| `package.json` | 프로젝트 메타정보, 의존성(zustand, tailwindcss 등), 스크립트(dev, build) 정의 |
| `vite.config.js` | Vite 설정. **Yahoo Finance API용 프록시(`/api/yahoo`)** 설정 포함 |
| `tailwind.config.js` | Tailwind CSS 커스터마이징. 색상, 폰트, 확장 설정 |
| `postcss.config.js` | PostCSS 플러그인 설정 (Tailwind, autoprefixer) |
| `jsconfig.json` | `@/` 경로 별칭 설정 (src 폴더 매핑) |
| `eslint.config.js` | ESLint 규칙 설정. React/Hooks 린팅 |
| `components.json` | shadcn/ui CLI 설정. 컴포넌트 스타일 및 경로 정의 |
| `vercel.json` | Vercel 배포 설정. `/api/*` 요청을 Serverless Function으로 라우팅 |

---

### ☁️ 서버리스 함수 (Serverless Functions - Vercel)

| 파일명 | 역할 |
|--------|------|
| `api/yahoo.js` | **Yahoo Finance 프록시**. CORS 문제 해결 및 주식 데이터 패칭 (Vite Proxy 대체) |
| `api/dataroma.js` | **Dataroma 크롤러**. 슈퍼인베스터들의 보유 종목 데이터를 크롤링하여 제공 |

---

### ⚛️ 핵심 앱 파일 (Core App Files)

| 파일명 | 역할 |
|--------|------|
| `src/main.jsx` | React 앱 진입점. `ReactDOM.createRoot()`로 App 렌더링 |
| `src/App.jsx` | 최상위 컴포넌트. **VS Code 스타일 레이아웃** 구성 (TitleBar, ActivityBar, Sidebar, EditorArea, StatusBar) |
| `src/App.css` | App 전용 CSS 스타일 |
| `src/index.css` | **글로벌 스타일**. Tailwind 지시문(`@tailwind`) 및 커스텀 CSS 변수 정의 |

---

### 🧩 레이아웃 컴포넌트 (Layout Components)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          TitleBar.jsx                               │
│   [● Coin] [○ Stock]  |  Ticker: [ AAPL ]  |  ─ □ ×                │
├────────┬─────────────────────┬──────────────────────────────────────┤
│        │                     │                                      │
│  Act-  │     Sidebar.jsx     │           EditorArea.jsx             │
│  ivity │                     │                                      │
│  Bar   │   ┌───────────────┐ │   ┌────────────────────────────────┐ │
│ .jsx   │   │ 📁 매매 전략  │ │   │ 💰 시뮬레이션 결과             │ │
│        │   │  ├─ 수량 고정 │ │   │                                │ │
│  1분   │   │  ├─ 1.1x 마틴 │ │   │  수익률: +1,234,567원          │ │
│  5분   │   │  ├─ 1.2x 마틴 │ │   │  승률: 54.3%                   │ │
│  15분  │   │  ├─ ...       │ │   │  사이클: 1,523회               │ │
│  1시간 │   │  └─ 2x 마틴   │ │   │                                │ │
│  ...   │   └───────────────┘ │   │  ┌─────────────────────────┐   │ │
│  1주   │                     │   │  │ 📋 거래 내역 테이블     │   │ │
│        │                     │   │  └─────────────────────────┘   │ │
│        │                     │   └────────────────────────────────┘ │
├────────┴─────────────────────┴──────────────────────────────────────┤
│                          StatusBar.jsx                              │
│  🔀 main  ✓ 준비됨  |  활성 간격: 1d | 데이터: 365개  |  +1,234원   │
└─────────────────────────────────────────────────────────────────────┘
```

| 파일명 | 역할 |
|--------|------|
| `TitleBar.jsx` | **상단 타이틀바**. Coin/Stock 모드 전환, 주식 티커 입력, 윈도우 컨트롤(Mock) |
| `ActivityBar.jsx` | **좌측 아이콘 바**. 시간 간격 버튼(1분~1주). 클릭 시 데이터 로드/선택 |
| `Sidebar.jsx` | **좌측 사이드바**. 시뮬레이션 전략 목록(수량 고정, 마틴게일 1.1x~2x). 트리 구조 UI |
| `EditorArea.jsx` | **중앙 메인 영역**. 시뮬레이션 결과 요약(수익률, 승률, 사이클) 및 거래 내역 테이블. 페이지네이션 지원 |
| `StatusBar.jsx` | **하단 상태바**. 현재 로딩 상태, 활성 간격, 데이터 개수, 총 수익률 표시 |
| `index.js` | 레이아웃 컴포넌트들의 **Named Export** 모음 |

---

### 🎨 UI 컴포넌트 (shadcn/ui Based)

| 파일명 | 역할 |
|--------|------|
| `button.jsx` | 다양한 variant(default, outline, ghost 등) 지원 버튼 |
| `card.jsx` | 카드 컨테이너 (Card, CardHeader, CardTitle, CardContent) |
| `badge.jsx` | 상태 표시용 배지 컴포넌트 |
| `table.jsx` | 테이블 컴포넌트 (Table, TableHeader, TableBody, TableRow, TableCell) |
| `scroll-area.jsx` | 커스텀 스크롤바가 적용된 스크롤 영역 |

---

### 📡 라이브러리 (Lib)

| 파일명 | 역할 |
|--------|------|
| `api.js` | **API 호출 함수**<br>• `fetchUpbitCandles()`: 업비트 1분봉 단일 호출<br>• `fetchOneYearData()`: 1년치 1분봉 수집 (10회/초 제한 준수)<br>• `fetchStockOneYearData()`: Yahoo Finance 1년 일봉 조회 (Vite Proxy 사용) |
| `dataProcessor.js` | **데이터 처리 유틸**<br>• `INTERVALS`: 간격 설정 (1m~1w)<br>• `TRADING_COSTS`: 수수료/슬리피지 상수<br>• `aggregateToInterval()`: 1분봉 → N분봉 변환<br>• `addSlopeData()`: 기울기 계산 (첫 로우는 undefined)<br>• `generateTrades()`: 기울기 변화에 따른 매매 기록 생성<br>• `applyTradingCosts()`: 수수료/슬리피지 적용<br>• `calculateFixedQuantityResult()`: 수량 고정 시뮬레이션<br>• `calculateMartingaleResult()`: 마틴게일 시뮬레이션 |
| `utils.js` | **공통 유틸**<br>• `cn()`: Tailwind 클래스 병합 (clsx + tailwind-merge) |

---

### 🗄️ 상태 관리 (Store)

| 파일명 | 역할 |
|--------|------|
| `useStore.js` | **Zustand 전역 스토어**<br><br>**📌 상태 (State)**<br>• `mode`: 'coin' \| 'stock' (자산 모드)<br>• `ticker`: 주식 티커 (예: 'AAPL')<br>• `hist`: 간격별 캔들 데이터 저장 객체<br>• `simul`: 시뮬레이션 결과 저장 객체<br>• `loadingInterval`: 간격별 로딩 상태<br>• `loadingSimul`: 시뮬레이션별 로딩 상태<br>• `fetchProgress`: API 호출 진행률<br>• `activeInterval`: 현재 선택된 간격<br>• `selectedResult`: 표시 중인 시뮬레이션 결과<br><br>**📌 액션 (Actions)**<br>• `setMode()`: 모드 변경 + 데이터 초기화<br>• `setTicker()`: 티커 변경 + 데이터 초기화<br>• `loadHist1m()`: 1분봉 데이터 로드 (Coin)<br>• `loadStockData()`: 일봉 데이터 로드 (Stock)<br>• `loadHistInterval()`: 특정 간격 데이터 생성<br>• `runFixedSimulation()`: 수량 고정 시뮬레이션 실행<br>• `runMartingaleSimulation()`: 마틴게일 시뮬레이션 실행<br>• `setActiveInterval()`: 활성 간격 설정<br>• `setSelectedResult()`: 결과 선택/표시<br>• `clearAllData()`: 전체 데이터 초기화<br><br>**📌 미들웨어**<br>• `devtools`: Redux DevTools 연동 (개발 환경)<br>• `persist`: IndexedDB 영속 저장 |

---

### 🛠️ 유틸리티 (Utils)

| 파일명 | 역할 |
|--------|------|
| `simulation.js` | **시뮬레이션 헬퍼**<br>• `generateSimulationData()`: 1년치 더미 BTC 가격 생성 (Geometric Brownian Motion)<br>• `formatCurrency()`: USD 통화 포맷팅 |

---

## 🔄 데이터 흐름 (Data Flow)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              📊 Bitcoin Simulation 데이터 흐름                   │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
  │   🌐 External    │         │   📡 api.js      │         │ 📦 useStore.js   │
  │      APIs        │         │                  │         │    (Zustand)     │
  │                  │         │                  │         │                  │
  │  ┌────────────┐  │         │  fetchOneYear    │         │  hist: {         │
  │  │  Upbit     │──┼────────▶│  Data()          │────────▶│    '1m': [...],  │
  │  │  (1분봉)   │  │         │                  │         │    '5m': [...],  │
  │  └────────────┘  │         │  fetchStock      │         │    ...           │
  │                  │         │  OneYearData()   │         │  }               │
  │  ┌────────────┐  │         │                  │         │                  │
  │  │ Yahoo      │──┼────────▶│                  │         │  simul: {        │
  │  │ (일봉)     │  │         │                  │         │    'coin_1d_    │
  │  └────────────┘  │         │                  │         │    fixed': {...} │
  └──────────────────┘         └──────────────────┘         │  }               │
                                        │                   └────────┬─────────┘
                                        ▼                            │
                               ┌──────────────────┐                  │
                               │ 🔧 dataProcessor │                  │
                               │                  │                  │
                               │ aggregateTo      │◀─────────────────┘
                               │ Interval()       │
                               │                  │
                               │ addSlopeData()   │
                               │                  │
                               │ generateTrades() │
                               │                  │
                               │ calculateFixed   │
                               │ QuantityResult() │
                               │                  │
                               │ calculateMartin  │
                               │ galeResult()     │
                               └────────┬─────────┘
                                        │
                                        ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                              🖥️ UI Components                                │
  ├────────────┬─────────────────┬─────────────────────┬────────────────────────┤
  │ TitleBar   │  ActivityBar    │     Sidebar         │      EditorArea        │
  │            │                 │                     │                        │
  │ 모드 전환  │  간격 선택      │  전략 선택          │  결과 표시             │
  │ 티커 입력  │  데이터 로드    │  시뮬 실행          │  거래 내역             │
  └────────────┴─────────────────┴─────────────────────┴────────────────────────┘
```
