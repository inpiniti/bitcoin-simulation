# 아키텍처 가이드 (Architecture Guide)

이 프로젝트는 관심사의 분리(Separation of Concerns) 원칙에 따라 코드를 구성하고 있습니다. 함수가 정의되는 위치에 따라 그 역할과 책임이 다릅니다.

## 1. 코드 분류 기준 (Code Classification)

| 위치 (Path) | 분류 (Type) | 역할 (Role) | 특징 (Characteristics) |
| :--- | :--- | :--- | :--- |
| **`src/lib/`** | **Domain Logic** | 비즈니스 핵심 로직 | 특정 도메인(금융/주식) 지식 포함, 순수 함수 지향, UI 독립적 |
| **`src/utils/`** | **Utility** | 범용 헬퍼 함수 | 도메인 지식 없음, 다른 프로젝트 재사용 가능, 단순 기능 수행 |
| **`src/store/`** | **State Logic** | 상태 관리 및 액션 | 전역 데이터 관리, 비즈니스 로직(Lib)과 UI 연결(Orchestration) |
| **Components** | **UI Logic** | 화면 표현 및 인터랙션 | 이벤트 핸들링, 데이터 포맷팅, 뷰(View) 상태 관리 |

---

## 2. 상세 설명 및 예시

### 🏗️ Lib (`src/lib/`)
**"이 앱의 핵심 기능은 무엇인가?"**
주식 시뮬레이션, 지표 계산, 매매 신호 분석 등 애플리케이션의 존재 이유가 되는 로직들입니다. 리액트나 뷰와 같은 UI 라이브러리와 무관하게 동작해야 합니다.
- **예시**:
    - `calculateRSI(data)`: 가격 배열을 받아 RSI 지표를 계산 (순수 수학/금융 로직)
    - `api.fetchStockData(ticker)`: 외부 데이터 소스와 통신

### 🛠️ Utils (`src/utils/`)
**"도구 상자"**
날짜 포맷팅, 숫자 콤마 찍기, 문자열 조작 등 어느 프로젝트에서나 쓸 수 있는 단순한 도구들입니다.
- **예시**:
    - `formatDate(date)`: Date 객체를 "YYYY-MM-DD" 문자열로 변환
    - `cn(...)`: Tailwind CSS 클래스 병합

### 🗄️ Store (`src/store/`)
**"관제탑 (Controller)"**
UI에서 발생한 이벤트를 받아 `Lib`의 로직을 실행시키고, 그 결과를 전역 상태(State)에 업데이트하여 UI에 반영합니다.
- **예시**:
    - `runSimulation()`:
        1. 현재 데이터(`state.hist`)를 가져옴
        2. `Lib`의 `generateIntegratedTrades()` 실행
        3. 결과를 `state.simul`에 저장
        4. UI 컴포넌트들이 변경된 `state.simul`을 감지하고 리렌더링

### 🖼️ Components (`src/components/`)
**"사용자 인터페이스 (View)"**
사용자 입력을 받고, 데이터를 시각적으로 보여줍니다. 복잡한 계산은 피하고, 주로 `Store`의 함수를 호출하거나 간단한 UI 제어만 수행해야 합니다.
- **예시**:
    - `handleClick()`: 버튼 클릭 시 `store.setViewMode('chart')` 호출
    - `formatPrice(value)`: 렌더링 직전에 가격에 `$` 붙이기 (간단한 포맷팅)

---

## 3. 올바른 리팩토링 방향
컴포넌트 안에 `useEffect`나 복잡한 `if-else` 로직이 너무 길다면?
1. **계산 로직인가?** -> `src/lib/`으로 이동 (순수 함수화)
2. **범용 기능인가?** -> `src/utils/`로 이동
3. **상태 변경인가?** -> `src/store/`의 액션으로 이동
4. **UI 재사용인가?** -> 별도 `Component`로 분리
