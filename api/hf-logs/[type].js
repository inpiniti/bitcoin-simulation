/**
 * HuggingFace Space 로그 SSE 프록시
 * Vercel Edge Runtime - 시간 제한 없는 스트리밍 지원
 *
 * GET /api/hf-logs/run   → 컨테이너 로그
 * GET /api/hf-logs/build → 빌드 로그
 */

export const config = { runtime: 'edge' };

export default async function handler(req) {
    const url = new URL(req.url);
    const type = url.pathname.split('/').pop(); // 'run' | 'build'

    if (!['run', 'build'].includes(type)) {
        return new Response(JSON.stringify({ error: 'logType must be run or build' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const token = process.env.HF_TOKEN || process.env.VITE_HF_TOKEN;
    if (!token) {
        return new Response(
            `data: ${JSON.stringify({ error: 'HF_TOKEN이 설정되지 않았습니다. Vercel 환경 변수를 확인하세요.' })}\n\n`,
            {
                status: 200,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    }

    const HF_SPACE = process.env.HF_SPACE || process.env.VITE_HF_SPACE || 'younginpiniti/bitcoin-ai-backend';
    const targetUrl = `https://huggingface.co/api/spaces/${HF_SPACE}/logs/${type}`;

    let upstream;
    try {
        upstream = await fetch(targetUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'text/event-stream',
                'User-Agent': 'Mozilla/5.0',
            },
        });
    } catch (e) {
        return new Response(
            `data: ${JSON.stringify({ error: `HF 연결 실패: ${e.message}` })}\n\n`,
            {
                status: 200,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    }

    if (!upstream.ok) {
        return new Response(
            `data: ${JSON.stringify({ error: `HF API 오류: ${upstream.status} ${upstream.statusText}` })}\n\n`,
            {
                status: 200,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    }

    // Edge Runtime에서 upstream 스트림을 그대로 클라이언트로 전달
    return new Response(upstream.body, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
