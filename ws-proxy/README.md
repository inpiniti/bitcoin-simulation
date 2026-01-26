# KIS WebSocket Proxy

한국투자증권(KIS) 실시간 WebSocket API를 프록시하는 서버입니다.

## 왜 필요한가?

- KIS WebSocket은 `ws://` (비보안) 프로토콜만 지원합니다.
- Vercel 등 HTTPS 환경에서는 `ws://` 연결이 브라우저에서 차단됩니다.
- 이 프록시 서버를 통해 `wss://` → `ws://` 변환을 수행합니다.

## 아키텍처

```
[브라우저] ──wss://──▶ [이 프록시 서버] ──ws://──▶ [KIS WebSocket]
                         (Railway)                (21000 포트)
```

## 로컬 실행

```bash
cd ws-proxy
npm install
npm start
```

## Railway 배포

1. [Railway](https://railway.app)에 가입/로그인
2. "New Project" → "Deploy from GitHub repo"
3. 이 리포지토리 선택
4. Settings → **Root Directory**: `ws-proxy` 입력
5. 자동 배포 완료 후 URL 확인 (예: `https://xxx.up.railway.app`)

## 환경변수 설정

Railway 배포 후 Vercel 프로젝트에 환경변수 추가:

```
VITE_WS_PROXY_URL=wss://YOUR_RAILWAY_APP.up.railway.app
```

## 헬스체크

```bash
curl https://YOUR_RAILWAY_APP.up.railway.app/health
```

## 주의사항

- Railway 무료 티어: 월 500시간 (약 20일 상시 가동 가능)
- 무료 티어는 트래픽이 없으면 5분 후 sleep → 첫 연결시 약간의 지연
- 상시 가동이 필요하면 Starter 플랜($5/월) 고려
