# 설계도
readme.md에 설계도가 적혀 있습니다.
구현하기전에는 항상 설계도를 확인하면서 개발해주세요.

# 한국투자증권 API 문서링크
koreainvestment.md에 API 문서링크가 적혀 있습니다.
관련 내용 구현하기전에는 항상 해당 API 문서를 확인하면서 개발해주세요.

# 언어
한국어를 사용해서 답변을 부탁드립니다.

# 외부 API 호출 규칙 (External API Call Rules)

## CORS 문제 해결
모든 외부 API 호출은 CORS 문제를 방지하기 위해 **프록시**를 통해 이루어져야 합니다.

### 1. 로컬 개발 환경 (Vite Proxy)
- `vite.config.js`의 `server.proxy` 설정 사용
- 예시: `/api/kis`, `/api/yahoo`, `/api/dataroma`

### 2. 프로덕션 환경 (Vercel Serverless Functions)
- `api/` 디렉토리에 서버리스 함수 생성
- 동적 경로 지원: `api/[service]/[...path].js`

### 3. API 클라이언트 구현 규칙
```javascript
// ✅ Good: 환경에 따라 프록시 엔드포인트 사용
const API_BASE_URL = import.meta.env.DEV 
    ? '/api/service'  // 개발: Vite 프록시
    : '/api/service'  // 프로덕션: Vercel 함수

// ❌ Bad: 직접 외부 API 호출 (CORS 에러 발생)
const API_BASE_URL = 'https://external-api.com'
```

### 4. 현재 프록시 설정된 API
- **Yahoo Finance**: `/api/yahoo` → `https://query1.finance.yahoo.com`
- **DataRoma**: `/api/dataroma` → `https://www.dataroma.com`
- **한국투자증권 (KIS)**: `/api/kis` → `https://openapi.koreainvestment.com:9443`

### 5. 새로운 외부 API 추가 시
1. `vite.config.js`에 프록시 설정 추가
2. `api/` 디렉토리에 서버리스 함수 생성
3. API 클라이언트에서 프록시 엔드포인트 사용

# React 개발 규칙 (React Rules)

## 1. 컴포넌트와 Hook은 순수해야 합니다 (Purity)
순수 함수는 오직 계산만 수행하고 그 외의 작업은 하지 않습니다. 이는 코드의 이해와 디버깅을 더 쉽게 만들어 주며 React가 컴포넌트와 Hook을 자동으로 최적화할 수 있게 해줍니다.

### 순수성이 중요한 이유
- **멱등성 (Idempotency)**: 컴포넌트의 Props, State, Context 혹은 Hook의 인수에 대한 동일한 입력으로 실행할 때마다 항상 같은 결과를 얻어야 합니다.
- **사이드 이펙트 없음**: 사이드 이펙트(이벤트 핸들러, 타이머 등)는 렌더링 외부에서 실행되어야 합니다.
- **지역 변수 외 변경 금지**: 렌더링 시 지역에서 생성되지 않은 값을 수정하지 않아야 합니다.

### 비멱등 예시 (Bad)
```javascript
function Clock() {
  const time = new Date(); // 🔴 Bad: 항상 다른 결과를 반환합니다.
  return <span>{time.toLocaleString()}</span>
}
```

### 올바른 예시 (Good)
```javascript
function Clock() {
  const time = useTime(); // 커스텀 Hook 등으로 캡슐화
  return <span>{time.toLocaleString()}</span>;
}
```

## 2. 사이드 이펙트는 렌더링 외부에서 실행되어야 합니다
- 사이드 이펙트(API 호출, DOM 변경 등)는 **이벤트 핸들러**나 **useEffect** 안에서 처리해야 합니다.
- 렌더링 중에는 절대로 사이드 이펙트를 발생시키지 마세요.

### 변경이 허용되는 경우 (지역 변경)
- 컴포넌트 **내부**에서 생성된 배열이나 객체를 변경하는 것은 괜찮습니다.
```javascript
function FriendList({ friends }) {
  const items = []; // ✅ Good: 지역 변수
  for (let i = 0; i < friends.length; i++) {
    items.push(<Friend key={friends[i].id} friend={friends[i]} />);
  }
  return <section>{items}</section>;
}
```

## 3. Props와 State는 불변입니다 (Immutability)
- **Props 변경 금지**: Props는 읽기 전용입니다. 변경하고 싶다면 새 변수에 복사하세요.
- **State 변경 금지**: State를 직접 수정하지 말고 반드시 `setState` 함수를 사용하세요.

### Hook의 반환값과 인수도 불변입니다
- Hook에 전달된 값이나 반환된 값을 직접 수정하지 마세요. 필요한 경우 복사본을 만들어 사용하세요.

## 4. 컴포넌트 함수를 직접 호출하지 마세요
- 컴포넌트는 JSX 내에서 사용해야 합니다. (`<Component />`)
- 함수처럼 직접 호출(`Component()`)하면 Hook 규칙이 깨지고 React의 최적화를 방해합니다.

## 5. Hook 사용 규칙
- **최상위 레벨에서만 호출**: 반복문, 조건문, 중첩 함수 내에서 Hook을 호출하지 마세요.
- **React 함수 내에서만 호출**: 일반 JS 함수가 아닌, React 컴포넌트나 커스텀 Hook 내에서만 호출하세요.
- **동적 변경 금지**: Hook을 동적으로 생성하거나 변경하지 마세요.

## 6. UI 컴포넌트 사용 규칙 (UI Component Rules)
- **Native Dialog 사용 지양**: 브라우저 기본 `alert`, `confirm`, `prompt`는 사용하지 마세요. 대신 **shadcn/ui**의 `Dialog`, `AlertDialog`, `Toast` 등을 사용해야 합니다.
- **일관된 디자인**: 모든 UI 요소는 `shadcn/ui` 디자인 시스템과 `Tailwind CSS`를 기반으로 스타일링해야 합니다.
- **접근성 (A11y)**: 시맨틱 HTML, 키보드 탐색 지원.

## 7. React 기능 활용 및 최적화 준수
- 본 문서에 정리된 **React Hook**, **React Components**, **React API** 내용을 적극적으로 참고하여 개발하세요.
- 각 기술의 올바른 사용법을 숙지하고, **성능**(렌더링 최적화, 메모리 관리)과 **효율성**을 최우선으로 고려하여 코드를 작성해야 합니다.
- 단순 구현을 넘어, React가 제공하는 최신 기능과 API를 적재적소에 활용하여 최적화된 결과물을 개발하도록 신경 써주세요.

# react hook

## useActionState
useActionState는 폼 액션의 결과를 기반으로 State를 업데이트할 수 있도록 제공하는 Hook입니다.

```javascript
const [state, formAction, isPending] = useActionState(fn, initialState, permalink?);
```

**중요합니다!**
이전 React Canary 버전에서는 이 API가 React DOM에 포함되어 있었고, useFormState라고 불렸습니다.

### 레퍼런스
`useActionState(action, initialState, permalink?)`

### 사용법
- 폼 액션에서 반환된 정보 사용하기

### 문제 해결
- 액션이 더 이상 제출된 폼 데이터를 읽을 수 없습니다

---

### 레퍼런스: `useActionState(action, initialState, permalink?)`

`useActionState`를 컴포넌트의 최상위 레벨에서 호출하여 폼 액션이 실행될 때 업데이트되는 컴포넌트 State를 생성하세요. `useActionState`는 기존의 폼 액션 함수와 초기 State를 전달받고, 폼에서 사용할 새로운 액션을 반환합니다. 또한 최신 폼 State와 액션이 대기 중인지 여부(`isPending`)도 반환합니다. 이때 최신 폼 State는 `useActionState`에 전달한 함수에도 함께 전달됩니다.

```javascript
import { useActionState } from "react";

async function increment(previousState, formData) {
  return previousState + 1;
}

function StatefulForm({}) {
  const [state, formAction] = useActionState(increment, 0);
  return (
    <form>
      {state}
      <button formAction={formAction}>Increment</button>
    </form>
  );
}
```

폼 State는 폼을 마지막으로 제출했을 때 액션에서 반환되는 값입니다. 아직 폼을 제출하지 않았다면, `initialState`로 설정됩니다.

서버 함수(Server Function)와 함께 사용하는 경우, `useActionState`를 통해 하이드레이션(Hydration)이 끝나기 전에도 폼 제출에 대한 서버 응답을 표시할 수 있습니다.

**매개변수**
- `fn`: 폼이 제출되거나 버튼이 눌렸을 때 호출되는 함수입니다. 함수가 호출되면 첫 번째 인수로 폼의 이전 State(처음에는 전달한 `initialState`, 이후에는 이전 반환값)가 전달되고, 그 뒤로는 폼 액션이 일반적으로 받는 인수들이 전달됩니다.
- `initialState`: State가 처음에 가지기를 원하는 값입니다. 이는 직렬화 가능한 값이면 무엇이든 될 수 있습니다. 이 인수는 액션이 처음 호출된 후에는 무시됩니다.
- `permalink` (optional): 이 폼이 수정하는 고유한 페이지 URL을 포함하는 문자열입니다. 동적 콘텐츠가 있는 페이지(예: 피드)에서 점진적 향상(Progressive Enhancement)과 함께 사용됩니다. 만약 `fn`이 서버 함수이고, 폼이 자바스크립트 번들이 로드되기 전에 제출되면, 브라우저는 현재 페이지의 URL 대신 지정된 영구 링크(Permalink URL)로 이동합니다. React가 State를 전달하는 방법을 알 수 있도록, 동일한 폼 컴포넌트가 대상 페이지에 렌더링되도록 해야 합니다. (동일한 액션 `fn`과 `permalink` 포함.) 폼이 하이드레이션된 후, 이 매개변수는 더 이상 효과가 없습니다.

**반환값**
`useActionState`는 다음 세 가지 값을 담은 배열을 반환합니다.
1. 현재 State입니다. 첫 렌더링 시에는 `initialState`와 일치하며, 액션이 실행된 후에는 해당 액션이 반환한 값과 일치합니다.
2. form 컴포넌트의 `action` Prop이나, 폼 내부 button 컴포넌트의 `formAction` Prop에 전달할 수 있는 새 액션입니다. 이 액션은 `startTransition` 내에서 수동으로 호출할 수도 있습니다.
3. 현재 Transition이 대기 중인지 알려주는 `isPending` 플래그입니다.

**주의 사항**
- React 서버 컴포넌트를 지원하는 프레임워크에서 `useActionState`를 사용하면, 클라이언트 자바스크립트 실행 전에도 폼과 상호작용할 수 있습니다. 만약 서버 컴포넌트를 사용하지 않는다면, 이는 단순히 컴포넌트 지역 State와 동일하게 동작합니다.
- `useActionState`에 전달된 함수는 첫 번째 인수로 이전 또는 초기 State를 추가로 받습니다. 즉, 직접 폼 액션을 사용했을 때와 비교해 함수의 시그니처가 달라질 수 있습니다.

## useCallback
useCallback은 리렌더링 간에 함수 정의를 캐싱해 주는 React Hook입니다.

```javascript
const cachedFn = useCallback(fn, dependencies)
```

**중요합니다!**
React Compiler automatically memoizes values and functions, reducing the need for manual useCallback calls. You can use the compiler to handle memoization automatically.

### 레퍼런스
`useCallback(fn, dependencies)`

### 용법
- 컴포넌트의 리렌더링 건너뛰기
- Memoized 콜백에서 상태 업데이트하기
- Effect가 너무 자주 실행되는 것을 방지하기
- 커스텀 Hook 최적화하기

### 문제 해결
- 컴포넌트가 렌더링 될 때마다 useCallback이 다른 함수를 반환합니다.
- 반복문에서 각 항목마다 useCallback을 호출하고 싶지만, 이는 허용되지 않습니다.

---

### 레퍼런스: `useCallback(fn, dependencies)`

리렌더링 간에 함수 정의를 캐싱하려면 컴포넌트의 최상단에서 `useCallback`을 호출하세요.

```javascript
import { useCallback } from 'react';

export default function ProductPage({ productId, referrer, theme }) {
  const handleSubmit = useCallback((orderDetails) => {
    post('/product/' + productId + '/buy', {
      referrer,
      orderDetails,
    });
  }, [productId, referrer]);
  // ...
}
```

**매개변수**
- `fn`: 캐싱할 함숫값입니다. 이 함수는 어떤 인자나 반환값도 가질 수 있습니다. React는 첫 렌더링에서 이 함수를 반환합니다. (호출하는 것이 아닙니다!) 다음 렌더링에서 `dependencies` 값이 이전과 같다면 React는 같은 함수를 다시 반환합니다. 반대로 `dependencies` 값이 변경되었다면 이번 렌더링에서 전달한 함수를 반환하고 나중에 재사용할 수 있도록 이를 저장합니다. React는 함수를 호출하지 않습니다. 이 함수는 호출 여부와 호출 시점을 개발자가 결정할 수 있도록 반환됩니다.
- `dependencies`: `fn` 내에서 참조되는 모든 반응형 값의 목록입니다. 반응형 값은 props와 state, 그리고 컴포넌트 안에서 직접 선언된 모든 변수와 함수를 포함합니다. 린터가 React를 위한 설정으로 구성되어 있다면 모든 반응형 값이 의존성으로 올바르게 명시되어 있는지 검증합니다. 의존성 목록은 항목 수가 일정해야 하며 `[dep1, dep2, dep3]`처럼 인라인으로 작성해야 합니다. React는 [`Object.is`](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Object/is) 비교 알고리즘을 이용해 각 의존성을 이전 값과 비교합니다.

**반환값**
- 최초 렌더링에서는 `useCallback`은 전달한 `fn` 함수를 그대로 반환합니다.
- 후속 렌더링에서는 이전 렌더링에서 이미 저장해 두었던 `fn` 함수를 반환하거나 (의존성이 변하지 않았을 때), 현재 렌더링 중에 전달한 `fn` 함수를 그대로 반환합니다.

**주의 사항**
- `useCallback`은 Hook이므로, 컴포넌트의 최상위 레벨 또는 커스텀 Hook에서만 호출할 수 있습니다. 반복문이나 조건문 내에서 호출할 수 없습니다. 이 작업이 필요하다면 새로운 컴포넌트로 분리해서 state를 새 컴포넌트로 옮기세요.
- React는 특별한 이유가 없는 한 캐시 된 함수를 삭제하지 않습니다. 예를 들어 개발 환경에서는 컴포넌트 파일을 편집할 때 React가 캐시를 삭제합니다. 개발 환경과 프로덕션 환경 모두에서, 초기 마운트 중에 컴포넌트가 일시 중단되면 React는 캐시를 삭제합니다. 앞으로 React는 캐시 삭제를 활용하는 더 많은 기능을 추가할 수 있습니다. 예를 들어, React에 가상화된 목록에 대한 빌트인 지원이 추가한다면, 가상화된 테이블 뷰포트에서 스크롤 밖의 항목에 대해 캐시를 삭제하는것이 적절할 것 입니다. 이는 `useCallback`을 성능 최적화 방법으로 의존하는 경우에 개발자의 예상과 일치해야 합니다. 그렇지 않다면 state 변수 나 ref가 더 적절할 수 있습니다.

### 용법
#### 컴포넌트의 리렌더링 건너뛰기
렌더링 성능을 최적화할 때 자식 컴포넌트에 넘기는 함수를 캐싱할 필요가 있습니다.

컴포넌트의 리렌더링 간에 함수를 캐싱하려면 함수 정의를 `useCallback` Hook으로 감싸세요.

```javascript
import { useCallback } from 'react';

function ProductPage({ productId, referrer, theme }) {
  const handleSubmit = useCallback((orderDetails) => {
    post('/product/' + productId + '/buy', {
      referrer,
      orderDetails,
    });
  }, [productId, referrer]);
  // ...
```

`useCallback`에게 두 가지를 전달해야 합니다:
1. 리렌더링 간에 캐싱할 함수 정의
2. 함수에서 사용되는 컴포넌트 내부의 모든 값을 포함하고 있는 의존성 목록

최초 렌더링에서 `useCallback`으로부터 반환되는 함수는 호출시에 전달할 함수입니다.

이어지는 렌더링에서 React는 의존성을 이전 렌더링에서 전달한 의존성과 비교합니다. 의존성 중 하나라도 변한 값이 없다면(`Object.is`로 비교), `useCallback`은 전과 똑같은 함수를 반환합니다. 그렇지 않으면 `useCallback`은 이번 렌더링에서 전달한 함수를 반환합니다.

다시 말하면, `useCallback`은 의존성이 변하기 전까지 리렌더링 간에 함수를 캐싱합니다.

**언제 유용한가요?**
`handleSubmit` 함수를 `ProductPage`에서 `ShippingForm` 컴포넌트로 전달한다고 가정해 봅시다.

```javascript
function ProductPage({ productId, referrer, theme }) {
  // ...
  return (
    <div className={theme}>
      <ShippingForm onSubmit={handleSubmit} />
    </div>
  );
}
```

만약 `ShippingForm`이 `memo`로 최적화되어 있다면, `useCallback`이 중요해집니다.

```javascript
import { memo } from 'react';

const ShippingForm = memo(function ShippingForm({ onSubmit }) {
  // ...
});
```

`useCallback` 없이 `handleSubmit`을 정의하면, 매 렌더링마다 새로운 함수가 생성되어 `ShippingForm`의 `memo` 최적화가 깨집니다.

```javascript
function ProductPage({ productId, referrer, theme }) {
  // 🔴 Bad: theme이 바뀔 때마다 다른 함수가 생성되어 하위 컴포넌트가 리렌더링됨
  function handleSubmit(orderDetails) {
    post('/product/' + productId + '/buy', {
      referrer,
      orderDetails,
    });
  }
  // ...
}
```

`useCallback`을 사용하면 이 문제를 해결할 수 있습니다.

```javascript
function ProductPage({ productId, referrer, theme }) {
  // ✅ Good: 의존성이 변경되지 않는 한 같은 함수를 반환
  const handleSubmit = useCallback((orderDetails) => {
    post('/product/' + productId + '/buy', {
      referrer,
      orderDetails,
    });
  }, [productId, referrer]);

  return (
    <div className={theme}>
      <ShippingForm onSubmit={handleSubmit} />
    </div>
  );
}
```

**중요합니다!**
`useCallback`은 성능 최적화를 위한 용도로만 사용해야 합니다. 만약 코드가 `useCallback` 없이 작동하지 않는다면 먼저 근본적인 문제를 찾아 해결해야 합니다. 그다음에 `useCallback`을 다시 추가할 수 있습니다.

## useContext
`useContext`는 컴포넌트에서 context를 읽고 구독할 수 있게 해주는 React Hook입니다.

```javascript
const value = useContext(SomeContext)
```

### 레퍼런스
`useContext(SomeContext)`

`useContext`를 컴포넌트 최상위 레벨에서 호출하여 Context를 읽고 구독하세요.

**매개변수**
- `SomeContext`: `createContext`로 생성한 context입니다. context 자체는 정보를 담고 있지 않으며, 컴포넌트에서 제공하거나 읽을 수 있는 정보의 종류를 나타냅니다.

**반환값**
- `useContext`는 호출한 컴포넌트에서 상위 트리 중 가장 가까운 `SomeContext.Provider`에 전달된 `value`를 반환합니다. 만약 그러한 provider가 없다면, `createContext`에 전달했던 `defaultValue`를 반환합니다. 반환된 값은 항상 최신 상태입니다. React는 context가 변경되면 해당 context를 읽는 컴포넌트를 자동으로 리렌더링합니다.

### 사용법
- 트리 깊숙이 데이터 전달하기
- 객체 및 함수 전달 시 리렌더링 최적화

---

## useDebugValue
`useDebugValue`는 React DevTools에서 커스텀 Hook에 레이블을 추가할 수 있게 해주는 React Hook입니다.

```javascript
useDebugValue(value, format?)
```

### 레퍼런스
`useDebugValue(value, format?)`

커스텀 Hook의 최상위 레벨에서 `useDebugValue`를 호출하여 디버깅 가능한 값을 표시하세요.

**매개변수**
- `value`: React DevTools에 표시하고 싶은 값입니다. 어떤 타입이든 가능합니다.
- `format` (optional): 값을 포매팅하는 함수입니다. 이 함수가 제공되면 `value`를 인자로 받아 호출되며, 반환된 포맷된 값이 표시됩니다. 값의 포매팅 비용이 비쌀 때 유용합니다.

**반환값**
- `useDebugValue`는 아무것도 반환하지 않습니다.

### 사용법
- 커스텀 Hook에 레이블 추가하기
- 포매팅된 값 지연 평가하기

---

## useDeferredValue
`useDeferredValue`는 UI의 일부 업데이트를 지연시킬 수 있는 React Hook입니다.

```javascript
const deferredValue = useDeferredValue(value, initialValue?)
```

### 레퍼런스
`useDeferredValue(value, initialValue?)`

컴포넌트 최상위 레벨에서 `useDeferredValue`를 호출하여 지연된 버전의 값을 받으세요.

**매개변수**
- `value`: 지연시키려는 값입니다. 어떤 타입이든 가능합니다.
- `initialValue` (optional): 초기 렌더링 시 사용할 값입니다. 생략 시 초기 렌더링에는 `value`가 그대로 사용되며 지연되지 않습니다.

**반환값**
- 초기 렌더링 시 `initialValue`가 제공되었다면 그 값을 반환하고, 아니면 `value`를 반환합니다. 업데이트 시 React는 먼저 이전 `value`를 반환하여 리렌더링한 후, 백그라운드에서 새 `value`로 리렌더링을 시도합니다.

### 사용법
- 새 콘텐츠가 로딩되는 동안 오래된 콘텐츠 보여주기
- UI의 일부를 리렌더링하는 것을 지연시켜 성능 최적화하기

---

## useEffect
`useEffect`는 컴포넌트를 외부 시스템과 동기화할 수 있는 React Hook입니다.

```javascript
useEffect(setup, dependencies?)
```

### 레퍼런스
`useEffect(setup, dependencies?)`

컴포넌트 최상위 레벨에서 `useEffect`를 호출하여 Effect를 선언하세요.

**매개변수**
- `setup`: Effect 로직이 포함된 함수입니다. setup 함수는 선택적으로 cleanup 함수를 반환할 수 있습니다. React는 컴포넌트가 DOM에 추가될 때 setup 함수를 실행합니다. 의존성이 변경되어 다시 렌더링될 때마다 이전 값으로 cleanup 함수를 실행한 후 새 값으로 setup 함수를 실행합니다. 컴포넌트가 DOM에서 제거될 때도 cleanup 함수가 실행됩니다.
- `dependencies` (optional): setup 코드 내에서 참조된 모든 반응형 값의 목록입니다.

**반환값**
- `useEffect`는 `undefined`를 반환합니다.

### 사용법
- 외부 시스템에 연결하기
- 커스텀 Hook으로 Effect 감싸기
- 비 React 위젯 제어하기
- 데이터 페칭 (프레임워크 사용 권장)

---

## useEffectEvent (Experimental)
`useEffectEvent`는 Effect 내부에서 반응형이 아니어야 하는 로직을 추출할 수 있게 해주는 Hook입니다. (현재 실험적 기능입니다.)

```javascript
const onSomething = useEffectEvent(callback)
```

### 레퍼런스
`useEffectEvent(callback)`

**매개변수**
- `callback`: Effect 내부에서 호출하고 싶은 로직을 담은 함수입니다.

**반환값**
- `useEffectEvent`는 Effect 내부에서 호출할 수 있는 함수를 반환합니다. 이 함수는 항상 최신 `callback`을 실행하지만, 그 자체로는 반응형이 아니므로 Effect의 의존성 배열에 추가할 필요가 없습니다.

---

## useId
`useId`는 접근성 어트리뷰트에 전달할 수 있는 고유 ID를 생성하는 React Hook입니다.

```javascript
const id = useId()
```

### 레퍼런스
`useId()`

컴포넌트 최상위 레벨에서 `useId`를 호출하여 고유 ID를 생성하세요.

**반환값**
- `useId`는 특정 컴포넌트 내의 특정 `useId` 호출과 연관된 고유한 문자열 ID를 반환합니다 (예: `:r0:`).

### 사용법
- 접근성 관련 속성(aria-describedby 등)에 사용할 고유 ID 생성

---

## useImperativeHandle
`useImperativeHandle`은 ref로 노출되는 핸들을 사용자가 직접 정의할 수 있게 해주는 React Hook입니다.

```javascript
useImperativeHandle(ref, createHandle, dependencies?)
```

### 레퍼런스
`useImperativeHandle(ref, createHandle, dependencies?)`

컴포넌트 최상위 레벨에서 호출하여 노출할 ref 핸들을 정의하세요.

**매개변수**
- `ref`: `forwardRef` 렌더 함수에서 두 번째 인자로 받은 `ref` 객체입니다.
- `createHandle`: 노출하려는 ref 핸들을 반환하는 함수입니다.
- `dependencies` (optional): `createHandle` 내부에서 참조하는 반응형 값의 목록입니다.

**반환값**
- `useImperativeHandle`은 `undefined`를 반환합니다.

### 사용법
- 부모 컴포넌트에 커스텀 DOM 메서드 노출하기

---

## useInsertionEffect
`useInsertionEffect`는 레이아웃을 읽기 전에 스타일을 DOM에 주입할 수 있는 React Hook입니다. (주로 CSS-in-JS 라이브러리 작성자를 위한 Hook입니다.)

```javascript
useInsertionEffect(setup, dependencies?)
```

### 레퍼런스
`useInsertionEffect(setup, dependencies?)`

**매개변수**
- `useEffect`와 동일합니다.

**반환값**
- `useInsertionEffect`는 `undefined`를 반환합니다.

**주의 사항**
- 이 Hook은 DOM이 변경되기 전에 실행됩니다. refs에 접근하지 마세요.

---

## useLayoutEffect
`useLayoutEffect`는 브라우저가 화면을 다시 그리기 전에 실행되는 `useEffect`의 버전입니다.

```javascript
useLayoutEffect(setup, dependencies?)
```

### 레퍼런스
`useLayoutEffect(setup, dependencies?)`

**매개변수**
- `useEffect`와 동일합니다.

**반환값**
- `useLayoutEffect`는 `undefined`를 반환합니다.

**주의 사항**
- `useLayoutEffect`는 브라우저 페인팅을 차단하므로 성능 저하를 유발할 수 있습니다. 가능하면 `useEffect`를 사용하세요.

### 사용법
- 브라우저가 화면을 그리기 전에 레이아웃 측정하기

---

## useMemo
`useMemo`는 리렌더링 간에 계산 결과를 캐싱해 주는 React Hook입니다.

```javascript
const cachedValue = useMemo(calculateValue, dependencies)
```

### 레퍼런스
`useMemo(calculateValue, dependencies)`

컴포넌트 최상위 레벨에서 호출하여 계산된 값을 캐싱하세요.

**매개변수**
- `calculateValue`: 캐싱하려는 값을 계산하는 함수입니다. 파라미터를 받지 않고 값을 반환해야 합니다.
- `dependencies`: `calculateValue` 내에서 참조된 모든 반응형 값의 목록입니다.

**반환값**
- 초기 렌더링 시 `calculateValue`를 호출한 결과를 반환합니다.
- 이후 렌더링에서는 의존성이 변경되지 않았다면 이전 결과를, 변경되었다면 `calculateValue`를 다시 호출하여 그 결과를 반환합니다.

### 사용법
- 비용이 많이 드는 계산 건너뛰기
- 컴포넌트 리렌더링 건너뛰기
- 다른 Hook의 의존성 메모이제이션

---

## useOptimistic
`useOptimistic`은 비동기 작업이 진행 중일 때 보여줄 UI를 낙관적으로 업데이트할 수 있게 해주는 React Hook입니다.

```javascript
const [optimisticState, addOptimistic] = useOptimistic(state, updateFn)
```

### 레퍼런스
`useOptimistic(state, updateFn)`

**매개변수**
- `state`: 초기에 반환될 값이며, 낙관적 업데이트가 없을 때 사용될 값입니다.
- `updateFn`: 현재 상태와 `addOptimistic`에 전달된 낙관적 값을 받아, 결과적으로 생성될 낙관적 상태를 반환하는 함수입니다. 순수 함수여야 합니다.

**반환값**
- `optimisticState`: 현재 표시할 낙관적 상태입니다.
- `addOptimistic`: 낙관적 업데이트를 트리거하는 함수입니다.

---

## useReducer
`useReducer`는 컴포넌트의 상태 관리 로직을 reducer 함수로 분리할 수 있게 해주는 React Hook입니다.

```javascript
const [state, dispatch] = useReducer(reducer, initialArg, init?)
```

### 레퍼런스
`useReducer(reducer, initialArg, init?)`

**매개변수**
- `reducer`: 상태 업데이트 로직을 담은 함수입니다. `(state, action) => newState` 형태여야 합니다.
- `initialArg`: 초기 상태를 계산하는 데 사용되는 값입니다.
- `init` (optional): 초기 상태를 생성하는 함수입니다. 지정하면 `init(initialArg)`가 호출되어 초기 상태가 됩니다.

**반환값**
- 현재 상태(`state`)와 상태를 업데이트하는 `dispatch` 함수를 담은 배열을 반환합니다.

### 사용법
- 컴포넌트에 reducer 추가하기
- 이전 상태에 기반하여 상태 업데이트하기

---

## useRef
`useRef`는 렌더링에 필요하지 않은 값을 참조할 수 있게 해주는 React Hook입니다.

```javascript
const ref = useRef(initialValue)
```

### 레퍼런스
`useRef(initialValue)`

컴포넌트 최상위 레벨에서 호출하여 ref를 선언하세요.

**매개변수**
- `initialValue`: ref 객체의 `current` 프로퍼티의 초기 값입니다.

**반환값**
- `current` 프로퍼티 하나를 가진 객체를 반환합니다. 이 객체는 컴포넌트의 전 생애주기 동안 유지됩니다.

**주의 사항**
- `ref.current`를 렌더링 중에 읽거나 쓰지 마세요.
- ref 내용을 변경해도 컴포넌트가 다시 렌더링되지 않습니다.

### 사용법
- 값 참조하기 (DOM 노드, 타이머 ID 등)
- DOM 조작하기

---

## useState
`useState`는 컴포넌트에 상태 변수를 추가할 수 있게 해주는 React Hook입니다.

```javascript
const [state, setState] = useState(initialState)
```

### 레퍼런스
`useState(initialState)`

컴포넌트 최상위 레벨에서 호출하여 상태 변수를 선언하세요.

**매개변수**
- `initialState`: 상태의 초기 값입니다. 값일 수도 있고, 초기화 함수일 수도 있습니다.

**반환값**
- 현재 상태(`state`)와 상태를 업데이트하는 `setState` 함수를 담은 배열을 반환합니다.

### 사용법
- 컴포넌트에 상태 추가하기
- 이전 상태를 기반으로 상태 업데이트하기 (함수형 업데이트)

---

## useSyncExternalStore
`useSyncExternalStore`는 외부 스토어를 구독할 수 있게 해주는 React Hook입니다.

```javascript
const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)
```

### 레퍼런스
`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)`

**매개변수**
- `subscribe`: 스토어가 변경될 때 호출될 콜백을 등록하는 함수입니다.
- `getSnapshot`: 스토어의 현재 상태를 반환하는 함수입니다.
- `getServerSnapshot` (optional): 서버 렌더링 시 사용할 스냅샷을 반환하는 함수입니다.

**반환값**
- 스토어의 현재 스냅샷을 반환합니다.

---

## useTransition
`useTransition`은 UI를 차단하지 않고 상태를 업데이트할 수 있게 해주는 React Hook입니다.

```javascript
const [isPending, startTransition] = useTransition()
```

### 레퍼런스
`useTransition()`

컴포넌트 최상위 레벨에서 호출하여 상태 전환을 비차단(non-blocking)으로 표시하세요.

**반환값**
- `isPending`: 해당 전환이 진행 중인지를 나타내는 불리언 값.
- `startTransition`: 상태 업데이트를 전환으로 표시하여 호출할 수 있는 함수.

### 사용법
- 상태 업데이트를 비차단으로 만들기 (예: 탭 전환 시 UI 멈춤 방지)

# react components

## Fragment
`<Fragment>`는 DOM에 별도의 노드를 추가하지 않고 여러 자식을 그룹화할 수 있게 해주는 React 컴포넌트입니다.

```javascript
<>
  <OneChild />
  <AnotherChild />
</>
```

### 레퍼런스
`<Fragment>`

React를 import 하여 `<Fragment>`로 사용하거나 축약형인 `<>`를 사용할 수 있습니다.

**Props**
- `key` (optional): `<Fragment>` 구문을 명시적으로 사용할 때만 전달할 수 있습니다. 반복문 내에서 목록을 렌더링할 때 유용합니다.

**주의 사항**
- 축약형 `<>` 문법은 `key`를 받을 수 없습니다. `key`가 필요하다면 `Fragment`를 명시적으로 import 해서 사용하세요.

---

## Profiler
`<Profiler>`는 React 트리의 렌더링 성능을 측정할 수 있게 해주는 React 컴포넌트입니다.

```javascript
<Profiler id="App" onRender={onRender}>
  <App />
</Profiler>
```

### 레퍼런스
`<Profiler>`

컴포넌트 트리의 특정 부분 감싸서 렌더링 비용을 측정하세요.

**Props**
- `id`: 측정하려는 UI 섹션을 식별하는 문자열입니다.
- `onRender`: 프로파일링된 트리가 업데이트될 때마다 React가 호출하는 콜백 함수입니다. 렌더링에 걸린 시간 등에 대한 정보를 인자로 받습니다.

### 사용법
- 애플리케이션의 렌더링 성능 측정하기

---

## StrictMode
`<StrictMode>`는 개발 중에 컴포넌트의 일반적인 버그를 조기에 찾을 수 있게 해주는 React 컴포넌트입니다.

```javascript
<StrictMode>
  <App />
</StrictMode>
```

### 레퍼런스
`<StrictMode>`

전체 앱이나 특정 트리를 `<StrictMode>`로 감싸세요. UI에는 영향을 미치지 않습니다.

**동작 (개발 모드)**
- 컴포넌트가 불완전한 정리를 가지고 있는지 찾기 위해 Effect를 한 번 더 다시 실행합니다.
- 컴포넌트가 순수한지 확인하기 위해 렌더링을 한 번 더 다시 실행합니다.
- 더 이상 사용되지 않는 API 사용을 확인합니다.

### 사용법
- 개발 중 잠재적인 문제 확인하기

---

## Suspense
`<Suspense>`는 자식 컴포넌트가 로딩되는 동안 대체 UI(fallback)를 표시할 수 있게 해주는 React 컴포넌트입니다.

```javascript
<Suspense fallback={<Loading />}>
  <SomeComponent />
</Suspense>
```

### 레퍼런스
`<Suspense>`

**Props**
- `children`: 렌더링하려는 실제 UI입니다.
- `fallback`: 로딩이 완료되지 않았을 때 대신 보여줄 UI(스피너, 골격 등)입니다.

### 사용법
- 데이터가 로딩되는 동안 Fallback 표시하기
- 지연 로딩 컴포넌트(`React.lazy`)와 함께 사용하기

---

## Activity (Experimental)
`<Activity>`는 컴포넌트의 상태(State)를 유지하면서 화면에서 숨길 수 있게 해주는 React 컴포넌트입니다. (이전의 Offscreen API)

```javascript
<Activity mode="hidden">
  <Sidebar />
</Activity>
```

### 레퍼런스
`<Activity>`

**Props**
- `mode`: `'visible'` 또는 `'hidden'`. `'hidden'`일 경우 React는 자식을 DOM에서 숨기지만(display: none 등), 컴포넌트의 상태는 메모리에 유지합니다.
- `children`: 관리할 자식 컴포넌트입니다.

### 사용법
- 탭 전환이나 모달 등에서 컴포넌트를 언마운트하지 않고 숨겨서 상태 보존하기
- 나중에 다시 표시될 때 렌더링 비용 절약하기

---

## ViewTransition (Experimental)
`<ViewTransition>`은 DOM 업데이트를 뷰 트랜지션(View Transition API)으로 감싸주는 React 컴포넌트입니다.

```javascript
<ViewTransition>
  <App />
</ViewTransition>
```

### 레퍼런스
`<ViewTransition>`

이 컴포넌트 내부에서 발생하는 state 업데이트나 DOM 변경은 뷰 트랜지션을 트리거하여 부드러운 애니메이션 전환을 가능하게 합니다.

**사용법**
- 페이지 내비게이션이나 주요 UI 변경 시 부드러운 전환 효과 적용하기


# react api

## act
`act`는 테스트 헬퍼 함수로, 컴포넌트의 가상 DOM 업데이트가 브라우저 DOM에 반영될 때까지 기다리게 해줍니다.

```javascript
await act(async () => {
  // 컴포넌트 렌더링, 이벤트 발생 등
});
```

### 사용법
- 테스트 환경에서 단언(assert)하기 전에 모든 업데이트가 처리되었는지 보장하기

---

## cache
`cache`는 서버 컴포넌트에서 데이터 페칭 결과나 계산 결과를 캐싱할 수 있게 해주는 API입니다.

```javascript
const getCachedData = cache(async (id) => {
  return await db.user.findUnique({ id });
});
```

### 사용법
- 서버 요청 수명 동안 데이터를 메모이제이션하여 중복 요청 방지 (React Server Components 전용)

---

## createContext
`createContext`는 컴포넌트가 제공하거나 읽을 수 있는 Context를 생성합니다.

```javascript
const SomeContext = createContext(defaultValue);
```

### 사용법
- `useContext`와 함께 사용하여 트리 깊숙이 데이터 전달하기
- Provider를 통해 하위 컴포넌트에 값 제공하기

---

## lazy
`lazy`는 컴포넌트의 코드를 처음 렌더링될 때까지 로딩을 지연시킬 수 있게 해주는 API입니다.

```javascript
const MarkdownPreview = lazy(() => import('./MarkdownPreview.js'));
```

### 사용법
- 코드를 분할(Code Splitting)하여 초기 번들 크기 줄이기
- `Suspense`와 함께 사용하여 로딩 상태 처리하기

---

## memo
`memo`는 컴포넌트의 props가 변경되지 않았다면 리렌더링을 건너뛰게 해주는 고차 컴포넌트(HOC)입니다.

```javascript
const MemoizedComponent = memo(SomeComponent, arePropsEqual?);
```

### 사용법
- 불필요한 리렌더링을 방지하여 성능 최적화
- `useCallback`, `useMemo`와 함께 최적화 전략으로 사용

---

## startTransition
`startTransition`은 UI를 차단하지 않고 상태를 업데이트할 수 있게 해주는 API입니다. (`useTransition` Hook 없이 사용 가능)

```javascript
startTransition(() => {
  // 우선순위가 낮은 상태 업데이트 (예: 탭 전환, 검색 필터링)
  setTab('news');
});
```

### 사용법
- Hook을 사용할 수 없는 곳에서 트랜지션 업데이트 트리거하기

---

## use
`use`는 리소스(Promise나 Context)의 값을 읽을 수 있게 해주는 API입니다.

```javascript
const value = use(resource);
```

### 사용법
- 컴포넌트 내부(조건문, 반복문 포함)에서 Context 읽기 (`useContext`보다 유연함)
- 서버 컴포넌트에서 클라이언트 컴포넌트로 전달된 Promise 읽기 (Suspense와 통합됨)

---

## experimental_taintObjectReference (Experimental)
`experimental_taintObjectReference`는 특정 객체가 클라이언트 컴포넌트로 전달되는 것을 방지합니다 (보안 목적).

```javascript
experimental_taintObjectReference(errorMessage, object);
```

### 사용법
- 민감한 데이터(키, 암호 등)가 포함된 객체가 실수로 클라이언트에 노출되는 것 방지 (Server Actions/Server Components)

---

## experimental_taintUniqueValue (Experimental)
`experimental_taintUniqueValue`는 특정 고유 값(문자열, 숫자 등)이 클라이언트로 전달되는 것을 방지합니다.

```javascript
experimental_taintUniqueValue(errorMessage, globalInstance, value);
```

### 사용법
- 토큰, API 키와 같은 민감한 값이 클라이언트로 유출되는 것을 차단

---

## 기타 실험적 API
- **addTransitionType**: 트랜지션에 메타데이터를 추가하는 실험적 API
- **cacheSignal**: 캐시 무효화 신호를 생성하는 실험적 API
- **captureOwnerStack**: 현재 컴포넌트의 오너 스택(owner stack)을 캡처하는 실험적 API (주로 개발 도구용)


