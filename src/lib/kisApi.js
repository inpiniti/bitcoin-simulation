// 한국투자증권 API 클라이언트
// 개발 환경: Vite 프록시 사용
// 프로덕션: Vercel 서버리스 함수 사용
const KIS_BASE_URL = import.meta.env.DEV
    ? '/api/kis'
    : '/api/kis'

/**
 * 접근토큰 발급
 */
export async function getAccessToken(appkey, appsecret) {
    try {
        const response = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                appkey: appkey,
                appsecret: appsecret
            })
        })

        const data = await response.json()

        if (data.access_token) {
            return {
                success: true,
                access_token: data.access_token,
                token_type: data.token_type,
                expires_in: data.expires_in,
                access_token_token_expired: data.access_token_token_expired
            }
        } else {
            return {
                success: false,
                error: data.msg1 || '토큰 발급 실패'
            }
        }
    } catch (error) {
        console.error('토큰 발급 오류:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * 접근토큰 폐기
 */
export async function revokeAccessToken(appkey, appsecret, token) {
    try {
        const response = await fetch(`${KIS_BASE_URL}/oauth2/revokeP`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({
                appkey: appkey,
                appsecret: appsecret,
                token: token
            })
        })

        const data = await response.json()
        return {
            success: data.code === '200',
            message: data.message
        }
    } catch (error) {
        console.error('토큰 폐기 오류:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * 해외주식 현재가 조회
 */
export async function getOverseasStockPrice(accessToken, appkey, appsecret, exchangeCode, symbol) {
    try {
        const params = new URLSearchParams({
            'AUTH': '',
            'EXCD': exchangeCode,
            'SYMB': symbol
        })

        const response = await fetch(`${KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price-detail?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': `Bearer ${accessToken}`,
                'appkey': appkey,
                'appsecret': appsecret,
                'tr_id': 'HHDFS76200200'
            }
        })

        const data = await response.json()

        if (data.rt_cd === '0') {
            return {
                success: true,
                data: data.output
            }
        } else {
            return {
                success: false,
                error: data.msg1
            }
        }
    } catch (error) {
        console.error('현재가 조회 오류:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * 해외주식 잔고 조회
 */
export async function getOverseasBalance(accessToken, appkey, appsecret, accountNo, accountCode) {
    try {
        const params = new URLSearchParams({
            'CANO': accountNo,
            'ACNT_PRDT_CD': accountCode,
            'WCRC_FRCR_DVSN_CD': '01', // 외화
            'NATN_CD': '840', // 미국
            'TR_MKET_CD': '00', // 전체
            'INQR_DVSN_CD': '00' // 전체
        })

        const response = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/trading/inquire-present-balance?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': `Bearer ${accessToken}`,
                'appkey': appkey,
                'appsecret': appsecret,
                'tr_id': 'CTRP6504R'
            }
        })

        const data = await response.json()

        if (data.rt_cd === '0') {
            return {
                success: true,
                holdings: data.output1 || [],
                summary: data.output3 || {}
            }
        } else {
            return {
                success: false,
                error: data.msg1
            }
        }
    } catch (error) {
        console.error('잔고 조회 오류:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * 해외주식 미체결내역 조회
 */
export async function getUnfilledOrders(accessToken, appkey, appsecret, accountNo, accountCode) {
    try {
        const params = new URLSearchParams({
            'CANO': accountNo,
            'ACNT_PRDT_CD': accountCode,
            'OVRS_EXCG_CD': 'NASD', // 미국 전체
            'SORT_SQN': 'DS', // 정순
            'CTX_AREA_FK200': '',
            'CTX_AREA_NK200': ''
        })

        const response = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/trading/inquire-nccs?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': `Bearer ${accessToken}`,
                'appkey': appkey,
                'appsecret': appsecret,
                'tr_id': 'TTTS3018R'
            }
        })

        const data = await response.json()

        if (data.rt_cd === '0') {
            return {
                success: true,
                orders: data.output || []
            }
        } else {
            return {
                success: false,
                error: data.msg1
            }
        }
    } catch (error) {
        console.error('미체결내역 조회 오류:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * 해외주식 일별거래내역 조회
 */
export async function getDailyTransactions(accessToken, appkey, appsecret, accountNo, accountCode, startDate, endDate) {
    try {
        const params = new URLSearchParams({
            'CANO': accountNo,
            'ACNT_PRDT_CD': accountCode,
            'ERLM_STRT_DT': startDate,
            'ERLM_END_DT': endDate,
            'OVRS_EXCG_CD': '',
            'PDNO': '',
            'SLL_BUY_DVSN_CD': '00', // 전체
            'LOAN_DVSN_CD': '',
            'CTX_AREA_FK100': '',
            'CTX_AREA_NK100': ''
        })

        const response = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/trading/inquire-period-trans?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': `Bearer ${accessToken}`,
                'appkey': appkey,
                'appsecret': appsecret,
                'tr_id': 'CTOS4001R',
                'custtype': 'P'
            }
        })

        const data = await response.json()

        if (data.rt_cd === '0') {
            return {
                success: true,
                transactions: data.output1 || [],
                summary: data.output2 || {}
            }
        } else {
            return {
                success: false,
                error: data.msg1
            }
        }
    } catch (error) {
        console.error('일별거래내역 조회 오류:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * 해외주식 기간손익 조회
 */
export async function getPeriodProfit(accessToken, appkey, appsecret, accountNo, accountCode, startDate, endDate) {
    try {
        const params = new URLSearchParams({
            'CANO': accountNo,
            'ACNT_PRDT_CD': accountCode,
            'OVRS_EXCG_CD': '',
            'NATN_CD': '',
            'CRCY_CD': '',
            'PDNO': '',
            'INQR_STRT_DT': startDate,
            'INQR_END_DT': endDate,
            'WCRC_FRCR_DVSN_CD': '01', // 외화
            'CTX_AREA_FK200': '',
            'CTX_AREA_NK200': ''
        })

        const response = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/trading/inquire-period-profit?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': `Bearer ${accessToken}`,
                'appkey': appkey,
                'appsecret': appsecret,
                'tr_id': 'TTTS3039R',
                'custtype': 'P'
            }
        })

        const data = await response.json()

        if (data.rt_cd === '0') {
            return {
                success: true,
                profits: data.Output1 || [],
                summary: data.Output2 || {}
            }
        } else {
            return {
                success: false,
                error: data.msg1
            }
        }
    } catch (error) {
        console.error('기간손익 조회 오류:', error)
        return {
            success: false,
            error: error.message
        }
    }
}
