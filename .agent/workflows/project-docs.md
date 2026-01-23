---
description: 프로젝트 내부 기술 문서 (MDN 스타일) 작성 및 업데이트 워크플로우
---

# 프로젝트 기술 문서화 (Project Documentation)

이 워크플로우는 `src/docs/` 디렉토리에 위치한 Markdown 기반의 프로젝트 기술 문서를 작성하거나 업데이트할 때 사용합니다. JSDoc(`docs` 워크플로우)과는 별개로, 개발자를 위한 상세 가이드(MDN 스타일)를 제공하는 것이 목적입니다.

## 적용 전제 조건
- 대상 파일(`src/lib/*.js`, `src/components/*.jsx`, `src/store/useStore.js`)의 코드가 어느 정도 완성되어 있어야 합니다.
- `src/components/docs/docData.js`가 존재해야 합니다.

## 워크플로우 단계

### 1. 대상 분석 (Analyze Target)
- 문서화할 파일의 코드를 분석합니다. (`view_file`, `view_file_outline`)
- **Lib**: 함수 목록, 파라미터, 반환값, 사용법 파악.
- **Store**: State 구조, Actions, Selectors 파악.
- **Component**: Props, State Dependencies, UI 역할 파악.

### 2. 마크다운 작성/업데이트 (Write Markdown)
- **위치**: `src/docs/[type]/[filename].md` (예: `src/docs/lib/core.md`)
- **스타일**: **MDN Web Docs** 스타일 준수.
    - **Header**: 함수명/컴포넌트명 만 깔끔하게 (예: `### fetchStockData`) -> 딥링크 ID 매핑 용이성.
    - **Description**: 기능에 대한 명확한 한 줄 요약 및 상세 설명.
    - **Syntax**: 함수 시그니처 또는 컴포넌트 JSX 구조.
    - **Parameters / Props**: 매개변수 명, 타입, 설명 (가능하면 테이블 사용).
    - **Return Value**: 반환 타입과 구조 설명.
    - **State Dependencies**: (Component/Store의 경우) 의존하는 외부 상태.
    - **Example (필수)**: 실제 사용 가능한 코드 예제 (` ```javascript ` 블록).

#### 템플릿 예시 (Function)
```markdown
### functionName
기능에 대한 설명입니다.

#### 구문 (Syntax)
\`\`\`javascript
functionName(param1, param2)
\`\`\`

#### 매개변수 (Parameters)
- \`param1\` (string): 설명.
- \`param2\` (number): 설명.

#### 반환값 (Return value)
\`Promise<Object>\` - 반환 객체 구조.

#### 예제 (Example)
\`\`\`javascript
const res = await functionName('test', 123);
\`\`\`
```

### 3. 데이터 매핑 업데이트 (Update docData.js)
- **위치**: `src/components/docs/docData.js`
- `DOCS_DATA` 객체에 해당 문서가 등록되어 있는지 확인합니다.
- **Children (Tree View) 구성**: 사이드바 내비게이션을 위해 `children` 배열을 업데이트합니다.
    - **ID 규칙**: 마크다운 헤더(`#`)가 `rehype-slug`에 의해 변환되는 ID와 일치해야 합니다.
    - **규칙**: **모두 소문자**, **공백 없음**(특수문자 제거).
        - 예: `### fetchStockData` -> `id: 'fetchstockdata'`
        - 예: `### Global Settings` -> `id: 'global-settings'` (공백은 하이픈으로)
    - **Type**: `section` (중분류) 또는 `method` (함수/컴포넌트).

```javascript
'lib/core': {
    // ...
    children: [
        { id: 'api-service', label: 'API Service', type: 'section' },
        { id: 'fetchstockdata', label: 'fetchStockData', type: 'method' }, // 소문자 ID
    ]
}
```

### 4. 검증 (Verify)
- 문서 내용이 정확한지 확인합니다.
- 예제 코드가 실행 가능한지(문법 오류 없는지) 확인합니다.
- 오타나 잘못된 링크 ID가 없는지 점검합니다.
