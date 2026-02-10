import nodemailer from 'nodemailer';
import crypto from 'crypto';

/**
 * 이메일 발송 API (최종 고도화 모드)
 */
export default async function handler(req, res) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        return res.status(500).json({ error: 'SMTP 설정 누락' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 465,
            secure: Number(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

        const now = new Date();
        const currentTime = now.toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // 스팸 차단 방지를 위한 유니크 ID 생성 (초단위 + 랜덤)
        const uniqueId = crypto.randomBytes(3).toString('hex').toUpperCase();
        const requestId = `${now.getTime()}-${uniqueId}`;

        const mailOptions = {
            from: SMTP_FROM ? `"${SMTP_FROM}" <${SMTP_USER}>` : SMTP_USER,
            to: 'wjd0r@icloud.com',
            // 제목에 유니크 ID를 추가하여 스레드 꼬임 및 스팸 차단 방지
            subject: `[ALRT-#${uniqueId}] ${currentTime} 시뮬레이션 알림`,
            text: `[ID: ${requestId}] vercel > simulation > 에서 ${currentTime}에 전송한 메일입니다.`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
                    <style>
                        /* 아이폰 숫자 자동 변조 방지 및 폰트 설정 */
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
                        .number { font-variant-numeric: tabular-nums; color: #0070f3; font-weight: 700; }
                    </style>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f4f7f9;">
                    <div style="padding: 20px;">
                        <div style="background-color: #ffffff; border-radius: 16px; padding: 30px; border: 1px solid #e1e4e8; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                            <div style="display: flex; align-items: center; margin-bottom: 20px;">
                                <div style="background-color: #0070f3; width: 4px; height: 24px; border-radius: 2px; margin-right: 12px;"></div>
                                <h2 style="margin: 0; font-size: 20px; color: #1a1a1a; letter-spacing: -0.5px;">Vercel Status Update</h2>
                            </div>
                            
                            <p style="font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 25px;">
                                vercel > simulation > 에서 전송한 메일입니다.
                            </p>
                            
                            <div style="background-color: #f0f4f8; border-radius: 12px; padding: 20px; text-align: center;">
                                <div style="font-size: 13px; color: #666; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Update Time</div>
                                <div class="number" style="font-size: 22px;">${currentTime}</div>
                            </div>

                            <div style="margin-top: 25px; font-size: 11px; color: #abb2bf; text-align: center; font-family: monospace;">
                                TRACE-ID: <span style="color: #666;">${requestId}</span>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true, requestId });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
