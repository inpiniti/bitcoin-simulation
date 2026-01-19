---
description: 번들 크기 및 렌더링 성능 분석 워크플로우
---

# 성능 분석 워크플로우

애플리케이션의 번들 크기와 렌더링 성능을 분석합니다.
// turbo-all

## 1단계: 번들 분석

### 빌드 및 크기 확인
// turbo
```powershell
npm run build
```

### 번들 크기 분석 (rollup-plugin-visualizer 사용 시)
```powershell
npx vite-bundle-visualizer
```

### 주요 체크 항목
| 항목 | 권장 기준 | 확인 방법 |
|------|-----------|-----------|
| 초기 JS 번들 | < 200KB (gzip) | `dist/assets/*.js` 크기 확인 |
| CSS 번들 | < 50KB | `dist/assets/*.css` 크기 확인 |
| 첫 페이지 로드 | < 3초 | Lighthouse 측정 |

## 2단계: 종속성 분석

### 큰 패키지 확인
```powershell
npx depcheck
```

### 트리 쉐이킹 확인
- lodash → lodash-es 사용 권장
- moment → date-fns 또는 dayjs 권장
- 전체 라이브러리 import 대신 개별 함수 import

```javascript
// ❌ Bad
import _ from 'lodash';

// ✅ Good
import { debounce } from 'lodash-es';
```

## 3단계: React 렌더링 성능

### React DevTools Profiler
1. 브라우저에서 React DevTools 열기
2. Profiler 탭 선택
3. 녹화 시작 → 작업 수행 → 녹화 중지
4. 불필요한 리렌더링 확인

### 리렌더링 최적화 체크리스트
- [ ] `React.memo()` 적용 여부
- [ ] `useMemo()` 비싼 계산에 적용
- [ ] `useCallback()` 콜백 함수에 적용
- [ ] 상태 분리 (불필요한 리렌더링 방지)

### 코드 예시
```jsx
// ❌ Bad: 매 렌더링마다 새 객체 생성
<Chart options={{ theme: 'dark' }} />

// ✅ Good: 메모이제이션
const chartOptions = useMemo(() => ({ theme: 'dark' }), []);
<Chart options={chartOptions} />
```

## 4단계: 런타임 성능

### Chrome DevTools Performance
1. F12 → Performance 탭
2. 녹화 시작
3. 시뮬레이션 실행 등 주요 작업 수행
4. 녹화 중지 후 분석

### 주요 지표
| 지표 | 권장 | 설명 |
|------|------|------|
| FCP | < 1.8s | First Contentful Paint |
| LCP | < 2.5s | Largest Contentful Paint |
| TBT | < 200ms | Total Blocking Time |
| CLS | < 0.1 | Cumulative Layout Shift |

## 5단계: 코드 분할 (Code Splitting)

### React.lazy 적용
```jsx
// ❌ Bad: 모든 컴포넌트 즉시 로드
import AnalysisPanel from './AnalysisPanel';

// ✅ Good: 필요할 때 로드
const AnalysisPanel = React.lazy(() => import('./AnalysisPanel'));

// 사용
<Suspense fallback={<Loading />}>
  <AnalysisPanel />
</Suspense>
```

## 분석 결과 템플릿

```markdown
## 성능 분석 결과

### 📦 번들 크기
- JS: XXX KB (gzip: XXX KB)
- CSS: XXX KB
- 총합: XXX KB

### ⚡ Core Web Vitals
- FCP: X.Xs
- LCP: X.Xs
- CLS: X.XX

### 🔍 발견된 이슈
1. [이슈 설명]
   - 원인: ...
   - 해결방안: ...

### 💡 최적화 권장사항
1. [권장사항]
```
