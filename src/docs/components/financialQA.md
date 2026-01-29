### FinancialQAPanel
AI 기반 금융 Q&A 패널입니다. Wikipedia 및 Yahoo Finance에서 수집한 기업 정보를 바탕으로 자연어 답변을 생성합니다.

#### 구문 (Syntax)
```javascript
<FinancialQAPanel />
```

#### 주요 기능 (Features)
- **자연어 질문 처리**: 기업 개요, 본사 위치, 제품/서비스 등에 대한 영어 질문을 처리합니다.
- **자동 워밍업 (Warm-up)**: 컴포넌트 마운트 시 Hugging Face 모델 서버의 상태를 확인하고 필요한 경우 깨웁니다.
- **한글 감지**: 한글 질문 시 영어 질문을 유도하는 가이드를 제공합니다.
- **실시간 상태 표시**: AI 서버의 Ready/Loading/Offline 상태를 시각적으로 표시합니다.

#### 의존성 (Dependencies)
- **Store**: `useStore` (ticker 정보 사용)
- **API**: `fetchStockOverview`, `warmupAIModel`
- **UI**: `shadcn/ui` (ScrollArea, Input, Button, Card)

#### 예제 (Example)
```javascript
import { FinancialQAPanel } from "@/components/FinancialQAPanel";

function App() {
  return (
    <div className="h-screen">
      <FinancialQAPanel />
    </div>
  );
}
```
