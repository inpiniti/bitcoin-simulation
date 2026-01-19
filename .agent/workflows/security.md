---
description: 보안 취약점 스캔 및 검증 워크플로우
---

# 보안 분석 워크플로우

코드의 보안 취약점을 스캔하고 검증합니다.
// turbo-all

## 1단계: 의존성 취약점 스캔

### npm audit 실행
// turbo
```powershell
npm audit
```

### 취약점 자동 수정 (가능한 경우)
```powershell
npm audit fix
```

### 심각한 취약점만 확인
```powershell
npm audit --audit-level=high
```

## 2단계: 민감 정보 노출 체크

### 🔴 절대 커밋하면 안 되는 항목
| 항목 | 체크 위치 | 상태 |
|------|-----------|------|
| API 키 | `.env`, 소스코드 | - |
| 비밀번호 | 하드코딩 여부 | - |
| 개인 토큰 | git history | - |
| 계좌 정보 | 로그, 주석 | - |

### 체크 명령어
```powershell
# .env 파일이 .gitignore에 있는지 확인
git check-ignore .env

# 소스코드에 하드코딩된 키 검색
findstr /s /i "appkey" src\*.js src\*.jsx
findstr /s /i "appsecret" src\*.js src\*.jsx
findstr /s /i "password" src\*.js src\*.jsx
```

### 올바른 환경 변수 사용
```javascript
// ❌ Bad: 하드코딩
const API_KEY = "abc123secret";

// ✅ Good: 환경 변수
const API_KEY = import.meta.env.VITE_API_KEY;
```

## 3단계: XSS (Cross-Site Scripting) 취약점

### React에서 주의할 패턴

```jsx
// ❌ 위험: dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ 안전: 텍스트로 렌더링
<div>{userInput}</div>

// ✅ 필요하다면 sanitize 라이브러리 사용
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

### URL 기반 공격 방지
```javascript
// ❌ 위험: 사용자 입력 직접 사용
window.location.href = userInput;

// ✅ 안전: URL 검증
const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};
```

## 4단계: API 보안

### CORS 설정 확인
```javascript
// vite.config.js 프록시 설정 확인
// 프로덕션에서는 Vercel Serverless Functions 사용

// ❌ 위험: 프론트엔드에서 직접 외부 API 호출
fetch('https://external-api.com/data', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// ✅ 안전: 프록시 경유
fetch('/api/external/data');
```

### 인증 토큰 관리
```javascript
// ❌ 위험: localStorage에 민감 토큰 저장 (XSS에 취약)
localStorage.setItem('accessToken', token);

// ✅ 권장: 메모리 또는 httpOnly 쿠키
// 이 프로젝트: Zustand persist + 짧은 만료시간
```

## 5단계: 입력 유효성 검증

### 사용자 입력 검증
```javascript
// 티커 입력 검증
const isValidTicker = (ticker) => {
  return /^[A-Z]{1,5}$/.test(ticker);
};

// 숫자 입력 검증
const isValidQuantity = (qty) => {
  const num = parseInt(qty, 10);
  return !isNaN(num) && num > 0 && num <= 10000;
};
```

## 6단계: 의존성 보안

### 알려진 취약 패키지 체크
```powershell
npx better-npm-audit audit
```

### package-lock.json 검증
```powershell
npm ci  # clean install로 lock 파일 무결성 확인
```

## 보안 체크리스트

### 필수 항목
- [ ] `.env` 파일이 `.gitignore`에 포함
- [ ] 하드코딩된 API 키/비밀번호 없음
- [ ] `npm audit`에서 high/critical 취약점 없음
- [ ] `dangerouslySetInnerHTML` 사용 시 sanitize 적용
- [ ] 외부 API는 프록시 경유

### 권장 항목
- [ ] Content Security Policy (CSP) 헤더 설정
- [ ] 입력값 유효성 검증
- [ ] 에러 메시지에 민감 정보 미포함
- [ ] HTTPS 강제 (프로덕션)

## 분석 결과 템플릿

```markdown
## 보안 분석 결과

### 🔴 Critical
- [없음 / 발견된 이슈]

### 🟠 High
- [없음 / 발견된 이슈]

### 🟡 Medium
- [없음 / 발견된 이슈]

### ✅ 통과한 항목
- 환경 변수 사용: OK
- npm audit: OK
- XSS 방어: OK

### 💡 권장 조치
1. [권장사항]
```
