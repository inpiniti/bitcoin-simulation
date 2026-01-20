---
description: 버그 수정 및 디버깅 워크플로우
---

# 🐛 버그 수정 워크플로우

이 워크플로우는 에러나 버그를 체계적으로 분석하고 수정하는 절차입니다.

## 사용 시점

- 콘솔 에러 발생 시
- 예상과 다른 동작 발견 시
- 사용자 버그 리포트 대응 시

## 워크플로우 단계

### 1. 에러 정보 수집
- 브라우저 콘솔 로그 확인
- 터미널 에러 메시지 확인
- 에러 발생 조건 파악 (재현 단계)

### 2. 에러 재현
- 최소 재현 시나리오 작성
- 일관성 있게 재현되는지 확인
- 재현되지 않으면 조건 범위 확대

### 3. 원인 분석

```markdown
## 의심 영역 체크리스트

### API 관련
- [ ] CORS 에러인가? → 프록시 설정 확인
- [ ] 401/403 에러인가? → 인증 토큰 확인
- [ ] 404 에러인가? → URL 경로 확인
- [ ] 500 에러인가? → 서버 로그 확인

### React 관련
- [ ] Hook 호출 순서 오류인가?
- [ ] State 직접 변경했는가?
- [ ] Props 타입 불일치인가?
- [ ] 무한 렌더링인가?

### 데이터 관련
- [ ] undefined/null 참조인가?
- [ ] 배열 인덱스 초과인가?
- [ ] 데이터 형식 불일치인가?
```

### 4. 수정 구현
- 최소 범위 수정 원칙
- 수정 전 현재 코드 백업 (git stash)
- 수정 코드 작성

### 5. 검증

// turbo
```powershell
npm run build
```

### 6. 회귀 테스트
- 원래 에러가 해결되었는지 확인
- 다른 기능에 영향 없는지 확인

## 에러 유형별 빠른 해결

### CORS 에러
```
Access to fetch at '...' has been blocked by CORS policy
```
**해결**: `vite.config.js` 프록시 설정 추가 또는 `api/` 서버리스 함수 사용

### React Hook 에러
```
Invalid hook call. Hooks can only be called inside of...
```
**해결**: Hook을 컴포넌트 또는 커스텀 Hook 내에서만 호출

### undefined 참조 에러
```
Cannot read properties of undefined
```
**해결**: Optional chaining (`?.`) 사용 또는 기본값 설정

### 무한 렌더링
```
Maximum update depth exceeded
```
**해결**: useEffect 의존성 배열 확인, 객체/배열 메모이제이션

## 디버깅 도구

### 브라우저 DevTools
- **Console**: 에러 메시지 및 로그
- **Network**: API 요청/응답 확인
- **Sources**: 중단점(Breakpoint) 디버깅

### React DevTools
- **Components**: 컴포넌트 트리 및 Props/State 확인
- **Profiler**: 렌더링 병목 분석

## 수정 완료 후 체크리스트

- [ ] 원래 에러가 해결되었는가?
- [ ] 빌드가 성공하는가?
- [ ] 다른 기능에 부작용이 없는가?
- [ ] 에러 발생 조건을 README에 기록했는가? (필요시)
