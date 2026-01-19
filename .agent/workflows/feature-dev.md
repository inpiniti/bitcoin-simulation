---
description: 새로운 기능 개발 워크플로우 (Feature Development Workflow)
---

# 새 기능 개발 워크플로우

이 워크플로우는 새로운 기능을 개발할 때 **반드시** 따라야 하는 단계입니다.
// turbo-all

## 사전 준비 (Pre-Flight Check)

### 1. 설계도 확인
- `README.md` 파일을 읽고 현재 프로젝트의 구조와 기존 기능을 파악합니다.
- 새 기능이 기존 설계와 어떻게 통합되는지 확인합니다.

### 2. 규칙 확인
- `GEMINI.md` 파일을 읽고 프로젝트 규칙을 숙지합니다.
- 특히 다음 섹션을 확인합니다:
  - 프로젝트 핵심 규칙 (Project Core Rules)
  - React 개발 규칙 (React Rules)
  - 외부 API 호출 규칙 (External API Call Rules)
  - UI 컴포넌트 사용 규칙 (UI Component Rules)

### 3. KIS API 문서 확인 (해당 시)
- 한국투자증권 API 관련 기능이라면 `kis/` 폴더의 마크다운 문서를 확인합니다.

## 개발 단계 (Development Phase)

### 4. 구현 계획 수립
- 변경이 필요한 파일 목록 작성
- 의존성 및 영향 범위 분석
- 단계별 구현 계획 수립

### 5. 코드 구현
- 규칙에 따라 코드 작성
- shadcn/ui 컴포넌트 사용
- Zustand 상태 관리 패턴 준수

### 6. 테스트
// turbo
```powershell
npm run dev
```
- 브라우저에서 기능 동작 확인
- 콘솔 오류 없는지 확인

## 완료 단계 (Completion Phase)

### 7. 설계도 업데이트
- 새 기능을 `README.md`에 문서화
- 변경된 화면 레이아웃이 있다면 ASCII 다이어그램 업데이트

### 8. 규칙 업데이트 (필요 시)
- 새로운 API 엔드포인트가 추가되었다면 `GEMINI.md`의 프록시 설정 섹션 업데이트
- 새로운 패턴이나 규칙이 필요하다면 추가

## 체크리스트

- [ ] README.md 설계도 확인 완료
- [ ] GEMINI.md 규칙 확인 완료
- [ ] KIS API 문서 확인 (해당 시)
- [ ] 코드 구현 완료
- [ ] 테스트 통과
- [ ] README.md 업데이트 완료
- [ ] GEMINI.md 업데이트 (필요 시)
