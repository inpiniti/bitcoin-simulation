# Bitcoin & Stock Simulation (비트코인 및 주식 시뮬레이션)

비트코인과 주식의 1년치 과거 데이터를 기반으로 다양한 매매 전략을 시뮬레이션하는 도구입니다.

## 기술 스택 (Tech Stack)

- **Framework**: React (Vite)
- **State Management**: **Zustand**
- **Styling**: **Tailwind CSS**
- **UI Components**: **shadcn/ui** (모든 UI 요소는 shadcn/ui를 기반으로 구현)
- **Chart Library**: **Recharts** (라인 차트 시각화)

## 화면 레이아웃 (Layout) - v2.0 Simplified

```text
+----------------------------------------------------------------------------------------+
|            비트코인 / 주식 시뮬레이션 (Simulation Tool)                                 |
+----------------------------------------------------------------------------------------+
| [○ Coin] [● Stock]  |  [Day] [Min]  |  종목코드: [ AAPL ] (Stock 선택 시 활성화)           |
+------+----------------+-----------------------+----------------------------------------+
|      |                |    매매 전략 설정     |  (View Area - 모드별 변경)              |
| 아이 |                | 자산관리: [고정/누적] |                                        |
| 콘   |                | 필터:               |   [시뮬레이션] 수익률, 승률, 거래내역     |
| 바   |                | [ ] BB [ ] 추세      |   [데이터뷰] 날짜별 가격/지표 테이블      |
|      |                | [ ] RSI [ ] 거래량   |   [차트뷰] 라인차트 + AI 예측            |
| 🎮   |                | -----------------   |   [분석] 전체 종목 스캔 결과             |
| 📊   |                | 마틴게일:            |                                        |
| 📈   |                | [1.0x ~ 2.0x]       |                                        |
| 🔍   |                | +-------------------+ |                                        |
|      |                | [ 시뮬레이션 실행 ] |                                        |
+------+----------------+-----------------------+----------------------------------------+

[ Activity Bar 아이콘 (좌측) ]
- 📖 개요 (Overview): 기업 정보, Wikipedia 기반 설명, AI 감정 분석
- 📰 뉴스 (News): 최근 뉴스 헤드라인 + FinBERT 감정 분석
- 🎮 시뮬레이션 (Simulation): 매매 전략 시뮬레이션 결과
- 📊 데이터 뷰 (Data View): 날짜별 상세 데이터 테이블
- 📈 차트 뷰 (Chart View): 가격 차트 + AI 예측
- 🔍 분석 (Analyze): 전체 종목 스캔 및 매매 신호
- 🏆 실적 임팩트 (Earnings): 실적 발표 캘린더 + 변동성 예측 (AI)
- 💬 종목 토론 (Discussion): Naver/Stocktwits 실시간 토론
```

## 주요 기능 (Features)

- **자산 모드 전환**: 암호화폐(Coin)와 주식(Stock) 모드 지원.
- **데이터 인터벌 전환**: 일봉(Day) 및 분봉(Min) 데이터 선택 기능.
- **종목 선택**: 주식 모드 시 티커(Ticker) 입력 가능 (예: AAPL, TSLA, NVDA).
- **데이터 소스 (1일봉 통일)**: 
    - **Coin**: Upbit API (**일봉** 기반으로 통일)
    - **Stock**: Yahoo Finance (일봉 기반, CORS Proxy 적용)
    - **KIS (한국투자증권)**: 내 계좌 잔고 및 해외 주식 랭킹(급등/급락/거래량) 데이터 조회.
- **매매 전략 시뮬레이션**: 수량 고정, BB(볼린저 밴드), 다양한 필터 및 마틴게일 전략 적용.
    - **정규장 매매 제한**: 분봉(Min) 시뮬레이션 시 pre-market/post-market 데이터를 포함하되, 실제 매매 신호는 정규장 시간에만 발생하도록 제한하여 시뮬레이션 정확도 향상.
    - **V-Martingale (강화 매수)**: 하락 시 비중을 확대하는 전략으로, 2배(Martingale) 또는 1배(Fixed) 배팅 모드 선택 가능.
        - **추가 매수 조건**: 평단가 대비 손실률 조건 설정 가능 (예: -1%, -2%, -3% 이하일 때만 추가 매수).
        - **거래량 필터 자동 비활성화**: 실시간 분석(WebSocket) 시 거래량 필터는 자동으로 비활성화 (웹소켓 거래량은 일일 누적값이므로 분봉 비교 부정확).
- **결과 분석**: 수익률, 승률, 최대 배율, 사이클 수 등 상세 지표 제공.
- **거래 내역**: 시간별 구매/판매 상세 내역 리스트 출력.
- **AI 가격 예측**: TimesFM 모델 기반 30일 미래 가격 예측 차트 표시.

## 상세 구현 명세 (Implementation Details)

### 1. 주요 함수 및 로직 (Core Logic)

1.  **데이터 조회 (Data Fetching) - 일봉 통일**
    *   **Coin Mode**: Upbit API를 사용, **일봉(1 Day)** 데이터를 1년치 조회.
        *   URL: `https://api.upbit.com/v1/candles/days?market=KRW-BTC&count=365`
        *   기존 1분봉 수집 후 집계 방식에서 **일봉 직접 조회**로 단순화.
    *   **Stock Mode**: Yahoo Finance 비공식 API 사용 (`fetchStockOneYearData`).
        *   URL: `/api/yahoo/v8/finance/chart/{ticker}?interval=1d&range=365d`
    *   **자동 트리거**: 자산 모드(Coin/Stock) 또는 티커 변경 시, 해당 자산의 일봉 데이터를 자동으로 조회.
    *   **API 호출 최적화 (Caching)**: 
        *   **브라우저 캐시**: `IndexedDB`를 통해 로드된 데이터를 영속적으로 저장 (Zustand Persist).
        *   **Vercel CDN 캐시**: Serverless Function에 Shared Cache Control 적용.

2.  **간격별 데이터 생성 제거 (Aggregation Removed)**
    *   기존의 1분봉 → N분봉 집계(Sliding Window) 로직을 **완전히 제거**.
    *   모든 분석은 **1일봉(1d)** 데이터를 기준으로 수행.
    *   코드 단순화 및 성능 향상.

3.  **파생 데이터 및 지표 계산 (Derived Data Calculation)**
    *   **중간값 (Median Price)**: `(Open + Close) / 2`
    *   **기울기 (Slope)**: `현재 Median - 이전 Median`
    *   **볼린저 밴드 (Bollinger Bands)**: 기간 20, 승수 2
    *   **이동평균선 (MA)**: MA20, MA50
    *   **RSI**: 기간 14
    *   **거래량 이동평균 (VMA20)**: 기간 20

4.  **매매 기록 시스템 (Trading System)**
    *   기울기가 변할 때마다 매매 진행 (매수 + 매도 = 1 사이클).
    *   **매수 (Long) 조건**:
        *   **기본**: 기울기가 음수(-)에서 양수(+)로 변할 때.
        *   **BB 필터**: 활성화 시, 직전 캔들의 BB Status가 -2(하단 이탈)인 경우에만 진입.
        *   **추세 필터 (Trend)**: `현재가 > MA50` 또는 `현재가 > MA20` 조건.
        *   **RSI 필터**: `RSI < 70` (과매수 아님) 조건.
        *   **거래량 필터 (Volume)**: `현재 거래량 > VMA20` 조건.
    *   **매도 (Short/Close) 조건**:
        *   **기본**: 기울기가 양수(+)에서 음수(-)로 변할 때.
        *   **손절 (Stop Loss)**: 매수가 대비 -2% 도달 시 즉시 강제 매도.
        *   **익절 (Take Profit)**: 매수가 대비 +5% 도달 시 즉시 강제 매도.
        *   **추적 손절매 (Trailing Stop)**: 최고가 대비 -2% 하락 시 매도.

5.  **수수료 및 슬리피지 반영 (Fees & Slippage)**
    *   매수/매도 수수료: 0.05%
    *   슬리피지: 0.1%

### 2. UI 구성 요소 및 로직 - v2.0 Simplified

#### Activity Bar (좌측 아이콘 바) - 모드 전환용
*   기존 간격 선택 버튼(1m, 5m, 1d, 2d...)을 **모드 아이콘**으로 대체.
*   **아이콘 구성**:
    *   📊 **시뮬레이션 (Simulation)**: 매매 전략 시뮬레이션 결과 표시
    *   📋 **데이터 뷰 (Data View)**: 날짜별 상세 데이터 테이블
    *   📈 **차트 뷰 (Chart View)**: 가격 라인 차트 + AI 예측
    *   🔍 **분석 (Analyze)**: 전체 종목 스캔 및 매매 신호
    *   📅 **실적 임팩트 (Earnings)**: 실적 발표 캘린더 및 가격 변동 임팩트 예측
    *   💬 **종목 토론 (Discussion)**: Naver/Stocktwits/Reddit/Yahoo/Toss 실시간 토론
    *   ❓ **AI 질문 (Financial QA)**: 기업 정보 질의응답 (Wikipedia 기반)

#### 상단 컨트롤 (Top Controls)
*   **자산 토글 (Toggle)**: `Coin` / `Stock` 선택. 변경 시 데이터 초기화 후 일봉 로드.
*   **티커 그룹 선택 (Ticker Group)**:
    *   **Superinvestor**: DataRoma 기반 거물 투자자 포트폴리오.
    *   **Indices**: 주요 지수 (S&P 500, Nasdaq 100, VIX, etc.) 직접 분석.
    *   **S&P 500**: Wikipedia Scraper 기반 구성 종목 리스트.
    *   **Nasdaq 100**: Wikipedia Scraper 기반 구성 종목 리스트.
    *   **내 보유종목**: KIS API 연동 실시간 계좌 잔고.
    *   **거래량 급증 (60분)**: KIS API 기반 실시간 랭킹 데이터.
*   **스마트 티커 선택 (Smart Ticker Selection)**: 선택된 그룹 내 종목 리스트 제공 및 검색.
*   **자동 매매 카운트다운**:
    *   자동 매매 활성화 시, 다음 실행까지 남은 시간(HH:mm)을 실시간으로 표시.
    *   장 마감 시간 기준 서머타임 자동 적용.

#### Sidebar (전략 설정)
*   자산관리, 필터, 마틴게일 설정 등 기존과 동일.
*   시뮬레이션 실행 버튼.

#### Editor Area (메인 뷰 영역)
*   **소개 화면 (Intro Screen)**:
    *   모든 탭이 닫혀있거나 초기 실행 시 표시.
    *   비트코인/주식 시뮬레이션의 주요 기능(시뮬레이션, 시장 분석, AI 예측, 실시간 매매)에 대한 요약 카드 제공.
    *   시작 가이드(Getting Started) 및 단축키 안내 포함.
*   **티커 탭 (Ticker Tabs)**:
    *   여러 티커를 동시에 열어두고 탭으로 전환 가능 (VS Code 스타일).
    *   티커 선택 시 새로운 탭이 추가되며, `x` 버튼으로 닫기 가능.
*   Activity Bar에서 선택한 모드에 따라 다른 뷰 렌더링:
    *   **시뮬레이션 모드**: 수익률, 승률, 거래 내역 테이블
    *   **데이터 뷰 모드**: 날짜별 가격/지표 테이블
    *   **차트 뷰 모드**: Recharts 라인 차트 + AI 예측 (점선)
    *   **분석 모드**: 전체 종목 스캔 결과 테이블
    *   **토론 모드**: Naver/Stocktwits/Reddit/Yahoo/Toss 종목 토론 게시글 리스트
    *   **QA 모드**: AI와 대화형 챗봇 인터페이스

#### 데이터 뷰어 (Data Viewer)
*   **테이블 모드**: `날짜` | `가격 (Median)` | `기울기 (Slope)` | `BB Status` 등.

#### 차트 뷰어 (Chart Viewer)
*   **메인 차트**: 고성능 **OHLC 캔들스틱 차트** (Recharts Custom Shape).
*   **보조지표 (Toggle)**:
    *   이동평균선 (MA20, MA50)
    *   볼린저 밴드 (Upper, Lower)
    *   RSI (하단 별도 차트, Sync 적용)
*   **AI 가격 예측 (Forecast)**: 
    *   API: `POST https://younginpiniti-bitcoin-ai-backend.hf.space/v1/forecast`
    *   Payload: `{ "symbol": "[TICKER]", "interval": "day" }`
    *   과거 데이터: 캔들스틱
    *   예측 데이터: 밝은 계열 **점선(dashed line)**
*   **기능**: Brush 기능을 통한 기간 줌인/줌아웃 지원.



#### 시장 전체 분석 (Market Analysis / Scanner)
*   **선택된 티커 그룹(Ticker Group)** 내 전체 종목 스캔.
*   각 종목별 매매 신호(BUY/SELL/HOLD) 표시.
*   **매매 실행 (Trade Execution)**:
    *   신호 클릭 시 **KIS 주문 다이얼로그** 표시.
    *   **실시간 현재가 자동 조회** 및 주문 단가 설정.
    *   매수/매도 수량 및 단가 설정 후 실시간 주문 실행 (KIS API 연동).
*   **세력 수급 분석 (Whale Analysis)**:
    *   API: `POST https://younginpiniti-bitcoin-ai-backend.hf.space/v1/whale`
    *   대량 거래량 및 VWAP 분석을 통해 세력 평단가 추정 및 매집/분산 상태 진단.
    *   매매 신호 통합: 세력 평단가와 현재가 비교, OBV/MFI 다이버전스 체크.
*   AI 감성 분석 (FinBERT) 점수 통합.

#### 실시간 분석 (Real-time Analysis) - New
*   **개요**: 선택된 티커 그룹에서 최대 **40개** 종목을 선별하여 실시간으로 가격을 추적하고 매매 전략을 적용.
*   **동작 방식**:
    1.  **그룹 내 상위 40개 선정**: 티커 그룹 목록이 많을 경우 순차적으로 40개까지만 분석 대상에 포함.
    2.  **데이터 최적화**:
        *   분봉(Min) 분석 시, 5000개가 아닌 **최근 300개** 캔들 데이터만 조회하여 API 부하 감소.
    3.  **WebSocket 실시간 구독**:
        *   선정된 40개 종목에 대해 KIS WebSocket을 통해 실시간 체결가 수신.
        *   1분 간격(또는 봉 마감 시)으로 캔들 데이터를 업데이트하고 전략 재평가.
    4.  **UI 업데이트**:
        *   실시간으로 변하는 매매 신호(BUY/SELL/HOLD)를 화면에 즉시 반영.
        *   매수/매도/보유 상태를 한눈에 모니터링.
    5.  **실시간 가상 매매 로그 (Paper Trading Log)**:
        *   매매 전략에 따라 `BUY` 신호 발생 시 가상 매수, `SELL` 신호 발생 시 가상 매도.
        *   실제 주문은 전송하지 않고(Paper Trading), 체결 내역 및 수익률을 우측 사이드 패널에 실시간으로 기록.
        *   전략 변경 시에도 가상 매매는 계속 유지되어 누적 수익률 확인 가능.

#### 포트폴리오 대시보드 (Portfolio Dashboard) - New
*   **시각화**: 보유 종목 섹터별/종목별 비중 파이 차트 (`Recharts`).
*   **리스크 관리 지표**:
    *   **MDD (Maximum Drawdown)**: 최근 60일 고점 대비 최대 하락률.
    *   **변동성 (Volatility)**: 연환산 변동성 (표준편차 기반).
    *   **Sharpe Ratio**: 향후 추가 예정.
*   **매매 신호 통합**: 내 보유 종목에 대한 실시간 '매수/매도/보류' 신호 및 추천 액션(추매, 익절, 손절) 표시.
*   **데이터 갱신**: KIS 잔고 데이터 + Yahoo Finance 과거 데이터 하이브리드 사용.

#### 실적 발표 임팩트 분석 (Earnings Impact Predictor) - New
*   **기능**: 예정된 실적 발표 캘린더를 통합하고, 과거 실적 발표 전후의 주가 데이터를 분석하여 변동성 예측.
*   **AI 예측**:
    *   'Surprise' 시나리오별 예상 상승/하락폭 산출.
    *   최근 4분기 예측치 vs 실제 실적 비교 차트 제공.
*   **데이터 소스**: Yahoo Finance `quoteSummary` (earningsHistory, calendarEvents).

#### AI 모델 활용 가이드
*   상세 내용은 `.agent/skills/ai-models.md` 참조.


### 3. 스타일링 (VS Code Theme)

#### 스크롤바 스타일링
*   VS Code 다크 테마와 일관된 **커스텀 스크롤바** 적용.
*   색상: 배경 `#1e1e1e`, 썸 `#424242`, 호버 `#4f4f4f`.
*   너비: 8px (슬림 디자인).

### 4. 확장성 및 구조 개선 (Architecture)

#### 단순화된 데이터 흐름
```
[Upbit/Yahoo API] ---(1일봉)---> [Store] ---(지표 계산)---> [UI]
```

*   기존의 복잡한 간격별 집계 로직 제거.
*   Store에서 `hist['1d']`만 관리.
*   모드 전환은 `viewMode` 상태로 관리.
    
    #### 데이터 구조 & 교차 검증 (Data Structuring)
    *   **Group Management**:
        *   `groupStocks`: 현재 선택된 그룹의 종목 리스트 (Source of Truth).
        *   `recommendedStocks`: `Superinvestor` 그룹 데이터 캐싱용 (24h). 'Superinvestor' 그룹 선택 시 `recommendedStocks` 복사본이 `groupStocks`로 이동.
        *   API별 상이한 거래소 코드(NYQ, NMS 등)를 표준 코드(NYS, NAS 등)로 매핑.
        *   초기 리스트 로딩 시(DataRoma 등) 거래소 정보가 없어도, 분석 단계에서 상세 데이터(Yahoo Finance) 조회 시 거래소 정보를 동적으로 보정 및 업데이트.

### 5. 자동 매매 시스템 (Auto Trading System) - New

#### 개요
사용자가 설정한 조건에 따라 미국 주식 장 마감 직전(예: 30분 전)에 자동으로 시장을 분석하고 매수/매도 주문을 실행하는 시스템입니다.

#### 설정 (Settings)
*   **매매 전략 (자동 매매 전용)**: 설정 다이얼로그에서 개별적으로 선택 가능.
    *   `BB (볼린저 밴드)`: 하단 이탈 조건 필터.
    *   `추세 (MA50)`: 현재가 > MA50 조건.
    *   `추세 (MA20)`: 현재가 > MA20 조건.
    *   `RSI (과매수 방지)`: RSI < 70 조건.
    *   `거래량 필터`: 현재 거래량 > VMA20 조건.
    *   *(참고: 선택된 모든 필터 조건 충족 시 매매 신호 발생)*
*   **대상 그룹**: 분석할 티커 그룹 (예: S&P 500, Superinvestor 등).
*   **주문 수량**:
    *   **수량(Quantity) 기준**: 예) 1주, 10주
    *   **금액(Amount) 기준**: 예) $1,000 (현재가 기준 수량 계산)
*   **실행 시점**: 장 마감 N분 전.
*   **자동 매매**: ON/OFF 스위치.
*   **즉시 실행 (테스트)**:
    *   버튼 클릭 시 매매 로직을 즉시 실행.
    *   매수 수량/금액을 `0`으로 강제 설정하여 실제 주문 체결 없이 로직 검증 가능.
    *   분석 -> 매수/매도 대상 선정 -> 로그 출력까지의 전체 프로세스 확인용.

#### 실행 로직 (Workflow)
1.  **스케줄러 (Scheduler)**:
    *   매분 현재 시간을 체크하여 서머타임(DST) 적용 여부에 따른 장 마감 시간을 계산.
    *   설정된 "마감 N분 전" 도달 시 자동 매매 프로세스 트리거.
    *   **중복 실행 방지**: 하루에 한 번만 실행되도록 `lastRunDate` 체크.
2.  **보유 종목 조회 (Step 3)**:
    *   KIS API를 통해 현재 계좌의 보유 종목 및 잔고 조회.
3.  **매수 대상 분석 (Step 4)**:
    *   설정된 **티커 그룹 (Target Group)** 의 데이터 로드.
    *   각 종목에 대해 전략(Strategy) 분석 수행.
    *   **BUY 신호**: 신호가 `BUY`이면서, **현재 보유하지 않은 종목**을 `매수 대상`으로 선정.
4.  **매도 대상 분석 (Step 5)**:
    *   **내 보유 종목 (My Holdings)** 전체 조회.
    *   각 보유 종목에 대해 전략 분석 수행.
    *   **SELL 신호**: 신호가 `SELL`인 종목을 `매도 대상`으로 선정.
    *   *(참고: 매수 대상 목록에 포함된 종목은 제외)*
5.  **매도 실행 (Step 6)**:
    *   `매도 대상` 종목에 대해 KIS 매도 주문 전송 (전량 매도).
6.  **매수 실행 (Step 7)**:
    *   `매수 대상` 종목에 대해 KIS 매수 주문 전송 (설정된 금액/수량).
7.  **체결 모니터링 시작 (Step 8)**:
    *   주문 체결 확인을 위한 백그라운드 모니터링 시작.
8.  **결과 로그**:
    *   실행 결과 및 주문 내역을 로그(Log) 창에 기록.

#### 매매 히스토리 기록 (Trade History) - New
*   **Database**: Supabase (PostgreSQL)
*   **테이블**: `trade_history`
*   **기록 항목**: 계좌번호, 티커, 매수일, 매수금, 매도일, 매도금, 이익률, 상태
*   **체결 모니터링 로직**:
    1.  **주문 추적**: 매매 주문 성공 시 추적 목록에 추가.
    2.  **미체결 조회**: 10분 간격으로 KIS 미체결내역 API 조회 (`TTTS3018R`).
    3.  **체결 확인**: 미체결 목록에 없으면 체결 완료로 판단.
    4.  **DB 기록**:
        *   **매수 체결**: `INSERT` (새 레코드, status: HOLDING)
        *   **매도 체결**: 
            *   기존 HOLDING 레코드 있음 → `UPDATE` (이익률 계산)
            *   기존 레코드 없음 (프로그램 전 보유종목) → `INSERT` (매수일=당일, 매수가=잔고평균가)
    5.  **종료 조건**:
        *   모든 주문 체결 완료 (추적 목록 empty)
        *   장 마감 1분 전 도달 (마지막 조회 후 종료)
    6.  **상태 초기화**: 모니터링 종료 시 추적 목록 및 상태 초기화.

#### 환경 변수 설정
```bash
# .env 파일에 추가
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxxxx
```

#### Supabase 테이블 생성 쿼리
```sql
-- 매매 히스토리 테이블
CREATE TABLE trade_history (
    id BIGSERIAL PRIMARY KEY,
    account_no VARCHAR(20) NOT NULL,           -- 계좌번호 (예: 12345678-01)
    ticker VARCHAR(20) NOT NULL,               -- 종목코드 (예: AAPL)
    buy_date DATE,                             -- 매수일 (YYYYMMDD)
    buy_price DECIMAL(15, 4),                  -- 매수가 (USD)
    buy_qty INTEGER,                           -- 매수수량
    buy_order_no VARCHAR(20),                  -- 매수주문번호
    sell_date DATE,                            -- 매도일 (YYYYMMDD)
    sell_price DECIMAL(15, 4),                 -- 매도가 (USD)
    sell_qty INTEGER,                          -- 매도수량
    sell_order_no VARCHAR(20),                 -- 매도주문번호
    profit_rate DECIMAL(10, 4),                -- 이익률 (%)
    status VARCHAR(20) DEFAULT 'HOLDING',      -- 상태: HOLDING, COMPLETED
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (조회 성능 최적화)
CREATE INDEX idx_trade_history_account ON trade_history(account_no);
CREATE INDEX idx_trade_history_ticker ON trade_history(account_no, ticker, status);
CREATE INDEX idx_trade_history_status ON trade_history(status);

-- RLS 정책 (API Key 인증 시 모든 접근 허용)
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations" ON trade_history FOR ALL USING (true);
```
