// 한국투자증권 API 클라이언트
// 개발 환경: Vite 프록시 사용
// 프로덕션: Vercel 서버리스 함수 사용
const KIS_BASE_URL = '/api/simple/kis';

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

        if (!response.ok) {
            const errorText = await response.text();
            console.error('토큰 발급 실패 응답:', errorText);
            return {
                success: false,
                error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`
            }
        }

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

export async function getWebSocketApprovalKey(appkey, appsecret) {
    try {
        const response = await fetch(`${KIS_BASE_URL}/oauth2/Approval`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                appkey: appkey,
                secretkey: appsecret
            })
        })

        if (!response.ok) {
            const errorText = await response.text();
            console.error('웹소켓 접속키 발급 실패 응답:', errorText);
            return {
                success: false,
                error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`
            }
        }

        const data = await response.json()

        if (data.approval_key) {
            return {
                success: true,
                approval_key: data.approval_key
            }
        } else {
            return {
                success: false,
                error: data.msg1 || '웹소켓 접속키 발급 실패'
            }
        }
    } catch (error) {
        console.error('웹소켓 접속키 발급 오류:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * 발급받은 KIS API 접근 토큰을 폐기합니다.
 * 
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} token - 폐기할 접근 토큰
 * @returns {Promise<Object>} 결과 객체 (success, message)
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
 * 해외주식 현재 가격을 상세 조회합니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} exchangeCode - 거래소 코드 (예: NAS, NYS 등)
 * @param {string} symbol - 종목 심볼 (예: AAPL)
 * @returns {Promise<Object>} 현재가 정보 객체
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
 * 해외주식 잔고 및 보유 종목 정보를 조회합니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} accountNo - 계좌번호 (8자리)
 * @param {string} accountCode - 계좌상품코드 (2자리)
 * @returns {Promise<Object>} 잔고 및 보유 종목 리스트
 */
export async function getOverseasBalance(accessToken, appkey, appsecret, accountNo, accountCode) {
    try {
        if (!accessToken || !appkey || !appsecret || !accountNo || !accountCode) {
            console.warn('getOverseasBalance: 필수 파라미터 누락', { hasToken: !!accessToken, hasKey: !!appkey, hasSecret: !!appsecret, accountNo, accountCode });
            return {
                success: false,
                error: '필수 인증 정보가 누락되었습니다.'
            }
        }

        const params = new URLSearchParams({
            'CANO': accountNo.trim(),
            'ACNT_PRDT_CD': accountCode.trim(),
            'WCRC_FRCR_DVSN_CD': '01', // 외화
            'NATN_CD': '840', // 미국
            'TR_MKET_CD': '00', // 전체
            'INQR_DVSN_CD': '00' // 전체
        })

        const response = await fetch(`${KIS_BASE_URL}/uapi/overseas-stock/v1/trading/inquire-present-balance?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'authorization': `Bearer ${accessToken.trim()}`,
                'appkey': appkey.trim(),
                'appsecret': appsecret.trim(),
                'tr_id': 'CTRP6504R'
            }
        })

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[KIS] 잔고 조회 실패 (HTTP ${response.status}):`, errorText);

            let errorMsg = `HTTP ${response.status} Error`;
            try {
                const errJson = JSON.parse(errorText);
                errorMsg = errJson.msg1 || errJson.message || errorMsg;
            } catch (e) {
                // Not JSON
                errorMsg = errorText.substring(0, 100);
            }

            return {
                success: false,
                error: errorMsg,
                status: response.status
            };
        }

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
 * 해외주식 미체결 주문 내역을 조회합니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} accountNo - 계좌번호 (8자리)
 * @param {string} accountCode - 계좌상품코드 (2자리)
 * @returns {Promise<Object>} 미체결 주문 리스트
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
 * 특정 기간 동안의 해외주식 일별 거래 내역을 조회합니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} accountNo - 계좌번호 (8자리)
 * @param {string} accountCode - 계좌상품코드 (2자리)
 * @param {string} startDate - 조회 시작일 (YYYYMMDD)
 * @param {string} endDate - 조회 종료일 (YYYYMMDD)
 * @returns {Promise<Object>} 거래 내역 리스트 및 요약 정보
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
 * 특정 기간 동안의 해외주식 실현 손익 내역을 조회합니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} accountNo - 계좌번호 (8자리)
 * @param {string} accountCode - 계좌상품코드 (2자리)
 * @param {string} startDate - 조회 시작일 (YYYYMMDD)
 * @param {string} endDate - 조회 종료일 (YYYYMMDD)
 * @returns {Promise<Object>} 손익 내역 리스트 및 요약 정보
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
 * 해외주식 가격 급등 또는 급락 종목 순위를 조회합니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} [type='fall'] - 'rise' (급등) 또는 'fall' (급락)
 * @param {string} [excd='NAS'] - 거래소 코드 (NAS, NYS, AMS 등)
 * @param {string} [mixn='8'] - 시간 간격 (0:1분, 3:5분, 4:10분, 7:30분, 8:60분)
 * @returns {Promise<Object>} 급등락 종목 리스트
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
 * 해외주식 거래량 급증 종목 순위를 조회합니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} [excd='NAS'] - 거래소 코드 (NAS, NYS, AMS 등)
 * @param {string} [mixn='8'] - 시간 간격 (0:1분, 3:5분, 4:10분, 7:30분, 8:60분)
 * @returns {Promise<Object>} 거래량 급증 종목 리스트
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
 * 해외주식(미국)에 대한 매수 또는 매도 주문을 실행합니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} accountNo - 계좌번호 (8자리)
 * @param {string} accountCode - 계좌상품코드 (2자리)
 * @param {string} orderType - 'buy' (매수) 또는 'sell' (매도)
 * @param {string} exchange - 거래소 코드 (NAS, NYS, AMS 등)
 * @param {string} symbol - 종목 심볼 (예: AAPL)
 * @param {number|string} price - 주문 가격
 * @param {number|string} qty - 주문 수량
 * @returns {Promise<Object>} 주문 실행 결과 (success, orderNo 등)
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
            // 상세 에러 메시지 구성
            const errorMsg = data.msg1 || data.msg || '주문 실패'
            const errorCode = data.msg_cd || ''
            return {
                success: false,
                error: errorCode ? `[${errorCode}] ${errorMsg}` : errorMsg,
                code: errorCode
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
 * 해외주식 현재 가격 및 등락 정보를 상세 조회합니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} exchange - 거래소 코드 (NAS, NYS, AMS 등)
 * @param {string} symbol - 종목 심볼
 * @returns {Promise<Object>} 현재가 상세 정보 객체
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
 * 거래소 코드를 모를 때 주요 거래소(NAS, NYS, AMS)를 순서대로 조회하여 현재가를 가져옵니다.
 * 성공한 거래소 코드를 함께 반환합니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} ticker - 종목 티커
 * @returns {Promise<Object>} 성공 시 현재가 및 거래소 코드 객체
 */
export async function getOverseasStockPriceWithExchangeSearch(accessToken, appkey, appsecret, ticker) {
    const exchanges = ['NAS', 'NYS', 'AMS']; // 나스닥, 뉴욕, 아멕스 순 시도

    for (const excd of exchanges) {
        const res = await getOverseasCurrentPrice(accessToken, appkey, appsecret, excd, ticker);
        if (res.success) {
            return {
                success: true,
                price: res.price,
                exchange: excd, // 성공한 거래소 코드 반환
                data: res
            };
        }
        // 실패 시 다음 거래소 시도 (에러 로그는 무시하거나 내부적으로 처리)
    }

    return {
        success: false,
        error: "모든 거래소 조회 실패"
    };
}

/**
 * 해외주식 매수 주문을 위한 Wrapper 함수입니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} accountNo - 계좌번호
 * @param {string} accountCode - 계좌상품코드
 * @param {string} ticker - 종목 티커
 * @param {number} qty - 수량
 * @param {number} price - 가격
 * @param {string} [exchange='NAS'] - 거래소 코드
 * @returns {Promise<Object>} 주문 결과
 */
export async function buyOverseasStock(accessToken, appkey, appsecret, accountNo, accountCode, ticker, qty, price, exchange = 'NAS') {
    return orderOverseasStock(accessToken, appkey, appsecret, accountNo, accountCode, 'buy', exchange, ticker, price, qty);
}

/**
 * 해외주식 매도 주문을 위한 Wrapper 함수입니다.
 * 
 * @param {string} accessToken - KIS 접근 토큰
 * @param {string} appkey - 한국투자증권 앱 키
 * @param {string} appsecret - 한국투자증권 앱 시크릿
 * @param {string} accountNo - 계좌번호
 * @param {string} accountCode - 계좌상품코드
 * @param {string} ticker - 종목 티커
 * @param {number} qty - 수량
 * @param {number} price - 가격
 * @param {string} [exchange='NAS'] - 거래소 코드
 * @returns {Promise<Object>} 주문 결과
 */
export async function sellOverseasStock(accessToken, appkey, appsecret, accountNo, accountCode, ticker, qty, price, exchange = 'NAS') {
    return orderOverseasStock(accessToken, appkey, appsecret, accountNo, accountCode, 'sell', exchange, ticker, price, qty);
}

/**
 * 해외주식 미체결내역 조회
 * TR ID: TTTS3018R
 * 
 * @param {string} accessToken - 접근토큰
 * @param {string} appkey - 앱키
 * @param {string} appsecret - 앱시크릿
 * @param {string} accountNo - 계좌번호 앞 8자리
 * @param {string} accountCode - 계좌상품코드 뒤 2자리
 * @param {string} [exchangeCode='NASD'] - 거래소코드 (NASD: 미국전체)
 * @returns {Promise<{success: boolean, orders?: Array, error?: string}>}
 */
export async function getUnfilledOrdersWithDetails(accessToken, appkey, appsecret, accountNo, accountCode, exchangeCode = 'NASD') {
    try {
        const params = new URLSearchParams({
            'CANO': accountNo,
            'ACNT_PRDT_CD': accountCode,
            'OVRS_EXCG_CD': exchangeCode,
            'SORT_SQN': '',
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
            // 미체결내역 파싱
            const orders = (data.output || []).map(order => ({
                orderDate: order.ord_dt,                       // 주문일자 (YYYYMMDD)
                orderNo: order.odno,                            // 주문번호
                ticker: order.pdno,                             // 종목코드
                productName: order.prdt_name,                   // 종목명
                orderType: order.sll_buy_dvsn_cd,              // 01: 매도, 02: 매수
                orderTypeName: order.sll_buy_dvsn_cd_name,     // 매수/매도
                orderQty: Number(order.ft_ord_qty),            // 주문수량
                filledQty: Number(order.ft_ccld_qty),          // 체결수량
                unfilledQty: Number(order.nccs_qty),           // 미체결수량
                orderPrice: Number(order.ft_ord_unpr3),        // 주문가격
                filledPrice: Number(order.ft_ccld_unpr3),      // 체결가격
                filledAmount: Number(order.ft_ccld_amt3),      // 체결금액
                exchangeCode: order.ovrs_excg_cd,              // 거래소코드
                statusName: order.prcs_stat_name,              // 처리상태명
                currency: order.tr_crcy_cd                     // 통화코드
            }))

            return {
                success: true,
                orders
            }
        } else {
            return {
                success: false,
                error: data.msg1 || '미체결내역 조회 실패',
                orders: []
            }
        }
    } catch (error) {
        console.error('미체결내역 조회 오류:', error)
        return {
            success: false,
            error: error.message,
            orders: []
        }
    }
}
