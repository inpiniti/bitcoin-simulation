---
name: AI Models Guide
description: TimesFM, FinBERT 및 AI 관련 API 활용 가이드
---

# 🤖 AI 모델 활용 가이드

이 스킬은 프로젝트에서 사용하는 AI 모델들의 API 호출 방법과 데이터 해석 규칙을 설명합니다.

## 📌 사용 중인 AI 모델

| 모델 | 용도 | 호스팅 |
|------|------|--------|
| TimesFM | 가격 예측 (30일) | Hugging Face Spaces |
| FinBERT | 뉴스 감성 분석 | Hugging Face Inference API |
| RoBERTa (SQuAD) | 기업 정보 QA | Hugging Face Inference API |

## 🔮 TimesFM (가격 예측)

### API 엔드포인트
```javascript
POST https://younginpiniti-bitcoin-ai-backend.hf.space/v1/forecast
```

### 요청 (Request)
```javascript
{
  "symbol": "AAPL",      // 종목 티커
  "interval": "day"      // "day" 또는 "minute"
}
```

### 응답 (Response)
```javascript
{
  "model": "google/timesfm-1.0-200m",
  "generatedAt": "2026-01-20T12:00:00Z",
  "predictionCount": 30,
  "predictions": [
    {
      "date": "2026-01-21",
      "price": 189,              // 정수 (반올림)
      "priceFormatted": "$189.45" // 소수점 포함 문자열
    },
    // ... 30일치
  ]
}
```

### 차트 표시 규칙
- **실제 가격**: 파란 계열 **실선**
- **예측 가격**: 밝은 계열 **점선** (strokeDasharray="5 5")
- **예측 시작점**: 참조선(ReferenceLine)으로 표시

### 데이터 파싱
```javascript
// priceFormatted에서 숫자 추출
const price = parseFloat(pred.priceFormatted.replace(/[$,]/g, ''));
```

## 📰 FinBERT (감성 분석)

### API 엔드포인트 (프록시 경유)
```javascript
POST /api/hf

{
  "model": "ProsusAI/finbert",
  "inputs": "Apple stock rises 5% after earnings beat"
}
```

### 응답 (Response)
```javascript
[
  [
    { "label": "positive", "score": 0.85 },
    { "label": "negative", "score": 0.10 },
    { "label": "neutral", "score": 0.05 }
  ]
]
```

### 감성 점수 계산
```javascript
// 각 뉴스별 감성 점수
const sentimentScore = positive - negative;

// 종목 전체 감성 (평균)
const avgSentiment = newsItems.reduce((sum, item) => sum + item.sentiment, 0) / newsItems.length;
```

### 점수 해석
| 점수 범위 | 해석 | UI 표시 |
|----------|------|--------|
| > 0.3 | 강한 긍정 | 🟢 POS |
| 0 ~ 0.3 | 약한 긍정 | 🟢 POS |
| -0.3 ~ 0 | 약한 부정 | 🔴 NEG |
| < -0.3 | 강한 부정 | 🔴 NEG |
| ≈ 0 | 중립 | ⚪ NEU |

## ❓ RoBERTa QA (기업 정보 질의응답)

### API 엔드포인트 (프록시 경유)
```javascript
POST /api/hf

{
  "model": "deepset/roberta-base-squad2",
  "inputs": {
    "question": "What products does Apple make?",
    "context": "Apple Inc. is ... (Wikipedia 요약)"
  }
}
```

### 응답 (Response)
```javascript
{
  "answer": "iPhone, iPad, Mac, Apple Watch",
  "score": 0.92,       // 신뢰도
  "start": 145,        // 답변 시작 위치
  "end": 178           // 답변 끝 위치
}
```

### 사용 위치
- `FinancialQAPanel.jsx`: 사용자 질문에 대한 AI 답변 생성

## 🐋 세력 수급 분석 (Whale Analysis)

### API 엔드포인트
```javascript
POST https://younginpiniti-bitcoin-ai-backend.hf.space/v1/whale
```

### 요청 (Request)
```javascript
{
  "ticker": "AAPL",
  "period": "1d"
}
```

### 응답에 포함되는 지표
- **VWAP**: 거래량 가중 평균 가격
- **OBV**: 거래량 기반 모멘텀
- **MFI**: 자금 흐름 지표

## ⚠️ 주의사항

### API 호출 규칙
1. **항상 프록시 경유**: 직접 호출 시 CORS 에러 발생
2. **환경변수 필수**: `VITE_HF_TOKEN` 설정 (선택적이나 권장)
3. **Rate Limit**: Hugging Face 무료 티어 제한 고려

### 에러 처리
```javascript
// API 응답 상태 확인
if (!response.ok) {
  console.warn('AI API Error:', response.status);
  return null; // 기본값 반환
}

// 모델 로딩 중 (503 응답)
if (response.status === 503) {
  // 약 20초 후 재시도
  await new Promise(r => setTimeout(r, 20000));
  return fetchWithRetry(...);
}
```

### 프록시 설정 위치
- **개발**: `vite.config.js` 미들웨어
- **프로덕션**: `api/hf.js` 서버리스 함수
