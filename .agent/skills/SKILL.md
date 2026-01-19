---
name: Bitcoin Simulation Master Skill
description: 비트코인/주식 시뮬레이션 프로젝트의 마스터 스킬 허브
---

# 🎯 마스터 스킬 허브

이 스킬은 Bitcoin Simulation 프로젝트를 위한 **중앙 컨트롤 포인트**입니다.
모든 작업 시작 전에 이 스킬을 참조하여 올바른 워크플로우와 규칙을 따릅니다.

## 📋 필수 참조 문서

### 1. 설계도 (Blueprint)
- **파일**: `README.md`
- **용도**: 프로젝트 구조, 화면 레이아웃, 기능 명세 확인
- **업데이트 시점**: 기능 추가/변경 완료 후

### 2. 개발 규칙 (Rules)
- **파일**: `GEMINI.md`
- **용도**: 코딩 규칙, API 규칙, React 패턴 확인
- **업데이트 시점**: 새로운 규칙 추가 필요 시

### 3. API 문서 (KIS)
- **폴더**: `kis/`
- **용도**: 한국투자증권 API 호출 시 참조
- **업데이트 시점**: API 변경사항 발생 시

## 🔄 자동 실행 규칙

### 작업 시작 시
1. 이 `SKILL.md` 파일 로드
2. `README.md` 설계도 확인
3. `GEMINI.md` 규칙 확인
4. 관련 워크플로우 실행

### 작업 완료 시
1. `README.md` 업데이트 필요성 검토
2. `GEMINI.md` 업데이트 필요성 검토
3. 코드 리뷰 워크플로우 실행

## 🚦 에이전트 역할 분담

### 🎨 Planner Agent (기획)
- **역할**: 요구사항 분석, 구현 계획 수립
- **참조**: `README.md`, 사용자 요청
- **출력**: 구현 계획서, 변경 파일 목록

### 💻 Developer Agent (개발)
- **역할**: 코드 작성, 기능 구현
- **참조**: `GEMINI.md`, `kis/*.md`
- **출력**: 소스 코드, 테스트 코드

### 🔍 Reviewer Agent (검증)
- **역할**: 코드 리뷰, 품질 검증
- **참조**: `GEMINI.md` 규칙
- **출력**: 리뷰 결과, 개선 권장사항

### 🌐 Browser Agent (UI 테스트)
- **역할**: UI 동작 확인, 스크린샷 캡처
- **참조**: 브라우저 실행 결과
- **출력**: 테스트 결과, 스크린샷

## 📌 핵심 규칙 요약

### ❌ 절대 하지 말 것
1. 감성 분석(FinBERT) 기능 제거/주석 처리
2. 외부 API 직접 호출 (CORS 에러 발생)
3. Native Dialog 사용 (alert, confirm, prompt)
4. State/Props 직접 변경
5. 반복문/조건문 내에서 Hook 호출

### ✅ 항상 해야 할 것
1. 작업 전 설계도(README.md) 확인
2. 규칙(GEMINI.md) 준수
3. 프록시 경유 API 호출
4. shadcn/ui 컴포넌트 사용
5. 작업 후 문서 업데이트

## 🔧 사용 가능한 워크플로우

| 명령어 | 설명 |
|--------|------|
| `/feature-dev` | 새 기능 개발 워크플로우 실행 |
| `/sync-rules` | 규칙/설계도 동기화 |
| `/code-review` | 코드 리뷰 실행 |
| `/deploy` | 배포 워크플로우 실행 |

## 🧠 서브에이전트 활용 시나리오

### 시나리오 1: 새 기능 추가
```
[사용자] "차트에 새로운 보조지표 추가해줘"

[Planner Agent]
1. README.md 확인 → 현재 차트 구조 파악
2. 구현 계획 수립 → 변경 파일 목록 작성

[Developer Agent]  
3. GEMINI.md 규칙 확인 → React Hook 패턴 적용
4. 코드 구현 → 보조지표 컴포넌트 작성

[Browser Agent]
5. 브라우저 실행 → UI 동작 확인

[Reviewer Agent]
6. 코드 리뷰 → 규칙 준수 검증

[Planner Agent]
7. README.md 업데이트 → 새 기능 문서화
```

### 시나리오 2: 버그 수정
```
[사용자] "API 호출 시 CORS 에러 발생"

[Developer Agent]
1. GEMINI.md 확인 → API 호출 규칙 확인
2. vite.config.js 프록시 설정 확인
3. API 클라이언트 수정

[Browser Agent]
4. 브라우저에서 API 호출 테스트

[Reviewer Agent]
5. 수정 내용 검증
```

## 📊 프로젝트 컨텍스트

```yaml
project_name: Bitcoin & Stock Simulation
tech_stack:
  framework: React (Vite)
  state: Zustand
  styling: Tailwind CSS
  ui: shadcn/ui
  chart: Recharts
  
data_sources:
  - Upbit API (Crypto - 일봉)
  - Yahoo Finance (Stock - 일봉)
  - KIS API (한국투자증권 - 계좌/주문)
  - Hugging Face (AI 모델)
  
key_features:
  - 매매 전략 시뮬레이션
  - AI 가격 예측 (TimesFM)
  - 뉴스 감성 분석 (FinBERT)
  - 자동 매매 시스템
  - 종목 토론 게시판
```
