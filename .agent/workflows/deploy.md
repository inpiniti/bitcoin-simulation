---
description: 프로덕션 배포 워크플로우 (Vercel)
---

# 배포 워크플로우

이 워크플로우는 Vercel에 프로덕션 배포 시 따라야 할 단계입니다.
// turbo-all

## 배포 전 체크리스트

### 1. 로컬 빌드 테스트
// turbo
```powershell
npm run build
```
- 빌드 에러 없는지 확인
- TypeScript/ESLint 경고 해결

### 2. 환경 변수 확인
다음 환경 변수가 Vercel에 설정되어 있는지 확인:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `KIS_*` 관련 변수들

### 3. Serverless Functions 확인
`api/` 폴더의 함수들이 올바르게 구성되어 있는지 확인:
- 프록시 함수 (yahoo, kis, dataroma 등)
- 각 함수의 CORS 헤더 설정

### 4. vercel.json 설정 확인
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]
    }
  ]
}
```

## 배포 실행

### 5. Git 커밋 및 푸시
// turbo
```powershell
git add .
git commit -m "feat: [변경 내용 요약]"
git push origin main
```

### 6. Vercel 자동 배포
- `main` 브랜치 푸시 시 자동 배포 트리거
- Vercel 대시보드에서 배포 상태 확인

## 배포 후 검증

### 7. 프로덕션 테스트
- 배포된 URL에서 주요 기능 테스트:
  - [ ] 종목 검색 동작
  - [ ] 차트 로딩
  - [ ] AI 예측 API 호출
  - [ ] KIS API 연동 (인증 필요)
  - [ ] 시뮬레이션 실행

### 8. 성능 모니터링
- Vercel Analytics 확인
- 에러 로그 확인

## 롤백 절차

문제 발생 시:
```powershell
git revert HEAD
git push origin main
```

또는 Vercel 대시보드에서 이전 배포로 롤백
