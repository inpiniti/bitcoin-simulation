# UI Components

애플리케이션 전역에서 사용되는 공통 UI 컴포넌트들입니다. 시각적 피드백과 사용자 경험 개선을 위해 Framer Motion 애니메이션이 적용되어 있습니다.

---

## AnimatedNumber
**Path:** `src/components/ui/AnimatedNumber.jsx`

숫자가 변경될 때 부드럽게 카운팅되는 효과와 함께, 값의 상승/하락에 따른 색상 플래시 효과를 제공합니다.

### 구문 (Syntax)
```jsx
<AnimatedNumber 
  value={price} 
  format={(v) => v.toFixed(2)} 
  flashOnUpdate={true} 
/>
```

### 매개변수 (Props)
- `value` (number): 표시할 숫자 값.
- `format` (function): 숫자를 문자열로 변환하는 포맷터 함수.
- `flashOnUpdate` (boolean): 값이 바뀔 때 색상 강조 효과 여부.

---

## AnimatedTableRow
**Path:** `src/components/ui/AnimatedTableRow.jsx`

실시간 데이터 업데이트 시 해당 행(Row) 전체에 시각적 효과를 줍니다.

### 구문 (Syntax)
```jsx
<AnimatedTableRow item={item}>
  <TableCell>...</TableCell>
</AnimatedTableRow>
```

### 상세 기능
- **배경 펄스**: 데이터 변경 시 배경색이 순간적으로 밝아짐.
- **좌측 인디케이터**: 행 왼쪽에 상승(빨강)/하락(초록) 표시 바가 나타남.
- **보더 스캔**: 테두리를 따라 빛이 지나가는 애니메이션 효과.

---

## 예제 (Example) - AnalysisPanel 통합
```jsx
import { AnimatedTableRow } from "@/components/ui/AnimatedTableRow"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

// ...
<TableBody>
  {analysisResult.map((item) => (
    <AnimatedTableRow key={item.ticker} item={item}>
      <TableCell>
        <AnimatedNumber value={item.price} />
      </TableCell>
    </AnimatedTableRow>
  ))}
</TableBody>
```
