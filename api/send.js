import nodemailer from 'nodemailer';

/**
 * 이메일 발송 API (정상 작동 모드)
 */
export default async function handler(req, res) {
    console.log('--- Email Sending Process Started ---');

    // 환경 변수 로드
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

    // 1. SMTP 설정 검증
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        console.error('Missing SMTP Environment Variables');
        return res.status(500).json({ error: 'SMTP 설정이 누락되었습니다.' });
    }

    try {
        // 2. Nodemailer Transporter 생성
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 465,
            secure: Number(SMTP_PORT) === 465, // 465는 true, 587은 false
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
            // 연결 시도 타임아웃 방지
            connectionTimeout: 10000,
            greetingTimeout: 10000,
        });

        const currentTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

        // 3. 메일 옵션 설정
        const mailOptions = {
            from: SMTP_FROM ? `"${SMTP_FROM}" <${SMTP_USER}>` : SMTP_USER,
            to: 'wjd0r@icloud.com',
            subject: `[Vercel Simulation] ${currentTime} 테스트 메일`,
            text: `vercel > simulation > 에서 ${currentTime}에 전송한 테스트 메일입니다.`,
            html: `
                <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px; max-width: 600px; margin: 20px auto; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <h2 style="color: #0070f3; margin: 0;">Vercel Simulation Alert</h2>
                        <p style="color: #666; font-size: 14px; margin-top: 5px;">Automated Status Notification</p>
                    </div>
                    <div style="padding: 20px; background-color: #f7f9fa; border-radius: 8px; line-height: 1.6;">
                        <p style="margin: 0; color: #333; font-size: 16px;">
                            vercel > simulation > 에서 전송한 메일입니다.
                        </p>
                        <p style="margin: 15px 0 0 0; color: #0070f3; font-weight: bold; font-size: 18px;">
                            🕒 ${currentTime}
                        </p>
                    </div>
                    <div style="margin-top: 25px; border-top: 1px solid #eee; padding-top: 15px; text-align: center;">
                        <p style="font-size: 12px; color: #999; margin: 0;">
                            본 메일은 시스템에 의해 자동으로 발송되었습니다.
                        </p>
                    </div>
                </div>
            `,
        };

        // 4. 메일 전송 실행
        console.log('Attempting to send mail to wjd0r@icloud.com...');
        const info = await transporter.sendMail(mailOptions);

        console.log('Email sent successfully:', info.messageId);

        return res.status(200).json({
            success: true,
            message: 'Email delivered!',
            messageId: info.messageId
        });

    } catch (error) {
        console.error('EMAIL SENDING FAILED:', error);
        return res.status(500).json({
            error: '메일 전송 도중 에러가 발생했습니다.',
            details: error.message
        });
    }
}
