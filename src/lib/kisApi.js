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

/**
 * 해외주식 가격급등락 조회
 * @param {string} accessToken - 접근 토큰
 * @param {string} appkey - 앱 키
 * @param {string} appsecret - 앱 시크릿
 * @param {string} type - 'rise' (급등) 또는 'fall' (급락)
 * @param {string} excd - 거래소코드 (NAS, NYS, AMS 등)
 * @param {string} mixn - N분전 (0:1분, 3:5분, 4:10분, 7:30분, 8:60분)
 */
export async function getPriceFluctuation(accessToken, appkey, appsecret, type = 'fall', excd = 'NAS', mixn = '8') {
    try {
        const params = new URLSearchParams({
            KEYB: '',
            AUTH: '',
            EXCD: excd,
            GUBN: type === 'rise' ? '1' : '0',
            MIXN: mixn,
            VOL_RANG: '0' // 전체
        })

        const response = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/ranking/price-fluct?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': `Bearer ${accessToken}`,
                'appkey': appkey,
                'appsecret': appsecret,
                'tr_id': 'HHDFS76260000',
                'custtype': 'P'
            }
        })

        const data = await response.json()

        if (data.rt_cd === '0') {
            return {
                success: true,
                stocks: (data.output2 || []).map(item => ({
                    ticker: item.symb || '',
                    name: item.knam || '',
                    currentPrice: item.last || '0',
                    changeRate: item.n_rate || '0',
                    volume: item.tvol || '0'
                }))
            }
        } else {
            return {
                success: false,
                error: data.msg1 || '가격급등락 조회 실패'
            }
        }
    } catch (error) {
        console.error('가격급등락 조회 오류:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * 해외주식 거래량급증 조회
 * @param {string} accessToken - 접근 토큰
 * @param {string} appkey - 앱 키
 * @param {string} appsecret - 앱 시크릿
 * @param {string} excd - 거래소코드 (NAS, NYS, AMS 등)
 * @param {string} mixn - N분전 (0:1분, 3:5분, 4:10분, 7:30분, 8:60분)
 */
export async function getVolumeSurge(accessToken, appkey, appsecret, excd = 'NAS', mixn = '8') {
    try {
        const params = new URLSearchParams({
            KEYB: '',
            AUTH: '',
            EXCD: excd,
            MIXN: mixn,
            VOL_RANG: '0' // 전체
        })

        const response = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/ranking/volume-surge?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': `Bearer ${accessToken}`,
                'appkey': appkey,
                'appsecret': appsecret,
                'tr_id': 'HHDFS76270000',
                'custtype': 'P'
            }
        })

        const data = await response.json()

        if (data.rt_cd === '0') {
            return {
                success: true,
                stocks: (data.output2 || []).map(item => ({
                    ticker: item.symb || '',
                    name: item.knam || '',
                    currentPrice: item.last || '0',
                    volume: item.tvol || '0',
                    volumeRate: item.n_rate || '0'
                }))
            }
        } else {
            return {
                success: false,
                error: data.msg1 || '거래량급증 조회 실패'
            }
        }
    } catch (error) {
        console.error('거래량급증 조회 오류:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * 해외주식 주문 (매수/매도) - 실전 투자 기준 (미국)
 */
export async function orderOverseasStock(accessToken, appkey, appsecret, accountNo, accountCode, orderType, exchange, symbol, price, qty) {
    try {
        // 거래소 코드 매핑
        const exchangeMap = {
            'NAS': 'NASD', // 나스닥
            'NYS': 'NYSE', // 뉴욕
            'AMS': 'AMEX', // 아멕스
            'HKS': 'SEHK', // 홍콩
            // 필요한 경우 추가
        }
        const ovrsExcgCd = exchangeMap[exchange] || 'NASD'

        // TR ID 선택 (미국 주식 기준)
        // 매수: TTTT1002U, 매도: TTTT1006U (실전)
        // 모의투자 API URL(openapivts)을 사용하는지 여부를 알 수 없으므로, 일단 실전용 TR ID 사용
        // (주의: 모의투자 환경 설정 시 VTTT... 사용 필요)
        const trId = orderType === 'buy' ? 'TTTT1002U' : 'TTTT1006U'

        const body = {
            CANO: accountNo,
            ACNT_PRDT_CD: accountCode,
            OVRS_EXCG_CD: ovrsExcgCd,
            PDNO: symbol,
            ORD_QTY: String(qty),
            OVRS_ORD_UNPR: String(price),
            ORD_SVR_DVSN_CD: '0',
            ORD_DVSN: '00' // 지정가
        }

        const response = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/trading/order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': `Bearer ${accessToken}`,
                'appkey': appkey,
                'appsecret': appsecret,
                'tr_id': trId,
                'custtype': 'P', // 개인
                // 'hashkey'는 POST Body가 있을 때 필수일 수 있으나, KIS 문서상으로는 선택사항이나 보안권장.
                // 여기서는 생략하고 진행 (많은 경우 서버에서 처리하거나 자동 생성됨)
            },
            body: JSON.stringify(body)
        })

        const data = await response.json()

        if (data.rt_cd === '0') {
            return {
                success: true,
                message: data.msg1,
                orderNo: data.output?.ODNO
            }
        } else {
            return {
                success: false,
                error: data.msg1 || '주문 실패',
                code: data.msg_cd
            }
        }
    } catch (error) {
        console.error('해외주식 주문 오류:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * 해외주식 현재가 상세 조회
 */
export async function getOverseasCurrentPrice(accessToken, appkey, appsecret, exchange, symbol) {
    try {
        // 시세 API는 3자리 코드 사용 (NAS, NYS, AMS)
        // 입력받은 exchange가 3자리라면 그대로 사용
        const excd = exchange || 'NAS'

        const params = new URLSearchParams({
            AUTH: '',
            EXCD: excd,
            SYMB: symbol
        })

        const response = await fetch(`${KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price-detail?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': `Bearer ${accessToken}`,
                'appkey': appkey,
                'appsecret': appsecret,
                'tr_id': 'HHDFS76200200',
                'custtype': 'P'
            }
        })

        const data = await response.json()

        if (data.rt_cd === '0' && data.output) {
            return {
                success: true,
                price: data.output.last,
                diff: data.output.diff,
                rate: data.output.rate,
                open: data.output.open,
                high: data.output.high,
                low: data.output.low,
                volume: data.output.tvol
            }
        } else {
            return {
                success: false,
                error: data.msg1 || '현재가 조회 실패'
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
 * 해외주식 매수 주문 Wrapper
 */
export async function buyOverseasStock(accessToken, appkey, appsecret, accountNo, accountCode, ticker, qty, price) {
    // 거래소 코드는 기본 NASD로 설정하거나, 별도 매핑 로직 필요.
    // 여기서는 간단히 'NAS' (나스닥)로 가정하거나, 추후 확장.
    return orderOverseasStock(accessToken, appkey, appsecret, accountNo, accountCode, 'buy', 'NAS', ticker, price, qty);
}

/**
 * 해외주식 매도 주문 Wrapper
 */
export async function sellOverseasStock(accessToken, appkey, appsecret, accountNo, accountCode, ticker, qty, price) {
    return orderOverseasStock(accessToken, appkey, appsecret, accountNo, accountCode, 'sell', 'NAS', ticker, price, qty);
}
