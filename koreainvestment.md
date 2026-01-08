# 한국투자증권 Open API 문서

> 이 문서는 한국투자증권 Open API의 주요 엔드포인트를 정리한 참조 문서입니다.

---

## 📌 기본 정보

### Domain
- **실전투자**: `https://openapi.koreainvestment.com:9443`
- **모의투자**: `https://openapivts.koreainvestment.com:29443`

### 공통 Header
```json
{
  "content-type": "application/json; charset=utf-8",
  "authorization": "Bearer {access_token}",
  "appkey": "{your_appkey}",
  "appsecret": "{your_appsecret}",
  "tr_id": "{transaction_id}"
}
```

---

## 🔐 OAuth 인증

### 1. 접근토큰발급 (tokenP)

**Endpoint**: `POST /oauth2/tokenP`

**개요**:
- 접근토큰 유효기간: 24시간 (1일 1회 발급 원칙)
- 갱신발급주기: 6시간 (6시간 이내는 기존 토큰 재사용)

**Request Body**:
```json
{
  "grant_type": "client_credentials",
  "appkey": "your_appkey_here",
  "appsecret": "your_appsecret_here"
}
```

**Response**:
```json
{
  "access_token": "eyJ0eXUxMiJ9.eyJz...",
  "token_type": "Bearer",
  "expires_in": 7776000,
  "access_token_token_expired": "2024-08-30 08:10:10"
}
```

---

### 2. 접근토큰폐기 (revokeP)

**Endpoint**: `POST /oauth2/revokeP`

**Request Body**:
```json
{
  "appkey": "your_appkey_here",
  "appsecret": "your_appsecret_here",
  "token": "access_token_to_revoke"
}
```

**Response**:
```json
{
  "code": "200",
  "message": "success"
}
```

---

## 📈 해외주식 주문/계좌

### 1. 해외주식 주문

**Endpoint**: `POST /uapi/overseas-stock/v1/trading/order`

**TR ID**:
- 실전: `TTTT1002U` (미국 매수), `TTTT1006U` (미국 매도)
- 모의: `VTTT1002U` (미국 매수), `VTTT1001U` (미국 매도)

**Request Body**:
```json
{
  "CANO": "12345678",
  "ACNT_PRDT_CD": "01",
  "OVRS_EXCG_CD": "NASD",
  "PDNO": "AAPL",
  "ORD_QTY": "10",
  "OVRS_ORD_UNPR": "150.50",
  "ORD_SVR_DVSN_CD": "0",
  "ORD_DVSN": "00"
}
```

**거래소 코드**:
- `NASD`: 나스닥
- `NYSE`: 뉴욕
- `AMEX`: 아멕스
- `SEHK`: 홍콩
- `SHAA`: 중국상해
- `SZAA`: 중국심천
- `TKSE`: 일본
- `HASE`: 베트남 하노이
- `VNSE`: 베트남 호치민

**주문구분 (ORD_DVSN)**:
- `00`: 지정가
- `31`: MOO (장개시시장가)
- `32`: LOO (장개시지정가)
- `33`: MOC (장마감시장가)
- `34`: LOC (장마감지정가)

**Response**:
```json
{
  "rt_cd": "0",
  "msg_cd": "MCA00000",
  "msg1": "정상처리 되었습니다.",
  "output": {
    "KRX_FWDG_ORD_ORGNO": "91252",
    "ODNO": "0000117057",
    "ORD_TMD": "121052"
  }
}
```

### 2. 해외주식 미체결내역

**Endpoint**: `GET /uapi/overseas-stock/v1/trading/inquire-nccs`

**TR ID**: `TTTS3018R` (모의투자 미지원)

**개요**:
- 접수된 해외주식 주문 중 체결되지 않은 미체결 내역 조회
- 실전계좌: 최대 40건까지 조회 가능 (연속조회 지원)
- 모의투자: 미지원 (대신 주문체결내역 API의 `nccs_qty` 사용)

**Query Parameters**:
```
CANO=12345678
&ACNT_PRDT_CD=01
&OVRS_EXCG_CD=NASD
&SORT_SQN=DS
&CTX_AREA_FK200=
&CTX_AREA_NK200=
```

**거래소코드 (OVRS_EXCG_CD)**:
- `NASD`: 나스닥 (미국 전체 조회)
- `NYSE`: 뉴욕
- `AMEX`: 아멕스
- `SEHK`: 홍콩
- `SHAA`: 중국상해
- `SZAA`: 중국심천
- `TKSE`: 일본
- `HASE`: 베트남 하노이
- `VNSE`: 베트남 호치민

**정렬순서 (SORT_SQN)**:
- `DS`: 정순
- 그 외: 역순

**Response**:
```json
{
  "rt_cd": "0",
  "msg_cd": "MCA00000",
  "msg1": "정상처리 되었습니다.",
  "ctx_area_fk200": "",
  "ctx_area_nk200": "",
  "output": [
    {
      "ord_dt": "20240101",
      "odno": "0000117057",
      "pdno": "AAPL",
      "prdt_name": "APPLE INC",
      "sll_buy_dvsn_cd": "02",
      "sll_buy_dvsn_cd_name": "매수",
      "ft_ord_qty": "10",
      "ft_ccld_qty": "5",
      "nccs_qty": "5",
      "ft_ord_unpr3": "150.50",
      "ft_ccld_unpr3": "150.00",
      "ovrs_excg_cd": "NASD",
      "tr_crcy_cd": "USD"
    }
  ]
}
```

---

### 3. 해외주식 체결기준현재잔고

**Endpoint**: `GET /uapi/overseas-stock/v1/trading/inquire-present-balance`

**TR ID**:
- 실전: `CTRP6504R`
- 모의: `VTRP6504R` (output3만 지원)

**개요**:
- 해외주식 잔고를 체결 기준으로 확인
- HTS(eFriend Plus) [0839] 해외 체결기준잔고 화면과 동일
- 모의계좌는 output3(외화평가총액 등)만 정상 출력

**Query Parameters**:
```
CANO=12345678
&ACNT_PRDT_CD=01
&WCRC_FRCR_DVSN_CD=01
&NATN_CD=840
&TR_MKET_CD=00
&INQR_DVSN_CD=00
```

**원화외화구분코드 (WCRC_FRCR_DVSN_CD)**:
- `01`: 원화
- `02`: 외화

**국가코드 (NATN_CD)**:
- `000`: 전체
- `840`: 미국
- `344`: 홍콩
- `156`: 중국
- `392`: 일본
- `704`: 베트남

**거래시장코드 (TR_MKET_CD)**:
- `00`: 전체
- `01`: 나스닥(NASD)
- `02`: 뉴욕거래소(NYSE)
- `03`: 미국(PINK SHEETS)
- `04`: 미국(OTCBB)
- `05`: 아멕스(AMEX)

**조회구분코드 (INQR_DVSN_CD)**:
- `00`: 전체
- `01`: 일반해외주식
- `02`: 미니스탁

**Response**:
```json
{
  "rt_cd": "0",
  "msg_cd": "MCA00000",
  "msg1": "정상처리 되었습니다.",
  "output1": [
    {
      "prdt_name": "APPLE INC",
      "cblc_qty13": "10",
      "thdt_buy_ccld_qty1": "0",
      "thdt_sll_ccld_qty1": "0",
      "ccld_qty_smtl1": "10",
      "ord_psbl_qty1": "10",
      "frcr_pchs_amt": "1450.00",
      "frcr_evlu_amt2": "1500.00",
      "evlu_pfls_amt2": "50.00",
      "evlu_pfls_rt1": "3.45",
      "pdno": "AAPL",
      "bass_exrt": "1300.00",
      "buy_crcy_cd": "USD",
      "ovrs_now_pric1": "150.00",
      "avg_unpr3": "145.00",
      "tr_mket_name": "나스닥",
      "natn_kor_name": "미국"
    }
  ],
  "output2": [
    {
      "crcy_cd": "USD",
      "crcy_cd_name": "미국달러",
      "frcr_buy_amt_smtl": "1450.00",
      "frcr_sll_amt_smtl": "0.00",
      "frcr_dncl_amt_2": "5000.00",
      "frst_bltn_exrt": "1300.00",
      "frcr_buy_mgn_amt": "0.00",
      "frcr_etc_mgna": "0.00",
      "frcr_drwg_psbl_amt_1": "5000.00",
      "frcr_evlu_amt2": "6500000"
    }
  ],
  "output3": {
    "pchs_amt_smtl": "1885000",
    "evlu_amt_smtl": "1950000",
    "evlu_pfls_amt_smtl": "65000",
    "dncl_amt": "6500000",
    "cma_evlu_amt": "0",
    "tot_dncl_amt": "6500000",
    "etc_mgna": "0",
    "wdrw_psbl_tot_amt": "6500000",
    "frcr_evlu_tota": "1950000",
    "evlu_erng_rt1": "3.45",
    "tot_evlu_pfls_amt": "65000",
    "tot_asst_amt": "8450000"
  }
}
```

**주요 응답 필드 설명**:

**output1 (보유 종목)**:
- `prdt_name`: 종목명
- `ccld_qty_smtl1`: 체결기준 현재 보유수량
- `frcr_pchs_amt`: 외화 매입금액
- `frcr_evlu_amt2`: 외화 평가금액
- `evlu_pfls_amt2`: 평가손익금액 (외화)
- `evlu_pfls_rt1`: 평가손익율
- `avg_unpr3`: 평균단가
- `ovrs_now_pric1`: 현재가

**output2 (통화별 요약)**:
- `crcy_cd`: 통화코드 (USD, HKD, CNY, JPY, VND)
- `frcr_buy_amt_smtl`: 외화 매수금액 합계
- `frcr_dncl_amt_2`: 외화 예수금액
- `frcr_drwg_psbl_amt_1`: 외화 출금가능금액

**output3 (전체 요약)**:
- `pchs_amt_smtl`: 매입금액 합계 (원화)
- `evlu_amt_smtl`: 평가금액 합계 (원화)
- `evlu_pfls_amt_smtl`: 평가손익금액 합계 (원화)
- `tot_evlu_pfls_amt`: 총 평가손익금액
- `evlu_erng_rt1`: 평가수익율
- `tot_asst_amt`: 총 자산금액

---

### 4. 해외주식 일별거래내역

**Endpoint**: `GET /uapi/overseas-stock/v1/trading/inquire-period-trans`

**TR ID**: `CTOS4001R` (모의투자 미지원)

**Query Parameters**:
```
CANO=12345678
&ACNT_PRDT_CD=01
&ERLM_STRT_DT=20240101
&ERLM_END_DT=20240131
&OVRS_EXCG_CD=
&PDNO=
&SLL_BUY_DVSN_CD=00
&LOAN_DVSN_CD=
&CTX_AREA_FK100=
&CTX_AREA_NK100=
```

---

### 5. 해외주식 기간손익

**Endpoint**: `GET /uapi/overseas-stock/v1/trading/inquire-period-profit`

**TR ID**: `TTTS3039R` (모의투자 미지원)

**Query Parameters**:
```
CANO=12345678
&ACNT_PRDT_CD=01
&OVRS_EXCG_CD=
&NATN_CD=
&CRCY_CD=
&PDNO=
&INQR_STRT_DT=20240101
&INQR_END_DT=20240131
&WCRC_FRCR_DVSN_CD=01
&CTX_AREA_FK200=
&CTX_AREA_NK200=
```

---

## 💹 해외주식 기본시세

### 해외주식 현재가상세

**Endpoint**: `GET /uapi/overseas-price/v1/quotations/price-detail`

**TR ID**: `HHDFS76200200` (모의투자 미지원)

**Query Parameters**:
```
AUTH=
&EXCD=NAS
&SYMB=AAPL
```

**거래소코드 (EXCD)**:
- `HKS`: 홍콩
- `NYS`: 뉴욕
- `NAS`: 나스닥
- `AMS`: 아멕스
- `TSE`: 도쿄
- `SHS`: 상해
- `SZS`: 심천
- `HSX`: 호치민
- `HNX`: 하노이
- `BAY`: 뉴욕(주간)
- `BAQ`: 나스닥(주간)
- `BAA`: 아멕스(주간)

**Response**:
```json
{
  "rt_cd": "0",
  "msg_cd": "MCA00000",
  "msg1": "정상처리 되었습니다.",
  "output": {
    "rsym": "AAPL",
    "last": "150.50",
    "open": "149.00",
    "high": "151.20",
    "low": "148.80",
    "base": "149.50",
    "pvol": "50000000",
    "tvol": "55000000",
    "perx": "25.50",
    "pbrx": "5.20",
    "epsx": "6.15",
    "bpsx": "30.25",
    "vnit": "1",
    "e_hogau": "0.01"
  }
}
```

---

## 📊 해외주식 시세분석

### 1. 해외주식 가격급등락

**Endpoint**: `GET /uapi/overseas-stock/v1/ranking/price-fluct`

**TR ID**: `HHDFS76260000` (모의투자 미지원)

**Query Parameters**:
```
KEYB=
&AUTH=
&EXCD=NAS
&GUBN=1
&MIXN=3
&VOL_RANG=0
```

**급등/급락구분 (GUBN)**:
- `0`: 급락
- `1`: 급등

**N분전 (MIXN)**:
- `0`: 1분전
- `1`: 2분전
- `2`: 3분전
- `3`: 5분전
- `4`: 10분전
- `5`: 15분전
- `6`: 20분전
- `7`: 30분전
- `8`: 60분전
- `9`: 120분전

---

### 2. 해외주식 거래량급증

**Endpoint**: `GET /uapi/overseas-stock/v1/ranking/volume-surge`

**TR ID**: `HHDFS76270000` (모의투자 미지원)

**Query Parameters**:
```
KEYB=
&AUTH=
&EXCD=NAS
&MIXN=3
&VOL_RANG=0
```

---

## 📝 주요 유의사항

### 토큰 관리
- 접근토큰 유효기간: 24시간
- 6시간 이내 재호출 시 기존 토큰 재사용
- 토큰 사용 시 반드시 "Bearer " 접두사 포함

### 계좌번호 체계
- 형식: `8자리-2자리` (예: `12345678-01`)
- CANO: 앞 8자리
- ACNT_PRDT_CD: 뒤 2자리

### POST API 주의사항
- Body의 모든 key는 **대문자**로 작성 필수
- 예: `"CANO"`, `"ACNT_PRDT_CD"`, `"PDNO"` 등

### 해외주식 거래시간 (한국시간 기준)
- **미국**: 23:30 ~ 06:00 (썸머타임: 22:30 ~ 05:00)
- **일본**: 09:00 ~ 11:30, 12:30 ~ 15:00
- **상해**: 10:30 ~ 16:00
- **홍콩**: 10:30 ~ 13:00, 14:00 ~ 17:00
