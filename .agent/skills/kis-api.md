---
name: KIS API Quick Reference
description: 한국투자증권 API 빠른 참조 스킬 (인덱스)
---

# 🏦 KIS API 빠른 참조

이 스킬은 한국투자증권 Open API의 **요약 정보**를 제공합니다.
상세 내용이 필요하면 `kis/` 폴더의 개별 문서를 참조하세요.

## 📁 API 문서 위치

| API 종류 | 파일 | 언제 참조? |
|----------|------|-----------|
| 인증 | `kis/접근토큰발급.md` | 토큰 발급 로직 구현 시 |
| 토큰 폐기 | `kis/접근토큰폐기.md` | 토큰 만료/폐기 처리 시 |
| 주문 | `kis/해외주식 주문.md` | 매수/매도 주문 구현 시 |
| 미체결 | `kis/해외주식 미체결내역.md` | 미체결 조회 구현 시 |
| 잔고 | `kis/해외주식 체결가기준현재잔고.md` | 보유 종목 조회 시 |
| 현재가 | `kis/해외주식 현재가상세.md` | 실시간 가격 조회 시 |
| 급등락 | `kis/해외주식 가격급등락.md` | 랭킹 데이터 조회 시 |
| 거래량 | `kis/해외주식 거래량급증.md` | 거래량 급증 종목 조회 시 |
| 손익 | `kis/해외주식 기간손익.md` | 수익률 계산 시 |

## 🔑 공통 헤더 (모든 API 공통)

```javascript
const headers = {
  "content-type": "application/json; charset=utf-8",
  "authorization": `Bearer ${accessToken}`,
  "appkey": APP_KEY,
  "appsecret": APP_SECRET,
  "tr_id": "TR_ID_HERE"  // API별로 다름
};
```

## 📌 자주 쓰는 TR ID (실전투자)

### 주문 관련
| 동작 | TR ID |
|------|-------|
| 미국 매수 | `TTTT1002U` |
| 미국 매도 | `TTTT1006U` |

### 조회 관련
| 동작 | TR ID |
|------|-------|
| 미체결 내역 | `TTTS3018R` |
| 체결가 기준 잔고 | `TTTS3012R` |
| 해외주식 현재가 | `HHDFS00000300` |
| 거래량 급증 | `HHDFS76240000` |
| 가격 급등락 | `HHDFS76230000` |

## ⚠️ 주의사항

1. **Body 키값 대문자**: POST API는 `"CANO"`, `"PDNO"` 등 대문자 사용
2. **거래소 코드**: `NASD`(나스닥), `NYSE`(뉴욕), `AMEX`(아멕스)
3. **토큰 유효기간**: 24시간 (6시간 이내 재발급 시 동일 토큰 반환)
4. **운영시간**: 미국 23:30~06:00 (썸머타임: 22:30~05:00)

## 🔄 프록시 경로

```javascript
// 개발/프로덕션 모두 동일
const KIS_API_BASE = '/api/kis';

// 예시: 토큰 발급
fetch(`${KIS_API_BASE}/oauth2/tokenP`, { ... })

// 예시: 주문
fetch(`${KIS_API_BASE}/uapi/overseas-stock/v1/trading/order`, { ... })
```

## 📖 상세 정보가 필요할 때

특정 API의 전체 스펙(파라미터, 응답 필드 등)이 필요하면:

```
"해외주식 주문 API 상세 스펙 확인해줘"
→ kis/해외주식 주문.md 파일 읽기
```
