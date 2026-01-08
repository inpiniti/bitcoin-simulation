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
| [● Coin] [○ Stock]  |  종목코드: [ AAPL ] (Stock 선택 시 활성화)                        |
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
- 🎮 시뮬레이션 (Simulation): 매매 전략 시뮬레이션 결과
- 📊 데이터 뷰 (Data View): 날짜별 상세 데이터 테이블
- 📈 차트 뷰 (Chart View): 가격 차트 + AI 예측
- 🔍 분석 (Analyze): 전체 종목 스캔 및 매매 신호
```

## 주요 기능 (Features)

- **자산 모드 전환**: 암호화폐(Coin)와 주식(Stock) 모드 지원.
- **종목 선택**: 주식 모드 시 티커(Ticker) 입력 가능 (예: AAPL, TSLA, NVDA).
- **데이터 소스 (1일봉 통일)**: 
    - **Coin**: Upbit API (**일봉** 기반으로 통일)
    - **Stock**: Yahoo Finance (일봉 기반, CORS Proxy 적용)
- **매매 전략 시뮬레이션**: 수량 고정, BB(볼린저 밴드), 다양한 필터 및 마틴게일 전략 적용.
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

#### 상단 컨트롤 (Top Controls)
*   **자산 토글 (Toggle)**: `Coin` / `Stock` 선택. 변경 시 데이터 초기화 후 일봉 로드.
*   **스마트 티커 선택 (Smart Ticker Selection)**: 직접 입력 또는 추천 종목 콤보박스.

#### Sidebar (전략 설정)
*   자산관리, 필터, 마틴게일 설정 등 기존과 동일.
*   시뮬레이션 실행 버튼.

#### Editor Area (메인 뷰 영역)
*   Activity Bar에서 선택한 모드에 따라 다른 뷰 렌더링:
    *   **시뮬레이션 모드**: 수익률, 승률, 거래 내역 테이블
    *   **데이터 뷰 모드**: 날짜별 가격/지표 테이블
    *   **차트 뷰 모드**: Recharts 라인 차트 + AI 예측 (점선)
    *   **분석 모드**: 전체 종목 스캔 결과 테이블

#### 데이터 뷰어 (Data Viewer)
*   **테이블 모드**: `날짜` | `가격 (Median)` | `기울기 (Slope)` | `BB Status` 등.

#### 차트 뷰어 (Chart Viewer)
*   **라인 차트**: 실제 가격(실선) + AI 예측(점선)
*   **AI 가격 예측 (Forecast)**: 
    *   API: `POST https://younginpiniti-bitcoin-ai-backend.hf.space/v1/forecast`
    *   Payload: `{ "symbol": "[TICKER]", "interval": "day" }`
    *   과거 데이터: 파란 계열 **실선(solid line)**
    *   예측 데이터: 밝은 계열 **점선(dashed line)**

#### 시장 전체 분석 (Market Analysis / Scanner)
*   추천 종목 리스트 전체 스캔.
*   각 종목별 매매 신호(BUY/SELL/HOLD) 표시.
*   AI 감성 분석 (FinBERT) 점수 통합.

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
