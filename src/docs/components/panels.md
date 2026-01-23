# Feature Panels

애플리케이션의 핵심 기능을 제공하는 다양한 패널 컴포넌트들입니다. 대부분 탭 바(TabBar) 아래에 렌더링되거나 `EditorArea` 내에서 전환됩니다.

---

## OverviewPanel
**Path:** `src/components/OverviewPanel.jsx`

선택된 종목의 기업 개요(Summary)와 주요 재무 정보(Financials), 현재가 정보를 표시합니다. Web Scraper 또는 API를 통해 가져온 `fetchStockOverview`의 결과를 보여줍니다.

### Features
- **기업 설명**: 비즈니스 모델 및 주요 제품 요약.
- **Key Stats**: 시가총액(Market Cap), PER, EPS, 배당률 등.
- **AI 요약**: (기능 예정) LLM 기반 기업 분석 요약.

### Example Usage
```jsx
<PanelContainer>
  <OverviewPanel />
</PanelContainer>
```

---

## AnalysisPanel
**Path:** `src/components/AnalysisPanel.jsx`

기술적 분석(RSI, MACD, Bollinger Bands 등) 지표의 현재 상태를 시각적으로 보여주는 대시보드입니다. 매수/매도 시그널 상태와 각 지표의 과매수/과매도 여부를 게이지나 텍스트로 표현합니다.

### State Dependencies
- `hist`: 분석할 과거 캔들 데이터.
- `strategyOptions`: 사용자가 설정한 전략 파라미터.

### Example Usage
```jsx
// 분석 탭 활성화 시 렌더링
{activeTab === 'analysis' && <AnalysisPanel />}
```

---

## SimulationPanel
**Path:** `src/components/SimulationPanel.jsx`

백테스팅 시뮬레이션을 실행하기 위한 컨트롤 패널입니다. 전략 옵션(이동평균선 사용 여부, 마틴게일 설정 등)을 수정하고 "시뮬레이션 시작" 버튼을 제공합니다.

### Features
- **전략 토글**: RSI, BB, Trend Following 등 전략 On/Off.
- **자금 관리 설정**: 단리/복리/마틴게일 선택.
- **실행 버튼**: `useStore.runSimulation()` 트리거.

### Example Usage
```jsx
<div className="p-4">
  <SimulationPanel />
</div>
```

---

## ResultPanel
**Path:** `src/components/ResultPanel.jsx`

시뮬레이션 실행 후 생성된 결과 리포트를 표시합니다. 총 수익률(Return), 승률(Win Rate), 최대 낙폭(MDD), 거래 횟수 등을 요약 카드와 차트로 보여주며, 하단에는 상세 거래 로그(Trade Logs) 테이블을 렌더링합니다.

### State Dependencies
- `simul`: 시뮬레이션 결과 객체 (`{ summary, trades }`).

### Example Usage
```jsx
const simul = useStore(state => state.simul);
if (!simul) return <div>결과가 없습니다.</div>;

return <ResultPanel />;
```

---

## FinancialQAPanel
**Path:** `src/components/FinancialQAPanel.jsx`

생성형 AI (RAG 등)를 활용하여 해당 종목의 재무제표나 뉴스에 대해 자연어로 질의응답을 할 수 있는 챗 인터페이스입니다.

### Features
- **채팅 UI**: 사용자 입력 및 AI 응답 표시.
- **Context Awareness**: 현재 선택된 종목의 데이터를 컨텍스트로 활용.

---

## EarningsImpactPanel
**Path:** `src/components/EarningsImpactPanel.jsx`

과거 실적 발표일(Earnings Date) 전후의 주가 패턴을 분석하여, 어닝 서프라이즈/쇼크 시의 변동성과 승률을 통계적으로 보여줍니다.

### State Dependencies
- `earningsHistory`: 과거 실적 데이터.
- `priceHistory`: 과거 주가 데이터.

---

## IntroScreen
**Path:** `src/components/IntroScreen.jsx`

특정 뷰가 활성화되지 않았을 때(초기 실행 시 또는 모든 탭 종료 시) 표시되는 소개 화면입니다. 시뮬레이션, 시장 스캔, AI 예측 등 주요 기능으로 바로 진입할 수 있는 바로가기 카드와 시작 가이드를 제공합니다.

### Features
- **기능 바로가기**: 주요 기능(Simulation, Scanner, AI Forecast, Real-time Trading)으로 빠른 이동.
- **Getting Started**: 간단한 사용 가이드 문구 제공.
- **비주얼 효과**: 그라디언트 및 애니메이션 효과가 적용된 환영 메시지.

### Example Usage
\`\`\`jsx
// EditorArea 내에서 조건부 렌더링
if (!activeView) {
  return <IntroScreen />;
}
\`\`\`
