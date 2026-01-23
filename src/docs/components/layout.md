# Layout & Navigation Components

앱의 전체적인 레이아웃과 내비게이션 구조를 담당하는 컴포넌트들입니다. VS Code 스타일의 UI를 지향하며, 화면 분할과 패널 전환을 관리합니다.

---

## EditorArea
**Path**: `src/components/layout/EditorArea.jsx`

메인 콘텐츠 영역을 표시하는 컨테이너입니다. `viewMode` 상태에 따라 차트, 분석 패널, 문서 뷰어 등을 조건부로 렌더링하거나, 탭 기반으로 여러 패널을 관리합니다. 동적 import (`Suspense`)와 지연 로딩을 지원합니다.

### Props
이 컴포넌트는 별도의 Props를 받지 않습니다. 모든 상태는 `useStore`에서 관리됩니다.

### State Dependencies
- `viewMode`: 현재 표시할 뷰 모드 (`chart`, `analyze`, `docs` 등)
- `globalError`: 에러 발생 시 알림 표시

### Example Usage
```jsx
// App.jsx
import { EditorArea } from '@/components/layout/EditorArea';

function App() {
  return (
    <div className="flex h-screen">
      {/* ... Sidebar ... */}
      <EditorArea />
    </div>
  );
}
```

---

## TitleBar
**Path**: `src/components/layout/TitleBar.jsx`

애플리케이션 최상단에 위치한 바(Bar)입니다. 종목 검색(Ticker Search), 앱 모드 변경(Stock/Coin), 시간 표시, 자동매매 타이머, 설정 진입 버튼 등을 포함합니다.

### Props
Props 없이 독립적으로 동작합니다.

### 주요 기능
- **종목 검색**: 엔터 키 입력 시 `useStore.setTicker()`를 호출하여 종목을 변경합니다.
- **모드 전환**: 주식 모드와 코인 모드를 토글합니다.
- **자동매매 타이머**: 다음 매매 주기까지 남은 시간을 카운트다운합니다.

### Example Usage
```jsx
<div className="flex flex-col h-screen">
  <TitleBar />
  <div className="flex-1 flex overflow-hidden">
    {/* Body Content */}
  </div>
</div>
```

---

## ActivityBar
**Path**: `src/components/layout/ActivityBar.jsx`

화면 좌측 최외곽에 위치한 아이콘 메뉴입니다. VS Code의 액티비티 바와 유사하며, 클릭 시 사이드바(Sidebar)의 내용을 전환합니다.

### Props
Props 없이 동작합니다. `viewMode` 상태를 변경하는 역할을 합니다.

### 아이콘 구성
- **Files (`search`)**: 탐색기 및 검색
- **Analysis (`bar-chart`)**: 차트 및 분석 도구
- **Graph (`line-chart`)**: 실시간 차트
- **Docs (`book`)**: 문서 뷰어

### Example Usage
```jsx
<div className="w-12 bg-[#333] flex flex-col items-center py-4">
  <ActivityBar />
</div>
```

---

## Sidebar
**Path**: `src/components/layout/Sidebar.jsx`

액티비티 바 우측에 위치하며, 선택된 메뉴에 따른 세부 패널을 표시합니다. 예를 들어, `Docs` 메뉴 선택 시 문서 트리 목록(`DocsSidebarContent`)을 렌더링하고, `Search` 선택 시 종목 검색 히스토리나 추천 종목을 표시합니다.

### Props
이 컴포넌트는 Props를 받지 않습니다.

### Sub-Components
- `DocsSidebarContent`: 문서 목록 트리 뷰
- `TickerSelectionPanel`: 종목 선택 및 추천 기능

### Example Usage
```jsx
<aside className="w-64 bg-[#252526] border-r border-[#1e1e1e]">
  <Sidebar />
</aside>
```
