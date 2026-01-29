# Dialog Components

사용자 인터랙션을 위한 모달(Modal) 창 및 팝업 컴포넌트들입니다. `Radix UI` 기반의 `shadcn/ui` Dialog Primitive를 사용하여 접근성과 키보드 내비게이션을 지원합니다.

---

## GlobalAlertDialog
**Path:** `src/components/GlobalAlertDialog.jsx`

애플리케이션 전역에서 발생하는 에러나 중요 알림을 표시하는 단일(Singleton) 다이얼로그입니다. `useStore`의 `globalError` 상태를 구독하며, 값이 설정되면 즉시 화면에 나타납니다.

### State Dependencies
- `globalError`: `{ title: string, message: string } | null`

### 동작 원리
1. `useStore.setState({ globalError: { ... } })` 호출 시 렌더링됨.
2. "확인" 버튼 클릭 또는 배경 클릭 시 `setGlobalError(null)`을 호출하여 닫힘.

### Example Usage
```javascript
// 컴포넌트가 아니더라도 스토어를 통해 호출 가능
useStore.getState().setGlobalError({
  title: "네트워크 오류",
  message: "서버와 연결할 수 없습니다."
});
```

---

## AutoTradingDialog
**Path:** `src/components/AutoTradingDialog.jsx`

자동 매매를 설정하고 제어하는 다이얼로그입니다. 매매 대상 그룹(보유종목, S&P500 등), 1회 주문 금액, 전략 옵션(마틴게일 배수 등)을 상세하게 설정할 수 있습니다.

### Features
- **Activation Security**: 자동 매매 활성화 시 KIS 로그인이 필수이며, 비로그인 상태에서 시도 시 안내 메시지가 표시됨.
- **Target Selection**: 매매할 종목군 선택 (보유종목, S&P 500 등).
- **Form Controls**: 수량, 금액, 배수 등을 입력하는 폼 제공.
- **Log Viewer**: 지난 자동 매매 실행 로그를 실시간으로 확인 가능.
- **Test Mode**: 실제 주문 없이 분석 로직만 검증할 수 있는 즉시 실행 테스트 기능 제공.

### Example Usage
```jsx
<Dialog>
  <DialogTrigger>자동매매 설정</DialogTrigger>
  <DialogContent>
    <AutoTradingDialog />
  </DialogContent>
</Dialog>
```

---

## KISOrderDialog
**Path:** `src/components/KISOrderDialog.jsx`

한국투자증권 API를 이용해 실제 주식 매수/매도 주문을 넣는 폼입니다.

### Features
- **호가창 연동**: (예정) 현재가 및 호가 정보를 실시간 반영.
- **주문 검증**: 매수 가능 금액, 보유 수량 등을 사전에 체크.
- **주문 실행**: `kisApi.orderStock` 함수 호출.
