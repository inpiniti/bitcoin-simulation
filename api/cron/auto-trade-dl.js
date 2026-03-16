/**
 * Vercel Cron Job - 딥러닝 자동매매 트리거
 *
 * vercel.json 의 crons 설정에 의해 설정된 시각에 자동 호출됩니다.
 * 호출 시 bitcoin-ai-backend 의 /auto-trade/run 엔드포인트를 호출하여
 * 딥러닝 자동매매 플로우를 실행합니다.
 *
 * 환경변수:
 *  - BACKEND_URL       : 백엔드 베이스 URL (예: https://younginpiniti-bitcoin-ai-backend.hf.space/)
 *  - CRON_SECRET       : 크론 인증 시크릿 (백엔드와 공유)
 */

export const config = {
  maxDuration: 10, // Vercel 함수 제한 (크론 트리거만 하므로 10초면 충분)
};

export default async function handler(req, res) {
  // Vercel Cron 은 GET 요청으로 호출됨
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Vercel 자체 크론 요청인지 검증 (Authorization 헤더)
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    console.error(
      '[AutoTrade Cron] BACKEND_URL 환경변수가 설정되지 않았습니다.',
    );
    return res.status(500).json({ error: 'BACKEND_URL not configured' });
  }

  const targetUrl = `${backendUrl}/auto-trade/run`;

  console.log(`[AutoTrade Cron] 백엔드 호출 시작: ${targetUrl}`);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': process.env.CRON_SECRET || '',
      },
      // 백엔드 응답을 기다리지 않고 트리거만 함 (fire-and-forget)
      // 백엔드가 오래 걸려도 Vercel 함수는 빠르게 응답
    });

    const result = await response.json().catch(() => ({}));

    console.log(`[AutoTrade Cron] 백엔드 응답: ${response.status}`, result);

    return res.status(200).json({
      triggered: true,
      backendStatus: response.status,
      backendResult: result,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AutoTrade Cron] 백엔드 호출 실패:', error.message);
    return res.status(500).json({
      triggered: false,
      error: error.message,
      triggeredAt: new Date().toISOString(),
    });
  }
}
