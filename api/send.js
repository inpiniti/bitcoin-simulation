import nodemailer from 'nodemailer';

/**
 * 이메일 발송 API
 * 
 * Vercel Serverless Function으로 동작하며, 
 * GitHub Actions (Cron Job) 등에 의해 5분 간격으로 호출되어 테스트 메일을 발송합니다.
 * 
 * 필수 환경 변수:
 * - SMTP_HOST: SMTP 서버 주소 (예: smtp.gmail.com)
 * - SMTP_PORT: 포트 번호 (예: 465 또는 587)
 * - SMTP_USER: 사용자 이메일 (예: user@gmail.com)
 * - SMTP_PASS: 앱 비밀번호
 * - SMTP_FROM: 발신자 이름 (선택 사항)
 */
export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

    // 환경 변수 검증
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        console.error('SMTP credentials missing');
        return res.status(500).json({
            error: 'SMTP configuration missing',
            message: 'Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in Vercel Environment Variables.'
        });
    }

    try {
        // Transporter 생성
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 465,
            secure: Number(SMTP_PORT) === 465, // 465는 true, 587은 false
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });

        // 현재 시간 포맷팅 (KST)
        const now = new Date();
        const kstTime = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

        // 메일 옵션 설정
        const mailOptions = {
            from: SMTP_FROM ? `"${SMTP_FROM}" <${SMTP_USER}>` : SMTP_USER,
            to: 'wjd0r@icloud.com',
            subject: `[Vercel Simulation] Test Mail at ${kstTime}`,
            text: `vercel > simulation > 에서 ${kstTime}에 전송한 테스트 메일입니다.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #333;">Vercel Simulation Test Mail</h2>
                    <p style="font-size: 16px; color: #555;">
                        vercel > simulation > 에서 <strong>${kstTime}</strong>에 전송한 테스트 메일입니다.
                    </p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #999;">
                        This is an automated message sent via Vercel Serverless Function.
                    </p>
                </div>
            `,
        };

        // 메일 발송
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);

        return res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            messageId: info.messageId,
            time: kstTime
        });

    } catch (error) {
        console.error('Failed to send email:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to send email',
            details: error.message
        });
    }
}
