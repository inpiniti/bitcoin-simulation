/**
 * 이메일 발송 API (진단 모드)
 */
export default async function handler(req, res) {
    console.log('--- API Send Function Triggered ---');
    console.log('Method:', req.method);

    // 1. 단순 응답 테스트 (패키지 의존성 없이)
    try {
        const currentTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

        // 환경 변수가 하나라도 있는지 확인 (보안상 값은 노출 안 함)
        const hasHost = !!process.env.SMTP_HOST;
        const hasUser = !!process.env.SMTP_USER;
        const hasPass = !!process.env.SMTP_PASS;

        console.log('Env Check:', { hasHost, hasUser, hasPass });

        // 만약 단순 테스트를 원하시면 여기서 바로 리턴
        return res.status(200).json({
            success: true,
            message: 'Vercel Function is ALIVE!',
            time: currentTime,
            envStatus: { hasHost, hasUser, hasPass }
        });
    } catch (error) {
        console.error('Diagnostic Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
