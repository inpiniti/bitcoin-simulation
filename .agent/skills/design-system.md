---
name: Design System Guide
description: VS Code 테마 기반 UI 디자인 시스템 가이드
---

# 🎨 디자인 시스템 가이드

이 스킬은 프로젝트의 일관된 UI/UX를 유지하기 위한 디자인 규칙을 정의합니다.

## 🎯 디자인 원칙

1. **VS Code 일관성**: Visual Studio Code 다크 테마와 동일한 룩앤필
2. **프리미엄 느낌**: 미세한 디테일과 고급스러운 색상 조합
3. **기능 중심**: 화려함보다 가독성과 사용성 우선
4. **접근성**: 색각 이상자도 구분 가능한 색상 대비

## 🎨 컬러 팔레트

### 배경색 (Background)
```css
--bg-primary: #1e1e1e;     /* 메인 배경 */
--bg-secondary: #252526;   /* 패널/카드 배경 */
--bg-tertiary: #2d2d2d;    /* 테이블 헤더 */
--bg-hover: #2a2d2e;       /* 호버 상태 */
--bg-active: #094771;      /* 선택/활성 상태 */
```

### 텍스트색 (Text)
```css
--text-primary: #cccccc;   /* 기본 텍스트 */
--text-secondary: #9d9d9d; /* 보조 텍스트 */
--text-muted: #6a6a6a;     /* 비활성 텍스트 */
--text-white: #e1e1e1;     /* 강조 텍스트 */
```

### 강조색 (Accent)
```css
--accent-blue: #007acc;    /* 주요 강조 (버튼, 링크) */
--accent-cyan: #4fc1ff;    /* 데이터 강조 */
--accent-green: #4ec9b0;   /* 성공/수익 */
--accent-orange: #ce9178;  /* 경고/주의 */
--accent-purple: #9cdcfe;  /* AI 예측 */
```

### 매매 신호 색상
```css
/* 한국식 (빨강=상승, 파랑=하락) */
--signal-buy: #f23645;     /* 매수 (빨강) */
--signal-sell: #089981;    /* 매도 (초록/청록) */
--signal-hold: #3c3c3c;    /* 보류 (회색) */

/* 변동률 표시도 동일 적용 */
--change-positive: #f23645;  /* 상승 */
--change-negative: #089981;  /* 하락 */
```

### 테두리색 (Border)
```css
--border-default: #3c3c3c;  /* 기본 테두리 */
--border-light: #3e3e42;    /* 밝은 테두리 */
--border-active: #007acc;   /* 활성 테두리 */
```

## 📐 레이아웃 규칙

### 간격 (Spacing)
```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
```

### Activity Bar
- 너비: 48px
- 아이콘 크기: 24px
- 활성 표시: 좌측 2px 보더

### Sidebar
- 너비: 280px (고정)
- 패딩: 16px

### Editor Area
- 탭 높이: 35px
- 패널 패딩: 16px

## 🔤 타이포그래피

### 폰트 패밀리
```css
/* 시스템 폰트 스택 */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
             'Helvetica Neue', Arial, sans-serif;

/* 모노스페이스 (데이터 표시) */
font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
```

### 폰트 크기
```css
--text-xs: 10px;    /* 라벨, 힌트 */
--text-sm: 11px;    /* 테이블 셀 */
--text-base: 13px;  /* 기본 텍스트 */
--text-lg: 16px;    /* 제목 */
--text-xl: 20px;    /* 큰 제목 */
```

## 🖼️ 컴포넌트 스타일

### 버튼
```jsx
// Primary 버튼
<Button className="bg-[#007acc] hover:bg-[#0062a3] text-white">
  실행
</Button>

// Ghost 버튼
<Button variant="ghost" className="text-[#cccccc] hover:bg-[#3c3c3c]">
  취소
</Button>

// Destructive 버튼
<Button variant="destructive" className="bg-[#f23645] hover:bg-[#d12f3d]">
  삭제
</Button>
```

### 테이블
```jsx
<TableRow className="border-[#3c3c3c] hover:bg-[#2a2d2e]">
  <TableCell className="font-mono text-[11px] text-[#cccccc]">
    {data}
  </TableCell>
</TableRow>
```

### 배지 (Badge)
```jsx
// 매수 신호
<Badge className="bg-[#f23645] text-white">BUY</Badge>

// 매도 신호
<Badge className="bg-[#089981] text-white">SELL</Badge>

// 상태 표시
<Badge variant="outline" className="text-[#4ec9b0] border-[#4ec9b0]">
  HOLDING
</Badge>
```

### 스크롤바
```css
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1e1e1e;
}

::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #4f4f4f;
}
```

## 🎭 애니메이션

### 기본 트랜지션
```css
transition: all 0.15s ease;
```

### 로딩 스피너
```jsx
<Loader2 className="w-4 h-4 animate-spin" />
```

### 호버 효과
```css
/* 스케일 효과 (버튼, 배지) */
.hover-scale:hover {
  transform: scale(1.02);
}
.hover-scale:active {
  transform: scale(0.98);
}
```

## 🔧 아이콘 가이드

### 사용 라이브러리
- **lucide-react**: 모든 아이콘은 Lucide 사용

### 주요 아이콘
| 용도 | 아이콘 | import |
|------|--------|--------|
| 차트 | LineChart | `lucide-react` |
| 데이터 | TableIcon | `lucide-react` |
| 분석 | Search | `lucide-react` |
| 설정 | Settings | `lucide-react` |
| 새로고침 | RefreshCcw | `lucide-react` |
| 로딩 | Loader2 | `lucide-react` |
| 닫기 | X | `lucide-react` |

### 아이콘 크기
```jsx
// 작은 아이콘 (인라인)
<Icon className="w-3 h-3" />

// 기본 아이콘
<Icon className="w-4 h-4" />

// 큰 아이콘 (빈 상태)
<Icon className="w-16 h-16 opacity-30" />
```

## ✅ UI 체크리스트

- [ ] 모든 배경색이 VS Code 팔레트 사용
- [ ] 텍스트 색상 계층 구조 일관성
- [ ] 호버/활성 상태 스타일 적용
- [ ] 모노스페이스 폰트로 숫자 표시
- [ ] 스크롤바 커스터마이징 적용
- [ ] 반응형 레이아웃 확인
