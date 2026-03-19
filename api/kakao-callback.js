/**
 * 카카오 OAuth 콜백 핸들러
 *
 * 카카오 인증 후 리다이렉트되는 엔드포인트.
 * code를 access_token/refresh_token으로 교환 후 Supabase automation_settings에 저장.
 *
 * Query params:
 *   code      - 카카오 인가 코드
 *   state     - automation_settings.id (연동할 설정 행 ID)
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const { code, state: configId } = req.query;

    if (!code || !configId) {
        return res.status(400).send(html('❌ 잘못된 요청입니다. (code 또는 configId 누락)', false));
    }

    const restApiKey = process.env.KAKAO_REST_API_KEY;
    if (!restApiKey) {
        return res.status(500).send(html('❌ 서버 설정 오류 (KAKAO_REST_API_KEY 미설정)', false));
    }

    // redirect_uri: 현재 요청의 origin 기반으로 구성
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/kakao-callback`;

    try {
        // ── code → token 교환 ──────────────────────────────
        const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: restApiKey,
                redirect_uri: redirectUri,
                code,
            }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            console.error('[KakaoCallback] 토큰 발급 실패:', tokenData);
            return res.status(400).send(html(`❌ 토큰 발급 실패: ${tokenData.error_description || tokenData.error}`, false));
        }

        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

        // ── Supabase 저장 ──────────────────────────────────
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
            process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
        );

        const { error } = await supabase
            .from('automation_settings')
            .update({
                kakao_access_token: tokenData.access_token,
                kakao_refresh_token: tokenData.refresh_token,
                kakao_token_expires_at: expiresAt,
            })
            .eq('id', configId);

        if (error) {
            console.error('[KakaoCallback] Supabase 저장 실패:', error);
            return res.status(500).send(html(`❌ 저장 실패: ${error.message}`, false));
        }

        console.log(`[KakaoCallback] 카카오 연동 완료 (configId=${configId})`);
        return res.status(200).send(html('✅ 카카오 연동 완료!', true));

    } catch (err) {
        console.error('[KakaoCallback] 오류:', err);
        return res.status(500).send(html(`❌ 오류: ${err.message}`, false));
    }
}

function html(message, success) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>카카오 연동</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center;
           height: 100vh; margin: 0; background: #1e1e1e; color: #fff; flex-direction: column; gap: 12px; }
    p { font-size: 18px; }
  </style>
</head>
<body>
  <p>${message}</p>
  ${success ? '<p style="color:#858585;font-size:14px;">이 창이 자동으로 닫힙니다...</p>' : ''}
  <script>
    ${success ? `
      window.opener && window.opener.postMessage('kakao_connected', '*');
      setTimeout(() => window.close(), 1500);
    ` : ''}
  </script>
</body>
</html>`;
}
