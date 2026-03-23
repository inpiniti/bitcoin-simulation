/**
 * POST /api/reschedule
 * HuggingFace 백엔드의 /auto-trade/reschedule을 호출하여
 * Supabase 설정 변경을 APScheduler에 즉시 반영합니다.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const backendUrl = process.env.BACKEND_URL || 'https://younginpiniti-bitcoin-ai-backend.hf.space';
    const cronSecret = process.env.CRON_SECRET || '';

    try {
        const response = await fetch(`${backendUrl}/auto-trade/reschedule`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(cronSecret ? { 'X-Cron-Secret': cronSecret } : {}),
            },
        });

        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ error: text });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        return res.status(502).json({ error: `백엔드 연결 실패: ${err.message}` });
    }
}
